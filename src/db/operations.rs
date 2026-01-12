use crate::db::Database;
use crate::models::{player::PlayerSession, server::Server, status::StatusLog};
use chrono::{DateTime, Utc};
use sqlx::Row;
use crate::{execute_query, fetch_optional_query, fetch_all_query, fetch_one_query};

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
        // PostgreSQL使用$1, $2, SQLite使用?, ?
        // 为了简化，使用动态SQL
        
        if let Some(id) = server_id {
            // 使用UPSERT或INSERT OR REPLACE
            if self.is_postgres() {
                execute_query!(self, sqlx::query(
                    "INSERT INTO servers (id, name, host, port, color) VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (host, port) DO UPDATE SET name = $2, color = $5"
                ).bind(id).bind(name).bind(host).bind(port).bind(color))?;
            } else {
                execute_query!(self, sqlx::query(
                    "INSERT OR REPLACE INTO servers (id, name, host, port, color) VALUES (?, ?, ?, ?, ?)"
                ).bind(id).bind(name).bind(host).bind(port).bind(color))?;
            }
            Ok(id)
        } else {
            // 查找已存在的服务器
            let existing_row = if self.is_postgres() {
                fetch_optional_query!(self, sqlx::query(
                    "SELECT id FROM servers WHERE host = $1 AND port = $2"
                ).bind(host).bind(port))?
            } else {
                fetch_optional_query!(self, sqlx::query(
                    "SELECT id FROM servers WHERE host = ? AND port = ?"
                ).bind(host).bind(port))?
            };

            if let Some(row) = existing_row {
                let id: i32 = row.get("id");
                // 更新现有服务器
                if self.is_postgres() {
                    execute_query!(self, sqlx::query(
                        "UPDATE servers SET name = $1, color = $2 WHERE id = $3"
                    ).bind(name).bind(color).bind(id))?;
                } else {
                    execute_query!(self, sqlx::query(
                        "UPDATE servers SET name = ?, color = ? WHERE id = ?"
                    ).bind(name).bind(color).bind(id))?;
                }
                Ok(id)
            } else {
                // 插入新服务器
                if self.is_postgres() {
                    let row = fetch_one_query!(self, sqlx::query(
                        "INSERT INTO servers (name, host, port, color) VALUES ($1, $2, $3, $4) RETURNING id"
                    ).bind(name).bind(host).bind(port).bind(color))?;
                    Ok(row.get("id"))
                } else {
                    let result = execute_query!(self, sqlx::query(
                        "INSERT INTO servers (name, host, port, color) VALUES (?, ?, ?, ?)"
                    ).bind(name).bind(host).bind(port).bind(color))?;
                    Ok(result.last_insert_rowid() as i32)
                }
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
        let sample_players_json = sample_players.and_then(|p| serde_json::to_string(p).ok());
        let plugins_json = plugins.and_then(|p| serde_json::to_string(p).ok());

        if self.is_postgres() {
            execute_query!(self, sqlx::query(
                r#"
                INSERT INTO status_logs 
                (server_id, timestamp, online, latency, players_online, players_max, 
                 version, motd, sample_players, software, plugins, map_name)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                "#
            )
            .bind(server_id).bind(timestamp).bind(online).bind(latency)
            .bind(players_online).bind(players_max).bind(version).bind(motd)
            .bind(sample_players_json).bind(software).bind(plugins_json).bind(map_name))?;
        } else {
            execute_query!(self, sqlx::query(
                r#"
                INSERT INTO status_logs 
                (server_id, timestamp, online, latency, players_online, players_max, 
                 version, motd, sample_players, software, plugins, map_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(server_id).bind(timestamp).bind(online).bind(latency)
            .bind(players_online).bind(players_max).bind(version).bind(motd)
            .bind(sample_players_json).bind(software).bind(plugins_json).bind(map_name))?;
        }

        Ok(())
    }

    /// 获取所有服务器
    pub async fn get_all_servers(&self) -> anyhow::Result<Vec<Server>> {
        let servers = fetch_all_query!(self, sqlx::query_as::<_, Server>("SELECT * FROM servers ORDER BY id"))?;
        Ok(servers)
    }

    /// 获取服务器最新状态
    pub async fn get_server_latest_status(&self, server_id: i32) -> anyhow::Result<Option<StatusLog>> {
        let status = if self.is_postgres() {
            fetch_optional_query!(self, sqlx::query_as::<_, StatusLog>(
                "SELECT * FROM status_logs WHERE server_id = $1 ORDER BY timestamp DESC LIMIT 1"
            ).bind(server_id))?
        } else {
            fetch_optional_query!(self, sqlx::query_as::<_, StatusLog>(
                "SELECT * FROM status_logs WHERE server_id = ? ORDER BY timestamp DESC LIMIT 1"
            ).bind(server_id))?
        };
        Ok(status)
    }

    /// 获取服务器历史记录
    pub async fn get_server_history(&self, server_id: i32, limit: i64) -> anyhow::Result<Vec<StatusLog>> {
        let history = if self.is_postgres() {
            fetch_all_query!(self, sqlx::query_as::<_, StatusLog>(
                "SELECT * FROM status_logs WHERE server_id = $1 ORDER BY timestamp DESC LIMIT $2"
            ).bind(server_id).bind(limit))?
        } else {
            fetch_all_query!(self, sqlx::query_as::<_, StatusLog>(
                "SELECT * FROM status_logs WHERE server_id = ? ORDER BY timestamp DESC LIMIT ?"
            ).bind(server_id).bind(limit))?
        };
        Ok(history)
    }

    /// 计算服务器24小时统计
    pub async fn get_server_stats(
        &self,
        server_id: i32,
        limit: i64,
    ) -> anyhow::Result<crate::models::server::ServerStats> {
        let records = self.get_server_history(server_id, limit).await?;

        if records.is_empty() {
            return Ok(Default::default());
        }

        let online_count = records.iter().filter(|r| r.online).count();
        let online_rate = (online_count as f64 / records.len() as f64) * 100.0;

        let latencies: Vec<f64> = records.iter().filter_map(|r| r.latency).collect();

        if latencies.is_empty() {
            return Ok(crate::models::server::ServerStats {
                online_rate,
                ..Default::default()
            });
        }

        let avg = latencies.iter().sum::<f64>() / latencies.len() as f64;
        let min = latencies.iter().cloned().fold(f64::INFINITY, f64::min);
        let max = latencies.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

        let variance = latencies.iter().map(|&x| (x - avg).powi(2)).sum::<f64>() / latencies.len() as f64;
        let stddev = variance.sqrt();

        let mut sorted = latencies.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let p95_index = ((sorted.len() as f64) * 0.95) as usize;
        let p95 = sorted.get(p95_index.min(sorted.len() - 1)).copied().unwrap_or(max);

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
        if sample_players.is_none() || sample_players == Some(&[]) {
            if self.is_postgres() {
                execute_query!(self, sqlx::query(
                    "UPDATE player_sessions SET is_online = false, session_end = $1 WHERE server_id = $2 AND is_online = true"
                ).bind(timestamp).bind(server_id))?;
            } else {
                execute_query!(self, sqlx::query(
                    "UPDATE player_sessions SET is_online = 0, session_end = ? WHERE server_id = ? AND is_online = 1"
                ).bind(timestamp).bind(server_id))?;
            }
            return Ok(());
        }

        let players = sample_players.unwrap();

        let current_online: Vec<String> = if self.is_postgres() {
            fetch_all_query!(self, sqlx::query(
                "SELECT player_name FROM player_sessions WHERE server_id = $1 AND is_online = true"
            ).bind(server_id))?
        } else {
            fetch_all_query!(self, sqlx::query(
                "SELECT player_name FROM player_sessions WHERE server_id = ? AND is_online = 1"
            ).bind(server_id))?
        }.iter().map(|row| row.get("player_name")).collect();

        for player in current_online.iter() {
            if !players.contains(player) {
                if self.is_postgres() {
                    execute_query!(self, sqlx::query(
                        "UPDATE player_sessions SET is_online = false, session_end = $1 WHERE server_id = $2 AND player_name = $3 AND is_online = true"
                    ).bind(timestamp).bind(server_id).bind(player))?;
                } else {
                    execute_query!(self, sqlx::query(
                        "UPDATE player_sessions SET is_online = 0, session_end = ? WHERE server_id = ? AND player_name = ? AND is_online = 1"
                    ).bind(timestamp).bind(server_id).bind(player))?;
                }
            }
        }

        for player in players.iter() {
            if !current_online.contains(player) {
                if self.is_postgres() {
                    execute_query!(self, sqlx::query(
                        "INSERT INTO player_sessions (server_id, player_name, session_start, is_online) VALUES ($1, $2, $3, true)"
                    ).bind(server_id).bind(player).bind(timestamp))?;
                } else {
                    execute_query!(self, sqlx::query(
                        "INSERT INTO player_sessions (server_id, player_name, session_start, is_online) VALUES (?, ?, ?, 1)"
                    ).bind(server_id).bind(player).bind(timestamp))?;
                }
            }
        }

        Ok(())
    }

    /// 获取当前在线玩家
    pub async fn get_online_players(&self, server_id: i32) -> anyhow::Result<Vec<crate::models::player::OnlinePlayer>> {
        let rows = if self.is_postgres() {
            fetch_all_query!(self, sqlx::query(
                "SELECT player_name, session_start FROM player_sessions WHERE server_id = $1 AND is_online = true ORDER BY session_start DESC"
            ).bind(server_id))?
        } else {
            fetch_all_query!(self, sqlx::query(
                "SELECT player_name, session_start FROM player_sessions WHERE server_id = ? AND is_online = 1 ORDER BY session_start DESC"
            ).bind(server_id))?
        };

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
        let sessions = if self.is_postgres() {
            fetch_all_query!(self, sqlx::query_as::<_, PlayerSession>(
                "SELECT * FROM player_sessions WHERE server_id = $1 ORDER BY session_start DESC"
            ).bind(server_id))?
        } else {
            fetch_all_query!(self, sqlx::query_as::<_, PlayerSession>(
                "SELECT * FROM player_sessions WHERE server_id = ? ORDER BY session_start DESC"
            ).bind(server_id))?
        };
        Ok(sessions)
    }

    /// 获取玩家历史会话
    pub async fn get_player_history(&self, player_name: &str, days: Option<i32>) -> anyhow::Result<Vec<PlayerSession>> {
        let sessions = if let Some(d) = days {
            if self.is_postgres() {
                fetch_all_query!(self, sqlx::query_as::<_, PlayerSession>(
                    "SELECT * FROM player_sessions WHERE player_name = $1 AND session_start >= NOW() - INTERVAL '$2 days' ORDER BY session_start DESC"
                ).bind(player_name).bind(d))?
            } else {
                fetch_all_query!(self, sqlx::query_as::<_, PlayerSession>(
                    "SELECT * FROM player_sessions WHERE player_name = ? AND session_start >= datetime('now', ?) ORDER BY session_start DESC"
                ).bind(player_name).bind(format!("-{} days", d)))?
            }
        } else {
            if self.is_postgres() {
                fetch_all_query!(self, sqlx::query_as::<_, PlayerSession>(
                    "SELECT * FROM player_sessions WHERE player_name = $1 ORDER BY session_start DESC"
                ).bind(player_name))?
            } else {
                fetch_all_query!(self, sqlx::query_as::<_, PlayerSession>(
                    "SELECT * FROM player_sessions WHERE player_name = ? ORDER BY session_start DESC"
                ).bind(player_name))?
            }
        };

        Ok(sessions)
    }
}
