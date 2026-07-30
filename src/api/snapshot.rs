//! 仪表盘快照模块
//!
//! 一次加载、完全 join、预聚合的「服务器组 → 服务器 → 节点」数据。
//! 所有需要聚合视图的 handler（JSON / SVG / Prometheus）都是快照之上的
//! 格式适配器，不再各自重复「取 latest status → 建查找映射 → 算聚合」。
//!
//! 设计决策（2026-07-30 架构评审）：
//! - 独立模块，置于 Database trait 之上（trait 只管持久化）
//! - 单入口 [`DashboardSnapshot::load`]，`history_hours` 为 `Some` 时附带逐节点统计
//! - 任何一步失败返回 `Err`，由 handler 映射为 500（不再静默空数据）

use std::collections::HashMap;
use std::sync::Arc;

use serde::Serialize;

use crate::db::{Database, DbError};
use crate::models::*;
use crate::utils::calculate_latency_stats;

/// 从节点列表和最新状态映射计算聚合指标（服务器/组级别共用）
pub fn aggregate_latest(
    nodes: &[&Node],
    latest_map: &HashMap<&str, &StatusLog>,
) -> AggregateStatus {
    let online_count = nodes
        .iter()
        .filter(|n| {
            latest_map
                .get(n.id.as_str())
                .map(|s| s.online)
                .unwrap_or(false)
        })
        .count() as u32;
    let total_players: u32 = nodes
        .iter()
        .filter_map(|n| {
            latest_map
                .get(n.id.as_str())
                .and_then(|s| s.players_online.map(|p| p as u32))
        })
        .sum();
    let total_players_max: u32 = nodes
        .iter()
        .filter_map(|n| {
            latest_map
                .get(n.id.as_str())
                .and_then(|s| s.players_max.map(|p| p as u32))
        })
        .sum();
    let lats: Vec<f64> = nodes
        .iter()
        .filter_map(|n| latest_map.get(n.id.as_str()).and_then(|s| s.latency))
        .collect();

    AggregateStatus {
        online: online_count > 0,
        online_node_count: online_count,
        total_node_count: nodes.len() as u32,
        total_players_online: total_players,
        total_players_max,
        avg_latency: if !lats.is_empty() {
            Some(lats.iter().sum::<f64>() / lats.len() as f64)
        } else {
            None
        },
    }
}

/// 节点 + 最新状态 + 可选的逐节点统计
#[derive(Debug, Clone, Serialize)]
pub struct SnapshotNode {
    #[serde(flatten)]
    pub node: Node,
    pub latest_status: Option<NodeStatus>,
    pub latency_stats: Option<LatencyStats>,
}

/// 服务器 + 聚合状态 + 其节点
#[derive(Debug, Clone, Serialize)]
pub struct SnapshotServer {
    #[serde(flatten)]
    pub server: ServerEntity,
    pub aggregate: AggregateStatus,
    pub nodes: Vec<SnapshotNode>,
}

/// 服务器组 + 统计 + 其服务器
#[derive(Debug, Clone, Serialize)]
pub struct SnapshotGroup {
    #[serde(flatten)]
    pub group: ServerGroup,
    pub server_count: u32,
    pub online_node_count: u32,
    pub total_node_count: u32,
    pub total_players_online: u32,
    pub servers: Vec<SnapshotServer>,
}

/// 仪表盘快照：组 → 服务器 → 节点嵌套树
#[derive(Debug, Clone, Serialize)]
pub struct DashboardSnapshot {
    pub groups: Vec<SnapshotGroup>,
    /// 未分配到任何组的服务器
    pub ungrouped_servers: Vec<SnapshotServer>,
    /// server_id 悬空（指向不存在的服务器）的节点，不丢数据
    pub orphan_nodes: Vec<SnapshotNode>,
    /// 当前轮询间隔（秒），来自 app_config
    pub poll_interval: u64,
}

