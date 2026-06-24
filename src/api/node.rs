//! 节点公开 API

use super::AppState;
use crate::models::*;
use crate::utils::calculate_latency_stats;
use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};

#[derive(Deserialize)]
struct NodeQuery {
    hours: Option<u32>,
    group_id: Option<String>,
    server_id: Option<String>,
}

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_nodes))
        .route("/:id", get(get_node))
        .route("/:id/history", get(get_node_history))
}

async fn list_nodes(
    State(state): State<AppState>,
    Query(q): Query<NodeQuery>,
) -> Result<Json<Vec<NodeWithStats>>, axum::http::StatusCode> {
    let all_nodes = state
        .db
        .get_all_nodes()
        .await
        .map_err(super::internal_error)?;
    let all_servers = state.db.get_all_servers().await.unwrap_or_default();
    let latest_status = state.db.get_all_latest_status().await.unwrap_or_default();
    let latest_map: HashMap<&str, &StatusLog> = latest_status
        .iter()
        .map(|s| (s.node_id.as_str(), s))
        .collect();

    // 按 group_id 或 server_id 过滤
    let filtered: Vec<&Node> = if let Some(ref sid) = q.server_id {
        all_nodes.iter().filter(|n| n.server_id == *sid).collect()
    } else if let Some(ref gid) = q.group_id {
        let server_ids_in_group: HashSet<String> = all_servers
            .iter()
            .filter(|s| s.group_id.as_deref() == Some(gid.as_str()))
            .map(|s| s.id.clone())
            .collect();
        all_nodes
            .iter()
            .filter(|n| server_ids_in_group.contains(&n.server_id))
            .collect()
    } else {
        all_nodes.iter().collect()
    };

    let mut result = Vec::with_capacity(filtered.len());
    for n in filtered {
        let ls = latest_map.get(n.id.as_str());
        let stats = state
            .db
            .get_node_history(&n.id, 720)
            .await
            .ok()
            .filter(|h| !h.is_empty())
            .map(|h| calculate_latency_stats(&h));
        result.push(NodeWithStats {
            node: (*n).clone(),
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

    Ok(Json(result))
}

async fn get_node(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<NodeWithStats>, axum::http::StatusCode> {
    let node = state
        .db
        .get_node(&id)
        .await
        .map_err(super::internal_error)?
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;
    let latest = state.db.get_node_latest_status(&id).await.ok().flatten();
    let history = state
        .db
        .get_node_history(&id, 720)
        .await
        .unwrap_or_default();
    let stats = if !history.is_empty() {
        Some(calculate_latency_stats(&history))
    } else {
        None
    };

    Ok(Json(NodeWithStats {
        node,
        latest_status: latest.map(|s| NodeStatus {
            timestamp: s.timestamp,
            online: s.online,
            latency: s.latency,
            players_online: s.players_online,
            players_max: s.players_max,
            version: s.version,
            motd: s.motd,
        }),
        latency_stats: stats,
    }))
}

async fn get_node_history(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(q): Query<NodeQuery>,
) -> Result<Json<Vec<StatusLog>>, axum::http::StatusCode> {
    let hours = q.hours.unwrap_or(24).clamp(1, 720);
    let now = crate::utils::time::now_gmt8();
    let start = now - chrono::Duration::hours(hours as i64);
    state
        .db
        .get_node_history_range(&id, start, now)
        .await
        .map(Json)
        .map_err(super::internal_error)
}
