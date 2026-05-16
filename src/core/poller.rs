//! 轮询器模块

use chrono::{DateTime, Utc};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio::task::JoinSet;
use tracing::{debug, error, info, warn};

use crate::alert::AlertManager;
use crate::config::{AppConfig, ExtraDataSourceConfig, ExtraDataSourceType, NodeConfig};
use crate::core::monitor::MinecraftQuerier;
use crate::db::Database;
use crate::models::{StatusLogEntry, UnifiedMetricsEntry};
use crate::utils::time::now_gmt8;
use crate::ws::WsBroadcaster;

/// 服务器轮询器
pub struct ServerPoller {
    config: Arc<AppConfig>,
    db: Arc<dyn Database>,
    broadcaster: Arc<WsBroadcaster>,
    alert_manager: Option<Arc<AlertManager>>,
    shutdown_rx: watch::Receiver<bool>,
}

impl ServerPoller {
    /// 创建新的轮询器
    pub fn new(
        config: Arc<AppConfig>,
        db: Arc<dyn Database>,
        broadcaster: Arc<WsBroadcaster>,
        shutdown_rx: watch::Receiver<bool>,
    ) -> Self {
        let alert_manager = config
            .napcat_alert
            .as_ref()
            .filter(|a| a.enable)
            .map(|alert_config| Arc::new(AlertManager::new(alert_config.clone())));

        Self {
            config,
            db,
            broadcaster,
            alert_manager,
            shutdown_rx,
        }
    }

    /// 启动轮询器
    pub async fn start(&self) -> anyhow::Result<()> {
        info!("轮询器启动，间隔: {}秒", self.config.poll_interval);

        // 首次立即执行
        self.poll_all_servers().await;

        // 定时轮询（支持优雅关闭）
        let poll_interval = self.config.poll_interval;
        let mut poller = self.clone_ref();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(poll_interval));
            interval.tick().await;
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        poller.poll_all_servers().await;
                    }
                    result = poller.shutdown_rx.changed() => {
                        if result.is_ok() || result.is_err() {
                            info!("轮询器收到关闭信号，停止轮询");
                            break;
                        }
                    }
                }
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
            shutdown_rx: self.shutdown_rx.clone(),
        }
    }

    /// 轮询所有节点
    pub async fn poll_all_servers(&self) {
        let timestamp = now_gmt8();
        debug!("开始轮询所有节点，时间: {}", timestamp);

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

            tasks.spawn(async move { Self::poll_single_node(db, &node, ts).await });
        }

        let mut online_count = 0;
        let mut total_count = 0;
        let mut observations: Vec<(i32, bool, Option<Vec<String>>)> = Vec::new();

        while let Some(result) = tasks.join_next().await {
            if let Ok((server_id, online, players)) = result {
                total_count += 1;
                if online {
                    online_count += 1;
                }
                observations.push((server_id, online, players));
            }
        }

        if let Err(e) = self
            .db
            .update_player_sessions_aggregate(&observations, timestamp)
            .await
        {
            error!("更新玩家会话失败: {}", e);
        }

        self.poll_extra_data_sources(timestamp).await;

        // 发送 WebSocket 通知
        self.broadcaster.broadcast_poll_complete(timestamp).await;

        // 检查告警
        if let Some(ref alert_manager) = self.alert_manager {
            alert_manager
                .check_and_alert(online_count > 0, online_count, total_count)
                .await;
        }

        debug!("轮询完成，在线: {}/{}", online_count, total_count);
    }

    /// 轮询单个节点
    async fn poll_single_node(
        db: Arc<dyn Database>,
        node: &NodeConfig,
        timestamp: DateTime<Utc>,
    ) -> (i32, bool, Option<Vec<String>>) {
        debug!(
            "轮询节点 {} ({}:{}) [{}]",
            node.name, node.host, node.port, node.edition
        );

        // 查询服务器状态
        let status = MinecraftQuerier::query_server(
            &node.host,
            node.port,
            Duration::from_secs(5),
            &node.edition,
        )
        .await;

        let online = status.online;
        let players = status.sample_players.clone();
        let sample_players_json = status
            .sample_players
            .as_ref()
            .map(|p| serde_json::to_string(p).unwrap_or_default());
        let edition_str = status.edition.as_ref().map(|e| e.to_string());

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
            plugins: status
                .plugins
                .map(|p| serde_json::to_string(&p).unwrap_or_default()),
            map: status.map,
            edition: edition_str,
        };

        // 记录状态
        if let Err(e) = db.log_status(&entry).await {
            error!("记录状态失败: {}", e);
        }

        (node.id, online, players)
    }

    async fn poll_extra_data_sources(&self, timestamp: DateTime<Utc>) {
        for source in &self.config.extra_data_sources {
            if !source.enabled {
                continue;
            }

            match source.source_type {
                ExtraDataSourceType::UnifiedMetrics => {
                    if let Err(e) = self.poll_unified_metrics_source(source, timestamp).await {
                        warn!("抓取 Unified Metrics 数据源 '{}' 失败: {}", source.name, e);
                    }
                }
            }
        }
    }

    async fn poll_unified_metrics_source(
        &self,
        source: &ExtraDataSourceConfig,
        timestamp: DateTime<Utc>,
    ) -> anyhow::Result<()> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(source.timeout_seconds.max(1)))
            .build()?;

        let body = client
            .get(&source.prometheus_url)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;

        let mut entry = parse_unified_metrics_prometheus(&body);
        entry.source_name = source.name.clone();
        entry.timestamp = timestamp;

        self.db.log_unified_metrics(&entry).await?;
        Ok(())
    }
}

