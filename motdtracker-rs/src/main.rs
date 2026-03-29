//! MotdTracker 应用入口

use std::sync::Arc;
use std::net::SocketAddr;

use axum::{
    routing::get,
    Router,
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
    // 初始化日志
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "motdtracker=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("正在启动 MotdTracker...");

    // 加载配置
    let config = match load_config() {
        Ok(cfg) => {
            info!("配置加载成功");
            cfg
        }
        Err(e) => {
            error!("配置加载失败: {}", e);
            return;
        }
    };

    // 初始化数据库
    let db = match SqliteDatabase::new(&config.database).await {
        Ok(db) => {
            match db.init_database().await {
                Ok(_) => info!("数据库初始化完成"),
                Err(e) => {
                    error!("数据库初始化失败: {}", e);
                    return;
                }
            }
            Arc::new(db)
        }
        Err(e) => {
            error!("数据库连接失败: {}", e);
            return;
        }
    };

    // 初始化 WebSocket 广播器
    let broadcaster = Arc::new(WsBroadcaster::new());

    // 启动轮询器
    let poller = ServerPoller::new(
        Arc::new(config.clone()),
        db.clone(),
        broadcaster.clone(),
    );
    tokio::spawn(async move {
        if let Err(e) = poller.start().await {
            error!("轮询器错误: {}", e);
        }
    });

    // 创建 API 路由
    let app = Router::new()
        // 健康检查
        .route("/api/exporter/health", get(health_check))
        
        // API 路由
        .nest("/api/server", api::server::create_router())
        .nest("/api/node", api::node::create_router())
        .nest("/api/player", api::player::create_router())
        .nest("/api/web", api::web::create_router())
        .nest("/api/badge", api::badge::create_router())
        .nest("/api/exporter", api::exporter::create_router())
        .nest("/api/query", api::query::create_router())
        
        // WebSocket 路由
        .route("/api/ws", get(api::ws_handler))
        
        // 页面路由
        .route("/", get(redirect_to_server))
        .route("/server", get(api::pages::server_page))
        .route("/nodes", get(api::pages::nodes_page))
        .route("/players", get(api::pages::players_page))
        .route("/player/:name", get(api::pages::player_detail_page))
        .route("/badges", get(api::pages::badges_page))
        
        // 静态文件服务
        .fallback_service(ServeDir::new("static"))
        
        // 中间件
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any))
        .layer(TraceLayer::new_for_http())
        
        // 状态
        .with_state(api::AppState {
            db,
            config: Arc::new(config.clone()),
            broadcaster,
        });

    // 启动服务器
    let addr: SocketAddr = format!("0.0.0.0:{}", config.port)
        .parse()
        .expect("无效的地址");
    info!("服务器监听地址: {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.expect("无法绑定端口");
    if let Err(e) = axum::serve(listener, app).await {
        error!("服务器错误: {}", e);
    }
}

/// 健康检查
async fn health_check() -> &'static str {
    "OK"
}

/// 重定向到服务器页面
async fn redirect_to_server() -> axum::response::Redirect {
    axum::response::Redirect::to("/server")
}
