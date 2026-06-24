//! 玩家 API

use super::AppState;
use crate::models::*;
use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use std::collections::HashSet;

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", get(get_players))
        .route("/:name", get(get_player_detail))
        .route("/:name/sessions", get(get_player_sessions))
        .route("/:name/weekly-stats", get(get_player_weekly_stats))
        .route("/:name/heatmap", get(get_player_heatmap))
}

#[derive(Deserialize)]
struct PlayerQuery {
    group_id: Option<String>,
    server_id: Option<String>,
}

#[derive(Deserialize)]
struct SessionsQuery {
    days: Option<u32>,
}

async fn get_players(
    State(state): State<AppState>,
    Query(q): Query<PlayerQuery>,
) -> Json<Vec<PlayerListItem>> {
    // 批量获取所有玩家会话（替代 N+1 查询）
    let all_sessions = state
        .db
        .get_all_player_sessions_flat()
        .await
        .unwrap_or_default();
    let all_nodes = state.db.get_all_nodes().await.unwrap_or_default();
    let all_servers = state.db.get_all_servers().await.unwrap_or_default();

    // 构建允许的 server_id 集合（通过 group_id 或 server_id 过滤）
    let allowed_server_ids: Option<HashSet<String>> = if let Some(ref sid) = q.server_id {
        Some(std::iter::once(sid.clone()).collect())
    } else if let Some(ref gid) = q.group_id {
        state
            .db
            .get_servers_by_group(gid)
            .await
            .ok()
            .map(|v| v.into_iter().map(|s| s.id).collect())
    } else {
        None
    };

    // 构建 node_id -> (node_name, server_id, server_name) 映射
    let node_info: std::collections::HashMap<&str, (&str, &str, &str)> = all_nodes
        .iter()
        .map(|n| {
            let server = all_servers.iter().find(|s| s.id == n.server_id);
            (
                n.id.as_str(),
                (
                    n.name.as_str(),
                    n.server_id.as_str(),
                    server.map(|s| s.name.as_str()).unwrap_or(""),
                ),
            )
        })
        .collect();

    // 按 player_name 聚合会话
    let mut player_map: std::collections::HashMap<String, Vec<&PlayerSession>> =
        std::collections::HashMap::new();
    for session in &all_sessions {
        player_map
            .entry(session.player_name.clone())
            .or_default()
            .push(session);
    }

    let mut result = Vec::new();
    for (name, sessions) in player_map {
        let is_online = sessions.iter().any(|s| s.online);
        let latest_session = sessions.iter().max_by_key(|s| s.last_seen);

        let servers: Vec<PlayerServerEntry> = sessions
            .iter()
            .map(|s| {
                let (node_name, server_id, server_name) = node_info
                    .get(s.node_id.as_str())
                    .copied()
                    .unwrap_or(("", "", ""));
                PlayerServerEntry {
                    node_id: s.node_id.clone(),
                    node_name: node_name.to_string(),
                    server_id: server_id.to_string(),
                    server_name: server_name.to_string(),
                    online: s.online,
                    first_seen: s.first_seen,
                    last_seen: s.last_seen,
                }
            })
            .collect();

        // 过滤
        if let Some(ref allowed) = allowed_server_ids {
            if !servers.iter().any(|e| allowed.contains(&e.server_id)) {
                continue;
            }
        }

        result.push(PlayerListItem {
            player_name: name,
            online: is_online,
            session_start: latest_session.and_then(|s| s.session_start),
            last_seen: latest_session.map(|s| s.last_seen),
            duration_seconds: latest_session
                .filter(|s| s.online)
                .and_then(|s| s.session_start)
                .map(|start| (crate::utils::time::now_gmt8() - start).num_seconds()),
            servers,
        });
    }

    result.sort_by(|a, b| match (a.online, b.online) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => b
            .last_seen
            .unwrap_or_else(crate::utils::time::now_gmt8)
            .cmp(&a.last_seen.unwrap_or_else(crate::utils::time::now_gmt8)),
    });
    Json(result)
}

async fn get_player_detail(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<PlayerDetail>, axum::http::StatusCode> {
    // 玩家名称长度限制
    if name.is_empty() || name.len() > 64 {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }
    state
        .db
        .get_player_detail(&name)
        .await
        .map_err(super::internal_error)?
        .map(Json)
        .ok_or(axum::http::StatusCode::NOT_FOUND)
}

async fn get_player_sessions(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Query(q): Query<SessionsQuery>,
) -> Result<Json<Vec<PlayerSessionHistory>>, axum::http::StatusCode> {
    if name.is_empty() || name.len() > 64 {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }
    state
        .db
        .get_player_history(&name, Some(q.days.unwrap_or(30)))
        .await
        .map(Json)
        .map_err(super::internal_error)
}

async fn get_player_weekly_stats(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<PlayerWeeklyStats>, axum::http::StatusCode> {
    state
        .db
        .get_player_weekly_stats(&name)
        .await
        .map(Json)
        .map_err(super::internal_error)
}

async fn get_player_heatmap(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Query(q): Query<SessionsQuery>,
) -> Result<Json<Vec<PlayerHeatmap>>, axum::http::StatusCode> {
    if name.is_empty() || name.len() > 64 {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }
    state
        .db
        .get_player_heatmap(&name, q.days.unwrap_or(30))
        .await
        .map(Json)
        .map_err(super::internal_error)
}
