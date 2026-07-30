//! Prometheus 指标导出 API
//!
//! 快照 → Prometheus 文本是纯函数（`render_prometheus`），指标与 Web 界面同源。

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::time::{Duration, Instant};

use super::snapshot::{DashboardSnapshot, SnapshotNode};
use super::AppState;

/// Prometheus label 值转义
fn escape_label_value(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
}

/// 节点及其标签上下文（服务器/组名称）
struct NodeLabels<'a> {
    node: &'a SnapshotNode,
    server_id: &'a str,
    server_name: &'a str,
    group_name: &'a str,
}

fn labeled_nodes(snap: &DashboardSnapshot) -> Vec<NodeLabels<'_>> {
    let mut out = Vec::new();
    for g in &snap.groups {
        for s in &g.servers {
            for n in &s.nodes {
                out.push(NodeLabels {
                    node: n,
                    server_id: s.server.id.as_str(),
                    server_name: s.server.name.as_str(),
                    group_name: g.group.name.as_str(),
                });
            }
        }
    }
    for s in &snap.ungrouped_servers {
        for n in &s.nodes {
            out.push(NodeLabels {
                node: n,
                server_id: s.server.id.as_str(),
                server_name: s.server.name.as_str(),
                group_name: "",
            });
        }
    }
    for n in &snap.orphan_nodes {
        out.push(NodeLabels {
            node: n,
            server_id: "",
            server_name: "",
            group_name: "",
        });
    }
    out
}

