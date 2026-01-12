use crate::models::status::ServerStatus;
use async_minecraft_ping::ConnectionConfig;
use std::time::Duration;

/// Minecraft服务器监控器
pub struct MinecraftMonitor;

impl MinecraftMonitor {
    pub fn new() -> Self {
        Self
    }

    /// 查询Minecraft服务器状态
    pub async fn query_server(
        &self,
        host: &str,
        port: u16,
        timeout: Duration,
    ) -> ServerStatus {
        let mut result = ServerStatus::default();

        // 构建连接配置
        let config = ConnectionConfig::build(host.to_string())
            .with_port(port)
            .with_timeout(timeout);

        // 执行ping
        let start = std::time::Instant::now();
        match config.connect().await {
            Ok(connection) => {
                match connection.status().await {
                    Ok(ping_conn) => {
                        let latency = start.elapsed();
                        let status = ping_conn.status;
                        
                        result.online = true;
                        result.latency = Some(latency.as_millis() as f64);

                        // 提取玩家信息
                        result.players_online = Some(status.players.online as i32);
                        result.players_max = Some(status.players.max as i32);

                        // 提取玩家样本
                        if let Some(sample) = status.players.sample {
                            result.sample_players = Some(
                                sample.iter().map(|p| p.name.clone()).collect::<Vec<_>>()
                            );
                        }

                        // 提取版本信息
                        result.version = Some(status.version.name);

                        // 提取MOTD
                        result.motd = Some(Self::format_description(&status.description));

                        // 注意: async-minecraft-ping不支持query协议，所以无法获取software, plugins, map等信息
                        // 这些字段将保持为None，与Python版本的行为一致（当服务器不支持query时）
                    }
                    Err(e) => {
                        result.error = Some(format!("获取状态失败: {}", e));
                    }
                }
            }
            Err(e) => {
                result.error = Some(format!("连接失败: {}", e));
            }
        }

        result
    }

    /// 格式化ServerDescription为字符串
    fn format_description(desc: &async_minecraft_ping::ServerDescription) -> String {
        match desc {
            async_minecraft_ping::ServerDescription::Plain(s) => s.clone(),
            async_minecraft_ping::ServerDescription::Object { text } => text.clone(),
        }
    }

    /// 格式化状态信息
    pub fn format_status(&self, status: &ServerStatus) -> String {
        if !status.online {
            return format!(
                "离线 - {}",
                status.error.as_deref().unwrap_or("未知错误")
            );
        }

        format!(
            "在线 | 延迟: {:.2}ms | 玩家: {}/{} | 版本: {}",
            status.latency.unwrap_or(0.0),
            status.players_online.unwrap_or(0),
            status.players_max.unwrap_or(0),
            status.version.as_deref().unwrap_or("未知")
        )
    }
}
