//! API 模块

pub mod admin;
pub mod badge;
pub mod exporter;
pub mod groups;
pub mod node;
pub mod player;
pub mod servers;
pub mod status;

use axum::response::Response;
use std::sync::Arc;
use tokio::sync::watch;

use crate::config::AppConfig;
use crate::core::poller::ServerPollerManager;
use crate::db::Database;
use crate::ws::WsBroadcaster;

/// 应用状态
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<dyn Database>,
    pub config: Arc<AppConfig>,
    pub broadcaster: Arc<WsBroadcaster>,
    pub poller_manager: Arc<ServerPollerManager>,
    pub ws_shutdown_rx: watch::Receiver<bool>,
}

/// WebSocket 处理器
pub async fn ws_handler(
    ws: axum::extract::ws::WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Response {
    let shutdown_rx = state.ws_shutdown_rx.clone();
    ws.on_upgrade(move |socket| async move {
        crate::ws::handle_socket(socket, state.broadcaster, shutdown_rx).await;
    })
}
