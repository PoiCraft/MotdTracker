//! 服务器公开 API

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use std::collections::HashMap;

use super::AppState;
use crate::models::*;
use crate::utils::{calculate_latency_stats, history_limit_for_hours};

/// 从节点列表和最新状态映射计算聚合指标
pub fn compute_aggregate(
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

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_servers))
        .route("/:id", get(get_server))
        .route("/:id/history", get(get_server_history))
}

#[derive(Deserialize)]
struct ServerQuery {
    group_id: Option<String>,
    hours: Option<u32>,
}

async fn list_servers(
    State(state): State<AppState>,
    Query(q): Query<ServerQuery>,
) -> Json<Vec<serde_json::Value>> {
    let all_servers = state.db.get_all_servers().await.unwrap_or_default();
    let all_nodes = state.db.get_all_nodes().await.unwrap_or_default();
    let latest_status = state.db.get_all_latest_status().await.unwrap_or_default();
    let latest_map: HashMap<&str, &StatusLog> = latest_status
        .iter()
        .map(|s| (s.node_id.as_str(), s))
        .collect();

    // 按 group_id 过滤
    let filtered: Vec<&ServerEntity> = if let Some(ref gid) = q.group_id {
        all_servers
            .iter()
            .filter(|s| s.group_id.as_deref() == Some(gid.as_str()))
            .collect()
    } else {
        all_servers.iter().collect()
    };

    // 构建 server_id -> nodes 映射
    let mut server_nodes: HashMap<&str, Vec<&Node>> = HashMap::new();
    for n in &all_nodes {
        server_nodes
            .entry(n.server_id.as_str())
            .or_default()
            .push(n);
    }

    let result: Vec<serde_json::Value> = filtered
        .iter()
        .map(|sv| {
            let nodes = server_nodes
                .get(sv.id.as_str())
                .map(|v| v.as_slice())
                .unwrap_or(&[]);
            let aggregate = compute_aggregate(nodes, &latest_map);
            serde_json::json!({
                "id": sv.id, "group_id": sv.group_id, "name": sv.name, "sort_order": sv.sort_order,
                "aggregate": aggregate
            })
        })
        .collect();

    Json(result)
}

async fn get_server(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    let server = state
        .db
        .get_server(&id)
        .await
        .map_err(super::internal_error)?
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;

    let all_nodes = state.db.get_nodes_by_server(&id).await.unwrap_or_default();
    let latest_status = state.db.get_all_latest_status().await.unwrap_or_default();
    let latest_map: HashMap<&str, &StatusLog> = latest_status
        .iter()
        .map(|s| (s.node_id.as_str(), s))
        .collect();

    // 根据轮询间隔计算覆盖 24 小时所需的检查记录数
    let poll_interval = state
        .db
        .get_app_config("poll_interval")
        .await
        .ok()
        .flatten()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(60);
    let history_limit = history_limit_for_hours(poll_interval, 24);

    let mut nodes_with_stats: Vec<NodeWithStats> = Vec::with_capacity(all_nodes.len());
    for n in &all_nodes {
        let ls = latest_map.get(n.id.as_str());
        let stats = state
            .db
            .get_node_history(&n.id, history_limit)
            .await
            .ok()
            .filter(|h| !h.is_empty())
            .map(|h| calculate_latency_stats(&h));
        nodes_with_stats.push(NodeWithStats {
            node: n.clone(),
            latest_status: ls.map(|s| NodeStatus {
                timestamp: s.timestamp,
                online: s.online,
                latency: s.latency,
                players_online: s.players_online,
                players_max: s.players_max,
                version: s.version.clone(),
                motd: s.motd.clone(),
            }),
            latency_stats: stats,
        });
    }

    let node_refs: Vec<&Node> = all_nodes.iter().collect();
    let aggregate = compute_aggregate(&node_refs, &latest_map);

    Ok(Json(serde_json::json!({
        "id": server.id, "group_id": server.group_id, "name": server.name, "sort_order": server.sort_order,
        "nodes": nodes_with_stats,
        "aggregate": aggregate
    })))
}

async fn get_server_history(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(q): Query<ServerQuery>,
) -> Result<Json<Vec<StatusLog>>, axum::http::StatusCode> {
    let hours = q.hours.unwrap_or(24).clamp(1, 720);
    state
        .db
        .get_server_history(&id, hours)
        .await
        .map(Json)
        .map_err(super::internal_error)
}
