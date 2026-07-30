//! 服务器组、服务器、节点模型 (UUID)

use crate::utils::time::{Gmt8Naive, Gmt8Time};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 服务器组
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ServerGroup {
    pub id: String,
    pub name: String,
    pub sort_order: i32,
    pub created_at: Gmt8Naive,
    pub updated_at: Gmt8Naive,
}

/// MC 服务器实例
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ServerEntity {
    pub id: String,
    pub group_id: Option<String>,
    pub name: String,
    pub sort_order: i32,
    pub created_at: Gmt8Naive,
    pub updated_at: Gmt8Naive,
}

/// 添加节点参数
#[derive(Debug, Clone)]
pub struct AddNodeParams<'a> {
    pub name: &'a str,
    pub host: &'a str,
    pub port: u16,
    pub edition: &'a str,
    pub color: Option<&'a str>,
    pub enabled: bool,
    pub server_id: &'a str,
    pub sort_order: i32,
}

/// 更新节点参数
#[derive(Debug, Clone)]
pub struct UpdateNodeParams<'a> {
    pub name: &'a str,
    pub host: &'a str,
    pub port: u16,
    pub edition: &'a str,
    pub color: Option<&'a str>,
    pub enabled: bool,
    pub server_id: &'a str,
    pub sort_order: i32,
}

/// 连接节点
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Node {
    pub id: String,
    pub server_id: String,
    pub name: String,
    pub host: String,
    pub port: i32,
    pub edition: String,
    pub color: Option<String>,
    pub enabled: bool,
    pub sort_order: i32,
    pub created_at: Gmt8Naive,
    pub updated_at: Gmt8Naive,
}

/// 节点带状态
#[derive(Debug, Clone, Serialize)]
pub struct NodeWithStats {
    #[serde(flatten)]
    pub node: Node,
    pub latest_status: Option<NodeStatus>,
    pub latency_stats: Option<LatencyStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeStatus {
    #[serde(with = "crate::utils::time::serde_gmt8")]
    pub timestamp: Gmt8Time,
    pub online: bool,
    pub latency: Option<f64>,
    pub players_online: Option<i32>,
    pub players_max: Option<i32>,
    pub version: Option<String>,
    pub motd: Option<String>,
}

impl From<&crate::models::StatusLog> for NodeStatus {
    fn from(s: &crate::models::StatusLog) -> Self {
        NodeStatus {
            timestamp: *s.timestamp,
            online: s.online,
            latency: s.latency,
            players_online: s.players_online,
            players_max: s.players_max,
            version: s.version.clone(),
            motd: s.motd.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatencyStats {
    pub uptime_percentage: f64,
    pub avg_latency: Option<f64>,
    pub std_dev: Option<f64>,
    pub min_latency: Option<f64>,
    pub max_latency: Option<f64>,
    pub p95_latency: Option<f64>,
    pub cv: Option<f64>,
    pub total_checks: u32,
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

#[derive(Debug, Clone, Serialize)]
pub struct ServerHead {
    pub total_nodes: u32,
    pub online_nodes: u32,
    pub total_players_online: u32,
    pub total_players_max: u32,
    pub all_online: bool,
    pub min_latency: Option<f64>,
    pub max_latency: Option<f64>,
    pub avg_latency: Option<f64>,
}

/// 聚合状态（用于 Server 和 Group 级别）
#[derive(Debug, Clone, Serialize)]
pub struct AggregateStatus {
    pub online: bool,
    pub online_node_count: u32,
    pub total_node_count: u32,
    pub total_players_online: u32,
    pub total_players_max: u32,
    pub avg_latency: Option<f64>,
}

/// 服务器组 + 统计
#[derive(Debug, Clone, Serialize)]
pub struct GroupWithStats {
    #[serde(flatten)]
    pub group: ServerGroup,
    pub server_count: u32,
    pub online_node_count: u32,
    pub total_node_count: u32,
    pub total_players_online: u32,
}

/// 服务器 + 详情（含节点列表 + 聚合状态）
#[derive(Debug, Clone, Serialize)]
pub struct ServerWithDetails {
    #[serde(flatten)]
    pub server: ServerEntity,
    pub nodes: Vec<NodeWithStats>,
    pub aggregate: AggregateStatus,
}

/// 服务器聚合历史
#[derive(Debug, Clone, Serialize)]
pub struct AggregateHistory {
    pub server_id: String,
    pub status_logs: Vec<crate::models::StatusLog>,
}
