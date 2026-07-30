//! 服务器公开 API

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use std::collections::HashMap;

use super::snapshot::{aggregate_latest, DashboardSnapshot};
use super::AppState;
use crate::models::*;
use crate::utils::calculate_latency_stats;

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
) -> Result<Json<Vec<serde_json::Value>>, axum::http::StatusCode> {
    let snapshot = DashboardSnapshot::load(&state.db, q.group_id.as_deref(), None)
        .await
        .map_err(super::internal_error)?;

    let result: Vec<serde_json::Value> = snapshot
        .servers()
        .map(|sv| {
            serde_json::json!({
                "id": sv.server.id, "group_id": sv.server.group_id, "name": sv.server.name, "sort_order": sv.server.sort_order,
                "aggregate": sv.aggregate,
            })
        })
        .collect();

    Ok(Json(result))
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

    let all_nodes = state
        .db
        .get_nodes_by_server(&id)
        .await
        .map_err(super::internal_error)?;
    let latest_status = state
        .db
        .get_all_latest_status()
        .await
        .map_err(super::internal_error)?;
    let latest_map: HashMap<&str, &StatusLog> = latest_status
        .iter()
        .map(|s| (s.node_id.as_str(), s))
        .collect();

    // 一次查询取该服务器全部节点的 24h 历史（替代逐节点查询 N+1）
    let history = state
        .db
        .get_server_history(&id, 24)
        .await
        .map_err(super::internal_error)?;
    let mut logs_by_node: HashMap<String, Vec<StatusLog>> = HashMap::new();
    for log in history {
        logs_by_node
            .entry(log.node_id.clone())
            .or_default()
            .push(log);
    }

    let nodes_with_stats: Vec<NodeWithStats> = all_nodes
        .iter()
        .map(|n| {
            let ls = latest_map.get(n.id.as_str());
            let stats = logs_by_node
                .get(&n.id)
                .filter(|l| !l.is_empty())
                .map(|l| calculate_latency_stats(l));
            NodeWithStats {
                node: n.clone(),
                latest_status: ls.map(|s| NodeStatus {
                    timestamp: *s.timestamp,
                    online: s.online,
                    latency: s.latency,
                    players_online: s.players_online,
                    players_max: s.players_max,
                    version: s.version.clone(),
                    motd: s.motd.clone(),
                }),
                latency_stats: stats,
            }
        })
        .collect();

    let node_refs: Vec<&Node> = all_nodes.iter().collect();
    let aggregate = aggregate_latest(&node_refs, &latest_map);

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
