use axum::{Router, routing::get, Json, extract::{Path, Query, State}};
use std::sync::Arc;
use crate::AppState;
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
struct SessionsQuery {
    days: Option<i32>,
}

pub fn create_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(list_players))
        .route("/list", get(list_players))  // Alias for compatibility
        .route("/:name", get(get_player))
        .route("/:name/history", get(get_player_history))
        .route("/:name/sessions", get(get_player_sessions))
        .with_state(state)
}

/// 列出所有在线玩家
async fn list_players(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
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
            tracing::error!("Failed to list players: {}", e);
            Json(json!({ "status": "error", "message": e.to_string(), "players": [] }))
        }
    }
}

/// 获取单个玩家信息
async fn get_player(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Json<serde_json::Value> {
    // 查找玩家是否在线
    match state.db.get_all_servers().await {
        Ok(servers) => {
            for server in servers {
                if let Ok(players) = state.db.get_online_players(server.id).await {
                    if let Some(player) = players.iter().find(|p| p.player_name == name) {
                        return Json(json!({
                            "status": "ok",
                            "player": {
                                "name": player.player_name,
                                "server_name": server.name,
                                "server_id": server.id,
                                "session_start": player.session_start,
                                "duration_seconds": player.duration_seconds,
                                "online": true,
                            }
                        }));
                    }
                }
            }
            // 玩家不在线
            Json(json!({
                "status": "ok",
                "player": {
                    "name": name,
                    "online": false,
                }
            }))
        }
        Err(e) => {
            tracing::error!("Failed to get player: {}", e);
            Json(json!({ "status": "error", "message": e.to_string() }))
        }
    }
}

/// 获取玩家历史会话记录
async fn get_player_history(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(params): Query<SessionsQuery>,
) -> Json<serde_json::Value> {
    match state.db.get_player_history(&name, params.days).await {
        Ok(sessions) => {
            let session_list: Vec<_> = sessions.iter().map(|s| {
                let duration = if let Some(end) = s.session_end {
                    end.signed_duration_since(s.session_start).num_seconds()
                } else {
                    chrono::Utc::now().signed_duration_since(s.session_start).num_seconds()
                };
                
                json!({
                    "id": s.id,
                    "server_id": s.server_id,
                    "player_name": s.player_name,
                    "session_start": s.session_start,
                    "session_end": s.session_end,
                    "is_online": s.is_online,
                    "duration_seconds": duration,
                })
            }).collect();
            
            Json(json!({ "status": "ok", "sessions": session_list }))
        }
        Err(e) => {
            tracing::error!("Failed to get player history: {}", e);
            Json(json!({ "status": "error", "message": e.to_string(), "sessions": [] }))
        }
    }
}

/// 获取玩家会话记录（别名）
async fn get_player_sessions(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(params): Query<SessionsQuery>,
) -> Json<serde_json::Value> {
    get_player_history(State(state), Path(name), Query(params)).await
}
