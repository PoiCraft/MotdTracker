use axum::{Router, routing::get, Json, extract::State};
use std::sync::Arc;
use crate::AppState;
use serde_json::json;

pub fn create_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/nodes", get(get_nodes))
        .route("/history", get(get_history))
        .route("/stats", get(get_stats))
        .route("/players", get(get_players))
        .with_state(state)
}

async fn get_nodes(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "nodes": [] }))
}

async fn get_history(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "history": [] }))
}

async fn get_stats(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "stats": {} }))
}

async fn get_players(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "players": [] }))
}
