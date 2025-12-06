from flask import Flask, jsonify, render_template, request, redirect, url_for
from flask_socketio import SocketIO
from poller import ServerPoller
import atexit
import signal
import sys
from datetime import datetime, timedelta


# 创建Flask应用
app = Flask(__name__)
app.config['SECRET_KEY'] = 'minecraft-tracker-secret-key'

# 初始化SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# 初始化轮询器
poller = ServerPoller('config.json', socketio=socketio)


def build_groups_data():
    """构建服务器组及其最新状态列表"""
    servers = poller.db.get_all_servers()

    groups = {}
    for server in servers:
        server_config = next((s for s in poller.config.get('servers', [])
                             if s['host'] == server['host'] and s['port'] == server['port']), None)
        group_name = server_config.get('group', server['name']) if server_config else server['name']

        if group_name not in groups:
            groups[group_name] = {
                'group_name': group_name,
                'servers': []
            }

        latest_status = poller.db.get_server_latest_status(server['id'])
        groups[group_name]['servers'].append({
            **server,
            'latest_status': latest_status
        })

    return list(groups.values())


@app.route('/')
def index():
    """主页跳转到分组视图"""
    return redirect(url_for('groups_page'))


@app.route('/groups')
def groups_page():
    """分组视图页面"""
    groups = build_groups_data()
    return render_template('groups.html', groups=groups)


@app.route('/servers')
def servers_page():
    """单服视图页面"""
    servers = poller.db.get_all_servers()
    enriched = [{**s, 'latest_status': poller.db.get_server_latest_status(s['id'])} for s in servers]
    return render_template('servers.html', servers=enriched)


@app.route('/player')
def player_page():
    """单玩家详情页面"""
    return render_template('player_detail.html')


@app.route('/api/servers')
def api_servers():
    """API - 获取所有服务器状态（JSON格式）"""
    servers = poller.get_all_servers_status()
    return jsonify(servers)


@app.route('/api/server/<int:server_id>')
def api_server(server_id):
    """API - 获取单个服务器的详细信息"""
    status = poller.db.get_server_latest_status(server_id)
    if status is None:
        return jsonify({'error': '服务器不存在'}), 404
    return jsonify(status)


@app.route('/api/server/<int:server_id>/online_players')
def api_server_online_players(server_id):
    """API - 获取当前在线玩家及在线时长"""

    def _parse_dt(value):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(value)
        except Exception:
            return None

    players = poller.db.get_online_players(server_id)
    now = datetime.now()
    result = []

    for p in players:
        start_dt = _parse_dt(p.get('session_start'))
        last_dt = _parse_dt(p.get('last_seen'))
        duration_seconds = int((now - start_dt).total_seconds()) if start_dt else None
        result.append({
            'player_name': p.get('player_name'),
            'session_start': start_dt.isoformat() if start_dt else None,
            'last_seen': last_dt.isoformat() if last_dt else None,
            'duration_seconds': duration_seconds
        })

    return jsonify(result)


@app.route('/api/server/<int:server_id>/history')
def api_server_history(server_id):
    """API - 获取服务器历史记录"""
    # 获取最近24小时的数据(假设每分钟一次,24*60=1440)
    history = poller.db.get_server_history(server_id, limit=1440)
    return jsonify(history)


@app.route('/api/server/<int:server_id>/stats')
def api_server_stats(server_id):
    """API - 获取服务器统计信息"""
    history = poller.db.get_server_history(server_id, limit=1440)  # 24小时数据
    
    if not history:
        return jsonify({
            'uptime_percentage': 0,
            'avg_latency': None,
            'total_checks': 0,
            'online_checks': 0
        })
    
    # 计算统计数据
    total_checks = len(history)
    online_checks = sum(1 for h in history if h['online'])
    uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0
    
    latencies = [h['latency'] for h in history if h['online'] and h['latency'] is not None]
    avg_latency = sum(latencies) / len(latencies) if latencies else None
    
    stats = {
        'uptime_percentage': round(uptime_percentage, 2),
        'avg_latency': round(avg_latency, 2) if avg_latency else None,
        'total_checks': total_checks,
        'online_checks': online_checks
    }
    
    return jsonify(stats)


