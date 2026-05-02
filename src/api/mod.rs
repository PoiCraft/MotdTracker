//! API 模块

pub mod server;
pub mod node;
pub mod player;
pub mod web;
pub mod badge;
pub mod exporter;
pub mod query;
pub mod pages;

use std::sync::Arc;
use axum::response::Response;
use tokio::sync::watch;

use crate::config::AppConfig;
use crate::db::Database;
use crate::ws::WsBroadcaster;

/// 应用状态
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<dyn Database>,
    pub config: Arc<AppConfig>,
    pub broadcaster: Arc<WsBroadcaster>,
    pub shutdown_rx: watch::Receiver<bool>,
}

/// WebSocket 处理器
pub async fn ws_handler(
    ws: axum::extract::ws::WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Response {
    let shutdown_rx = state.shutdown_rx.clone();
    ws.on_upgrade(move |socket| async move {
        crate::ws::handle_socket(socket, state.broadcaster, shutdown_rx).await;
    })
}
