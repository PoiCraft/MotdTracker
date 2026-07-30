//! 数据库抽象：按领域拆分的聚焦 trait + 组合超 trait
//!
//! - [`ServerRepository`]：服务器组 / 服务器 / 节点（拓扑）
//! - [`StatusRepository`]：状态日志
//! - [`PlayerRepository`]：玩家会话与统计
//! - [`AdminRepository`]：管理员认证
//! - [`ConfigRepository`]：应用配置（含 `poll_interval_secs` 便利方法）
//!
//! [`Database`] 是组合超 trait；`AppState` 持有的 `Arc<dyn Database>` 不变。
//! mock 单个协作者时只需实现对应的 3-10 个方法，而非全部 55 个。

use crate::models::*;
use crate::utils::time::Gmt8Time;
use async_trait::async_trait;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("数据库连接错误: {0}")]
    ConnectionError(String),
    #[error("查询错误: {0}")]
    QueryError(String),
    #[error("插入错误: {0}")]
    InsertError(String),
    #[error("更新错误: {0}")]
    UpdateError(String),
    #[error("删除错误: {0}")]
    DeleteError(String),
    #[error("迁移错误: {0}")]
    MigrationError(String),
    #[error("配置错误: {0}")]
    ConfigError(String),
}

/// 组合超 trait：持久化层的完整接口
pub trait Database:
    ServerRepository
    + StatusRepository
    + PlayerRepository
    + AdminRepository
    + ConfigRepository
    + Send
    + Sync
{
}

/// 服务器组 / 服务器 / 节点
#[async_trait]
pub trait ServerRepository: Send + Sync {
    // === 服务器组 ===
    async fn create_server_group(&self, name: &str, sort_order: i32) -> Result<String, DbError>;
    async fn get_all_server_groups(&self) -> Result<Vec<ServerGroup>, DbError>;
    async fn get_server_group(&self, id: &str) -> Result<Option<ServerGroup>, DbError>;
    async fn update_server_group(
        &self,
        id: &str,
        name: &str,
        sort_order: i32,
    ) -> Result<(), DbError>;
    async fn delete_server_group(&self, id: &str) -> Result<(), DbError>;

    // === 服务器实例 ===
    async fn create_server(
        &self,
        name: &str,
        group_id: Option<&str>,
        sort_order: i32,
    ) -> Result<String, DbError>;
    async fn get_all_servers(&self) -> Result<Vec<ServerEntity>, DbError>;
    async fn get_servers_by_group(&self, group_id: &str) -> Result<Vec<ServerEntity>, DbError>;
    async fn get_server(&self, id: &str) -> Result<Option<ServerEntity>, DbError>;
    async fn update_server(
        &self,
        id: &str,
        name: &str,
        group_id: Option<&str>,
        sort_order: i32,
    ) -> Result<(), DbError>;
    async fn delete_server(&self, id: &str) -> Result<(), DbError>;

