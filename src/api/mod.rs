pub mod node;
pub mod server;
pub mod player;
pub mod exporter;
pub mod badge;
pub mod web;

use axum::Router;
use std::sync::Arc;
use crate::AppState;

/// 注册所有API路由
pub fn create_api_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .nest("/node", node::create_routes(state.clone()))
        .nest("/server", server::create_routes(state.clone()))
        .nest("/player", player::create_routes(state.clone()))
        .nest("/exporter", exporter::create_routes(state.clone()))
        .nest("/badge", badge::create_routes(state.clone()))
        .nest("/web", web::create_routes(state.clone()))
}
