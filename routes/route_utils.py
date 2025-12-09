"""
路由工具函数
提供所有 API 路由共用的数据处理和计算函数
"""
from datetime import timedelta
from collections import defaultdict
import statistics
from app_utils import parse_dt, utc8_now, get_server_nodes_data


def filter_history_by_time(history, hours):
    """
    根据时间戳过滤历史数据，只保留指定小时数内的记录
    
    Args:
        history: 历史记录列表
        hours: 小时数
    
    Returns:
        过滤后的历史记录列表
    """
    if not history:
        return []
    
    cutoff_time = utc8_now() - timedelta(hours=hours)
    filtered = []
    
    for record in history:
        ts = parse_dt(record.get('timestamp'))
        if ts and ts >= cutoff_time:
            filtered.append(record)
    
    return filtered


def calculate_node_stats(history):
    """
    计算节点统计数据
    
    Args:
        history: 历史记录列表
    
    Returns:
        包含统计信息的字典，包括 uptime_percentage, avg_latency, std_dev, 
        min_latency, max_latency, p95_latency, cv
    """
    if not history:
        return None
    
    total_checks = len(history)
    online_checks = sum(1 for h in history if h.get('online'))
    uptime_pct = (online_checks / total_checks * 100) if total_checks > 0 else 0
    
    latencies = [h['latency'] for h in history if h.get('online') and h.get('latency') is not None]
    if latencies:
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
        
        return {
            'uptime_percentage': round(uptime_pct, 2),
            'avg_latency': round(avg_latency, 2),
            'std_dev': round(std_dev, 2),
            'min_latency': round(min_latency, 2),
            'max_latency': round(max_latency, 2),
            'p95_latency': round(p95_latency, 2),
            'cv': round(cv, 2)
        }
    else:
        return {
            'uptime_percentage': round(uptime_pct, 2),
            'avg_latency': None,
            'std_dev': None,
            'min_latency': None,
            'max_latency': None,
            'p95_latency': None,
            'cv': None
        }


def get_compact_history(history):
    """
    将历史数据转换为紧凑格式（用于图表渲染）
    
    Args:
        history: 历史记录列表
    
    Returns:
        紧凑格式的字典，包含 timestamps, online, latency, players_online, players_max 数组
        数据按时间升序排列（最旧在前，最新在后），适合图表从左到右显示
    """
    if not history:
        return {}
    
    # 按时间戳升序排序（最旧在前，最新在后），确保图表从左到右显示
    sorted_history = sorted(history, key=lambda x: x.get('timestamp', ''))
    
    timestamps = []
    online_list = []
    latencies = []
    players_online_list = []
    players_max_list = []
    
    for record in sorted_history:
        timestamps.append(record.get('timestamp'))
        online_list.append(record.get('online', False))
        latencies.append(record.get('latency'))
        players_online_list.append(record.get('players_online'))
        players_max_list.append(record.get('players_max'))
    
    return {
        'timestamps': timestamps,
        'online': online_list,
        'latency': latencies,
        'players_online': players_online_list,
        'players_max': players_max_list
    }


def get_aggregated_history(poller, hours):
    """
    获取聚合的服务器历史数据（所有节点合并，紧凑格式）
    
    Args:
        poller: ServerPoller 实例
        hours: 小时数
    
    Returns:
        紧凑格式的聚合历史数据
    """
    poll_interval = poller.config.get('poll_interval', 60)
    limit = max(1, int(hours * 3600 / poll_interval))
    
    nodes = get_server_nodes_data(poller)
    if not nodes:
        return {}
    
    # 收集所有节点的历史记录，按时间戳分组
    all_histories = defaultdict(lambda: {'records': [], 'by_node_id': {}})
    for node in nodes:
        history = poller.db.get_server_history(node['id'], limit=limit)
        history = filter_history_by_time(history, hours)
        for record in history:
            ts = record.get('timestamp')
            if ts:
                all_histories[ts]['records'].append(record)
                all_histories[ts]['by_node_id'][node['id']] = record
    
    # 按时间排序
    sorted_timestamps = sorted(all_histories.keys())
    
    # 构建紧凑格式
    timestamps = []
    online_list = []
    players_online_list = []
    players_max_list = []
    latencies_by_node = defaultdict(list)
    
    for ts in sorted_timestamps:
        data = all_histories[ts]
        records = data['records']
        by_node_id = data['by_node_id']
        
        # 聚合状态
        any_online = any(r.get('online') for r in records)
        timestamps.append(ts)
        online_list.append(any_online)
        
        # 选择一个在线的记录来获取玩家数据
        selected_record = next((r for r in records if r.get('online')), records[0] if records else None)
        if selected_record:
            players_online_list.append(selected_record.get('players_online'))
            players_max_list.append(selected_record.get('players_max'))
        else:
            players_online_list.append(None)
            players_max_list.append(None)
        
        # 为每个节点收集延迟数据（确保与 timestamps 对齐）
        for node in nodes:
            node_record = by_node_id.get(node['id'])
            if node_record and node_record.get('online') and node_record.get('latency') is not None:
                latencies_by_node[node['name']].append(node_record.get('latency'))
            else:
                latencies_by_node[node['name']].append(None)
    
    return {
        'timestamps': timestamps,
        'online': online_list,
        'players_online': players_online_list,
        'players_max': players_max_list,
        'latencies': dict(latencies_by_node)
    }


