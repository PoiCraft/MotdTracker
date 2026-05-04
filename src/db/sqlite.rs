//! SQLite 数据库实现

use async_trait::async_trait;
use chrono::{DateTime, Datelike, Timelike, Utc};
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::collections::{HashMap, HashSet};
use std::path::Path;

use super::{Database, DbError};
use crate::models::*;
use crate::utils::time::{format_gmt8_naive, now_gmt8};

/// SQLite 数据库
pub struct SqliteDatabase {
    pool: SqlitePool,
}

impl SqliteDatabase {
    /// 创建新的 SQLite 数据库连接
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

        // 启用 WAL 模式
        sqlx::query("PRAGMA journal_mode=WAL")
            .execute(&pool)
            .await
            .map_err(|e| DbError::QueryError(e.to_string()))?;

        // 设置 busy_timeout
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
        // 创建 servers 表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS servers (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                color TEXT,
                edition TEXT DEFAULT 'java'
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

        // 迁移: 为 servers 表添加 edition 列（已有数据库兼容）
        let _ = sqlx::query("ALTER TABLE servers ADD COLUMN edition TEXT DEFAULT 'java'")
            .execute(&self.pool)
            .await;

        // 创建唯一索引
        sqlx::query(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_servers_host_port ON servers(host, port)",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

        // 创建 status_logs 表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS status_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                timestamp DATETIME NOT NULL,
                online INTEGER NOT NULL,
                latency REAL,
                players_online INTEGER,
                players_max INTEGER,
                version TEXT,
                motd TEXT,
                sample_players TEXT,
                software TEXT,
                plugins TEXT,
                map TEXT,
                edition TEXT,
                FOREIGN KEY (server_id) REFERENCES servers(id)
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

        // 迁移: 为 status_logs 表添加 edition 列（已有数据库兼容）
        let _ = sqlx::query("ALTER TABLE status_logs ADD COLUMN edition TEXT")
            .execute(&self.pool)
            .await;

        // 创建索引
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_status_logs_timestamp ON status_logs(timestamp)",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_status_logs_server_id ON status_logs(server_id)",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

        // 创建 player_sessions 表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS player_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                player_name TEXT NOT NULL,
                first_seen DATETIME NOT NULL,
                session_start DATETIME,
                last_seen DATETIME NOT NULL,
                online INTEGER NOT NULL DEFAULT 0,
                duration_seconds INTEGER,
                FOREIGN KEY (server_id) REFERENCES servers(id),
                UNIQUE(server_id, player_name)
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

        // 创建 player_session_history 表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS player_session_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                player_name TEXT NOT NULL,
                session_start DATETIME NOT NULL,
                session_end DATETIME NOT NULL,
                FOREIGN KEY (server_id) REFERENCES servers(id)
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

        // 创建索引
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_player_sessions_player_name ON player_sessions(player_name)")
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::MigrationError(e.to_string()))?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_player_session_history_player_name ON player_session_history(player_name)")
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::MigrationError(e.to_string()))?;

        Ok(())
    }

    async fn add_server(
        &self,
        name: &str,
        host: &str,
        port: u16,
        color: Option<&str>,
        server_id: Option<i32>,
        edition: Option<&str>,
    ) -> Result<i32, DbError> {
        let edition_val = edition.unwrap_or("java");
        if let Some(id) = server_id {
            let _result = sqlx::query(
                r#"
                INSERT INTO servers (id, name, host, port, color, edition)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET name=?, host=?, port=?, color=?, edition=?
                "#,
            )
            .bind(id)
            .bind(name)
            .bind(host)
            .bind(port as i32)
            .bind(color)
            .bind(edition_val)
            .bind(name)
            .bind(host)
            .bind(port as i32)
            .bind(color)
            .bind(edition_val)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::InsertError(e.to_string()))?;

            Ok(id)
        } else {
            let result = sqlx::query(
                r#"
                INSERT INTO servers (name, host, port, color, edition)
                VALUES (?, ?, ?, ?, ?)
                "#,
            )
            .bind(name)
            .bind(host)
            .bind(port as i32)
            .bind(color)
            .bind(edition_val)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::InsertError(e.to_string()))?;

            Ok(result.last_insert_rowid() as i32)
        }
    }

    async fn get_all_servers(&self) -> Result<Vec<Server>, DbError> {
        sqlx::query_as::<_, Server>("SELECT id, name, host, port, color, edition FROM servers")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DbError::QueryError(e.to_string()))
    }

    async fn get_server(&self, id: i32) -> Result<Option<Server>, DbError> {
        sqlx::query_as::<_, Server>(
            "SELECT id, name, host, port, color, edition FROM servers WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))
    }

    async fn delete_server(&self, id: i32) -> Result<(), DbError> {
        sqlx::query("DELETE FROM servers WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::DeleteError(e.to_string()))?;
        Ok(())
    }

    async fn log_status(&self, entry: &StatusLogEntry) -> Result<(), DbError> {
        sqlx::query(
            r#"
            INSERT INTO status_logs (
                server_id, timestamp, online, latency,
                players_online, players_max, version, motd,
                sample_players, software, plugins, map, edition
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(entry.server_id)
        .bind(format_gmt8_naive(entry.timestamp))
        .bind(entry.online)
        .bind(entry.latency)
        .bind(entry.players_online)
        .bind(entry.players_max)
        .bind(&entry.version)
        .bind(&entry.motd)
        .bind(&entry.sample_players)
        .bind(&entry.software)
        .bind(&entry.plugins)
        .bind(&entry.map)
        .bind(&entry.edition)
        .execute(&self.pool)
        .await
        .map_err(|e| DbError::InsertError(e.to_string()))?;

        Ok(())
    }

    async fn log_status_batch(&self, entries: &[StatusLogEntry]) -> Result<(), DbError> {
        for entry in entries {
            self.log_status(entry).await?;
        }
        Ok(())
    }

    async fn get_server_latest_status(&self, server_id: i32) -> Result<Option<StatusLog>, DbError> {
        sqlx::query_as::<_, StatusLog>(
            r#"
            SELECT id, server_id, timestamp, online, latency,
                   players_online, players_max, version, motd,
                   sample_players, software, plugins, map, edition
            FROM status_logs
            WHERE server_id = ?
            ORDER BY timestamp DESC
            LIMIT 1
            "#,
        )
        .bind(server_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))
    }

    async fn get_server_history(
        &self,
        server_id: i32,
        limit: i32,
    ) -> Result<Vec<StatusLog>, DbError> {
        sqlx::query_as::<_, StatusLog>(
            r#"
            SELECT id, server_id, timestamp, online, latency,
                   players_online, players_max, version, motd,
                   sample_players, software, plugins, map, edition
            FROM status_logs
            WHERE server_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
            "#,
        )
        .bind(server_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))
    }

    async fn get_server_history_range(
        &self,
        server_id: i32,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<StatusLog>, DbError> {
        sqlx::query_as::<_, StatusLog>(
            r#"
            SELECT id, server_id, timestamp, online, latency,
                   players_online, players_max, version, motd,
                   sample_players, software, plugins, map, edition
            FROM status_logs
            WHERE server_id = ? AND timestamp >= ? AND timestamp <= ?
            ORDER BY timestamp ASC
            "#,
        )
        .bind(server_id)
        .bind(format_gmt8_naive(start))
        .bind(format_gmt8_naive(end))
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))
    }

    async fn get_all_latest_status(&self) -> Result<Vec<StatusLog>, DbError> {
        sqlx::query_as::<_, StatusLog>(
            r#"
            SELECT id, server_id, timestamp, online, latency,
                   players_online, players_max, version, motd,
                   sample_players, software, plugins, map, edition
            FROM status_logs
            WHERE id IN (
                SELECT MAX(id) FROM status_logs GROUP BY server_id
            )
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))
    }

    async fn get_all_history(&self, hours: u32) -> Result<HashMap<i32, Vec<StatusLog>>, DbError> {
        let start_time = now_gmt8() - chrono::Duration::hours(hours as i64);

        let logs: Vec<StatusLog> = sqlx::query_as::<_, StatusLog>(
            r#"
            SELECT id, server_id, timestamp, online, latency,
                   players_online, players_max, version, motd,
                   sample_players, software, plugins, map, edition
            FROM status_logs
            WHERE timestamp >= ?
            ORDER BY timestamp ASC
            "#,
        )
        .bind(format_gmt8_naive(start_time))
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))?;

        let mut result: HashMap<i32, Vec<StatusLog>> = HashMap::new();
        for log in logs {
            result.entry(log.server_id).or_default().push(log);
        }

        Ok(result)
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

    async fn update_player_sessions(
        &self,
        server_id: i32,
        sample_players: &[String],
        timestamp: DateTime<Utc>,
    ) -> Result<(), DbError> {
        for player_name in sample_players {
            // 尝试更新现有记录或插入新记录
            sqlx::query(
                r#"
                INSERT INTO player_sessions (server_id, player_name, first_seen, session_start, last_seen, online)
                VALUES (?, ?, ?, ?, ?, 1)
                ON CONFLICT(server_id, player_name) DO UPDATE SET
                    last_seen = ?,
                    online = 1,
                    session_start = COALESCE(session_start, ?),
                    duration_seconds = CASE
                        WHEN session_start IS NOT NULL THEN
                            CAST((julianday(?) - julianday(session_start)) * 86400 AS INTEGER)
                        ELSE NULL
                    END
                "#,
            )
            .bind(server_id)
            .bind(player_name)
            .bind(format_gmt8_naive(timestamp))
            .bind(format_gmt8_naive(timestamp))
            .bind(format_gmt8_naive(timestamp))
            .bind(format_gmt8_naive(timestamp))
            .bind(format_gmt8_naive(timestamp))
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::InsertError(e.to_string()))?;
        }

        Ok(())
    }

    async fn get_online_players(&self, server_id: i32) -> Result<Vec<PlayerSession>, DbError> {
        sqlx::query_as::<_, PlayerSession>(
            r#"
            SELECT id, server_id, player_name, first_seen, session_start,
                   last_seen, online, duration_seconds
            FROM player_sessions
            WHERE server_id = ? AND online = 1
            "#,
        )
        .bind(server_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))
    }

    async fn get_all_online_players(&self) -> Result<Vec<PlayerSession>, DbError> {
        sqlx::query_as::<_, PlayerSession>(
            r#"
            SELECT id, server_id, player_name, first_seen, session_start,
                   last_seen, online, duration_seconds
            FROM player_sessions
            WHERE online = 1
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))
    }

    async fn get_all_player_sessions(&self, server_id: i32) -> Result<Vec<PlayerSession>, DbError> {
        sqlx::query_as::<_, PlayerSession>(
            r#"
            SELECT id, server_id, player_name, first_seen, session_start,
                   last_seen, online, duration_seconds
            FROM player_sessions
            WHERE server_id = ?
            ORDER BY last_seen DESC
            "#,
        )
        .bind(server_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))
    }

    async fn get_player_history(
        &self,
        player_name: &str,
        days: Option<u32>,
    ) -> Result<Vec<PlayerSessionHistory>, DbError> {
        let query = if let Some(days) = days {
            let start_time = now_gmt8() - chrono::Duration::days(days as i64);
            sqlx::query_as::<_, PlayerSessionHistory>(
                r#"
                SELECT id, server_id, player_name, session_start, session_end
                FROM player_session_history
                WHERE player_name = ? AND session_start >= ?
                ORDER BY session_start DESC
                "#,
            )
            .bind(player_name)
            .bind(format_gmt8_naive(start_time))
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query_as::<_, PlayerSessionHistory>(
                r#"
                SELECT id, server_id, player_name, session_start, session_end
                FROM player_session_history
                WHERE player_name = ?
                ORDER BY session_start DESC
                "#,
            )
            .bind(player_name)
            .fetch_all(&self.pool)
            .await
        };

        query.map_err(|e| DbError::QueryError(e.to_string()))
    }

    async fn get_all_player_names(&self) -> Result<Vec<String>, DbError> {
        let result: Vec<(String,)> =
            sqlx::query_as("SELECT DISTINCT player_name FROM player_sessions ORDER BY player_name")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| DbError::QueryError(e.to_string()))?;

        Ok(result.into_iter().map(|(name,)| name).collect())
    }

    async fn get_player_detail(&self, player_name: &str) -> Result<Option<PlayerDetail>, DbError> {
        // 获取玩家当前会话信息
        let sessions: Vec<PlayerSession> = sqlx::query_as::<_, PlayerSession>(
            r#"
            SELECT id, server_id, player_name, first_seen, session_start,
                   last_seen, online, duration_seconds
            FROM player_sessions
            WHERE player_name = ?
            "#,
        )
        .bind(player_name)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))?;

        if sessions.is_empty() {
            return Ok(None);
        }

        // 获取节点名称映射
        let servers = self.get_all_servers().await?;
        let server_map: HashMap<i32, String> =
            servers.into_iter().map(|s| (s.id, s.name)).collect();

        // 构建节点条目
        let mut server_entries: Vec<PlayerServerEntry> = Vec::new();
        let mut latest_session: Option<&PlayerSession> = None;
        let mut is_online = false;

        for session in &sessions {
            if session.online {
                is_online = true;
            }

            if latest_session.is_none() || session.last_seen > latest_session.unwrap().last_seen {
                latest_session = Some(session);
            }

            server_entries.push(PlayerServerEntry {
                server_id: session.server_id,
                server_name: server_map
                    .get(&session.server_id)
                    .cloned()
                    .unwrap_or_default(),
                online: session.online,
                first_seen: session.first_seen,
                last_seen: session.last_seen,
            });
        }

        // 获取历史会话
        let history = self.get_player_history(player_name, Some(30)).await?;

        Ok(Some(PlayerDetail {
            player_name: player_name.to_string(),
            online: is_online,
            session_start: latest_session.and_then(|s| s.session_start),
            last_seen: latest_session.map(|s| s.last_seen).unwrap_or_else(now_gmt8),
            duration_seconds: latest_session
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
        let start_time = now_gmt8() - chrono::Duration::days(days as i64);

        let history: Vec<PlayerSessionHistory> = sqlx::query_as::<_, PlayerSessionHistory>(
            r#"
            SELECT id, server_id, player_name, session_start, session_end
            FROM player_session_history
            WHERE player_name = ? AND session_start >= ?
            ORDER BY session_start
            "#,
        )
        .bind(player_name)
        .bind(format_gmt8_naive(start_time))
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))?;

        let mut intervals: Vec<(DateTime<Utc>, DateTime<Utc>)> = history
            .iter()
            .filter(|h| h.session_end > h.session_start)
            .map(|h| (h.session_start, h.session_end))
            .collect();

        intervals.sort_by_key(|a| a.0);
        let mut merged: Vec<(DateTime<Utc>, DateTime<Utc>)> = Vec::new();
        for (start, end) in intervals {
            if let Some(last) = merged.last_mut() {
                if start <= last.1 {
                    if end > last.1 {
                        last.1 = end;
                    }
                } else {
                    merged.push((start, end));
                }
            } else {
                merged.push((start, end));
            }
        }

        let mut counts: HashMap<(i32, i32), i32> = HashMap::new();
        for (start, _end) in &merged {
            let hour = start.hour() as i32;
            let weekday = start.weekday().num_days_from_monday() as i32;
            *counts.entry((hour, weekday)).or_insert(0) += 1;
        }

        Ok(counts
            .iter()
            .map(|((hour, weekday), count)| PlayerHeatmap {
                hour: *hour,
                weekday: *weekday,
                count: *count,
            })
            .collect())
    }

    async fn end_offline_sessions(
        &self,
        server_id: i32,
        online_players: &[String],
        timestamp: DateTime<Utc>,
    ) -> Result<(), DbError> {
        // 获取当前在线但实际已离线的玩家
        let offline_players: Vec<(i64, String, Option<String>)> = sqlx::query_as(
            r#"
            SELECT id, player_name, session_start
            FROM player_sessions
            WHERE server_id = ? AND online = 1
            "#,
        )
        .bind(server_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::QueryError(e.to_string()))?;

        for (session_id, player_name, session_start) in offline_players {
            if !online_players.contains(&player_name) {
                // 将会话移动到历史表
                if let Some(start) = session_start {
                    let _ = sqlx::query(
                        r#"
                        INSERT INTO player_session_history (server_id, player_name, session_start, session_end)
                        VALUES (?, ?, ?, ?)
                        "#,
                    )
                    .bind(server_id)
                    .bind(&player_name)
                    .bind(&start)
                    .bind(format_gmt8_naive(timestamp))
                    .execute(&self.pool)
                    .await;
                }

                // 更新会话状态为离线
                let _ = sqlx::query(
                    r#"
                    UPDATE player_sessions
                    SET online = 0, session_start = NULL, duration_seconds = NULL
                    WHERE id = ?
                    "#,
                )
                .bind(session_id)
                .execute(&self.pool)
                .await;
            }
        }

        Ok(())
    }

    async fn update_player_sessions_aggregate(
        &self,
        observations: &[(i32, bool, Option<Vec<String>>)],
        timestamp: DateTime<Utc>,
    ) -> Result<(), DbError> {
        let mut seen_players: HashSet<String> = HashSet::new();
        let mut node_players: HashMap<i32, Vec<String>> = HashMap::new();

        for (server_id, _online, players) in observations {
            if let Some(p) = players {
                for name in p {
                    seen_players.insert(name.clone());
                }
                node_players.insert(*server_id, p.clone());
            }
        }

        for (server_id, players) in &node_players {
            self.update_player_sessions(*server_id, players, timestamp)
                .await?;
        }

        let all_online = self.get_all_online_players().await?;

        for session in all_online {
            if !node_players.contains_key(&session.server_id) {
                continue;
            }

            let is_seen_by_own_node = node_players
                .get(&session.server_id)
                .map(|p| p.contains(&session.player_name))
                .unwrap_or(false);

            if seen_players.contains(&session.player_name) {
                if !is_seen_by_own_node {
                    sqlx::query(
                        "UPDATE player_sessions SET online = 0, session_start = NULL, duration_seconds = NULL WHERE id = ?"
                    )
                    .bind(session.id)
                    .execute(&self.pool)
                    .await
                    .map_err(|e| DbError::UpdateError(e.to_string()))?;
                }
            } else {
                if let Some(start) = session.session_start {
                    let exists: (i64,) = sqlx::query_as(
                        "SELECT COUNT(*) FROM player_session_history WHERE player_name = ? AND session_start BETWEEN datetime(?, '-120 seconds') AND datetime(?, '+120 seconds')"
                    )
                    .bind(&session.player_name)
                    .bind(format_gmt8_naive(start))
                    .bind(format_gmt8_naive(start))
                    .fetch_one(&self.pool)
                    .await
                    .map_err(|e| DbError::QueryError(e.to_string()))?;

                    if exists.0 == 0 {
                        sqlx::query(
                            "INSERT INTO player_session_history (server_id, player_name, session_start, session_end) VALUES (?, ?, ?, ?)"
                        )
                        .bind(session.server_id)
                        .bind(&session.player_name)
                        .bind(format_gmt8_naive(start))
                    .bind(format_gmt8_naive(timestamp))
                        .execute(&self.pool)
                        .await
                        .map_err(|e| DbError::InsertError(e.to_string()))?;
                    }
                }

                sqlx::query(
                    "UPDATE player_sessions SET online = 0, session_start = NULL, duration_seconds = NULL WHERE id = ?"
                )
                .bind(session.id)
                .execute(&self.pool)
                .await
                .map_err(|e| DbError::UpdateError(e.to_string()))?;
            }
        }

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
