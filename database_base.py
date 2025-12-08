"""数据库抽象基类"""
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from datetime import datetime


class DatabaseBase(ABC):
    """数据库操作抽象基类"""
    
    @abstractmethod
    def get_connection(self):
        """获取数据库连接"""
        pass
    
    @abstractmethod
    def init_database(self):
        """初始化数据库表结构"""
        pass
    
    @abstractmethod
    def add_server(self, name: str, host: str, port: int, color: str = None, server_id: int = None) -> int:
        """添加服务器，返回服务器ID"""
        pass
    
    @abstractmethod
    def log_status(self, server_id: int, online: bool, latency: Optional[float] = None,
                   players_online: Optional[int] = None, players_max: Optional[int] = None,
                   version: Optional[str] = None, motd: Optional[str] = None,
                   sample_players: Optional[List[str]] = None,
                   software: Optional[str] = None,
                   plugins: Optional[List[str]] = None,
                   map_name: Optional[str] = None,
                   timestamp: Optional[datetime] = None):
        """记录服务器状态"""
        pass
    
    @abstractmethod
    def update_player_sessions(self, server_id: int, sample_players: Optional[List[str]], timestamp: datetime):
        """根据当前在线玩家样本更新会话状态"""
        pass
    
    @abstractmethod
    def get_online_players(self, server_id: int) -> List[Dict]:
        """获取当前在线玩家及会话开始时间"""
        pass
    
    @abstractmethod
    def get_all_player_sessions(self, server_id: int) -> List[Dict]:
        """获取所有玩家的会话信息（包含离线）"""
        pass
    
    @abstractmethod
    def get_player_history(self, player_name: str, days: int = 30) -> List[Dict]:
        """获取玩家历史会话"""
        pass
    
    @abstractmethod
    def get_server_latest_status(self, server_id: int) -> Optional[Dict]:
        """获取服务器最新状态"""
        pass
    
    @abstractmethod
    def get_server_history(self, server_id: int, limit: int = 100) -> List[Dict]:
        """获取服务器历史记录"""
        pass
    
    @abstractmethod
    def get_all_servers(self) -> List[Dict]:
        """获取所有服务器信息"""
        pass
