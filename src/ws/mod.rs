//! WebSocket 模块

mod handler;

use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::{broadcast, watch, RwLock};
use tracing::{debug, error, info};

use crate::utils::time::{format_gmt8_naive, Gmt8Time};

/// WebSocket 广播器
pub struct WsBroadcaster {
    /// 广播发送器
    sender: broadcast::Sender<WsMessage>,
    /// 活跃客户端数量
    client_count: Arc<RwLock<usize>>,
}

/// WebSocket 消息
#[derive(Debug, Clone)]
pub struct WsMessage {
    /// 事件类型
    pub event: String,
    /// 数据
    pub data: serde_json::Value,
}

/// 节点状态快照（用于 WebSocket 广播）
#[derive(Debug, Clone, serde::Serialize)]
pub struct WsNodeSnapshot {
    pub node_id: String,
    pub server_id: String,
    pub online: bool,
    pub latency: Option<f64>,
    pub players_online: Option<i32>,
    pub players_max: Option<i32>,
    pub version: Option<String>,
    pub motd: Option<String>,
}

impl WsBroadcaster {
    /// 创建新的广播器
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(1024);
        Self {
            sender,
            client_count: Arc::new(RwLock::new(0)),
        }
    }

    /// 广播轮询完成事件（带节点状态上下文）
    pub async fn broadcast_poll_complete(&self, timestamp: Gmt8Time, nodes: Vec<WsNodeSnapshot>) {
        let message = WsMessage {
            event: "poll_complete".to_string(),
            data: serde_json::json!({
                "timestamp": format_gmt8_naive(timestamp),
                "nodes": nodes,
            }),
        };

        if self.sender.send(message).is_err() {
            debug!("没有活跃的 WebSocket 客户端");
        }
    }

    /// 广播自定义事件
    pub async fn broadcast(&self, event: &str, data: serde_json::Value) {
        let message = WsMessage {
            event: event.to_string(),
            data,
        };

        if self.sender.send(message).is_err() {
            debug!("没有活跃的 WebSocket 客户端");
        }
    }

    /// 订阅消息
    pub fn subscribe(&self) -> broadcast::Receiver<WsMessage> {
        self.sender.subscribe()
    }

    /// 增加客户端计数
    pub async fn add_client(&self) {
        let mut count = self.client_count.write().await;
        *count += 1;
        debug!("WebSocket 客户端连接，当前数量: {}", *count);
    }

    /// 减少客户端计数
    pub async fn remove_client(&self) {
        let mut count = self.client_count.write().await;
        *count = count.saturating_sub(1);
        debug!("WebSocket 客户端断开，当前数量: {}", *count);
    }

    /// 获取客户端数量
    pub async fn client_count(&self) -> usize {
        *self.client_count.read().await
    }
}

impl Default for WsBroadcaster {
    fn default() -> Self {
        Self::new()
    }
}

/// 处理 WebSocket 连接
#[allow(clippy::collapsible_match)]
pub async fn handle_socket(
    socket: WebSocket,
    broadcaster: Arc<WsBroadcaster>,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    broadcaster.add_client().await;

    let (mut tx, mut rx) = socket.split();
    let mut receiver = broadcaster.subscribe();

    loop {
        tokio::select! {
            Ok(msg) = receiver.recv() => {
                let json = serde_json::json!({
                    "event": msg.event,
                    "data": msg.data
                });
                if tx.send(Message::Text(json.to_string())).await.is_err() {
                    break;
                }
            }
            msg = rx.next() => {
                match msg {
                    Some(Ok(Message::Ping(data))) => {
                        if tx.send(Message::Pong(data)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(e)) => {
                        error!("WebSocket 错误: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
            _result = shutdown_rx.changed() => {
                // 无论 changed() 返回 Ok 还是 Err（发送端 drop），都应关闭连接
                info!("WebSocket 收到关闭信号，发送 close frame");
                let _ = tx.send(Message::Close(Some(axum::extract::ws::CloseFrame {
                    code: 1001,
                    reason: "Server shutting down".into(),
                }))).await;
                break;
            }
        }
    }

    broadcaster.remove_client().await;
}
