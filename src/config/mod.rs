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

// Default is derived on the enum using `#[default]` on the `Java` variant.

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

/// 应用程序配置（仅保留最小启动项，业务配置全部在数据库中管理）
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AppConfig {
    /// 数据库配置
    #[serde(default)]
    pub database: DatabaseConfig,

    /// 轮询间隔（秒）
    #[serde(default = "default_poll_interval")]
    pub poll_interval: u64,

    /// Web 服务端口
    #[serde(default = "default_port")]
    pub port: u16,

    /// CORS 允许的源，空字符串表示禁止跨域（默认）
    #[serde(default = "default_cors_origin")]
    pub cors_origin: String,
}

/// Webhook 告警配置（运行时从数据库加载，不从配置文件读取）
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WebhookAlertConfig {
    /// Webhook URL
    pub url: String,

    /// 请求方法（POST / PUT）
    #[serde(default = "default_http_method")]
    pub method: String,

    /// 自定义请求头（键值对，值支持模板变量）
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,

    /// 请求体模板（支持模板变量）
    pub body: String,

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

/// Umami 分析配置（保留结构体供数据库反序列化使用）
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
fn default_database() -> String {
    "data/motdtracker.db".to_string()
}
fn default_poll_interval() -> u64 {
    60
}
fn default_port() -> u16 {
    5011
}
fn default_enable() -> bool {
    true
}
fn default_cors_origin() -> String {
    String::new()
}
fn default_http_method() -> String {
    "POST".to_string()
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

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            database: DatabaseConfig::default(),
            poll_interval: default_poll_interval(),
            port: default_port(),
            cors_origin: default_cors_origin(),
        }
    }
}

impl AppConfig {
    /// 获取数据库连接字符串
    pub fn database_url(&self) -> String {
        format!("sqlite:{}", self.database.path)
    }
}
