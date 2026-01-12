mod api;
mod db;
mod models;
mod monitor;
mod poller;
mod utils;

use anyhow::Result;
use axum::{
    Router,
    routing::get,
};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::{
    services::ServeDir,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use models::config::AppConfig;
use db::Database;
use poller::ServerPoller;

/// 应用状态
pub struct AppState {
    pub config: AppConfig,
    pub db: Database,
    pub poller: Arc<RwLock<ServerPoller>>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // 初始化日志
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "motdtracker=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("MotdTracker Rust版本启动中...");
    tracing::info!("版本: {}", utils::get_version());

    // 加载配置
    let config = AppConfig::from_file("config.json")?;
    tracing::info!("配置文件加载成功");

    // 初始化数据库（使用工厂方法）
    let db = db::factory::create_database(&config).await?;
    db.init_schema().await?;
    tracing::info!("数据库初始化完成");

    // 初始化轮询器
    let mut poller = ServerPoller::new(config.clone(), db.clone()).await?;
    poller.start().await?;

    // 创建应用状态
    let state = Arc::new(AppState {
        config: config.clone(),
        db,
        poller: Arc::new(RwLock::new(poller)),
    });

    // 创建路由
    let app = Router::new()
        .route("/", get(|| async { "MotdTracker Rust Version" }))
        .nest("/api", api::create_api_routes(state.clone()))
        .nest_service("/static", ServeDir::new("static"))
        .layer(TraceLayer::new_for_http());

    // 启动服务器
    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("服务器启动在 http://{}", addr);
    tracing::info!("访问 http://127.0.0.1:{} 查看监控面板", config.port);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

