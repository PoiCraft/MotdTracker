//! Web API（前端专用一体化接口）

use axum::{
    routing::get,
    Router,
    extract::{State, Path},
    Json,
};
use serde::Deserialize;
use std::collections::HashMap;

use super::AppState;
use crate::models::{NodeWithStats, LatencyStats};
use crate::utils::calculate_latency_stats;

#[derive(Deserialize)]
struct HoursQuery {
    #[serde(default = "default_hours")]
    hours: u32,
}

fn default_hours() -> u32 { 12 }

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/server", get(get_web_server))
        .route("/server/head", get(get_web_server_head))
        .route("/node/:id", get(get_web_node))
        .route("/node/:id/head", get(get_web_node_head))
}

/// 获取服务器页面完整数据
async fn get_web_server(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Json<serde_json::Value> {
    let hours = query.hours.clamp(1, 720);
    
    // 获取节点列表
    let servers = match state.db.get_all_servers().await {
        Ok(s) => s,
        Err(_) => return Json(serde_json::json!({})),
    };
    
    // 获取历史数据
    let history = match state.db.get_all_history(hours).await {
        Ok(h) => h,
        Err(_) => HashMap::new(),
    };
    
    // 获取最新状态
    let latest_status = match state.db.get_all_latest_status().await {
        Ok(s) => s,
        Err(_) => Vec::new(),
    };
    
    // 计算统计
    let mut stats_by_id: HashMap<i32, LatencyStats> = HashMap::new();
    for (id, logs) in &history {
        stats_by_id.insert(*id, calculate_latency_stats(logs));
    }
    
    // 构建节点数据
    let nodes: Vec<NodeWithStats> = servers
        .iter()
        .map(|server| {
            let latest = latest_status.iter().find(|s| s.server_id == server.id);
            let enabled = state.config.get_node(server.id)
                .map(|n| n.enable)
                .unwrap_or(true);
            
            NodeWithStats {
                server: server.clone(),
                enabled,
                latest_status: latest.map(|s| crate::models::NodeStatus {
                    timestamp: s.timestamp,
                    online: s.online,
                    latency: s.latency,
                    players_online: s.players_online,
                    players_max: s.players_max,
                    version: s.version.clone(),
                    motd: s.motd.clone(),
                }),
                latency_stats: stats_by_id.get(&server.id).cloned(),
            }
        })
        .collect();
    
    // 计算头部信息
    let online_nodes = nodes.iter().filter(|n| n.latest_status.as_ref().map(|s| s.online).unwrap_or(false)).count() as u32;
    let total_players: u32 = latest_status.iter()
        .filter_map(|s| s.players_online.map(|n| n as u32))
        .sum();
    
    // 计算在线率
    let mut uptime: HashMap<i32, f64> = HashMap::new();
    for (id, logs) in &history {
        let total = logs.len() as u32;
        let online = logs.iter().filter(|l| l.online).count() as u32;
        let rate = if total > 0 { (online as f64 / total as f64) * 100.0 } else { 0.0 };
        uptime.insert(*id, rate);
    }
    
    // 获取在线玩家
    let players = match state.db.get_all_online_players().await {
        Ok(p) => p,
        Err(_) => Vec::new(),
    };
    
    Json(serde_json::json!({
        "nodes": nodes,
        "stats_by_id": stats_by_id,
        "history": history,
        "uptime": uptime,
        "players": players,
        "head": {
            "total_nodes": nodes.len() as u32,
            "online_nodes": online_nodes,
            "total_players": total_players,
        },
        "config": {
            "poll_interval": state.config.poll_interval,
            "server_name": state.config.server_name,
        }
    }))
}

/// 获取服务器增量数据
async fn get_web_server_head(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Json<serde_json::Value> {
    let _hours = query.hours.clamp(1, 720);
    
    let latest_status = match state.db.get_all_latest_status().await {
        Ok(s) => s,
        Err(_) => return Json(serde_json::json!({})),
    };
    
    let total_nodes = latest_status.len() as u32;
    let online_nodes = latest_status.iter().filter(|s| s.online).count() as u32;
    let total_players: u32 = latest_status.iter()
        .filter_map(|s| s.players_online.map(|n| n as u32))
        .sum();
    
    Json(serde_json::json!({
        "total_nodes": total_nodes,
        "online_nodes": online_nodes,
        "total_players": total_players,
        "latest_status": latest_status,
    }))
}

/// 获取节点页面完整数据
async fn get_web_node(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Json<serde_json::Value> {
    let _hours = query.hours.clamp(1, 720);
    
    let server = match state.db.get_server(id).await {
        Ok(Some(s)) => s,
        _ => return Json(serde_json::json!({})),
    };
    
    let latest_status = state.db.get_server_latest_status(id).await.ok().flatten();
    let history = state.db.get_server_history(id, 1000).await.unwrap_or_default();
    let stats = calculate_latency_stats(&history);
    let players = state.db.get_all_player_sessions(id).await.unwrap_or_default();
    
    Json(serde_json::json!({
        "server": server,
        "latest_status": latest_status,
        "history": history,
        "stats": stats,
        "players": players,
    }))
}

/// 获取节点增量数据
async fn get_web_node_head(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Json<serde_json::Value> {
    let latest_status = match state.db.get_server_latest_status(id).await {
        Ok(Some(s)) => s,
        _ => return Json(serde_json::json!({})),
    };
    
    Json(serde_json::to_value(latest_status).unwrap_or(serde_json::json!({})))
}
