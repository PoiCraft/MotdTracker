use axum::{
    extract::{Path, State},
    response::Response,
    routing::get,
    Router,
};
use serde::Deserialize;

use super::AppState;
use crate::models::StatusLog;
use crate::utils::{calculate_latency_stats, get_latency_color, get_uptime_color, now_gmt8};

#[derive(Deserialize)]
struct HoursQuery {
    #[serde(default = "default_hours")]
    hours: u32,
}

fn default_hours() -> u32 {
    24
}

#[derive(Deserialize)]
struct StatQuery {
    #[serde(default = "default_stat")]
    stat: String,
    #[serde(default = "default_hours")]
    hours: u32,
}

fn default_stat() -> String {
    "avg".to_string()
}

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/server/status", get(badge_server_status))
        .route("/server/uptime", get(badge_server_uptime))
        .route("/server/players", get(badge_server_players))
        .route("/node/:id/status", get(badge_node_status))
        .route("/node/:id/uptime", get(badge_node_uptime))
        .route("/node/:id/latency", get(badge_node_latency))
        .route("/node/:id/latency-stats", get(badge_node_latency_stats))
        .route("/node/:id/players", get(badge_node_players))
        .route("/player/:name/status", get(badge_player_status))
        .route(
            "/player/:name/current-session",
            get(badge_player_current_session),
        )
        .route(
            "/player/:name/period-playtime",
            get(badge_player_period_playtime),
        )
        .route("/player/:name/live", get(badge_player_live))
}

mod render;

use render::{generate_badge, svg_response};

async fn badge_server_status(State(state): State<AppState>) -> Response {
    let latest_status = state.db.get_all_latest_status().await.ok();

    let (status_text, color) = if let Some(statuses) = latest_status {
        let online_count = statuses.iter().filter(|s| s.online).count();
        let total = statuses.len();

        if online_count == total && total > 0 {
            ("online", "#4c1")
        } else if online_count > 0 {
            ("partial", "#dfb317")
        } else {
            ("offline", "#e05d44")
        }
    } else {
        ("unknown", "#9f9f9f")
    };

    svg_response(generate_badge("status", status_text, color))
}

