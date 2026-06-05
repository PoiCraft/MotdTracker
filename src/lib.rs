//! MotdTracker - Minecraft 服务器多入口点实时监控系统
//!
//! 通过多个节点（连接入口）监控同一台 Minecraft 服务器，
//! 提供实时状态追踪、玩家会话管理、延迟统计分析和 Prometheus 指标导出等功能。

pub mod alert;
pub mod api;
pub mod auth;
pub mod config;
pub mod core;
pub mod db;
pub mod embedded;
pub mod models;
pub mod utils;
pub mod ws;

pub const APP_VERSION: &str = env!("APP_VERSION");
pub use config::AppConfig;
pub use config::ServerEdition;
pub use core::monitor::MinecraftQuerier;
pub use core::poller::ServerPollerManager;
pub use db::Database;
