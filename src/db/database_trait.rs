//! 数据库抽象 trait

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use thiserror::Error;

use crate::models::*;

/// 数据库错误类型
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

/// 数据库抽象 trait
#[async_trait]
pub trait Database: Send + Sync {
    /// 初始化数据库（创建表、索引等）
    async fn init_database(&self) -> Result<(), DbError>;
    
    // ==================== 节点管理 ====================
    
    /// 添加节点
    async fn add_server(
        &self,
        name: &str,
        host: &str,
        port: u16,
        color: Option<&str>,
        server_id: Option<i32>,
        edition: Option<&str>,
    ) -> Result<i32, DbError>;
    
    /// 获取所有节点
    async fn get_all_servers(&self) -> Result<Vec<Server>, DbError>;
    
    /// 获取单个节点
    async fn get_server(&self, id: i32) -> Result<Option<Server>, DbError>;
    
    /// 删除节点
    async fn delete_server(&self, id: i32) -> Result<(), DbError>;
    
    // ==================== 状态记录 ====================
    
    /// 记录状态日志
    async fn log_status(&self, entry: &StatusLogEntry) -> Result<(), DbError>;
    
    /// 批量记录状态日志
    async fn log_status_batch(&self, entries: &[StatusLogEntry]) -> Result<(), DbError>;
    
    /// 获取节点最新状态
    async fn get_server_latest_status(&self, server_id: i32) -> Result<Option<StatusLog>, DbError>;
    
    /// 获取节点历史记录
    async fn get_server_history(
        &self,
        server_id: i32,
        limit: i32,
    ) -> Result<Vec<StatusLog>, DbError>;
    
    /// 获取节点指定时间范围的历史记录
    async fn get_server_history_range(
        &self,
        server_id: i32,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<StatusLog>, DbError>;
    
    /// 获取所有节点的最新状态
    async fn get_all_latest_status(&self) -> Result<Vec<StatusLog>, DbError>;
    
    /// 获取所有节点的历史记录（聚合）
    async fn get_all_history(
        &self,
        hours: u32,
    ) -> Result<std::collections::HashMap<i32, Vec<StatusLog>>, DbError>;
    
    /// 清理旧记录
    async fn cleanup_old_records(&self, days: u32) -> Result<u64, DbError>;
    
    // ==================== 玩家会话 ====================
    
    /// 更新玩家会话
    async fn update_player_sessions(
        &self,
        server_id: i32,
        sample_players: &[String],
        timestamp: DateTime<Utc>,
    ) -> Result<(), DbError>;
    
    /// 获取节点上的在线玩家
    async fn get_online_players(&self, server_id: i32) -> Result<Vec<PlayerSession>, DbError>;
    
    /// 获取所有在线玩家
    async fn get_all_online_players(&self) -> Result<Vec<PlayerSession>, DbError>;
    
    /// 获取节点上的所有玩家会话记录
    async fn get_all_player_sessions(&self, server_id: i32) -> Result<Vec<PlayerSession>, DbError>;
    
    /// 获取玩家历史会话
    async fn get_player_history(
        &self,
        player_name: &str,
        days: Option<u32>,
    ) -> Result<Vec<PlayerSessionHistory>, DbError>;
    
    /// 获取所有玩家名称
    async fn get_all_player_names(&self) -> Result<Vec<String>, DbError>;
    
    /// 获取玩家详情
    async fn get_player_detail(&self, player_name: &str) -> Result<Option<PlayerDetail>, DbError>;
    
    /// 获取玩家热力图数据
    async fn get_player_heatmap(
        &self,
        player_name: &str,
        days: u32,
    ) -> Result<Vec<PlayerHeatmap>, DbError>;
    
    /// 结束离线玩家的会话
    async fn end_offline_sessions(
        &self,
        server_id: i32,
        online_players: &[String],
        timestamp: DateTime<Utc>,
    ) -> Result<(), DbError>;
    
    /// 聚合更新玩家会话（跨节点去重）
    /// 任意节点观测到玩家则视为上线，所有节点均未观测到则视为离线，观测失败的节点不纳入统计
    async fn update_player_sessions_aggregate(
        &self,
        observations: &[(i32, bool, Option<Vec<String>>)],
        timestamp: DateTime<Utc>,
    ) -> Result<(), DbError>;
    
    /// 关闭数据库连接（WAL checkpoint + 释放连接池）
    async fn close(&self) {}
}
