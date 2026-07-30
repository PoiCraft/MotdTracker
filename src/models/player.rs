//! 玩家模型

use crate::utils::time::{Gmt8Naive, Gmt8Time};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 玩家会话（每节点独立记录）
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlayerSession {
    pub id: i64,
    pub node_id: String,
    pub player_name: String,
    pub first_seen: Gmt8Naive,
    pub session_start: Option<Gmt8Naive>,
    pub last_seen: Gmt8Naive,
    #[serde(default)]
    pub online: bool,
    pub duration_seconds: Option<i64>,
}

/// 玩家历史会话（按 server 聚合）
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlayerSessionHistory {
    pub id: i64,
    pub server_id: String,
    pub player_name: String,
    pub session_start: Gmt8Naive,
    pub session_end: Gmt8Naive,
}

/// 玩家详情
#[derive(Debug, Clone, Serialize)]
pub struct PlayerDetail {
    pub player_name: String,
    pub online: bool,
    #[serde(with = "crate::utils::time::serde_gmt8_opt")]
    pub session_start: Option<Gmt8Time>,
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub last_seen: Gmt8Time,
    pub duration_seconds: Option<i64>,
    pub servers: Vec<PlayerServerEntry>,
    pub sessions: Vec<PlayerSessionHistory>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerServerEntry {
    pub node_id: String,
    pub node_name: String,
    pub server_id: String,
    pub server_name: String,
    pub online: bool,
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub first_seen: Gmt8Time,
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub last_seen: Gmt8Time,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PlayerHeatmap {
    pub hour: i32,
    pub weekday: i32,
    pub count: i32,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlayerListItem {
    pub player_name: String,
    pub online: bool,
    #[serde(with = "crate::utils::time::serde_gmt8_opt")]
    pub session_start: Option<Gmt8Time>,
    #[serde(with = "crate::utils::time::serde_gmt8_opt")]
    pub last_seen: Option<Gmt8Time>,
    pub duration_seconds: Option<i64>,
    pub servers: Vec<PlayerServerEntry>,
}

/// 玩家周统计
#[derive(Debug, Clone, Serialize)]
pub struct PlayerWeeklyStats {
    pub player_name: String,
    pub daily_stats: Vec<DailyStats>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailyStats {
    pub date: String,
    pub total_minutes: i64,
}