@app.route('/api/groups')
def api_groups():
    """API - 获取所有服务器组及其聚合数据"""
    groups = build_groups_data()
    return jsonify(groups)


@app.route('/api/group/<group_name>/history')
def api_group_history(group_name):
    """API - 获取服务器组的聚合历史数据"""
    servers = poller.db.get_all_servers()
    
    # 找到该组的所有服务器
    group_servers = []
    for server in servers:
        server_config = next((s for s in poller.config.get('servers', []) 
                             if s['host'] == server['host'] and s['port'] == server['port']), None)
        if server_config and server_config.get('group') == group_name:
            group_servers.append({
                'id': server['id'],
                'name': server['name']
            })
    
    if not group_servers:
        return jsonify([])
    
    # 获取每个服务器的历史数据
    servers_history = {}
    for server in group_servers:
        history = poller.db.get_server_history(server['id'], limit=1440)
        servers_history[server['name']] = history
    
    # 按时间戳聚合所有服务器的数据
    all_histories = {}
    for server_name, history in servers_history.items():
        for record in history:
            timestamp = record['timestamp']
            if timestamp not in all_histories:
                all_histories[timestamp] = {
                    'timestamp': timestamp,
                    'servers': {}
                }
            all_histories[timestamp]['servers'][server_name] = record
    
    # 转换为列表,每个时间点选择最佳数据用于玩家信息
    aggregated_history = []
    for timestamp in sorted(all_histories.keys(), reverse=True):
        data = all_histories[timestamp]
        servers_data = data['servers']
        
        # 优先选择在线的记录来获取玩家信息
        online_records = [r for r in servers_data.values() if r['online']]
        selected_record = online_records[0] if online_records else list(servers_data.values())[0]
        
        # 构建每个服务器的延迟数据
        latencies = {}
        for server_name, record in servers_data.items():
            latencies[server_name] = record.get('latency') if record['online'] else None
        
        aggregated_history.append({
            'timestamp': timestamp,
            'online': len(online_records) > 0,
            'players_online': selected_record.get('players_online'),
            'players_max': selected_record.get('players_max'),
            'latencies': latencies,  # 每个服务器的延迟
            'version': selected_record.get('version'),
            'motd': selected_record.get('motd')
        })
    
    return jsonify(aggregated_history)


@app.route('/api/group/<group_name>/stats')
def api_group_stats(group_name):
    """API - 获取服务器组的统计信息"""
    servers = poller.db.get_all_servers()
    
    # 找到该组的所有服务器
    group_server_ids = []
    for server in servers:
        server_config = next((s for s in poller.config.get('servers', []) 
                             if s['host'] == server['host'] and s['port'] == server['port']), None)
        if server_config and server_config.get('group') == group_name:
            group_server_ids.append(server['id'])
    
    if not group_server_ids:
        return jsonify({
            'uptime_percentage': 0,
            'avg_latency': None,
            'total_checks': 0,
            'online_checks': 0
        })
    
    # 聚合统计
    total_checks = 0
    online_checks = 0
    all_latencies = []
    
    for server_id in group_server_ids:
        history = poller.db.get_server_history(server_id, limit=1440)
        total_checks += len(history)
        online_checks += sum(1 for h in history if h['online'])
        all_latencies.extend([h['latency'] for h in history if h['online'] and h['latency'] is not None])
    
    uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0
    avg_latency = sum(all_latencies) / len(all_latencies) if all_latencies else None
    
    return jsonify({
        'uptime_percentage': round(uptime_percentage, 2),
        'avg_latency': round(avg_latency, 2) if avg_latency else None,
        'total_checks': total_checks,
        'online_checks': online_checks
    })