fn parse_unified_metrics_prometheus(text: &str) -> UnifiedMetricsEntry {
    let mut values: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    let mut jvm_used_sum = 0.0_f64;
    let mut jvm_used_count = 0_u32;
    let mut jvm_max_sum = 0.0_f64;
    let mut jvm_max_count = 0_u32;

    for raw_line in text.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let mut parts = line.split_whitespace();
        let metric_full = match parts.next() {
            Some(v) => v,
            None => continue,
        };
        let value_raw = match parts.next() {
            Some(v) => v,
            None => continue,
        };
        let value = match value_raw.parse::<f64>() {
            Ok(v) if v.is_finite() => v,
            _ => continue,
        };

        let metric_name = metric_full
            .split('{')
            .next()
            .unwrap_or(metric_full)
            .to_lowercase();
        values.insert(metric_name.clone(), value);

        if metric_name == "jvm_memory_used_bytes" {
            jvm_used_sum += value;
            jvm_used_count += 1;
        }
        if metric_name == "jvm_memory_max_bytes" && value >= 0.0 {
            jvm_max_sum += value;
            jvm_max_count += 1;
        }
    }

    let tps = pick_metric(
        &values,
        &[
            "unifiedmetrics_tps",
            "unified_metrics_tps",
            "minecraft_tps",
            "server_tps",
            "tps",
        ],
    );
    let mspt = pick_metric(
        &values,
        &[
            "unifiedmetrics_mspt",
            "unified_metrics_mspt",
            "minecraft_mspt",
            "server_mspt",
            "mspt",
        ],
    );
    let uptime_seconds = pick_metric(
        &values,
        &[
            "unifiedmetrics_uptime_seconds",
            "unified_metrics_uptime_seconds",
            "minecraft_uptime_seconds",
            "process_uptime_seconds",
            "uptime_seconds",
            "uptime",
        ],
    );
    let cpu_load = pick_metric(
        &values,
        &[
            "unifiedmetrics_cpu_load",
            "unified_metrics_cpu_load",
            "minecraft_cpu_load",
            "system_cpu_load",
            "process_cpu_load",
            "cpu_load",
        ],
    );

    let memory_used_bytes = pick_metric(
        &values,
        &[
            "unifiedmetrics_memory_used_bytes",
            "unified_metrics_memory_used_bytes",
            "minecraft_memory_used_bytes",
            "memory_used_bytes",
        ],
    )
    .or_else(|| {
        if jvm_used_count > 0 {
            Some(jvm_used_sum)
        } else {
            None
        }
    });

    let memory_total_bytes = pick_metric(
        &values,
        &[
            "unifiedmetrics_memory_total_bytes",
            "unified_metrics_memory_total_bytes",
            "minecraft_memory_total_bytes",
            "memory_total_bytes",
        ],
    )
    .or_else(|| {
        if jvm_max_count > 0 {
            Some(jvm_max_sum)
        } else {
            None
        }
    });

    let memory_free_bytes = pick_metric(
        &values,
        &[
            "unifiedmetrics_memory_free_bytes",
            "unified_metrics_memory_free_bytes",
            "minecraft_memory_free_bytes",
            "memory_free_bytes",
        ],
    )
    .or_else(|| match (memory_total_bytes, memory_used_bytes) {
        (Some(total), Some(used)) => Some((total - used).max(0.0)),
        _ => None,
    });

    UnifiedMetricsEntry {
        source_name: String::new(),
        timestamp: now_gmt8(),
        tps,
        mspt,
        uptime_seconds,
        cpu_load,
        memory_used_bytes,
        memory_total_bytes,
        memory_free_bytes,
    }
}

fn pick_metric(values: &std::collections::HashMap<String, f64>, aliases: &[&str]) -> Option<f64> {
    aliases.iter().find_map(|name| values.get(*name).copied())
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
