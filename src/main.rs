use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::{routing::get, Router};
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;
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

    // 环境变量优先级最高，覆盖文件配置
    if let Err(e) = motdtracker::config::loader::apply_env_overrides(&mut config) {
        tracing::error!("环境变量覆盖失败: {}", e);
    }
    let db_poll_interval = db
        .get_app_config("poll_interval")
        .await
        .ok()
        .flatten()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(60);
    info!(
        "Runtime config: poll_interval={}, port={}",
        db_poll_interval, config.port
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

    // 创建基于 IP 的登录限流器：每 IP 每 15 分钟最多 10 次尝试
    // governor 令牌桶：每 90 秒补充 1 个令牌，桶容量 10
    let login_limiter = Arc::new(RateLimiter::keyed(
        Quota::with_period(Duration::from_secs(15 * 60 / 10))
            .unwrap()
            .allow_burst(NonZeroU32::new(10).unwrap()),
    ));

    let app_state = api::AppState {
        db: db.clone(),
        config: Arc::new(config.clone()),
        broadcaster,
        poller_manager: poller_manager.clone(),
        ws_shutdown_rx: ws_shutdown_rx_for_state,
        login_limiter,
    };

    let mut app = Router::new()
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
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    // CORS: 默认禁止跨域；若配置了 cors_origin 则仅允许该来源
    let cors_layer = if config.cors_origin.is_empty() {
        None
    } else if config.cors_origin == "*" {
        tracing::warn!(
            "CORS configured to allow all origins (*) — this is insecure for production"
        );
        Some(CorsLayer::new().allow_origin(Any).allow_methods(Any))
    } else {
        match config.cors_origin.parse::<axum::http::HeaderValue>() {
            Ok(origin) => Some(CorsLayer::new().allow_origin(origin).allow_methods(Any)),
            Err(e) => {
                tracing::error!(
                    "Invalid CORS origin '{}': {}. CORS disabled.",
                    config.cors_origin,
                    e
                );
                None
            }
        }
    };
    if let Some(cors) = cors_layer {
        app = app.layer(cors);
    }

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

    if let Err(e) = axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal)
    .await
    {
        error!("Server error: {}", e);
    }

    info!("HTTP 服务已停止，正在关闭数据库连接...");
    Database::close(db.as_ref()).await;
    info!("MotdTracker 已完全关闭");
}
