from flask_restx import Namespace, Resource, abort
from app_utils import get_server_nodes_data, parse_dt


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
        @node_ns.doc('获取节点历史', description='获取指定节点的历史状态记录（过去24小时）')
        def get(self, node_id):
            return poller.db.get_server_history(node_id, limit=1440)

    @node_ns.route('/<int:node_id>/stats')
    class NodeStats(Resource):
        @node_ns.doc('获取节点统计', description='获取指定节点的统计信息（在线率、平均延迟等）')
        def get(self, node_id):
            history = poller.db.get_server_history(node_id, limit=1440)
            if not history:
                return {
                    'uptime_percentage': 0,
                    'avg_latency': None,
                    'total_checks': 0,
                    'online_checks': 0
                }

            total_checks = len(history)
            online_checks = sum(1 for h in history if h['online'])
            uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0

            latencies = [h['latency'] for h in history if h['online'] and h['latency'] is not None]
            avg_latency = sum(latencies) / len(latencies) if latencies else None

            return {
                'uptime_percentage': round(uptime_percentage, 2),
                'avg_latency': round(avg_latency, 2) if avg_latency else None,
                'total_checks': total_checks,
                'online_checks': online_checks
            }

    @node_ns.route('/head')
    class NodeHeadList(Resource):
        @node_ns.doc('获取节点实时状态列表', description='获取所有节点的最新状态数据（head）')
        def get(self):
            return get_server_nodes_data(poller)

    api.add_namespace(node_ns)
    return node_ns
