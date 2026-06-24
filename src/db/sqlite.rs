//! SQLite 数据库实现

use async_trait::async_trait;
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::collections::{HashMap, HashSet};
use std::path::Path;

use super::{Database, DbError};
use crate::models::*;
use crate::utils::time::{fix_db_time, format_gmt8_naive, now_gmt8, Gmt8Time};

pub struct SqliteDatabase {
    pool: SqlitePool,
}

impl SqliteDatabase {
    pub async fn new(database_path: &str) -> Result<Self, DbError> {
        if let Some(parent) = Path::new(database_path).parent() {
            if !parent.as_os_str().is_empty() && !parent.exists() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| DbError::ConnectionError(format!("创建数据库目录失败: {}", e)))?;
            }
        }
        let url = format!("sqlite:{}?mode=rwc", database_path);
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&url)
            .await
            .map_err(|e| DbError::ConnectionError(e.to_string()))?;
        sqlx::query("PRAGMA journal_mode=WAL")
            .execute(&pool)
            .await
            .map_err(|e| DbError::QueryError(e.to_string()))?;
        sqlx::query("PRAGMA busy_timeout=30000")
            .execute(&pool)
            .await
            .map_err(|e| DbError::QueryError(e.to_string()))?;
        Ok(Self { pool })
    }
}

