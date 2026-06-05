//! API 模块

pub mod admin;
pub mod badge;
pub mod exporter;
pub mod groups;
pub mod node;
pub mod player;
pub mod servers;
pub mod status;

use axum::http::StatusCode;
use axum::response::Response;
use governor::DefaultKeyedRateLimiter;
use std::net::IpAddr;
use std::sync::Arc;
use tokio::sync::watch;

use crate::config::AppConfig;
use crate::core::poller::ServerPollerManager;
use crate::db::Database;
use crate::ws::WsBroadcaster;

/// 基于 IP 的限流器
pub type IpRateLimiter = Arc<DefaultKeyedRateLimiter<IpAddr>>;

/// 应用状态
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<dyn Database>,
    pub config: Arc<AppConfig>,
    pub broadcaster: Arc<WsBroadcaster>,
    pub poller_manager: Arc<ServerPollerManager>,
    pub ws_shutdown_rx: watch::Receiver<bool>,
    pub login_limiter: IpRateLimiter,
}

/// 统一内部错误处理：记录日志后返回 500
pub fn internal_error<E: std::fmt::Display>(err: E) -> StatusCode {
    tracing::error!("Internal server error: {}", err);
    StatusCode::INTERNAL_SERVER_ERROR
}

/// WebSocket 处理器
pub async fn ws_handler(
    ws: axum::extract::ws::WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Response {
    // WebSocket 可选认证：若提供了 token 则校验，未提供则允许匿名连接（只读广播）
    if let Some(token) = params.get("token") {
        if !crate::auth::token::validate_token_format(token) {
            return axum::http::Response::builder()
                .status(axum::http::StatusCode::UNAUTHORIZED)
                .body("Invalid token format".into())
                .unwrap();
        }
        match state.db.validate_session(token).await {
            Ok(Some(_)) => {}
            _ => {
                return axum::http::Response::builder()
                    .status(axum::http::StatusCode::UNAUTHORIZED)
                    .body("Invalid or expired token".into())
                    .unwrap();
            }
        }
    }

    let shutdown_rx = state.ws_shutdown_rx.clone();
    ws.on_upgrade(move |socket| async move {
        crate::ws::handle_socket(socket, state.broadcaster, shutdown_rx).await;
    })
}
