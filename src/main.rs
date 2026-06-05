use std::net::SocketAddr;
use std::sync::Arc;

use axum::{routing::get, Router};
use tokio::sync::watch;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use motdtracker::{
    api,
    config::{load_config, AppConfig},
    core::poller::ServerPollerManager,
    db::{Database, SqliteDatabase},
    ws::WsBroadcaster,
};

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "motdtracker=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting MotdTracker {}...", motdtracker::APP_VERSION);

    let mut config = match load_config() {
        Ok(cfg) => {
            info!("Config loaded successfully");
            cfg
        }
        Err(e) => {
            tracing::warn!(
                "Config not found or invalid ({}), using defaults. Configure via admin panel.",
                e
            );
            AppConfig::default()
        }
    };

    let db = match SqliteDatabase::new(&config.database.path).await {
        Ok(db) => {
            match db.init_database().await {
                Ok(_) => info!("Database initialized"),
                Err(e) => {
                    error!("Database init failed: {}", e);
                    return;
                }
            }
            Arc::new(db)
        }
        Err(e) => {
            error!("Database connection failed: {}", e);
            return;
        }
    };

    // 从数据库加载运行时配置，覆盖文件配置
    let mut runtime_config = config.clone();
    if let Ok(Some(val)) = db.get_app_config("poll_interval").await {
        if let Ok(v) = val.parse::<u64>() {
            runtime_config.poll_interval = v;
        }
    }
    if let Ok(Some(val)) = db.get_app_config("port").await {
        if let Ok(v) = val.parse::<u16>() {
            runtime_config.port = v;
        }
    }
    config = runtime_config;
    info!(
        "Runtime config: poll_interval={}, port={}",
        config.poll_interval, config.port
    );

    let broadcaster = Arc::new(WsBroadcaster::new());

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let ws_shutdown_rx_for_state = shutdown_rx.clone();
    let global_shutdown_rx = shutdown_rx;

    let poller_manager = Arc::new(ServerPollerManager::new(
        db.clone(),
        broadcaster.clone(),
        global_shutdown_rx,
    ));

    // 启动轮询管理器
    {
        let mgr = poller_manager.clone();
        tokio::spawn(async move {
            if let Err(e) = mgr.run().await {
                error!("Poller manager error: {}", e);
            }
        });
    }

    let app_state = api::AppState {
        db: db.clone(),
        config: Arc::new(config.clone()),
        broadcaster,
        poller_manager: poller_manager.clone(),
        ws_shutdown_rx: ws_shutdown_rx_for_state,
    };

    let app = Router::new()
        .nest("/api/status", api::status::create_router())
        .nest("/api/groups", api::groups::create_router())
        .nest("/api/servers", api::servers::create_router())
        .nest("/api/nodes", api::node::create_router())
        .nest("/api/players", api::player::create_router())
        .nest("/api/badges", api::badge::create_router())
        .nest("/api/exporter", api::exporter::create_router())
        .nest("/api/admin", api::admin::create_router())
        .route("/api/ws", get(api::ws_handler))
        .fallback(motdtracker::embedded::embedded_static_handler)
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any))
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    let addr: SocketAddr = format!("0.0.0.0:{}", config.port)
        .parse()
        .expect("Invalid address");
    info!("Server listening on: {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Cannot bind port");

    let shutdown_signal = async move {
        tokio::signal::ctrl_c().await.ok();
        info!("收到关闭信号 (Ctrl+C)，开始优雅关闭...");
        let _ = shutdown_tx.send(true);
    };

    if let Err(e) = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal)
        .await
    {
        error!("Server error: {}", e);
    }

    info!("HTTP 服务已停止，正在关闭数据库连接...");
    Database::close(db.as_ref()).await;
    info!("MotdTracker 已完全关闭");
}
