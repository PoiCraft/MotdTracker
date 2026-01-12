use crate::db::Database;
use crate::models::config::AppConfig;

/// 创建数据库实例（根据配置选择SQLite或PostgreSQL）
pub async fn create_database(config: &AppConfig) -> anyhow::Result<Database> {
    if let Some(pg_config) = &config.postgresql {
        // 使用PostgreSQL
        let connection_string = format!(
            "postgres://{}:{}@{}:{}/{}",
            pg_config.user,
            pg_config.password,
            pg_config.host,
            pg_config.port,
            pg_config.database
        );
        tracing::info!("使用PostgreSQL数据库: {}:{}/{}", 
            pg_config.host, pg_config.port, pg_config.database);
        Database::new_postgres(&connection_string).await
    } else {
        // 使用SQLite
        tracing::info!("使用SQLite数据库: {}", config.database);
        Database::new(&config.database).await
    }
}
