use axum::{Router, routing::get, Json, extract::{Path, State}};
use std::sync::Arc;
use crate::AppState;
use serde_json::json;

pub fn create_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(list_nodes))
        .route("/:id", get(get_node))
        .route("/:id/history", get(get_node_history))
        .route("/:id/stats", get(get_node_stats))
        .route("/:id/online_players", get(get_node_online_players))
        .with_state(state)
}

async fn list_nodes(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "nodes": [] }))
}

async fn get_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "node": {} }))
}

async fn get_node_history(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "history": [] }))
}

async fn get_node_stats(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "stats": {} }))
}

async fn get_node_online_players(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "players": [] }))
}
