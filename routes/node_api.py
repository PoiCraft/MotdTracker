from flask import request
from flask_restx import Namespace, Resource, abort
from utils.app_utils import clamp_hours_param, get_server_nodes_data, parse_dt
from utils.data_stats import calculate_latency_stats
from utils.data_processing import (
    filter_history_by_time, sort_history_by_timestamp, select_representative_record,
    format_compact_history
)
from utils.history_query import get_history_limit, get_node_status_timeline


def register_node_routes(api, poller):
    node_ns = Namespace('node', description='节点相关接口', path='/node')

    @node_ns.route('')
    class Nodes(Resource):
        @node_ns.doc(
            '获取所有节点列表',
            description='获取服务器的所有节点及其最新状态。每个节点包含 24 小时延迟统计数据。注意：如果节点已禁用（enabled=false），status 将返回 null。'
        )
        def get(self):
            return poller.get_all_servers_status()

    @node_ns.route('/<int:node_id>')
    class Node(Resource):
        @node_ns.doc(
            '获取单个节点详情',
            description='获取指定节点的最新状态信息，包含在线玩家、版本、MOTD 等。',
            params={'node_id': '节点 ID'}
        )
        def get(self, node_id):
            status = poller.db.get_server_latest_status(node_id)
            if status is None:
                abort(404, '节点不存在')
            return status

    @node_ns.route('/<int:node_id>/head')
    class NodeHead(Resource):
        @node_ns.doc(
            '获取节点实时状态',
            description='获取指定节点的最新状态（head），包含节点配置和最新的服务器状态信息。注意：如果节点已禁用（enabled=false），latest_status 将始终返回 null。',
            params={'node_id': '节点 ID'}
        )
        def get(self, node_id):
            server = next((s for s in poller.db.get_all_servers() if s['id'] == node_id), None)
            if server is None:
                abort(404, '节点不存在')

            # 从配置中获取 enabled 状态
            node_config_map = {node.get('id'): node for node in poller.config.get('nodes', []) if node.get('id')}
            node_config = node_config_map.get(node_id, {})
            enabled = node_config.get('enable', True)

            # 禁用节点的 status 直接返回 null，不查询数据库
            status = poller.db.get_server_latest_status(node_id) if enabled else None

            return {**server, 'latest_status': status, 'enabled': enabled}

    @node_ns.route('/<int:node_id>/online_players')
    class NodeOnlinePlayers(Resource):
        @node_ns.doc(
            '获取节点在线玩家',
            description='获取指定节点当前在线的玩家列表，包含会话时长信息。',
            params={'node_id': '节点 ID'}
        )
        def get(self, node_id):
            players = poller.db.get_online_players(node_id)
            result = []
            for p in players:
                start_dt = parse_dt(p.get('session_start'))
                last_dt = parse_dt(p.get('last_seen'))
                result.append({
                    'player_name': p.get('player_name'),
                    'online': True,
                    'session_start': start_dt.isoformat() if start_dt else None,
                    'last_seen': last_dt.isoformat() if last_dt else None,
                    'duration_seconds': p.get('duration_seconds')
                })
            return result

    @node_ns.route('/<int:node_id>/history')
    class NodeHistory(Resource):
        @node_ns.doc(
            '获取节点历史',
            description='获取指定节点的历史状态记录。返回数据按时间升序排列（最旧在前，最新在后），适合图表从左到右显示。数据粒度由轮询间隔决定。',
            params={'node_id': '节点 ID', 'hours': '可选，整数小时，默认12，范围1-720'}
        )
        def get(self, node_id):
            hours = clamp_hours_param(request)
            limit = get_history_limit(poller, hours)
            history_raw = poller.db.get_server_history(node_id, limit=limit)
            history = filter_history_by_time(history_raw, hours)
            # 按时间升序排列（最旧在前，最新在后）
            history = sort_history_by_timestamp(history)
            return history

    @node_ns.route('/<int:node_id>/history-compact')
    class NodeHistoryCompact(Resource):
        @node_ns.doc(
            '获取节点历史（精简版）',
            description='获取指定节点的历史状态记录，仅返回图表必需的字段（timestamps, online, latency, players），以减少传输体积。适合实时图表渲染。',
            params={'node_id': '节点 ID', 'hours': '可选，整数小时，默认12，范围1-720'}
        )
        def get(self, node_id):
            hours = clamp_hours_param(request)
            limit = get_history_limit(poller, hours)
            history_raw = poller.db.get_server_history(node_id, limit=limit)
            history = filter_history_by_time(history_raw, hours)
            # 按时间升序排列（最旧在前，最新在后）
            history = sort_history_by_timestamp(history)
            return format_compact_history(history)

    @node_ns.route('/<int:node_id>/stats')
    class NodeStats(Resource):
        @node_ns.doc(
            '获取节点统计',
            description='获取指定节点的统计信息：在线率、平均/标准差/P95 延迟、变异系数等。',
            params={'node_id': '节点 ID', 'hours': '可选，整数小时，默认12，范围1-720'}
        )
        def get(self, node_id):
            hours = clamp_hours_param(request)
            limit = get_history_limit(poller, hours)
            history_raw = poller.db.get_server_history(node_id, limit=limit)
            history = filter_history_by_time(history_raw, hours)
            return calculate_latency_stats(history)

    @node_ns.route('/<int:node_id>/uptime')
    class NodeUptime(Resource):
        @node_ns.doc(
            '获取节点在线率',
            description='计算指定节点的在线率百分比及检查统计。',
            params={'node_id': '节点 ID', 'hours': '可选，整数小时，默认24，范围1-720'}
        )
        def get(self, node_id):
            hours = clamp_hours_param(request, default=24)
            limit = get_history_limit(poller, hours)
            history_raw = poller.db.get_server_history(node_id, limit=limit)
            history = filter_history_by_time(history_raw, hours)
            stats = calculate_latency_stats(history)
            return {'uptime_percentage': stats['uptime_percentage'], 'total_checks': stats['total_checks'], 'online_checks': stats['online_checks']}

    @node_ns.route('/<int:node_id>/status-timeline')
    class NodeStatusTimeline(Resource):
        @node_ns.doc(
            '获取节点在线状态时间轴',
            description='获取指定节点的在线/离线状态时间轴。用于热力图展示 24 小时内的可用性。',
            params={'node_id': '节点 ID', 'hours': '可选，整数小时，默认24，范围1-720'}
        )
        def get(self, node_id):
            hours = clamp_hours_param(request, default=24)
            return get_node_status_timeline(poller, node_id, hours)

    @node_ns.route('/head')
    class NodeHeadList(Resource):
        @node_ns.doc(
            '获取所有节点实时状态',
            description='获取所有节点的最新状态数据（head），包括在线玩家数、延迟、版本等信息。注意：如果节点已禁用（enabled=false），latest_status 将返回 null。'
        )
        def get(self):
            return get_server_nodes_data(poller)

    api.add_namespace(node_ns)
    return node_ns
