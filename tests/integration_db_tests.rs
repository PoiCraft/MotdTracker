/// 数据库集成测试
///
/// 这些测试验证 SQLite 数据库操作是否正常工作。
/// 测试会创建临时数据库文件进行验证。
use motdtracker::db::{Database, SqliteDatabase};
use motdtracker::models::{AddNodeParams, StatusLogEntry};
use motdtracker::utils::time::now_gmt8;
use std::fs;

fn cleanup_db(path: &str) {
    let _ = fs::remove_file(path);
    let _ = fs::remove_file(format!("{}-wal", path));
    let _ = fs::remove_file(format!("{}-shm", path));
}

async fn setup_db(path: &str) -> SqliteDatabase {
    let _ = fs::remove_file(path);
    let db = SqliteDatabase::new(path)
        .await
        .expect("Failed to create database");
    db.init_database()
        .await
        .expect("Failed to initialize database");
    db
}

#[tokio::test]
async fn test_sqlite_database_initialization() {
    let db_path = "test_init.db";
    let db = setup_db(db_path).await;

    let servers = db.get_all_servers().await.expect("Failed to get servers");
    assert_eq!(servers.len(), 0, "New database should have no servers");

    let groups = db
        .get_all_server_groups()
        .await
        .expect("Failed to get groups");
    assert_eq!(groups.len(), 0, "New database should have no groups");

    let nodes = db.get_all_nodes().await.expect("Failed to get nodes");
    assert_eq!(nodes.len(), 0, "New database should have no nodes");

    cleanup_db(db_path);
}

#[tokio::test]
async fn test_create_and_retrieve_server() {
    let db_path = "test_servers.db";
    let db = setup_db(db_path).await;

    // 创建服务器组
    let group_id = db
        .create_server_group("TestGroup", 0)
        .await
        .expect("Failed to create group");

    // 创建服务器
    let server_id = db
        .create_server("TestServer", Some(&group_id), 0)
        .await
        .expect("Failed to create server");
    assert!(!server_id.is_empty(), "Server ID should be a UUID string");

    // 检索所有服务器
    let servers = db.get_all_servers().await.expect("Failed to get servers");
    assert_eq!(servers.len(), 1);
    assert_eq!(servers[0].name, "TestServer");
    assert_eq!(servers[0].group_id.as_deref(), Some(group_id.as_str()));

    // 按 ID 检索
    let server = db
        .get_server(&server_id)
        .await
        .expect("Failed to get server");
    assert!(server.is_some());
    assert_eq!(server.unwrap().name, "TestServer");

    // 按组检索
    let group_servers = db
        .get_servers_by_group(&group_id)
        .await
        .expect("Failed to get servers by group");
    assert_eq!(group_servers.len(), 1);

    cleanup_db(db_path);
}

#[tokio::test]
async fn test_add_and_retrieve_node() {
    let db_path = "test_nodes.db";
    let db = setup_db(db_path).await;

    // 创建服务器
    let server_id = db
        .create_server("TestServer", None, 0)
        .await
        .expect("Failed to create server");

    // 添加节点
    let params = AddNodeParams {
        name: "Node1",
        host: "localhost",
        port: 25565,
        edition: "java",
        color: Some("#ff0000"),
        enabled: true,
        server_id: &server_id,
        sort_order: 0,
    };
    let node_id = db.add_node(&params).await.expect("Failed to add node");
    assert!(!node_id.is_empty());

    // 检索节点
    let node = db.get_node(&node_id).await.expect("Failed to get node");
    assert!(node.is_some());
    let n = node.unwrap();
    assert_eq!(n.name, "Node1");
    assert_eq!(n.host, "localhost");
    assert_eq!(n.port, 25565);
    assert_eq!(n.server_id, server_id);

    // 按服务器检索
    let nodes = db
        .get_nodes_by_server(&server_id)
        .await
        .expect("Failed to get nodes by server");
    assert_eq!(nodes.len(), 1);

    // 获取启用的节点
    let enabled = db
        .get_enabled_nodes()
        .await
        .expect("Failed to get enabled nodes");
    assert_eq!(enabled.len(), 1);

    cleanup_db(db_path);
}