@app.route('/api/group/<group_name>/players')
def api_group_players(group_name):
    """API - 获取组内所有玩家会话信息"""
    servers = poller.db.get_all_servers()

    # 找到该组的所有服务器配置
    group_servers = []
    for server in servers:
        server_config = next((s for s in poller.config.get('servers', [])
                             if s['host'] == server['host'] and s['port'] == server['port']), None)
        if server_config and server_config.get('group') == group_name:
            group_servers.append(server)

    result = []
    now = datetime.now()

    def _parse_dt(value):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(value)
        except Exception:
            return None

    for server in group_servers:
        sessions = poller.db.get_all_player_sessions(server['id'])
        for s in sessions:
            start_dt = _parse_dt(s.get('session_start'))
            last_dt = _parse_dt(s.get('last_seen'))
            duration_seconds = int((now - start_dt).total_seconds()) if start_dt and s.get('online') else None
            result.append({
                'server_id': server['id'],
                'server_name': server['name'],
                'player_name': s.get('player_name'),
                'online': s.get('online'),
                'session_start': start_dt.isoformat() if start_dt else None,
                'last_seen': last_dt.isoformat() if last_dt else None,
                'last_seen_dt': last_dt,
                'duration_seconds': duration_seconds,
            })

    # 在线优先，其次按最后在线时间倒序，只保留每个玩家的第一条记录
    result.sort(key=lambda x: (
        not x['online'],
        -(x['last_seen_dt'].timestamp() if x['last_seen_dt'] else float('-inf'))
    ))

    filtered = []
    seen = set()
    for item in result:
        name = item.get('player_name')
        if name in seen:
            continue
        seen.add(name)
        item.pop('last_seen_dt', None)
        filtered.append(item)

    return jsonify(filtered)


@app.route('/api/players')
def api_all_players():
    """API - 获取全服玩家会话汇总"""
    servers = poller.db.get_all_servers()
    now = datetime.now()

    def _parse_dt(value):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(value)
        except Exception:
            return None

    aggregated = {}

    for server in servers:
        sessions = poller.db.get_all_player_sessions(server['id'])
        for s in sessions:
            name = s.get('player_name')
            if not name:
                continue
            start_dt = _parse_dt(s.get('session_start'))
            last_dt = _parse_dt(s.get('last_seen'))
            duration_seconds = int((now - start_dt).total_seconds()) if start_dt and s.get('online') else None

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
                    'duration_seconds': duration_seconds,
                    'servers': [server_entry]
                }
            else:
                agg = aggregated[name]
                agg['servers'].append(server_entry)
                agg['online'] = agg['online'] or bool(s.get('online'))
                # 更新最近在线时间
                if last_dt and (agg['last_seen_dt'] is None or last_dt > agg['last_seen_dt']):
                    agg['last_seen_dt'] = last_dt
                    agg['last_seen'] = last_dt.isoformat()
                # 如果当前条目在线，刷新会话开始与时长
                if s.get('online') and start_dt:
                    agg['session_start'] = start_dt.isoformat()
                    agg['duration_seconds'] = duration_seconds

    # 排序：在线优先，其次最后在线时间倒序
    players = list(aggregated.values())
    players.sort(key=lambda x: (
        not x['online'],
        -(x['last_seen_dt'].timestamp() if x['last_seen_dt'] else float('-inf'))
    ))

    # 删除内部字段
    for p in players:
        p.pop('last_seen_dt', None)
        for s in p['servers']:
            s.pop('last_seen_dt', None)

    return jsonify(players)


