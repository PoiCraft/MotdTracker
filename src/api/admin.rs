//! 管理后台 API

use axum::{
    extract::State,
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};
use chrono::{Duration, Utc};
use serde_json::{json, Value};
use std::sync::Arc;

use super::AppState;
use crate::auth::password::{hash_password, verify_password};
use crate::auth::token::{generate_session_token, validate_token_format};
use crate::db::Database;
use crate::models::ServerEntity;
use crate::models::*; // alias to avoid confusion with API ServerEntity

pub fn create_router() -> Router<AppState> {
    let public = Router::new()
        .route("/setup", post(handle_setup))
        .route("/login", post(handle_login))
        .route("/status", get(handle_status));

    let protected = Router::new()
        .route("/logout", post(handle_logout))
        .route("/change-password", post(handle_change_password))
        .route("/config-status", get(config_status))
        .route("/settings", get(get_settings).put(update_settings))
        .route("/nodes", get(list_nodes).post(add_node))
        .route(
            "/nodes/:node_id",
            get(get_node).put(update_node).delete(delete_node),
        )
        .route("/nodes/:node_id/move-up", post(move_node_up))
        .route("/nodes/:node_id/move-down", post(move_node_down))
        .route("/groups", get(list_groups).post(add_group))
        .route(
            "/groups/:group_id",
            get(get_group).put(update_group).delete(delete_group),
        )
        .route("/servers", get(list_servers).post(add_server))
        .route(
            "/servers/:server_id",
            get(get_server).put(update_server).delete(delete_server),
        )
        .route("/servers/:server_id/group", put(move_server_to_group))
        .route("/nodes/:node_id/server", put(move_node_to_server))
        .route("/apply", post(apply_settings))
        .route("/sessions/cleanup", post(cleanup_sessions));

    public.merge(protected)
}

fn extract_token(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .filter(|t| validate_token_format(t))
        .map(|t| t.to_string())
}

async fn authenticate(
    headers: &axum::http::HeaderMap,
    db: &Arc<dyn Database>,
) -> Result<AdminUser, StatusCode> {
    let token = extract_token(headers).ok_or(StatusCode::UNAUTHORIZED)?;
    db.validate_session(&token)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)
}

async fn handle_setup(
    State(state): State<AppState>,
    Json(req): Json<SetupRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    if state
        .db
        .has_admin_user()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    {
        return Err(StatusCode::CONFLICT);
    }
    if req.username.trim().is_empty() || req.username.len() > 32 {
        return Err(StatusCode::BAD_REQUEST);
    }
    if req.password.len() < 6 || req.password.len() > 128 {
        return Err(StatusCode::BAD_REQUEST);
    }
    let password_hash =
        hash_password(&req.password).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let user_id = state
        .db
        .create_admin_user(&req.username, &password_hash)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let token = generate_session_token();
    let expires_at = Utc::now() + Duration::hours(24);
    state
        .db
        .create_session(user_id, &token, expires_at)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    state
        .db
        .update_admin_last_login(user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(LoginResponse { token, expires_at }))
}

async fn handle_login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let user = state
        .db
        .get_admin_user(&req.username)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let dummy = "$argon2id$v=19$m=65536,t=3,p=1$dGVzdHNhbHQ$invalidhashvalue00000000000000";
    let hash = user
        .as_ref()
        .map(|u| u.password_hash.as_str())
        .unwrap_or(dummy);
    let valid =
        verify_password(&req.password, hash).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !valid || user.is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let user = user.unwrap();
    let token = generate_session_token();
    let expires_at = Utc::now() + Duration::hours(24);
    state
        .db
        .create_session(user.id, &token, expires_at)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    state
        .db
        .update_admin_last_login(user.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(LoginResponse { token, expires_at }))
}

