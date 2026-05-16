use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use std::collections::HashMap;

use super::AppState;
use crate::models::{LatencyStats, NodeStatus, NodeWithStats};
use crate::utils::calculate_latency_stats;
use crate::utils::time::{format_gmt8_naive, now_gmt8};

#[derive(Deserialize)]
struct HoursQuery {
    #[serde(default = "default_hours")]
    hours: u32,
}

fn default_hours() -> u32 {
    12
}

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/server", get(get_web_server))
        .route("/server/head", get(get_web_server_head))
        .route("/node/:id", get(get_web_node))
        .route("/node/:id/head", get(get_web_node_head))
}

async fn build_unified_metrics_payload(
    state: &AppState,
    hours: u32,
) -> (
    serde_json::Map<String, serde_json::Value>,
    serde_json::Map<String, serde_json::Value>,
) {
    let mut history_map = serde_json::Map::new();
    let mut latest_map = serde_json::Map::new();

    for source in state
        .config
        .extra_data_sources
        .iter()
        .filter(|s| s.enabled && matches!(s.source_type, crate::config::ExtraDataSourceType::UnifiedMetrics))
    {
        let rows = state
            .db
            .get_unified_metrics_history(&source.name, hours)
            .await
            .unwrap_or_default();
        let latest = state
            .db
            .get_latest_unified_metrics(&source.name)
            .await
            .ok()
            .flatten();

        let compact = serde_json::json!({
            "timestamps": rows.iter().map(|r| format_gmt8_naive(r.timestamp)).collect::<Vec<_>>(),
            "tps": rows.iter().map(|r| r.tps).collect::<Vec<_>>(),
            "mspt": rows.iter().map(|r| r.mspt).collect::<Vec<_>>(),
            "uptime_seconds": rows.iter().map(|r| r.uptime_seconds).collect::<Vec<_>>(),
            "cpu_load": rows.iter().map(|r| r.cpu_load).collect::<Vec<_>>(),
            "memory_used_bytes": rows.iter().map(|r| r.memory_used_bytes).collect::<Vec<_>>(),
            "memory_total_bytes": rows.iter().map(|r| r.memory_total_bytes).collect::<Vec<_>>(),
            "memory_free_bytes": rows.iter().map(|r| r.memory_free_bytes).collect::<Vec<_>>(),
        });
        history_map.insert(source.name.clone(), compact);

        if let Some(r) = latest {
            latest_map.insert(
                source.name.clone(),
                serde_json::json!({
                    "timestamp": format_gmt8_naive(r.timestamp),
                    "tps": r.tps,
                    "mspt": r.mspt,
                    "uptime_seconds": r.uptime_seconds,
                    "cpu_load": r.cpu_load,
                    "memory_used_bytes": r.memory_used_bytes,
                    "memory_total_bytes": r.memory_total_bytes,
                    "memory_free_bytes": r.memory_free_bytes,
                }),
            );
        } else {
            latest_map.insert(source.name.clone(), serde_json::Value::Null);
        }
    }

    (history_map, latest_map)
}

