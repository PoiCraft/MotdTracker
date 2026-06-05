//! 服务器组公开 API

use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use std::collections::HashMap;

use super::AppState;
use crate::models::*;

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_groups))
        .route("/:id", get(get_group))
}

async fn list_groups(State(state): State<AppState>) -> Json<Vec<GroupWithStats>> {
    let groups = state.db.get_all_server_groups().await.unwrap_or_default();
    let all_servers = state.db.get_all_servers().await.unwrap_or_default();
    let all_nodes = state.db.get_all_nodes().await.unwrap_or_default();
    let latest_status = state.db.get_all_latest_status().await.unwrap_or_default();
    let latest_map: HashMap<&str, &StatusLog> = latest_status
        .iter()
        .map(|s| (s.node_id.as_str(), s))
        .collect();

    // 构建 server_id -> nodes 映射
    let mut server_nodes: HashMap<&str, Vec<&Node>> = HashMap::new();
    for n in &all_nodes {
        server_nodes
            .entry(n.server_id.as_str())
            .or_default()
            .push(n);
    }

    let result: Vec<GroupWithStats> = groups
        .into_iter()
        .map(|g| {
            let group_servers: Vec<&ServerEntity> = all_servers
                .iter()
                .filter(|s| s.group_id.as_deref() == Some(g.id.as_str()))
                .collect();

            let server_count = group_servers.len() as u32;
            let mut total_node_count = 0u32;
            let mut online_node_count = 0u32;
            let mut total_players_online = 0u32;

            for sv in &group_servers {
                let nodes = server_nodes
                    .get(sv.id.as_str())
                    .map(|v| v.as_slice())
                    .unwrap_or(&[]);
                total_node_count += nodes.len() as u32;
                for n in nodes {
                    if let Some(ls) = latest_map.get(n.id.as_str()) {
                        if ls.online {
                            online_node_count += 1;
                            total_players_online += ls.players_online.unwrap_or(0) as u32;
                        }
                    }
                }
            }

            GroupWithStats {
                group: g,
                server_count,
                online_node_count,
                total_node_count,
                total_players_online,
            }
        })
        .collect();

    Json(result)
}

async fn get_group(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    let group = state
        .db
        .get_server_group(&id)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;

    let all_servers = state.db.get_servers_by_group(&id).await.unwrap_or_default();
    let all_nodes = state.db.get_all_nodes().await.unwrap_or_default();
    let latest_status = state.db.get_all_latest_status().await.unwrap_or_default();
    let latest_map: HashMap<&str, &StatusLog> = latest_status
        .iter()
        .map(|s| (s.node_id.as_str(), s))
        .collect();

    let mut server_nodes: HashMap<&str, Vec<&Node>> = HashMap::new();
    for n in &all_nodes {
        server_nodes
            .entry(n.server_id.as_str())
            .or_default()
            .push(n);
    }

    let mut servers_with_stats: Vec<serde_json::Value> = Vec::new();
    for sv in &all_servers {
        let nodes: Vec<NodeWithStats> = server_nodes
            .get(sv.id.as_str())
            .map(|v| {
                v.iter()
                    .map(|n| {
                        let ls = latest_map.get(n.id.as_str());
                        NodeWithStats {
                            node: (*n).clone(),
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
                    .collect()
            })
            .unwrap_or_default();

        let online_count = nodes
            .iter()
            .filter(|n| n.latest_status.as_ref().map(|s| s.online).unwrap_or(false))
            .count() as u32;
        let total_players: u32 = nodes
            .iter()
            .filter_map(|n| {
                n.latest_status
                    .as_ref()
                    .and_then(|s| s.players_online.map(|p| p as u32))
            })
            .sum();
        let latencies: Vec<f64> = nodes
            .iter()
            .filter_map(|n| n.latest_status.as_ref().and_then(|s| s.latency))
            .collect();

        servers_with_stats.push(serde_json::json!({
            "id": sv.id, "name": sv.name, "group_id": sv.group_id, "sort_order": sv.sort_order,
            "node_count": nodes.len(), "online_node_count": online_count,
            "total_players_online": total_players, "avg_latency": if !latencies.is_empty() { Some(latencies.iter().sum::<f64>() / latencies.len() as f64) } else { None },
        }));
    }

    Ok(Json(serde_json::json!({
        "id": group.id, "name": group.name, "sort_order": group.sort_order,
        "servers": servers_with_stats,
    })))
}
