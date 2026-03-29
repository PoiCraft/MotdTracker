//! 节点 API

use axum::{
    routing::get,
    Router,
    extract::{State, Path},
    Json,
};
use serde::Deserialize;

use super::AppState;
use crate::models::{NodeWithStats, NodeStatus, LatencyStats, PlayerSession};
use crate::utils::calculate_latency_stats;

#[derive(Deserialize)]
struct HoursQuery {
    #[serde(default = "default_hours")]
    hours: u32,
}

fn default_hours() -> u32 { 12 }

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/:id", get(get_node))
        .route("/:id/history", get(get_node_history))
        .route("/:id/stats", get(get_node_stats))
        .route("/:id/players", get(get_node_players))
}

/// 获取单个节点详情
async fn get_node(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<NodeWithStats>, axum::http::StatusCode> {
    let server = state.db.get_server(id).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;
    
    let latest_status = state.db.get_server_latest_status(id).await
        .ok()
        .flatten()
        .map(|s| NodeStatus {
            timestamp: s.timestamp,
            online: s.online,
            latency: s.latency,
            players_online: s.players_online,
            players_max: s.players_max,
            version: s.version,
            motd: s.motd,
        });
    
    let history = state.db.get_server_history(id, 1000).await
        .unwrap_or_default();
    
    let latency_stats = if history.is_empty() {
        None
    } else {
        Some(calculate_latency_stats(&history))
    };
    
    let enabled = state.config.get_node(id)
        .map(|n| n.enable)
        .unwrap_or(true);
    
    Ok(Json(NodeWithStats {
        server,
        enabled,
        latest_status,
        latency_stats,
    }))
}

/// 获取节点历史
async fn get_node_history(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Json<serde_json::Value> {
    let hours = query.hours.clamp(1, 720);
    
    // 计算时间范围
    let start = chrono::Utc::now() - chrono::Duration::hours(hours as i64);
    let end = chrono::Utc::now();
    
    match state.db.get_server_history_range(id, start, end).await {
        Ok(history) => {
            Json(serde_json::to_value(history).unwrap_or(serde_json::json!([])))
        }
        Err(_) => Json(serde_json::json!([])),
    }
}

/// 获取节点统计
async fn get_node_stats(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Json<LatencyStats> {
    let history = match state.db.get_server_history(id, 1000).await {
        Ok(h) => h,
        Err(_) => return Json(LatencyStats::default()),
    };
    
    Json(calculate_latency_stats(&history))
}

/// 获取节点玩家
async fn get_node_players(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Json<Vec<PlayerSession>> {
    match state.db.get_all_player_sessions(id).await {
        Ok(players) => Json(players),
        Err(_) => Json(Vec::new()),
    }
}
