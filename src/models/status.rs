//! 状态日志模型

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StatusLog {
    pub id: i64,
    pub node_id: String,
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub timestamp: DateTime<Utc>,
    pub online: bool,
    pub latency: Option<f64>,
    pub players_online: Option<i32>,
    pub players_max: Option<i32>,
    pub version: Option<String>,
    pub motd: Option<String>,
    pub sample_players: Option<String>,
    pub software: Option<String>,
    pub plugins: Option<String>,
    pub map: Option<String>,
    pub edition: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusLogEntry {
    pub node_id: String,
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub timestamp: DateTime<Utc>,
    pub online: bool,
    pub latency: Option<f64>,
    pub players_online: Option<i32>,
    pub players_max: Option<i32>,
    pub version: Option<String>,
    pub motd: Option<String>,
    pub sample_players: Option<String>,
    pub software: Option<String>,
    pub plugins: Option<String>,
    pub map: Option<String>,
    pub edition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ServerStatus {
    #[serde(default)]
    pub online: bool,
    pub latency: Option<f64>,
    pub players_online: Option<u32>,
    pub players_max: Option<u32>,
    pub version: Option<String>,
    pub motd: Option<String>,
    pub sample_players: Option<Vec<String>>,
    pub software: Option<String>,
    pub plugins: Option<Vec<String>>,
    pub map: Option<String>,
    pub edition: Option<crate::config::ServerEdition>,
    pub error: Option<String>,
}
