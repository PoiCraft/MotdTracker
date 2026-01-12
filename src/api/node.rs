use axum::{Router, routing::get, Json, extract::{Path, Query, State}};
use std::sync::Arc;
use crate::AppState;
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
struct HistoryQuery {
    #[serde(default = "default_hours")]
    hours: i64,
}

fn default_hours() -> i64 {
    24
}

pub fn create_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(list_nodes))
        .route("/:id", get(get_node))
        .route("/:id/history", get(get_node_history))
        .route("/:id/stats", get(get_node_stats))
        .route("/:id/online_players", get(get_node_online_players))
        .with_state(state)
}

/// 列出所有节点
async fn list_nodes(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    match state.db.get_all_servers().await {
        Ok(servers) => {
            let mut nodes = Vec::new();
            for server in servers {
                if let Ok(Some(status)) = state.db.get_server_latest_status(server.id).await {
                    nodes.push(json!({
                        "id": server.id,
                        "name": server.name,
                        "host": server.host,
                        "port": server.port,
                        "color": server.color,
                        "online": status.online,
                        "latency": status.latency,
                        "players_online": status.players_online,
                        "players_max": status.players_max,
                        "version": status.version,
                        "motd": status.motd,
                    }));
                } else {
                    nodes.push(json!({
                        "id": server.id,
                        "name": server.name,
                        "host": server.host,
                        "port": server.port,
                        "color": server.color,
                        "online": false,
                    }));
                }
            }
            Json(json!({ "status": "ok", "nodes": nodes }))
        }
        Err(e) => {
            tracing::error!("Failed to list nodes: {}", e);
            Json(json!({ "status": "error", "message": e.to_string(), "nodes": [] }))
        }
    }
}

/// 获取单个节点信息
async fn get_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Json<serde_json::Value> {
    match state.db.get_all_servers().await {
        Ok(servers) => {
            if let Some(server) = servers.iter().find(|s| s.id == id) {
                if let Ok(Some(status)) = state.db.get_server_latest_status(id).await {
                    Json(json!({
                        "status": "ok",
                        "node": {
                            "id": server.id,
                            "name": server.name,
                            "host": server.host,
                            "port": server.port,
                            "color": server.color,
                            "online": status.online,
                            "latency": status.latency,
                            "players_online": status.players_online,
                            "players_max": status.players_max,
                            "version": status.version,
                            "motd": status.motd,
                            "timestamp": status.timestamp,
                        }
                    }))
                } else {
                    Json(json!({
                        "status": "ok",
                        "node": {
                            "id": server.id,
                            "name": server.name,
                            "host": server.host,
                            "port": server.port,
                            "color": server.color,
                            "online": false,
                        }
                    }))
                }
            } else {
                Json(json!({ "status": "error", "message": "Node not found" }))
            }
        }
        Err(e) => {
            tracing::error!("Failed to get node: {}", e);
            Json(json!({ "status": "error", "message": e.to_string() }))
        }
    }
}

/// 获取节点历史记录
async fn get_node_history(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
    Query(params): Query<HistoryQuery>,
) -> Json<serde_json::Value> {
    let limit = (params.hours * 3600) / state.config.poll_interval as i64;
    
    match state.db.get_server_history(id, limit).await {
        Ok(records) => {
            let history: Vec<_> = records.iter().map(|r| json!({
                "timestamp": r.timestamp,
                "online": r.online,
                "latency": r.latency,
                "players_online": r.players_online,
                "players_max": r.players_max,
                "version": r.version,
            })).collect();
            Json(json!({ "status": "ok", "history": history }))
        }
        Err(e) => {
            tracing::error!("Failed to get node history: {}", e);
            Json(json!({ "status": "error", "message": e.to_string(), "history": [] }))
        }
    }
}

/// 获取节点统计信息
async fn get_node_stats(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Json<serde_json::Value> {
    let limit = 86400 / state.config.poll_interval as i64;
    
    match state.db.get_server_stats(id, limit).await {
        Ok(stats) => {
            Json(json!({
                "status": "ok",
                "stats": {
                    "online_rate": stats.online_rate,
                    "avg_latency": stats.avg_latency,
                    "stddev_latency": stats.stddev_latency,
                    "min_latency": stats.min_latency,
                    "max_latency": stats.max_latency,
                    "p95_latency": stats.p95_latency,
                    "cv": stats.cv,
                }
            }))
        }
        Err(e) => {
            tracing::error!("Failed to get node stats: {}", e);
            Json(json!({ "status": "error", "message": e.to_string(), "stats": {} }))
        }
    }
}

/// 获取节点在线玩家
async fn get_node_online_players(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Json<serde_json::Value> {
    match state.db.get_online_players(id).await {
        Ok(players) => {
            let player_list: Vec<_> = players.iter().map(|p| json!({
                "player_name": p.player_name,
                "session_start": p.session_start,
                "duration_seconds": p.duration_seconds,
            })).collect();
            Json(json!({ "status": "ok", "players": player_list }))
        }
        Err(e) => {
            tracing::error!("Failed to get online players: {}", e);
            Json(json!({ "status": "error", "message": e.to_string(), "players": [] }))
        }
    }
}