async fn handle_logout(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<StatusCode, StatusCode> {
    let token = extract_token(&headers).unwrap_or_default();
    let _ = state.db.delete_session(&token).await;
    Ok(StatusCode::NO_CONTENT)
}
async fn handle_change_password(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let user = authenticate(&headers, &state.db).await?;
    if req.new_password.len() < 6 || req.new_password.len() > 128 {
        return Err(StatusCode::BAD_REQUEST);
    }
    let valid = verify_password(&req.old_password, &user.password_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !valid {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let new_hash =
        hash_password(&req.new_password).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    state
        .db
        .update_admin_password(user.id, &new_hash)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}
async fn handle_status(State(state): State<AppState>) -> Result<Json<Value>, StatusCode> {
    let has = state
        .db
        .has_admin_user()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({"initialized": has})))
}

async fn get_settings(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<AppSettings>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let sn = state
        .db
        .get_app_config("server_name")
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| "MotdTracker".to_string());
    let pi: u64 = state
        .db
        .get_app_config("poll_interval")
        .await
        .ok()
        .flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(60);
    let port: u16 = state
        .db
        .get_app_config("port")
        .await
        .ok()
        .flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(5011);
    let wa = state
        .db
        .get_app_config("webhook_alert")
        .await
        .ok()
        .flatten()
        .and_then(|v| serde_json::from_str(&v).ok());
    Ok(Json(AppSettings {
        server_name: sn,
        poll_interval: pi,
        port,
        webhook_alert: wa,
    }))
}
async fn update_settings(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(s): Json<AppSettings>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    state
        .db
        .set_app_config("server_name", &s.server_name)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    state
        .db
        .set_app_config("poll_interval", &s.poll_interval.to_string())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    state
        .db
        .set_app_config("port", &s.port.to_string())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if let Some(ref w) = s.webhook_alert {
        let j = serde_json::to_string(w).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        state
            .db
            .set_app_config("webhook_alert", &j)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    Ok(StatusCode::NO_CONTENT)
}

// === Nodes ===
async fn list_nodes(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<Vec<Node>>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    state
        .db
        .get_all_nodes()
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
async fn get_node(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<Node>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    state
        .db
        .get_node(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}
async fn add_node(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(req): Json<Value>,
) -> Result<Json<Node>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let name = req["name"].as_str().unwrap_or("").to_string();
    let host = req["host"].as_str().unwrap_or("").to_string();
    if name.trim().is_empty() || host.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let port = req["port"].as_u64().unwrap_or(25565) as u16;
    let edition = req["edition"].as_str().unwrap_or("java").to_string();
    let color = req["color"].as_str().map(|s| s.to_string());
    let enabled = req["enabled"].as_bool().unwrap_or(true);
    let server_id = req["server_id"].as_str().unwrap_or("").to_string();
    let sort = req["sort_order"].as_i64().unwrap_or(0) as i32;
    let params = AddNodeParams {
        name: &name,
        host: &host,
        port,
        edition: &edition,
        color: color.as_deref(),
        enabled,
        server_id: &server_id,
        sort_order: sort,
    };
    let id = state
        .db
        .add_node(&params)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    state
        .db
        .get_node(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map(Json)
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)
}
async fn update_node(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(req): Json<Value>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let name = req["name"].as_str().unwrap_or("").to_string();
    let host = req["host"].as_str().unwrap_or("").to_string();
    if name.trim().is_empty() || host.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let port = req["port"].as_u64().unwrap_or(25565) as u16;
    let edition = req["edition"].as_str().unwrap_or("java").to_string();
    let color = req["color"].as_str().map(|s| s.to_string());
    let enabled = req["enabled"].as_bool().unwrap_or(true);
    let server_id = req["server_id"].as_str().unwrap_or("").to_string();
    let sort = req["sort_order"].as_i64().unwrap_or(0) as i32;
    let params = UpdateNodeParams {
        name: &name,
        host: &host,
        port,
        edition: &edition,
        color: color.as_deref(),
        enabled,
        server_id: &server_id,
        sort_order: sort,
    };
    state
        .db
        .update_node(&id, &params)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}
async fn delete_node(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    state
        .db
        .delete_node(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}
async fn move_node_up(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let nodes = state
        .db
        .get_all_nodes()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let pos = nodes
        .iter()
        .position(|n| n.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;
    if pos == 0 {
        return Ok(StatusCode::NO_CONTENT);
    }
    let cur = &nodes[pos];
    let prev = &nodes[pos - 1];
    let cur_params = UpdateNodeParams {
        name: &cur.name,
        host: &cur.host,
        port: cur.port as u16,
        edition: &cur.edition,
        color: cur.color.as_deref(),
        enabled: cur.enabled,
        server_id: &cur.server_id,
        sort_order: prev.sort_order,
    };
    state
        .db
        .update_node(&cur.id, &cur_params)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let prev_params = UpdateNodeParams {
        name: &prev.name,
        host: &prev.host,
        port: prev.port as u16,
        edition: &prev.edition,
        color: prev.color.as_deref(),
        enabled: prev.enabled,
        server_id: &prev.server_id,
        sort_order: cur.sort_order,
    };
    state
        .db
        .update_node(&prev.id, &prev_params)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}
async fn move_node_down(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let nodes = state
        .db
        .get_all_nodes()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let pos = nodes
        .iter()
        .position(|n| n.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;
    if pos >= nodes.len() - 1 {
        return Ok(StatusCode::NO_CONTENT);
    }
    let cur = &nodes[pos];
    let next = &nodes[pos + 1];
    let cur_params = UpdateNodeParams {
        name: &cur.name,
        host: &cur.host,
        port: cur.port as u16,
        edition: &cur.edition,
        color: cur.color.as_deref(),
        enabled: cur.enabled,
        server_id: &cur.server_id,
        sort_order: next.sort_order,
    };
    state
        .db
        .update_node(&cur.id, &cur_params)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let next_params = UpdateNodeParams {
        name: &next.name,
        host: &next.host,
        port: next.port as u16,
        edition: &next.edition,
        color: next.color.as_deref(),
        enabled: next.enabled,
        server_id: &next.server_id,
        sort_order: cur.sort_order,
    };
    state
        .db
        .update_node(&next.id, &next_params)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}
async fn move_node_to_server(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(req): Json<Value>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let sid = req["server_id"]
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or_default();
    let node = state
        .db
        .get_node(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let params = UpdateNodeParams {
        name: &node.name,
        host: &node.host,
        port: node.port as u16,
        edition: &node.edition,
        color: node.color.as_deref(),
        enabled: node.enabled,
        server_id: &sid,
        sort_order: node.sort_order,
    };
    state
        .db
        .update_node(&node.id, &params)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

// === Groups ===
async fn list_groups(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<Vec<Value>>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let groups = state
        .db
        .get_all_server_groups()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let servers = state
        .db
        .get_all_servers()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut r: Vec<Value> = Vec::new();
    for g in &groups {
        let gs: Vec<&ServerEntity> = servers
            .iter()
            .filter(|s| s.group_id.as_deref() == Some(g.id.as_str()))
            .collect();
        r.push(json!({"id": g.id, "name": g.name, "sort_order": g.sort_order, "servers": gs}));
    }
    let ungrouped: Vec<&ServerEntity> = servers.iter().filter(|s| s.group_id.is_none()).collect();
    if !ungrouped.is_empty() {
        r.push(json!({"id": null, "name": "未分组", "sort_order": -1, "servers": ungrouped}));
    }
    Ok(Json(r))
}
async fn get_group(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let g = state
        .db
        .get_server_group(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let s = state
        .db
        .get_servers_by_group(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(
        json!({"id": g.id, "name": g.name, "sort_order": g.sort_order, "servers": s}),
    ))
}
async fn add_group(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(req): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let name = req["name"].as_str().unwrap_or("").to_string();
    if name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let so = req["sort_order"].as_i64().unwrap_or(0) as i32;
    let id = state
        .db
        .create_server_group(&name, so)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({"id": id, "name": name, "sort_order": so})))
}
async fn update_group(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(req): Json<Value>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let name = req["name"].as_str().unwrap_or("").to_string();
    if name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let so = req["sort_order"].as_i64().unwrap_or(0) as i32;
    state
        .db
        .update_server_group(&id, &name, so)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}
async fn delete_group(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    state
        .db
        .delete_server_group(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

// === Servers ===
async fn list_servers(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<Vec<ServerEntity>>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    state
        .db
        .get_all_servers()
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
async fn get_server(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ServerEntity>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    state
        .db
        .get_server(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}
async fn add_server(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(req): Json<Value>,
) -> Result<Json<ServerEntity>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let name = req["name"].as_str().unwrap_or("").to_string();
    if name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let gid = req["group_id"].as_str();
    let so = req["sort_order"].as_i64().unwrap_or(0) as i32;
    let id = state
        .db
        .create_server(&name, gid, so)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    state
        .db
        .get_server(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map(Json)
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)
}
async fn update_server(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(req): Json<Value>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let name = req["name"].as_str().unwrap_or("").to_string();
    if name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let gid = req["group_id"].as_str();
    let so = req["sort_order"].as_i64().unwrap_or(0) as i32;
    state
        .db
        .update_server(&id, &name, gid, so)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}
async fn delete_server(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    state
        .db
        .delete_server(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}
async fn move_server_to_group(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(req): Json<Value>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let gid = req["group_id"].as_str();
    let s = state
        .db
        .get_server(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    state
        .db
        .update_server(&id, &s.name, gid, s.sort_order)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn apply_settings(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<Value>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    state.poller_manager.restart();
    Ok(Json(
        json!({"status": "ok", "message": "配置已应用，轮询器正在重启"}),
    ))
}
async fn config_status(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<Value>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let synced = state.poller_manager.config_synced().await;
    Ok(Json(json!({"synced": synced})))
}
async fn cleanup_sessions(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<Value>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let c = state
        .db
        .cleanup_expired_sessions()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({"cleaned": c})))
}
