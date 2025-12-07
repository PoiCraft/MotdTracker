from flask import Flask, render_template, request, redirect, url_for
from flask_socketio import SocketIO
from flask_restx import Api, Namespace, Resource, abort
from poller import ServerPoller
import atexit
import signal
import sys
from datetime import datetime, timedelta


# 创建Flask应用
app = Flask(__name__)
app.config['SECRET_KEY'] = 'minecraft-tracker-secret-key'

# 初始化SocketIO，调整路径到 /api/socket.io，便于与 API 前缀保持一致
socketio = SocketIO(app, cors_allowed_origins="*", path="/api/socket.io")

# 初始化 Swagger API（基础路径 /api）
api = Api(
    app,
    title='MotdTracker API',
    version='1.0',
    description='Minecraft 服务器监控 API 文档',
    doc='/api/docs',
    prefix='/api'
)

# 初始化轮询器
poller = ServerPoller('config.json', socketio=socketio)


def get_server_nodes_data():
    """构建服务器的节点及其最新状态列表"""
    servers = poller.db.get_all_servers()
    nodes = []
    for server in servers:
        latest_status = poller.db.get_server_latest_status(server['id'])
        nodes.append({
            **server,
            'latest_status': latest_status
        })
    return nodes


@app.route('/')
def index():
    """主页跳转到服务器视图"""
    return redirect(url_for('server_page'))


@app.route('/server')
def server_page():
    """服务器视图页面"""
    return render_template('server.html', server_name=poller.config.get('server_name', 'Minecraft Server'), active_page='server')


@app.route('/nodes')
def nodes_page():
    """节点视图页面"""
    servers = poller.db.get_all_servers()
    enriched = [{**s, 'latest_status': poller.db.get_server_latest_status(s['id'])} for s in servers]
    return render_template('nodes.html', servers=enriched, active_page='nodes')


@app.route('/players')
def players_page():
    """玩家列表页面"""
    return render_template('players.html', active_page='players')


@app.route('/player/<player_name>')
def player_page(player_name):
    """单玩家详情页面"""
    return render_template('player_detail.html', active_page='players')


# 分组命名空间
node_ns = api.namespace('node', description='节点相关接口', path='/node')
server_ns = api.namespace('server', description='服务器聚合接口', path='/server')
player_ns = api.namespace('player', description='玩家相关接口', path='/player')


def _parse_dt(value):
    """将数据库中的时间字段转换为 datetime 对象，兼容字符串"""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


@node_ns.route('')
class Nodes(Resource):
    @node_ns.doc('获取所有节点列表', description='获取服务器的所有节点及其最新状态')
    def get(self):
        servers = poller.get_all_servers_status()
        return servers


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
            start_dt = _parse_dt(p.get('session_start'))
            last_dt = _parse_dt(p.get('last_seen'))
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
        history = poller.db.get_server_history(node_id, limit=1440)
        return history


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
        return get_server_nodes_data()


@server_ns.route('/nodes')
class ServerNodes(Resource):
    @server_ns.doc('获取服务器节点列表', description='获取服务器的所有节点及其最新状态')
    def get(self):
        nodes = get_server_nodes_data()
        return nodes


@server_ns.route('/head')
class ServerHead(Resource):
    @server_ns.doc('获取服务器实时聚合状态', description='获取服务器的实时（head）聚合状态，包含各节点最新数据')
    def get(self):
        nodes = get_server_nodes_data()
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
        hours = 12
        try:
            hours = int(request.args.get('hours', hours))
        except Exception:
            pass
        hours = max(1, min(hours, 720))
        limit = hours * 60

        servers = poller.db.get_all_servers()
        if not servers:
            return []

        nodes_history = {}
        for server in servers:
            history = poller.db.get_server_history(server['id'], limit=limit)
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


@server_ns.route('/stats')
class ServerStats(Resource):
    @server_ns.doc(
        '获取服务器统计',
        description='获取服务器的聚合统计数据（所有节点的总在线玩家数、服务器总状态等）',
        params={'hours': '可选，整数小时，默认12，范围1-720，示例：?hours=24'}
    )
    def get(self):
        hours = 12
        try:
            hours = int(request.args.get('hours', hours))
        except Exception:
            pass
        hours = max(1, min(hours, 720))
        limit = hours * 60

        servers = poller.db.get_all_servers()
        if not servers:
            return {
                'uptime_percentage': 0,
                'avg_latency': None,
                'total_checks': 0,
                'online_checks': 0
            }

        from collections import defaultdict
        timestamp_status = defaultdict(list)
        all_latencies = []

        for server in servers:
            history = poller.db.get_server_history(server['id'], limit=limit)
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


@server_ns.route('/players')
class ServerPlayers(Resource):
    @server_ns.doc('获取服务器在线玩家', description='获取所有节点的在线玩家列表（实时）')
    def get(self):
        servers = poller.db.get_all_servers()
        result = []

        for server in servers:
            sessions = poller.db.get_online_players(server['id'])
            for s in sessions:
                start_dt = _parse_dt(s.get('session_start'))
                last_dt = _parse_dt(s.get('last_seen'))
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


