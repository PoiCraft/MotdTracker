//! MotdTracker - Minecraft 服务器多入口点实时监控系统
//!
//! 通过多个节点（连接入口）监控同一台 Minecraft 服务器，
//! 提供实时状态追踪、玩家会话管理、延迟统计分析和 Prometheus 指标导出等功能。

pub mod config;
pub mod core;
pub mod db;
pub mod models;
pub mod utils;
pub mod api;
pub mod ws;
pub mod alert;

pub use config::AppConfig;
pub use config::ServerEdition;
pub use core::poller::ServerPoller;
pub use core::monitor::MinecraftQuerier;
pub use db::Database;
