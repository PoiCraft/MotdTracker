use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 服务器状态记录
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StatusLog {
    pub id: i32,
    pub server_id: i32,
    pub timestamp: DateTime<Utc>,
    pub online: bool,
    pub latency: Option<f64>,
    pub players_online: Option<i32>,
    pub players_max: Option<i32>,
    pub version: Option<String>,
    pub motd: Option<String>,
    pub sample_players: Option<String>, // JSON格式
    pub software: Option<String>,
    pub plugins: Option<String>, // JSON格式
    pub map_name: Option<String>,
}

/// Minecraft服务器查询结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub online: bool,
    pub latency: Option<f64>,
    pub players_online: Option<i32>,
    pub players_max: Option<i32>,
    pub version: Option<String>,
    pub motd: Option<String>,
    pub sample_players: Option<Vec<String>>,
    pub software: Option<String>,
    pub plugins: Option<Vec<String>>,
    pub map: Option<String>,
    pub error: Option<String>,
}

impl Default for ServerStatus {
    fn default() -> Self {
        Self {
            online: false,
            latency: None,
            players_online: None,
            players_max: None,
            version: None,
            motd: None,
            sample_players: None,
            software: None,
            plugins: None,
            map: None,
            error: None,
        }
    }
}
