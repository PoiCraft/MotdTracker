use axum::{Router, routing::get, response::IntoResponse, http::StatusCode};
use std::sync::Arc;
use crate::AppState;

pub fn create_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/metrics", get(metrics))
        .route("/health", get(health))
        .with_state(state)
}

async fn metrics() -> impl IntoResponse {
    // Prometheus格式的指标
    (StatusCode::OK, "# MotdTracker Metrics\n")
}

async fn health() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}
