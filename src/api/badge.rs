use axum::{
    routing::get,
    Router,
    extract::{State, Path},
    response::Response,
};
use serde::Deserialize;

use super::AppState;
use crate::utils::{get_uptime_color, get_latency_color};

#[derive(Deserialize)]
struct HoursQuery {
    #[serde(default = "default_hours")]
    hours: u32,
}

fn default_hours() -> u32 { 24 }

#[derive(Deserialize)]
struct StatQuery {
    #[serde(default = "default_stat")]
    stat: String,
    #[serde(default = "default_hours")]
    hours: u32,
}

fn default_stat() -> String { "avg".to_string() }

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
        .route("/player/:name/current-session", get(badge_player_current_session))
        .route("/player/:name/period-playtime", get(badge_player_period_playtime))
        .route("/player/:name/live", get(badge_player_live))
}

fn generate_badge(label: &str, value: &str, color: &str) -> String {
    let label_width = label.len() * 7 + 10;
    let value_width = value.len() * 7 + 10;
    let total_width = label_width + value_width;

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="20">
            <rect width="{}" height="20" rx="3" fill="#555"/>
            <rect x="{}" width="{}" height="20" rx="3" fill="{}"/>
            <text x="{}" y="14" fill="#fff" font-family="Verdana,sans-serif" font-size="11" text-anchor="middle">{}</text>
            <text x="{}" y="14" fill="#fff" font-family="Verdana,sans-serif" font-size="11" text-anchor="middle">{}</text>
        </svg>"##,
        total_width,
        label_width,
        label_width,
        value_width,
        color,
        label_width / 2,
        label,
        label_width + value_width / 2,
        value
    )
}

fn svg_response(svg: String) -> Response {
    Response::builder()
        .header("Content-Type", "image/svg+xml")
        .header("Cache-Control", "no-cache")
        .body(svg.into())
        .unwrap()
}

async fn badge_server_status(State(state): State<AppState>) -> Response {
    let latest_status = state.db.get_all_latest_status().await.ok();

    let (status_text, color) = if let Some(statuses) = latest_status {
        let online_count = statuses.iter().filter(|s| s.online).count();
        let total = statuses.len();

        if online_count == total && total > 0 {
            ("online", "green")
        } else if online_count > 0 {
            ("partial", "yellow")
        } else {
            ("offline", "red")
        }
    } else {
        ("unknown", "gray")
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
        let mut total_checks = 0u32;
        let mut online_checks = 0u32;

        for logs in history.values() {
            total_checks += logs.len() as u32;
            online_checks += logs.iter().filter(|l| l.online).count() as u32;
        }

        if total_checks > 0 {
            let rate = (online_checks as f64 / total_checks as f64) * 100.0;
            format!("{:.1}%", rate)
        } else {
            "N/A".to_string()
        }
    } else {
        "N/A".to_string()
    };

    let uptime_value = uptime_text.trim_end_matches('%').parse::<f64>().unwrap_or(0.0);
    let color = get_uptime_color(uptime_value);

    svg_response(generate_badge("uptime", &uptime_text, color))
}

async fn badge_server_players(State(state): State<AppState>) -> Response {
    let latest_status = state.db.get_all_latest_status().await.ok();

    let players_text = if let Some(statuses) = latest_status {
        let online: u32 = statuses.iter()
            .filter_map(|s| s.players_online.map(|n| n as u32))
            .sum();
        let max: u32 = statuses.iter()
            .filter_map(|s| s.players_max.map(|n| n as u32))
            .sum();

        format!("{}/{}", online, max)
    } else {
        "N/A".to_string()
    };

    svg_response(generate_badge("players", &players_text, "blue"))
}

async fn badge_node_status(State(state): State<AppState>, Path(id): Path<i32>) -> Response {
    let latest_status = state.db.get_server_latest_status(id).await.ok().flatten();

    let (status_text, color) = if let Some(status) = latest_status {
        if status.online { ("online", "green") } else { ("offline", "red") }
    } else {
        ("unknown", "gray")
    };

    svg_response(generate_badge("status", status_text, color))
}

