from collections import defaultdict
from flask import request
from flask_restx import Namespace, Resource
from app_utils import clamp_hours_param, get_server_nodes_data, parse_dt
from routes.route_utils import filter_history_by_time, calculate_node_stats


def register_server_routes(api, poller):
    server_ns = Namespace('server', description='服务器聚合接口', path='/server')

    @server_ns.route('/nodes')
    class ServerNodes(Resource):
        @server_ns.doc('获取服务器节点列表', description='获取服务器的所有节点及其最新状态')
        def get(self):
            nodes = get_server_nodes_data(poller)
            # Add latency statistics for each node
            for node in nodes:
                history = poller.db.get_server_history(node['id'], limit=poller.get_24h_limit())
                history = filter_history_by_time(history, 24)
                if history:
                    node['latency_stats'] = calculate_node_stats(history)
                else:
                    node['latency_stats'] = {'uptime_percentage': 0, 'avg_latency': None, 'std_dev': None, 'min_latency': None, 'max_latency': None, 'p95_latency': None, 'cv': None}
            return nodes

    @server_ns.route('/head')
    class ServerHead(Resource):
        @server_ns.doc('获取服务器实时聚合状态', description='获取服务器的实时（head）聚合状态，包含各节点最新数据')
        def get(self):
            nodes = get_server_nodes_data(poller)
            if not nodes:
                return {}

            nodes_with_status = [n for n in nodes if n.get('latest_status')]
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
            '获取服务器历史',
            description='获取服务器的聚合历史数据（所有节点的聚合）',
            params={'hours': '可选，整数小时，默认12，范围1-720，示例：?hours=24'}
        )
        def get(self):
            hours = clamp_hours_param(request)
            poll_interval = poller.config.get('poll_interval', 60)
            limit = max(1, int(hours * 3600 / poll_interval))

            servers = poller.db.get_all_servers()
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
            for timestamp in sorted(all_histories.keys(), reverse=True):
                data = all_histories[timestamp]
                nodes_data = data['nodes']

                online_records = [r for r in nodes_data.values() if r['online']]
                selected_record = online_records[0] if online_records else list(nodes_data.values())[0]

                latencies = {node_name: record.get('latency') if record['online'] else None for node_name, record in nodes_data.items()}

                aggregated_history.append({
                    'timestamp': timestamp,
                    'online': len(online_records) > 0,
                    'players_online': selected_record.get('players_online'),
                    'players_max': selected_record.get('players_max'),
                    'latencies': latencies,
                    'version': selected_record.get('version'),
                    'motd': selected_record.get('motd')
                })

            return aggregated_history

    @server_ns.route('/history-compact')
    class ServerHistoryCompact(Resource):
        @server_ns.doc(
            '获取服务器历史（精简版）',
            description='获取服务器的聚合历史数据（仅返回图表必需字段以减少传输体积）',
            params={'hours': '可选，整数小时，默认12，范围1-720，示例：?hours=24'}
        )
        def get(self):
            hours = clamp_hours_param(request)
            poll_interval = poller.config.get('poll_interval', 60)
            limit = max(1, int(hours * 3600 / poll_interval))

            servers = poller.db.get_all_servers()
            if not servers:
                return {
                    'timestamps': [],
                    'online': [],
                    'players_online': [],
                    'players_max': [],
                    'latencies': []
                }

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

            timestamps = []
            online_list = []
            players_online_list = []
            players_max_list = []
            latencies_list = {}

            for timestamp in sorted(all_histories.keys(), reverse=True):
                data = all_histories[timestamp]
                nodes_data = data['nodes']

                latencies = {node_name: record.get('latency') if record['online'] else None for node_name, record in nodes_data.items()}

                # Pick a representative record (prefer online)
                selected_record = next((r for r in nodes_data.values() if r.get('online')), None)
                if not selected_record:
                    selected_record = next(iter(nodes_data.values())) if nodes_data else None

                timestamps.append(timestamp)
                online_list.append(any(r['online'] for r in nodes_data.values()))
                players_online_list.append(selected_record.get('players_online') if selected_record else None)
                players_max_list.append(selected_record.get('players_max') if selected_record else None)
                
                for node_name, latency in latencies.items():
                    if node_name not in latencies_list:
                        latencies_list[node_name] = []
                    latencies_list[node_name].append(latency)

            return {
                'timestamps': timestamps,
                'online': online_list,
                'players_online': players_online_list,
                'players_max': players_max_list,
                'latencies': latencies_list
            }

    @server_ns.route('/stats')
    class ServerStats(Resource):
        @server_ns.doc(
            '获取服务器统计',
            description='获取服务器的聚合统计数据（所有节点的总在线玩家数、服务器总状态等）',
            params={'hours': '可选，整数小时，默认12，范围1-720，示例：?hours=24'}
        )
        def get(self):
            hours = clamp_hours_param(request)
            poll_interval = poller.config.get('poll_interval', 60)
            limit = max(1, int(hours * 3600 / poll_interval))

            servers = poller.db.get_all_servers()
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
            '获取服务器24小时在线率',
            description='计算过去24小时的在线率（仅返回百分比）',
            params={'hours': '可选，整数小时，默认24，范围1-720'}
        )
        def get(self):
            hours = clamp_hours_param(request, default=24)
            poll_interval = poller.config.get('poll_interval', 60)
            limit = max(1, int(hours * 3600 / poll_interval))

            servers = poller.db.get_all_servers()
            if not servers:
                return {'uptime_percentage': 0, 'total_checks': 0, 'online_checks': 0}

            timestamp_status = defaultdict(list)
            for server in servers:
                history_raw = poller.db.get_server_history(server['id'], limit=limit)
                history = filter_history_by_time(history_raw, hours)
                for h in history:
                    timestamp_status[h['timestamp']].append(h['online'])

            total_checks = len(timestamp_status)
            online_checks = sum(1 for statuses in timestamp_status.values() if any(statuses))
            uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0

            return {
                'uptime_percentage': round(uptime_percentage, 2),
                'total_checks': total_checks,
                'online_checks': online_checks
            }

    @server_ns.route('/status-timeline')
    class ServerStatusTimeline(Resource):
        @server_ns.doc(
            '获取服务器24小时在线状态时间轴',
            description='返回用于在线状态图表的数据（仅timestamps和online状态）',
            params={'hours': '可选，整数小时，默认24，范围1-720'}
        )
        def get(self):
            hours = clamp_hours_param(request, default=24)
            poll_interval = poller.config.get('poll_interval', 60)
            limit = max(1, int(hours * 3600 / poll_interval))

            servers = poller.db.get_all_servers()
            if not servers:
                return {'timestamps': [], 'online': []}

            all_histories = {}
            for server in servers:
                history_raw = poller.db.get_server_history(server['id'], limit=limit)
                history = filter_history_by_time(history_raw, hours)
                for record in history:
                    timestamp = record['timestamp']
                    if timestamp not in all_histories:
                        all_histories[timestamp] = {'timestamp': timestamp, 'nodes': {}}
                    all_histories[timestamp]['nodes'][server['name']] = record

            timestamps = []
            online_list = []
            for timestamp in sorted(all_histories.keys(), reverse=True):
                nodes_data = all_histories[timestamp]['nodes']
                timestamps.append(timestamp)
                online_list.append(any(r['online'] for r in nodes_data.values()))

            return {
                'timestamps': timestamps,
                'online': online_list
            }

    @server_ns.route('/players')
    class ServerPlayers(Resource):
        @server_ns.doc('获取服务器在线玩家', description='获取所有节点的在线玩家列表（实时）')
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
        @server_ns.doc('获取服务器配置', description='获取轮询间隔等配置信息')
        def get(self):
            return {
                'poll_interval': poller.config.get('poll_interval', 60),
                'server_name': poller.config.get('server_name', 'Minecraft Server')
            }

    api.add_namespace(server_ns)
    return server_ns
