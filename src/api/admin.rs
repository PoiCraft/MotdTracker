//! 管理后台 API

use axum::{
    extract::{ConnectInfo, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};
use chrono::Duration;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::Arc;

use super::AppState;
use crate::auth::password::{hash_password, verify_password};
use crate::auth::token::{generate_session_token, validate_token_format};
use crate::db::Database;
use crate::models::ServerEntity;
use crate::models::*; // alias to avoid confusion with API ServerEntity
use crate::utils::time::now_gmt8;

/// 生成一个合法的 Argon2 dummy hash，用于防时序攻击（用户名不存在时消耗等量时间）
fn get_dummy_hash() -> &'static str {
    static DUMMY_HASH: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    DUMMY_HASH.get_or_init(|| {
        hash_password("dummy_password_for_timing_attack_prevention_only")
            .unwrap_or_else(|_| {
                // 极端情况下 hash_password 失败，退回到一个预生成的合法 hash
                "$argon2id$v=19$m=65536,t=3,p=1$YgAAAAAAAABkAAAAAAAAAAAAAA$LTv8YdJz7m9vAa1ZzqPqYnGqY7cQ6Q6Q6Q6Q6Q6Q6Q6"
                    .to_string()
            })
    })
}

// ─── Strongly-typed request DTOs ───────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
struct NodeRequestDto {
    name: String,
    host: String,
    #[serde(default = "default_node_port")]
    port: u16,
    #[serde(default = "default_edition")]
    edition: String,
    color: Option<String>,
    #[serde(default = "default_true")]
    enabled: bool,
    #[serde(default)]
    server_id: String,
    #[serde(default)]
    sort_order: i32,
}

fn default_node_port() -> u16 {
    25565
}
fn default_edition() -> String {
    "java".to_string()
}
fn default_true() -> bool {
    true
}

#[derive(Debug, serde::Deserialize)]
struct GroupRequestDto {
    name: String,
    #[serde(default)]
    sort_order: i32,
}

#[derive(Debug, serde::Deserialize)]
struct ServerRequestDto {
    name: String,
    #[serde(default)]
    group_id: Option<String>,
    #[serde(default)]
    sort_order: i32,
}

#[derive(Debug, serde::Deserialize)]
struct MoveServerToGroupDto {
    group_id: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct MoveNodeToServerDto {
    server_id: String,
}

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
        .map_err(super::internal_error)?
        .ok_or(StatusCode::UNAUTHORIZED)
}

/// 统一鉴权中间件：所有 protected 路由自动经过此中间件
/// 注意：由于 axum 0.7 的 Router state 绑定机制，此中间件需要在外层（main.rs 中 with_state 之后）应用。
/// 当前各 protected handler 内部已手动调用 authenticate()，确保鉴权不遗漏。
#[allow(dead_code)]
async fn auth_middleware(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    mut req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, StatusCode> {
    // logout 不需要严格校验（允许无效 token 登出）
    let path = req.uri().path();
    if path.ends_with("/logout") {
        return Ok(next.run(req).await);
    }
    let user = authenticate(&headers, &state.db).await?;
    // 将用户信息注入 request extensions，handler 可选择使用
    req.extensions_mut().insert(user);
    Ok(next.run(req).await)
}

fn is_private_ip(ip: &std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(ip) => ip.is_private() || ip.is_loopback(),
        std::net::IpAddr::V6(ip) => ip.is_loopback(),
    }
}

fn real_client_ip(headers: &axum::http::HeaderMap, addr: SocketAddr) -> std::net::IpAddr {
    // 只有来自内网/回环地址时才信任代理 header（防止客户端伪造）
    if is_private_ip(&addr.ip()) {
        // 优先从 X-Forwarded-For 获取真实 IP（Nginx/Caddy 等反代场景）
        if let Some(ff) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
            // 取逗号分隔的第一个 IP
            if let Some(ip_str) = ff.split(',').next().map(|s| s.trim()) {
                if let Ok(ip) = ip_str.parse::<std::net::IpAddr>() {
                    return ip;
                }
            }
        }
        // 其次检查 X-Real-IP
        if let Some(ri) = headers.get("x-real-ip").and_then(|v| v.to_str().ok()) {
            if let Ok(ip) = ri.trim().parse::<std::net::IpAddr>() {
                return ip;
            }
        }
    }
    addr.ip()
}

