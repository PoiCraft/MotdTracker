//! MotdTracker - Minecraft 服务器多节点实时监控系统
//!
//! 这是一个用于监控多个 Minecraft 服务器入口点的实时监控系统，
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
pub use core::poller::ServerPoller;
pub use core::monitor::MinecraftQuerier;
pub use db::Database;
