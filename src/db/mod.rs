pub mod operations;
pub mod migrations;
pub mod factory;

use sqlx::{SqlitePool, PgPool, sqlite::SqlitePoolOptions, postgres::PgPoolOptions};
use std::time::Duration;

/// 数据库连接类型
#[derive(Clone)]
pub(crate) enum PoolType {
    Sqlite(SqlitePool),
    Postgres(PgPool),
}

/// 数据库连接池
#[derive(Clone)]
pub struct Database {
    pub(crate) pool: PoolType,
}

// Macros to execute queries on either pool type
#[macro_export]
macro_rules! execute_query {
    ($self:expr, $query:expr) => {
        match &$self.pool {
            $crate::db::PoolType::Sqlite(pool) => $query.execute(pool).await.map(|r| r.rows_affected()),
            $crate::db::PoolType::Postgres(pool) => $query.execute(pool).await.map(|r| r.rows_affected()),
        }
    };
}

#[macro_export]
macro_rules! fetch_optional_query {
    ($self:expr, $query:expr) => {
        match &$self.pool {
            $crate::db::PoolType::Sqlite(pool) => $query.fetch_optional(pool).await,
            $crate::db::PoolType::Postgres(pool) => $query.fetch_optional(pool).await,
        }
    };
}

#[macro_export]
macro_rules! fetch_all_query {
    ($self:expr, $query:expr) => {
        match &$self.pool {
            $crate::db::PoolType::Sqlite(pool) => $query.fetch_all(pool).await,
            $crate::db::PoolType::Postgres(pool) => $query.fetch_all(pool).await,
        }
    };
}

#[macro_export]
macro_rules! fetch_one_query {
    ($self:expr, $query:expr) => {
        match &$self.pool {
            $crate::db::PoolType::Sqlite(pool) => $query.fetch_one(pool).await,
            $crate::db::PoolType::Postgres(pool) => $query.fetch_one(pool).await,
        }
    };
}

impl Database {
    /// 创建新的SQLite数据库连接
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

        Ok(Self { pool: PoolType::Sqlite(pool) })
    }

    /// 创建新的PostgreSQL数据库连接
    pub async fn new_postgres(connection_string: &str) -> anyhow::Result<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(30))
            .connect(connection_string)
            .await?;

        Ok(Self { pool: PoolType::Postgres(pool) })
    }

    /// 获取SQLite连接池引用（如果是SQLite）
    fn sqlite_pool(&self) -> Option<&SqlitePool> {
        match &self.pool {
            PoolType::Sqlite(pool) => Some(pool),
            _ => None,
        }
    }

    /// 获取PostgreSQL连接池引用（如果是PostgreSQL）
    fn postgres_pool(&self) -> Option<&PgPool> {
        match &self.pool {
            PoolType::Postgres(pool) => Some(pool),
            _ => None,
        }
    }

    /// 检查是否是PostgreSQL
    pub fn is_postgres(&self) -> bool {
        matches!(self.pool, PoolType::Postgres(_))
    }

    /// 初始化数据库表结构
    pub async fn init_schema(&self) -> anyhow::Result<()> {
        match &self.pool {
            PoolType::Sqlite(pool) => migrations::run_migrations_sqlite(pool).await,
            PoolType::Postgres(pool) => migrations::run_migrations_postgres(pool).await,
        }
    }
}

