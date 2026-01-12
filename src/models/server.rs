use serde::{Deserialize, Serialize};

/// 服务器信息
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Server {
    pub id: i32,
    pub name: String,
    pub host: String,
    pub port: i32,
    pub color: Option<String>,
}

/// 服务器状态统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStats {
    pub online_rate: f64,
    pub avg_latency: Option<f64>,
    pub stddev_latency: Option<f64>,
    pub min_latency: Option<f64>,
    pub max_latency: Option<f64>,
    pub p95_latency: Option<f64>,
    pub cv: Option<f64>,
}

impl Default for ServerStats {
    fn default() -> Self {
        Self {
            online_rate: 0.0,
            avg_latency: None,
            stddev_latency: None,
            min_latency: None,
            max_latency: None,
            p95_latency: None,
            cv: None,
        }
    }
}
