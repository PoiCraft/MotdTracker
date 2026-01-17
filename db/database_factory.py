"""数据库工厂和迁移工具"""
import json
import logging
from typing import Dict
from db.database_base import DatabaseBase
from db.database_sqlite import Database as SQLiteDatabase

logger = logging.getLogger(__name__)


def create_database(config: Dict) -> DatabaseBase:
    """
    根据配置创建数据库实例
    
    Args:
        config: 配置字典
        
    Returns:
        DatabaseBase: 数据库实例
    """
    # 检查是否配置了PostgreSQL
    pgsql_config = config.get('postgresql')
    
    if pgsql_config and all(k in pgsql_config for k in ['host', 'port', 'database', 'user', 'password']):
        # 使用PostgreSQL
        try:
            from db.database_postgresql import PostgreSQLDatabase
            logger.info("使用 PostgreSQL 数据库")
            
            db = PostgreSQLDatabase(
                host=pgsql_config['host'],
                port=pgsql_config['port'],
                database=pgsql_config['database'],
                user=pgsql_config['user'],
                password=pgsql_config['password']
            )
            
            # 如果同时配置了SQLite，尝试迁移数据
            sqlite_path = config.get('database', 'minecraft_stats.db')
            if sqlite_path:
                try:
                    migrate_sqlite_to_pgsql(sqlite_path, db)
                except Exception as e:
                    logger.warning(f"数据迁移失败（如果是首次启动可以忽略）: {e}")
            
            return db
        except ImportError as e:
            logger.warning(f"无法导入 PostgreSQL 模块: {e}，回退到 SQLite")
        except Exception as e:
            logger.error(f"PostgreSQL 连接失败: {e}，回退到 SQLite")
    
    # 使用SQLite
    sqlite_path = config.get('database', 'minecraft_stats.db')
    logger.info(f"使用 SQLite 数据库: {sqlite_path}")
    return SQLiteDatabase(sqlite_path)


