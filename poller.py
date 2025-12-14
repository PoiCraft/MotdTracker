import json
import logging
import requests
from app_utils import utc8_now
from typing import Dict, List
from concurrent.futures import ThreadPoolExecutor, as_completed
from apscheduler.schedulers.background import BackgroundScheduler
from database_factory import create_database
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
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)

        # 使用数据库工厂创建数据库实例（支持SQLite和PostgreSQL）
        self.db = create_database(self.config)

        # 初始化监控器
        self.monitor = MinecraftMonitor()

        # 初始化调度器
        self.scheduler = BackgroundScheduler()

        # WebSocket 实例
        self.socketio = socketio

        # 服务器ID映射
        self.server_ids: Dict[str, int] = {}

        # 服务器上一帧在线状态缓存
        self.previous_status: Dict[int, bool] = {}
        # 服务器当前帧在线状态缓存
        self.current_status: Dict[int, bool] = {}

        # 设置日志
        logging.basicConfig(
            level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
        )
        self.logger = logging.getLogger(__name__)

        # 注册节点
        self._register_servers()

    def get_24h_limit(self) -> int:
        """
        计算24小时的记录数限制

        Returns:
            24小时内的记录数（基于poll_interval计算）
        """
        poll_interval = self.config.get("poll_interval", 60)  # 默认60秒
        return int(24 * 60 * 60 / poll_interval)  # 24小时的秒数 / 轮询间隔

    def _register_servers(self):
        """在数据库中注册配置文件中的服务器"""
        for node in self.config.get("nodes", []):
            name = node["name"]
            host = node["host"]
            port = node.get("port", 25565)
            color = node.get("color")  # 获取颜色配置
            node_id = node.get("id")  # 获取显式指定的ID

            server_id = self.db.add_server(name, host, port, color, node_id)
            key = f"{host}:{port}"
            self.server_ids[key] = server_id

            self.logger.info(f"已注册节点 {name} ({host}:{port}) - ID: {server_id}")

    def poll_server(self, server_info: Dict, timestamp=None):
        """
        轮询单个节点

        Args:
            server_info: 节点信息字典
        """
        name = server_info["name"]
        host = server_info["host"]
        port = server_info.get("port", 25565)

        # 获取节点ID
        key = f"{host}:{port}"
        server_id = self.server_ids.get(key)

        if server_id is None:
            self.logger.error(f"未找到节点ID: {name}")
            return

        # 查询节点状态
        self.logger.info(f"正在查询节点 {name} ({host}:{port})")
        status = self.monitor.query_server(host, port)

        # 记录到数据库
        self.db.log_status(
            server_id=server_id,
            online=status["online"],
            latency=status["latency"],
            players_online=status["players_online"],
            players_max=status["players_max"],
            version=status["version"],
            motd=status["motd"],
            sample_players=status.get("sample_players"),
            software=status.get("software"),
            plugins=status.get("plugins"),
            map_name=status.get("map"),
            timestamp=timestamp,
        )

        # 维护在线状态缓存
        self.previous_status[server_id] = self.current_status.get(server_id, True)
        self.current_status[server_id] = status["online"]

        # 更新玩家在线会话（无论服务器是否离线，都需要更新）
        # 如果服务器离线或没有获取到玩家列表，传入空列表会标记所有在线玩家为离线
        sample_players = status.get("sample_players") if status.get("online") else None
        self.db.update_player_sessions(
            server_id, sample_players, timestamp or utc8_now()
        )

        # 输出状态
        status_str = self.monitor.format_status(status)
        self.logger.info(f"{name}: {status_str}")

    def poll_all_servers(self):
        """轮询所有服务器"""
        self.logger.info("=" * 60)
        self.logger.info("开始轮询所有节点")

        round_timestamp = utc8_now()

        nodes = self.config.get("nodes", [])
        max_workers = min(8, len(nodes)) if nodes else 0

        if max_workers == 0:
            self.logger.info("无节点可轮询")
            return

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_server = {
                executor.submit(self.poll_server, node, timestamp=round_timestamp): node
                for node in nodes
            }

            for future in as_completed(future_to_server):
                server = future_to_server[future]
                try:
                    future.result()
                except Exception as e:
                    self.logger.error(f"轮询节点 {server['name']} 时出错 {str(e)}")

        # 所有节点轮询完成后，发送一次WebSocket 通知
        if self.socketio:
            self.socketio.emit(
                "poll_complete", {"timestamp": round_timestamp.isoformat()}
            )

        # 检查告警
        self.check_alerts()

        self.logger.info("本轮轮询完成")
        self.logger.info("=" * 60)

    def start(self):
        """启动定时轮询"""
        poll_interval = self.config.get("poll_interval", 60)

        # 添加定时任务
        self.scheduler.add_job(
            self.poll_all_servers, "interval", seconds=poll_interval, id="poll_servers"
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
            status = self.db.get_server_latest_status(server["id"])
            result.append({**server, "status": status})

        return result

    def _send_napcat_msg(self, group, msg):
        repo = requests.post(
            f"http://{self.config.get('napcat_alert', {}).get('host', '')}/send_group_msg",
            json={
                "group_id": group,
                "message": [{"type": "text", "data": {"text": msg}}],
            },
        ).json()
        return repo.get("status") == "ok"

    def _send_msgs(self, msg):
        napcat_config = self.config.get("napcat_alert", {})
        groups = napcat_config.get("groups", [])
        for group in groups:
            try:
                self._send_napcat_msg(group, msg)
            except Exception as e:
                self.logger.error(f"Napcat 消息发送失败: {str(e)}")

    def send_alert(self, msg):
        """发送Napcat告警消息"""
        try:
            self._send_msgs(msg)
            self.logger.info("Napcat 告警消息发送成功")
        except Exception as e:
            self.logger.error(f"Napcat 告警消息发送失败: {str(e)}")

    def check_alerts(self):
        """检查服务器状态变化并发送告警"""
        # 聚合上一帧的情况，全部离线则记录离线
        previous_all_offline = all(
            not status for status in self.previous_status.values()
        )
        # 聚合当前帧的情况，有在线则记录在线
        current_any_online = any(status for status in self.current_status.values())

        # 如果上一帧全部离线且当前帧有在线，发送上线告警
        if previous_all_offline and current_any_online:
            msg = "【告警】服务器已上线"
            self.send_alert(msg)
            self.logger.info("发送上线告警")

        # 如果上一帧有在线且当前帧全部离线，发送离线告警
        if not previous_all_offline and not current_any_online:
            msg = "【告警】服务器已离线"
            self.send_alert(msg)
            self.logger.info("发送离线告警")
