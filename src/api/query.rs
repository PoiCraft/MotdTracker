//! 类 SQL 查询 API

use axum::{
    routing::{get, post},
    Router,
    extract::State,
    Json,
};
use serde::{Deserialize, Serialize};

use super::AppState;

#[derive(Deserialize)]
struct QueryRequest {
    #[allow(dead_code)]
    query: String,
}

#[derive(Serialize)]
struct QueryResponse {
    columns: Vec<String>,
    rows: Vec<Vec<serde_json::Value>>,
    total: usize,
}

#[derive(Serialize)]
struct SchemaResponse {
    tables: Vec<TableInfo>,
}

#[derive(Serialize)]
struct TableInfo {
    name: String,
    columns: Vec<ColumnInfo>,
}

#[derive(Serialize)]
struct ColumnInfo {
    name: String,
    r#type: String,
}

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/schema", get(get_schema))
        .route("/", post(execute_query))
}

/// 获取查询架构
async fn get_schema() -> Json<SchemaResponse> {
    Json(SchemaResponse {
        tables: vec![
            TableInfo {
                name: "servers".to_string(),
                columns: vec![
                    ColumnInfo { name: "id".to_string(), r#type: "INTEGER".to_string() },
                    ColumnInfo { name: "name".to_string(), r#type: "TEXT".to_string() },
                    ColumnInfo { name: "host".to_string(), r#type: "TEXT".to_string() },
                    ColumnInfo { name: "port".to_string(), r#type: "INTEGER".to_string() },
                    ColumnInfo { name: "color".to_string(), r#type: "TEXT".to_string() },
                ],
            },
            TableInfo {
                name: "status_logs".to_string(),
                columns: vec![
                    ColumnInfo { name: "id".to_string(), r#type: "INTEGER".to_string() },
                    ColumnInfo { name: "server_id".to_string(), r#type: "INTEGER".to_string() },
                    ColumnInfo { name: "timestamp".to_string(), r#type: "DATETIME".to_string() },
                    ColumnInfo { name: "online".to_string(), r#type: "BOOLEAN".to_string() },
                    ColumnInfo { name: "latency".to_string(), r#type: "REAL".to_string() },
                    ColumnInfo { name: "players_online".to_string(), r#type: "INTEGER".to_string() },
                    ColumnInfo { name: "players_max".to_string(), r#type: "INTEGER".to_string() },
                    ColumnInfo { name: "version".to_string(), r#type: "TEXT".to_string() },
                    ColumnInfo { name: "motd".to_string(), r#type: "TEXT".to_string() },
                ],
            },
            TableInfo {
                name: "player_sessions".to_string(),
                columns: vec![
                    ColumnInfo { name: "id".to_string(), r#type: "INTEGER".to_string() },
                    ColumnInfo { name: "server_id".to_string(), r#type: "INTEGER".to_string() },
                    ColumnInfo { name: "player_name".to_string(), r#type: "TEXT".to_string() },
                    ColumnInfo { name: "first_seen".to_string(), r#type: "DATETIME".to_string() },
                    ColumnInfo { name: "session_start".to_string(), r#type: "DATETIME".to_string() },
                    ColumnInfo { name: "last_seen".to_string(), r#type: "DATETIME".to_string() },
                    ColumnInfo { name: "online".to_string(), r#type: "BOOLEAN".to_string() },
                    ColumnInfo { name: "duration_seconds".to_string(), r#type: "INTEGER".to_string() },
                ],
            },
            TableInfo {
                name: "player_session_history".to_string(),
                columns: vec![
                    ColumnInfo { name: "id".to_string(), r#type: "INTEGER".to_string() },
                    ColumnInfo { name: "server_id".to_string(), r#type: "INTEGER".to_string() },
                    ColumnInfo { name: "player_name".to_string(), r#type: "TEXT".to_string() },
                    ColumnInfo { name: "session_start".to_string(), r#type: "DATETIME".to_string() },
                    ColumnInfo { name: "session_end".to_string(), r#type: "DATETIME".to_string() },
                ],
            },
        ],
    })
}

/// 执行查询（简化实现）
async fn execute_query(
    State(_state): State<AppState>,
    Json(_request): Json<QueryRequest>,
) -> Result<Json<QueryResponse>, axum::http::StatusCode> {
    // 注意：这是一个简化的实现，实际应该实现安全的 SQL 解析器
    // 这里只返回错误，表示功能未完全实现
    Err(axum::http::StatusCode::NOT_IMPLEMENTED)
}
