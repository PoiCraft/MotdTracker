//! 节点模型

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 服务器节点
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Server {
    /// 节点 ID
    pub id: i32,

    /// 节点名称
    pub name: String,

    /// 节点地址
    pub host: String,

    /// 节点端口
    pub port: i32,

    /// 图表颜色
    pub color: Option<String>,

    /// 服务器版本类型（java / bedrock）
    pub edition: Option<String>,
}

/// 服务器节点带状态信息
#[derive(Debug, Clone, Serialize)]
pub struct NodeWithStats {
    /// 基本信息
    #[serde(flatten)]
    pub server: Server,

    /// 是否启用
    pub enabled: bool,

    /// 最新状态
    pub latest_status: Option<NodeStatus>,

    /// 延迟统计
    pub latency_stats: Option<LatencyStats>,
}

/// 节点状态（最新状态）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeStatus {
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
}

/// 延迟统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatencyStats {
    /// 在线率（百分比）
    pub uptime_percentage: f64,

    /// 平均延迟
    pub avg_latency: Option<f64>,

    /// 标准差
    pub std_dev: Option<f64>,

    /// 最小延迟
    pub min_latency: Option<f64>,

    /// 最大延迟
    pub max_latency: Option<f64>,

    /// P95 延迟
    pub p95_latency: Option<f64>,

    /// 变异系数
    pub cv: Option<f64>,

    /// 总检查次数
    pub total_checks: u32,

    /// 在线检查次数
    pub online_checks: u32,
}

impl Default for LatencyStats {
    fn default() -> Self {
        Self {
            uptime_percentage: 0.0,
            avg_latency: None,
            std_dev: None,
            min_latency: None,
            max_latency: None,
            p95_latency: None,
            cv: None,
            total_checks: 0,
            online_checks: 0,
        }
    }
}

/// 服务器聚合状态（头部信息）
#[derive(Debug, Clone, Serialize)]
pub struct ServerHead {
    /// 总节点数
    pub total_nodes: u32,

    /// 在线节点数
    pub online_nodes: u32,

    /// 总在线玩家数
    pub total_players_online: u32,

    /// 总最大玩家数
    pub total_players_max: u32,

    /// 是否全部在线
    pub all_online: bool,

    /// 最小延迟
    pub min_latency: Option<f64>,

    /// 最大延迟
    pub max_latency: Option<f64>,

    /// 平均延迟
    pub avg_latency: Option<f64>,
}

/// 在线率信息
#[derive(Debug, Clone, Serialize)]
pub struct UptimeInfo {
    /// 节点 ID 到在线率的映射
    pub by_node: std::collections::HashMap<i32, f64>,

    /// 总体在线率
    pub overall: f64,
}