@app.route('/api/player/<player_name>/detail')
def api_player_detail(player_name):
    """API - 获取单一玩家的在线详情（群组级别聚合）"""
    servers = poller.db.get_all_servers()
    now = datetime.now()

    def _parse_dt(value):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(value)
        except Exception:
            return None

    # 按群组聚合会话
    groups = {}
    
    for server in servers:
        # 获取服务器配置以确定群组
        server_config = next((s for s in poller.config.get('servers', []) 
                             if s['host'] == server['host'] and s['port'] == server['port']), None)
        group_name = server_config.get('group', '默认') if server_config else '默认'
        
        sessions = poller.db.get_all_player_sessions(server['id'])
        for s in sessions:
            if s.get('player_name') != player_name:
                continue
            
            start_dt = _parse_dt(s.get('session_start'))
            last_dt = _parse_dt(s.get('last_seen'))
            
            if group_name not in groups:
                groups[group_name] = {
                    'online': False,
                    'session_start': None,
                    'last_seen': None,
                    'duration_seconds': None,
                    'earliest_start': None,
                    'latest_seen': None
                }
            
            group = groups[group_name]
            
            # 更新在线状态
            if s.get('online'):
                group['online'] = True
                # 取最早的会话开始时间
                if start_dt and (group['earliest_start'] is None or start_dt < group['earliest_start']):
                    group['earliest_start'] = start_dt
                    group['session_start'] = start_dt.isoformat()
            
            # 更新最后在线时间
            if last_dt and (group['latest_seen'] is None or last_dt > group['latest_seen']):
                group['latest_seen'] = last_dt
                group['last_seen'] = last_dt.isoformat()
    
    # 计算每个群组的在线时长
    for group_name, group in groups.items():
        if group['online'] and group['earliest_start']:
            group['duration_seconds'] = int((now - group['earliest_start']).total_seconds())
        # 清理内部字段
        group.pop('earliest_start', None)
        group.pop('latest_seen', None)
    
    # 全局摘要
    summary = {
        'player_name': player_name,
        'online': any(g['online'] for g in groups.values()),
        'session_start': None,
        'last_seen': None,
        'duration_seconds': None,
        'groups': groups
    }
    
    # 计算全局会话开始时间和时长
    if summary['online']:
        online_groups = [g for g in groups.values() if g['online']]
        if online_groups:
            earliest = min((datetime.fromisoformat(g['session_start']) for g in online_groups if g['session_start']))
            summary['session_start'] = earliest.isoformat()
            summary['duration_seconds'] = int((now - earliest).total_seconds())
    
    # 全局最后在线时间
    all_last_seen = [datetime.fromisoformat(g['last_seen']) for g in groups.values() if g['last_seen']]
    if all_last_seen:
        latest = max(all_last_seen)
        summary['last_seen'] = latest.isoformat()

    return jsonify(summary)


@app.route('/api/player/<player_name>/calendar')
def api_player_calendar(player_name):
    """API - 获取玩家日历视图数据"""
    days = int(poller.config.get('player_calendar_days', 30))
    try:
        days = int(request.args.get('days', days))
    except Exception:
        pass

    history = poller.db.get_player_history(player_name, days)

    now = datetime.now()
    
    # 构建服务器到群组的映射
    server_to_group = {}
    for server in poller.db.get_all_servers():
        server_config = next((s for s in poller.config.get('servers', []) 
                             if s['host'] == server['host'] and s['port'] == server['port']), None)
        group_name = server_config.get('group', '默认') if server_config else '默认'
        server_to_group[server['id']] = group_name

    # 当前在线会话也纳入
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

    # 时间段合并去重：处理多服务器同时在线的情况
    def merge_intervals(intervals):
        """合并重叠的时间段，返回不重叠的净在线时间段"""
        if not intervals:
            return []
        # 按开始时间排序
        intervals.sort(key=lambda x: x[0])
        merged = [intervals[0]]
        for current_start, current_end, server_id in intervals[1:]:
            last_start, last_end, last_server = merged[-1]
            if current_start <= last_end:
                # 重叠，合并（保留第一个服务器ID）
                merged[-1] = (last_start, max(last_end, current_end), last_server)
            else:
                # 不重叠，添加新段
                merged.append((current_start, current_end, server_id))
        return merged

    # 将所有会话转换为时间段
    intervals = []
    for item in history:
        start = datetime.fromisoformat(item['session_start']) if isinstance(item['session_start'], str) else item['session_start']
        end = datetime.fromisoformat(item['session_end']) if isinstance(item['session_end'], str) else item['session_end']
        if not start or not end or end <= start:
            continue
        intervals.append((start, end, item['server_id']))

    # 合并重叠时间段
    merged_sessions = merge_intervals(intervals)

    # 聚合：日总时长、日-小时热力、当日会话切片
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

        # 按天分段会话列表（仅记录分段，不累积总时长）
        for ds, de in split_by_day(start, end):
            day_key = ds.date()
            if day_key not in daily:
                daily[day_key] = {'total_seconds': 0, 'sessions': [], 'heat': {}}
            # 使用群组名称而不是服务器名称
            group_name = server_to_group.get(server_id, '默认')
            daily[day_key]['sessions'].append({
                'start': ds.isoformat(),
                'end': de.isoformat(),
                'group_name': group_name
            })

        # 按小时累积热力，同时累积日总时长
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

    return jsonify(response)


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
    print("访问 http://127.0.0.1:5000 查看监控面板")
    print("按 Ctrl+C 停止服务")
    
    port = poller.config.get('port', 5000)
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)


if __name__ == '__main__':
    main()

