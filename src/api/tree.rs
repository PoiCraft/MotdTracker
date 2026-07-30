//! 仪表盘嵌套树 API
//!
//! 返回完整的组 → 服务器 → 节点嵌套树（含最新状态、逐节点 24h 统计、
//! 服务器聚合、组统计）。前端各页面直接渲染树，不再自行分组。

use axum::{extract::State, routing::get, Json, Router};

use super::snapshot::DashboardSnapshot;
use super::AppState;

pub fn create_router() -> Router<AppState> {
    Router::new().route("/", get(get_tree))
}

async fn get_tree(
    State(state): State<AppState>,
) -> Result<Json<DashboardSnapshot>, axum::http::StatusCode> {
    DashboardSnapshot::load(&state.db, None, Some(24))
        .await
        .map(Json)
        .map_err(super::internal_error)
}
