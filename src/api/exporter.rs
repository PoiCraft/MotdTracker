use axum::{Router, routing::get, response::IntoResponse, http::StatusCode, extract::State};
use std::sync::Arc;
use crate::AppState;

pub fn create_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/metrics", get(metrics))
        .route("/health", get(health))
        .with_state(state)
}

/// Prometheus格式的指标
async fn metrics(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let mut output = String::new();
    
    output.push_str("# HELP motdtracker_node_online Node online status (1 = online, 0 = offline)\n");
    output.push_str("# TYPE motdtracker_node_online gauge\n");
    
    output.push_str("# HELP motdtracker_node_latency Node latency in milliseconds\n");
    output.push_str("# TYPE motdtracker_node_latency gauge\n");
    
    output.push_str("# HELP motdtracker_node_players_online Number of online players\n");
    output.push_str("# TYPE motdtracker_node_players_online gauge\n");
    
    output.push_str("# HELP motdtracker_node_players_max Maximum number of players\n");
    output.push_str("# TYPE motdtracker_node_players_max gauge\n");

    if let Ok(servers) = state.db.get_all_servers().await {
        for server in servers {
            let labels = format!("{{name=\"{}\",host=\"{}\",port=\"{}\"}}",
                server.name.replace("\"", "\\\""),
                server.host,
                server.port
            );

            if let Ok(Some(status)) = state.db.get_server_latest_status(server.id).await {
                output.push_str(&format!("motdtracker_node_online{} {}\n", 
                    labels, if status.online { 1 } else { 0 }));
                
                if let Some(latency) = status.latency {
                    output.push_str(&format!("motdtracker_node_latency{} {}\n", labels, latency));
                }
                
                if let Some(players_online) = status.players_online {
                    output.push_str(&format!("motdtracker_node_players_online{} {}\n", labels, players_online));
                }
                
                if let Some(players_max) = status.players_max {
                    output.push_str(&format!("motdtracker_node_players_max{} {}\n", labels, players_max));
                }
            } else {
                output.push_str(&format!("motdtracker_node_online{} 0\n", labels));
            }
        }
    }

    // 添加统计信息
    output.push_str("# HELP motdtracker_server_online_rate Server 24h online rate percentage\n");
    output.push_str("# TYPE motdtracker_server_online_rate gauge\n");
    
    let limit = 86400 / state.config.poll_interval as i64;
    if let Ok(servers) = state.db.get_all_servers().await {
        for server in servers {
            if let Ok(stats) = state.db.get_server_stats(server.id, limit).await {
                let labels = format!("{{name=\"{}\"}}",
                    server.name.replace("\"", "\\\"")
                );
                output.push_str(&format!("motdtracker_server_online_rate{} {}\n", 
                    labels, stats.online_rate));
                
                if let Some(avg_latency) = stats.avg_latency {
                    output.push_str(&format!("# HELP motdtracker_server_avg_latency Average latency in milliseconds\n"));
                    output.push_str(&format!("# TYPE motdtracker_server_avg_latency gauge\n"));
                    output.push_str(&format!("motdtracker_server_avg_latency{} {}\n", 
                        labels, avg_latency));
                }
            }
        }
    }

    (StatusCode::OK, output)
}

/// 健康检查端点
async fn health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    // 检查数据库是否可访问
    match state.db.get_all_servers().await {
        Ok(_) => (StatusCode::OK, "OK"),
        Err(_) => (StatusCode::SERVICE_UNAVAILABLE, "Database unavailable"),
    }
}
