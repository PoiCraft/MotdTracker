use crate::db::Database;
use crate::models::{player::PlayerSession, server::Server, status::StatusLog};
use chrono::{DateTime, Utc};
use sqlx::Row;

impl Database {
    /// 添加或更新服务器
    pub async fn add_server(
        &self,
        name: &str,
        host: &str,
        port: i32,
        color: Option<&str>,
        server_id: Option<i32>,
    ) -> anyhow::Result<i32> {
        // 如果指定了ID，使用INSERT OR REPLACE
        if let Some(id) = server_id {
            sqlx::query(
                r#"
                INSERT OR REPLACE INTO servers (id, name, host, port, color)
                VALUES (?, ?, ?, ?, ?)
                "#,
            )
            .bind(id)
            .bind(name)
            .bind(host)
            .bind(port)
            .bind(color)
            .execute(self.pool())
            .await?;
            Ok(id)
        } else {
            // 先尝试查找已存在的服务器
            let existing: Option<i32> = sqlx::query_scalar(
                "SELECT id FROM servers WHERE host = ? AND port = ?",
            )
            .bind(host)
            .bind(port)
            .fetch_optional(self.pool())
            .await?;

            if let Some(id) = existing {
                // 更新现有服务器
                sqlx::query(
                    "UPDATE servers SET name = ?, color = ? WHERE id = ?",
                )
                .bind(name)
                .bind(color)
                .bind(id)
                .execute(self.pool())
                .await?;
                Ok(id)
            } else {
                // 插入新服务器
                let result = sqlx::query(
                    "INSERT INTO servers (name, host, port, color) VALUES (?, ?, ?, ?)",
                )
                .bind(name)
                .bind(host)
                .bind(port)
                .bind(color)
                .execute(self.pool())
                .await?;
                Ok(result.last_insert_rowid() as i32)
            }
        }
    }

