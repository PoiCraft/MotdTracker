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

async fn prometheus_metrics(State(state): State<AppState>) -> Response {
    let nodes = state.db.get_all_nodes().await.unwrap_or_default();
    let servers = state.db.get_all_servers().await.unwrap_or_default();
    let groups = state.db.get_all_server_groups().await.unwrap_or_default();
    let latest_status = state.db.get_all_latest_status().await.unwrap_or_default();
    let history = state.db.get_all_history(24).await.unwrap_or_default();

    // 构建查找映射
    let node_map: HashMap<&str, &crate::models::Node> =
        nodes.iter().map(|n| (n.id.as_str(), n)).collect();
    let server_map: HashMap<&str, &crate::models::ServerEntity> =
        servers.iter().map(|s| (s.id.as_str(), s)).collect();
    let group_map: HashMap<&str, &crate::models::ServerGroup> =
        groups.iter().map(|g| (g.id.as_str(), g)).collect();

    let mut m = String::new();

    // ==================== 节点级指标 ====================
    m.push_str("# HELP motd_node_online Node online status (1=online, 0=offline)\n");
    m.push_str("# TYPE motd_node_online gauge\n");
    for s in &latest_status {
        let node = node_map.get(s.node_id.as_str());
        let sv = node.and_then(|n| server_map.get(n.server_id.as_str()));
        let grp = sv.and_then(|srv| srv.group_id.as_deref().and_then(|gid| group_map.get(gid)));
        m.push_str(&format!(
            "motd_node_online{{node_id=\"{}\",node_name=\"{}\",host=\"{}\",port=\"{}\",server_id=\"{}\",server_name=\"{}\",group_name=\"{}\"}} {}\n",
            s.node_id,
            node.map(|n| n.name.as_str()).unwrap_or(""),
            node.map(|n| n.host.as_str()).unwrap_or(""),
            node.map(|n| n.port).unwrap_or(0),
            sv.map(|srv| srv.id.as_str()).unwrap_or(""),
            sv.map(|srv| srv.name.as_str()).unwrap_or(""),
            grp.map(|g| g.name.as_str()).unwrap_or(""),
            if s.online { 1 } else { 0 }
        ));
    }

    m.push_str("# HELP motd_node_players_online Players currently online per node\n");
    m.push_str("# TYPE motd_node_players_online gauge\n");
    for s in &latest_status {
        let node = node_map.get(s.node_id.as_str());
        m.push_str(&format!(
            "motd_node_players_online{{node_id=\"{}\",node_name=\"{}\"}} {}\n",
            s.node_id,
            node.map(|n| n.name.as_str()).unwrap_or(""),
            s.players_online.unwrap_or(0)
        ));
    }

    m.push_str("# HELP motd_node_players_max Max player slots per node\n");
    m.push_str("# TYPE motd_node_players_max gauge\n");
    for s in &latest_status {
        let node = node_map.get(s.node_id.as_str());
        m.push_str(&format!(
            "motd_node_players_max{{node_id=\"{}\",node_name=\"{}\"}} {}\n",
            s.node_id,
            node.map(|n| n.name.as_str()).unwrap_or(""),
            s.players_max.unwrap_or(0)
        ));
    }

    m.push_str("# HELP motd_node_latency_ms Node latency in milliseconds\n");
    m.push_str("# TYPE motd_node_latency_ms gauge\n");
    for s in &latest_status {
        if let Some(lat) = s.latency {
            let node = node_map.get(s.node_id.as_str());
            m.push_str(&format!(
                "motd_node_latency_ms{{node_id=\"{}\",node_name=\"{}\"}} {:.2}\n",
                s.node_id,
                node.map(|n| n.name.as_str()).unwrap_or(""),
                lat
            ));
        }
    }

    // ==================== 统计指标 ====================
    m.push_str("# HELP motd_node_uptime_ratio Node uptime ratio (0-1) over 24h\n");
    m.push_str("# TYPE motd_node_uptime_ratio gauge\n");
    for (node_id, logs) in &history {
        let node = node_map.get(node_id.as_str());
        let stats = calculate_latency_stats(logs);
        m.push_str(&format!(
            "motd_node_uptime_ratio{{node_id=\"{}\",node_name=\"{}\"}} {:.4}\n",
            node_id,
            node.map(|n| n.name.as_str()).unwrap_or(""),
            stats.uptime_percentage / 100.0
        ));
    }

    m.push_str("# HELP motd_node_avg_latency_ms Node 24h average latency\n");
    m.push_str("# TYPE motd_node_avg_latency_ms gauge\n");
    for (node_id, logs) in &history {
        let node = node_map.get(node_id.as_str());
        let stats = calculate_latency_stats(logs);
        if let Some(avg) = stats.avg_latency {
            m.push_str(&format!(
                "motd_node_avg_latency_ms{{node_id=\"{}\",node_name=\"{}\"}} {:.2}\n",
                node_id,
                node.map(|n| n.name.as_str()).unwrap_or(""),
                avg
            ));
        }
    }

    // ==================== 聚合指标 ====================
    m.push_str("# HELP motd_nodes_total Total registered nodes\n");
    m.push_str("# TYPE motd_nodes_total gauge\n");
    m.push_str(&format!("motd_nodes_total {}\n", nodes.len()));

    m.push_str("# HELP motd_servers_total Total servers\n");
    m.push_str("# TYPE motd_servers_total gauge\n");
    m.push_str(&format!("motd_servers_total {}\n", servers.len()));

    m.push_str("# HELP motd_groups_total Total server groups\n");
    m.push_str("# TYPE motd_groups_total gauge\n");
    m.push_str(&format!("motd_groups_total {}\n", groups.len()));

    let online_nodes = latest_status.iter().filter(|s| s.online).count();
    m.push_str("# HELP motd_online_nodes_total Nodes currently online\n");
    m.push_str("# TYPE motd_online_nodes_total gauge\n");
    m.push_str(&format!("motd_online_nodes_total {}\n", online_nodes));

    let total_players: i32 = latest_status.iter().filter_map(|s| s.players_online).sum();
    m.push_str("# HELP motd_players_total Total online players across all nodes\n");
    m.push_str("# TYPE motd_players_total gauge\n");
    m.push_str(&format!("motd_players_total {}\n", total_players));

    Response::builder()
        .header("Content-Type", "text/plain; version=0.0.4")
        .body(m.into())
        .unwrap()
}

async fn health_check() -> &'static str {
    "OK"
}
