use axum::{Router, routing::get, Json, extract::{Path, State}};
use std::sync::Arc;
use crate::AppState;
use serde_json::json;

pub fn create_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(list_players))
        .route("/:name", get(get_player))
        .route("/:name/sessions", get(get_player_sessions))
        .with_state(state)
}

async fn list_players(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "players": [] }))
}

async fn get_player(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "player": {} }))
}

async fn get_player_sessions(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "sessions": [] }))
}
