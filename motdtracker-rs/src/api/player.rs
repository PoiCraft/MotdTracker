//! 玩家 API

use axum::{
    routing::get,
    Router,
    extract::{State, Path},
    Json,
};
use serde::Deserialize;

use super::AppState;
use crate::models::{PlayerListItem, PlayerDetail};

#[derive(Deserialize)]
struct DaysQuery {
    #[serde(default = "default_days")]
    days: u32,
}

fn default_days() -> u32 { 30 }

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", get(get_players))
        .route("/:name/detail", get(get_player_detail))
        .route("/:name/sessions", get(get_player_sessions))
        .route("/:name/heatmap", get(get_player_heatmap))
}

/// 获取所有玩家列表
async fn get_players(
    State(state): State<AppState>,
) -> Json<Vec<PlayerListItem>> {
    let all_names = match state.db.get_all_player_names().await {
        Ok(names) => names,
        Err(_) => return Json(Vec::new()),
    };
    
    let mut result: Vec<PlayerListItem> = Vec::new();
    
    for name in all_names {
        if let Ok(Some(detail)) = state.db.get_player_detail(&name).await {
            result.push(PlayerListItem {
                player_name: detail.player_name,
                online: detail.online,
                session_start: detail.session_start,
                last_seen: Some(detail.last_seen),
                duration_seconds: detail.duration_seconds,
                servers: detail.servers,
            });
        }
    }
    
    // 按在线状态和最后在线时间排序
    result.sort_by(|a, b| {
        match (a.online, b.online) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => {
                let a_time = a.last_seen.unwrap_or_else(chrono::Utc::now);
                let b_time = b.last_seen.unwrap_or_else(chrono::Utc::now);
                b_time.cmp(&a_time)
            }
        }
    });
    
    Json(result)
}

/// 获取玩家详情
async fn get_player_detail(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<PlayerDetail>, axum::http::StatusCode> {
    match state.db.get_player_detail(&name).await {
        Ok(Some(detail)) => Ok(Json(detail)),
        Ok(None) => Err(axum::http::StatusCode::NOT_FOUND),
        Err(_) => Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// 获取玩家会话历史
async fn get_player_sessions(
    State(state): State<AppState>,
    Path(name): Path<String>,
    axum::extract::Query(query): axum::extract::Query<DaysQuery>,
) -> Json<serde_json::Value> {
    let days = query.days.clamp(1, 365);
    
    match state.db.get_player_history(&name, Some(days)).await {
        Ok(sessions) => {
            Json(serde_json::to_value(sessions).unwrap_or(serde_json::json!([])))
        }
        Err(_) => Json(serde_json::json!([])),
    }
}

/// 获取玩家热力图数据
async fn get_player_heatmap(
    State(state): State<AppState>,
    Path(name): Path<String>,
    axum::extract::Query(query): axum::extract::Query<DaysQuery>,
) -> Json<serde_json::Value> {
    let days = query.days.clamp(1, 365);
    
    match state.db.get_player_heatmap(&name, days).await {
        Ok(heatmap) => {
            Json(serde_json::to_value(heatmap).unwrap_or(serde_json::json!([])))
        }
        Err(_) => Json(serde_json::json!([])),
    }
}
