use serde::{Deserialize, Serialize};

/// 节点配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConfig {
    pub id: Option<i32>,
    pub name: String,
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    pub color: Option<String>,
}

fn default_port() -> u16 {
    25565
}

/// NapCat告警配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NapCatConfig {
    pub host: String,
    pub groups: Vec<String>,
    #[serde(default = "default_delta_minutes")]
    pub delta_minutes: u64,
}

fn default_delta_minutes() -> u64 {
    30
}

/// PostgreSQL配置（可选，但本重构使用内嵌SQLite）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostgreSQLConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub user: String,
    pub password: String,
}

/// 主配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server_name: String,
    pub nodes: Vec<NodeConfig>,
    pub database: String,
    pub postgresql: Option<PostgreSQLConfig>,
    pub napcat_alert: Option<NapCatConfig>,
    #[serde(default = "default_poll_interval")]
    pub poll_interval: u64,
    #[serde(default = "default_port_app")]
    pub port: u16,
}

fn default_poll_interval() -> u64 {
    60
}

fn default_port_app() -> u16 {
    5011
}

impl AppConfig {
    /// 从文件加载配置
    pub fn from_file(path: &str) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let config: AppConfig = serde_json::from_str(&content)?;
        Ok(config)
    }

    /// 计算24小时窗口的记录数
    pub fn get_24h_limit(&self) -> i64 {
        (86400 / self.poll_interval) as i64
    }
}
