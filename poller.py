import json
import logging
from datetime import datetime
from typing import Dict, List
from concurrent.futures import ThreadPoolExecutor, as_completed
from apscheduler.schedulers.background import BackgroundScheduler
from database import Database
from monitor import MinecraftMonitor


class ServerPoller:
    """服务器轮询器"""
    
    def __init__(self, config_path: str, socketio=None):
        """
        初始化轮询器
        
        Args:
            config_path: 配置文件路径
            socketio: SocketIO 实例（可选）
        """
        # 加载配置
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
        
        # 初始化数据库
        self.db = Database(self.config.get('database', 'minecraft_stats.db'))
        
        # 初始化监控器
        self.monitor = MinecraftMonitor()
        
        # 初始化调度器
        self.scheduler = BackgroundScheduler()
        
        # WebSocket 实例
        self.socketio = socketio
        
        # 服务器ID映射
        self.server_ids: Dict[str, int] = {}
        
        # 设置日志
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # 注册服务器
        self._register_servers()
    
    def _register_servers(self):
        """在数据库中注册配置文件中的服务器"""
        for server in self.config.get('servers', []):
            name = server['name']
            host = server['host']
            port = server.get('port', 25565)
            
            server_id = self.db.add_server(name, host, port)
            key = f"{host}:{port}"
            self.server_ids[key] = server_id
            
            self.logger.info(f"已注册服务器: {name} ({host}:{port}) - ID: {server_id}")
    
    def poll_server(self, server_info: Dict, timestamp=None):
        """
        轮询单个服务器
        
        Args:
            server_info: 服务器信息字典
        """
        name = server_info['name']
        host = server_info['host']
        port = server_info.get('port', 25565)
        
        # 获取服务器ID
        key = f"{host}:{port}"
        server_id = self.server_ids.get(key)
        
        if server_id is None:
            self.logger.error(f"未找到服务器ID: {name}")
            return
        
        # 查询服务器状态
        self.logger.info(f"正在查询服务器: {name} ({host}:{port})")
        status = self.monitor.query_server(host, port)
        
        # 记录到数据库
        self.db.log_status(
            server_id=server_id,
            online=status['online'],
            latency=status['latency'],
            players_online=status['players_online'],
            players_max=status['players_max'],
            version=status['version'],
            motd=status['motd'],
            sample_players=status.get('sample_players'),
            software=status.get('software'),
            plugins=status.get('plugins'),
            map_name=status.get('map'),
            timestamp=timestamp
        )

        # 更新玩家在线会话
        if status.get('sample_players') is not None:
            self.db.update_player_sessions(server_id, status.get('sample_players'), timestamp or datetime.now())
        
        # 输出状态
        status_str = self.monitor.format_status(status)
        self.logger.info(f"{name}: {status_str}")
        
        # 通过 WebSocket 推送更新
        if self.socketio:
            self.socketio.emit('server_update', {
                'server_id': server_id,
                'name': name,
                'status': status,
                'timestamp': (timestamp or datetime.now()).isoformat() if timestamp else datetime.now().isoformat()
            })
    
    def poll_all_servers(self):
        """轮询所有服务器"""
        self.logger.info("=" * 60)
        self.logger.info("开始轮询所有服务器")
        
        round_timestamp = datetime.now()

        servers = self.config.get('servers', [])
        max_workers = min(8, len(servers)) if servers else 0

        if max_workers == 0:
            self.logger.info("无服务器可轮询")
            return

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_server = {
                executor.submit(self.poll_server, server, timestamp=round_timestamp): server
                for server in servers
            }

            for future in as_completed(future_to_server):
                server = future_to_server[future]
                try:
                    future.result()
                except Exception as e:
                    self.logger.error(f"轮询服务器 {server['name']} 时出错: {str(e)}")
        
        self.logger.info("本轮轮询完成")
        self.logger.info("=" * 60)
    
    def start(self):
        """启动定时轮询"""
        poll_interval = self.config.get('poll_interval', 60)
        
        # 添加定时任务
        self.scheduler.add_job(
            self.poll_all_servers,
            'interval',
            seconds=poll_interval,
            id='poll_servers'
        )
        
        # 启动调度器
        self.scheduler.start()
        self.logger.info(f"定时轮询已启动，间隔: {poll_interval}秒")
        
        # 异步执行首次轮询，不阻塞
        import threading
        threading.Thread(target=self.poll_all_servers, daemon=True).start()
    
    def stop(self):
        """停止定时轮询"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            self.logger.info("定时轮询已停止")
    
    def get_all_servers_status(self) -> List[Dict]:
        """获取所有服务器的最新状态"""
        servers = self.db.get_all_servers()
        result = []
        
        for server in servers:
            status = self.db.get_server_latest_status(server['id'])
            result.append({
                **server,
                'status': status
            })
        
        return result
