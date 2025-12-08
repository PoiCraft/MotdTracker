"""数据库工厂和迁移工具"""
import json
import logging
from typing import Dict
from database_base import DatabaseBase
from database import Database as SQLiteDatabase

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
            from database_pgsql import PostgreSQLDatabase
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
    
    # 检查SQLite文件是否存在
    if not os.path.exists(sqlite_path):
        logger.info("SQLite数据库文件不存在，跳过迁移")
        return
    
    # 检查是否已经迁移过（备份文件存在）
    backup_path = f"{sqlite_path}.migrated"
    if os.path.exists(backup_path):
        logger.info(f"检测到已迁移的备份文件 {backup_path}，跳过重复迁移")
        return
    
    logger.info(f"开始从 {sqlite_path} 迁移数据到 PostgreSQL...")
    
    # 创建SQLite连接
    sqlite_db = SQLiteDatabase(sqlite_path)
    
    # 1. 迁移服务器
    logger.info("迁移服务器数据...")
    servers = sqlite_db.get_all_servers()
    for server in servers:
        try:
            pgsql_db.add_server(
                name=server['name'],
                host=server['host'],
                port=server['port'],
                color=server.get('color'),
                server_id=server['id']
            )
            logger.debug(f"  迁移服务器: {server['name']} (ID: {server['id']})")
        except Exception as e:
            logger.warning(f"  服务器 {server['name']} 迁移失败: {e}")
    
    # 2. 迁移状态日志
    logger.info("迁移状态日志...")
    import sqlite3
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.cursor()
    
    try:
        # 获取所有状态日志
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
                        logger.debug(f"  状态日志插入失败: {e}")
                count += len(batch)
                logger.info(f"  已迁移 {count} 条状态日志...")
                batch = []
        
        # 插入剩余的
        for log in batch:
            try:
                pgsql_db.log_status(**log)
            except Exception as e:
                logger.debug(f"  状态日志插入失败: {e}")
        count += len(batch)
        logger.info(f"  状态日志迁移完成，共 {count} 条")
        
        # 3. 迁移玩家会话
        logger.info("迁移玩家会话数据...")
        cursor.execute('''
            SELECT server_id, player_name, first_seen, session_start, last_seen, 
                   online, duration_seconds
            FROM player_sessions
        ''')
        
        # 使用PostgreSQL连接直接批量插入
        from database_pgsql import PostgreSQLDatabase
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
                except Exception as e:
                    logger.debug(f"  玩家会话插入失败: {e}")
            
            pg_conn.commit()
            pg_conn.close()
            logger.info(f"  玩家会话迁移完成，共 {count} 条")
        
        # 4. 迁移玩家会话历史
        logger.info("迁移玩家会话历史...")
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
                except Exception as e:
                    logger.debug(f"  会话历史插入失败: {e}")
            
            pg_conn.commit()
            pg_conn.close()
            logger.info(f"  会话历史迁移完成，共 {count} 条")
        
    finally:
        conn.close()
    
    logger.info("数据迁移完成！")
    
    # 备份SQLite文件
    import shutil
    backup_path = f"{sqlite_path}.migrated"
    try:
        shutil.copy2(sqlite_path, backup_path)
        logger.info(f"SQLite数据库已备份到: {backup_path}")
    except Exception as e:
        logger.warning(f"备份SQLite文件失败: {e}")