async fn badge_node_uptime(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Response {
    let hours = query.hours.clamp(1, 720);
    let start = chrono::Utc::now() - chrono::Duration::hours(hours as i64);
    let end = chrono::Utc::now();

    let history = state.db.get_server_history_range(id, start, end).await.ok();

    let uptime_text = if let Some(logs) = history {
        let total = logs.len() as u32;
        let online = logs.iter().filter(|l| l.online).count() as u32;
        if total > 0 {
            let rate = (online as f64 / total as f64) * 100.0;
            format!("{:.1}%", rate)
        } else {
            "N/A".to_string()
        }
    } else {
        "N/A".to_string()
    };

    let uptime_value = uptime_text.trim_end_matches('%').parse::<f64>().unwrap_or(0.0);
    let color = get_uptime_color(uptime_value);

    svg_response(generate_badge("uptime", &uptime_text, color))
}

async fn badge_node_latency(State(state): State<AppState>, Path(id): Path<i32>) -> Response {
    let latest_status = state.db.get_server_latest_status(id).await.ok().flatten();

    let (latency_text, color): (String, String) = if let Some(status) = latest_status {
        if status.online {
            if let Some(lat) = status.latency {
                (format!("{}ms", lat.round() as u32), get_latency_color(lat).to_string())
            } else {
                ("N/A".to_string(), "gray".to_string())
            }
        } else {
            ("offline".to_string(), "red".to_string())
        }
    } else {
        ("unknown".to_string(), "gray".to_string())
    };

    svg_response(generate_badge("latency", &latency_text, &color))
}

async fn badge_node_latency_stats(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    axum::extract::Query(query): axum::extract::Query<StatQuery>,
) -> Response {
    let hours = query.hours.clamp(1, 720);
    let start = chrono::Utc::now() - chrono::Duration::hours(hours as i64);
    let end = chrono::Utc::now();

    let history = state.db.get_server_history_range(id, start, end).await.unwrap_or_default();
    let stats = crate::utils::calculate_latency_stats(&history);

    let (label, value, color) = match query.stat.as_str() {
        "avg" => {
            let v = stats.avg_latency.unwrap_or(0.0);
            ("avg latency".to_string(), format!("{}ms", v.round() as u32), get_latency_color(v).to_string())
        }
        "min" => {
            let v = stats.min_latency.unwrap_or(0.0);
            ("min latency".to_string(), format!("{}ms", v.round() as u32), get_latency_color(v).to_string())
        }
        "max" => {
            let v = stats.max_latency.unwrap_or(0.0);
            ("max latency".to_string(), format!("{}ms", v.round() as u32), get_latency_color(v).to_string())
        }
        "std" => {
            let v = stats.std_dev.unwrap_or(0.0);
            ("std dev".to_string(), format!("{}ms", v.round() as u32), "blue".to_string())
        }
        "cv" => {
            let v = stats.cv.unwrap_or(0.0);
            ("cv".to_string(), format!("{:.1}%", v), "blue".to_string())
        }
        "p95" => {
            let v = stats.p95_latency.unwrap_or(0.0);
            ("p95".to_string(), format!("{}ms", v.round() as u32), get_latency_color(v).to_string())
        }
        _ => {
            let v = stats.avg_latency.unwrap_or(0.0);
            ("avg latency".to_string(), format!("{}ms", v.round() as u32), get_latency_color(v).to_string())
        }
    };

    svg_response(generate_badge(&label, &value, &color))
}

async fn badge_node_players(State(state): State<AppState>, Path(id): Path<i32>) -> Response {
    let latest_status = state.db.get_server_latest_status(id).await.ok().flatten();

    let players_text = if let Some(status) = latest_status {
        let online = status.players_online.map(|n| n as u32).unwrap_or(0);
        let max = status.players_max.map(|n| n as u32).unwrap_or(0);
        format!("{}/{}", online, max)
    } else {
        "N/A".to_string()
    };

    svg_response(generate_badge("players", &players_text, "blue"))
}

async fn badge_player_status(State(state): State<AppState>, Path(name): Path<String>) -> Response {
    let detail = state.db.get_player_detail(&name).await.ok().flatten();

    let (status_text, color) = if let Some(d) = detail {
        if d.online { ("online", "green") } else { ("offline", "red") }
    } else {
        ("unknown", "gray")
    };

    svg_response(generate_badge("status", status_text, color))
}

async fn badge_player_current_session(State(state): State<AppState>, Path(name): Path<String>) -> Response {
    let detail = state.db.get_player_detail(&name).await.ok().flatten();

    let (text, color) = if let Some(d) = detail {
        if d.online {
            if let Some(secs) = d.duration_seconds {
                let hours = secs / 3600;
                let minutes = (secs % 3600) / 60;
                if hours > 0 {
                    (format!("{}h {}m", hours, minutes), "green".to_string())
                } else {
                    (format!("{}m", minutes), "green".to_string())
                }
            } else {
                ("online".to_string(), "green".to_string())
            }
        } else {
            ("offline".to_string(), "red".to_string())
        }
    } else {
        ("unknown".to_string(), "gray".to_string())
    };

    svg_response(generate_badge("session", &text, &color))
}

async fn badge_player_period_playtime(
    State(state): State<AppState>,
    Path(name): Path<String>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Response {
    let hours = query.hours.clamp(1, 720);
    let days = (hours + 23) / 24;
    let history = state.db.get_player_history(&name, Some(days)).await.unwrap_or_default();

    let cutoff = chrono::Utc::now() - chrono::Duration::hours(hours as i64);
    let mut total_secs = 0i64;

    for h in &history {
        if h.session_end <= h.session_start {
            continue;
        }
        let start = if h.session_start < cutoff { cutoff } else { h.session_start };
        let dur = (h.session_end - start).num_seconds();
        if dur > 0 {
            total_secs += dur;
        }
    }

    let text = if total_secs <= 0 {
        "0m".to_string()
    } else {
        let h = total_secs / 3600;
        let m = (total_secs % 3600) / 60;
        if h > 0 { format!("{}h {}m", h, m) } else { format!("{}m", m) }
    };

    svg_response(generate_badge("playtime", &text, "blue"))
}

async fn badge_player_live(State(state): State<AppState>, Path(name): Path<String>) -> Response {
    let detail = state.db.get_player_detail(&name).await.ok().flatten();

    let (text, color) = if let Some(d) = detail {
        if d.online {
            let server_names: Vec<String> = d.servers.iter()
                .filter(|s| s.online)
                .map(|s| s.server_name.clone())
                .collect();
            if server_names.is_empty() {
                ("online".to_string(), "green".to_string())
            } else {
                (server_names.join(", "), "green".to_string())
            }
        } else {
            let ago = if d.last_seen.timestamp() > 0 {
                let diff = chrono::Utc::now() - d.last_seen;
                let mins = diff.num_minutes();
                if mins < 60 { format!("{}m ago", mins) }
                else if mins < 1440 { format!("{}h ago", mins / 60) }
                else { format!("{}d ago", mins / 1440) }
            } else {
                "offline".to_string()
            };
            (ago, "red".to_string())
        }
    } else {
        ("unknown".to_string(), "gray".to_string())
    };

    svg_response(generate_badge("live", &text, &color))
}
