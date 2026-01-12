use axum::{Router, routing::get, response::{IntoResponse, Response}, http::{StatusCode, header}, extract::{Path, State}};
use std::sync::Arc;
use crate::AppState;
use badge::{Badge, BadgeOptions};

pub fn create_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/status", get(badge_status))
        .route("/status/:id", get(badge_status_by_id))
        .route("/players", get(badge_players))
        .route("/players/:id", get(badge_players_by_id))
        .route("/latency", get(badge_latency))
        .route("/latency/:id", get(badge_latency_by_id))
        .route("/uptime", get(badge_uptime))
        .route("/uptime/:id", get(badge_uptime_by_id))
        .with_state(state)
}

/// 聚合状态badge
async fn badge_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.db.get_all_servers().await {
        Ok(servers) => {
            let mut online_count = 0;
            for server in &servers {
                if let Ok(Some(status)) = state.db.get_server_latest_status(server.id).await {
                    if status.online {
                        online_count += 1;
                    }
                }
            }
            
            let (color, text) = if online_count == servers.len() {
                ("brightgreen", "online")
            } else if online_count > 0 {
                ("yellow", "partial")
            } else {
                ("red", "offline")
            };

            create_badge("status", text, color)
        }
        Err(_) => create_badge("status", "error", "red"),
    }
}

/// 单节点状态badge
async fn badge_status_by_id(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> impl IntoResponse {
    match state.db.get_server_latest_status(id).await {
        Ok(Some(status)) => {
            let (color, text) = if status.online {
                ("brightgreen", "online")
            } else {
                ("red", "offline")
            };
            create_badge("status", text, color)
        }
        Ok(None) => create_badge("status", "unknown", "lightgrey"),
        Err(_) => create_badge("status", "error", "red"),
    }
}

/// 聚合玩家数badge
async fn badge_players(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.db.get_all_servers().await {
        Ok(servers) => {
            let mut total_players = 0;
            let mut total_max = 0;
            
            for server in servers {
                if let Ok(Some(status)) = state.db.get_server_latest_status(server.id).await {
                    if let Some(players) = status.players_online {
                        total_players += players;
                    }
                    if let Some(max) = status.players_max {
                        total_max += max;
                    }
                }
            }
            
            let text = if total_max > 0 {
                format!("{}/{}", total_players, total_max)
            } else {
                total_players.to_string()
            };
            
            create_badge("players", &text, "blue")
        }
        Err(_) => create_badge("players", "error", "red"),
    }
}

/// 单节点玩家数badge
async fn badge_players_by_id(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> impl IntoResponse {
    match state.db.get_server_latest_status(id).await {
        Ok(Some(status)) => {
            let text = match (status.players_online, status.players_max) {
                (Some(online), Some(max)) => format!("{}/{}", online, max),
                (Some(online), None) => online.to_string(),
                _ => "0".to_string(),
            };
            create_badge("players", &text, "blue")
        }
        Ok(None) => create_badge("players", "unknown", "lightgrey"),
        Err(_) => create_badge("players", "error", "red"),
    }
}

/// 聚合延迟badge
async fn badge_latency(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let limit = 86400 / state.config.poll_interval as i64;
    
    match state.db.get_all_servers().await {
        Ok(servers) => {
            let mut all_latencies = Vec::new();
            
            for server in servers {
                if let Ok(history) = state.db.get_server_history(server.id, limit).await {
                    for record in history {
                        if let Some(latency) = record.latency {
                            all_latencies.push(latency);
                        }
                    }
                }
            }
            
            if !all_latencies.is_empty() {
                let avg = all_latencies.iter().sum::<f64>() / all_latencies.len() as f64;
                let text = format!("{:.0}ms", avg);
                let color = if avg < 50.0 {
                    "brightgreen"
                } else if avg < 100.0 {
                    "green"
                } else if avg < 200.0 {
                    "yellow"
                } else {
                    "red"
                };
                create_badge("latency", &text, color)
            } else {
                create_badge("latency", "n/a", "lightgrey")
            }
        }
        Err(_) => create_badge("latency", "error", "red"),
    }
}

/// 单节点延迟badge
async fn badge_latency_by_id(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> impl IntoResponse {
    match state.db.get_server_latest_status(id).await {
        Ok(Some(status)) => {
            if let Some(latency) = status.latency {
                let text = format!("{:.0}ms", latency);
                let color = if latency < 50.0 {
                    "brightgreen"
                } else if latency < 100.0 {
                    "green"
                } else if latency < 200.0 {
                    "yellow"
                } else {
                    "red"
                };
                create_badge("latency", &text, color)
            } else {
                create_badge("latency", "n/a", "lightgrey")
            }
        }
        Ok(None) => create_badge("latency", "unknown", "lightgrey"),
        Err(_) => create_badge("latency", "error", "red"),
    }
}

/// 聚合在线率badge
async fn badge_uptime(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let limit = 86400 / state.config.poll_interval as i64;
    
    match state.db.get_all_servers().await {
        Ok(servers) => {
            let mut all_rates = Vec::new();
            
            for server in servers {
                if let Ok(stats) = state.db.get_server_stats(server.id, limit).await {
                    all_rates.push(stats.online_rate);
                }
            }
            
            if !all_rates.is_empty() {
                let avg_rate = all_rates.iter().sum::<f64>() / all_rates.len() as f64;
                let text = format!("{:.1}%", avg_rate);
                let color = if avg_rate >= 99.0 {
                    "brightgreen"
                } else if avg_rate >= 95.0 {
                    "green"
                } else if avg_rate >= 90.0 {
                    "yellow"
                } else {
                    "red"
                };
                create_badge("uptime", &text, color)
            } else {
                create_badge("uptime", "n/a", "lightgrey")
            }
        }
        Err(_) => create_badge("uptime", "error", "red"),
    }
}

/// 单节点在线率badge
async fn badge_uptime_by_id(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> impl IntoResponse {
    let limit = 86400 / state.config.poll_interval as i64;
    
    match state.db.get_server_stats(id, limit).await {
        Ok(stats) => {
            let text = format!("{:.1}%", stats.online_rate);
            let color = if stats.online_rate >= 99.0 {
                "brightgreen"
            } else if stats.online_rate >= 95.0 {
                "green"
            } else if stats.online_rate >= 90.0 {
                "yellow"
            } else {
                "red"
            };
            create_badge("uptime", &text, color)
        }
        Err(_) => create_badge("uptime", "error", "red"),
    }
}

/// 创建SVG badge
fn create_badge(label: &str, value: &str, color: &str) -> Response {
    let options = BadgeOptions {
        subject: label.to_string(),
        status: value.to_string(),
        color: color.to_string(),
    };
    
    match Badge::new(options) {
        Ok(badge) => {
            let svg = badge.to_svg();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "image/svg+xml")
                .header(header::CACHE_CONTROL, "no-cache")
                .body(svg.into())
                .unwrap()
        }
        Err(_) => {
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body("Error generating badge".into())
                .unwrap()
        }
    }
}
