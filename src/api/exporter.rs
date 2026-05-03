//! Prometheus 指标导出 API

use axum::{extract::State, response::Response, routing::get, Router};
use std::collections::HashMap;

use super::AppState;
use crate::utils::calculate_latency_stats;

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/metrics", get(prometheus_metrics))
        .route("/health", get(health_check))
}

/// Prometheus 指标导出
async fn prometheus_metrics(State(state): State<AppState>) -> Response {
    let servers = match state.db.get_all_servers().await {
        Ok(s) => s,
        Err(_) => {
            return Response::builder()
                .status(500)
                .body("Database error".into())
                .unwrap()
        }
    };

    let latest_status = state.db.get_all_latest_status().await.unwrap_or_default();

    let history = state.db.get_all_history(24).await.unwrap_or_default();

    let online_players = state.db.get_all_online_players().await.unwrap_or_default();

    let mut metrics = String::new();

    // 节点指标
    metrics.push_str("# HELP motd_node_online Node online status\n");
    metrics.push_str("# TYPE motd_node_online gauge\n");

    for status in &latest_status {
        if let Some(server) = servers.iter().find(|s| s.id == status.server_id) {
            let value = if status.online { 1 } else { 0 };
            metrics.push_str(&format!(
                "motd_node_online{{server_id=\"{}\",node_name=\"{}\",host=\"{}\",port=\"{}\"}} {}\n",
                server.id, server.name, server.host, server.port, value
            ));
        }
    }

    metrics.push_str("\n# HELP motd_node_players_online Online players count\n");
    metrics.push_str("# TYPE motd_node_players_online gauge\n");

    for status in &latest_status {
        if let Some(server) = servers.iter().find(|s| s.id == status.server_id) {
            let value = status.players_online.unwrap_or(0);
            metrics.push_str(&format!(
                "motd_node_players_online{{server_id=\"{}\",node_name=\"{}\"}} {}\n",
                server.id, server.name, value
            ));
        }
    }

    metrics.push_str("\n# HELP motd_node_players_max Max players count\n");
    metrics.push_str("# TYPE motd_node_players_max gauge\n");

    for status in &latest_status {
        if let Some(server) = servers.iter().find(|s| s.id == status.server_id) {
            let value = status.players_max.unwrap_or(0);
            metrics.push_str(&format!(
                "motd_node_players_max{{server_id=\"{}\",node_name=\"{}\"}} {}\n",
                server.id, server.name, value
            ));
        }
    }

    metrics.push_str("\n# HELP motd_node_latency_ms Node latency in milliseconds\n");
    metrics.push_str("# TYPE motd_node_latency_ms gauge\n");

    for status in &latest_status {
        if let Some(server) = servers.iter().find(|s| s.id == status.server_id) {
            if let Some(latency) = status.latency {
                metrics.push_str(&format!(
                    "motd_node_latency_ms{{server_id=\"{}\",node_name=\"{}\"}} {}\n",
                    server.id, server.name, latency
                ));
            }
        }
    }

    // 统计指标
    metrics.push_str("\n# HELP motd_node_uptime_percentage Node uptime percentage\n");
    metrics.push_str("# TYPE motd_node_uptime_percentage gauge\n");

    for (server_id, logs) in &history {
        if let Some(server) = servers.iter().find(|s| s.id == *server_id) {
            let stats = calculate_latency_stats(logs);
            metrics.push_str(&format!(
                "motd_node_uptime_percentage{{server_id=\"{}\",node_name=\"{}\"}} {}\n",
                server.id, server.name, stats.uptime_percentage
            ));
        }
    }

    metrics.push_str("\n# HELP motd_node_avg_latency_ms Node average latency in milliseconds\n");
    metrics.push_str("# TYPE motd_node_avg_latency_ms gauge\n");

    for (server_id, logs) in &history {
        if let Some(server) = servers.iter().find(|s| s.id == *server_id) {
            let stats = calculate_latency_stats(logs);
            if let Some(avg) = stats.avg_latency {
                metrics.push_str(&format!(
                    "motd_node_avg_latency_ms{{server_id=\"{}\",node_name=\"{}\"}} {}\n",
                    server.id, server.name, avg
                ));
            }
        }
    }

    // 玩家指标
    metrics.push_str("\n# HELP motd_player_online Player online status\n");
    metrics.push_str("# TYPE motd_player_online gauge\n");

    for player in &online_players {
        let value = if player.online { 1 } else { 0 };
        metrics.push_str(&format!(
            "motd_player_online{{player_name=\"{}\"}} {}\n",
            player.player_name, value
        ));
    }

    metrics.push_str("\n# HELP motd_players_count Total online players\n");
    metrics.push_str("# TYPE motd_players_count gauge\n");
    metrics.push_str(&format!("motd_players_count {}\n", online_players.len()));

    metrics.push_str("\n# HELP motd_node_count Total nodes\n");
    metrics.push_str("# TYPE motd_node_count gauge\n");
    metrics.push_str(&format!("motd_node_count {}\n", servers.len()));

    Response::builder()
        .header("Content-Type", "text/plain; version=0.0.4")
        .body(metrics.into())
        .unwrap()
}

/// 健康检查
async fn health_check() -> &'static str {
    "OK"
}
