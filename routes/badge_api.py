from flask import Response
from flask_restx import Namespace, Resource
from utils.app_utils import parse_dt, utc8_now
from utils.data_processing import filter_history_by_time
from datetime import timedelta
import anybadge


def generate_badge(label, value, color='grey'):
    """生成SVG badge - 直接使用anybadge"""
    badge = anybadge.Badge(
        label=label,
        value=value,
        default_color=color,
        num_padding_chars=1
    )
    return badge.badge_svg_text


def register_badge_routes(api, poller):
    badge_ns = Namespace('badge', description='Badge生成接口', path='/badge')

    @badge_ns.route('/server/status')
    class ServerStatusBadge(Resource):
        @badge_ns.doc('服务器状态Badge', description='返回服务器在线状态的SVG badge')
        @badge_ns.produces(['image/svg+xml'])
        def get(self):
            """服务器状态badge"""
            try:
                servers = poller.db.get_all_servers()
                if not servers:
                    result = generate_badge('server', 'unknown', 'grey')
                    return Response(result, mimetype='image/svg+xml')
                
                # 检查是否有任何节点在线
                online = False
                for server in servers:
                    status = poller.db.get_server_latest_status(server['id'])
                    if status and status.get('online'):
                        online = True
                        break
                
                message = 'online' if online else 'offline'
                color = 'green' if online else 'red'
                result = generate_badge('server', message, color)
                return Response(result, mimetype='image/svg+xml')
            except Exception as e:
                print(f"Error in ServerStatusBadge: {e}")
                import traceback
                traceback.print_exc()
                svg = generate_badge('server', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/server/uptime')
    class ServerUptimeBadge(Resource):
        @badge_ns.doc('服务器在线率Badge', description='返回服务器指定时间范围内在线率的SVG badge', params={'hours': '时间范围(小时),默认24'})
        @badge_ns.produces(['image/svg+xml'])
        def get(self):
            """服务器在线率badge"""
            try:
                from flask import request
                hours = int(request.args.get('hours', 24))
                
                servers = poller.db.get_all_servers()
                if not servers:
                    result = generate_badge('uptime', 'N/A', 'grey')
                    return Response(result, mimetype='image/svg+xml')
                
                # 计算指定时间范围在线率
                from collections import defaultdict
                poll_interval = poller.config.get('poll_interval', 60)
                limit = max(1, int(hours * 3600 / poll_interval))
                
                timestamp_status = defaultdict(list)
                for server in servers:
                    history_raw = poller.db.get_server_history(server['id'], limit=limit)
                    history = filter_history_by_time(history_raw, hours)
                    for h in history:
                        timestamp_status[h['timestamp']].append(h['online'])
                
                total_checks = len(timestamp_status)
                online_checks = sum(1 for statuses in timestamp_status.values() if any(statuses))
                uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0
                
                message = f'{uptime_percentage:.1f}%'
                if uptime_percentage >= 99:
                    color = 'green'
                elif uptime_percentage >= 95:
                    color = 'limegreen'
                elif uptime_percentage >= 90:
                    color = 'yellowgreen'
                elif uptime_percentage >= 75:
                    color = 'yellow'
                elif uptime_percentage >= 50:
                    color = 'orange'
                else:
                    color = 'red'
                
                label = f'uptime {hours}h' if hours != 24 else 'uptime 24h'
                result = generate_badge(label, message, color)
                return Response(result, mimetype='image/svg+xml')
            except Exception as e:
                print(f"Error in ServerUptimeBadge: {e}")
                import traceback
                traceback.print_exc()
                svg = generate_badge('uptime', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/server/players')
    class ServerPlayersBadge(Resource):
        @badge_ns.doc('服务器在线玩家Badge', description='返回服务器当前在线玩家数的SVG badge')
        @badge_ns.produces(['image/svg+xml'])
        def get(self):
            """服务器在线玩家数badge"""
            try:
                servers = poller.db.get_all_servers()
                if not servers:
                    result = generate_badge('players', '0', 'grey')
                    return Response(result, mimetype='image/svg+xml')
                
                # 使用set去重,避免同一玩家在多个节点重复计算
                unique_players = set()
                for server in servers:
                    sessions = poller.db.get_online_players(server['id'])
                    for session in sessions:
                        player_name = session.get('player_name')
                        if player_name:
                            unique_players.add(player_name)
                
                total_players = len(unique_players)
                message = str(total_players)
                color = 'green' if total_players > 0 else 'grey'
                result = generate_badge('players', message, color)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('players', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/node/<int:node_id>/status')
    class NodeStatusBadge(Resource):
        @badge_ns.doc('节点状态Badge', description='返回指定节点在线状态的SVG badge')
        @badge_ns.produces(['image/svg+xml'])
        def get(self, node_id):
            """节点状态badge"""
            try:
                server = next((s for s in poller.db.get_all_servers() if s['id'] == node_id), None)
                if not server:
                    result = generate_badge('node', 'not found', 'red')
                    return Response(result, mimetype='image/svg+xml')
                
                status = poller.db.get_server_latest_status(node_id)
                online = status and status.get('online')
                
                message = 'online' if online else 'offline'
                color = 'green' if online else 'red'
                result = generate_badge(server['name'], message, color)
                return Response(result, mimetype='image/svg+xml')
            except Exception as e:
                print(f"Error in NodeStatusBadge: {e}")
                import traceback
                traceback.print_exc()
                svg = generate_badge('node', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/node/<int:node_id>/uptime')
    class NodeUptimeBadge(Resource):
        @badge_ns.doc('节点在线率Badge', description='返回指定节点指定时间范围内在线率的SVG badge', params={'hours': '时间范围(小时),默认24'})
        @badge_ns.produces(['image/svg+xml'])
        def get(self, node_id):
            """节点在线率badge"""
            try:
                from flask import request
                hours = int(request.args.get('hours', 24))
                
                server = next((s for s in poller.db.get_all_servers() if s['id'] == node_id), None)
                if not server:
                    result = generate_badge('uptime', 'not found', 'red')
                    return Response(result, mimetype='image/svg+xml')
                
                poll_interval = poller.config.get('poll_interval', 60)
                limit = max(1, int(hours * 3600 / poll_interval))
                history_raw = poller.db.get_server_history(node_id, limit=limit)
                
                history = filter_history_by_time(history_raw, hours)
                
                if not history:
                    result = generate_badge('uptime', 'N/A', 'grey')
                    return Response(result, mimetype='image/svg+xml')
                
                total_checks = len(history)
                online_checks = sum(1 for h in history if h['online'])
                uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0
                
                message = f'{uptime_percentage:.1f}%'
                if uptime_percentage >= 99:
                    color = 'green'
                elif uptime_percentage >= 95:
                    color = 'limegreen'
                elif uptime_percentage >= 90:
                    color = 'yellowgreen'
                elif uptime_percentage >= 75:
                    color = 'yellow'
                elif uptime_percentage >= 50:
                    color = 'orange'
                else:
                    color = 'red'
                
                label = f'{server["name"]} uptime {hours}h' if hours != 24 else f'{server["name"]} uptime'
                result = generate_badge(label, message, color)
                return Response(result, mimetype='image/svg+xml')
            except Exception as e:
                print(f"Error in NodeUptimeBadge: {e}")
                import traceback
                traceback.print_exc()
                svg = generate_badge('uptime', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/node/<int:node_id>/latency')
    class NodeLatencyBadge(Resource):
        @badge_ns.doc('节点延迟Badge', description='返回指定节点当前延迟的SVG badge')
        @badge_ns.produces(['image/svg+xml'])
        def get(self, node_id):
            """节点延迟badge"""
            try:
                server = next((s for s in poller.db.get_all_servers() if s['id'] == node_id), None)
                if not server:
                    result = generate_badge('latency', 'not found', 'red')
                    return Response(result, mimetype='image/svg+xml')
                
                status = poller.db.get_server_latest_status(node_id)
                
                if not status or not status.get('online'):
                    result = generate_badge(server['name'], 'offline', 'red')
                    return Response(result, mimetype='image/svg+xml')
                
                latency = status.get('latency')
                if latency is None:
                    result = generate_badge(server['name'], 'N/A', 'grey')
                    return Response(result, mimetype='image/svg+xml')
                
                message = f'{int(latency)}ms'
                if latency < 50:
                    color = 'green'
                elif latency < 100:
                    color = 'limegreen'
                elif latency < 150:
                    color = 'yellowgreen'
                elif latency < 200:
                    color = 'yellow'
                elif latency < 300:
                    color = 'orange'
                else:
                    color = 'red'
                
                result = generate_badge(f'{server["name"]} ping', message, color)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('latency', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/node/<int:node_id>/latency-stats')
    class NodeLatencyStatsBadge(Resource):
        @badge_ns.doc('节点延迟统计Badge', description='返回指定节点延迟统计信息的SVG badge', params={
            'stat': '统计类型: avg(平均), min(最小), max(最大), std(标准差), cv(变异系数), 默认avg',
            'hours': '时间范围(小时),默认24'
        })
        @badge_ns.produces(['image/svg+xml'])
        def get(self, node_id):
            """节点延迟统计badge"""
            try:
                from flask import request
                import math
                
                stat_type = request.args.get('stat', 'avg')
                hours = int(request.args.get('hours', 24))
                
                server = next((s for s in poller.db.get_all_servers() if s['id'] == node_id), None)
                if not server:
                    result = generate_badge('latency', 'not found', 'red')
                    return Response(result, mimetype='image/svg+xml')
                
                # 获取历史数据
                poll_interval = poller.config.get('poll_interval', 60)
                limit = max(1, int(hours * 3600 / poll_interval))
                history_raw = poller.db.get_server_history(node_id, limit=limit)
                history = filter_history_by_time(history_raw, hours)
                
                # 提取在线时的延迟数据
                latencies = [h['latency'] for h in history if h.get('online') and h.get('latency') is not None]
                
                if not latencies:
                    result = generate_badge(f'{server["name"]} {stat_type}', 'N/A', 'grey')
                    return Response(result, mimetype='image/svg+xml')
                
                # 计算统计值
                if stat_type == 'avg':
                    value = sum(latencies) / len(latencies)
                    message = f'{value:.1f}ms'
                    label = f'{server["name"]} avg ping'
                elif stat_type == 'min':
                    value = min(latencies)
                    message = f'{value:.1f}ms'
                    label = f'{server["name"]} min ping'
                elif stat_type == 'max':
                    value = max(latencies)
                    message = f'{value:.1f}ms'
                    label = f'{server["name"]} max ping'
                elif stat_type == 'std':
                    avg = sum(latencies) / len(latencies)
                    variance = sum((x - avg) ** 2 for x in latencies) / len(latencies)
                    value = math.sqrt(variance)
                    message = f'{value:.1f}ms'
                    label = f'{server["name"]} std ping'
                elif stat_type == 'cv':
                    avg = sum(latencies) / len(latencies)
                    if avg == 0:
                        result = generate_badge(f'{server["name"]} CV', 'N/A', 'grey')
                        return Response(result, mimetype='image/svg+xml')
                    variance = sum((x - avg) ** 2 for x in latencies) / len(latencies)
                    std = math.sqrt(variance)
                    value = (std / avg) * 100
                    message = f'{value:.1f}%'
                    label = f'{server["name"]} CV'
                else:
                    result = generate_badge('error', 'invalid stat', 'red')
                    return Response(result, mimetype='image/svg+xml')
                
                # 根据延迟值设置颜色（对于avg, min, max）
                if stat_type in ['avg', 'min', 'max']:
                    if value < 50:
                        color = 'green'
                    elif value < 100:
                        color = 'limegreen'
                    elif value < 150:
                        color = 'yellowgreen'
                    elif value < 200:
                        color = 'yellow'
                    elif value < 300:
                        color = 'orange'
                    else:
                        color = 'red'
                # 标准差颜色
                elif stat_type == 'std':
                    if value < 10:
                        color = 'green'
                    elif value < 20:
                        color = 'limegreen'
                    elif value < 30:
                        color = 'yellowgreen'
                    elif value < 50:
                        color = 'yellow'
                    elif value < 100:
                        color = 'orange'
                    else:
                        color = 'red'
                # 变异系数颜色
                else:  # cv
                    if value < 10:
                        color = 'green'
                    elif value < 20:
                        color = 'limegreen'
                    elif value < 30:
                        color = 'yellowgreen'
                    elif value < 50:
                        color = 'yellow'
                    elif value < 75:
                        color = 'orange'
                    else:
                        color = 'red'
                
                result = generate_badge(label, message, color)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('latency stats', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/player/<player_name>/status')
    class PlayerStatusBadge(Resource):
        @badge_ns.doc('玩家在线状态Badge', description='返回指定玩家当前在线状态的SVG badge')
        @badge_ns.produces(['image/svg+xml'])
        def get(self, player_name):
            """玩家在线状态badge"""
            try:
                # 检查玩家是否在任何服务器在线
                servers = poller.db.get_all_servers()
                is_online = False
                
                for server in servers:
                    sessions = poller.db.get_online_players(server['id'])
                    for session in sessions:
                        if session.get('player_name') == player_name:
                            is_online = True
                            break
                    if is_online:
                        break
                
                if is_online:
                    message = 'online'
                    color = 'green'
                else:
                    message = 'offline'
                    color = 'grey'
                
                result = generate_badge(player_name, message, color)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('player', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/player/<player_name>/current-session')
    class PlayerCurrentSessionBadge(Resource):
        @badge_ns.doc('玩家当前会话时长Badge', description='返回指定玩家当前会话时长的SVG badge')
        @badge_ns.produces(['image/svg+xml'])
        def get(self, player_name):
            """玩家当前会话时长badge"""
            try:
                servers = poller.db.get_all_servers()
                current_duration = 0
                
                for server in servers:
                    sessions = poller.db.get_online_players(server['id'])
                    for session in sessions:
                        if session.get('player_name') == player_name:
                            current_duration = session.get('duration_seconds', 0)
                            break
                    if current_duration > 0:
                        break
                
                if current_duration == 0:
                    result = generate_badge(player_name, 'offline', 'grey')
                    return Response(result, mimetype='image/svg+xml')
                
                # 格式化时长
                hours = current_duration // 3600
                minutes = (current_duration % 3600) // 60
                
                if hours >= 1:
                    message = f'{hours}h {minutes}m'
                else:
                    message = f'{minutes}m'
                
                # 根据会话时长设置颜色
                if hours >= 10:
                    color = 'green'
                elif hours >= 5:
                    color = 'limegreen'
                elif hours >= 2:
                    color = 'yellowgreen'
                elif hours >= 1:
                    color = 'yellow'
                else:
                    color = 'blue'
                
                result = generate_badge(f'{player_name} session', message, color)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('session', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/player/<player_name>/period-playtime')
    class PlayerPeriodPlaytimeBadge(Resource):
        @badge_ns.doc('玩家时段游戏时长Badge', description='返回指定玩家在指定时间范围内游戏时长的SVG badge', params={'hours': '时间范围(小时),默认24'})
        @badge_ns.produces(['image/svg+xml'])
        def get(self, player_name):
            """玩家时段游戏时长badge"""
            try:
                from flask import request
                hours = int(request.args.get('hours', 24))
                cutoff = utc8_now() - timedelta(hours=hours)
                
                # 收集所有会话区间
                intervals = []
                
                # 获取玩家历史会话数据
                days = max(1, int(hours / 24) + 1)
                history = poller.db.get_player_history(player_name, days=days)
                
                for h in history:
                    start = parse_dt(h.get('session_start'))
                    end = parse_dt(h.get('session_end'))
                    if start and end and end >= cutoff:
                        # 如果会话跨越cutoff,只计算cutoff之后的部分
                        actual_start = max(start, cutoff)
                        intervals.append((actual_start, end))
                
                # 添加当前在线会话
                servers = poller.db.get_all_servers()
                for server in servers:
                    sessions = poller.db.get_online_players(server['id'])
                    for session in sessions:
                        if session.get('player_name') == player_name:
                            session_start = parse_dt(session.get('session_start'))
                            if session_start:
                                actual_start = max(session_start, cutoff)
                                intervals.append((actual_start, utc8_now()))
                
                # 合并重叠的时间区间
                if not intervals:
                    result = generate_badge(player_name, 'no playtime', 'grey')
                    return Response(result, mimetype='image/svg+xml')
                
                intervals.sort(key=lambda x: x[0])
                merged = [intervals[0]]
                for current_start, current_end in intervals[1:]:
                    last_start, last_end = merged[-1]
                    if current_start <= last_end:
                        # 重叠,合并
                        merged[-1] = (last_start, max(last_end, current_end))
                    else:
                        merged.append((current_start, current_end))
                
                # 计算合并后的总时长
                total_seconds = sum(int((end - start).total_seconds()) for start, end in merged)
                
                if total_seconds == 0:
                    result = generate_badge(player_name, 'no playtime', 'grey')
                    return Response(result, mimetype='image/svg+xml')
                
                # 格式化时长
                play_hours = total_seconds // 3600
                play_minutes = (total_seconds % 3600) // 60
                
                if play_hours >= 1:
                    message = f'{play_hours}h {play_minutes}m'
                else:
                    message = f'{play_minutes}m'
                
                # 根据游戏时长设置颜色
                if play_hours >= hours * 0.5:  # 玩了超过一半时间
                    color = 'green'
                elif play_hours >= hours * 0.3:
                    color = 'limegreen'
                elif play_hours >= hours * 0.1:
                    color = 'yellowgreen'
                elif play_hours >= 1:
                    color = 'yellow'
                else:
                    color = 'blue'
                
                label = f'{player_name} {hours}h playtime' if hours != 24 else f'{player_name} 24h playtime'
                result = generate_badge(label, message, color)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('playtime', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/player/<player_name>/live')
    class PlayerLiveBadge(Resource):
        @badge_ns.doc('玩家实时状态Badge', 
                      description='返回玩家实时状态,在线显示当前会话时长,离线显示最后在线时间', 
                      )
        @badge_ns.produces(['image/svg+xml'])
        def get(self, player_name):
            """玩家实时状态badge"""
            try:
                servers = poller.db.get_all_servers()
                
                # 检查是否当前在线
                current_duration = 0
                for server in servers:
                    sessions = poller.db.get_online_players(server['id'])
                    for session in sessions:
                        if session.get('player_name') == player_name:
                            current_duration = session.get('duration_seconds', 0)
                            break
                    if current_duration > 0:
                        break
                
                # 如果在线,显示当前会话时长
                if current_duration > 0:
                    hours = current_duration // 3600
                    minutes = (current_duration % 3600) // 60
                    
                    if hours >= 1:
                        message = f'{hours}h {minutes}m'
                    else:
                        message = f'{minutes}m'
                    
                    result = generate_badge(f'{player_name}', message, 'green')
                    return Response(result, mimetype='image/svg+xml')
                
                # 如果离线,查找最后在线时间
                last_seen = None
                for server in servers:
                    all_sessions = poller.db.get_all_player_sessions(server['id'])
                    for session in all_sessions:
                        if session.get('player_name') == player_name:
                            last_seen_str = session.get('last_seen')
                            if last_seen_str:
                                last_seen_dt = parse_dt(last_seen_str)
                                if last_seen_dt and (last_seen is None or last_seen_dt > last_seen):
                                    last_seen = last_seen_dt
                
                if not last_seen:
                    result = generate_badge(player_name, 'never seen', 'grey')
                    return Response(result, mimetype='image/svg+xml')
                
                # 计算时间差
                now = utc8_now()
                delta = now - last_seen
                days = delta.days
                hours = delta.seconds // 3600
                
                if days > 365:
                    message = f'{days//365}y ago'
                    color = 'dimgrey'
                elif days > 30:
                    message = f'{days//30}mo ago'
                    color = 'dimgrey'
                elif days > 7:
                    message = f'{days//7}w ago'
                    color = 'yellow'
                elif days > 0:
                    message = f'{days}d ago'
                    color = 'yellowgreen'
                elif hours > 0:
                    message = f'{hours}h ago'
                    color = 'green'
                else:
                    minutes = delta.seconds // 60
                    message = f'{minutes}m ago'
                    color = 'green'
                
                result = generate_badge(f'{player_name}', message, color)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('player', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    api.add_namespace(badge_ns)
    return badge_ns
