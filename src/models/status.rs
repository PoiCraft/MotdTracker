//! 状态日志模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use sqlx::FromRow;

use crate::config::ServerEdition;

/// 状态日志记录
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StatusLog {
    /// 记录 ID
    pub id: i64,
    
    /// 节点 ID
    pub server_id: i32,
    
    /// 时间戳
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub timestamp: DateTime<Utc>,
    
    /// 是否在线
    pub online: bool,
    
    /// 延迟（毫秒）
    pub latency: Option<f64>,
    
    /// 在线玩家数
    pub players_online: Option<i32>,
    
    /// 最大玩家数
    pub players_max: Option<i32>,
    
    /// 服务器版本
    pub version: Option<String>,
    
    /// MOTD
    pub motd: Option<String>,
    
    /// 玩家样本（JSON）
    pub sample_players: Option<String>,
    
    /// 服务端软件
    pub software: Option<String>,
    
    /// 插件列表（JSON）
    pub plugins: Option<String>,
    
    /// 地图名称
    pub map: Option<String>,
    
    /// 服务器版本类型
    pub edition: Option<String>,
}

/// 状态日志条目（用于插入）
#[derive(Debug, Clone, Serialize)]
pub struct StatusLogEntry {
    /// 节点 ID
    pub server_id: i32,
    
    /// 时间戳
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub timestamp: DateTime<Utc>,
    
    /// 是否在线
    pub online: bool,
    
    /// 延迟（毫秒）
    pub latency: Option<f64>,
    
    /// 在线玩家数
    pub players_online: Option<i32>,
    
    /// 最大玩家数
    pub players_max: Option<i32>,
    
    /// 服务器版本
    pub version: Option<String>,
    
    /// MOTD
    pub motd: Option<String>,
    
    /// 玩家样本（JSON 字符串）
    pub sample_players: Option<String>,
    
    /// 服务端软件
    pub software: Option<String>,
    
    /// 插件列表（JSON 字符串）
    pub plugins: Option<String>,
    
    /// 地图名称
    pub map: Option<String>,
    
    /// 服务器版本类型
    pub edition: Option<String>,
}

/// 服务器状态（查询结果）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ServerStatus {
    /// 是否在线
    #[serde(default)]
    pub online: bool,
    
    /// 延迟（毫秒）
    pub latency: Option<f64>,
    
    /// 在线玩家数
    pub players_online: Option<u32>,
    
    /// 最大玩家数
    pub players_max: Option<u32>,
    
    /// 服务器版本
    pub version: Option<String>,
    
    /// MOTD
    pub motd: Option<String>,
    
    /// 玩家样本列表
    pub sample_players: Option<Vec<String>>,
    
    /// 服务端软件
    pub software: Option<String>,
    
    /// 插件列表
    pub plugins: Option<Vec<String>>,
    
    /// 地图名称
    pub map: Option<String>,
    
    /// 错误信息
    pub error: Option<String>,
    
    /// 服务器版本类型
    pub edition: Option<ServerEdition>,
}

/// 历史记录项（精简）
#[derive(Debug, Clone, Serialize)]
pub struct HistoryRecord {
    /// 时间戳
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub timestamp: DateTime<Utc>,
    
    /// 在线节点 ID 列表
    pub online_nodes: Vec<i32>,
    
    /// 延迟映射（节点 ID -> 延迟）
    pub latencies: std::collections::HashMap<i32, Option<f64>>,
    
    /// 玩家数映射（节点 ID -> 在线玩家数）
    pub players_online: std::collections::HashMap<i32, Option<i32>>,
    
    /// 总在线玩家数
    pub total_players: u32,
}

/// 状态时间线项
#[derive(Debug, Clone, Serialize)]
pub struct StatusTimelineItem {
    /// 时间戳
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub timestamp: DateTime<Utc>,
    
    /// 在线状态映射（节点 ID -> 是否在线）
    pub status: std::collections::HashMap<i32, bool>,
}

/// 类 SQL 查询结果
#[derive(Debug, Clone, Serialize)]
pub struct QueryResult {
    /// 列名
    pub columns: Vec<String>,
    
    /// 数据行
    pub rows: Vec<Vec<serde_json::Value>>,
    
    /// 总行数
    pub total: usize,
}