async fn handle_setup(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(req): Json<SetupRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let ip = real_client_ip(&headers, addr);
    if state.login_limiter.check_key(&ip).is_err() {
        tracing::warn!("Rate limit exceeded for setup from {}", ip);
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    if state
        .db
        .has_admin_user()
        .await
        .map_err(super::internal_error)?
    {
        return Err(StatusCode::CONFLICT);
    }
    if req.username.trim().is_empty() || req.username.len() > 32 {
        return Err(StatusCode::BAD_REQUEST);
    }
    if req.password.len() < 6 || req.password.len() > 128 {
        return Err(StatusCode::BAD_REQUEST);
    }
    let password_hash = hash_password(&req.password).map_err(super::internal_error)?;
    let user_id = state
        .db
        .create_admin_user(&req.username, &password_hash)
        .await
        .map_err(super::internal_error)?;
    let token = generate_session_token();
    let expires_at = now_gmt8() + Duration::hours(24);
    state
        .db
        .create_session(user_id, &token, expires_at)
        .await
        .map_err(super::internal_error)?;
    state
        .db
        .update_admin_last_login(user_id)
        .await
        .map_err(super::internal_error)?;
    Ok(Json(LoginResponse { token, expires_at }))
}

async fn handle_login(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let ip = real_client_ip(&headers, addr);
    if state.login_limiter.check_key(&ip).is_err() {
        tracing::warn!("Rate limit exceeded for login from {}", ip);
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    let user = state
        .db
        .get_admin_user(&req.username)
        .await
        .map_err(super::internal_error)?;
    let dummy = get_dummy_hash();
    let hash = user
        .as_ref()
        .map(|u| u.password_hash.as_str())
        .unwrap_or(dummy);
    let valid = verify_password(&req.password, hash).map_err(super::internal_error)?;
    if !valid || user.is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let user = user.unwrap();
    let token = generate_session_token();
    let expires_at = now_gmt8() + Duration::hours(24);
    state
        .db
        .create_session(user.id, &token, expires_at)
        .await
        .map_err(super::internal_error)?;
    state
        .db
        .update_admin_last_login(user.id)
        .await
        .map_err(super::internal_error)?;
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
    let valid =
        verify_password(&req.old_password, &user.password_hash).map_err(super::internal_error)?;
    if !valid {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let new_hash = hash_password(&req.new_password).map_err(super::internal_error)?;
    state
        .db
        .update_admin_password(user.id, &new_hash)
        .await
        .map_err(super::internal_error)?;
    Ok(StatusCode::NO_CONTENT)
}
async fn handle_status(State(state): State<AppState>) -> Result<Json<Value>, StatusCode> {
    let has = state
        .db
        .has_admin_user()
        .await
        .map_err(super::internal_error)?;
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
        port: state.config.port,
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
        .map_err(super::internal_error)?;
    state
        .db
        .set_app_config("poll_interval", &s.poll_interval.to_string())
        .await
        .map_err(super::internal_error)?;
    if let Some(ref w) = s.webhook_alert {
        let j = serde_json::to_string(w).map_err(super::internal_error)?;
        state
            .db
            .set_app_config("webhook_alert", &j)
            .await
            .map_err(super::internal_error)?;
    } else {
        // webhook_alert 为 null 时清除已有配置
        state
            .db
            .delete_app_config("webhook_alert")
            .await
            .map_err(super::internal_error)?;
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
        .map_err(super::internal_error)
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
        .map_err(super::internal_error)?
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}
async fn add_node(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(req): Json<NodeRequestDto>,
) -> Result<Json<Node>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    if req.name.trim().is_empty() || req.host.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let params = AddNodeParams {
        name: &req.name,
        host: &req.host,
        port: req.port,
        edition: &req.edition,
        color: req.color.as_deref(),
        enabled: req.enabled,
        server_id: &req.server_id,
        sort_order: req.sort_order,
    };
    let id = state
        .db
        .add_node(&params)
        .await
        .map_err(super::internal_error)?;
    state
        .db
        .get_node(&id)
        .await
        .map_err(super::internal_error)?
        .map(Json)
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)
}
async fn update_node(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(req): Json<NodeRequestDto>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    if req.name.trim().is_empty() || req.host.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let params = UpdateNodeParams {
        name: &req.name,
        host: &req.host,
        port: req.port,
        edition: &req.edition,
        color: req.color.as_deref(),
        enabled: req.enabled,
        server_id: &req.server_id,
        sort_order: req.sort_order,
    };
    state
        .db
        .update_node(&id, &params)
        .await
        .map_err(super::internal_error)?;
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
        .map_err(super::internal_error)?;
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
        .map_err(super::internal_error)?;
    let pos = nodes
        .iter()
        .position(|n| n.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;
    if pos == 0 {
        return Ok(StatusCode::NO_CONTENT);
    }
    let cur = &nodes[pos];
    let prev = &nodes[pos - 1];
    state
        .db
        .swap_node_sort_orders(&cur.id, prev.sort_order, &prev.id, cur.sort_order)
        .await
        .map_err(super::internal_error)?;
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
        .map_err(super::internal_error)?;
    let pos = nodes
        .iter()
        .position(|n| n.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;
    if pos >= nodes.len() - 1 {
        return Ok(StatusCode::NO_CONTENT);
    }
    let cur = &nodes[pos];
    let next = &nodes[pos + 1];
    state
        .db
        .swap_node_sort_orders(&cur.id, next.sort_order, &next.id, cur.sort_order)
        .await
        .map_err(super::internal_error)?;
    Ok(StatusCode::NO_CONTENT)
}
async fn move_node_to_server(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(req): Json<MoveNodeToServerDto>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let node = state
        .db
        .get_node(&id)
        .await
        .map_err(super::internal_error)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let params = UpdateNodeParams {
        name: &node.name,
        host: &node.host,
        port: node.port as u16,
        edition: &node.edition,
        color: node.color.as_deref(),
        enabled: node.enabled,
        server_id: &req.server_id,
        sort_order: node.sort_order,
    };
    state
        .db
        .update_node(&node.id, &params)
        .await
        .map_err(super::internal_error)?;
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
        .map_err(super::internal_error)?;
    let servers = state
        .db
        .get_all_servers()
        .await
        .map_err(super::internal_error)?;
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
        .map_err(super::internal_error)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let s = state
        .db
        .get_servers_by_group(&id)
        .await
        .map_err(super::internal_error)?;
    Ok(Json(
        json!({"id": g.id, "name": g.name, "sort_order": g.sort_order, "servers": s}),
    ))
}
async fn add_group(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(req): Json<GroupRequestDto>,
) -> Result<Json<Value>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    if req.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let id = state
        .db
        .create_server_group(&req.name, req.sort_order)
        .await
        .map_err(super::internal_error)?;
    Ok(Json(
        json!({"id": id, "name": req.name, "sort_order": req.sort_order}),
    ))
}
async fn update_group(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(req): Json<GroupRequestDto>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    if req.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    state
        .db
        .update_server_group(&id, &req.name, req.sort_order)
        .await
        .map_err(super::internal_error)?;
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
        .map_err(super::internal_error)?;
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
        .map_err(super::internal_error)
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
        .map_err(super::internal_error)?
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}
async fn add_server(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(req): Json<ServerRequestDto>,
) -> Result<Json<ServerEntity>, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    if req.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let id = state
        .db
        .create_server(&req.name, req.group_id.as_deref(), req.sort_order)
        .await
        .map_err(super::internal_error)?;
    state
        .db
        .get_server(&id)
        .await
        .map_err(super::internal_error)?
        .map(Json)
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)
}
async fn update_server(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(req): Json<ServerRequestDto>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    if req.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    state
        .db
        .update_server(&id, &req.name, req.group_id.as_deref(), req.sort_order)
        .await
        .map_err(super::internal_error)?;
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
        .map_err(super::internal_error)?;
    Ok(StatusCode::NO_CONTENT)
}
async fn move_server_to_group(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(req): Json<MoveServerToGroupDto>,
) -> Result<StatusCode, StatusCode> {
    let _ = authenticate(&headers, &state.db).await?;
    let s = state
        .db
        .get_server(&id)
        .await
        .map_err(super::internal_error)?
        .ok_or(StatusCode::NOT_FOUND)?;
    state
        .db
        .update_server(&id, &s.name, req.group_id.as_deref(), s.sort_order)
        .await
        .map_err(super::internal_error)?;
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
        .map_err(super::internal_error)?;
    Ok(Json(json!({"cleaned": c})))
}