impl DashboardSnapshot {
    /// 加载快照。
    ///
    /// - `group_id`：只加载该组的服务器/节点（`None` = 全部）
    /// - `history_hours`：`Some(h)` 时附带每节点最近 h 小时的延迟统计
    ///   （一次全量历史查询，不做逐节点循环）
    pub async fn load(
        db: &Arc<dyn Database>,
        group_id: Option<&str>,
        history_hours: Option<u32>,
    ) -> Result<Self, DbError> {
        let groups = db.get_all_server_groups().await?;
        let servers = db.get_all_servers().await?;
        let nodes = db.get_all_nodes().await?;
        let latest = db.get_all_latest_status().await?;
        let poll_interval = db.poll_interval_secs().await;

        let stats_by_node: HashMap<String, LatencyStats> = match history_hours {
            Some(hours) => db
                .get_all_history(hours)
                .await?
                .into_iter()
                .filter(|(_, logs)| !logs.is_empty())
                .map(|(id, logs)| (id, calculate_latency_stats(&logs)))
                .collect(),
            None => HashMap::new(),
        };

        let latest_map: HashMap<&str, &StatusLog> =
            latest.iter().map(|s| (s.node_id.as_str(), s)).collect();

        let make_node = |n: &Node| SnapshotNode {
            node: n.clone(),
            latest_status: latest_map.get(n.id.as_str()).map(|s| NodeStatus {
                timestamp: *s.timestamp,
                online: s.online,
                latency: s.latency,
                players_online: s.players_online,
                players_max: s.players_max,
                version: s.version.clone(),
                motd: s.motd.clone(),
            }),
            latency_stats: stats_by_node.get(&n.id).cloned(),
        };

        // 组过滤：只保留该组的服务器
        let known_server_ids: std::collections::HashSet<&str> =
            servers.iter().map(|s| s.id.as_str()).collect();
        let servers: Vec<&ServerEntity> = servers
            .iter()
            .filter(|s| group_id.is_none() || s.group_id.as_deref() == group_id)
            .collect();

        let mut nodes_by_server: HashMap<&str, Vec<SnapshotNode>> = HashMap::new();
        for n in &nodes {
            nodes_by_server
                .entry(n.server_id.as_str())
                .or_default()
                .push(make_node(n));
        }

        let known_group_ids: std::collections::HashSet<&str> =
            groups.iter().map(|g| g.id.as_str()).collect();

        let mut servers_by_group: HashMap<&str, Vec<SnapshotServer>> = HashMap::new();
        let mut ungrouped_servers = Vec::new();
        for s in servers {
            let snap_nodes = nodes_by_server.remove(s.id.as_str()).unwrap_or_default();
            let node_refs: Vec<&Node> = snap_nodes.iter().map(|sn| &sn.node).collect();
            let snap_server = SnapshotServer {
                server: s.clone(),
                aggregate: aggregate_latest(&node_refs, &latest_map),
                nodes: snap_nodes,
            };
            match s.group_id.as_deref() {
                Some(gid) if known_group_ids.contains(gid) => {
                    servers_by_group.entry(gid).or_default().push(snap_server);
                }
                _ => ungrouped_servers.push(snap_server),
            }
        }

        // 剩余节点中，只有 server_id 悬空（指向不存在的服务器）的才是孤儿；
        // 属于被组过滤排除的服务器的节点直接丢弃
        let orphan_nodes: Vec<SnapshotNode> = nodes_by_server
            .into_iter()
            .filter(|(server_id, _)| !known_server_ids.contains(server_id))
            .flat_map(|(_, nodes)| nodes)
            .collect();

        let groups = groups
            .into_iter()
            .filter(|g| group_id.is_none() || Some(g.id.as_str()) == group_id)
            .map(|g| {
                let servers = servers_by_group.remove(g.id.as_str()).unwrap_or_default();
                // 组统计：只统计在线节点（与旧 list_groups 语义一致）
                let server_count = servers.len() as u32;
                let mut total_node_count = 0u32;
                let mut online_node_count = 0u32;
                let mut total_players_online = 0u32;
                for sv in &servers {
                    for n in &sv.nodes {
                        total_node_count += 1;
                        if let Some(ls) = &n.latest_status {
                            if ls.online {
                                online_node_count += 1;
                                total_players_online += ls.players_online.unwrap_or(0) as u32;
                            }
                        }
                    }
                }
                SnapshotGroup {
                    group: g,
                    server_count,
                    online_node_count,
                    total_node_count,
                    total_players_online,
                    servers,
                }
            })
            .collect();

        Ok(DashboardSnapshot {
            groups,
            ungrouped_servers,
            orphan_nodes,
            poll_interval,
        })
    }

    /// 扁平迭代所有快照节点（组内 → 未分组 → 孤儿）
    pub fn nodes(&self) -> impl Iterator<Item = &SnapshotNode> {
        self.groups
            .iter()
            .flat_map(|g| g.servers.iter())
            .chain(self.ungrouped_servers.iter())
            .flat_map(|s| s.nodes.iter())
            .chain(self.orphan_nodes.iter())
    }

    /// 扁平迭代所有快照服务器
    pub fn servers(&self) -> impl Iterator<Item = &SnapshotServer> {
        self.groups
            .iter()
            .flat_map(|g| g.servers.iter())
            .chain(self.ungrouped_servers.iter())
    }
}
