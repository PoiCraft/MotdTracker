from flask import request
from flask_restx import Namespace, Resource, abort
from app_utils import clamp_hours_param, get_server_nodes_data, parse_dt
from routes.route_utils import filter_history_by_time


def register_node_routes(api, poller):
    node_ns = Namespace('node', description='节点相关接口', path='/node')

    @node_ns.route('')
    class Nodes(Resource):
        @node_ns.doc('获取所有节点列表', description='获取服务器的所有节点及其最新状态')
        def get(self):
            return poller.get_all_servers_status()

    @node_ns.route('/<int:node_id>')
    class Node(Resource):
        @node_ns.doc('获取单个节点详情', description='获取指定节点的详细信息')
        def get(self, node_id):
            status = poller.db.get_server_latest_status(node_id)
            if status is None:
                abort(404, '节点不存在')
            return status

    @node_ns.route('/<int:node_id>/head')
    class NodeHead(Resource):
        @node_ns.doc('获取节点实时状态', description='获取指定节点的最新状态（head），包含节点元数据')
        def get(self, node_id):
            server = next((s for s in poller.db.get_all_servers() if s['id'] == node_id), None)
            if server is None:
                abort(404, '节点不存在')

            status = poller.db.get_server_latest_status(node_id)
            if status is None:
                return {**server, 'latest_status': None}

            return {**server, 'latest_status': status}

    @node_ns.route('/<int:node_id>/online_players')
    class NodeOnlinePlayers(Resource):
        @node_ns.doc('获取节点在线玩家', description='获取指定节点当前在线的玩家列表')
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
            description='获取指定节点的历史状态记录。返回数据按时间升序排列（最旧在前，最新在后），适合图表从左到右显示。',
            params={'hours': '可选，整数小时，默认12，范围1-720，示例：?hours=24'}
        )
        def get(self, node_id):
            hours = clamp_hours_param(request)
            poll_interval = poller.config.get('poll_interval', 60)
            limit = max(1, int(hours * 3600 / poll_interval))
            history_raw = poller.db.get_server_history(node_id, limit=limit)
            history = filter_history_by_time(history_raw, hours)
            # 按时间升序排列（最旧在前，最新在后）
            history = sorted(history, key=lambda x: x.get('timestamp', ''))
            return history

    @node_ns.route('/<int:node_id>/history-compact')
    class NodeHistoryCompact(Resource):
        @node_ns.doc(
            '获取节点历史（精简版）',
            description='获取指定节点的历史状态记录（仅返回图表必需字段以减少传输体积）。返回数据按时间升序排列（最旧在前，最新在后），适合图表从左到右显示。',
            params={'hours': '可选，整数小时，默认12，范围1-720，示例：?hours=24'}
        )
        def get(self, node_id):
            hours = clamp_hours_param(request)
            poll_interval = poller.config.get('poll_interval', 60)
            limit = max(1, int(hours * 3600 / poll_interval))
            history_raw = poller.db.get_server_history(node_id, limit=limit)
            history = filter_history_by_time(history_raw, hours)
            # 按时间升序排列（最旧在前，最新在后）
            history = sorted(history, key=lambda x: x.get('timestamp', ''))
            return {
                'timestamps': [h['timestamp'] for h in history],
                'online': [h['online'] for h in history],
                'latency': [h.get('latency') for h in history],
                'players_online': [h.get('players_online') for h in history],
                'players_max': [h.get('players_max') for h in history]
            }

    @node_ns.route('/<int:node_id>/stats')
    class NodeStats(Resource):
        @node_ns.doc(
            '获取节点统计',
            description='获取指定节点的统计信息（在线率、平均延迟等）',
            params={'hours': '可选，整数小时，默认12，范围1-720，示例：?hours=24'}
        )
        def get(self, node_id):
            hours = clamp_hours_param(request)
            poll_interval = poller.config.get('poll_interval', 60)
            limit = max(1, int(hours * 3600 / poll_interval))
            history_raw = poller.db.get_server_history(node_id, limit=limit)
            history = filter_history_by_time(history_raw, hours)

            if not history:
                return {
                    'uptime_percentage': 0,
                    'avg_latency': None,
                    'std_dev': None,
                    'min_latency': None,
                    'max_latency': None,
                    'p95_latency': None,
                    'cv': None,
                    'total_checks': 0,
                    'online_checks': 0
                }

            total_checks = len(history)
            online_checks = sum(1 for h in history if h['online'])
            uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0

            latencies = [h['latency'] for h in history if h['online'] and h['latency'] is not None]
            if latencies:
                import statistics
                avg_latency = statistics.mean(latencies)
                std_dev = statistics.stdev(latencies) if len(latencies) > 1 else 0
                min_latency = min(latencies)
                max_latency = max(latencies)
                # Calculate P95 latency
                sorted_latencies = sorted(latencies)
                p95_index = int(len(sorted_latencies) * 0.95)
                p95_latency = sorted_latencies[p95_index] if p95_index < len(sorted_latencies) else sorted_latencies[-1]
                # Calculate coefficient of variation (CV)
                cv = (std_dev / avg_latency * 100) if avg_latency > 0 else 0
            else:
                avg_latency = None
                std_dev = None
                min_latency = None
                max_latency = None
                p95_latency = None
                cv = None

            return {
                'uptime_percentage': round(uptime_percentage, 2),
                'avg_latency': round(avg_latency, 2) if avg_latency else None,
                'std_dev': round(std_dev, 2) if std_dev is not None else None,
                'min_latency': round(min_latency, 2) if min_latency else None,
                'max_latency': round(max_latency, 2) if max_latency else None,
                'p95_latency': round(p95_latency, 2) if p95_latency else None,
                'cv': round(cv, 2) if cv is not None else None,
                'total_checks': total_checks,
                'online_checks': online_checks
            }

    @node_ns.route('/<int:node_id>/uptime')
    class NodeUptime(Resource):
        @node_ns.doc(
            '获取节点24小时在线率',
            description='计算指定节点过去24小时的在线率（仅返回百分比）',
            params={'hours': '可选，整数小时，默认24，范围1-720'}
        )
        def get(self, node_id):
            hours = clamp_hours_param(request, default=24)
            poll_interval = poller.config.get('poll_interval', 60)
            limit = max(1, int(hours * 3600 / poll_interval))
            history_raw = poller.db.get_server_history(node_id, limit=limit)
            history = filter_history_by_time(history_raw, hours)

            if not history:
                return {'uptime_percentage': 0, 'total_checks': 0, 'online_checks': 0}

            total_checks = len(history)
            online_checks = sum(1 for h in history if h['online'])
            uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0

            return {
                'uptime_percentage': round(uptime_percentage, 2),
                'total_checks': total_checks,
                'online_checks': online_checks
            }

    @node_ns.route('/<int:node_id>/status-timeline')
    class NodeStatusTimeline(Resource):
        @node_ns.doc(
            '获取节点24小时在线状态时间轴',
            description='返回用于在线状态图表的数据（仅timestamps和online状态）',
            params={'hours': '可选，整数小时，默认24，范围1-720'}
        )
        def get(self, node_id):
            hours = clamp_hours_param(request, default=24)
            poll_interval = poller.config.get('poll_interval', 60)
            limit = max(1, int(hours * 3600 / poll_interval))
            history_raw = poller.db.get_server_history(node_id, limit=limit)
            history = filter_history_by_time(history_raw, hours)
            
            timestamps = []
            online_list = []
            for record in history:
                timestamps.append(record['timestamp'])
                online_list.append(record['online'])

            return {
                'timestamps': timestamps,
                'online': online_list
            }

    @node_ns.route('/head')
    class NodeHeadList(Resource):
        @node_ns.doc('获取节点实时状态列表', description='获取所有节点的最新状态数据（head）')
        def get(self):
            return get_server_nodes_data(poller)

    api.add_namespace(node_ns)
    return node_ns
