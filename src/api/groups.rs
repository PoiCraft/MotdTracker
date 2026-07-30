//! 服务器组公开 API

use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};

use super::snapshot::DashboardSnapshot;
use super::AppState;
use crate::models::*;

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_groups))
        .route("/:id", get(get_group))
}

async fn list_groups(
    State(state): State<AppState>,
) -> Result<Json<Vec<GroupWithStats>>, axum::http::StatusCode> {
    let snapshot = DashboardSnapshot::load(&state.db, None, None)
        .await
        .map_err(super::internal_error)?;

    let result: Vec<GroupWithStats> = snapshot
        .groups
        .into_iter()
        .map(|g| GroupWithStats {
            group: g.group,
            server_count: g.server_count,
            online_node_count: g.online_node_count,
            total_node_count: g.total_node_count,
            total_players_online: g.total_players_online,
        })
        .collect();

    Ok(Json(result))
}

async fn get_group(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    // 按组过滤加载快照：组 → 服务器 → 节点嵌套树
    let snapshot = DashboardSnapshot::load(&state.db, Some(&id), None)
        .await
        .map_err(super::internal_error)?;

    let group = snapshot
        .groups
        .into_iter()
        .next()
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;

    Ok(Json(
        serde_json::to_value(&group).map_err(super::internal_error)?,
    ))
}
