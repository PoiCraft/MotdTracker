from collections import defaultdict
from flask import request
from flask_restx import Namespace, Resource
from utils.app_utils import clamp_hours_param, get_server_nodes_data, parse_dt
from utils.data_stats import calculate_latency_stats
from utils.data_processing import (
    filter_history_by_time, select_representative_record
)
from utils.history_query import (
    get_history_limit, get_aggregated_history, get_uptime_data, get_status_timeline
)
from routes.api_models import get_server_models


def register_server_routes(api, poller):
    server_ns = Namespace('server', description='服务器聚合接口', path='/server')
    models = get_server_models(server_ns)

    @server_ns.route('/nodes')
    class ServerNodes(Resource):
        @server_ns.doc(
            '获取所有节点及 24h 统计',
            description='获取服务器的所有节点及其最新状态。每个节点包含过去 24 小时的延迟统计（平均值、标准差、P95、变异系数等）。'
        )
        @server_ns.response(200, '成功', [models['server_node_with_stats']])
        def get(self):
            nodes = get_server_nodes_data(poller)
            # Add latency statistics for each node
            for node in nodes:
                history = poller.db.get_server_history(node['id'], limit=poller.get_24h_limit())
                history = filter_history_by_time(history, 24)
                if history:
                    node['latency_stats'] = calculate_latency_stats(history)
                else:
                    node['latency_stats'] = {'uptime_percentage': 0, 'avg_latency': None, 'std_dev': None, 'min_latency': None, 'max_latency': None, 'p95_latency': None, 'cv': None}
            return nodes

    @server_ns.route('/head')
    class ServerHead(Resource):
        @server_ns.doc(
            '获取服务器实时状态',
            description='获取服务器的实时（head）聚合状态，包含：是否在线、在线玩家数、各节点延迟、版本、MOTD 等。'
        )
        @server_ns.response(200, '成功', models['server_head'])
        def get(self):
            nodes = get_server_nodes_data(poller)
            if not nodes:
                return {}

            # 只统计已启用的节点
            enabled_nodes = [n for n in nodes if n.get('enabled', True)]
            nodes_with_status = [n for n in enabled_nodes if n.get('latest_status')]
            if not nodes_with_status:
                return {'nodes': nodes}

            online_nodes = [n for n in nodes_with_status if n['latest_status'].get('online')]
            selected = online_nodes[0] if online_nodes else nodes_with_status[0]

            latencies = {
                n['name']: n['latest_status'].get('latency') if n['latest_status'].get('online') else None
                for n in nodes_with_status
            }

            selected_status = selected['latest_status']

            return {
                'timestamp': selected_status.get('timestamp'),
                'online': any(n['latest_status'].get('online') for n in nodes_with_status),
                'players_online': selected_status.get('players_online'),
                'players_max': selected_status.get('players_max'),
                'latencies': latencies,
                'version': selected_status.get('version'),
                'motd': selected_status.get('motd'),
                'nodes': nodes_with_status
            }

    @server_ns.route('/history')
    class ServerHistory(Resource):
        @server_ns.doc(
            '获取服务器聚合历史',
            description='获取服务器的聚合历史数据（所有节点合并）。返回完整的历史记录，包含每个时间点的所有节点数据。按时间升序排列，适合图表展示。',
            params={'hours': '可选，整数小时，默认12，范围1-720，示例：?hours=24'}
        )
        @server_ns.response(200, '成功', [models['server_history_record']])
        def get(self):
            hours = clamp_hours_param(request)
            limit = get_history_limit(poller, hours)

            # 获取所有节点，包括启用状态
            all_nodes = get_server_nodes_data(poller)
            # 只处理已启用的节点
            servers = [n for n in all_nodes if n.get('enabled', True)]
            if not servers:
                return []

            nodes_history = {}
            for server in servers:
                history_raw = poller.db.get_server_history(server['id'], limit=limit)
                history = filter_history_by_time(history_raw, hours)
                nodes_history[server['name']] = history

            all_histories = {}
            for node_name, history in nodes_history.items():
                for record in history:
                    timestamp = record['timestamp']
                    if timestamp not in all_histories:
                        all_histories[timestamp] = {
                            'timestamp': timestamp,
                            'nodes': {}
                        }
                    all_histories[timestamp]['nodes'][node_name] = record

            aggregated_history = []
            # 按时间升序排列（最旧在前，最新在后）
            for timestamp in sorted(all_histories.keys()):
                data = all_histories[timestamp]
                nodes_data = data['nodes']

                selected_record = select_representative_record(list(nodes_data.values()))
                latencies = {node_name: record.get('latency') if record['online'] else None for node_name, record in nodes_data.items()}

                aggregated_history.append({
                    'timestamp': timestamp,
                    'online': any(r['online'] for r in nodes_data.values()),
                    'players_online': selected_record.get('players_online') if selected_record else None,
                    'players_max': selected_record.get('players_max') if selected_record else None,
                    'latencies': latencies,
                    'version': selected_record.get('version') if selected_record else None,
                    'motd': selected_record.get('motd') if selected_record else None
                })

            return aggregated_history

    @server_ns.route('/history-compact')
    class ServerHistoryCompact(Resource):
        @server_ns.doc(
            '获取服务器历史（精简版）',
            description='获取服务器的聚合历史数据，仅包含图表必需的字段（timestamps, online, players, latencies）以减少传输体积。',
            params={'hours': '可选，整数小时，默认12，范围1-720'}
        )
        @server_ns.response(200, '成功', models['server_history_compact'])
        def get(self):
            hours = clamp_hours_param(request)
            return get_aggregated_history(poller, hours)

    @server_ns.route('/stats')
    class ServerStats(Resource):
        @server_ns.doc(
            '获取服务器统计',
            description='获取服务器的聚合统计数据：在线率、平均/标准差/P95 延迟、变异系数等。统计基于指定时间范围内所有节点的合并数据。',
            params={'hours': '可选，整数小时，默认12，范围1-720'}
        )
        @server_ns.response(200, '成功', models['server_stats'])
        def get(self):
            hours = clamp_hours_param(request)
            limit = get_history_limit(poller, hours)

            # 获取所有节点，包括启用状态
            all_nodes = get_server_nodes_data(poller)
            # 只处理已启用的节点
            servers = [n for n in all_nodes if n.get('enabled', True)]
            if not servers:
                return {
                    'uptime_percentage': 0,
                    'avg_latency': None,
                    'total_checks': 0,
                    'online_checks': 0
                }

            timestamp_status = defaultdict(list)
            all_latencies = []

            for server in servers:
                history_raw = poller.db.get_server_history(server['id'], limit=limit)
                history = filter_history_by_time(history_raw, hours)
                for h in history:
                    timestamp_status[h['timestamp']].append(h['online'])
                    if h['online'] and h['latency'] is not None:
                        all_latencies.append(h['latency'])

            total_checks = len(timestamp_status)
            online_checks = sum(1 for statuses in timestamp_status.values() if any(statuses))

            uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0
            avg_latency = sum(all_latencies) / len(all_latencies) if all_latencies else None

            return {
                'uptime_percentage': round(uptime_percentage, 2),
                'avg_latency': round(avg_latency, 2) if avg_latency else None,
                'total_checks': total_checks,
                'online_checks': online_checks
            }

    @server_ns.route('/uptime')
    class ServerUptime(Resource):
        @server_ns.doc(
            '获取服务器在线率',
            description='计算服务器的在线率百分比及检查统计。在线率由所有节点的聚合在线状态计算。',
            params={'hours': '可选，整数小时，默认24，范围1-720'}
        )
        @server_ns.response(200, '成功', models['uptime_info'])
        def get(self):
            hours = clamp_hours_param(request, default=24)
            return get_uptime_data(poller, hours)

    @server_ns.route('/status-timeline')
    class ServerStatusTimeline(Resource):
        @server_ns.doc(
            '获取服务器在线状态时间轴',
            description='获取服务器 24 小时的在线/离线状态时间轴。用于热力图展示可用性。',
            params={'hours': '可选，整数小时，默认24，范围1-720'}
        )
        @server_ns.response(200, '成功', [models['status_timeline_record']])
        def get(self):
            hours = clamp_hours_param(request, default=24)
            return get_status_timeline(poller, hours)

    @server_ns.route('/players')
    class ServerPlayers(Resource):
        @server_ns.doc(
            '获取在线玩家列表',
            description='获取所有节点的在线玩家列表（实时）。同名玩家仅显示最后一次看到的信息，按最后看到时间倒序排列。'
        )
        @server_ns.response(200, '成功', [models['player_online']])
        def get(self):
            servers = poller.db.get_all_servers()
            result = []

            for server in servers:
                sessions = poller.db.get_online_players(server['id'])
                for s in sessions:
                    start_dt = parse_dt(s.get('session_start'))
                    last_dt = parse_dt(s.get('last_seen'))
                    result.append({
                        'server_id': server['id'],
                        'server_name': server['name'],
                        'player_name': s.get('player_name'),
                        'online': True,
                        'session_start': start_dt.isoformat() if start_dt else None,
                        'last_seen': last_dt.isoformat() if last_dt else None,
                        'last_seen_dt': last_dt,
                        'duration_seconds': s.get('duration_seconds'),
                    })

            result.sort(key=lambda x: -(x['last_seen_dt'].timestamp() if x['last_seen_dt'] else float('-inf')))

            filtered = []
            seen = set()
            for item in result:
                name = item.get('player_name')
                if name in seen:
                    continue
                seen.add(name)
                item.pop('last_seen_dt', None)
                filtered.append(item)

            return filtered

    @server_ns.route('/config')
    class ServerConfig(Resource):
        @server_ns.doc(
            '获取服务器配置',
            description='获取服务器运行配置：轮询间隔、服务器名称等。'
        )
        @server_ns.response(200, '成功', models['server_config'])
        def get(self):
            return {
                'poll_interval': poller.config.get('poll_interval', 60),
                'server_name': poller.config.get('server_name', 'Minecraft Server')
            }

    api.add_namespace(server_ns)
    return server_ns
