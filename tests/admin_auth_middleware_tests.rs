//! Admin 路由鉴权中间件集成测试

use std::sync::Arc;
use std::time::Duration;

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;
use tokio::sync::watch;
use tower::Service;

use motdtracker::api::AppState;
use motdtracker::auth::token::generate_session_token;
use motdtracker::config::AppConfig;
use motdtracker::core::poller::ServerPollerManager;
use motdtracker::db::*;
use motdtracker::utils::time::now_gmt8;
use motdtracker::ws::WsBroadcaster;

fn cleanup_db(path: &str) {
    let _ = std::fs::remove_file(path);
    let _ = std::fs::remove_file(format!("{}-wal", path));
    let _ = std::fs::remove_file(format!("{}-shm", path));
}

async fn setup_app(db_path: &str) -> (axum::Router, String) {
    cleanup_db(db_path);
    let db = SqliteDatabase::new(db_path).await.expect("create database");
    db.init_database().await.expect("init database");

    // 创建管理员与有效 session
    let password_hash =
        motdtracker::auth::password::hash_password("password").expect("hash password");
    let user_id = db
        .create_admin_user("admin", &password_hash)
        .await
        .expect("create admin");
    let token = generate_session_token();
    let expires_at = now_gmt8() + chrono::Duration::hours(24);
    db.create_session(user_id, &token, expires_at)
        .await
        .expect("create session");

    let db = Arc::new(db);
    let config = Arc::new(AppConfig::default());
    let broadcaster = Arc::new(WsBroadcaster::new());
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let poller_manager = Arc::new(ServerPollerManager::new(
        db.clone(),
        broadcaster.clone(),
        shutdown_rx,
    ));
    let login_limiter = Arc::new(RateLimiter::keyed(
        Quota::with_period(Duration::from_secs(15 * 60 / 10))
            .unwrap()
            .allow_burst(NonZeroU32::new(10).unwrap()),
    ));

    let state = AppState {
        db,
        config,
        broadcaster,
        poller_manager,
        ws_shutdown_rx: shutdown_tx.subscribe(),
        login_limiter,
    };

    let protected = motdtracker::api::admin::create_protected_router().route_layer(
        axum::middleware::from_fn_with_state(
            state.clone(),
            motdtracker::api::admin::auth_middleware,
        ),
    );
    let router = motdtracker::api::admin::create_public_router()
        .merge(protected)
        .with_state(state);

    (router, token)
}

#[tokio::test]
async fn protected_route_returns_401_without_token() {
    let (app, _token) = setup_app("test_admin_auth_401_no_token.db").await;
    let req = Request::builder()
        .uri("/nodes")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    let mut app = app;
    let response = app.call(req).await.expect("request");
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    cleanup_db("test_admin_auth_401_no_token.db");
}

#[tokio::test]
async fn protected_route_returns_200_with_valid_token() {
    let (app, token) = setup_app("test_admin_auth_200_valid_token.db").await;
    let req = Request::builder()
        .uri("/nodes")
        .method("GET")
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();
    let mut app = app;
    let response = app.call(req).await.expect("request");
    assert_eq!(response.status(), StatusCode::OK);
    cleanup_db("test_admin_auth_200_valid_token.db");
}

#[tokio::test]
async fn public_route_status_works_without_auth() {
    let (app, _token) = setup_app("test_admin_auth_public_status.db").await;
    let req = Request::builder()
        .uri("/status")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    let mut app = app;
    let response = app.call(req).await.expect("request");
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("body is json");
    assert_eq!(json["initialized"], true);
    cleanup_db("test_admin_auth_public_status.db");
}

#[tokio::test]
async fn logout_is_public_and_accepts_unauthenticated_request() {
    let (app, _token) = setup_app("test_admin_auth_public_logout.db").await;
    let req = Request::builder()
        .uri("/logout")
        .method("POST")
        .body(Body::empty())
        .unwrap();
    let mut app = app;
    let response = app.call(req).await.expect("request");
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    cleanup_db("test_admin_auth_public_logout.db");
}

#[tokio::test]
async fn protected_route_returns_401_with_invalid_token() {
    let (app, _token) = setup_app("test_admin_auth_401_invalid_token.db").await;
    let req = Request::builder()
        .uri("/nodes")
        .method("GET")
        .header("Authorization", "Bearer invalid-token")
        .body(Body::empty())
        .unwrap();
    let mut app = app;
    let response = app.call(req).await.expect("request");
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    cleanup_db("test_admin_auth_401_invalid_token.db");
}
