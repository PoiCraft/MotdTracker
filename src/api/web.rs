use axum::{Router, routing::get, Json, extract::State};
use std::sync::Arc;
use crate::AppState;
use serde_json::json;

pub fn create_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/status", get(get_status))
        .with_state(state)
}

/// 获取系统状态信息
async fn get_status(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let version = crate::utils::get_version();
    
    // 获取节点数量
    let node_count = match state.db.get_all_servers().await {
        Ok(servers) => servers.len(),
        Err(_) => 0,
    };

    // 获取在线节点数量
    let mut online_nodes = 0;
    if let Ok(servers) = state.db.get_all_servers().await {
        for server in servers {
            if let Ok(Some(status)) = state.db.get_server_latest_status(server.id).await {
                if status.online {
                    online_nodes += 1;
                }
            }
        }
    }

    Json(json!({
        "status": "ok",
        "version": version,
        "nodes": {
            "total": node_count,
            "online": online_nodes,
        },
        "poll_interval": state.config.poll_interval,
    }))
}
