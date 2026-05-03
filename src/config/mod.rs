//! 配置模块

mod loader;

pub use loader::*;

use serde::{Deserialize, Serialize};

/// 服务器版本类型
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ServerEdition {
    /// Java 版
    #[default]
    Java,
    /// 基岩版
    Bedrock,
}

impl std::fmt::Display for ServerEdition {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Java => write!(f, "java"),
            Self::Bedrock => write!(f, "bedrock"),
        }
    }
}

impl std::str::FromStr for ServerEdition {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "java" => Ok(Self::Java),
            "bedrock" => Ok(Self::Bedrock),
            _ => Err(format!("未知的服务器版本: {}，可选值: java, bedrock", s)),
        }
    }
}

/// 数据库配置
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DatabaseConfig {
    /// SQLite 数据库路径
    #[serde(default = "default_database")]
    pub path: String,
}

/// 应用程序配置
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AppConfig {
    /// 服务器名称
    #[serde(default = "default_server_name")]
    pub server_name: String,

    /// 数据库配置
    #[serde(default)]
    pub database: DatabaseConfig,

    /// 轮询间隔（秒）
    #[serde(default = "default_poll_interval")]
    pub poll_interval: u64,

    /// Web 服务端口
    #[serde(default = "default_port")]
    pub port: u16,

    /// 节点配置列表
    #[serde(default)]
    pub nodes: Vec<NodeConfig>,

    /// NapCat 告警配置（可选）
    pub napcat_alert: Option<NapCatAlertConfig>,

    /// Umami 分析配置（可选）
    pub umami: Option<UmamiConfig>,
}

/// 节点配置
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct NodeConfig {
    /// 节点 ID
    pub id: i32,

    /// 节点名称
    pub name: String,

    /// 节点地址
    pub host: String,

    /// 节点端口
    #[serde(default = "default_node_port")]
    pub port: u16,

    /// 服务器版本类型（java / bedrock）
    #[serde(default)]
    pub edition: ServerEdition,

    /// 图表颜色
    pub color: Option<String>,

    /// 是否启用
    #[serde(default = "default_enable")]
    pub enable: bool,
}

/// NapCat 告警配置
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct NapCatAlertConfig {
    /// NapCat 主机地址
    pub host: String,

    /// 群组列表
    pub groups: Vec<String>,

    /// 重复告警间隔（分钟）
    #[serde(default = "default_delta_minutes")]
    pub delta_minutes: u64,

    /// 离线确认帧数
    #[serde(default = "default_offline_confirm_frames")]
    pub offline_confirm_frames: u32,

    /// 在线确认帧数
    #[serde(default = "default_online_confirm_frames")]
    pub online_confirm_frames: u32,

    /// 是否启用
    #[serde(default = "default_enable")]
    pub enable: bool,
}

/// Umami 分析配置
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UmamiConfig {
    /// 是否启用
    #[serde(default = "default_enable")]
    pub enabled: bool,

    /// 脚本 URL
    pub script_url: String,

    /// 网站 ID
    pub website_id: String,

    /// 域名
    #[serde(default)]
    pub domains: Option<String>,
}

// 默认值函数
fn default_server_name() -> String {
    "MotdTracker".to_string()
}
fn default_database() -> String {
    "data/motdtracker.db".to_string()
}
fn default_poll_interval() -> u64 {
    60
}
fn default_port() -> u16 {
    5011
}
fn default_node_port() -> u16 {
    25565
}
fn default_enable() -> bool {
    true
}
fn default_delta_minutes() -> u64 {
    30
}
fn default_offline_confirm_frames() -> u32 {
    3
}
fn default_online_confirm_frames() -> u32 {
    3
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            path: default_database(),
        }
    }
}

impl AppConfig {
    /// 获取数据库连接字符串
    pub fn database_url(&self) -> String {
        format!("sqlite:{}", self.database.path)
    }

    /// 获取启用的节点
    pub fn enabled_nodes(&self) -> Vec<&NodeConfig> {
        self.nodes.iter().filter(|n| n.enable).collect()
    }

    /// 根据 ID 获取节点
    pub fn get_node(&self, id: i32) -> Option<&NodeConfig> {
        self.nodes.iter().find(|n| n.id == id)
    }
}