#[async_trait]
impl Database for SqliteDatabase {
    async fn init_database(&self) -> Result<(), DbError> {
        // ==================== server_groups ====================
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS server_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT (datetime('now')), updated_at DATETIME NOT NULL DEFAULT (datetime('now')))"
        ).execute(&self.pool).await.map_err(|e| DbError::MigrationError(e.to_string()))?;

        // ==================== servers ====================
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS servers (id TEXT PRIMARY KEY, group_id TEXT, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT (datetime('now')), updated_at DATETIME NOT NULL DEFAULT (datetime('now')))"
        ).execute(&self.pool).await.map_err(|e| DbError::MigrationError(e.to_string()))?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_servers_group_id ON servers(group_id)")
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::MigrationError(e.to_string()))?;

        // ==================== nodes (原 node_config) ====================
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, server_id TEXT NOT NULL, name TEXT NOT NULL, host TEXT NOT NULL, port INTEGER NOT NULL, edition TEXT NOT NULL DEFAULT 'java', color TEXT, enabled INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT (datetime('now')), updated_at DATETIME NOT NULL DEFAULT (datetime('now')))"
        ).execute(&self.pool).await.map_err(|e| DbError::MigrationError(e.to_string()))?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_nodes_server_id ON nodes(server_id)")
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::MigrationError(e.to_string()))?;

        // ==================== status_logs ====================
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS status_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, node_id TEXT NOT NULL, timestamp DATETIME NOT NULL, online INTEGER NOT NULL, latency REAL, players_online INTEGER, players_max INTEGER, version TEXT, motd TEXT, sample_players TEXT, software TEXT, plugins TEXT, map TEXT, edition TEXT)"
        ).execute(&self.pool).await.map_err(|e| DbError::MigrationError(e.to_string()))?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_status_logs_timestamp ON status_logs(timestamp)",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_status_logs_node_id ON status_logs(node_id)")
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::MigrationError(e.to_string()))?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_status_logs_node_timestamp ON status_logs(node_id, timestamp DESC)")
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::MigrationError(e.to_string()))?;

        // ==================== player_sessions ====================
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS player_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, node_id TEXT NOT NULL, player_name TEXT NOT NULL, first_seen DATETIME NOT NULL, session_start DATETIME, last_seen DATETIME NOT NULL, online INTEGER NOT NULL DEFAULT 0, duration_seconds INTEGER, UNIQUE(node_id, player_name))"
        ).execute(&self.pool).await.map_err(|e| DbError::MigrationError(e.to_string()))?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_player_sessions_player_name ON player_sessions(player_name)").execute(&self.pool).await.map_err(|e| DbError::MigrationError(e.to_string()))?;

        // ==================== player_session_history (按 server 聚合) ====================
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS player_session_history (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT NOT NULL, player_name TEXT NOT NULL, session_start DATETIME NOT NULL, session_end DATETIME NOT NULL)"
        ).execute(&self.pool).await.map_err(|e| DbError::MigrationError(e.to_string()))?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_player_session_history_player_name ON player_session_history(player_name)").execute(&self.pool).await.map_err(|e| DbError::MigrationError(e.to_string()))?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_player_session_history_server_id ON player_session_history(server_id)").execute(&self.pool).await.map_err(|e| DbError::MigrationError(e.to_string()))?;

        // ==================== admin ====================
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT (datetime('now')), last_login_at DATETIME)"
        ).execute(&self.pool).await.map_err(|e| DbError::MigrationError(e.to_string()))?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS admin_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at DATETIME NOT NULL, created_at DATETIME NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE)"
        ).execute(&self.pool).await.map_err(|e| DbError::MigrationError(e.to_string()))?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token)")
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::MigrationError(e.to_string()))?;

        // ==================== app_config ====================
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME NOT NULL DEFAULT (datetime('now')))"
        ).execute(&self.pool).await.map_err(|e| DbError::MigrationError(e.to_string()))?;

        Ok(())
    }

    // ==================== 服务器组 ====================
    async fn create_server_group(&self, name: &str, sort_order: i32) -> Result<String, DbError> {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO server_groups (id, name, sort_order) VALUES (?, ?, ?)")
            .bind(&id)
            .bind(name)
            .bind(sort_order)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::InsertError(e.to_string()))?;
        Ok(id)
    }
    async fn get_all_server_groups(&self) -> Result<Vec<ServerGroup>, DbError> {
        sqlx::query_as::<_, ServerGroup>("SELECT id, name, sort_order, created_at, updated_at FROM server_groups ORDER BY sort_order, created_at").fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn get_server_group(&self, id: &str) -> Result<Option<ServerGroup>, DbError> {
        sqlx::query_as::<_, ServerGroup>(
            "SELECT id, name, sort_order, created_at, updated_at FROM server_groups WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn update_server_group(
        &self,
        id: &str,
        name: &str,
        sort_order: i32,
    ) -> Result<(), DbError> {
        sqlx::query("UPDATE server_groups SET name = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?").bind(name).bind(sort_order).bind(id).execute(&self.pool).await.map_err(|e| DbError::UpdateError(e.to_string()))?;
        Ok(())
    }
    async fn delete_server_group(&self, id: &str) -> Result<(), DbError> {
        sqlx::query("UPDATE servers SET group_id = NULL WHERE group_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::UpdateError(e.to_string()))?;
        sqlx::query("DELETE FROM server_groups WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::DeleteError(e.to_string()))?;
        Ok(())
    }

    // ==================== 服务器实例 ====================
    async fn create_server(
        &self,
        name: &str,
        group_id: Option<&str>,
        sort_order: i32,
    ) -> Result<String, DbError> {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO servers (id, group_id, name, sort_order) VALUES (?, ?, ?, ?)")
            .bind(&id)
            .bind(group_id)
            .bind(name)
            .bind(sort_order)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::InsertError(e.to_string()))?;
        Ok(id)
    }
    async fn get_all_servers(&self) -> Result<Vec<ServerEntity>, DbError> {
        sqlx::query_as::<_, ServerEntity>("SELECT id, group_id, name, sort_order, created_at, updated_at FROM servers ORDER BY sort_order, created_at").fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn get_servers_by_group(&self, group_id: &str) -> Result<Vec<ServerEntity>, DbError> {
        sqlx::query_as::<_, ServerEntity>("SELECT id, group_id, name, sort_order, created_at, updated_at FROM servers WHERE group_id = ? ORDER BY sort_order").bind(group_id).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn get_server(&self, id: &str) -> Result<Option<ServerEntity>, DbError> {
        sqlx::query_as::<_, ServerEntity>("SELECT id, group_id, name, sort_order, created_at, updated_at FROM servers WHERE id = ?").bind(id).fetch_optional(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn update_server(
        &self,
        id: &str,
        name: &str,
        group_id: Option<&str>,
        sort_order: i32,
    ) -> Result<(), DbError> {
        sqlx::query("UPDATE servers SET name = ?, group_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?").bind(name).bind(group_id).bind(sort_order).bind(id).execute(&self.pool).await.map_err(|e| DbError::UpdateError(e.to_string()))?;
        Ok(())
    }
    async fn delete_server(&self, id: &str) -> Result<(), DbError> {
        // 将孤立节点的 server_id 设为 NULL，与 delete_server_group 保持一致
        sqlx::query("UPDATE nodes SET server_id = NULL WHERE server_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::UpdateError(e.to_string()))?;
        sqlx::query("DELETE FROM servers WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::DeleteError(e.to_string()))?;
        Ok(())
    }

    // ==================== 节点 ====================
    async fn add_node(&self, params: &AddNodeParams<'_>) -> Result<String, DbError> {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO nodes (id, server_id, name, host, port, edition, color, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(&id)
            .bind(params.server_id)
            .bind(params.name)
            .bind(params.host)
            .bind(params.port as i32)
            .bind(params.edition)
            .bind(params.color)
            .bind(params.enabled)
            .bind(params.sort_order)
            .execute(&self.pool).await.map_err(|e| DbError::InsertError(e.to_string()))?;
        Ok(id)
    }
    async fn get_all_nodes(&self) -> Result<Vec<Node>, DbError> {
        sqlx::query_as::<_, Node>("SELECT id, server_id, name, host, port, edition, color, enabled, sort_order, created_at, updated_at FROM nodes ORDER BY sort_order, created_at").fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn get_enabled_nodes(&self) -> Result<Vec<Node>, DbError> {
        sqlx::query_as::<_, Node>("SELECT id, server_id, name, host, port, edition, color, enabled, sort_order, created_at, updated_at FROM nodes WHERE enabled = 1 ORDER BY sort_order, created_at").fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn get_nodes_by_server(&self, server_id: &str) -> Result<Vec<Node>, DbError> {
        sqlx::query_as::<_, Node>("SELECT id, server_id, name, host, port, edition, color, enabled, sort_order, created_at, updated_at FROM nodes WHERE server_id = ? ORDER BY sort_order").bind(server_id).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn get_node(&self, id: &str) -> Result<Option<Node>, DbError> {
        sqlx::query_as::<_, Node>("SELECT id, server_id, name, host, port, edition, color, enabled, sort_order, created_at, updated_at FROM nodes WHERE id = ?").bind(id).fetch_optional(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn update_node(&self, id: &str, params: &UpdateNodeParams<'_>) -> Result<(), DbError> {
        sqlx::query("UPDATE nodes SET name = ?, host = ?, port = ?, edition = ?, color = ?, enabled = ?, server_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(params.name)
            .bind(params.host)
            .bind(params.port as i32)
            .bind(params.edition)
            .bind(params.color)
            .bind(params.enabled)
            .bind(params.server_id)
            .bind(params.sort_order)
            .bind(id)
            .execute(&self.pool).await.map_err(|e| DbError::UpdateError(e.to_string()))?;
        Ok(())
    }
    async fn delete_node(&self, id: &str) -> Result<(), DbError> {
        sqlx::query("DELETE FROM nodes WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::DeleteError(e.to_string()))?;
        Ok(())
    }
    async fn swap_node_sort_orders(
        &self,
        id1: &str,
        sort_order1: i32,
        id2: &str,
        sort_order2: i32,
    ) -> Result<(), DbError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DbError::QueryError(e.to_string()))?;
        sqlx::query("UPDATE nodes SET sort_order = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(sort_order1)
            .bind(id1)
            .execute(&mut *tx)
            .await
            .map_err(|e| DbError::UpdateError(e.to_string()))?;
        sqlx::query("UPDATE nodes SET sort_order = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(sort_order2)
            .bind(id2)
            .execute(&mut *tx)
            .await
            .map_err(|e| DbError::UpdateError(e.to_string()))?;
        tx.commit()
            .await
            .map_err(|e| DbError::UpdateError(e.to_string()))?;
        Ok(())
    }

    // ==================== 状态日志 ====================
    async fn log_status(&self, entry: &StatusLogEntry) -> Result<(), DbError> {
        sqlx::query("INSERT INTO status_logs (node_id, timestamp, online, latency, players_online, players_max, version, motd, sample_players, software, plugins, map, edition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(&entry.node_id).bind(format_gmt8_naive(entry.timestamp)).bind(entry.online).bind(entry.latency).bind(entry.players_online).bind(entry.players_max).bind(&entry.version).bind(&entry.motd).bind(&entry.sample_players).bind(&entry.software).bind(&entry.plugins).bind(&entry.map).bind(&entry.edition).execute(&self.pool).await.map_err(|e| DbError::InsertError(e.to_string()))?;
        Ok(())
    }
    async fn log_status_batch(&self, entries: &[StatusLogEntry]) -> Result<(), DbError> {
        if entries.is_empty() {
            return Ok(());
        }
        // SQLite 默认单条 SQL 最多 999 个参数；status_logs 有 13 列
        const COLUMNS: usize = 13;
        const MAX_PARAMS: usize = 999;
        const BATCH_SIZE: usize = MAX_PARAMS / COLUMNS; // 76

        for chunk in entries.chunks(BATCH_SIZE) {
            let mut builder = sqlx::QueryBuilder::new(
                "INSERT INTO status_logs (node_id, timestamp, online, latency, players_online, players_max, version, motd, sample_players, software, plugins, map, edition) "
            );
            builder.push_values(chunk, |mut b, entry| {
                b.push_bind(&entry.node_id)
                    .push_bind(format_gmt8_naive(entry.timestamp))
                    .push_bind(entry.online)
                    .push_bind(entry.latency)
                    .push_bind(entry.players_online)
                    .push_bind(entry.players_max)
                    .push_bind(&entry.version)
                    .push_bind(&entry.motd)
                    .push_bind(&entry.sample_players)
                    .push_bind(&entry.software)
                    .push_bind(&entry.plugins)
                    .push_bind(&entry.map)
                    .push_bind(&entry.edition);
            });
            builder
                .build()
                .execute(&self.pool)
                .await
                .map_err(|e| DbError::InsertError(e.to_string()))?;
        }
        Ok(())
    }
    async fn get_node_latest_status(&self, node_id: &str) -> Result<Option<StatusLog>, DbError> {
        sqlx::query_as::<_, StatusLog>("SELECT id, node_id, timestamp, online, latency, players_online, players_max, version, motd, sample_players, software, plugins, map, edition FROM status_logs WHERE node_id = ? ORDER BY timestamp DESC LIMIT 1").bind(node_id).fetch_optional(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn get_node_history(&self, node_id: &str, limit: i32) -> Result<Vec<StatusLog>, DbError> {
        sqlx::query_as::<_, StatusLog>("SELECT id, node_id, timestamp, online, latency, players_online, players_max, version, motd, sample_players, software, plugins, map, edition FROM status_logs WHERE node_id = ? ORDER BY timestamp DESC LIMIT ?").bind(node_id).bind(limit).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn get_node_history_range(
        &self,
        node_id: &str,
        start: Gmt8Time,
        end: Gmt8Time,
    ) -> Result<Vec<StatusLog>, DbError> {
        sqlx::query_as::<_, StatusLog>("SELECT id, node_id, timestamp, online, latency, players_online, players_max, version, motd, sample_players, software, plugins, map, edition FROM status_logs WHERE node_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC").bind(node_id).bind(format_gmt8_naive(start)).bind(format_gmt8_naive(end)).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn get_all_latest_status(&self) -> Result<Vec<StatusLog>, DbError> {
        // 使用复合索引优化的最新记录查询：先按 node_id + timestamp DESC 找到每组最新记录
        sqlx::query_as::<_, StatusLog>(
            "SELECT s.id, s.node_id, s.timestamp, s.online, s.latency, s.players_online, s.players_max, s.version, s.motd, s.sample_players, s.software, s.plugins, s.map, s.edition \
             FROM status_logs s \
             INNER JOIN ( \
                 SELECT node_id, MAX(timestamp) as max_ts \
                 FROM status_logs \
                 GROUP BY node_id \
             ) m ON s.node_id = m.node_id AND s.timestamp = m.max_ts"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn get_all_history(
        &self,
        hours: u32,
    ) -> Result<HashMap<String, Vec<StatusLog>>, DbError> {
        let start_time = now_gmt8() - chrono::Duration::hours(hours as i64);
        let logs: Vec<StatusLog> = sqlx::query_as::<_, StatusLog>("SELECT id, node_id, timestamp, online, latency, players_online, players_max, version, motd, sample_players, software, plugins, map, edition FROM status_logs WHERE timestamp >= ? ORDER BY timestamp ASC").bind(format_gmt8_naive(start_time)).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))?;
        let mut result: HashMap<String, Vec<StatusLog>> = HashMap::new();
        for log in logs {
            result.entry(log.node_id.clone()).or_default().push(log);
        }
        Ok(result)
    }
    async fn get_server_history(
        &self,
        server_id: &str,
        hours: u32,
    ) -> Result<Vec<StatusLog>, DbError> {
        let start_time = now_gmt8() - chrono::Duration::hours(hours as i64);
        sqlx::query_as::<_, StatusLog>("SELECT s.id, s.node_id, s.timestamp, s.online, s.latency, s.players_online, s.players_max, s.version, s.motd, s.sample_players, s.software, s.plugins, s.map, s.edition FROM status_logs s INNER JOIN nodes n ON s.node_id = n.id WHERE s.timestamp >= ? AND n.server_id = ? ORDER BY s.timestamp ASC").bind(format_gmt8_naive(start_time)).bind(server_id).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn cleanup_old_records(&self, days: u32) -> Result<u64, DbError> {
        let cutoff = now_gmt8() - chrono::Duration::days(days as i64);
        let result = sqlx::query("DELETE FROM status_logs WHERE timestamp < ?")
            .bind(format_gmt8_naive(cutoff))
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::DeleteError(e.to_string()))?;
        Ok(result.rows_affected())
    }

    // ==================== 玩家会话（每节点独立） ====================
    async fn update_player_sessions(
        &self,
        node_id: &str,
        sample_players: &[String],
        timestamp: Gmt8Time,
    ) -> Result<(), DbError> {
        if sample_players.is_empty() {
            return Ok(());
        }
        let ts_str = format_gmt8_naive(timestamp);
        // 使用事务批量 INSERT ... ON CONFLICT，避免逐条执行
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DbError::QueryError(e.to_string()))?;
        for player_name in sample_players {
            sqlx::query("INSERT INTO player_sessions (node_id, player_name, first_seen, session_start, last_seen, online) VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT(node_id, player_name) DO UPDATE SET last_seen = ?, online = 1, session_start = COALESCE(session_start, ?), duration_seconds = CASE WHEN session_start IS NOT NULL THEN CAST((julianday(?) - julianday(session_start)) * 86400 AS INTEGER) ELSE NULL END")
                .bind(node_id)
                .bind(player_name)
                .bind(&ts_str)
                .bind(&ts_str)
                .bind(&ts_str)
                .bind(&ts_str)
                .bind(&ts_str)
                .bind(&ts_str)
                .execute(&mut *tx)
                .await
                .map_err(|e| DbError::InsertError(e.to_string()))?;
        }
        tx.commit()
            .await
            .map_err(|e| DbError::InsertError(e.to_string()))?;
        Ok(())
    }
    async fn get_online_players_on_node(
        &self,
        node_id: &str,
    ) -> Result<Vec<PlayerSession>, DbError> {
        let rows = sqlx::query_as::<_, PlayerSession>("SELECT id, node_id, player_name, first_seen, session_start, last_seen, online, duration_seconds FROM player_sessions WHERE node_id = ? AND online = 1").bind(node_id).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))?;
        Ok(rows.into_iter().map(Self::fix_session_times).collect())
    }
    async fn get_player_sessions_by_node(
        &self,
        node_id: &str,
    ) -> Result<Vec<PlayerSession>, DbError> {
        let rows = sqlx::query_as::<_, PlayerSession>("SELECT id, node_id, player_name, first_seen, session_start, last_seen, online, duration_seconds FROM player_sessions WHERE node_id = ? ORDER BY last_seen DESC").bind(node_id).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))?;
        Ok(rows.into_iter().map(Self::fix_session_times).collect())
    }
    async fn get_all_player_sessions(
        &self,
        server_id: &str,
    ) -> Result<Vec<PlayerSession>, DbError> {
        let rows = sqlx::query_as::<_, PlayerSession>("SELECT ps.id, ps.node_id, ps.player_name, ps.first_seen, ps.session_start, ps.last_seen, ps.online, ps.duration_seconds FROM player_sessions ps INNER JOIN nodes n ON ps.node_id = n.id WHERE n.server_id = ? ORDER BY ps.last_seen DESC").bind(server_id).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))?;
        Ok(rows.into_iter().map(Self::fix_session_times).collect())
    }
    async fn get_all_player_sessions_flat(&self) -> Result<Vec<PlayerSession>, DbError> {
        let rows = sqlx::query_as::<_, PlayerSession>("SELECT id, node_id, player_name, first_seen, session_start, last_seen, online, duration_seconds FROM player_sessions ORDER BY last_seen DESC").fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))?;
        Ok(rows.into_iter().map(Self::fix_session_times).collect())
    }
    async fn get_player_history(
        &self,
        player_name: &str,
        days: Option<u32>,
    ) -> Result<Vec<PlayerSessionHistory>, DbError> {
        let days = days.unwrap_or(30);
        let cutoff = now_gmt8() - chrono::Duration::days(days as i64);
        let rows = sqlx::query_as::<_, PlayerSessionHistory>("SELECT id, server_id, player_name, session_start, session_end FROM player_session_history WHERE player_name = ? AND session_end >= ? ORDER BY session_end DESC").bind(player_name).bind(format_gmt8_naive(cutoff)).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))?;
        Ok(rows.into_iter().map(Self::fix_history_times).collect())
    }
    async fn get_all_player_names(&self) -> Result<Vec<String>, DbError> {
        let rows: Vec<(String,)> = sqlx::query_as("SELECT DISTINCT player_name FROM player_sessions UNION SELECT DISTINCT player_name FROM player_session_history").fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))?;
        Ok(rows.into_iter().map(|r| r.0).collect())
    }

    // ==================== 玩家详情 ====================
    async fn get_player_detail(&self, player_name: &str) -> Result<Option<PlayerDetail>, DbError> {
        let all_nodes = self.get_all_nodes().await.unwrap_or_default();
        let all_servers = self.get_all_servers().await.unwrap_or_default();
        let sessions = self.get_player_sessions_by_name(player_name).await?;

        if sessions.is_empty() {
            // 检查是否有历史记录
            let hist = self.get_player_history(player_name, Some(1)).await?;
            if hist.is_empty() {
                return Ok(None);
            }
            return Ok(Some(PlayerDetail {
                player_name: player_name.to_string(),
                online: false,
                session_start: None,
                last_seen: hist.first().map(|h| h.session_end).unwrap_or_else(now_gmt8),
                duration_seconds: None,
                servers: Vec::new(),
                sessions: hist,
            }));
        }

        let is_online = sessions.iter().any(|s| s.online);
        let latest = sessions.iter().max_by_key(|s| s.last_seen);
        let history = self.get_player_history(player_name, Some(30)).await?;

        let mut server_entries = Vec::new();
        for s in &sessions {
            let node = all_nodes.iter().find(|n| n.id == s.node_id);
            let server = node.and_then(|n| all_servers.iter().find(|sv| sv.id == n.server_id));
            server_entries.push(PlayerServerEntry {
                node_id: s.node_id.clone(),
                node_name: node.map(|n| n.name.clone()).unwrap_or_default(),
                server_id: server.map(|sv| sv.id.clone()).unwrap_or_default(),
                server_name: server.map(|sv| sv.name.clone()).unwrap_or_default(),
                online: s.online,
                first_seen: s.first_seen,
                last_seen: s.last_seen,
            });
        }

        Ok(Some(PlayerDetail {
            player_name: player_name.to_string(),
            online: is_online,
            session_start: latest.and_then(|s| s.session_start),
            last_seen: latest.map(|s| s.last_seen).unwrap_or_else(now_gmt8),
            duration_seconds: latest
                .filter(|s| s.online)
                .and_then(|s| s.session_start)
                .map(|start| (now_gmt8() - start).num_seconds()),
            servers: server_entries,
            sessions: history,
        }))
    }
    async fn get_player_heatmap(
        &self,
        player_name: &str,
        days: u32,
    ) -> Result<Vec<PlayerHeatmap>, DbError> {
        let since = now_gmt8() - chrono::Duration::days(days as i64);
        let rows: Vec<PlayerHeatmap> = sqlx::query_as("SELECT CAST((strftime('%w', session_end) + 6) % 7 AS INTEGER) as weekday, CAST(strftime('%H', session_end) AS INTEGER) as hour, COUNT(*) as count FROM player_session_history WHERE player_name = ? AND session_end >= ? GROUP BY weekday, hour ORDER BY weekday, hour").bind(player_name).bind(format_gmt8_naive(since)).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))?;
        Ok(rows)
    }

    async fn get_player_weekly_stats(
        &self,
        player_name: &str,
    ) -> Result<PlayerWeeklyStats, DbError> {
        let since = now_gmt8() - chrono::Duration::days(7);
        let rows: Vec<(String, i64)> = sqlx::query_as(
            "SELECT DATE(session_end) as date, CAST(ROUND(SUM((julianday(session_end) - julianday(session_start)) * 1440)) AS INTEGER) as total_minutes FROM player_session_history WHERE player_name = ? AND session_end >= ? GROUP BY DATE(session_end) ORDER BY date"
        ).bind(player_name).bind(format_gmt8_naive(since)).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))?;
        Ok(PlayerWeeklyStats {
            player_name: player_name.to_string(),
            daily_stats: rows
                .into_iter()
                .map(|(date, total_minutes)| DailyStats {
                    date,
                    total_minutes,
                })
                .collect(),
        })
    }

    async fn end_offline_sessions(
        &self,
        node_id: &str,
        online_players: &[String],
        timestamp: Gmt8Time,
    ) -> Result<(), DbError> {
        let sessions = sqlx::query_as::<_, PlayerSession>("SELECT id, node_id, player_name, first_seen, session_start, last_seen, online, duration_seconds FROM player_sessions WHERE node_id = ? AND online = 1").bind(node_id).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))?;
        let sessions: Vec<PlayerSession> =
            sessions.into_iter().map(Self::fix_session_times).collect();
        let online_set: HashSet<&str> = online_players.iter().map(|s| s.as_str()).collect();
        let ts_str = format_gmt8_naive(timestamp);
        // 预取 node 信息（批量，避免 N+1）
        let node = self.get_node(node_id).await?;
        let server_id = node
            .as_ref()
            .map(|n| {
                if n.server_id.is_empty() {
                    "unknown".to_string()
                } else {
                    n.server_id.clone()
                }
            })
            .unwrap_or_else(|| "unknown".to_string());
        for session in &sessions {
            if !online_set.contains(session.player_name.as_str()) {
                let duration = session
                    .session_start
                    .map(|start| (timestamp - start).num_seconds());
                if let Some(start) = session.session_start {
                    let start_str = format_gmt8_naive(start);
                    let exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM player_session_history WHERE player_name = ? AND session_start = ?").bind(&session.player_name).bind(&start_str).fetch_one(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))?;
                    if exists.0 == 0 {
                        sqlx::query("INSERT INTO player_session_history (server_id, player_name, session_start, session_end) VALUES (?, ?, ?, ?)").bind(&server_id).bind(&session.player_name).bind(&start_str).bind(&ts_str).execute(&self.pool).await.map_err(|e| DbError::InsertError(e.to_string()))?;
                    }
                }
                sqlx::query("UPDATE player_sessions SET online = 0, session_start = NULL, duration_seconds = ? WHERE id = ?").bind(duration).bind(session.id).execute(&self.pool).await.map_err(|e| DbError::UpdateError(e.to_string()))?;
            }
        }
        Ok(())
    }

    async fn update_player_sessions_aggregate(
        &self,
        observations: &[(String, bool, Option<Vec<String>>)],
        timestamp: Gmt8Time,
    ) -> Result<(), DbError> {
        let mut global_players: HashMap<String, bool> = HashMap::new();
        for (_, _, players_opt) in observations {
            if let Some(players) = players_opt {
                for p in players {
                    global_players.insert(p.clone(), true);
                }
            }
        }
        for (node_id, online, players_opt) in observations {
            let players: &[String] = players_opt.as_deref().unwrap_or(&[]);
            if !players.is_empty() {
                self.update_player_sessions(node_id, players, timestamp)
                    .await?;
            }
            // 即使没有 sample_players（服务器返回 0 人在线但无 sample 字段），
            // 也要调用 end_offline_sessions 来正确关闭已离线的玩家会话。
            // 仅当节点在线时才需要处理（离线节点由上层逻辑处理）。
            if *online || !players.is_empty() {
                self.end_offline_sessions(node_id, players, timestamp)
                    .await?;
            }
        }
        Ok(())
    }

    // ==================== 管理员认证 ====================
    async fn has_admin_user(&self) -> Result<bool, DbError> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM admin_users")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DbError::QueryError(e.to_string()))?;
        Ok(row.0 > 0)
    }
    async fn create_admin_user(&self, username: &str, password_hash: &str) -> Result<i64, DbError> {
        let r = sqlx::query("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)")
            .bind(username)
            .bind(password_hash)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::InsertError(e.to_string()))?;
        Ok(r.last_insert_rowid())
    }
    async fn get_admin_user(&self, username: &str) -> Result<Option<AdminUser>, DbError> {
        sqlx::query_as::<_, AdminUser>("SELECT id, username, password_hash, created_at, last_login_at FROM admin_users WHERE username = ?").bind(username).fetch_optional(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn update_admin_password(
        &self,
        user_id: i64,
        password_hash: &str,
    ) -> Result<(), DbError> {
        sqlx::query("UPDATE admin_users SET password_hash = ? WHERE id = ?")
            .bind(password_hash)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::UpdateError(e.to_string()))?;
        Ok(())
    }
    async fn update_admin_last_login(&self, user_id: i64) -> Result<(), DbError> {
        let now = format_gmt8_naive(now_gmt8());
        sqlx::query("UPDATE admin_users SET last_login_at = ? WHERE id = ?")
            .bind(&now)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::UpdateError(e.to_string()))?;
        Ok(())
    }
    async fn create_session(
        &self,
        user_id: i64,
        token: &str,
        expires_at: Gmt8Time,
    ) -> Result<(), DbError> {
        sqlx::query("INSERT INTO admin_sessions (user_id, token, expires_at) VALUES (?, ?, ?)")
            .bind(user_id)
            .bind(token)
            .bind(format_gmt8_naive(expires_at))
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::InsertError(e.to_string()))?;
        Ok(())
    }
    async fn validate_session(&self, token: &str) -> Result<Option<AdminUser>, DbError> {
        let now = format_gmt8_naive(now_gmt8());
        sqlx::query_as::<_, AdminUser>("SELECT u.id, u.username, u.password_hash, u.created_at, u.last_login_at FROM admin_users u INNER JOIN admin_sessions s ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?").bind(token).bind(&now).fetch_optional(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn cleanup_expired_sessions(&self) -> Result<u64, DbError> {
        let now = format_gmt8_naive(now_gmt8());
        let r = sqlx::query("DELETE FROM admin_sessions WHERE expires_at <= ?")
            .bind(&now)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::DeleteError(e.to_string()))?;
        Ok(r.rows_affected())
    }
    async fn delete_session(&self, token: &str) -> Result<(), DbError> {
        sqlx::query("DELETE FROM admin_sessions WHERE token = ?")
            .bind(token)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::DeleteError(e.to_string()))?;
        Ok(())
    }

    // ==================== 应用配置 ====================
    async fn get_app_config(&self, key: &str) -> Result<Option<String>, DbError> {
        let r: Option<(String,)> = sqlx::query_as("SELECT value FROM app_config WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DbError::QueryError(e.to_string()))?;
        Ok(r.map(|x| x.0))
    }
    async fn set_app_config(&self, key: &str, value: &str) -> Result<(), DbError> {
        sqlx::query("INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')").bind(key).bind(value).bind(value).execute(&self.pool).await.map_err(|e| DbError::InsertError(e.to_string()))?;
        Ok(())
    }
    async fn get_all_app_config(&self) -> Result<Vec<AppConfigEntry>, DbError> {
        sqlx::query_as::<_, AppConfigEntry>(
            "SELECT key, value, updated_at FROM app_config ORDER BY key",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))
    }
    async fn delete_app_config(&self, key: &str) -> Result<(), DbError> {
        sqlx::query("DELETE FROM app_config WHERE key = ?")
            .bind(key)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::DeleteError(e.to_string()))?;
        Ok(())
    }

    async fn close(&self) {
        if let Err(e) = sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
            .execute(&self.pool)
            .await
        {
            tracing::warn!("WAL checkpoint failed: {}", e);
        }
        self.pool.close().await;
        tracing::info!("数据库连接已关闭");
    }
}

