use sqlx::{SqlitePool, PgPool};

/// 运行SQLite数据库迁移
pub async fn run_migrations_sqlite(pool: &SqlitePool) -> anyhow::Result<()> {
    // 创建servers表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS servers (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            color TEXT,
            UNIQUE(host, port)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 创建status_logs表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS status_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER NOT NULL,
            timestamp DATETIME NOT NULL,
            online BOOLEAN NOT NULL,
            latency REAL,
            players_online INTEGER,
            players_max INTEGER,
            version TEXT,
            motd TEXT,
            sample_players TEXT,
            software TEXT,
            plugins TEXT,
            map_name TEXT,
            FOREIGN KEY (server_id) REFERENCES servers(id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 创建索引
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_status_logs_server_timestamp 
        ON status_logs(server_id, timestamp DESC)
        "#,
    )
    .execute(pool)
    .await?;

    // 创建player_sessions表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS player_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER NOT NULL,
            player_name TEXT NOT NULL,
            session_start DATETIME NOT NULL,
            session_end DATETIME,
            is_online BOOLEAN NOT NULL DEFAULT 1,
            FOREIGN KEY (server_id) REFERENCES servers(id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 创建索引
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_player_sessions_server_player 
        ON player_sessions(server_id, player_name, is_online)
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_player_sessions_name 
        ON player_sessions(player_name, session_start DESC)
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// 运行PostgreSQL数据库迁移
pub async fn run_migrations_postgres(pool: &PgPool) -> anyhow::Result<()> {
    // 创建servers表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS servers (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            color TEXT,
            UNIQUE(host, port)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 创建status_logs表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS status_logs (
            id SERIAL PRIMARY KEY,
            server_id INTEGER NOT NULL,
            timestamp TIMESTAMPTZ NOT NULL,
            online BOOLEAN NOT NULL,
            latency REAL,
            players_online INTEGER,
            players_max INTEGER,
            version TEXT,
            motd TEXT,
            sample_players TEXT,
            software TEXT,
            plugins TEXT,
            map_name TEXT,
            FOREIGN KEY (server_id) REFERENCES servers(id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 创建索引
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_status_logs_server_timestamp 
        ON status_logs(server_id, timestamp DESC)
        "#,
    )
    .execute(pool)
    .await?;

    // 创建player_sessions表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS player_sessions (
            id SERIAL PRIMARY KEY,
            server_id INTEGER NOT NULL,
            player_name TEXT NOT NULL,
            session_start TIMESTAMPTZ NOT NULL,
            session_end TIMESTAMPTZ,
            is_online BOOLEAN NOT NULL DEFAULT true,
            FOREIGN KEY (server_id) REFERENCES servers(id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 创建索引
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_player_sessions_server_player 
        ON player_sessions(server_id, player_name, is_online)
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_player_sessions_name 
        ON player_sessions(player_name, session_start DESC)
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