def migrate_sqlite_to_pgsql(sqlite_path: str, pgsql_db: DatabaseBase):
    """
    从SQLite迁移数据到PostgreSQL
    
    Args:
        sqlite_path: SQLite数据库路径
        pgsql_db: PostgreSQL数据库实例
    """
    import os
    import sqlite3
    
    # 检查SQLite文件是否存在
    if not os.path.exists(sqlite_path):
        logger.info("SQLite数据库文件不存在，跳过迁移")
        return
    
    # 检查是否已经迁移过（备份文件存在）
    backup_path = f"{sqlite_path}.migrated"
    if os.path.exists(backup_path):
        logger.info(f"检测到已迁移的备份文件 {backup_path}，跳过重复迁移")
        return
    
    print("\n" + "=" * 70)
    print("开始数据迁移：SQLite → PostgreSQL")
    print("=" * 70)
    
    logger.info(f"从 {sqlite_path} 迁移数据到 PostgreSQL...")
    
    # 创建SQLite连接用于统计
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.cursor()
    
    # 预先统计各表数据量
    print("\n📊 统计数据量...")
    cursor.execute('SELECT COUNT(*) FROM servers')
    total_servers = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM status_logs')
    total_status_logs = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM player_sessions')
    total_player_sessions = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM player_session_history')
    total_session_history = cursor.fetchone()[0]
    
    total_records = total_servers + total_status_logs + total_player_sessions + total_session_history
    
    print("\n待迁移数据统计:")
    print(f"  • 服务器: {total_servers:,} 条")
    print(f"  • 状态日志: {total_status_logs:,} 条")
    print(f"  • 玩家会话: {total_player_sessions:,} 条")
    print(f"  • 会话历史: {total_session_history:,} 条")
    print(f"  • 总计: {total_records:,} 条记录")
    print()
    
    migrated_records = 0
    
    def show_progress(current, total, prefix=""):
        """显示进度条"""
        if total == 0:
            return
        percent = min(100, int(current * 100 / total))
        bar_length = 50
        filled = int(bar_length * current / total)
        bar = '█' * filled + '░' * (bar_length - filled)
        print(f"\r{prefix}[{bar}] {percent}% ({current:,}/{total:,})", end='', flush=True)
    
    # 创建SQLite数据库实例
    sqlite_db = SQLiteDatabase(sqlite_path)
    
    # 1. 迁移服务器
    print("🔄 [1/4] 迁移服务器数据...")
    servers = sqlite_db.get_all_servers()
    for i, server in enumerate(servers, 1):
        try:
            pgsql_db.add_server(
                name=server['name'],
                host=server['host'],
                port=server['port'],
                color=server.get('color'),
                server_id=server['id']
            )
            show_progress(i, total_servers, "    ")
        except Exception as e:
            logger.warning(f"  服务器 {server['name']} 迁移失败: {e}")
    
    migrated_records += total_servers
    if total_servers > 0:
        print()  # 换行
    print(f"✅ 服务器迁移完成: {total_servers} 条")
    
    # 2. 迁移状态日志
    print("\n🔄 [2/4] 迁移状态日志...")
    cursor.execute('''
        SELECT server_id, timestamp, online, latency, players_online, players_max, 
               version, motd, sample_players, software, plugins, map
        FROM status_logs
        ORDER BY timestamp
    ''')
    
    count = 0
    batch_size = 1000
    batch = []
    
    for row in cursor:
        sample_players = json.loads(row[8]) if row[8] else None
        plugins = json.loads(row[10]) if row[10] else None
        
        batch.append({
            'server_id': row[0],
            'timestamp': row[1],
            'online': bool(row[2]),
            'latency': row[3],
            'players_online': row[4],
            'players_max': row[5],
            'version': row[6],
            'motd': row[7],
            'sample_players': sample_players,
            'software': row[9],
            'plugins': plugins,
            'map_name': row[11]
        })
        
        if len(batch) >= batch_size:
            # 批量插入
            for log in batch:
                try:
                    pgsql_db.log_status(**log)
                except Exception as e:
                    logger.debug(f"状态日志插入失败: {e}")
            count += len(batch)
            show_progress(count, total_status_logs, "    ")
            batch = []
    
    # 插入剩余的
    for log in batch:
        try:
            pgsql_db.log_status(**log)
        except Exception as e:
            logger.debug(f"状态日志插入失败: {e}")
    count += len(batch)
    if total_status_logs > 0:
        show_progress(count, total_status_logs, "    ")
        print()  # 换行
    print(f"✅ 状态日志迁移完成: {count:,} 条")
    
    # 3. 迁移玩家会话
    print("\n🔄 [3/4] 迁移玩家会话数据...")
    cursor.execute('''
        SELECT server_id, player_name, first_seen, session_start, last_seen, 
               online, duration_seconds
        FROM player_sessions
    ''')
    
    # 使用PostgreSQL连接直接批量插入
    from db.database_postgresql import PostgreSQLDatabase
    if isinstance(pgsql_db, PostgreSQLDatabase):
        pg_conn = pgsql_db.get_connection()
        pg_cursor = pg_conn.cursor()
        
        count = 0
        for row in cursor:
            try:
                pg_cursor.execute('''
                    INSERT INTO player_sessions 
                    (server_id, player_name, first_seen, session_start, last_seen, online, duration_seconds)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (server_id, player_name) DO NOTHING
                ''', row)
                count += 1
                show_progress(count, total_player_sessions, "    ")
            except Exception as e:
                logger.debug(f"玩家会话插入失败: {e}")
        
        pg_conn.commit()
        pg_conn.close()
        if total_player_sessions > 0:
            print()  # 换行
        print(f"✅ 玩家会话迁移完成: {count:,} 条")
    
    # 4. 迁移玩家会话历史
    print("\n🔄 [4/4] 迁移会话历史数据...")
    cursor.execute('''
        SELECT server_id, player_name, session_start, session_end
        FROM player_session_history
    ''')
    
    if isinstance(pgsql_db, PostgreSQLDatabase):
        pg_conn = pgsql_db.get_connection()
        pg_cursor = pg_conn.cursor()
        
        count = 0
        for row in cursor:
            try:
                pg_cursor.execute('''
                    INSERT INTO player_session_history 
                    (server_id, player_name, session_start, session_end)
                    VALUES (%s, %s, %s, %s)
                ''', row)
                count += 1
                show_progress(count, total_session_history, "    ")
            except Exception as e:
                logger.debug(f"会话历史插入失败: {e}")
        
        pg_conn.commit()
        pg_conn.close()
        if total_session_history > 0:
            print()  # 换行
        print(f"✅ 会话历史迁移完成: {count:,} 条")
    
    conn.close()
    
    print("\n" + "=" * 70)
    print("✅ 数据迁移完成！")
    print("=" * 70)
    print("\n迁移统计:")
    print(f"  • 服务器: {total_servers:,} 条")
    print(f"  • 状态日志: {total_status_logs:,} 条")
    print(f"  • 玩家会话: {total_player_sessions:,} 条")
    print(f"  • 会话历史: {total_session_history:,} 条")
    print(f"  • 总计: {total_records:,} 条记录")
    
    # 备份SQLite文件
    import shutil
    backup_path = f"{sqlite_path}.migrated"
    try:
        print("\n💾 备份原数据库...")
        shutil.copy2(sqlite_path, backup_path)
        print(f"✅ 备份完成: {backup_path}")
    except Exception as e:
        logger.warning(f"备份SQLite文件失败: {e}")
    
    print("\n" + "=" * 70)
    logger.info("数据迁移流程全部完成")