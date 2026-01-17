from flask import Response
from flask_restx import Namespace, Resource, fields
from utils.data_processing import filter_history_by_time
from utils.app_utils import get_server_nodes_data


def register_exporter_routes(api, poller):
    """Register Prometheus exporter endpoints."""
    exporter_ns = Namespace('exporter', description='导出器接口', path='/exporter')

    # 定义健康检查响应模型
    health_model = exporter_ns.model('HealthCheck', {
        'status': fields.String(description='健康状态', example='ok'),
        'servers_count': fields.Integer(description='服务器节点数', example=3),
        'exporter_version': fields.String(description='导出器版本', example='1.0')
    })

    @exporter_ns.route('/metrics')
    class PrometheusMetrics(Resource):
        @exporter_ns.doc('获取Prometheus指标', description='导出Prometheus格式的监控数据')
        @exporter_ns.produces(['text/plain'])
        def get(self):
            """Export metrics in Prometheus format."""
            metrics = []
            metrics.append('# HELP motd_server_online 服务器是否在线 (1=在线, 0=离线)')
            metrics.append('# TYPE motd_server_online gauge')
            metrics.append('')

            metrics.append('# HELP motd_server_players_online 在线玩家数')
            metrics.append('# TYPE motd_server_players_online gauge')
            metrics.append('')

            metrics.append('# HELP motd_server_players_max 最大玩家数')
            metrics.append('# TYPE motd_server_players_max gauge')
            metrics.append('')

            metrics.append('# HELP motd_server_latency_ms 服务器延迟(毫秒)')
            metrics.append('# TYPE motd_server_latency_ms gauge')
            metrics.append('')

            metrics.append('# HELP motd_server_uptime_percentage 服务器在线时间占比(%)')
            metrics.append('# TYPE motd_server_uptime_percentage gauge')
            metrics.append('')

            metrics.append('# HELP motd_server_avg_latency_ms 平均延迟(毫秒)')
            metrics.append('# TYPE motd_server_avg_latency_ms gauge')
            metrics.append('')

            metrics.append('# HELP motd_server_max_latency_ms 最大延迟(毫秒)')
            metrics.append('# TYPE motd_server_max_latency_ms gauge')
            metrics.append('')

            metrics.append('# HELP motd_server_min_latency_ms 最小延迟(毫秒)')
            metrics.append('# TYPE motd_server_min_latency_ms gauge')
            metrics.append('')

            metrics.append('# HELP motd_server_latency_stddev_ms 延迟标准差(毫秒)')
            metrics.append('# TYPE motd_server_latency_stddev_ms gauge')
            metrics.append('')

            metrics.append('# HELP motd_server_latency_p95_ms P95延迟(毫秒)')
            metrics.append('# TYPE motd_server_latency_p95_ms gauge')
            metrics.append('')

            metrics.append('# HELP motd_server_latency_cv 延迟变异系数(%)')
            metrics.append('# TYPE motd_server_latency_cv gauge')
            metrics.append('')

            metrics.append('# HELP motd_player_online 玩家是否在线 (1=在线, 0=离线)')
            metrics.append('# TYPE motd_player_online gauge')
            metrics.append('')

            metrics.append('# HELP motd_player_session_duration_seconds 玩家当前会话时长(秒)')
            metrics.append('# TYPE motd_player_session_duration_seconds gauge')
            metrics.append('')

            metrics.append('# HELP motd_players_count 在线玩家总数')
            metrics.append('# TYPE motd_players_count gauge')
            metrics.append('')

            metrics.append('# HELP motd_server_count 服务器节点总数')
            metrics.append('# TYPE motd_server_count gauge')
            metrics.append('')

            metrics.append('# HELP motd_server_sample_players_count 玩家样本数')
            metrics.append('# TYPE motd_server_sample_players_count gauge')
            metrics.append('')

            # Get all nodes including enabled status
            all_nodes = get_server_nodes_data(poller)
            # Only export enabled nodes
            servers = [n for n in all_nodes if n.get('enabled', True)]
            online_servers_count = 0
            total_online_players = 0

            for server in servers:
                server_id = server['id']
                node_name = server['name']
                server_host = server['host']
                server_port = server['port']

                labels = f'server_id="{server_id}",node_name="{node_name}",host="{server_host}",port="{server_port}"'

                # Get latest status
                status = poller.db.get_server_latest_status(server_id)
                if status:
                    online = 1 if status.get('online') else 0
                    online_servers_count += online
                    players_online = status.get('players_online', 0) or 0
                    total_online_players += players_online
                    players_max = status.get('players_max', 0) or 0
                    latency = status.get('latency')

                    metrics.append(f'motd_server_online{{{labels}}} {online}')
                    metrics.append(f'motd_server_players_online{{{labels}}} {players_online}')
                    metrics.append(f'motd_server_players_max{{{labels}}} {players_max}')

                    if latency is not None:
                        metrics.append(f'motd_server_latency_ms{{{labels}}} {latency}')

                # Get uptime stats for past 24 hours
                history = poller.db.get_server_history(server_id, limit=poller.get_24h_limit())
                history = filter_history_by_time(history, 24)
                if history:
                    total_checks = len(history)
                    online_checks = sum(1 for h in history if h['online'])
                    uptime_pct = (online_checks / total_checks * 100) if total_checks > 0 else 0

                    latencies = [h['latency'] for h in history if h['online'] and h['latency'] is not None]
                    
                    if latencies:
                        import statistics
                        avg_latency = statistics.mean(latencies)
                        max_latency = max(latencies)
                        min_latency = min(latencies)
                        std_dev = statistics.stdev(latencies) if len(latencies) > 1 else 0
                        
                        # Calculate P95 latency
                        sorted_latencies = sorted(latencies)
                        p95_index = int(len(sorted_latencies) * 0.95)
                        p95_latency = sorted_latencies[p95_index] if p95_index < len(sorted_latencies) else sorted_latencies[-1]
                        
                        # Calculate coefficient of variation (CV)
                        cv = (std_dev / avg_latency * 100) if avg_latency > 0 else 0
                    else:
                        avg_latency = max_latency = min_latency = std_dev = p95_latency = cv = 0

                    metrics.append(f'motd_server_uptime_percentage{{{labels}}} {uptime_pct:.2f}')
                    if latencies:
                        metrics.append(f'motd_server_avg_latency_ms{{{labels}}} {avg_latency:.2f}')
                        metrics.append(f'motd_server_max_latency_ms{{{labels}}} {max_latency:.2f}')
                        metrics.append(f'motd_server_min_latency_ms{{{labels}}} {min_latency:.2f}')
                        metrics.append(f'motd_server_latency_stddev_ms{{{labels}}} {std_dev:.2f}')
                        metrics.append(f'motd_server_latency_p95_ms{{{labels}}} {p95_latency:.2f}')
                        metrics.append(f'motd_server_latency_cv{{{labels}}} {cv:.2f}')

                    # 玩家样本数
                    sample_players_count = 0
                    for h in history:
                        if h.get('sample_players'):
                            sample_players_count = max(sample_players_count, len(h['sample_players']))
                    if sample_players_count > 0:
                        metrics.append(f'motd_server_sample_players_count{{{labels}}} {sample_players_count}')

            # Global counters
            metrics.append(f'motd_server_count{{}} {len(servers)}')
            metrics.append(f'motd_players_count{{}} {total_online_players}')

            # Get player data
            all_online_players = set()
            player_durations = {}

            for server in servers:
                sessions = poller.db.get_online_players(server['id'])
                for session in sessions:
                    player_name = session.get('player_name')
                    if player_name and player_name not in all_online_players:
                        all_online_players.add(player_name)
                        # 对于同一玩家在多个node的情况，记录最大duration
                        duration_seconds = session.get('duration_seconds', 0) or 0
                        if player_name not in player_durations:
                            player_durations[player_name] = duration_seconds
                        else:
                            player_durations[player_name] = max(player_durations[player_name], duration_seconds)

            # Export player metrics (deduplicated)
            for player_name in all_online_players:
                player_labels = f'player_name="{player_name}"'
                metrics.append(f'motd_player_online{{{player_labels}}} 1')
                if player_name in player_durations and player_durations[player_name]:
                    metrics.append(f'motd_player_session_duration_seconds{{{player_labels}}} {player_durations[player_name]}')

            # Add info metric with version
            metrics.append('')
            metrics.append('# HELP motd_info MotdTracker info')
            metrics.append('# TYPE motd_info gauge')
            metrics.append('motd_info{version="1.0"} 1')
            metrics.append('')

            return Response('\n'.join(metrics), mimetype='text/plain; charset=utf-8')

    @exporter_ns.route('/health')
    class ExporterHealth(Resource):
        @exporter_ns.doc('健康检查', description='检查导出器和后端是否正常运行')
        @exporter_ns.response(200, '成功', health_model)
        def get(self):
            """Simple health check."""
            try:
                servers = poller.db.get_all_servers()
                status = 'ok' if servers else 'no_servers'
                return {
                    'status': status,
                    'servers_count': len(servers),
                    'exporter_version': '1.0'
                }
            except Exception as e:
                return {
                    'status': 'error',
                    'error': str(e)
                }, 500

    api.add_namespace(exporter_ns)
    return exporter_ns