def get_uptime_data(poller, hours):
    """
    获取 uptime 数据
    
    Args:
        poller: ServerPoller 实例
        hours: 小时数
    
    Returns:
        包含 uptime_percentage 的字典
    """
    poll_interval = poller.config.get('poll_interval', 60)
    limit = max(1, int(hours * 3600 / poll_interval))
    
    nodes = get_server_nodes_data(poller)
    all_history = []
    for node in nodes:
        history = poller.db.get_server_history(node['id'], limit=limit)
        history = filter_history_by_time(history, hours)
        all_history.extend(history)
    
    if not all_history:
        return {'uptime_percentage': 0}
    
    # 按时间戳分组，每个时间戳只要有一个节点在线就算在线
    by_timestamp = defaultdict(list)
    for record in all_history:
        ts = record.get('timestamp')
        if ts:
            by_timestamp[ts].append(record.get('online', False))
    
    total_timestamps = len(by_timestamp)
    online_timestamps = sum(1 for records in by_timestamp.values() if any(records))
    uptime_pct = (online_timestamps / total_timestamps * 100) if total_timestamps > 0 else 0
    
    return {'uptime_percentage': round(uptime_pct, 2)}


def get_status_timeline(poller, hours):
    """
    获取状态时间线（用于热图）
    
    Args:
        poller: ServerPoller 实例
        hours: 小时数
    
    Returns:
        包含 timestamps 和 online 数组的字典
    """
    poll_interval = poller.config.get('poll_interval', 60)
    limit = max(1, int(hours * 3600 / poll_interval))
    
    nodes = get_server_nodes_data(poller)
    all_history = []
    for node in nodes:
        history = poller.db.get_server_history(node['id'], limit=limit)
        history = filter_history_by_time(history, hours)
        all_history.extend(history)
    
    if not all_history:
        return {'timestamps': [], 'online': []}
    
    # 按时间戳分组
    by_timestamp = defaultdict(list)
    for record in all_history:
        ts = record.get('timestamp')
        if ts:
            by_timestamp[ts].append(record.get('online', False))
    
    sorted_timestamps = sorted(by_timestamp.keys())
    timestamps = []
    online_list = []
    
    for ts in sorted_timestamps:
        timestamps.append(ts)
        # 任意一个节点在线就算在线
        online_list.append(any(by_timestamp[ts]))
    
    return {
        'timestamps': timestamps,
        'online': online_list
    }


def get_node_status_timeline(poller, node_id, hours):
    """
    获取单个节点的状态时间线
    
    Args:
        poller: ServerPoller 实例
        node_id: 节点 ID
        hours: 小时数
    
    Returns:
        包含 timestamps 和 online 数组的字典，按时间升序排列（最旧在前，最新在后）
    """
    poll_interval = poller.config.get('poll_interval', 60)
    limit = max(1, int(hours * 3600 / poll_interval))
    
    history = poller.db.get_server_history(node_id, limit=limit)
    history = filter_history_by_time(history, hours)
    if not history:
        return {'timestamps': [], 'online': []}
    
    # 按时间升序排列（最旧在前，最新在后）
    history = sorted(history, key=lambda x: x.get('timestamp', ''))
    
    timestamps = [h.get('timestamp') for h in history]
    online_list = [h.get('online', False) for h in history]
    
    return {
        'timestamps': timestamps,
        'online': online_list
    }