@player_ns.route('')
class AllPlayers(Resource):
    @player_ns.doc('获取全球玩家列表', description='获取所有在线玩家的汇总列表，包含所有节点的玩家数据')
    def get(self):
        servers = poller.db.get_all_servers()
        aggregated = {}

        for server in servers:
            sessions = poller.db.get_all_player_sessions(server['id'])
            for s in sessions:
                name = s.get('player_name')
                if not name:
                    continue
                start_dt = _parse_dt(s.get('session_start'))
                last_dt = _parse_dt(s.get('last_seen'))
                duration_seconds = s.get('duration_seconds') if s.get('online') else None

                server_entry = {
                    'server_id': server['id'],
                    'server_name': server['name'],
                    'online': s.get('online'),
                    'session_start': start_dt.isoformat() if start_dt else None,
                    'last_seen': last_dt.isoformat() if last_dt else None,
                    'last_seen_dt': last_dt,
                    'duration_seconds': duration_seconds,
                }

                if name not in aggregated:
                    aggregated[name] = {
                        'player_name': name,
                        'online': bool(s.get('online')),
                        'session_start': start_dt.isoformat() if s.get('online') and start_dt else None,
                        'last_seen': last_dt.isoformat() if last_dt else None,
                        'last_seen_dt': last_dt,
                        'duration_seconds': duration_seconds if s.get('online') else None,
                        'servers': [server_entry]
                    }
                else:
                    agg = aggregated[name]
                    agg['servers'].append(server_entry)
                    agg['online'] = agg['online'] or bool(s.get('online'))

                    # 最新最近一次看到的时间
                    if last_dt and (agg['last_seen_dt'] is None or last_dt > agg['last_seen_dt']):
                        agg['last_seen_dt'] = last_dt
                        agg['last_seen'] = last_dt.isoformat()

                    # 对在线会话：取最早的 session_start 和最大的 duration_seconds，避免不同节点间不一致
                    if s.get('online'):
                        if start_dt:
                            if agg['session_start'] is None:
                                agg['session_start'] = start_dt.isoformat()
                            else:
                                try:
                                    agg_start = datetime.fromisoformat(agg['session_start'])
                                    if start_dt < agg_start:
                                        agg['session_start'] = start_dt.isoformat()
                                except Exception:
                                    agg['session_start'] = start_dt.isoformat()

                        if duration_seconds is not None:
                            if agg['duration_seconds'] is None or duration_seconds > agg['duration_seconds']:
                                agg['duration_seconds'] = duration_seconds

        players = list(aggregated.values())
        players.sort(key=lambda x: (
            not x['online'],
            -(x['last_seen_dt'].timestamp() if x['last_seen_dt'] else float('-inf'))
        ))

        for p in players:
            p.pop('last_seen_dt', None)
            for s in p['servers']:
                s.pop('last_seen_dt', None)

        return players


@player_ns.route('/<string:player_name>/detail')
class PlayerDetail(Resource):
    @player_ns.doc('获取玩家详情', description='获取指定玩家的详细信息，包括当前在线状态、连接节点等')
    def get(self, player_name):
        servers = poller.db.get_all_servers()

        player_online = False
        earliest_session_start = None
        latest_last_seen = None
        max_duration = None

        for server in servers:
            all_sessions = poller.db.get_all_player_sessions(server['id'])
            online_sessions = [s for s in all_sessions if s.get('online') and s.get('player_name') == player_name]
            player_sessions = [s for s in all_sessions if s.get('player_name') == player_name]

            if not player_sessions:
                continue

            if online_sessions:
                player_online = True
                for s in online_sessions:
                    start_dt = _parse_dt(s.get('session_start'))
                    if start_dt:
                        if earliest_session_start is None or start_dt < earliest_session_start:
                            earliest_session_start = start_dt
                        if s.get('duration_seconds') is not None:
                            if max_duration is None or s.get('duration_seconds') > max_duration:
                                max_duration = s.get('duration_seconds')

            for s in player_sessions:
                last_dt = _parse_dt(s.get('last_seen'))
                if last_dt and (latest_last_seen is None or last_dt > latest_last_seen):
                    latest_last_seen = last_dt

        summary = {
            'player_name': player_name,
            'online': player_online,
            'session_start': earliest_session_start.isoformat() if earliest_session_start else None,
            'last_seen': latest_last_seen.isoformat() if latest_last_seen else None,
            'duration_seconds': max_duration
        }

        return summary


