//! Badge 生成 API

use axum::{
    routing::get,
    Router,
    extract::{State, Path},
    response::Response,
};
use serde::Deserialize;

use super::AppState;
use crate::utils::get_uptime_color;

#[derive(Deserialize)]
struct HoursQuery {
    #[serde(default = "default_hours")]
    hours: u32,
}

fn default_hours() -> u32 { 24 }

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/server/status", get(badge_server_status))
        .route("/server/uptime", get(badge_server_uptime))
        .route("/server/players", get(badge_server_players))
        .route("/node/:id/status", get(badge_node_status))
        .route("/node/:id/uptime", get(badge_node_uptime))
        .route("/node/:id/players", get(badge_node_players))
}

/// 生成 SVG Badge
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

/// 服务器状态 Badge
async fn badge_server_status(
    State(state): State<AppState>,
) -> Response {
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
    
    let svg = generate_badge("status", status_text, color);
    Response::builder()
        .header("Content-Type", "image/svg+xml")
        .header("Cache-Control", "no-cache")
        .body(svg.into())
        .unwrap()
}

/// 服务器在线率 Badge
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
    
    let svg = generate_badge("uptime", &uptime_text, color);
    Response::builder()
        .header("Content-Type", "image/svg+xml")
        .header("Cache-Control", "no-cache")
        .body(svg.into())
        .unwrap()
}

/// 服务器玩家数 Badge
async fn badge_server_players(
    State(state): State<AppState>,
) -> Response {
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
    
    let svg = generate_badge("players", &players_text, "blue");
    Response::builder()
        .header("Content-Type", "image/svg+xml")
        .header("Cache-Control", "no-cache")
        .body(svg.into())
        .unwrap()
}

/// 节点状态 Badge
async fn badge_node_status(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Response {
    let latest_status = state.db.get_server_latest_status(id).await.ok().flatten();
    
    let (status_text, color) = if let Some(status) = latest_status {
        if status.online {
            ("online", "green")
        } else {
            ("offline", "red")
        }
    } else {
        ("unknown", "gray")
    };
    
    let svg = generate_badge("status", status_text, color);
    Response::builder()
        .header("Content-Type", "image/svg+xml")
        .header("Cache-Control", "no-cache")
        .body(svg.into())
        .unwrap()
}

/// 节点在线率 Badge
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
    
    let svg = generate_badge("uptime", &uptime_text, color);
    Response::builder()
        .header("Content-Type", "image/svg+xml")
        .header("Cache-Control", "no-cache")
        .body(svg.into())
        .unwrap()
}

/// 节点玩家数 Badge
async fn badge_node_players(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Response {
    let latest_status = state.db.get_server_latest_status(id).await.ok().flatten();
    
    let players_text = if let Some(status) = latest_status {
        let online = status.players_online.map(|n| n as u32).unwrap_or(0);
        let max = status.players_max.map(|n| n as u32).unwrap_or(0);
        format!("{}/{}", online, max)
    } else {
        "N/A".to_string()
    };
    
    let svg = generate_badge("players", &players_text, "blue");
    Response::builder()
        .header("Content-Type", "image/svg+xml")
        .header("Cache-Control", "no-cache")
        .body(svg.into())
        .unwrap()
}
