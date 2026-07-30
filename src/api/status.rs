//! 服务状态公开 API

use axum::{extract::State, routing::get, Json, Router};

use super::AppState;
use crate::APP_VERSION;

pub fn create_router() -> Router<AppState> {
    Router::new().route("/", get(get_status))
}

async fn get_status(State(state): State<AppState>) -> Json<serde_json::Value> {
    let groups = state
        .db
        .get_all_server_groups()
        .await
        .map(|v| v.len())
        .unwrap_or(0);
    let servers = state
        .db
        .get_all_servers()
        .await
        .map(|v| v.len())
        .unwrap_or(0);
    let nodes = state.db.get_all_nodes().await.map(|v| v.len()).unwrap_or(0);
    let sn = state
        .db
        .get_app_config("server_name")
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| "MotdTracker".to_string());
    let poll_interval = state.db.poll_interval_secs().await;

    Json(serde_json::json!({
        "version": APP_VERSION,
        "server_name": sn,
        "poll_interval": poll_interval,
        "group_count": groups,
        "server_count": servers,
        "node_count": nodes,
    }))
}
