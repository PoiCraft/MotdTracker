import sqlite3
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from database_base import DatabaseBase


class Database(DatabaseBase):
    """SQLite数据库管理类"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_database()
    
    def get_connection(self):
        """获取数据库连接"""
        conn = sqlite3.connect(
            self.db_path,
            timeout=30.0,  # 设置30秒超时
            check_same_thread=False  # 允许多线程访问
        )
        # 启用WAL模式以支持并发读写
        conn.execute('PRAGMA journal_mode=WAL')
        # 设置繁忙超时
        conn.execute('PRAGMA busy_timeout=30000')  # 30秒
        return conn
    
    def init_database(self):
        """初始化数据库表结构"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # 检查servers表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='servers'")
        table_exists = cursor.fetchone() is not None
        
        if not table_exists:
            # 新建表，使用不带AUTOINCREMENT的主键
            cursor.execute('''
                CREATE TABLE servers (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    host TEXT NOT NULL,
                    port INTEGER NOT NULL,
                    color TEXT,
                    UNIQUE(host, port)
                )
            ''')
        else:
            # 表已存在，检查是否需要迁移
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='servers'")
            create_sql = cursor.fetchone()[0]
            
            # 如果表是AUTOINCREMENT的，需要迁移
            if 'AUTOINCREMENT' in create_sql.upper():
                print("检测到旧版servers表结构，正在迁移...")
                # 重命名旧表
                cursor.execute('ALTER TABLE servers RENAME TO servers_old')
                
                # 创建新表
                cursor.execute('''
                    CREATE TABLE servers (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        host TEXT NOT NULL,
                        port INTEGER NOT NULL,
                        color TEXT,
                        UNIQUE(host, port)
                    )
                ''')
                
                # 复制数据
                cursor.execute('''
                    INSERT INTO servers (id, name, host, port, color)
                    SELECT id, name, host, port, color FROM servers_old
                ''')
                
                # 删除旧表
                cursor.execute('DROP TABLE servers_old')
                conn.commit()
                print("表结构迁移完成")
        
        # 为已存在的servers表添加color列（如果不存在）
        try:
            cursor.execute('ALTER TABLE servers ADD COLUMN color TEXT')
            conn.commit()
        except sqlite3.OperationalError:
            # 列已存在，忽略
            pass
        
        # 创建监控记录表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS status_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                timestamp DATETIME NOT NULL,
                online BOOLEAN NOT NULL,
                latency REAL,
                players_online INTEGER,
                players_max INTEGER,
                version TEXT,
                motd TEXT,
                sample_players TEXT,
                software TEXT,
                plugins TEXT,
                map TEXT,
                FOREIGN KEY (server_id) REFERENCES servers (id)
            )
        ''')

        # 玩家在线会话表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS player_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                player_name TEXT NOT NULL,
                first_seen DATETIME NOT NULL,
                session_start DATETIME,
                last_seen DATETIME NOT NULL,
                online BOOLEAN NOT NULL DEFAULT 0,
                duration_seconds INTEGER,
                UNIQUE(server_id, player_name),
                FOREIGN KEY (server_id) REFERENCES servers (id)
            )
        ''')

        # 历史会话表（便于日历视图）
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS player_session_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                player_name TEXT NOT NULL,
                session_start DATETIME NOT NULL,
                session_end DATETIME NOT NULL,
                FOREIGN KEY (server_id) REFERENCES servers (id)
            )
        ''')

        # 兼容已有数据库，缺少列时补充
        existing_columns = {row[1] for row in cursor.execute('PRAGMA table_info(status_logs)')}
        if 'sample_players' not in existing_columns:
            cursor.execute('ALTER TABLE status_logs ADD COLUMN sample_players TEXT')
        if 'software' not in existing_columns:
            cursor.execute('ALTER TABLE status_logs ADD COLUMN software TEXT')
        if 'plugins' not in existing_columns:
            cursor.execute('ALTER TABLE status_logs ADD COLUMN plugins TEXT')
        if 'map' not in existing_columns:
            cursor.execute('ALTER TABLE status_logs ADD COLUMN map TEXT')
        
        # 为 player_sessions 表添加 duration_seconds 列（如果不存在）
        session_columns = {row[1] for row in cursor.execute('PRAGMA table_info(player_sessions)')}
        if 'duration_seconds' not in session_columns:
            cursor.execute('ALTER TABLE player_sessions ADD COLUMN duration_seconds INTEGER')
        
        # 创建索引以提高查询性能
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_status_logs_timestamp 
            ON status_logs(timestamp)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_status_logs_server_id 
            ON status_logs(server_id)
        ''')
        
        conn.commit()
        conn.close()
    
    def add_server(self, name: str, host: str, port: int, color: str = None, server_id: int = None) -> int:
        """添加服务器，返回服务器ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if server_id is not None:
                # 显式指定ID插入
                cursor.execute('''
                    INSERT INTO servers (id, name, host, port, color) 
                    VALUES (?, ?, ?, ?, ?)
                ''', (server_id, name, host, port, color))
            else:
                # 自动分配ID
                cursor.execute('SELECT COALESCE(MAX(id), 0) + 1 FROM servers')
                server_id = cursor.fetchone()[0]
                cursor.execute('''
                    INSERT INTO servers (id, name, host, port, color) 
                    VALUES (?, ?, ?, ?, ?)
                ''', (server_id, name, host, port, color))
            conn.commit()
        except sqlite3.IntegrityError:
            # 服务器已存在，获取其ID并更新名称和颜色
            cursor.execute('''
                SELECT id FROM servers 
                WHERE host = ? AND port = ?
            ''', (host, port))
            existing_id = cursor.fetchone()
            if existing_id:
                server_id = existing_id[0]
                # 更新名称和颜色
                cursor.execute('UPDATE servers SET name = ?, color = ? WHERE id = ?', (name, color, server_id))
                conn.commit()
            else:
                # 如果是ID冲突而非host:port冲突，抛出异常
                raise
        finally:
            conn.close()
        
        return server_id
    
    def log_status(self, server_id: int, online: bool, latency: Optional[float] = None,
                   players_online: Optional[int] = None, players_max: Optional[int] = None,
                   version: Optional[str] = None, motd: Optional[str] = None,
                   sample_players: Optional[List[str]] = None,
                   software: Optional[str] = None,
                   plugins: Optional[List[str]] = None,
                   map_name: Optional[str] = None,
                   timestamp: Optional[datetime] = None):
        """记录服务器状态"""
        from app_utils import utc8_now
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            
            if timestamp is None:
                timestamp = utc8_now()

            # 将列表序列化为JSON字符串
            sample_players_json = json.dumps(sample_players) if sample_players is not None else None
            plugins_json = json.dumps(plugins) if plugins is not None else None
            cursor.execute('''
                INSERT INTO status_logs 
                (server_id, timestamp, online, latency, players_online, players_max, version, motd, sample_players, software, plugins, map)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (server_id, timestamp, online, latency, players_online, players_max, version, motd,
                  sample_players_json, software, plugins_json, map_name))

            conn.commit()
        finally:
            conn.close()

    def update_player_sessions(self, server_id: int, sample_players: Optional[List[str]], timestamp: datetime):
        """根据当前在线玩家样本更新会话状态"""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()

            if sample_players is None:
                sample_players = []

            current_set = set(sample_players)

            # 取当前在线玩家记录
            cursor.execute('''
                SELECT player_name, online FROM player_sessions
                WHERE server_id = ? AND online = 1
            ''', (server_id,))
            online_now = {row[0] for row in cursor.fetchall()}

            # 标记新上线或持续在线
            for name in current_set:
                cursor.execute('''
                    SELECT online, session_start, first_seen FROM player_sessions
                    WHERE server_id = ? AND player_name = ?
                ''', (server_id, name))
                row = cursor.fetchone()
                if row is None:
                    # 新玩家，插入记录，duration_seconds 初始为 0
                    cursor.execute('''
                        INSERT INTO player_sessions (server_id, player_name, first_seen, session_start, last_seen, online, duration_seconds)
                        VALUES (?, ?, ?, ?, ?, 1, 0)
                    ''', (server_id, name, timestamp, timestamp, timestamp))
                else:
                    online_flag, session_start, first_seen = row
                    if online_flag:
                        # 已在线，更新最后一次看到和计算 duration_seconds
                        if session_start:
                            try:
                                # Parse session_start as UTC+8 naive datetime
                                if isinstance(session_start, str):
                                    session_start_dt = datetime.fromisoformat(session_start)
                                else:
                                    session_start_dt = session_start
                                # timestamp is also UTC+8 naive, so direct subtraction works
                                duration_seconds = int((timestamp - session_start_dt).total_seconds())
                            except (ValueError, TypeError):
                                # 如果解析失败，使用 0
                                duration_seconds = 0
                        else:
                            duration_seconds = 0
                        cursor.execute('''
                            UPDATE player_sessions
                            SET last_seen = ?, duration_seconds = ?
                            WHERE server_id = ? AND player_name = ?
                        ''', (timestamp, duration_seconds, server_id, name))
                    else:
                        # 刚上线，开启新会话，duration_seconds 初始为 0
                        cursor.execute('''
                            UPDATE player_sessions
                            SET online = 1, session_start = ?, last_seen = ?, duration_seconds = 0
                            WHERE server_id = ? AND player_name = ?
                        ''', (timestamp, timestamp, server_id, name))

            # 标记离线：之前在线但这次不在列表中
            to_offline = online_now - current_set
            if to_offline:
                for name in to_offline:
                    cursor.execute('''
                        SELECT session_start FROM player_sessions
                        WHERE server_id = ? AND player_name = ?
                    ''', (server_id, name))
                    row = cursor.fetchone()
                    session_start = row[0] if row else None
                    if session_start:
                        cursor.execute('''
                            INSERT INTO player_session_history (server_id, player_name, session_start, session_end)
                            VALUES (?, ?, ?, ?)
                        ''', (server_id, name, session_start, timestamp))
                    cursor.execute('''
                        UPDATE player_sessions
                        SET online = 0, last_seen = ?, session_start = NULL, duration_seconds = NULL
                        WHERE server_id = ? AND player_name = ?
                    ''', (timestamp, server_id, name))

            conn.commit()
        finally:
            conn.close()

    def get_online_players(self, server_id: int) -> List[Dict]:
        """获取当前在线玩家及会话开始时间"""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT player_name, session_start, last_seen, duration_seconds
                FROM player_sessions
                WHERE server_id = ? AND online = 1
                ORDER BY player_name
            ''', (server_id,))
            rows = cursor.fetchall()
            return [
                {
                    'player_name': r[0],
                    'session_start': r[1].isoformat() if isinstance(r[1], datetime) else r[1],
                    'last_seen': r[2].isoformat() if isinstance(r[2], datetime) else r[2],
                    'duration_seconds': r[3],
                    'online': True  # 此方法只返回在线玩家
                }
                for r in rows
            ]
        finally:
            conn.close()

    def get_all_player_sessions(self, server_id: int) -> List[Dict]:
        """获取所有玩家的会话信息（包含离线）"""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT player_name, first_seen, session_start, last_seen, online, duration_seconds
                FROM player_sessions
                WHERE server_id = ?
                ORDER BY online DESC, last_seen DESC
            ''', (server_id,))
            rows = cursor.fetchall()
            result = []
            for r in rows:
                first_seen = r[1]
                session_start = r[2]
                last_seen = r[3]
                # Convert datetime to ISO string for JSON serialization
                if isinstance(first_seen, datetime):
                    first_seen = first_seen.isoformat()
                if isinstance(session_start, datetime):
                    session_start = session_start.isoformat()
                if isinstance(last_seen, datetime):
                    last_seen = last_seen.isoformat()
                result.append({
                    'player_name': r[0],
                    'first_seen': first_seen,
                    'session_start': session_start,
                    'last_seen': last_seen,
                    'online': bool(r[4]),
                    'duration_seconds': r[5]
                })
            return result
        finally:
            conn.close()

    def get_all_player_names(self) -> List[str]:
        """获取所有玩家名字（包括当前会话和历史会话）"""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            # 从当前会话表获取
            cursor.execute('SELECT DISTINCT player_name FROM player_sessions')
            current_players = {row[0] for row in cursor.fetchall()}
            
            # 从历史会话表获取
            cursor.execute('SELECT DISTINCT player_name FROM player_session_history')
            history_players = {row[0] for row in cursor.fetchall()}
            
            # 合并并排序
            all_players = sorted(current_players | history_players)
            return all_players
        finally:
            conn.close()

    def get_player_history(self, player_name: str, days: int = None) -> List[Dict]:
        """获取玩家历史会话，days=None 时获取全量数据"""
        from app_utils import utc8_now
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            if days is None:
                # 获取全量数据
                cursor.execute('''
                    SELECT session_start, session_end, server_id
                    FROM player_session_history
                    WHERE player_name = ?
                    ORDER BY session_start DESC
                ''', (player_name,))
            else:
                cutoff = utc8_now() - timedelta(days=days)
                cursor.execute('''
                    SELECT session_start, session_end, server_id
                    FROM player_session_history
                    WHERE player_name = ? AND session_end >= ?
                    ORDER BY session_start DESC
                ''', (player_name, cutoff))
            rows = cursor.fetchall()
            result = []
            for r in rows:
                session_start = r[0]
                session_end = r[1]
                # Convert datetime to ISO string for JSON serialization
                if isinstance(session_start, datetime):
                    session_start = session_start.isoformat()
                if isinstance(session_end, datetime):
                    session_end = session_end.isoformat()
                result.append({
                    'session_start': session_start,
                    'session_end': session_end,
                    'server_id': r[2]
                })
            return result
        finally:
            conn.close()
    
    def get_server_latest_status(self, server_id: int) -> Optional[Dict]:
        """获取服务器最新状态"""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT timestamp, online, latency, players_online, players_max, version, motd,
                       sample_players, software, plugins, map
                FROM status_logs
                WHERE server_id = ?
                ORDER BY timestamp DESC
                LIMIT 1
            ''', (server_id,))
            
            row = cursor.fetchone()
            
            if row:
                timestamp = row[0]
                # Convert datetime to ISO string for JSON serialization
                if isinstance(timestamp, datetime):
                    timestamp = timestamp.isoformat()
                return {
                    'timestamp': timestamp,
                    'online': bool(row[1]),
                    'latency': row[2],
                    'players_online': row[3],
                    'players_max': row[4],
                    'version': row[5],
                    'motd': row[6],
                    'sample_players': json.loads(row[7]) if row[7] else None,
                    'software': row[8],
                    'plugins': json.loads(row[9]) if row[9] else None,
                    'map': row[10]
                }
            return None
        finally:
            conn.close()
    
    def get_server_history(self, server_id: int, limit: int = 100) -> List[Dict]:
        """获取服务器历史记录"""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT timestamp, online, latency, players_online, players_max, version, motd,
                       sample_players, software, plugins, map
                FROM status_logs
                WHERE server_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (server_id, limit))
            
            rows = cursor.fetchall()
            
            history = []
            for row in rows:
                timestamp = row[0]
                # Convert datetime to ISO string for JSON serialization
                if isinstance(timestamp, datetime):
                    timestamp = timestamp.isoformat()
                history.append({
                    'timestamp': timestamp,
                    'online': bool(row[1]),
                    'latency': row[2],
                    'players_online': row[3],
                    'players_max': row[4],
                    'version': row[5],
                    'motd': row[6],
                    'sample_players': json.loads(row[7]) if row[7] else None,
                    'software': row[8],
                    'plugins': json.loads(row[9]) if row[9] else None,
                    'map': row[10]
                })
            
            return history
        finally:
            conn.close()
    
    def get_all_servers(self) -> List[Dict]:
        """获取所有服务器信息"""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            
            cursor.execute('SELECT id, name, host, port, color FROM servers')
            rows = cursor.fetchall()
            
            servers = []
            for row in rows:
                servers.append({
                    'id': row[0],
                    'name': row[1],
                    'host': row[2],
                    'port': row[3],
                    'color': row[4]
                })
            
            return servers
        finally:
            conn.close()