@player_ns.route('/<string:player_name>/calendar')
class PlayerCalendar(Resource):
    @player_ns.doc(
        '获取玩家日历',
        description='获取玩家在线日历数据，显示玩家在过去N天内的在线情况（默认30天）',
        params={'days': '可选，整数，覆盖默认天数，示例：?days=7'}
    )
    def get(self, player_name):
        days = int(poller.config.get('player_calendar_days', 30))
        try:
            days = int(request.args.get('days', days))
        except Exception:
            pass

        history = poller.db.get_player_history(player_name, days)

        now = datetime.now()

        server_to_group = {}
        for server in poller.db.get_all_servers():
            server_config = next((s for s in poller.config.get('servers', [])
                                 if s['host'] == server['host'] and s['port'] == server['port']), None)
            server_name = server_config.get('group', '默认') if server_config else '默认'
            server_to_group[server['id']] = server_name

        for server in poller.db.get_all_servers():
            sessions = poller.db.get_all_player_sessions(server['id'])
            for s in sessions:
                if s.get('player_name') != player_name:
                    continue
                if s.get('online'):
                    start = s.get('session_start')
                    history.append({
                        'session_start': start,
                        'session_end': now.isoformat(),
                        'server_id': server['id']
                    })

        def merge_intervals(intervals):
            if not intervals:
                return []
            intervals.sort(key=lambda x: x[0])
            merged = [intervals[0]]
            for current_start, current_end, server_id in intervals[1:]:
                last_start, last_end, last_server = merged[-1]
                if current_start <= last_end:
                    merged[-1] = (last_start, max(last_end, current_end), last_server)
                else:
                    merged.append((current_start, current_end, server_id))
            return merged

        intervals = []
        for item in history:
            start = datetime.fromisoformat(item['session_start']) if isinstance(item['session_start'], str) else item['session_start']
            end = datetime.fromisoformat(item['session_end']) if isinstance(item['session_end'], str) else item['session_end']
            if not start or not end or end <= start:
                continue
            intervals.append((start, end, item['server_id']))

        merged_sessions = merge_intervals(intervals)

        daily = {}
        hour_totals = {h: 0 for h in range(24)}
        total_duration = 0
        session_count = len(merged_sessions)

        def split_by_hour(s: datetime, e: datetime):
            current = s
            while current < e:
                next_hour = (current.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1))
                segment_end = min(next_hour, e)
                yield current, segment_end
                current = segment_end

        def split_by_day(s: datetime, e: datetime):
            current = s
            while current < e:
                next_day = datetime.combine(current.date() + timedelta(days=1), datetime.min.time())
                segment_end = min(next_day, e)
                yield current, segment_end
                current = segment_end

        for start, end, server_id in merged_sessions:
            dur = (end - start).total_seconds()
            total_duration += dur

            for ds, de in split_by_day(start, end):
                day_key = ds.date()
                if day_key not in daily:
                    daily[day_key] = {'total_seconds': 0, 'sessions': [], 'heat': {}}
                server_name = server_to_group.get(server_id, '默认')
                daily[day_key]['sessions'].append({
                    'start': ds.isoformat(),
                    'end': de.isoformat(),
                    'server_name': server_name
                })

            for hs, he in split_by_hour(start, end):
                day_key = hs.date()
                if day_key not in daily:
                    daily[day_key] = {'total_seconds': 0, 'sessions': [], 'heat': {}}
                segment_dur = (he - hs).total_seconds()
                hour_totals[hs.hour] += segment_dur
                daily[day_key]['heat'][hs.hour] = daily[day_key]['heat'].get(hs.hour, 0) + segment_dur
                daily[day_key]['total_seconds'] += segment_dur

        dates_sorted = sorted(daily.keys())
        days_count = len(dates_sorted) if dates_sorted else 1

        heatmap = []
        for day in dates_sorted:
            heat = daily[day].get('heat', {})
            for hour in range(24):
                heatmap.append({
                    'date': day.isoformat(),
                    'hour': hour,
                    'seconds': heat.get(hour, 0)
                })

        hourly_avg = []
        for hour in range(24):
            hourly_avg.append({
                'hour': hour,
                'avg_seconds': hour_totals[hour] / days_count
            })

        avg_daily_seconds = total_duration / days_count if days_count else 0
        avg_session_seconds = total_duration / session_count if session_count else 0

        response = {
            'days': days,
            'heatmap': heatmap,
            'daily': [
                {
                    'date': day.isoformat(),
                    'total_seconds': daily[day].get('total_seconds', 0),
                    'sessions': daily[day].get('sessions', [])
                }
                for day in dates_sorted
            ],
            'average_daily_seconds': avg_daily_seconds,
            'average_session_seconds': avg_session_seconds,
            'hourly_average': hourly_avg
        }

        return response


def main():
    """主函数"""
    # 优雅处理退出信号
    def graceful_shutdown(signum=None, frame=None):
        print("收到退出信号，正在停止服务...")
        try:
            poller.stop()
        finally:
            sys.exit(0)

    for sig_name in ("SIGINT", "SIGTERM"):
        sig = getattr(signal, sig_name, None)
        if sig is not None:
            try:
                signal.signal(sig, graceful_shutdown)
            except Exception:
                # 在不支持的环境上跳过
                pass

    # 启动定时轮询
    poller.start()
    
    # 注册退出时的清理函数
    atexit.register(poller.stop)
    
    # 启动Flask应用（使用 SocketIO）
    print("Minecraft服务器监控已启动")
    print("访问 http://127.0.0.1:5011 查看监控面板")
    print("按 Ctrl+C 停止服务")
    
    port = poller.config.get('port', 5011)
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)


if __name__ == '__main__':
    main()

