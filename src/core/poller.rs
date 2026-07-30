//! 轮询器模块

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio::task::JoinSet;
use tracing::{debug, error, info, warn};

use crate::alert::AlertManager;
use crate::core::monitor::MinecraftQuerier;
use crate::db::Database;
use crate::models::*;
use crate::utils::time::{now_gmt8, Gmt8Time};
use crate::ws::WsBroadcaster;

fn compute_config_hash(interval: u64, nodes: &[Node]) -> u64 {
    let mut hasher = DefaultHasher::new();
    interval.hash(&mut hasher);
    let mut sorted: Vec<_> = nodes.iter().collect();
    sorted.sort_by_key(|n| &n.id);
    for n in &sorted {
        n.id.hash(&mut hasher);
        n.name.hash(&mut hasher);
        n.host.hash(&mut hasher);
        n.port.hash(&mut hasher);
        n.edition.hash(&mut hasher);
        n.color.hash(&mut hasher);
        n.enabled.hash(&mut hasher);
        n.server_id.hash(&mut hasher);
        n.sort_order.hash(&mut hasher);
    }
    hasher.finish()
}

struct ServerPoller {
    db: Arc<dyn Database>,
    broadcaster: Arc<WsBroadcaster>,
    enabled_nodes: Vec<Node>,
    poll_interval: u64,
    alert_manager: Arc<tokio::sync::RwLock<Option<AlertManager>>>,
}

impl ServerPoller {
    async fn run(self, mut shutdown_rx: watch::Receiver<bool>) {
        info!(
            "轮询器启动: interval={}s, nodes={}",
            self.poll_interval,
            self.enabled_nodes.len()
        );
        self.poll_all().await;
        let mut interval = tokio::time::interval(Duration::from_secs(self.poll_interval));
        loop {
            tokio::select! {
                _ = interval.tick() => self.poll_all().await,
                result = shutdown_rx.changed() => {
                    // 无论 changed() 成功或失败（sender dropped）都应退出
                    if result.is_ok() {
                        info!("轮询器收到关闭信号");
                    } else {
                        warn!("轮询器关闭通道已关闭");
                    }
                    break;
                }
            }
        }
    }

    async fn poll_all(&self) {
        let ts = now_gmt8();
        if self.enabled_nodes.is_empty() {
            warn!("没有启用任何节点");
            return;
        }
        let mut tasks = JoinSet::new();
        for node in &self.enabled_nodes {
            let n = node.clone();
            tasks.spawn(async move { Self::poll_single(&n, ts).await });
        }
        let mut online = 0u32;
        let mut total = 0u32;
        let mut obs: Vec<(String, bool, Option<Vec<String>>)> = Vec::new();
        let mut entries: Vec<StatusLogEntry> = Vec::new();
        while let Some(r) = tasks.join_next().await {
            match r {
                Ok((entry, pls)) => {
                    total += 1;
                    if entry.online {
                        online += 1;
                    }
                    obs.push((entry.node_id.clone(), entry.online, pls));
                    entries.push(entry);
                }
                Err(e) => {
                    error!("节点查询任务失败: {}", e);
                    total += 1;
                }
            }
        }
        if !entries.is_empty() {
            if let Err(e) = self.db.log_status_batch(&entries).await {
                error!("批量记录状态失败: {}", e);
            }
        }
        if let Err(e) = self.db.update_player_sessions_aggregate(&obs, ts).await {
            error!("更新玩家会话失败: {}", e);
        }
        let snapshots = entries
            .iter()
            .map(|e| {
                let server_id = self
                    .enabled_nodes
                    .iter()
                    .find(|n| n.id == e.node_id)
                    .map(|n| n.server_id.clone())
                    .unwrap_or_default();
                crate::ws::WsNodeSnapshot {
                    node_id: e.node_id.clone(),
                    server_id,
                    online: e.online,
                    latency: e.latency,
                    players_online: e.players_online,
                    players_max: e.players_max,
                    version: e.version.clone(),
                    motd: e.motd.clone(),
                }
            })
            .collect();
        self.broadcaster
            .broadcast_poll_complete(ts, snapshots)
            .await;
        if let Some(ref am) = *self.alert_manager.read().await {
            am.check_and_alert(online > 0, online, total).await;
        }
        debug!("轮询完成: {}/{}", online, total);
    }