/// 快照 → Prometheus 指标文本（纯函数，可用构造快照直接测试）
fn render_prometheus(snap: &DashboardSnapshot) -> String {
    let nodes = labeled_nodes(snap);
    let mut m = String::new();

    // ==================== 节点级指标 ====================
    m.push_str("# HELP motd_node_online Node online status (1=online, 0=offline)\n");
    m.push_str("# TYPE motd_node_online gauge\n");
    for l in &nodes {
        if let Some(s) = &l.node.latest_status {
            m.push_str(&format!(
                "motd_node_online{{node_id=\"{}\",node_name=\"{}\",server_id=\"{}\",server_name=\"{}\",group_name=\"{}\"}} {}\n",
                escape_label_value(&l.node.node.id),
                escape_label_value(&l.node.node.name),
                escape_label_value(l.server_id),
                escape_label_value(l.server_name),
                escape_label_value(l.group_name),
                if s.online { 1 } else { 0 }
            ));
        }
    }

    m.push_str("# HELP motd_node_players_online Players currently online per node\n");
    m.push_str("# TYPE motd_node_players_online gauge\n");
    for l in &nodes {
        if let Some(s) = &l.node.latest_status {
            m.push_str(&format!(
                "motd_node_players_online{{node_id=\"{}\",node_name=\"{}\"}} {}\n",
                escape_label_value(&l.node.node.id),
                escape_label_value(&l.node.node.name),
                s.players_online.unwrap_or(0)
            ));
        }
    }

    m.push_str("# HELP motd_node_players_max Max player slots per node\n");
    m.push_str("# TYPE motd_node_players_max gauge\n");
    for l in &nodes {
        if let Some(s) = &l.node.latest_status {
            m.push_str(&format!(
                "motd_node_players_max{{node_id=\"{}\",node_name=\"{}\"}} {}\n",
                escape_label_value(&l.node.node.id),
                escape_label_value(&l.node.node.name),
                s.players_max.unwrap_or(0)
            ));
        }
    }

    m.push_str("# HELP motd_node_latency_ms Node latency in milliseconds\n");
    m.push_str("# TYPE motd_node_latency_ms gauge\n");
    for l in &nodes {
        if let Some(lat) = l.node.latest_status.as_ref().and_then(|s| s.latency) {
            m.push_str(&format!(
                "motd_node_latency_ms{{node_id=\"{}\",node_name=\"{}\"}} {:.2}\n",
                escape_label_value(&l.node.node.id),
                escape_label_value(&l.node.node.name),
                lat
            ));
        }
    }

    // ==================== 统计指标 ====================
    m.push_str("# HELP motd_node_uptime_ratio Node uptime ratio (0-1) over 24h\n");
    m.push_str("# TYPE motd_node_uptime_ratio gauge\n");
    for l in &nodes {
        if let Some(stats) = &l.node.latency_stats {
            m.push_str(&format!(
                "motd_node_uptime_ratio{{node_id=\"{}\",node_name=\"{}\"}} {:.4}\n",
                escape_label_value(&l.node.node.id),
                escape_label_value(&l.node.node.name),
                stats.uptime_percentage / 100.0
            ));
        }
    }

    m.push_str("# HELP motd_node_avg_latency_ms Node 24h average latency\n");
    m.push_str("# TYPE motd_node_avg_latency_ms gauge\n");
    for l in &nodes {
        if let Some(avg) = l.node.latency_stats.as_ref().and_then(|s| s.avg_latency) {
            m.push_str(&format!(
                "motd_node_avg_latency_ms{{node_id=\"{}\",node_name=\"{}\"}} {:.2}\n",
                escape_label_value(&l.node.node.id),
                escape_label_value(&l.node.node.name),
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
    m.push_str(&format!("motd_servers_total {}\n", snap.servers().count()));

    m.push_str("# HELP motd_groups_total Total server groups\n");
    m.push_str("# TYPE motd_groups_total gauge\n");
    m.push_str(&format!("motd_groups_total {}\n", snap.groups.len()));

    let online_nodes = nodes
        .iter()
        .filter(|l| l.node.latest_status.as_ref().is_some_and(|s| s.online))
        .count();
    m.push_str("# HELP motd_online_nodes_total Nodes currently online\n");
    m.push_str("# TYPE motd_online_nodes_total gauge\n");
    m.push_str(&format!("motd_online_nodes_total {}\n", online_nodes));

    let total_players: i32 = nodes
        .iter()
        .filter_map(|l| l.node.latest_status.as_ref()?.players_online)
        .sum();
    m.push_str("# HELP motd_players_total Total online players across all nodes\n");
    m.push_str("# TYPE motd_players_total gauge\n");
    m.push_str(&format!("motd_players_total {}\n", total_players));

    m
}

/// 带缓存的 Prometheus 指标
struct MetricsCache {
    data: parking_lot::Mutex<Option<(Instant, String)>>,
    ttl: Duration,
}

static METRICS_CACHE: std::sync::LazyLock<MetricsCache> =
    std::sync::LazyLock::new(|| MetricsCache {
        data: parking_lot::Mutex::new(None),
        ttl: Duration::from_secs(30),
    });

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/metrics", get(prometheus_metrics))
        .route("/health", get(health_check))
}

async fn prometheus_metrics(State(state): State<AppState>) -> Response {
    let cache = &*METRICS_CACHE;

    let should_recompute = {
        let guard = cache.data.lock();
        match &*guard {
            Some((ts, _)) => ts.elapsed() >= cache.ttl,
            None => true,
        }
    };

    if should_recompute {
        let snap = match DashboardSnapshot::load(
            &state.db,
            None,
            Some(crate::api::snapshot::DEFAULT_HISTORY_HOURS),
        )
        .await
        {
            Ok(snap) => snap,
            Err(e) => return super::internal_error(e).into_response(),
        };
        let computed = render_prometheus(&snap);
        let mut guard = cache.data.lock();
        *guard = Some((Instant::now(), computed.clone()));
        return Response::builder()
            .header("Content-Type", "text/plain; version=0.0.4")
            .body(computed.into())
            .unwrap();
    }

    let data = cache
        .data
        .lock()
        .as_ref()
        .expect("cache should be populated")
        .1
        .clone();

    Response::builder()
        .header("Content-Type", "text/plain; version=0.0.4")
        .body(data.into())
        .unwrap()
}

async fn health_check(State(state): State<AppState>) -> Response {
    match state.db.get_all_servers().await {
        Ok(_) => Response::builder()
            .status(StatusCode::OK)
            .body("OK".into())
            .unwrap(),
        Err(e) => {
            tracing::warn!("Health check failed: {}", e);
            Response::builder()
                .status(StatusCode::SERVICE_UNAVAILABLE)
                .body("Database unavailable".into())
                .unwrap()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::snapshot::{SnapshotGroup, SnapshotServer};
    use crate::models::*;
    use crate::utils::time::now_gmt8;

    fn sample_snapshot() -> DashboardSnapshot {
        let ts = now_gmt8().into();
        let node = Node {
            id: "n1".to_string(),
            server_id: "s1".to_string(),
            name: "Node 1".to_string(),
            host: "localhost".to_string(),
            port: 25565,
            edition: "java".to_string(),
            color: None,
            enabled: true,
            sort_order: 0,
            created_at: ts,
            updated_at: ts,
        };
        let snap_node = SnapshotNode {
            node,
            latest_status: Some(NodeStatus {
                timestamp: now_gmt8(),
                online: true,
                latency: Some(42.5),
                players_online: Some(5),
                players_max: Some(20),
                version: None,
                motd: None,
            }),
            latency_stats: Some(LatencyStats {
                uptime_percentage: 50.0,
                avg_latency: Some(40.25),
                ..Default::default()
            }),
        };
        let server = ServerEntity {
            id: "s1".to_string(),
            group_id: Some("g1".to_string()),
            name: "Server 1".to_string(),
            sort_order: 0,
            created_at: ts,
            updated_at: ts,
        };
        let group = ServerGroup {
            id: "g1".to_string(),
            name: "Group 1".to_string(),
            sort_order: 0,
            created_at: ts,
            updated_at: ts,
        };
        DashboardSnapshot {
            groups: vec![SnapshotGroup {
                group,
                server_count: 1,
                online_node_count: 1,
                total_node_count: 1,
                total_players_online: 5,
                servers: vec![SnapshotServer {
                    server,
                    aggregate: AggregateStatus {
                        online: true,
                        online_node_count: 1,
                        total_node_count: 1,
                        total_players_online: 5,
                        total_players_max: 20,
                        avg_latency: Some(42.5),
                    },
                    nodes: vec![snap_node],
                }],
            }],
            ungrouped_servers: vec![],
            orphan_nodes: vec![],
            poll_interval: 60,
        }
    }

    #[test]
    fn renders_node_metrics_with_label_context() {
        let text = render_prometheus(&sample_snapshot());
        assert!(text.contains(
            "motd_node_online{node_id=\"n1\",node_name=\"Node 1\",server_id=\"s1\",server_name=\"Server 1\",group_name=\"Group 1\"} 1"
        ));
        assert!(text.contains("motd_node_players_online{node_id=\"n1\",node_name=\"Node 1\"} 5"));
        assert!(text.contains("motd_node_players_max{node_id=\"n1\",node_name=\"Node 1\"} 20"));
        assert!(text.contains("motd_node_latency_ms{node_id=\"n1\",node_name=\"Node 1\"} 42.50"));
        assert!(text.contains("motd_node_uptime_ratio{node_id=\"n1\",node_name=\"Node 1\"} 0.5000"));
        assert!(
            text.contains("motd_node_avg_latency_ms{node_id=\"n1\",node_name=\"Node 1\"} 40.25")
        );
    }

    #[test]
    fn renders_aggregate_metrics() {
        let text = render_prometheus(&sample_snapshot());
        assert!(text.contains("motd_nodes_total 1"));
        assert!(text.contains("motd_servers_total 1"));
        assert!(text.contains("motd_groups_total 1"));
        assert!(text.contains("motd_online_nodes_total 1"));
        assert!(text.contains("motd_players_total 5"));
    }

    #[test]
    fn nodes_without_status_emit_no_node_metrics() {
        let mut snap = sample_snapshot();
        snap.groups[0].servers[0].nodes[0].latest_status = None;
        snap.groups[0].servers[0].nodes[0].latency_stats = None;
        let text = render_prometheus(&sample_snapshot());
        assert!(text.contains("motd_node_online{"));
        let text = render_prometheus(&snap);
        assert!(!text.contains("motd_node_online{node_id"));
        assert!(!text.contains("motd_node_uptime_ratio{node_id"));
        // 聚合指标仍统计注册节点
        assert!(text.contains("motd_nodes_total 1"));
        assert!(text.contains("motd_online_nodes_total 0"));
    }

    #[test]
    fn label_values_are_escaped() {
        let mut snap = sample_snapshot();
        snap.groups[0].servers[0].nodes[0].node.name = "quote\"node".to_string();
        let text = render_prometheus(&snap);
        assert!(text.contains("node_name=\"quote\\\"node\""));
    }
}
