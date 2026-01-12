use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 玩家会话信息
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PlayerSession {
    pub id: i32,
    pub server_id: i32,
    pub player_name: String,
    pub session_start: DateTime<Utc>,
    pub session_end: Option<DateTime<Utc>>,
    pub is_online: bool,
}

/// 在线玩家信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnlinePlayer {
    pub player_name: String,
    pub session_start: DateTime<Utc>,
    pub duration_seconds: i64,
}
