use std::sync::Arc;
use std::net::SocketAddr;

use axum::{
    routing::get,
    Router,
    response::IntoResponse,
    http::{StatusCode, Uri},
};
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
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
        Err(e) => {
            error!("Config load failed: {}", e);
            return;
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

    let static_dir = std::path::Path::new("frontend/dist");
    let static_service = if static_dir.exists() {
        ServeDir::new(static_dir).not_found_service(get(spa_fallback))
    } else {
        ServeDir::new("static").not_found_service(get(spa_fallback))
    };

    let app = Router::new()
        .route("/api/exporter/health", get(health_check))

        .nest("/api/server", api::server::create_router())
        .nest("/api/node", api::node::create_router())
        .nest("/api/player", api::player::create_router())
        .nest("/api/web", api::web::create_router())
        .nest("/api/badge", api::badge::create_router())
        .nest("/api/exporter", api::exporter::create_router())
        .nest("/api/query", api::query::create_router())

        .route("/api/ws", get(api::ws_handler))

        .fallback_service(static_service)

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

async fn health_check() -> &'static str {
    "OK"
}

async fn spa_fallback(uri: Uri) -> impl IntoResponse {
    let path = "frontend/dist/index.html";
    if std::path::Path::new(path).exists() {
        match tokio::fs::read_to_string(path).await {
            Ok(content) => axum::response::Html(content).into_response(),
            Err(_) => (StatusCode::NOT_FOUND, "Not Found").into_response(),
        }
    } else {
        (StatusCode::NOT_FOUND, format!("Not Found: {}", uri)).into_response()
    }
}
