/// DashboardSnapshot 集成测试
///
/// 验证快照模块经内存 SQLite 的完整行为：
/// 树形结构、组过滤、逐节点统计、无历史层级、错误传播。
use motdtracker::api::snapshot::DashboardSnapshot;
use motdtracker::db::{Database, SqliteDatabase};
use motdtracker::models::{AddNodeParams, StatusLogEntry};
use motdtracker::utils::time::now_gmt8;
use std::fs;
use std::sync::Arc;

fn cleanup_db(path: &str) {
    let _ = fs::remove_file(path);
    let _ = fs::remove_file(format!("{}-wal", path));
    let _ = fs::remove_file(format!("{}-shm", path));
}

async fn setup_db(path: &str) -> Arc<dyn Database> {
    let _ = fs::remove_file(path);
    let db = SqliteDatabase::new(path)
        .await
        .expect("Failed to create database");
    db.init_database()
        .await
        .expect("Failed to initialize database");
    Arc::new(db)
}

fn node_params<'a>(name: &'a str, server_id: &'a str, sort_order: i32) -> AddNodeParams<'a> {
    AddNodeParams {
        name,
        host: "localhost",
        port: 25565,
        edition: "java",
        color: None,
        enabled: true,
        server_id,
        sort_order,
    }
}

fn status_entry(node_id: &str, online: bool, latency: Option<f64>) -> StatusLogEntry {
    StatusLogEntry {
        node_id: node_id.to_string(),
        timestamp: now_gmt8(),
        online,
        latency,
        players_online: Some(3),
        players_max: Some(20),
        version: None,
        motd: None,
        sample_players: None,
        software: None,
        plugins: None,
        map: None,
        edition: None,
    }
}

struct Fixture {
    group_id: String,
    node_in_group: String,
    node_ungrouped: String,
}

async fn build_fixture(db: &Arc<dyn Database>) -> Fixture {
    let group_id = db
        .create_server_group("GroupA", 0)
        .await
        .expect("create group");
    let server_in_group = db
        .create_server("ServerInGroup", Some(&group_id), 0)
        .await
        .expect("create server in group");
    let server_ungrouped = db
        .create_server("ServerUngrouped", None, 1)
        .await
        .expect("create ungrouped server");
    let node_in_group = db
        .add_node(&node_params("NodeInGroup", &server_in_group, 0))
        .await
        .expect("add node in group");
    let node_ungrouped = db
        .add_node(&node_params("NodeUngrouped", &server_ungrouped, 1))
        .await
        .expect("add ungrouped node");

    // 组内节点两条状态：一在线一离线，统计 total_checks 应为 2
    db.log_status(&status_entry(&node_in_group, true, Some(42.0)))
        .await
        .expect("log status 1");
    db.log_status(&status_entry(&node_in_group, false, None))
        .await
        .expect("log status 2");

    Fixture {
        group_id,
        node_in_group,
        node_ungrouped,
    }
}

#[tokio::test]
async fn test_snapshot_tree_structure_and_stats() {
    let db_path = "test_snapshot_tree.db";
    let db = setup_db(db_path).await;
    let fx = build_fixture(&db).await;

    let snap = DashboardSnapshot::load(&db, None, Some(24))
        .await
        .expect("load snapshot");

    // 树形结构：组 → 服务器 → 节点
    assert_eq!(snap.groups.len(), 1);
    assert_eq!(snap.groups[0].group.id, fx.group_id);
    assert_eq!(snap.groups[0].servers.len(), 1);
    assert_eq!(snap.groups[0].servers[0].nodes.len(), 1);
    let grouped_node = &snap.groups[0].servers[0].nodes[0];
    assert_eq!(grouped_node.node.id, fx.node_in_group);

    // 最新状态：最后一条是离线
    let latest = grouped_node.latest_status.as_ref().expect("latest status");
    assert!(!latest.online);

    // 逐节点统计：两条历史记录
    let stats = grouped_node.latency_stats.as_ref().expect("latency stats");
    assert_eq!(stats.total_checks, 2);

    // 未分组服务器：节点无状态、无统计
    assert_eq!(snap.ungrouped_servers.len(), 1);
    let ungrouped_node = &snap.ungrouped_servers[0].nodes[0];
    assert_eq!(ungrouped_node.node.id, fx.node_ungrouped);
    assert!(ungrouped_node.latest_status.is_none());
    assert!(ungrouped_node.latency_stats.is_none());

    // 扁平视图
    assert_eq!(snap.nodes().count(), 2);
    assert_eq!(snap.servers().count(), 2);
    assert!(snap.poll_interval > 0);

    cleanup_db(db_path);
}

#[tokio::test]
async fn test_snapshot_group_filter() {
    let db_path = "test_snapshot_filter.db";
    let db = setup_db(db_path).await;
    let fx = build_fixture(&db).await;

    let snap = DashboardSnapshot::load(&db, Some(&fx.group_id), Some(24))
        .await
        .expect("load filtered snapshot");

    assert_eq!(snap.groups.len(), 1);
    assert!(snap.ungrouped_servers.is_empty());
    let ids: Vec<&str> = snap.nodes().map(|n| n.node.id.as_str()).collect();
    assert_eq!(ids, vec![fx.node_in_group.as_str()]);

    cleanup_db(db_path);
}

#[tokio::test]
async fn test_snapshot_without_history_tier() {
    let db_path = "test_snapshot_nohist.db";
    let db = setup_db(db_path).await;
    let fx = build_fixture(&db).await;

    let snap = DashboardSnapshot::load(&db, None, None)
        .await
        .expect("load snapshot without history");

    // 无历史层级：统计全部为 None，但最新状态仍在
    let grouped_node = snap
        .nodes()
        .find(|n| n.node.id == fx.node_in_group)
        .expect("grouped node");
    assert!(grouped_node.latency_stats.is_none());
    assert!(grouped_node.latest_status.is_some());

    cleanup_db(db_path);
}

#[tokio::test]
async fn test_snapshot_error_propagates() {
    let db_path = "test_snapshot_error.db";
    let db = setup_db(db_path).await;
    db.close().await;

    // 连接已关闭：加载必须返回 Err，而不是静默空数据
    let result = DashboardSnapshot::load(&db, None, Some(24)).await;
    assert!(result.is_err(), "closed database must surface an error");

    cleanup_db(db_path);
}