    /// 记录服务器状态
    pub async fn log_status(
        &self,
        server_id: i32,
        online: bool,
        latency: Option<f64>,
        players_online: Option<i32>,
        players_max: Option<i32>,
        version: Option<&str>,
        motd: Option<&str>,
        sample_players: Option<&[String]>,
        software: Option<&str>,
        plugins: Option<&[String]>,
        map_name: Option<&str>,
        timestamp: DateTime<Utc>,
    ) -> anyhow::Result<()> {
        let sample_players_json = sample_players.map(|p| serde_json::to_string(p).ok()).flatten();
        let plugins_json = plugins.map(|p| serde_json::to_string(p).ok()).flatten();

        sqlx::query(
            r#"
            INSERT INTO status_logs 
            (server_id, timestamp, online, latency, players_online, players_max, 
             version, motd, sample_players, software, plugins, map_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(server_id)
        .bind(timestamp)
        .bind(online)
        .bind(latency)
        .bind(players_online)
        .bind(players_max)
        .bind(version)
        .bind(motd)
        .bind(sample_players_json)
        .bind(software)
        .bind(plugins_json)
        .bind(map_name)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// 获取所有服务器
    pub async fn get_all_servers(&self) -> anyhow::Result<Vec<Server>> {
        let servers = sqlx::query_as::<_, Server>("SELECT * FROM servers ORDER BY id")
            .fetch_all(self.pool())
            .await?;
        Ok(servers)
    }

    /// 获取服务器最新状态
    pub async fn get_server_latest_status(&self, server_id: i32) -> anyhow::Result<Option<StatusLog>> {
        let status = sqlx::query_as::<_, StatusLog>(
            "SELECT * FROM status_logs WHERE server_id = ? ORDER BY timestamp DESC LIMIT 1",
        )
        .bind(server_id)
        .fetch_optional(self.pool())
        .await?;
        Ok(status)
    }

    /// 获取服务器历史记录
    pub async fn get_server_history(&self, server_id: i32, limit: i64) -> anyhow::Result<Vec<StatusLog>> {
        let history = sqlx::query_as::<_, StatusLog>(
            "SELECT * FROM status_logs WHERE server_id = ? ORDER BY timestamp DESC LIMIT ?",
        )
        .bind(server_id)
        .bind(limit)
        .fetch_all(self.pool())
        .await?;
        Ok(history)
    }

    /// 计算服务器24小时统计
    pub async fn get_server_stats(
        &self,
        server_id: i32,
        limit: i64,
    ) -> anyhow::Result<crate::models::server::ServerStats> {
        // 获取最近的记录
        let records = self.get_server_history(server_id, limit).await?;

        if records.is_empty() {
            return Ok(Default::default());
        }

        // 计算在线率
        let online_count = records.iter().filter(|r| r.online).count();
        let online_rate = (online_count as f64 / records.len() as f64) * 100.0;

        // 收集延迟数据
        let latencies: Vec<f64> = records
            .iter()
            .filter_map(|r| r.latency)
            .collect();

        if latencies.is_empty() {
            return Ok(crate::models::server::ServerStats {
                online_rate,
                ..Default::default()
            });
        }

        // 计算统计值
        let avg = latencies.iter().sum::<f64>() / latencies.len() as f64;
        let min = latencies.iter().cloned().fold(f64::INFINITY, f64::min);
        let max = latencies.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

        // 计算标准差
        let variance = latencies.iter().map(|&x| (x - avg).powi(2)).sum::<f64>() / latencies.len() as f64;
        let stddev = variance.sqrt();

        // 计算P95
        let mut sorted = latencies.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let p95_index = ((sorted.len() as f64) * 0.95) as usize;
        let p95 = sorted.get(p95_index.min(sorted.len() - 1)).copied().unwrap_or(max);

        // 计算变异系数
        let cv = if avg > 0.0 { (stddev / avg) * 100.0 } else { 0.0 };

        Ok(crate::models::server::ServerStats {
            online_rate,
            avg_latency: Some(avg),
            stddev_latency: Some(stddev),
            min_latency: Some(min),
            max_latency: Some(max),
            p95_latency: Some(p95),
            cv: Some(cv),
        })
    }

    /// 更新玩家会话
    pub async fn update_player_sessions(
        &self,
        server_id: i32,
        sample_players: Option<&[String]>,
        timestamp: DateTime<Utc>,
    ) -> anyhow::Result<()> {
        // 如果没有玩家列表（服务器离线），标记所有在线玩家为离线
        if sample_players.is_none() || sample_players == Some(&[]) {
            sqlx::query(
                r#"
                UPDATE player_sessions 
                SET is_online = 0, session_end = ?
                WHERE server_id = ? AND is_online = 1
                "#,
            )
            .bind(timestamp)
            .bind(server_id)
            .execute(self.pool())
            .await?;
            return Ok(());
        }

        let players = sample_players.unwrap();

        // 获取当前在线的玩家
        let current_online: Vec<String> = sqlx::query_scalar(
            "SELECT player_name FROM player_sessions WHERE server_id = ? AND is_online = 1",
        )
        .bind(server_id)
        .fetch_all(self.pool())
        .await?;

        // 找出离线的玩家
        for player in current_online.iter() {
            if !players.contains(player) {
                sqlx::query(
                    r#"
                    UPDATE player_sessions 
                    SET is_online = 0, session_end = ?
                    WHERE server_id = ? AND player_name = ? AND is_online = 1
                    "#,
                )
                .bind(timestamp)
                .bind(server_id)
                .bind(player)
                .execute(self.pool())
                .await?;
            }
        }

        // 找出新上线的玩家
        for player in players.iter() {
            if !current_online.contains(player) {
                sqlx::query(
                    r#"
                    INSERT INTO player_sessions (server_id, player_name, session_start, is_online)
                    VALUES (?, ?, ?, 1)
                    "#,
                )
                .bind(server_id)
                .bind(player)
                .bind(timestamp)
                .execute(self.pool())
                .await?;
            }
        }

        Ok(())
    }

    /// 获取当前在线玩家
    pub async fn get_online_players(&self, server_id: i32) -> anyhow::Result<Vec<crate::models::player::OnlinePlayer>> {
        let rows = sqlx::query(
            r#"
            SELECT player_name, session_start
            FROM player_sessions
            WHERE server_id = ? AND is_online = 1
            ORDER BY session_start DESC
            "#,
        )
        .bind(server_id)
        .fetch_all(self.pool())
        .await?;

        let now = Utc::now();
        let mut players = Vec::new();

        for row in rows {
            let player_name: String = row.get("player_name");
            let session_start: DateTime<Utc> = row.get("session_start");
            let duration = now.signed_duration_since(session_start).num_seconds();

            players.push(crate::models::player::OnlinePlayer {
                player_name,
                session_start,
                duration_seconds: duration,
            });
        }

        Ok(players)
    }

    /// 获取所有玩家会话
    pub async fn get_all_player_sessions(&self, server_id: i32) -> anyhow::Result<Vec<PlayerSession>> {
        let sessions = sqlx::query_as::<_, PlayerSession>(
            "SELECT * FROM player_sessions WHERE server_id = ? ORDER BY session_start DESC",
        )
        .bind(server_id)
        .fetch_all(self.pool())
        .await?;
        Ok(sessions)
    }

    /// 获取玩家历史会话
    pub async fn get_player_history(&self, player_name: &str, days: Option<i32>) -> anyhow::Result<Vec<PlayerSession>> {
        let query = if let Some(d) = days {
            sqlx::query_as::<_, PlayerSession>(
                r#"
                SELECT * FROM player_sessions 
                WHERE player_name = ? AND session_start >= datetime('now', ?)
                ORDER BY session_start DESC
                "#,
            )
            .bind(player_name)
            .bind(format!("-{} days", d))
        } else {
            sqlx::query_as::<_, PlayerSession>(
                "SELECT * FROM player_sessions WHERE player_name = ? ORDER BY session_start DESC",
            )
            .bind(player_name)
        };

        let sessions = query.fetch_all(self.pool()).await?;
        Ok(sessions)
    }
}
