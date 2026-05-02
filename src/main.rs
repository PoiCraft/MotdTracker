use std::sync::Arc;
use std::net::SocketAddr;

use axum::{
    routing::get,
    Router,
};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use motdtracker::{
    api,
    config::load_config,
    db::{SqliteDatabase, Database},
    ws::WsBroadcaster,
    core::poller::ServerPoller,
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

    info!("Starting MotdTracker...");

    let config = match load_config() {
        Ok(cfg) => {
            info!("Config loaded successfully");
            cfg
        }
        Err(_) => {
            eprintln!("未找到 config.toml，启动配置向导...");
            match motdtracker::tui::run_wizard() {
                Ok(Some(cfg)) => {
                    cfg
                }
                Ok(None) => {
                    eprintln!("配置已取消");
                    return;
                }
                Err(e) => {
                    error!("TUI 配置向导失败: {}", e);
                    return;
                }
            }
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

    for node in &config.nodes {
        let edition_str = node.edition.to_string();
        if let Err(e) = db.add_server(&node.name, &node.host, node.port, node.color.as_deref(), Some(node.id), Some(&edition_str)).await {
            error!("Failed to sync server '{}' to database: {}", node.name, e);
        }
    }

    let broadcaster = Arc::new(WsBroadcaster::new());

    let poller = ServerPoller::new(
        Arc::new(config.clone()),
        db.clone(),
        broadcaster.clone(),
    );
    tokio::spawn(async move {
        if let Err(e) = poller.start().await {
            error!("Poller error: {}", e);
        }
    });

    let app = Router::new()
        .nest("/api/server", api::server::create_router())
        .nest("/api/node", api::node::create_router())
        .nest("/api/player", api::player::create_router())
        .nest("/api/web", api::web::create_router())
        .nest("/api/badge", api::badge::create_router())
        .nest("/api/exporter", api::exporter::create_router())
        .nest("/api/query", api::query::create_router())
        .route("/api/ws", get(api::ws_handler))
        .fallback(motdtracker::embedded::embedded_static_handler)
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any))
        .layer(TraceLayer::new_for_http())
        .with_state(api::AppState {
            db,
            config: Arc::new(config.clone()),
            broadcaster,
        });

    let addr: SocketAddr = format!("0.0.0.0:{}", config.port)
        .parse()
        .expect("Invalid address");
    info!("Server listening on: {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.expect("Cannot bind port");
    if let Err(e) = axum::serve(listener, app).await {
        error!("Server error: {}", e);
    }
}

