/// 数据库集成测试
///
/// 这些测试验证 SQLite 数据库操作是否正常工作。
/// 测试会创建临时数据库文件进行验证。

use motdtracker::db::{Database, SqliteDatabase};
use motdtracker::models::StatusLogEntry;
use chrono::Utc;
use std::fs;

#[tokio::test]
async fn test_sqlite_database_initialization() {
    // 创建临时数据库文件
    let db_path = "test_init.db";
    let _ = fs::remove_file(db_path);
    
    let db = SqliteDatabase::new(db_path).await.expect("Failed to create database");
    db.init_database().await.expect("Failed to initialize database");
    
    let servers = db.get_all_servers().await.expect("Failed to get servers");
    assert_eq!(servers.len(), 0, "New database should have no servers");
    
    // 清理
    let _ = fs::remove_file(db_path);
    let _ = fs::remove_file(format!("{}wal", db_path));
    let _ = fs::remove_file(format!("{}shm", db_path));
}

#[tokio::test]
async fn test_add_and_retrieve_server() {
    let db_path = "test_servers.db";
    let _ = fs::remove_file(db_path);
    
    let db = SqliteDatabase::new(db_path).await.expect("Failed to create database");
    db.init_database().await.expect("Failed to initialize database");
    
    // 添加服务器
    let id = db.add_server(
        "TestServer",
        "localhost",
        25565,
        Some("#ff0000"),
        None,
    ).await.expect("Failed to add server");
    
    assert_eq!(id, 1, "First server should have id 1");
    
    // 检索服务器
    let servers = db.get_all_servers().await.expect("Failed to get servers");
    assert_eq!(servers.len(), 1);
    assert_eq!(servers[0].name, "TestServer");
    assert_eq!(servers[0].host, "localhost");
    
    // 按 ID 检索
    let server = db.get_server(id).await.expect("Failed to get server");
    assert!(server.is_some());
    assert_eq!(server.unwrap().name, "TestServer");
    
    // 清理
    let _ = fs::remove_file(db_path);
    let _ = fs::remove_file(format!("{}wal", db_path));
    let _ = fs::remove_file(format!("{}shm", db_path));
}

#[tokio::test]
async fn test_log_and_retrieve_status() {
    let db_path = "test_status.db";
    let _ = fs::remove_file(db_path);
    
    let db = SqliteDatabase::new(db_path).await.expect("Failed to create database");
    db.init_database().await.expect("Failed to initialize database");
    
    // 添加服务器
    let server_id = db.add_server(
        "TestServer",
        "localhost",
        25565,
        None,
        None,
    ).await.expect("Failed to add server");
    
    // 记录状态
    let timestamp = Utc::now();
    let entry = StatusLogEntry {
        server_id,
        timestamp,
        online: true,
        latency: Some(45.5),
        players_online: Some(10),
        players_max: Some(20),
        version: Some("1.20.1".to_string()),
        motd: Some("Welcome to Test Server".to_string()),
        sample_players: None,
        software: None,
        plugins: None,
        map: None,
    };
    
    db.log_status(&entry).await.expect("Failed to log status");
    
    // 检索最新状态
    let latest = db.get_server_latest_status(server_id)
        .await
        .expect("Failed to get latest status");
    
    assert!(latest.is_some());
    let status = latest.unwrap();
    assert!(status.online);
    assert_eq!(status.latency, Some(45.5));
    assert_eq!(status.players_online, Some(10));
    
    // 清理
    let _ = fs::remove_file(db_path);
    let _ = fs::remove_file(format!("{}wal", db_path));
    let _ = fs::remove_file(format!("{}shm", db_path));
}

#[tokio::test]
async fn test_get_server_history() {
    let db_path = "test_history.db";
    let _ = fs::remove_file(db_path);
    
    let db = SqliteDatabase::new(db_path).await.expect("Failed to create database");
    db.init_database().await.expect("Failed to initialize database");
    
    // 添加服务器
    let server_id = db.add_server(
        "TestServer",
        "localhost",
        25565,
        None,
        None,
    ).await.expect("Failed to add server");
    
    // 记录多个状态
    let mut base_time = Utc::now();
    for i in 0..5 {
        let entry = StatusLogEntry {
            server_id,
            timestamp: base_time,
            online: i % 2 == 0,
            latency: Some(40.0 + i as f64),
            players_online: Some(i as i32 * 2),
            players_max: Some(20),
            version: None,
            motd: None,
            sample_players: None,
            software: None,
            plugins: None,
            map: None,
        };
        
        db.log_status(&entry).await.expect("Failed to log status");
        base_time = base_time + chrono::Duration::minutes(1);
    }
    
    // 检索历史
    let history = db.get_server_history(server_id, 100)
        .await
        .expect("Failed to get history");
    
    assert_eq!(history.len(), 5, "Should have 5 entries in history");
    
    // 清理
    let _ = fs::remove_file(db_path);
    let _ = fs::remove_file(format!("{}wal", db_path));
    let _ = fs::remove_file(format!("{}shm", db_path));
}

#[tokio::test]
async fn test_player_sessions() {
    let db_path = "test_players.db";
    let _ = fs::remove_file(db_path);
    
    let db = SqliteDatabase::new(db_path).await.expect("Failed to create database");
    db.init_database().await.expect("Failed to initialize database");
    
    // 添加服务器
    let server_id = db.add_server(
        "TestServer",
        "localhost",
        25565,
        None,
        None,
    ).await.expect("Failed to add server");
    
    let timestamp = Utc::now();
    let players = vec!["Player1".to_string(), "Player2".to_string()];
    
    // 更新玩家会话
    db.update_player_sessions(server_id, &players, timestamp)
        .await
        .expect("Failed to update player sessions");
    
    // 获取在线玩家
    let online = db.get_online_players(server_id)
        .await
        .expect("Failed to get online players");
    
    assert_eq!(online.len(), 2);
    assert!(online.iter().any(|p| p.player_name == "Player1"));
    assert!(online.iter().any(|p| p.player_name == "Player2"));
    
    // 清理
    let _ = fs::remove_file(db_path);
    let _ = fs::remove_file(format!("{}wal", db_path));
    let _ = fs::remove_file(format!("{}shm", db_path));
}
