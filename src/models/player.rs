//! 玩家模型

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 玩家会话
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlayerSession {
    /// 记录 ID
    pub id: i64,

    /// 节点 ID
    pub server_id: i32,

    /// 玩家名称
    pub player_name: String,

    /// 首次出现时间
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub first_seen: DateTime<Utc>,

    /// 当前会话开始时间
    #[serde(with = "crate::utils::time::serde_gmt8_opt")]
    pub session_start: Option<DateTime<Utc>>,

    /// 最后在线时间
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub last_seen: DateTime<Utc>,

    /// 是否在线
    #[serde(default)]
    pub online: bool,

    /// 会话时长（秒）
    pub duration_seconds: Option<i64>,
}

/// 玩家历史会话
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlayerSessionHistory {
    /// 记录 ID
    pub id: i64,

    /// 节点 ID
    pub server_id: i32,

    /// 玩家名称
    pub player_name: String,

    /// 会话开始时间
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub session_start: DateTime<Utc>,

    /// 会话结束时间
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub session_end: DateTime<Utc>,
}

/// 玩家详情
#[derive(Debug, Clone, Serialize)]
pub struct PlayerDetail {
    /// 玩家名称
    pub player_name: String,

    /// 是否在线
    pub online: bool,

    /// 会话开始时间
    #[serde(with = "crate::utils::time::serde_gmt8_opt")]
    pub session_start: Option<DateTime<Utc>>,

    /// 最后在线时间
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub last_seen: DateTime<Utc>,

    /// 会话时长（秒）
    pub duration_seconds: Option<i64>,

    /// 所在节点列表
    pub servers: Vec<PlayerServerEntry>,

    /// 会话历史
    pub sessions: Vec<PlayerSessionHistory>,
}

/// 玩家节点条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerServerEntry {
    /// 节点 ID
    pub server_id: i32,

    /// 节点名称
    pub server_name: String,

    /// 是否在线
    pub online: bool,

    /// 首次出现时间
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub first_seen: DateTime<Utc>,

    /// 最后在线时间
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub last_seen: DateTime<Utc>,
}

/// 玩家热力图数据
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PlayerHeatmap {
    /// 小时 (0-23)
    pub hour: i32,

    /// 星期 (0-6, 0=周一)
    pub weekday: i32,

    /// 次数
    pub count: i32,
}

/// 玩家列表项（聚合）
#[derive(Debug, Clone, Serialize)]
pub struct PlayerListItem {
    /// 玩家名称
    pub player_name: String,

    /// 是否在线
    pub online: bool,

    /// 会话开始时间
    #[serde(with = "crate::utils::time::serde_gmt8_opt")]
    pub session_start: Option<DateTime<Utc>>,

    /// 最后在线时间
    #[serde(with = "crate::utils::time::serde_gmt8_opt")]
    pub last_seen: Option<DateTime<Utc>>,

    /// 会话时长（秒）
    pub duration_seconds: Option<i64>,

    /// 所在节点
    pub servers: Vec<PlayerServerEntry>,
}