async fn build_nodes_with_stats(
    state: &AppState,
    hours: u32,
) -> (
    Vec<NodeWithStats>,
    HashMap<i32, LatencyStats>,
    HashMap<i32, Vec<crate::models::StatusLog>>,
) {
    let servers = state.db.get_all_servers().await.unwrap_or_default();
    let history_map = state.db.get_all_history(hours).await.unwrap_or_default();
    let latest_status = state.db.get_all_latest_status().await.unwrap_or_default();

    let latest_map: HashMap<i32, crate::models::StatusLog> = latest_status
        .into_iter()
        .map(|s| (s.server_id, s))
        .collect();

    let mut stats_by_id: HashMap<i32, LatencyStats> = HashMap::new();
    for (id, logs) in &history_map {
        if !logs.is_empty() {
            stats_by_id.insert(*id, calculate_latency_stats(logs));
        }
    }

    let nodes: Vec<NodeWithStats> = servers
        .iter()
        .map(|server| {
            let latest = latest_map.get(&server.id);
            let enabled = state
                .config
                .get_node(server.id)
                .map(|n| n.enable)
                .unwrap_or(true);

            NodeWithStats {
                server: server.clone(),
                enabled,
                latest_status: latest.map(|s| NodeStatus {
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

    (nodes, stats_by_id, history_map)
}

fn build_aggregated_history(
    history_map: &HashMap<i32, Vec<crate::models::StatusLog>>,
    nodes: &[NodeWithStats],
) -> serde_json::Value {
    use std::collections::BTreeMap;

    let mut by_ts: BTreeMap<String, Vec<&crate::models::StatusLog>> = BTreeMap::new();

    for logs in history_map.values() {
        for log in logs {
            let ts = format_gmt8_naive(log.timestamp);
            by_ts.entry(ts).or_default().push(log);
        }
    }

    let mut timestamps = Vec::new();
    let mut online_list = Vec::new();
    let mut players_online_list = Vec::new();
    let mut players_max_list = Vec::new();
    let mut latencies: HashMap<String, Vec<Option<f64>>> = HashMap::new();

    for node in nodes {
        latencies.insert(node.server.name.clone(), Vec::new());
    }

    for (ts, records) in &by_ts {
        timestamps.push(ts.clone());
        let any_online = records.iter().any(|r| r.online);
        online_list.push(any_online);

        let rep = records.iter().find(|r| r.online).or(records.first());
        players_online_list.push(rep.and_then(|r| r.players_online));
        players_max_list.push(rep.and_then(|r| r.players_max));

        for node in nodes {
            let node_record = records.iter().find(|r| r.server_id == node.server.id);
            let latency_val = node_record.filter(|r| r.online).and_then(|r| r.latency);
            latencies
                .get_mut(&node.server.name)
                .unwrap()
                .push(latency_val);
        }
    }

    serde_json::json!({
        "timestamps": timestamps,
        "online": online_list,
        "players_online": players_online_list,
        "players_max": players_max_list,
        "latencies": latencies,
    })
}

fn build_status_timeline(
    history_map: &HashMap<i32, Vec<crate::models::StatusLog>>,
) -> serde_json::Value {
    use std::collections::BTreeMap;

    let mut by_ts: BTreeMap<String, Vec<bool>> = BTreeMap::new();

    for logs in history_map.values() {
        for log in logs {
            let ts = format_gmt8_naive(log.timestamp);
            by_ts.entry(ts).or_default().push(log.online);
        }
    }

    let mut timestamps = Vec::new();
    let mut online_list = Vec::new();

    for (ts, statuses) in &by_ts {
        timestamps.push(ts.clone());
        online_list.push(statuses.iter().any(|&s| s));
    }

    serde_json::json!({
        "timestamps": timestamps,
        "online": online_list,
    })
}

fn build_server_head(_state: &AppState, nodes: &[NodeWithStats]) -> serde_json::Value {
    let nodes_with_status: Vec<&NodeWithStats> =
        nodes.iter().filter(|n| n.latest_status.is_some()).collect();

    if nodes_with_status.is_empty() {
        return serde_json::json!({});
    }

    let online_nodes: Vec<&&NodeWithStats> = nodes_with_status
        .iter()
        .filter(|n| n.latest_status.as_ref().map(|s| s.online).unwrap_or(false))
        .collect();

    let selected = if !online_nodes.is_empty() {
        online_nodes[0]
    } else {
        nodes_with_status[0]
    };

    let selected_status = selected.latest_status.as_ref().unwrap();

    let latencies: HashMap<String, Option<f64>> = nodes_with_status
        .iter()
        .map(|n| {
            let lat = if n.latest_status.as_ref().map(|s| s.online).unwrap_or(false) {
                n.latest_status.as_ref().and_then(|s| s.latency)
            } else {
                None
            };
            (n.server.name.clone(), lat)
        })
        .collect();

    let online = nodes_with_status
        .iter()
        .any(|n| n.latest_status.as_ref().map(|s| s.online).unwrap_or(false));

    let nodes_json: Vec<serde_json::Value> = nodes_with_status
        .iter()
        .map(|n| {
            serde_json::json!({
                "id": n.server.id,
                "name": n.server.name,
                "latest_status": n.latest_status,
            })
        })
        .collect();

    serde_json::json!({
        "timestamp": format_gmt8_naive(selected_status.timestamp),
        "online": online,
        "players_online": selected_status.players_online,
        "players_max": selected_status.players_max,
        "latencies": latencies,
        "version": selected_status.version,
        "motd": selected_status.motd,
        "nodes": nodes_json,
    })
}

async fn get_online_players_aggregated(state: &AppState) -> Vec<serde_json::Value> {
    let servers = state.db.get_all_servers().await.unwrap_or_default();
    let mut aggregated: HashMap<String, serde_json::Value> = HashMap::new();

    for server in &servers {
        let sessions = state
            .db
            .get_all_player_sessions(server.id)
            .await
            .unwrap_or_default();
        for s in &sessions {
            if !s.online {
                continue;
            }
            let name = s.player_name.clone();
            let start_iso = s.session_start.map(format_gmt8_naive);
            let last_iso = format_gmt8_naive(s.last_seen);
            let first_iso = format_gmt8_naive(s.first_seen);

            if !aggregated.contains_key(&name) {
                aggregated.insert(
                    name.clone(),
                    serde_json::json!({
                        "player_name": name,
                        "online": true,
                        "first_seen": first_iso,
                        "session_start": start_iso,
                        "last_seen": last_iso,
                        "duration_seconds": s.duration_seconds,
                    }),
                );
            } else {
                let entry = aggregated.get_mut(&name).unwrap();
                if let Some(existing_last) = entry.get("last_seen").and_then(|v| v.as_str()) {
                    if last_iso.as_str() > existing_last {
                        entry["last_seen"] = serde_json::json!(last_iso);
                    }
                }
                if let Some(start) = &start_iso {
                    if entry
                        .get("session_start")
                        .and_then(|v| v.as_str())
                        .is_none()
                    {
                        entry["session_start"] = serde_json::json!(start);
                    }
                }
                if let Some(dur) = s.duration_seconds {
                    let existing_dur = entry.get("duration_seconds").and_then(|v| v.as_i64());
                    if existing_dur.is_none() || Some(dur) > existing_dur {
                        entry["duration_seconds"] = serde_json::json!(dur);
                    }
                }
            }
        }
    }

    let mut result: Vec<serde_json::Value> = aggregated.into_values().collect();
    result.sort_by(|a, b| {
        let a_name = a.get("player_name").and_then(|v| v.as_str()).unwrap_or("");
        let b_name = b.get("player_name").and_then(|v| v.as_str()).unwrap_or("");
        a_name.to_lowercase().cmp(&b_name.to_lowercase())
    });

    result
}

async fn get_web_server(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Json<serde_json::Value> {
    let hours = query.hours.clamp(1, 720);

    let (nodes, stats_by_id, history_map) = build_nodes_with_stats(&state, hours).await;

    let history = build_aggregated_history(&history_map, &nodes);
    let status_timeline = build_status_timeline(&history_map);
    let head = build_server_head(&state, &nodes);
    let players = get_online_players_aggregated(&state).await;
    let (unified_metrics_history, unified_metrics_latest) =
        build_unified_metrics_payload(&state, hours).await;

    Json(serde_json::json!({
        "nodes": nodes,
        "stats_by_id": stats_by_id,
        "history": history,
        "uptime": {},
        "status_timeline": status_timeline,
        "players": players,
        "head": head,
        "unified_metrics": {
            "history": unified_metrics_history,
            "latest": unified_metrics_latest,
        },
        "config": {
            "poll_interval": state.config.poll_interval,
            "server_name": state.config.server_name,
        }
    }))
}

async fn get_web_server_head(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Json<serde_json::Value> {
    let hours = query.hours.clamp(1, 720);

    let (nodes, stats_by_id, history_map) = build_nodes_with_stats(&state, hours).await;

    let history = build_aggregated_history(&history_map, &nodes);
    let status_timeline = build_status_timeline(&history_map);
    let head = build_server_head(&state, &nodes);
    let players = get_online_players_aggregated(&state).await;
    let (_unified_metrics_history, unified_metrics_latest) =
        build_unified_metrics_payload(&state, hours).await;

    let latest_history_point = if let (Some(ts_arr), Some(online_arr)) = (
        history.get("timestamps").and_then(|v| v.as_array()),
        history.get("online").and_then(|v| v.as_array()),
    ) {
        if let Some(last_ts) = ts_arr.last() {
            let idx = ts_arr.len() - 1;
            let latencies = history
                .get("latencies")
                .and_then(|v| v.as_object())
                .map(|obj| {
                    obj.iter()
                        .map(|(k, v)| {
                            let val = v.as_array().and_then(|arr| arr.get(idx)).cloned();
                            (k.clone(), val.unwrap_or(serde_json::Value::Null))
                        })
                        .collect::<serde_json::Map<String, serde_json::Value>>()
                })
                .unwrap_or_default();

            Some(serde_json::json!({
                "timestamp": last_ts,
                "online": online_arr.get(idx).and_then(|v| v.as_bool()).unwrap_or(false),
                "players_online": history.get("players_online").and_then(|v| v.as_array()).and_then(|a| a.get(idx)).cloned().unwrap_or(serde_json::Value::Null),
                "players_max": history.get("players_max").and_then(|v| v.as_array()).and_then(|a| a.get(idx)).cloned().unwrap_or(serde_json::Value::Null),
                "latencies": latencies,
            }))
        } else {
            None
        }
    } else {
        None
    };

    let mut latest_unified_points = serde_json::Map::new();
    for (source, value) in &unified_metrics_latest {
        latest_unified_points.insert(source.clone(), value.clone());
    }

    Json(serde_json::json!({
        "nodes": nodes,
        "stats_by_id": stats_by_id,
        "latest_history_point": latest_history_point,
        "latest_unified_points": latest_unified_points,
        "uptime": {},
        "status_timeline": status_timeline,
        "players": players,
        "head": head,
        "unified_metrics": {
            "latest": unified_metrics_latest,
        },
        "config": {
            "poll_interval": state.config.poll_interval,
            "server_name": state.config.server_name,
        }
    }))
}

async fn get_web_node(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Json<serde_json::Value> {
    let hours = query.hours.clamp(1, 720);

    let server = match state.db.get_server(id).await {
        Ok(Some(s)) => s,
        _ => return Json(serde_json::json!({})),
    };

    let latest_status = state.db.get_server_latest_status(id).await.ok().flatten();
    let history_raw = state
        .db
        .get_server_history_range(
            id,
            now_gmt8() - chrono::Duration::hours(hours as i64),
            now_gmt8(),
        )
        .await
        .unwrap_or_default();

    let mut sorted_history = history_raw;
    sorted_history.sort_by_key(|a| a.timestamp);

    let stats = if !sorted_history.is_empty() {
        Some(calculate_latency_stats(&sorted_history))
    } else {
        None
    };

    let compact = serde_json::json!({
        "timestamps": sorted_history.iter().map(|h| format_gmt8_naive(h.timestamp)).collect::<Vec<_>>(),
        "online": sorted_history.iter().map(|h| h.online).collect::<Vec<_>>(),
        "latency": sorted_history.iter().map(|h| h.latency).collect::<Vec<_>>(),
        "players_online": sorted_history.iter().map(|h| h.players_online).collect::<Vec<_>>(),
        "players_max": sorted_history.iter().map(|h| h.players_max).collect::<Vec<_>>(),
    });

    let status_timeline = serde_json::json!({
        "timestamps": sorted_history.iter().map(|h| format_gmt8_naive(h.timestamp)).collect::<Vec<_>>(),
        "online": sorted_history.iter().map(|h| h.online).collect::<Vec<_>>(),
    });

    Json(serde_json::json!({
        "server": {
            "id": server.id,
            "name": server.name,
            "host": server.host,
            "port": server.port,
            "color": server.color,
            "latest_status": latest_status,
        },
        "history": compact,
        "stats": stats,
        "status_timeline": status_timeline,
        "config": {
            "poll_interval": state.config.poll_interval,
        }
    }))
}

async fn get_web_node_head(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Json<serde_json::Value> {
    let hours = query.hours.clamp(1, 720);

    let server = match state.db.get_server(id).await {
        Ok(Some(s)) => s,
        _ => return Json(serde_json::json!({})),
    };

    let latest_status = state.db.get_server_latest_status(id).await.ok().flatten();

    let history_raw = state
        .db
        .get_server_history_range(
            id,
            now_gmt8() - chrono::Duration::hours(hours as i64),
            now_gmt8(),
        )
        .await
        .unwrap_or_default();

    let mut sorted_history = history_raw;
    sorted_history.sort_by_key(|a| a.timestamp);

    let stats = if !sorted_history.is_empty() {
        Some(calculate_latency_stats(&sorted_history))
    } else {
        None
    };

    let latest_history_point = sorted_history.last().map(|h| {
        serde_json::json!({
            "timestamp": format_gmt8_naive(h.timestamp),
            "online": h.online,
            "latency": h.latency,
            "players_online": h.players_online,
            "players_max": h.players_max,
        })
    });

    let status_timeline = serde_json::json!({
        "timestamps": sorted_history.iter().map(|h| format_gmt8_naive(h.timestamp)).collect::<Vec<_>>(),
        "online": sorted_history.iter().map(|h| h.online).collect::<Vec<_>>(),
    });

    Json(serde_json::json!({
        "server": {
            "id": server.id,
            "name": server.name,
            "latest_status": latest_status,
        },
        "stats": stats,
        "latest_history_point": latest_history_point,
        "status_timeline": status_timeline,
        "config": {
            "poll_interval": state.config.poll_interval,
        }
    }))
}
