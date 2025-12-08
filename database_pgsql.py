"""PostgreSQL 数据库实现"""
import psycopg2
import psycopg2.extras
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from database_base import DatabaseBase


class PostgreSQLDatabase(DatabaseBase):
    """PostgreSQL 数据库管理类"""
    
    def __init__(self, host: str, port: int, database: str, user: str, password: str):
        self.host = host
        self.port = port
        self.database = database
        self.user = user
        self.password = password
        self.init_database()
    
    def get_connection(self):
        """获取数据库连接"""
        return psycopg2.connect(
            host=self.host,
            port=self.port,
            database=self.database,
            user=self.user,
            password=self.password,
            connect_timeout=30
        )
    
    def init_database(self):
        """初始化数据库表结构
        
        注意：PostgreSQL 使用 true/false 作为布尔值默认值，
        而 SQLite 使用 0/1。这是两者的主要差异之一。
        """
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            
            # 创建servers表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS servers (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    host TEXT NOT NULL,
                    port INTEGER NOT NULL,
                    color TEXT,
                    UNIQUE(host, port)
                )
            ''')
            
            # 创建监控记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS status_logs (
                    id SERIAL PRIMARY KEY,
                    server_id INTEGER NOT NULL,
                    timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,
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
            
            # 创建玩家会话表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS player_sessions (
                    server_id INTEGER NOT NULL,
                    player_name TEXT NOT NULL,
                    first_seen TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                    session_start TIMESTAMP WITHOUT TIME ZONE,
                    last_seen TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                    online BOOLEAN NOT NULL DEFAULT false,
                    duration_seconds INTEGER,
                    PRIMARY KEY (server_id, player_name),
                    FOREIGN KEY (server_id) REFERENCES servers (id)
                )
            ''')
            
            # 创建玩家会话历史表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS player_session_history (
                    id SERIAL PRIMARY KEY,
                    server_id INTEGER NOT NULL,
                    player_name TEXT NOT NULL,
                    session_start TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                    session_end TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                    FOREIGN KEY (server_id) REFERENCES servers (id)
                )
            ''')
            
            # 创建索引
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_status_logs_timestamp 
                ON status_logs(timestamp)
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_status_logs_server_id 
                ON status_logs(server_id)
            ''')
            
            conn.commit()
        finally:
            conn.close()
    
    def add_server(self, name: str, host: str, port: int, color: str = None, server_id: int = None) -> int:
        """添加服务器，返回服务器ID"""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            
            if server_id is not None:
                # 显式指定ID插入
                cursor.execute('''
                    INSERT INTO servers (id, name, host, port, color) 
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (host, port) 
                    DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color
                    RETURNING id
                ''', (server_id, name, host, port, color))
                server_id = cursor.fetchone()[0]
            else:
                # 自动分配ID
                cursor.execute('SELECT COALESCE(MAX(id), 0) + 1 FROM servers')
                server_id = cursor.fetchone()[0]
                cursor.execute('''
                    INSERT INTO servers (id, name, host, port, color) 
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (host, port) 
                    DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color
                    RETURNING id
                ''', (server_id, name, host, port, color))
                server_id = cursor.fetchone()[0]
            
            conn.commit()
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
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                WHERE server_id = %s AND online = true
            ''', (server_id,))
            online_now = {row[0] for row in cursor.fetchall()}

            # 标记新上线或持续在线
            for name in current_set:
                cursor.execute('''
                    SELECT online, session_start, first_seen FROM player_sessions
                    WHERE server_id = %s AND player_name = %s
                ''', (server_id, name))
                row = cursor.fetchone()
                if row is None:
                    # 新玩家，插入记录，duration_seconds 初始为 0
                    cursor.execute('''
                        INSERT INTO player_sessions (server_id, player_name, first_seen, session_start, last_seen, online, duration_seconds)
                        VALUES (%s, %s, %s, %s, %s, true, 0)
                    ''', (server_id, name, timestamp, timestamp, timestamp))
                else:
                    online_flag, session_start, first_seen = row
                    if online_flag:
                        # 已在线，更新最后一次看到和计算 duration_seconds
                        if session_start:
                            try:
                                if isinstance(session_start, str):
                                    session_start_dt = datetime.fromisoformat(session_start)
                                else:
                                    session_start_dt = session_start
                                duration_seconds = int((timestamp - session_start_dt).total_seconds())
                            except (ValueError, TypeError):
                                duration_seconds = 0
                        else:
                            duration_seconds = 0
                        cursor.execute('''
                            UPDATE player_sessions
                            SET last_seen = %s, duration_seconds = %s
                            WHERE server_id = %s AND player_name = %s
                        ''', (timestamp, duration_seconds, server_id, name))
                    else:
                        # 刚上线，开启新会话，duration_seconds 初始为 0
                        cursor.execute('''
                            UPDATE player_sessions
                            SET online = true, session_start = %s, last_seen = %s, duration_seconds = 0
                            WHERE server_id = %s AND player_name = %s
                        ''', (timestamp, timestamp, server_id, name))

            # 标记离线：之前在线但这次不在列表中
            to_offline = online_now - current_set
            if to_offline:
                for name in to_offline:
                    cursor.execute('''
                        SELECT session_start FROM player_sessions
                        WHERE server_id = %s AND player_name = %s
                    ''', (server_id, name))
                    row = cursor.fetchone()
                    session_start = row[0] if row else None
                    if session_start:
                        cursor.execute('''
                            INSERT INTO player_session_history (server_id, player_name, session_start, session_end)
                            VALUES (%s, %s, %s, %s)
                        ''', (server_id, name, session_start, timestamp))
                    cursor.execute('''
                        UPDATE player_sessions
                        SET online = false, last_seen = %s, session_start = NULL, duration_seconds = NULL
                        WHERE server_id = %s AND player_name = %s
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
                WHERE server_id = %s AND online = true
                ORDER BY player_name
            ''', (server_id,))
            rows = cursor.fetchall()
            return [
                {
                    'player_name': r[0],
                    'session_start': r[1],
                    'last_seen': r[2],
                    'duration_seconds': r[3]
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
                WHERE server_id = %s
                ORDER BY online DESC, last_seen DESC
            ''', (server_id,))
            rows = cursor.fetchall()
            return [
                {
                    'player_name': r[0],
                    'first_seen': r[1],
                    'session_start': r[2],
                    'last_seen': r[3],
                    'online': bool(r[4]),
                    'duration_seconds': r[5]
                }
                for r in rows
            ]
        finally:
            conn.close()

    def get_player_history(self, player_name: str, days: int = 30) -> List[Dict]:
        """获取玩家历史会话"""
        from app_utils import utc8_now
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cutoff = utc8_now() - timedelta(days=days)
            cursor.execute('''
                SELECT session_start, session_end, server_id
                FROM player_session_history
                WHERE player_name = %s AND session_end >= %s
                ORDER BY session_start DESC
            ''', (player_name, cutoff))
            rows = cursor.fetchall()
            return [
                {
                    'session_start': r[0],
                    'session_end': r[1],
                    'server_id': r[2]
                }
                for r in rows
            ]
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
                WHERE server_id = %s
                ORDER BY timestamp DESC
                LIMIT 1
            ''', (server_id,))
            
            row = cursor.fetchone()
            
            if row:
                return {
                    'timestamp': row[0],
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
                WHERE server_id = %s
                ORDER BY timestamp DESC
                LIMIT %s
            ''', (server_id, limit))
            
            rows = cursor.fetchall()
            
            history = []
            for row in rows:
                history.append({
                    'timestamp': row[0],
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
