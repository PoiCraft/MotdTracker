use axum::{Router, routing::get, Json, extract::{State, Query}};
use std::sync::Arc;
use crate::AppState;
use serde::{Deserialize, Serialize};
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
        .route("/nodes", get(get_nodes))
        .route("/history", get(get_history))
        .route("/stats", get(get_stats))
        .route("/players", get(get_players))
        .with_state(state)
}

/// 获取所有节点的最新状态
async fn get_nodes(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
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
            tracing::error!("Failed to get nodes: {}", e);
            Json(json!({ "status": "error", "message": e.to_string(), "nodes": [] }))
        }
    }
}

/// 获取所有节点的历史记录
async fn get_history(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HistoryQuery>,
) -> Json<serde_json::Value> {
    let limit = (params.hours * 3600) / state.config.poll_interval as i64;
    
    match state.db.get_all_servers().await {
        Ok(servers) => {
            let mut history = Vec::new();
            for server in servers {
                if let Ok(records) = state.db.get_server_history(server.id, limit).await {
                    for record in records {
                        history.push(json!({
                            "server_id": server.id,
                            "server_name": server.name,
                            "timestamp": record.timestamp,
                            "online": record.online,
                            "latency": record.latency,
                            "players_online": record.players_online,
                            "players_max": record.players_max,
                        }));
                    }
                }
            }
            Json(json!({ "status": "ok", "history": history }))
        }
        Err(e) => {
            tracing::error!("Failed to get history: {}", e);
            Json(json!({ "status": "error", "message": e.to_string(), "history": [] }))
        }
    }
}

/// 获取聚合统计信息
async fn get_stats(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let limit = 86400 / state.config.poll_interval as i64;
    
    match state.db.get_all_servers().await {
        Ok(servers) => {
            if servers.is_empty() {
                return Json(json!({ 
                    "status": "ok", 
                    "stats": {
                        "online_rate": 0.0,
                        "avg_latency": null,
                        "stddev_latency": null,
                        "min_latency": null,
                        "max_latency": null,
                        "p95_latency": null,
                        "cv": null,
                    }
                }));
            }

            // 聚合所有服务器的统计数据
            let mut all_online_rates = Vec::new();
            let mut all_latencies = Vec::new();

            for server in servers {
                if let Ok(stats) = state.db.get_server_stats(server.id, limit).await {
                    all_online_rates.push(stats.online_rate);
                    if let Ok(history) = state.db.get_server_history(server.id, limit).await {
                        for record in history {
                            if let Some(latency) = record.latency {
                                all_latencies.push(latency);
                            }
                        }
                    }
                }
            }

            let online_rate = if !all_online_rates.is_empty() {
                all_online_rates.iter().sum::<f64>() / all_online_rates.len() as f64
            } else {
                0.0
            };

            let stats = if !all_latencies.is_empty() {
                let avg = all_latencies.iter().sum::<f64>() / all_latencies.len() as f64;
                let min = all_latencies.iter().cloned().fold(f64::INFINITY, f64::min);
                let max = all_latencies.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
                
                let variance = all_latencies.iter()
                    .map(|&x| (x - avg).powi(2))
                    .sum::<f64>() / all_latencies.len() as f64;
                let stddev = variance.sqrt();

                let mut sorted = all_latencies.clone();
                sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
                let p95_index = ((sorted.len() as f64) * 0.95) as usize;
                let p95 = sorted.get(p95_index.min(sorted.len() - 1)).copied().unwrap_or(max);

                let cv = if avg > 0.0 { (stddev / avg) * 100.0 } else { 0.0 };

                json!({
                    "online_rate": online_rate,
                    "avg_latency": avg,
                    "stddev_latency": stddev,
                    "min_latency": min,
                    "max_latency": max,
                    "p95_latency": p95,
                    "cv": cv,
                })
            } else {
                json!({
                    "online_rate": online_rate,
                    "avg_latency": null,
                    "stddev_latency": null,
                    "min_latency": null,
                    "max_latency": null,
                    "p95_latency": null,
                    "cv": null,
                })
            };

            Json(json!({ "status": "ok", "stats": stats }))
        }
        Err(e) => {
            tracing::error!("Failed to get stats: {}", e);
            Json(json!({ "status": "error", "message": e.to_string(), "stats": {} }))
        }
    }
}

/// 获取所有在线玩家
async fn get_players(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    match state.db.get_all_servers().await {
        Ok(servers) => {
            let mut all_players = Vec::new();
            for server in servers {
                if let Ok(players) = state.db.get_online_players(server.id).await {
                    for player in players {
                        all_players.push(json!({
                            "name": player.player_name,
                            "server_name": server.name,
                            "server_id": server.id,
                            "session_start": player.session_start,
                            "duration_seconds": player.duration_seconds,
                        }));
                    }
                }
            }
            Json(json!({ "status": "ok", "players": all_players }))
        }
        Err(e) => {
            tracing::error!("Failed to get players: {}", e);
            Json(json!({ "status": "error", "message": e.to_string(), "players": [] }))
        }
    }
}