    // === 节点 ===
    async fn add_node(&self, params: &AddNodeParams<'_>) -> Result<String, DbError>;
    async fn get_all_nodes(&self) -> Result<Vec<Node>, DbError>;
    async fn get_enabled_nodes(&self) -> Result<Vec<Node>, DbError>;
    async fn get_nodes_by_server(&self, server_id: &str) -> Result<Vec<Node>, DbError>;
    async fn get_node(&self, id: &str) -> Result<Option<Node>, DbError>;
    async fn update_node(&self, id: &str, params: &UpdateNodeParams<'_>) -> Result<(), DbError>;
    async fn delete_node(&self, id: &str) -> Result<(), DbError>;
    /// 原子交换两个节点的 sort_order（防竞态）
    async fn swap_node_sort_orders(
        &self,
        id1: &str,
        sort_order1: i32,
        id2: &str,
        sort_order2: i32,
    ) -> Result<(), DbError>;
}

/// 状态日志
#[async_trait]
pub trait StatusRepository: Send + Sync {
    async fn log_status(&self, entry: &StatusLogEntry) -> Result<(), DbError>;
    async fn log_status_batch(&self, entries: &[StatusLogEntry]) -> Result<(), DbError>;
    async fn get_node_latest_status(&self, node_id: &str) -> Result<Option<StatusLog>, DbError>;
    async fn get_node_history(&self, node_id: &str, limit: i32) -> Result<Vec<StatusLog>, DbError>;
    async fn get_node_history_range(
        &self,
        node_id: &str,
        start: Gmt8Time,
        end: Gmt8Time,
    ) -> Result<Vec<StatusLog>, DbError>;
    async fn get_all_latest_status(&self) -> Result<Vec<StatusLog>, DbError>;
    async fn get_all_history(
        &self,
        hours: u32,
    ) -> Result<std::collections::HashMap<String, Vec<StatusLog>>, DbError>;
    async fn get_server_history(
        &self,
        server_id: &str,
        hours: u32,
    ) -> Result<Vec<StatusLog>, DbError>;
    async fn cleanup_old_records(&self, days: u32) -> Result<u64, DbError>;
}

/// 玩家会话与统计
#[async_trait]
pub trait PlayerRepository: Send + Sync {
    async fn update_player_sessions(
        &self,
        node_id: &str,
        sample_players: &[String],
        timestamp: Gmt8Time,
    ) -> Result<(), DbError>;
    async fn get_online_players_on_node(
        &self,
        node_id: &str,
    ) -> Result<Vec<PlayerSession>, DbError>;
    async fn get_player_sessions_by_node(
        &self,
        node_id: &str,
    ) -> Result<Vec<PlayerSession>, DbError>;
    async fn get_player_history(
        &self,
        player_name: &str,
        days: Option<u32>,
    ) -> Result<Vec<PlayerSessionHistory>, DbError>;
    async fn get_all_player_names(&self) -> Result<Vec<String>, DbError>;
    async fn get_player_detail(&self, player_name: &str) -> Result<Option<PlayerDetail>, DbError>;
    async fn get_player_heatmap(
        &self,
        player_name: &str,
        days: u32,
    ) -> Result<Vec<PlayerHeatmap>, DbError>;
    async fn get_player_weekly_stats(
        &self,
        player_name: &str,
    ) -> Result<PlayerWeeklyStats, DbError>;
    async fn end_offline_sessions(
        &self,
        node_id: &str,
        online_players: &[String],
        timestamp: Gmt8Time,
    ) -> Result<(), DbError>;
    async fn update_player_sessions_aggregate(
        &self,
        observations: &[(String, bool, Option<Vec<String>>)],
        timestamp: Gmt8Time,
    ) -> Result<(), DbError>;
    async fn get_all_player_sessions(&self, server_id: &str)
        -> Result<Vec<PlayerSession>, DbError>;

    /// 获取所有玩家会话（不分组，用于批量构建玩家列表）
    async fn get_all_player_sessions_flat(&self) -> Result<Vec<PlayerSession>, DbError>;
}

/// 管理员认证
#[async_trait]
pub trait AdminRepository: Send + Sync {
    async fn has_admin_user(&self) -> Result<bool, DbError>;
    async fn create_admin_user(&self, username: &str, password_hash: &str) -> Result<i64, DbError>;
    async fn get_admin_user(&self, username: &str) -> Result<Option<AdminUser>, DbError>;
    async fn update_admin_password(&self, user_id: i64, password_hash: &str)
        -> Result<(), DbError>;
    async fn update_admin_last_login(&self, user_id: i64) -> Result<(), DbError>;
    async fn create_session(
        &self,
        user_id: i64,
        token: &str,
        expires_at: Gmt8Time,
    ) -> Result<(), DbError>;
    async fn validate_session(&self, token: &str) -> Result<Option<AdminUser>, DbError>;
    async fn cleanup_expired_sessions(&self) -> Result<u64, DbError>;
    async fn delete_session(&self, token: &str) -> Result<(), DbError>;
}

/// 应用配置与生命周期
#[async_trait]
pub trait ConfigRepository: Send + Sync {
    async fn init_database(&self) -> Result<(), DbError>;

    async fn get_app_config(&self, key: &str) -> Result<Option<String>, DbError>;
    async fn set_app_config(&self, key: &str, value: &str) -> Result<(), DbError>;
    async fn get_all_app_config(&self) -> Result<Vec<AppConfigEntry>, DbError>;
    async fn delete_app_config(&self, key: &str) -> Result<(), DbError>;

    async fn close(&self) {}

    /// 轮询间隔（秒），默认 60。收编原先散落各处的
    /// `get_app_config → ok → flatten → parse → unwrap_or(60)` 调用链。
    async fn poll_interval_secs(&self) -> u64 {
        self.get_app_config("poll_interval")
            .await
            .ok()
            .flatten()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(60)
    }
}