#[tokio::test]
async fn test_log_and_retrieve_status() {
    let db_path = "test_status.db";
    let db = setup_db(db_path).await;

    let server_id = db
        .create_server("TestServer", None, 0)
        .await
        .expect("Failed to create server");
    let params = AddNodeParams {
        name: "Node1",
        host: "localhost",
        port: 25565,
        edition: "java",
        color: None,
        enabled: true,
        server_id: &server_id,
        sort_order: 0,
    };
    let node_id = db.add_node(&params).await.expect("Failed to add node");

    // 记录状态
    let timestamp = now_gmt8();
    let entry = StatusLogEntry {
        node_id: node_id.clone(),
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
        edition: Some("java".to_string()),
    };

    db.log_status(&entry).await.expect("Failed to log status");

    // 检索最新状态
    let latest = db
        .get_node_latest_status(&node_id)
        .await
        .expect("Failed to get latest status");
    assert!(latest.is_some());
    let status = latest.unwrap();
    assert!(status.online);
    assert_eq!(status.latency, Some(45.5));
    assert_eq!(status.players_online, Some(10));

    cleanup_db(db_path);
}

#[tokio::test]
async fn test_get_node_history() {
    let db_path = "test_history.db";
    let db = setup_db(db_path).await;

    let server_id = db
        .create_server("TestServer", None, 0)
        .await
        .expect("Failed to create server");
    let params = AddNodeParams {
        name: "Node1",
        host: "localhost",
        port: 25565,
        edition: "java",
        color: None,
        enabled: true,
        server_id: &server_id,
        sort_order: 0,
    };
    let node_id = db.add_node(&params).await.expect("Failed to add node");

    // 记录多个状态
    let mut base_time = now_gmt8();
    for i in 0..5 {
        let entry = StatusLogEntry {
            node_id: node_id.clone(),
            timestamp: base_time,
            online: i % 2 == 0,
            latency: Some(40.0 + i as f64),
            players_online: Some(i * 2),
            players_max: Some(20),
            version: None,
            motd: None,
            sample_players: None,
            software: None,
            plugins: None,
            map: None,
            edition: Some("java".to_string()),
        };
        db.log_status(&entry).await.expect("Failed to log status");
        base_time += chrono::Duration::minutes(1);
    }

    let history = db
        .get_node_history(&node_id, 100)
        .await
        .expect("Failed to get history");
    assert_eq!(history.len(), 5, "Should have 5 entries in history");

    cleanup_db(db_path);
}

#[tokio::test]
async fn test_player_sessions() {
    let db_path = "test_players.db";
    let db = setup_db(db_path).await;

    let server_id = db
        .create_server("TestServer", None, 0)
        .await
        .expect("Failed to create server");
    let params = AddNodeParams {
        name: "Node1",
        host: "localhost",
        port: 25565,
        edition: "java",
        color: None,
        enabled: true,
        server_id: &server_id,
        sort_order: 0,
    };
    let node_id = db.add_node(&params).await.expect("Failed to add node");

    let timestamp = now_gmt8();
    let players = vec!["Player1".to_string(), "Player2".to_string()];

    // 更新玩家会话
    db.update_player_sessions(&node_id, &players, timestamp)
        .await
        .expect("Failed to update player sessions");

    // 获取节点在线玩家
    let online = db
        .get_online_players_on_node(&node_id)
        .await
        .expect("Failed to get online players");
    assert_eq!(online.len(), 2);
    assert!(online.iter().any(|p| p.player_name == "Player1"));
    assert!(online.iter().any(|p| p.player_name == "Player2"));

    // 获取所有玩家名称
    let names = db
        .get_all_player_names()
        .await
        .expect("Failed to get player names");
    assert!(names.contains(&"Player1".to_string()));

    // 获取玩家详情
    let detail = db
        .get_player_detail("Player1")
        .await
        .expect("Failed to get player detail");
    assert!(detail.is_some());

    cleanup_db(db_path);
}

#[tokio::test]
async fn test_server_groups_crud() {
    let db_path = "test_groups.db";
    let db = setup_db(db_path).await;

    // 创建组
    let id = db
        .create_server_group("Group1", 0)
        .await
        .expect("Failed to create group");
    assert!(!id.is_empty());

    // 获取所有组
    let groups = db
        .get_all_server_groups()
        .await
        .expect("Failed to get groups");
    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].name, "Group1");

    // 更新组
    db.update_server_group(&id, "Group1Updated", 1)
        .await
        .expect("Failed to update group");
    let updated = db.get_server_group(&id).await.expect("Failed to get group");
    assert_eq!(updated.unwrap().name, "Group1Updated");

    // 删除组
    db.delete_server_group(&id)
        .await
        .expect("Failed to delete group");
    let groups_after = db
        .get_all_server_groups()
        .await
        .expect("Failed to get groups");
    assert_eq!(groups_after.len(), 0);

    cleanup_db(db_path);
}

