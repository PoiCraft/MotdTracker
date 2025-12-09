from datetime import datetime
from flask import request
from flask_restx import Namespace, Resource
from app_utils import clamp_hours_param, get_server_nodes_data, parse_dt
from routes.route_utils import (
    filter_history_by_time,
    calculate_node_stats,
    get_compact_history,
    get_aggregated_history,
    get_uptime_data,
    get_status_timeline,
    get_node_status_timeline,
)


def register_web_routes(api, poller):
    """
    Web 前端专用 API
    提供完整数据和增量数据，减少前端请求次数
    """
    web_ns = Namespace("web", description="Web 前端专用接口", path="/web")

    # ==================== 辅助函数 ====================

    def get_online_players():
        """获取所有在线玩家，使用与 player_api 完全一致的聚合逻辑"""
        nodes = get_server_nodes_data(poller)
        aggregated = {}

        for node in nodes:
            # 使用 get_all_player_sessions 获取完整的会话信息
            sessions = poller.db.get_all_player_sessions(node["id"])

            for s in sessions:
                # 只处理在线玩家
                if not s.get("online"):
                    continue

                name = s.get("player_name")
                if not name:
                    continue

                # 解析时间戳
                start_dt = parse_dt(s.get("session_start"))
                last_dt = parse_dt(s.get("last_seen"))
                first_dt = parse_dt(s.get("first_seen"))
                duration_seconds = s.get("duration_seconds")

                if name not in aggregated:
                    # 首次见到该玩家，创建新记录
                    aggregated[name] = {
                        "player_name": name,
                        "online": True,
                        "first_seen": first_dt.isoformat() if first_dt else None,
                        "session_start": start_dt.isoformat() if start_dt else None,
                        "last_seen": last_dt.isoformat() if last_dt else None,
                        "last_seen_dt": last_dt,  # 临时字段用于排序
                        "duration_seconds": duration_seconds,
                    }
                else:
                    # 已存在该玩家，合并数据
                    agg = aggregated[name]

                    # 更新 last_seen 为最新的
                    if last_dt and (
                        agg["last_seen_dt"] is None or last_dt > agg["last_seen_dt"]
                    ):
                        agg["last_seen_dt"] = last_dt
                        agg["last_seen"] = last_dt.isoformat()

                    # 更新 first_seen 为最早的
                    if first_dt:
                        if agg["first_seen"] is None:
                            agg["first_seen"] = first_dt.isoformat()
                        else:
                            try:
                                agg_first = datetime.fromisoformat(agg["first_seen"])
                                if first_dt < agg_first:
                                    agg["first_seen"] = first_dt.isoformat()
                            except Exception:
                                agg["first_seen"] = first_dt.isoformat()

                    # 更新 session_start 为最早的
                    if start_dt:
                        if agg["session_start"] is None:
                            agg["session_start"] = start_dt.isoformat()
                        else:
                            try:
                                agg_start = datetime.fromisoformat(agg["session_start"])
                                if start_dt < agg_start:
                                    agg["session_start"] = start_dt.isoformat()
                            except Exception:
                                agg["session_start"] = start_dt.isoformat()

                    # 更新 duration 为最大的
                    if duration_seconds is not None:
                        if (
                            agg["duration_seconds"] is None
                            or duration_seconds > agg["duration_seconds"]
                        ):
                            agg["duration_seconds"] = duration_seconds

        # 转换为列表并排序（按最后见到时间降序）
        result = list(aggregated.values())
        result.sort(
            key=lambda x: (
                not x["online"],
                x["player_name"].lower(),
                -(
                    x["last_seen_dt"].timestamp()
                    if x["last_seen_dt"]
                    else float("-inf")
                ),
            )
        )

        # 移除临时字段
        for p in result:
            p.pop("last_seen_dt", None)

        return result

    def get_server_head():
        """获取服务器聚合 head 状态"""
        nodes = get_server_nodes_data(poller)
        if not nodes:
            return {}

        nodes_with_status = [n for n in nodes if n.get("latest_status")]
        if not nodes_with_status:
            return {"nodes": nodes}

        online_nodes = [
            n for n in nodes_with_status if n["latest_status"].get("online")
        ]
        selected = online_nodes[0] if online_nodes else nodes_with_status[0]

        latencies = {
            n["name"]: n["latest_status"].get("latency")
            if n["latest_status"].get("online")
            else None
            for n in nodes_with_status
        }

        selected_status = selected["latest_status"]

        return {
            "timestamp": selected_status.get("timestamp"),  # 已经是 ISO 字符串
            "online": any(n["latest_status"].get("online") for n in nodes_with_status),
            "players_online": selected_status.get("players_online"),
            "players_max": selected_status.get("players_max"),
            "latencies": latencies,
            "version": selected_status.get("version"),
            "motd": selected_status.get("motd"),
            "nodes": nodes_with_status,
        }

    # ==================== API 端点 ====================

    @web_ns.route("/server")
    class WebServer(Resource):
        @web_ns.doc(
            "获取服务器页面完整数据",
            description="一次性获取服务器页面所需的所有数据（完整加载）。历史数据按时间升序排列（最旧在前，最新在后），适合图表从左到右显示。",
        )
        @web_ns.param("hours", "时间范围（小时）", type="int", default=12)
        def get(self):
            hours = clamp_hours_param(request)

            # 获取所有节点数据
            nodes = get_server_nodes_data(poller)

            # 计算用户请求的时间范围的 limit
            poll_interval = poller.config.get("poll_interval", 60)
            limit_for_hours = max(1, int(hours * 3600 / poll_interval))

            # 获取每个节点的统计数据（基于用户请求的时间范围）
            stats_by_id = {}
            for node in nodes:
                history = poller.db.get_server_history(
                    node["id"], limit=limit_for_hours
                )
                history = filter_history_by_time(history, hours)
                if history:
                    stats = calculate_node_stats(history)
                    stats["hours"] = hours  # 标记统计数据对应的时间范围
                    stats_by_id[node["id"]] = stats

            # 获取聚合历史数据（用于图表）
            history = get_aggregated_history(poller, hours)

            # 获取 24 小时 uptime（固定 24 小时）
            uptime_data = get_uptime_data(poller, 24)

            # 获取状态时间线（固定 24 小时热图）
            status_timeline = get_status_timeline(poller, 24)

            # 获取在线玩家列表
            players = get_online_players()

            # 获取最新状态（head）
            head = get_server_head()

            return {
                "nodes": nodes,
                "stats_by_id": stats_by_id,
                "history": history,
                "uptime": uptime_data,
                "status_timeline": status_timeline,
                "players": players,
                "head": head,
                "config": {
                    "poll_interval": poller.config.get("poll_interval", 60),
                    "server_name": poller.config.get("server_name", "Minecraft Server"),
                },
            }

    @web_ns.route("/server/head")
    class WebServerHead(Resource):
        @web_ns.doc(
            "获取服务器增量更新数据",
            description="获取服务器页面增量更新所需的完整增量数据，包括最新状态、统计数据和历史数据点。历史数据按时间升序排列（最旧在前，最新在后）。",
        )
        @web_ns.param("hours", "时间范围（小时）", type="int", default=12)
        def get(self):
            hours = clamp_hours_param(request)

            # 获取所有节点数据（包含最新状态）
            nodes = get_server_nodes_data(poller)

            # 计算用户请求的时间范围的 limit
            poll_interval = poller.config.get("poll_interval", 60)
            limit_for_hours = max(1, int(hours * 3600 / poll_interval))

            # 获取每个节点的统计数据（基于用户请求的时间范围）
            stats_by_id = {}
            for node in nodes:
                history = poller.db.get_server_history(
                    node["id"], limit=limit_for_hours
                )
                history = filter_history_by_time(history, hours)
                if history:
                    stats = calculate_node_stats(history)
                    stats["hours"] = hours
                    stats_by_id[node["id"]] = stats

            # 获取最新的聚合历史数据（仅最新一个点用于增量更新图表）
            history_full = get_aggregated_history(poller, hours)
            latest_history_point = None
            if history_full and history_full.get("timestamps"):
                idx = len(history_full["timestamps"]) - 1
                latest_history_point = {
                    "timestamp": history_full["timestamps"][idx],
                    "online": history_full["online"][idx]
                    if history_full.get("online")
                    else False,
                    "players_online": history_full["players_online"][idx]
                    if history_full.get("players_online")
                    else None,
                    "players_max": history_full["players_max"][idx]
                    if history_full.get("players_max")
                    else None,
                    "latencies": {
                        name: arr[idx]
                        for name, arr in history_full.get("latencies", {}).items()
                    }
                    if history_full.get("latencies")
                    else {},
                }

            # 获取 24 小时 uptime（固定 24 小时）
            uptime_data = get_uptime_data(poller, 24)

            # 获取状态时间线（固定 24 小时热图）
            status_timeline = get_status_timeline(poller, 24)

            # 获取在线玩家列表
            players = get_online_players()

            # 获取聚合 head 状态
            head = get_server_head()

            return {
                "nodes": nodes,
                "stats_by_id": stats_by_id,
                "latest_history_point": latest_history_point,
                "uptime": uptime_data,
                "status_timeline": status_timeline,
                "players": players,
                "head": head,
                "config": {
                    "poll_interval": poller.config.get("poll_interval", 60),
                    "server_name": poller.config.get("server_name", "Minecraft Server"),
                },
            }

    @web_ns.route("/node/<int:node_id>")
    class WebNode(Resource):
        @web_ns.doc(
            "获取节点页面完整数据",
            description="一次性获取单个节点页面所需的所有数据（完整加载）。历史数据按时间升序排列（最旧在前，最新在后），适合图表从左到右显示。",
        )
        @web_ns.param("hours", "时间范围（小时）", type="int", default=12)
        def get(self, node_id):
            hours = clamp_hours_param(request)
            poll_interval = poller.config.get("poll_interval", 60)
            limit = max(1, int(hours * 3600 / poll_interval))

            # 获取节点基本信息
            servers = poller.db.get_all_servers()
            server = next((s for s in servers if s["id"] == node_id), None)
            if not server:
                return {"error": "Node not found"}, 404

            # 获取最新状态
            latest_status = poller.db.get_server_latest_status(node_id)

            # 获取历史数据
            history = poller.db.get_server_history(node_id, limit=limit)
            history = filter_history_by_time(history, hours)

            # 获取统计数据（跟随用户请求的时间范围）
            stats = None
            if history:
                stats = calculate_node_stats(history)
                stats["hours"] = hours  # 标记统计数据对应的时间范围

            # 获取紧凑格式的历史数据
            compact_history = get_compact_history(history)

            # 获取状态时间线
            status_timeline = get_node_status_timeline(poller, node_id, 24)

            return {
                "server": {**server, "latest_status": latest_status},
                "history": compact_history,
                "stats": stats,
                "status_timeline": status_timeline,
                "config": {"poll_interval": poller.config.get("poll_interval", 60)},
            }

    @web_ns.route("/node/<int:node_id>/head")
    class WebNodeHead(Resource):
        @web_ns.doc(
            "获取节点增量更新数据",
            description="获取单个节点页面增量更新所需的完整增量数据，包括最新状态、统计数据和历史数据点。历史数据按时间升序排列（最旧在前，最新在后）。",
        )
        @web_ns.param("hours", "时间范围（小时）", type="int", default=12)
        def get(self, node_id):
            hours = clamp_hours_param(request)
            poll_interval = poller.config.get("poll_interval", 60)
            limit = max(1, int(hours * 3600 / poll_interval))

            # 获取节点基本信息
            servers = poller.db.get_all_servers()
            server = next((s for s in servers if s["id"] == node_id), None)
            if not server:
                return {"error": "Node not found"}, 404

            # 获取最新状态
            latest_status = poller.db.get_server_latest_status(node_id)

            # 获取历史数据用于统计和最新点
            history = poller.db.get_server_history(node_id, limit=limit)
            history = filter_history_by_time(history, hours)

            # 获取统计数据（跟随用户请求的时间范围）
            stats = None
            if history:
                stats = calculate_node_stats(history)
                stats["hours"] = hours

            # 获取最新历史数据点
            latest_history_point = None
            if history:
                latest = history[-1]
                timestamp = latest.get("timestamp")
                latest_history_point = {
                    "timestamp": timestamp.isoformat()
                    if isinstance(timestamp, datetime)
                    else timestamp,
                    "online": latest.get("online"),
                    "latency": latest.get("latency"),
                    "players_online": latest.get("players_online"),
                    "players_max": latest.get("players_max"),
                }

            # 获取状态时间线
            status_timeline = get_node_status_timeline(poller, node_id, 24)

            return {
                "server": {
                    "id": server["id"],
                    "name": server["name"],
                    "latest_status": latest_status,
                },
                "stats": stats,
                "latest_history_point": latest_history_point,
                "status_timeline": status_timeline,
                "config": {"poll_interval": poller.config.get("poll_interval", 60)},
            }

    api.add_namespace(web_ns)
    return web_ns