    async fn poll_single(node: &Node, ts: Gmt8Time) -> (StatusLogEntry, Option<Vec<String>>) {
        let edition: crate::config::ServerEdition = node
            .edition
            .as_str()
            .parse()
            .unwrap_or(crate::config::ServerEdition::Java);
        let st = MinecraftQuerier::query_server(
            &node.host,
            node.port as u16,
            Duration::from_secs(5),
            &edition,
        )
        .await;
        let spj = st
            .sample_players
            .as_ref()
            .and_then(|p| serde_json::to_string(p).ok());
        let ej = st.edition.as_ref().map(|e| e.to_string());
        let entry = StatusLogEntry {
            node_id: node.id.clone(),
            timestamp: ts,
            online: st.online,
            latency: st.latency,
            players_online: st.players_online.map(|n| n as i32),
            players_max: st.players_max.map(|n| n as i32),
            version: st.version,
            motd: st.motd.clone(),
            sample_players: spj,
            software: st.software,
            plugins: st
                .plugins
                .map(|p| serde_json::to_string(&p).unwrap_or_default()),
            map: st.map,
            edition: ej,
        };
        (entry, st.sample_players.clone())
    }
}

pub struct ServerPollerManager {
    db: Arc<dyn Database>,
    broadcaster: Arc<WsBroadcaster>,
    restart_tx: watch::Sender<bool>,
    global_shutdown_rx: watch::Receiver<bool>,
    active_config_hash: AtomicU64,
    alert_manager: Arc<tokio::sync::RwLock<Option<AlertManager>>>,
}

impl ServerPollerManager {
    pub fn new(
        db: Arc<dyn Database>,
        broadcaster: Arc<WsBroadcaster>,
        global_shutdown_rx: watch::Receiver<bool>,
    ) -> Self {
        let (rtx, _) = watch::channel(false);
        Self {
            db,
            broadcaster,
            restart_tx: rtx,
            global_shutdown_rx,
            active_config_hash: AtomicU64::new(0),
            alert_manager: Arc::new(tokio::sync::RwLock::new(None)),
        }
    }
    pub fn restart(&self) {
        let _ = self.restart_tx.send(true);
    }
    pub async fn config_synced(&self) -> bool {
        let db_interval = self.db.poll_interval_secs().await;
        let db_nodes = self.db.get_enabled_nodes().await.unwrap_or_default();
        let db_hash = compute_config_hash(db_interval, &db_nodes);
        let ah = self.active_config_hash.load(Ordering::Relaxed);
        if ah == 0 {
            return false;
        }
        ah == db_hash
    }

    pub async fn run(self: Arc<Self>) -> anyhow::Result<()> {
        let mut grx = self.global_shutdown_rx.clone();
        loop {
            let poll_interval = self.db.poll_interval_secs().await;
            let nodes = self.db.get_enabled_nodes().await.unwrap_or_default();
            if nodes.is_empty() {
                self.active_config_hash.store(0, Ordering::Relaxed);
                warn!("没有启用任何节点");
                let mut rx = self.restart_tx.subscribe();
                tokio::select! { _ = rx.changed() => continue, result = grx.changed() => { if result.is_ok() || result.is_err() { return Ok(()); } } }
            }
            self.active_config_hash.store(
                compute_config_hash(poll_interval, &nodes),
                Ordering::Relaxed,
            );
            // 加载/更新告警管理器配置
            {
                let new_cfg = if let Ok(Some(v)) = self.db.get_app_config("webhook_alert").await {
                    serde_json::from_str::<crate::config::WebhookAlertConfig>(&v).ok()
                } else {
                    None
                };
                let sn = self
                    .db
                    .get_app_config("server_name")
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "MotdTracker".to_string());
                let mut am_guard = self.alert_manager.write().await;
                match (new_cfg, am_guard.as_mut()) {
                    (Some(cfg), Some(am)) => {
                        am.update_config(cfg, sn);
                    }
                    (Some(cfg), None) => {
                        *am_guard = Some(AlertManager::new(cfg, sn));
                    }
                    (None, Some(_)) => {
                        *am_guard = None;
                    }
                    _ => {}
                }
            }
            info!("创建轮询器: {}s, {} nodes", poll_interval, nodes.len());
            let (tx, rx) = watch::channel(false);
            let poller = ServerPoller {
                db: self.db.clone(),
                broadcaster: self.broadcaster.clone(),
                enabled_nodes: nodes,
                poll_interval,
                alert_manager: self.alert_manager.clone(),
            };
            let h = tokio::spawn(async move {
                poller.run(rx).await;
            });
            let mut rrx = self.restart_tx.subscribe();
            tokio::select! { _ = rrx.changed() => { let _ = tx.send(true); tokio::time::sleep(Duration::from_millis(100)).await; h.abort(); info!("轮询器已终止，准备重建"); continue; } result = grx.changed() => { let _ = tx.send(true); if result.is_ok() || result.is_err() { return Ok(()); } } }
        }
    }
}
