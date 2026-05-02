//! 轮询器模块

use std::sync::Arc;
use std::time::Duration;
use chrono::{DateTime, Utc};
use tokio::task::JoinSet;
use tracing::{debug, error, info, warn};

use crate::config::{AppConfig, NodeConfig};
use crate::db::Database;
use crate::models::StatusLogEntry;
use crate::core::monitor::MinecraftQuerier;
use crate::ws::WsBroadcaster;
use crate::alert::AlertManager;

/// 服务器轮询器
pub struct ServerPoller {
    config: Arc<AppConfig>,
    db: Arc<dyn Database>,
    broadcaster: Arc<WsBroadcaster>,
    alert_manager: Option<Arc<AlertManager>>,
}

impl ServerPoller {
    /// 创建新的轮询器
    pub fn new(
        config: Arc<AppConfig>,
        db: Arc<dyn Database>,
        broadcaster: Arc<WsBroadcaster>,
    ) -> Self {
        let alert_manager = config.napcat_alert.as_ref()
            .filter(|a| a.enable)
            .map(|alert_config| {
                Arc::new(AlertManager::new(alert_config.clone()))
            });
        
        Self {
            config,
            db,
            broadcaster,
            alert_manager,
        }
    }
    
    /// 启动轮询器
    pub async fn start(&self) -> anyhow::Result<()> {
        info!("轮询器启动，间隔: {}秒", self.config.poll_interval);
        
        // 首次立即执行
        self.poll_all_servers().await;
        
        // 定时轮询
        let poll_interval = self.config.poll_interval;
        let poller = self.clone_ref();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(poll_interval));
            loop {
                interval.tick().await;
                poller.poll_all_servers().await;
            }
        });
        
        Ok(())
    }
    
    /// 克隆引用
    fn clone_ref(&self) -> Self {
        Self {
            config: self.config.clone(),
            db: self.db.clone(),
            broadcaster: self.broadcaster.clone(),
            alert_manager: self.alert_manager.clone(),
        }
    }
    
    /// 轮询所有服务器
    pub async fn poll_all_servers(&self) {
        let timestamp = Utc::now();
        debug!("开始轮询所有服务器，时间: {}", timestamp);
        
        let enabled_nodes: Vec<&NodeConfig> = self.config.enabled_nodes();
        
        if enabled_nodes.is_empty() {
            warn!("没有启用任何节点");
            return;
        }
        
        let mut tasks = JoinSet::new();
        
        for node in enabled_nodes {
            let db = self.db.clone();
            let node = node.clone();
            let ts = timestamp;
            
            tasks.spawn(async move {
                Self::poll_single_node(db, &node, ts).await
            });
        }
        
        // 等待所有任务完成
        let mut online_count = 0;
        let mut total_count = 0;
        
        while let Some(result) = tasks.join_next().await {
            if let Ok(online) = result {
                total_count += 1;
                if online {
                    online_count += 1;
                }
            }
        }
        
        // 发送 WebSocket 通知
        self.broadcaster.broadcast_poll_complete(timestamp).await;
        
        // 检查告警
        if let Some(ref alert_manager) = self.alert_manager {
            alert_manager.check_and_alert(
                online_count > 0,
                online_count,
                total_count,
            ).await;
        }
        
        debug!("轮询完成，在线: {}/{}", online_count, total_count);
    }
    
    /// 轮询单个节点
    async fn poll_single_node(
        db: Arc<dyn Database>,
        node: &NodeConfig,
        timestamp: DateTime<Utc>,
    ) -> bool {
        debug!("轮询节点 {} ({}:{})", node.name, node.host, node.port);
        
        // 查询服务器状态
        let status = MinecraftQuerier::query_server(
            &node.host,
            node.port,
            Duration::from_secs(5),
        ).await;
        
        let online = status.online;
        let sample_players_ref = status.sample_players.as_ref();
        let sample_players_json = status.sample_players.as_ref().map(|p| serde_json::to_string(p).unwrap_or_default());
        
        // 构建状态日志条目
        let entry = StatusLogEntry {
            server_id: node.id,
            timestamp,
            online: status.online,
            latency: status.latency,
            players_online: status.players_online.map(|n| n as i32),
            players_max: status.players_max.map(|n| n as i32),
            version: status.version,
            motd: status.motd,
            sample_players: sample_players_json,
            software: status.software,
            plugins: status.plugins.map(|p| serde_json::to_string(&p).unwrap_or_default()),
            map: status.map,
        };
        
        // 记录状态
        if let Err(e) = db.log_status(&entry).await {
            error!("记录状态失败: {}", e);
        }
        
        // 更新玩家会话
        if let Some(players) = sample_players_ref {
            if let Err(e) = db.update_player_sessions(node.id, players, timestamp).await {
                error!("更新玩家会话失败: {}", e);
            }
            
            // 结束离线玩家的会话
            if let Err(e) = db.end_offline_sessions(node.id, players, timestamp).await {
                error!("结束离线会话失败: {}", e);
            }
        } else if online {
            // 服务器在线但没有玩家样本，结束所有会话
            if let Err(e) = db.end_offline_sessions(node.id, &[], timestamp).await {
                error!("结束离线会话失败: {}", e);
            }
        }
        
        online
    }
}

/// 用于克隆的辅助结构
#[derive(Clone)]
pub struct PollerState {
    pub online_count: u32,
    pub total_count: u32,
    pub last_online: bool,
    pub streak: u32,
    pub last_alert_time: Option<DateTime<Utc>>,
}

impl Default for PollerState {
    fn default() -> Self {
        Self {
            online_count: 0,
            total_count: 0,
            last_online: true,
            streak: 0,
            last_alert_time: None,
        }
    }
}
