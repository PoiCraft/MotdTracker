pub mod operations;
pub mod migrations;

use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};
use std::time::Duration;

/// 数据库连接池
#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// 创建新的数据库连接
    pub async fn new(db_path: &str) -> anyhow::Result<Self> {
        // 创建连接池
        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(30))
            .connect(&format!("sqlite:{}?mode=rwc", db_path))
            .await?;

        // 启用WAL模式以支持并发
        sqlx::query("PRAGMA journal_mode=WAL")
            .execute(&pool)
            .await?;

        sqlx::query("PRAGMA busy_timeout=30000")
            .execute(&pool)
            .await?;

        Ok(Self { pool })
    }

    /// 获取连接池引用
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// 初始化数据库表结构
    pub async fn init_schema(&self) -> anyhow::Result<()> {
        migrations::run_migrations(&self.pool).await
    }
}
