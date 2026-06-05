//! 服务器公开 API

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use std::collections::HashMap;

use super::AppState;
use crate::models::*;

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_servers))
        .route("/:id", get(get_server))
        .route("/:id/history", get(get_server_history))
}

#[derive(Deserialize)]
struct ServerQuery {
    group_id: Option<String>,
    hours: Option<u32>,
}

async fn list_servers(
    State(state): State<AppState>,
    Query(q): Query<ServerQuery>,
) -> Json<Vec<serde_json::Value>> {
    let all_servers = state.db.get_all_servers().await.unwrap_or_default();
    let all_nodes = state.db.get_all_nodes().await.unwrap_or_default();
    let latest_status = state.db.get_all_latest_status().await.unwrap_or_default();
    let latest_map: HashMap<&str, &StatusLog> = latest_status
        .iter()
        .map(|s| (s.node_id.as_str(), s))
        .collect();

    // 按 group_id 过滤
    let filtered: Vec<&ServerEntity> = if let Some(ref gid) = q.group_id {
        all_servers
            .iter()
            .filter(|s| s.group_id.as_deref() == Some(gid.as_str()))
            .collect()
    } else {
        all_servers.iter().collect()
    };

    // 构建 server_id -> nodes 映射
    let mut server_nodes: HashMap<&str, Vec<&Node>> = HashMap::new();
    for n in &all_nodes {
        server_nodes
            .entry(n.server_id.as_str())
            .or_default()
            .push(n);
    }

    let result: Vec<serde_json::Value> = filtered.iter().map(|sv| {
        let nodes = server_nodes.get(sv.id.as_str()).map(|v| v.as_slice()).unwrap_or(&[]);
        let online_count = nodes.iter().filter(|n| latest_map.get(n.id.as_str()).map(|s| s.online).unwrap_or(false)).count() as u32;
        let total_players: u32 = nodes.iter().filter_map(|n| latest_map.get(n.id.as_str()).and_then(|s| s.players_online.map(|p| p as u32))).sum();
        let total_players_max: u32 = nodes.iter().filter_map(|n| latest_map.get(n.id.as_str()).and_then(|s| s.players_max.map(|p| p as u32))).sum();
        let lats: Vec<f64> = nodes.iter().filter_map(|n| latest_map.get(n.id.as_str()).and_then(|s| s.latency)).collect();

        serde_json::json!({
            "id": sv.id, "group_id": sv.group_id, "name": sv.name, "sort_order": sv.sort_order,
            "aggregate": {
                "online": online_count > 0,
                "online_node_count": online_count,
                "total_node_count": nodes.len() as u32,
                "total_players_online": total_players,
                "total_players_max": total_players_max,
                "avg_latency": if !lats.is_empty() { Some(lats.iter().sum::<f64>() / lats.len() as f64) } else { None }
            }
        })
    }).collect();

    Json(result)
}

async fn get_server(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    let server = state
        .db
        .get_server(&id)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;

    let all_nodes = state.db.get_nodes_by_server(&id).await.unwrap_or_default();
    let latest_status = state.db.get_all_latest_status().await.unwrap_or_default();
    let latest_map: HashMap<&str, &StatusLog> = latest_status
        .iter()
        .map(|s| (s.node_id.as_str(), s))
        .collect();

    let nodes_with_stats: Vec<NodeWithStats> = all_nodes
        .iter()
        .map(|n| {
            let ls = latest_map.get(n.id.as_str());
            NodeWithStats {
                node: n.clone(),
                latest_status: ls.map(|s| NodeStatus {
                    timestamp: s.timestamp,
                    online: s.online,
                    latency: s.latency,
                    players_online: s.players_online,
                    players_max: s.players_max,
                    version: s.version.clone(),
                    motd: s.motd.clone(),
                }),
                latency_stats: None,
            }
        })
        .collect();

    let online_count = nodes_with_stats
        .iter()
        .filter(|n| n.latest_status.as_ref().map(|s| s.online).unwrap_or(false))
        .count() as u32;
    let total_players: u32 = nodes_with_stats
        .iter()
        .filter_map(|n| {
            n.latest_status
                .as_ref()
                .and_then(|s| s.players_online.map(|p| p as u32))
        })
        .sum();
    let total_players_max: u32 = nodes_with_stats
        .iter()
        .filter_map(|n| {
            n.latest_status
                .as_ref()
                .and_then(|s| s.players_max.map(|p| p as u32))
        })
        .sum();
    let lats: Vec<f64> = nodes_with_stats
        .iter()
        .filter_map(|n| n.latest_status.as_ref().and_then(|s| s.latency))
        .collect();

    Ok(Json(serde_json::json!({
        "id": server.id, "group_id": server.group_id, "name": server.name, "sort_order": server.sort_order,
        "nodes": nodes_with_stats,
        "aggregate": {
            "online": online_count > 0,
            "online_node_count": online_count,
            "total_node_count": nodes_with_stats.len() as u32,
            "total_players_online": total_players,
            "total_players_max": total_players_max,
            "avg_latency": if !lats.is_empty() { Some(lats.iter().sum::<f64>() / lats.len() as f64) } else { None }
        }
    })))
}

async fn get_server_history(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(q): Query<ServerQuery>,
) -> Result<Json<Vec<StatusLog>>, axum::http::StatusCode> {
    let hours = q.hours.unwrap_or(24).clamp(1, 720);
    state
        .db
        .get_server_history_for_group(&id, hours)
        .await
        .map(Json)
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)
}
