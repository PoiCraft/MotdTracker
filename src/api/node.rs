//! 节点公开 API

use super::snapshot::{DashboardSnapshot, SnapshotNode};
use super::AppState;
use crate::models::*;
use crate::utils::{calculate_latency_stats, history_limit_for_hours};
use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;

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
) -> Result<Json<Vec<SnapshotNode>>, axum::http::StatusCode> {
    // 快照一次加载全部 join + 逐节点 24h 统计（替代原先的逐节点历史查询 N+1）
    let snapshot = DashboardSnapshot::load(&state.db, q.group_id.as_deref(), Some(24))
        .await
        .map_err(super::internal_error)?;

    let result: Vec<SnapshotNode> = snapshot
        .nodes()
        .filter(|n| {
            q.server_id
                .as_deref()
                .is_none_or(|sid| n.node.server_id == sid)
        })
        .cloned()
        .collect();

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
    let poll_interval = state.db.poll_interval_secs().await;
    let history = state
        .db
        .get_node_history(&id, history_limit_for_hours(poll_interval, 24))
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
            timestamp: *s.timestamp,
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
