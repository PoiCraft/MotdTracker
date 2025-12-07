from flask import Response, request
from flask_restx import Namespace, Resource
from app_utils import parse_dt, utc8_now
from datetime import timedelta
from badge_generator import generate_badge


def register_badge_routes(api, poller):
    badge_ns = Namespace('badge', description='Badge生成接口', path='/badge')

    @badge_ns.route('/server/status')
    class ServerStatusBadge(Resource):
        @badge_ns.doc('服务器状态Badge', description='返回服务器在线状态的SVG badge', params={'style': 'Badge样式(flat, flat-square, plastic, for-the-badge, social)'})
        def get(self):
            """服务器状态badge"""
            try:
                style = request.args.get('style', 'flat')
                
                servers = poller.db.get_all_servers()
                if not servers:
                    result = generate_badge('server', 'unknown', 'lightgrey', style)
                    return Response(result, mimetype='image/svg+xml')
                
                # 检查是否有任何节点在线
                online = False
                for server in servers:
                    status = poller.db.get_server_latest_status(server['id'])
                    if status and status.get('online'):
                        online = True
                        break
                
                message = 'online' if online else 'offline'
                color = 'brightgreen' if online else 'red'
                result = generate_badge('server', message, color, style)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('server', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/server/uptime')
    class ServerUptimeBadge(Resource):
        @badge_ns.doc('服务器在线率Badge', description='返回服务器指定时间范围内在线率的SVG badge', params={'style': 'Badge样式(flat, flat-square, plastic, for-the-badge, social)', 'hours': '时间范围(小时),默认24'})
        def get(self):
            """服务器在线率badge"""
            try:
                from flask import request
                style = request.args.get('style', 'flat')
                hours = int(request.args.get('hours', 24))
                
                servers = poller.db.get_all_servers()
                if not servers:
                    result = generate_badge('uptime', 'N/A', 'lightgrey', style)
                    return Response(result, mimetype='image/svg+xml')
                
                # 计算指定时间范围在线率
                from collections import defaultdict
                poll_interval = poller.config.get('poll_interval', 60)
                limit = max(1, int(hours * 3600 / poll_interval))
                cutoff = utc8_now() - timedelta(hours=hours)
                
                timestamp_status = defaultdict(list)
                for server in servers:
                    history_raw = poller.db.get_server_history(server['id'], limit=limit)
                    for h in history_raw:
                        ts = parse_dt(h.get('timestamp'))
                        if ts is not None and ts < cutoff:
                            continue
                        timestamp_status[h['timestamp']].append(h['online'])
                
                total_checks = len(timestamp_status)
                online_checks = sum(1 for statuses in timestamp_status.values() if any(statuses))
                uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0
                
                message = f'{uptime_percentage:.1f}%'
                if uptime_percentage >= 99:
                    color = 'brightgreen'
                elif uptime_percentage >= 95:
                    color = 'green'
                elif uptime_percentage >= 90:
                    color = 'yellowgreen'
                elif uptime_percentage >= 75:
                    color = 'yellow'
                elif uptime_percentage >= 50:
                    color = 'orange'
                else:
                    color = 'red'
                
                label = f'uptime {hours}h' if hours != 24 else 'uptime 24h'
                result = generate_badge(label, message, color, style)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('uptime', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/server/players')
    class ServerPlayersBadge(Resource):
        @badge_ns.doc('服务器在线玩家Badge', description='返回服务器当前在线玩家数的SVG badge', params={'style': 'Badge样式(flat, flat-square, plastic, for-the-badge, social)'})
        def get(self):
            """服务器在线玩家数badge"""
            try:
                style = request.args.get('style', 'flat')
                servers = poller.db.get_all_servers()
                if not servers:
                    result = generate_badge('players', '0', 'lightgrey', style)
                    return Response(result, mimetype='image/svg+xml')
                
                # 使用set去重,避免同一玩家在多个节点重复计�?
                unique_players = set()
                for server in servers:
                    sessions = poller.db.get_online_players(server['id'])
                    for session in sessions:
                        player_name = session.get('player_name')
                        if player_name:
                            unique_players.add(player_name)
                
                total_players = len(unique_players)
                message = str(total_players)
                color = 'blue' if total_players > 0 else 'lightgrey'
                result = generate_badge('players', message, color, style)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('players', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/node/<int:node_id>/status')
    class NodeStatusBadge(Resource):
        @badge_ns.doc('节点状态Badge', description='返回指定节点在线状态的SVG badge', params={'style': 'Badge样式(flat, flat-square, plastic, for-the-badge, social)'})
        def get(self, node_id):
            """节点状态badge"""
            try:
                style = request.args.get('style', 'flat')
                server = next((s for s in poller.db.get_all_servers() if s['id'] == node_id), None)
                if not server:
                    result = generate_badge('node', 'not found', 'red', style)
                    return Response(result, mimetype='image/svg+xml')
                
                status = poller.db.get_server_latest_status(node_id)
                online = status and status.get('online')
                
                message = 'online' if online else 'offline'
                color = 'brightgreen' if online else 'red'
                result = generate_badge(server['name'], message, color, style)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('node', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/node/<int:node_id>/uptime')
    class NodeUptimeBadge(Resource):
        @badge_ns.doc('节点在线率Badge', description='返回指定节点指定时间范围内在线率的SVG badge', params={'style': 'Badge样式(flat, flat-square, plastic, for-the-badge, social)', 'hours': '时间范围(小时),默认24'})
        def get(self, node_id):
            """节点在线率badge"""
            try:
                from flask import request
                style = request.args.get('style', 'flat')
                hours = int(request.args.get('hours', 24))
                
                server = next((s for s in poller.db.get_all_servers() if s['id'] == node_id), None)
                if not server:
                    result = generate_badge('uptime', 'not found', 'red', style)
                    return Response(result, mimetype='image/svg+xml')
                
                poll_interval = poller.config.get('poll_interval', 60)
                limit = max(1, int(hours * 3600 / poll_interval))
                cutoff = utc8_now() - timedelta(hours=hours)
                history_raw = poller.db.get_server_history(node_id, limit=limit)
                
                history = [h for h in history_raw if parse_dt(h.get('timestamp')) and parse_dt(h.get('timestamp')) >= cutoff]
                
                if not history:
                    result = generate_badge('uptime', 'N/A', 'lightgrey', style)
                    return Response(result, mimetype='image/svg+xml')
                
                total_checks = len(history)
                online_checks = sum(1 for h in history if h['online'])
                uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0
                
                message = f'{uptime_percentage:.1f}%'
                if uptime_percentage >= 99:
                    color = 'brightgreen'
                elif uptime_percentage >= 95:
                    color = 'green'
                elif uptime_percentage >= 90:
                    color = 'yellowgreen'
                elif uptime_percentage >= 75:
                    color = 'yellow'
                elif uptime_percentage >= 50:
                    color = 'orange'
                else:
                    color = 'red'
                
                label = f'{server["name"]} uptime {hours}h' if hours != 24 else f'{server["name"]} uptime'
                result = generate_badge(label, message, color, style)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('uptime', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/node/<int:node_id>/latency')
    class NodeLatencyBadge(Resource):
        @badge_ns.doc('节点延迟Badge', description='返回指定节点当前延迟的SVG badge', params={'style': 'Badge样式(flat, flat-square, plastic, for-the-badge, social)'})
        def get(self, node_id):
            """节点延迟badge"""
            try:
                style = request.args.get('style', 'flat')
                server = next((s for s in poller.db.get_all_servers() if s['id'] == node_id), None)
                if not server:
                    result = generate_badge('latency', 'not found', 'red', style)
                    return Response(result, mimetype='image/svg+xml')
                
                status = poller.db.get_server_latest_status(node_id)
                
                if not status or not status.get('online'):
                    result = generate_badge(server['name'], 'offline', 'red', style)
                    return Response(result, mimetype='image/svg+xml')
                
                latency = status.get('latency')
                if latency is None:
                    result = generate_badge(server['name'], 'N/A', 'lightgrey', style)
                    return Response(result, mimetype='image/svg+xml')
                
                message = f'{int(latency)}ms'
                if latency < 50:
                    color = 'brightgreen'
                elif latency < 100:
                    color = 'green'
                elif latency < 150:
                    color = 'yellowgreen'
                elif latency < 200:
                    color = 'yellow'
                elif latency < 300:
                    color = 'orange'
                else:
                    color = 'red'
                
                result = generate_badge(f'{server["name"]} ping', message, color, style)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('latency', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/player/<player_name>/status')
    class PlayerStatusBadge(Resource):
        @badge_ns.doc('玩家在线状态Badge', description='返回指定玩家当前在线状态的SVG badge', params={'style': 'Badge样式(flat, flat-square, plastic, for-the-badge, social)'})
        def get(self, player_name):
            """玩家在线状态badge"""
            try:
                # 检查玩家是否在任何服务器在线
                servers = poller.db.get_all_servers()
                is_online = False
                current_server = None
                
                for server in servers:
                    sessions = poller.db.get_online_players(server['id'])
                    for session in sessions:
                        if session.get('player_name') == player_name:
                            is_online = True
                            current_server = server['name']
                            break
                    if is_online:
                        break
                
                if is_online:
                    message = f'online @ {current_server}' if current_server else 'online'
                    color = 'brightgreen'
                else:
                    message = 'offline'
                    color = 'lightgrey'
                
                result = generate_badge(player_name, message, color, style)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('player', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/player/<player_name>/current-session')
    class PlayerCurrentSessionBadge(Resource):
        @badge_ns.doc('玩家当前会话时长Badge', description='返回指定玩家当前会话时长的SVG badge', params={'style': 'Badge样式(flat, flat-square, plastic, for-the-badge, social)'})
        def get(self, player_name):
            """玩家当前会话时长badge"""
            try:
                style = request.args.get('style', 'flat')
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
                    result = generate_badge(player_name, 'offline', 'lightgrey', style)
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
                    color = 'brightgreen'
                elif hours >= 5:
                    color = 'green'
                elif hours >= 2:
                    color = 'yellowgreen'
                elif hours >= 1:
                    color = 'yellow'
                else:
                    color = 'blue'
                
                result = generate_badge(f'{player_name} session', message, color, style)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('session', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/player/<player_name>/period-playtime')
    class PlayerPeriodPlaytimeBadge(Resource):
        @badge_ns.doc('玩家时段游戏时长Badge', description='返回指定玩家在指定时间范围内游戏时长的SVG badge', params={'style': 'Badge样式(flat, flat-square, plastic, for-the-badge, social)', 'hours': '时间范围(小时),默认24'})
        def get(self, player_name):
            """玩家时段游戏时长badge"""
            try:
                from flask import request
                style = request.args.get('style', 'flat')
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
                    result = generate_badge(player_name, 'no playtime', 'lightgrey', style)
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
                    result = generate_badge(player_name, 'no playtime', 'lightgrey', style)
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
                    color = 'brightgreen'
                elif play_hours >= hours * 0.3:
                    color = 'green'
                elif play_hours >= hours * 0.1:
                    color = 'yellowgreen'
                elif play_hours >= 1:
                    color = 'yellow'
                else:
                    color = 'blue'
                
                label = f'{player_name} {hours}h playtime' if hours != 24 else f'{player_name} 24h playtime'
                result = generate_badge(label, message, color, style)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('playtime', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    @badge_ns.route('/player/<player_name>/live')
    class PlayerLiveBadge(Resource):
        @badge_ns.doc('玩家实时状态Badge', 
                      description='返回玩家实时状态,在线显示当前会话时长,离线显示最后在线时间', 
                      params={'style': 'Badge样式(flat, flat-square, plastic, for-the-badge, social)'})
        def get(self, player_name):
            """玩家实时状态badge"""
            try:
                style = request.args.get('style', 'flat')
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
                    
                    result = generate_badge(f'{player_name}', message, 'brightgreen', style)
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
                    result = generate_badge(player_name, 'never seen', 'lightgrey', style)
                    return Response(result, mimetype='image/svg+xml')
                
                # 计算时间差
                now = utc8_now()
                delta = now - last_seen
                days = delta.days
                hours = delta.seconds // 3600
                
                if days > 365:
                    message = f'{days//365}y ago'
                    color = 'lightgrey'
                elif days > 30:
                    message = f'{days//30}mo ago'
                    color = 'lightgrey'
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
                    color = 'brightgreen'
                
                result = generate_badge(f'{player_name}', message, color, style)
                return Response(result, mimetype='image/svg+xml')
            except Exception:
                svg = generate_badge('player', 'error', 'red')
                return Response(svg, mimetype='image/svg+xml')

    api.add_namespace(badge_ns)
    return badge_ns
