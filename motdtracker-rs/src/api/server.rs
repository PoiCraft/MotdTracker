//! 服务器 API

use axum::{
    routing::get,
    Router,
    extract::State,
    Json,
};
use serde::Deserialize;
use std::collections::HashMap;

use super::AppState;
use crate::models::{NodeWithStats, ServerHead, NodeStatus, LatencyStats, StatusLog};
use crate::utils::calculate_latency_stats;

#[derive(Deserialize)]
struct HoursQuery {
    #[serde(default = "default_hours")]
    hours: u32,
}

fn default_hours() -> u32 { 12 }

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/nodes", get(get_nodes))
        .route("/head", get(get_server_head))
        .route("/history", get(get_server_history))
        .route("/history-compact", get(get_server_history_compact))
        .route("/stats", get(get_server_stats))
        .route("/uptime", get(get_server_uptime))
        .route("/status-timeline", get(get_status_timeline))
        .route("/players", get(get_server_players))
        .route("/config", get(get_server_config))
}

/// 获取所有节点及统计
async fn get_nodes(
    State(state): State<AppState>,
) -> Json<Vec<NodeWithStats>> {
    let servers = match state.db.get_all_servers().await {
        Ok(s) => s,
        Err(_) => return Json(Vec::new()),
    };
    
    let history = match state.db.get_all_history(24).await {
        Ok(h) => h,
        Err(_) => HashMap::new(),
    };
    
    let latest_status = match state.db.get_all_latest_status().await {
        Ok(s) => s,
        Err(_) => Vec::new(),
    };
    
    let latest_map: HashMap<i32, StatusLog> = latest_status
        .into_iter()
        .map(|s| (s.server_id, s))
        .collect();
    
    let result: Vec<NodeWithStats> = servers
        .into_iter()
        .map(|server| {
            let latest_status = latest_map.get(&server.id).map(|s| NodeStatus {
                timestamp: s.timestamp,
                online: s.online,
                latency: s.latency,
                players_online: s.players_online,
                players_max: s.players_max,
                version: s.version.clone(),
                motd: s.motd.clone(),
            });
            
            let latency_stats = history.get(&server.id)
                .map(|h| calculate_latency_stats(h));
            
            // 检查节点是否启用
            let enabled = state.config.get_node(server.id)
                .map(|n| n.enable)
                .unwrap_or(true);
            
            NodeWithStats {
                server,
                enabled,
                latest_status,
                latency_stats,
            }
        })
        .collect();
    
    Json(result)
}

/// 获取服务器聚合状态
async fn get_server_head(
    State(state): State<AppState>,
) -> Json<ServerHead> {
    let servers = match state.db.get_all_servers().await {
        Ok(s) => s,
        Err(_) => return Json(ServerHead {
            total_nodes: 0,
            online_nodes: 0,
            total_players_online: 0,
            total_players_max: 0,
            all_online: false,
            min_latency: None,
            max_latency: None,
            avg_latency: None,
        }),
    };
    
    let latest_status = match state.db.get_all_latest_status().await {
        Ok(s) => s,
        Err(_) => Vec::new(),
    };
    
    let total_nodes = servers.len() as u32;
    let online_nodes = latest_status.iter().filter(|s| s.online).count() as u32;
    let total_players_online: u32 = latest_status.iter()
        .filter_map(|s| s.players_online.map(|n| n as u32))
        .sum();
    let total_players_max: u32 = latest_status.iter()
        .filter_map(|s| s.players_max.map(|n| n as u32))
        .sum();
    
    let latencies: Vec<f64> = latest_status.iter()
        .filter_map(|s| s.latency)
        .collect();
    
    let avg_latency = if !latencies.is_empty() {
        Some(latencies.iter().sum::<f64>() / latencies.len() as f64)
    } else {
        None
    };
    
    Json(ServerHead {
        total_nodes,
        online_nodes,
        total_players_online,
        total_players_max,
        all_online: online_nodes == total_nodes && total_nodes > 0,
        min_latency: latencies.iter().cloned().fold(f64::INFINITY, f64::min).into(),
        max_latency: latencies.iter().cloned().fold(f64::NEG_INFINITY, f64::max).into(),
        avg_latency,
    })
}

/// 获取服务器历史数据
async fn get_server_history(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Json<HashMap<i32, Vec<StatusLog>>> {
    let hours = query.hours.clamp(1, 720);
    
    match state.db.get_all_history(hours).await {
        Ok(h) => Json(h),
        Err(_) => Json(HashMap::new()),
    }
}

/// 获取精简历史数据
async fn get_server_history_compact(
    State(_state): State<AppState>,
    axum::extract::Query(_query): axum::extract::Query<HoursQuery>,
) -> Json<serde_json::Value> {
    // 简化实现，返回聚合数据
    Json(serde_json::json!({ "message": "Not implemented yet" }))
}

/// 获取 24h 统计
async fn get_server_stats(
    State(state): State<AppState>,
) -> Json<HashMap<i32, LatencyStats>> {
    let history = match state.db.get_all_history(24).await {
        Ok(h) => h,
        Err(_) => return Json(HashMap::new()),
    };
    
    let stats: HashMap<i32, LatencyStats> = history
        .into_iter()
        .map(|(id, logs)| (id, calculate_latency_stats(&logs)))
        .collect();
    
    Json(stats)
}

/// 获取在线率
async fn get_server_uptime(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Json<serde_json::Value> {
    let hours = query.hours.clamp(1, 720);
    let history = match state.db.get_all_history(hours).await {
        Ok(h) => h,
        Err(_) => return Json(serde_json::json!({})),
    };
    
    let mut uptime_by_node = HashMap::new();
    
    for (id, logs) in history {
        let total = logs.len() as u32;
        let online = logs.iter().filter(|l| l.online).count() as u32;
        let uptime = if total > 0 {
            (online as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        uptime_by_node.insert(id, uptime);
    }
    
    Json(serde_json::to_value(uptime_by_node).unwrap_or(serde_json::json!({})))
}

/// 获取状态时间线
async fn get_status_timeline(
    State(_state): State<AppState>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "message": "Not implemented yet" }))
}

/// 获取在线玩家
async fn get_server_players(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    let players = match state.db.get_all_online_players().await {
        Ok(p) => p,
        Err(_) => return Json(serde_json::json!([])),
    };
    
    // 去重并格式化
    let mut seen = std::collections::HashSet::new();
    let result: Vec<serde_json::Value> = players
        .into_iter()
        .filter(|p| seen.insert(p.player_name.clone()))
        .map(|p| serde_json::json!({
            "player_name": p.player_name,
            "server_id": p.server_id,
            "online": p.online
        }))
        .collect();
    
    Json(serde_json::to_value(result).unwrap_or(serde_json::json!([])))
}

/// 获取服务器配置
async fn get_server_config(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "server_name": state.config.server_name,
        "poll_interval": state.config.poll_interval,
        "port": state.config.port,
        "node_count": state.config.nodes.len()
    }))
}
