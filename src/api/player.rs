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
    let all_names = state.db.get_all_player_names().await.unwrap_or_default();

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

    let mut result = Vec::new();
    for name in all_names {
        if let Ok(Some(detail)) = state.db.get_player_detail(&name).await {
            if let Some(ref allowed) = allowed_server_ids {
                if !detail
                    .servers
                    .iter()
                    .any(|e| allowed.contains(&e.server_id) || e.server_id.is_empty())
                {
                    continue;
                }
            }
            result.push(PlayerListItem {
                player_name: detail.player_name,
                online: detail.online,
                session_start: detail.session_start,
                last_seen: Some(detail.last_seen),
                duration_seconds: detail.duration_seconds,
                servers: detail.servers,
            });
        }
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
    state
        .db
        .get_player_detail(&name)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        .map(Json)
        .ok_or(axum::http::StatusCode::NOT_FOUND)
}

async fn get_player_sessions(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Query(q): Query<SessionsQuery>,
) -> Json<Vec<PlayerSessionHistory>> {
    state
        .db
        .get_player_history(&name, Some(q.days.unwrap_or(30)))
        .await
        .unwrap_or_default()
        .into()
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
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_player_heatmap(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Query(q): Query<SessionsQuery>,
) -> Json<Vec<PlayerHeatmap>> {
    state
        .db
        .get_player_heatmap(&name, q.days.unwrap_or(30))
        .await
        .unwrap_or_default()
        .into()
}
