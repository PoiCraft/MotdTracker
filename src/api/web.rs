use axum::{Router, routing::get, Json, extract::State};
use std::sync::Arc;
use crate::AppState;
use serde_json::json;

pub fn create_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/status", get(get_status))
        .with_state(state)
}

async fn get_status(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}
