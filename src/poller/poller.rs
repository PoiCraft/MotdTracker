use crate::db::Database;
use crate::models::config::AppConfig;
use crate::monitor::MinecraftMonitor;
use crate::utils::time::utc8_now;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::interval;

/// 服务器轮询器
pub struct ServerPoller {
    config: AppConfig,
    db: Database,
    monitor: MinecraftMonitor,
    server_ids: HashMap<String, i32>,
    previous_status: Arc<RwLock<HashMap<i32, bool>>>,
    current_status: Arc<RwLock<HashMap<i32, bool>>>,
}

impl ServerPoller {
    /// 创建新的轮询器
    pub async fn new(config: AppConfig, db: Database) -> anyhow::Result<Self> {
        let monitor = MinecraftMonitor::new();
        let mut server_ids = HashMap::new();

        // 注册节点
        for node in &config.nodes {
            let name = &node.name;
            let host = &node.host;
            let port = node.port as i32;
            let color = node.color.as_deref();
            let node_id = node.id;

            let server_id = db.add_server(name, host, port, color, node_id).await?;
            let key = format!("{}:{}", host, port);
            server_ids.insert(key, server_id);

            tracing::info!("已注册节点 {} ({}:{}) - ID: {}", name, host, port, server_id);
        }

        Ok(Self {
            config,
            db,
            monitor,
            server_ids,
            previous_status: Arc::new(RwLock::new(HashMap::new())),
            current_status: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// 获取24小时记录数限制
    pub fn get_24h_limit(&self) -> i64 {
        (86400 / self.config.poll_interval) as i64
    }

    /// 轮询单个服务器
    async fn poll_server(&self, node: &crate::models::config::NodeConfig, timestamp: chrono::DateTime<chrono::Utc>) -> anyhow::Result<()> {
        let name = &node.name;
        let host = &node.host;
        let port = node.port;

        // 获取服务器ID
        let key = format!("{}:{}", host, port);
        let server_id = match self.server_ids.get(&key) {
            Some(&id) => id,
            None => {
                tracing::error!("未找到节点ID: {}", name);
                return Ok(());
            }
        };

        tracing::info!("正在查询节点 {} ({}:{})", name, host, port);

        // 查询服务器状态
        let timeout = Duration::from_secs(5);
        let status = self.monitor.query_server(host, port, timeout).await;

        // 记录到数据库
        let sample_players = status.sample_players.as_deref();
        let plugins = status.plugins.as_deref();
        
        self.db.log_status(
            server_id,
            status.online,
            status.latency,
            status.players_online,
            status.players_max,
            status.version.as_deref(),
            status.motd.as_deref(),
            sample_players,
            status.software.as_deref(),
            plugins,
            status.map.as_deref(),
            timestamp,
        ).await?;

        // 更新在线状态缓存
        {
            let mut prev = self.previous_status.write().await;
            let curr = self.current_status.read().await;
            prev.insert(server_id, curr.get(&server_id).copied().unwrap_or(true));
        }
        {
            let mut curr = self.current_status.write().await;
            curr.insert(server_id, status.online);
        }

        // 更新玩家会话
        let sample_players_for_session = if status.online {
            status.sample_players.as_deref()
        } else {
            None
        };
        self.db.update_player_sessions(server_id, sample_players_for_session, timestamp).await?;

        // 输出状态
        let status_str = self.monitor.format_status(&status);
        tracing::info!("{}: {}", name, status_str);

        Ok(())
    }

    /// 轮询所有服务器
    pub async fn poll_all_servers(&self) -> anyhow::Result<()> {
        tracing::info!("============================================================");
        tracing::info!("开始轮询所有节点");

        let round_timestamp = utc8_now();

        // 并发查询所有节点
        let mut tasks = Vec::new();
        for node in &self.config.nodes {
            let node = node.clone();
            let poller = self.clone_for_task();
            let timestamp = round_timestamp;
            
            tasks.push(tokio::spawn(async move {
                if let Err(e) = poller.poll_server(&node, timestamp).await {
                    tracing::error!("轮询节点 {} 时出错: {}", node.name, e);
                }
            }));
        }

        // 等待所有任务完成
        for task in tasks {
            let _ = task.await;
        }

        // TODO: 发送WebSocket通知
        // if let Some(socketio) = &self.socketio {
        //     socketio.emit("poll_complete", {"timestamp": round_timestamp.to_rfc3339()});
        // }

        // TODO: 检查告警
        // self.check_alerts().await?;

        tracing::info!("本轮轮询完成");
        tracing::info!("============================================================");

        Ok(())
    }

    /// 克隆用于任务的引用
    fn clone_for_task(&self) -> Self {
        Self {
            config: self.config.clone(),
            db: self.db.clone(),
            monitor: MinecraftMonitor::new(),
            server_ids: self.server_ids.clone(),
            previous_status: self.previous_status.clone(),
            current_status: self.current_status.clone(),
        }
    }

    /// 启动定时轮询
    pub async fn start(&mut self) -> anyhow::Result<()> {
        let poll_interval = self.config.poll_interval;
        
        tracing::info!("定时轮询已启动，间隔: {}秒", poll_interval);

        // 使用tokio interval进行定时轮询
        let poller = self.clone_for_task();
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(poll_interval));
            loop {
                interval.tick().await;
                if let Err(e) = poller.poll_all_servers().await {
                    tracing::error!("轮询过程出错: {}", e);
                }
            }
        });

        // 立即执行首次轮询
        let poller = self.clone_for_task();
        tokio::spawn(async move {
            if let Err(e) = poller.poll_all_servers().await {
                tracing::error!("首次轮询出错: {}", e);
            }
        });

        Ok(())
    }
}