// 辅助方法
impl SqliteDatabase {
    async fn get_player_sessions_by_name(
        &self,
        player_name: &str,
    ) -> Result<Vec<PlayerSession>, DbError> {
        let sessions = sqlx::query_as::<_, PlayerSession>("SELECT id, node_id, player_name, first_seen, session_start, last_seen, online, duration_seconds FROM player_sessions WHERE player_name = ? ORDER BY last_seen DESC").bind(player_name).fetch_all(&self.pool).await.map_err(|e| DbError::QueryError(e.to_string()))?;
        Ok(sessions.into_iter().map(Self::fix_session_times).collect())
    }

    /// 修正从数据库读取的时间字段偏移。
    ///
    /// SQLite 存储的是 GMT+8 墙钟时间，但 sqlx 解码 naive datetime 时按 UTC 解释，
    /// 导致所有时间字段偏移了 8 小时。此函数将墙钟值重新赋予 +08:00 偏移。
    fn fix_session_times(mut s: PlayerSession) -> PlayerSession {
        s.first_seen = fix_db_time(s.first_seen);
        s.session_start = s.session_start.map(fix_db_time);
        s.last_seen = fix_db_time(s.last_seen);
        s
    }

    /// 修正 PlayerSessionHistory 的时间字段偏移
    fn fix_history_times(mut h: PlayerSessionHistory) -> PlayerSessionHistory {
        h.session_start = fix_db_time(h.session_start);
        h.session_end = fix_db_time(h.session_end);
        h
    }
}
