use axum::{Router, routing::get, response::IntoResponse, http::StatusCode};
use std::sync::Arc;
use crate::AppState;

pub fn create_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/online/:id", get(badge_online))
        .route("/players/:id", get(badge_players))
        .route("/latency/:id", get(badge_latency))
        .with_state(state)
}

async fn badge_online() -> impl IntoResponse {
    (StatusCode::OK, "<svg></svg>")
}

async fn badge_players() -> impl IntoResponse {
    (StatusCode::OK, "<svg></svg>")
}

async fn badge_latency() -> impl IntoResponse {
    (StatusCode::OK, "<svg></svg>")
}