async fn badge_server_uptime(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Response {
    let hours = query.hours.clamp(1, 720);
    let history = state.db.get_all_history(hours).await.ok();

    let uptime_text = if let Some(history) = history {
        let logs: Vec<StatusLog> = history.into_values().flatten().collect();
        if logs.is_empty() {
            "N/A".to_string()
        } else {
            format!("{:.1}%", calculate_latency_stats(&logs).uptime_percentage)
        }
    } else {
        "N/A".to_string()
    };

    let uptime_value = uptime_text
        .trim_end_matches('%')
        .parse::<f64>()
        .unwrap_or(0.0);
    let color = get_uptime_color(uptime_value);

    svg_response(generate_badge("uptime", &uptime_text, color))
}

async fn badge_server_players(State(state): State<AppState>) -> Response {
    let latest_status = state.db.get_all_latest_status().await.ok();

    let players_text = if let Some(statuses) = latest_status {
        let online: u32 = statuses
            .iter()
            .filter_map(|s| s.players_online.map(|n| n as u32))
            .sum();
        let max: u32 = statuses
            .iter()
            .filter_map(|s| s.players_max.map(|n| n as u32))
            .sum();

        format!("{}/{}", online, max)
    } else {
        "N/A".to_string()
    };

    svg_response(generate_badge("players", &players_text, "#007ec6"))
}

async fn badge_node_status(State(state): State<AppState>, Path(id): Path<String>) -> Response {
    let latest_status = state.db.get_node_latest_status(&id).await.ok().flatten();

    let (status_text, color) = if let Some(status) = latest_status {
        if status.online {
            ("online", "#4c1")
        } else {
            ("offline", "#e05d44")
        }
    } else {
        ("unknown", "#9f9f9f")
    };

    svg_response(generate_badge("status", status_text, color))
}

async fn badge_node_uptime(
    State(state): State<AppState>,
    Path(id): Path<String>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Response {
    let hours = query.hours.clamp(1, 720);
    let start = now_gmt8() - chrono::Duration::hours(hours as i64);
    let end = now_gmt8();

    let history = state.db.get_node_history_range(&id, start, end).await.ok();

    let uptime_text = if let Some(logs) = history {
        if logs.is_empty() {
            "N/A".to_string()
        } else {
            format!("{:.1}%", calculate_latency_stats(&logs).uptime_percentage)
        }
    } else {
        "N/A".to_string()
    };

    let uptime_value = uptime_text
        .trim_end_matches('%')
        .parse::<f64>()
        .unwrap_or(0.0);
    let color = get_uptime_color(uptime_value);

    svg_response(generate_badge("uptime", &uptime_text, color))
}

async fn badge_node_latency(State(state): State<AppState>, Path(id): Path<String>) -> Response {
    let latest_status = state.db.get_node_latest_status(&id).await.ok().flatten();

    let (latency_text, color) = if let Some(status) = latest_status {
        if status.online {
            if let Some(lat) = status.latency {
                (
                    format!("{}ms", lat.round() as u32),
                    get_latency_color(lat).to_string(),
                )
            } else {
                ("N/A".to_string(), "#9f9f9f".to_string())
            }
        } else {
            ("offline".to_string(), "#e05d44".to_string())
        }
    } else {
        ("unknown".to_string(), "#9f9f9f".to_string())
    };

    svg_response(generate_badge("latency", &latency_text, &color))
}

async fn badge_node_latency_stats(
    State(state): State<AppState>,
    Path(id): Path<String>,
    axum::extract::Query(query): axum::extract::Query<StatQuery>,
) -> Response {
    let hours = query.hours.clamp(1, 720);
    let start = now_gmt8() - chrono::Duration::hours(hours as i64);
    let end = now_gmt8();

    let history = state
        .db
        .get_node_history_range(&id, start, end)
        .await
        .unwrap_or_default();
    let stats = crate::utils::calculate_latency_stats(&history);

    let (label, value, color) = match query.stat.as_str() {
        "avg" => {
            let v = stats.avg_latency.unwrap_or(0.0);
            (
                "avg latency".to_string(),
                format!("{}ms", v.round() as u32),
                get_latency_color(v).to_string(),
            )
        }
        "min" => {
            let v = stats.min_latency.unwrap_or(0.0);
            (
                "min latency".to_string(),
                format!("{}ms", v.round() as u32),
                get_latency_color(v).to_string(),
            )
        }
        "max" => {
            let v = stats.max_latency.unwrap_or(0.0);
            (
                "max latency".to_string(),
                format!("{}ms", v.round() as u32),
                get_latency_color(v).to_string(),
            )
        }
        "std" => {
            let v = stats.std_dev.unwrap_or(0.0);
            (
                "std dev".to_string(),
                format!("{}ms", v.round() as u32),
                "#007ec6".to_string(),
            )
        }
        "cv" => {
            let v = stats.cv.unwrap_or(0.0);
            (
                "cv".to_string(),
                format!("{:.1}%", v),
                "#007ec6".to_string(),
            )
        }
        "p95" => {
            let v = stats.p95_latency.unwrap_or(0.0);
            (
                "p95".to_string(),
                format!("{}ms", v.round() as u32),
                get_latency_color(v).to_string(),
            )
        }
        _ => {
            let v = stats.avg_latency.unwrap_or(0.0);
            (
                "avg latency".to_string(),
                format!("{}ms", v.round() as u32),
                get_latency_color(v).to_string(),
            )
        }
    };

    svg_response(generate_badge(&label, &value, &color))
}

async fn badge_node_players(State(state): State<AppState>, Path(id): Path<String>) -> Response {
    let latest_status = state.db.get_node_latest_status(&id).await.ok().flatten();

    let players_text = if let Some(status) = latest_status {
        let online = status.players_online.map(|n| n as u32).unwrap_or(0);
        let max = status.players_max.map(|n| n as u32).unwrap_or(0);
        format!("{}/{}", online, max)
    } else {
        "N/A".to_string()
    };

    svg_response(generate_badge("players", &players_text, "#007ec6"))
}

async fn badge_player_status(State(state): State<AppState>, Path(name): Path<String>) -> Response {
    let detail = state.db.get_player_detail(&name).await.ok().flatten();

    let (status_text, color) = if let Some(d) = detail {
        if d.online {
            ("online", "#4c1")
        } else {
            ("offline", "#e05d44")
        }
    } else {
        ("unknown", "#9f9f9f")
    };

    svg_response(generate_badge("status", status_text, color))
}

async fn badge_player_current_session(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Response {
    let detail = state.db.get_player_detail(&name).await.ok().flatten();

    let (text, color) = if let Some(d) = detail {
        if d.online {
            if let Some(secs) = d.duration_seconds {
                let hours = secs / 3600;
                let minutes = (secs % 3600) / 60;
                if hours > 0 {
                    (format!("{}h {}m", hours, minutes), "#4c1".to_string())
                } else {
                    (format!("{}m", minutes), "#4c1".to_string())
                }
            } else {
                ("online".to_string(), "#4c1".to_string())
            }
        } else {
            ("offline".to_string(), "#e05d44".to_string())
        }
    } else {
        ("unknown".to_string(), "#9f9f9f".to_string())
    };

    svg_response(generate_badge("session", &text, &color))
}

async fn badge_player_period_playtime(
    State(state): State<AppState>,
    Path(name): Path<String>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Response {
    let hours = query.hours.clamp(1, 720);
    let days = hours.div_ceil(24);
    let history = state
        .db
        .get_player_history(&name, Some(days))
        .await
        .unwrap_or_default();

    let cutoff = now_gmt8() - chrono::Duration::hours(hours as i64);
    let mut total_secs = 0i64;

    for h in &history {
        if *h.session_end <= *h.session_start {
            continue;
        }
        let start = if *h.session_start < cutoff {
            cutoff
        } else {
            *h.session_start
        };
        let dur = (*h.session_end - start).num_seconds();
        if dur > 0 {
            total_secs += dur;
        }
    }

    let text = if total_secs <= 0 {
        "0m".to_string()
    } else {
        let h = total_secs / 3600;
        let m = (total_secs % 3600) / 60;
        if h > 0 {
            format!("{}h {}m", h, m)
        } else {
            format!("{}m", m)
        }
    };

    svg_response(generate_badge("playtime", &text, "#007ec6"))
}

async fn badge_player_live(State(state): State<AppState>, Path(name): Path<String>) -> Response {
    let detail = state.db.get_player_detail(&name).await.ok().flatten();

    let (text, color) = if let Some(d) = detail {
        if d.online {
            let server_names: Vec<String> = d
                .servers
                .iter()
                .filter(|s| s.online)
                .map(|s| s.server_name.clone())
                .collect();
            if server_names.is_empty() {
                ("online".to_string(), "#4c1".to_string())
            } else {
                // 截断到前 5 个服务器名，避免 badge 过宽
                let display = if server_names.len() > 5 {
                    format!(
                        "{} +{}",
                        server_names[..5].join(", "),
                        server_names.len() - 5
                    )
                } else {
                    server_names.join(", ")
                };
                (display, "#4c1".to_string())
            }
        } else {
            let ago = if d.last_seen.timestamp() > 0 {
                let diff = now_gmt8() - d.last_seen;
                let mins = diff.num_minutes();
                if mins < 60 {
                    format!("{}m ago", mins)
                } else if mins < 1440 {
                    format!("{}h ago", mins / 60)
                } else {
                    format!("{}d ago", mins / 1440)
                }
            } else {
                "offline".to_string()
            };
            (ago, "#e05d44".to_string())
        }
    } else {
        ("unknown".to_string(), "#9f9f9f".to_string())
    };

    svg_response(generate_badge("live", &text, &color))
}