#[tokio::test]
async fn test_player_weekly_stats() {
    let db_path = "test_weekly.db";
    let db = setup_db(db_path).await;

    let server_id = db
        .create_server("TestServer", None, 0)
        .await
        .expect("Failed to create server");
    let params = AddNodeParams {
        name: "Node1",
        host: "localhost",
        port: 25565,
        edition: "java",
        color: None,
        enabled: true,
        server_id: &server_id,
        sort_order: 0,
    };
    let node_id = db.add_node(&params).await.expect("Failed to add node");

    // 模拟玩家上线
    let start = now_gmt8();
    let players = vec!["Player1".to_string()];
    db.update_player_sessions(&node_id, &players, start)
        .await
        .expect("Failed to update sessions");

    // 模拟玩家下线（结束会话写入 player_session_history）
    let end = start + chrono::Duration::minutes(30);
    db.end_offline_sessions(&node_id, &[], end)
        .await
        .expect("Failed to end sessions");

    // 获取周统计
    let stats = db
        .get_player_weekly_stats("Player1")
        .await
        .expect("Failed to get weekly stats");
    assert_eq!(stats.player_name, "Player1");
    assert!(
        !stats.daily_stats.is_empty(),
        "Should have at least one day of stats"
    );
    assert!(
        stats.daily_stats[0].total_minutes >= 30,
        "Should have ~30 minutes played"
    );

    // 初始状态：无历史数据时应返回空列表
    let empty_stats = db
        .get_player_weekly_stats("NonExistent")
        .await
        .expect("Failed to get weekly stats");
    assert!(empty_stats.daily_stats.is_empty());

    cleanup_db(db_path);
}

#[tokio::test]
async fn test_admin_user_management() {
    let db_path = "test_admin.db";
    let db = setup_db(db_path).await;

    // 初始无管理员
    assert!(!db.has_admin_user().await.expect("Failed to check admin"));

    // 创建管理员
    let user_id = db
        .create_admin_user("admin", "hashed_password")
        .await
        .expect("Failed to create admin");
    assert!(user_id > 0);
    assert!(db.has_admin_user().await.expect("Failed to check admin"));

    // 获取管理员
    let user = db
        .get_admin_user("admin")
        .await
        .expect("Failed to get admin");
    assert!(user.is_some());
    assert_eq!(user.as_ref().unwrap().username, "admin");

    // 更新密码
    db.update_admin_password(user_id, "new_hash")
        .await
        .expect("Failed to update password");

    // 创建会话
    let token = "test-session-token";
    let expires = now_gmt8() + chrono::Duration::hours(24);
    db.create_session(user_id, token, expires)
        .await
        .expect("Failed to create session");

    // 验证会话
    let session_user = db
        .validate_session(token)
        .await
        .expect("Failed to validate session");
    assert!(session_user.is_some());

    // 删除会话
    db.delete_session(token)
        .await
        .expect("Failed to delete session");
    let after_delete = db
        .validate_session(token)
        .await
        .expect("Failed to validate session");
    assert!(after_delete.is_none());

    cleanup_db(db_path);
}

#[tokio::test]
async fn test_app_config() {
    let db_path = "test_config.db";
    let db = setup_db(db_path).await;

    // 设置配置
    db.set_app_config("test_key", "test_value")
        .await
        .expect("Failed to set config");

    // 获取配置
    let value = db
        .get_app_config("test_key")
        .await
        .expect("Failed to get config");
    assert_eq!(value, Some("test_value".to_string()));

    // 更新配置
    db.set_app_config("test_key", "updated_value")
        .await
        .expect("Failed to update config");
    let updated = db
        .get_app_config("test_key")
        .await
        .expect("Failed to get config");
    assert_eq!(updated, Some("updated_value".to_string()));

    // 获取所有配置
    let all = db
        .get_all_app_config()
        .await
        .expect("Failed to get all config");
    assert_eq!(all.len(), 1);

    // 删除配置
    db.delete_app_config("test_key")
        .await
        .expect("Failed to delete config");
    let after_delete = db
        .get_app_config("test_key")
        .await
        .expect("Failed to get config");
    assert!(after_delete.is_none());

    cleanup_db(db_path);
}
