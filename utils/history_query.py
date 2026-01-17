"""
历史数据查询和聚合函数
用于聚合多个节点的历史数据和计算时间线统计
"""
from collections import defaultdict
from typing import Dict, List, Any
from utils.app_utils import get_server_nodes_data
from utils.data_processing import (
    filter_history_by_time, sort_history_by_timestamp, select_representative_record
)


def get_history_limit(poller, hours: int) -> int:
    """
    计算历史数据的查询限制条数
    
    Args:
        poller: ServerPoller 实例
        hours: 小时数
    
    Returns:
        int: 查询限制条数
    """
    poll_interval = poller.config.get('poll_interval', 60)
    return max(1, int(hours * 3600 / poll_interval))


def get_aggregated_history(poller, hours: int) -> Dict[str, Any]:
    """
    获取聚合的服务器历史数据（所有节点合并，紧凑格式）
    
    Args:
        poller: ServerPoller 实例
        hours: 小时数
    
    Returns:
        紧凑格式的聚合历史数据
    """
    limit = get_history_limit(poller, hours)
    
    all_nodes = get_server_nodes_data(poller)
    # 只处理已启用的节点
    nodes = [n for n in all_nodes if n.get('enabled', True)]
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
        
        # 选择一个代表性记录
        selected_record = select_representative_record(records)
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


def get_uptime_data(poller, hours: int) -> Dict[str, Any]:
    """
    获取 uptime 数据
    
    Args:
        poller: ServerPoller 实例
        hours: 小时数
    
    Returns:
        包含 uptime_percentage, total_checks, online_checks 的字典
    """
    limit = get_history_limit(poller, hours)
    
    all_nodes = get_server_nodes_data(poller)
    # 只处理已启用的节点
    nodes = [n for n in all_nodes if n.get('enabled', True)]
    all_history = []
    for node in nodes:
        history = poller.db.get_server_history(node['id'], limit=limit)
        history = filter_history_by_time(history, hours)
        all_history.extend(history)
    
    if not all_history:
        return {'uptime_percentage': 0, 'total_checks': 0, 'online_checks': 0}
    
    # 按时间戳分组，每个时间戳只要有一个节点在线就算在线
    by_timestamp = defaultdict(list)
    for record in all_history:
        ts = record.get('timestamp')
        if ts:
            by_timestamp[ts].append(record.get('online', False))
    
    total_timestamps = len(by_timestamp)
    online_timestamps = sum(1 for records in by_timestamp.values() if any(records))
    uptime_pct = (online_timestamps / total_timestamps * 100) if total_timestamps > 0 else 0
    
    return {
        'uptime_percentage': round(uptime_pct, 2),
        'total_checks': total_timestamps,
        'online_checks': online_timestamps
    }


def get_status_timeline(poller, hours: int) -> Dict[str, List]:
    """
    获取状态时间线（用于热图）
    
    Args:
        poller: ServerPoller 实例
        hours: 小时数
    
    Returns:
        包含 timestamps 和 online 数组的字典
    """
    limit = get_history_limit(poller, hours)
    
    all_nodes = get_server_nodes_data(poller)
    # 只处理已启用的节点
    nodes = [n for n in all_nodes if n.get('enabled', True)]
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


def get_node_status_timeline(poller, node_id: int, hours: int) -> Dict[str, List]:
    """
    获取单个节点的状态时间线
    
    Args:
        poller: ServerPoller 实例
        node_id: 节点 ID
        hours: 小时数
    
    Returns:
        包含 timestamps 和 online 数组的字典，按时间升序排列（最旧在前，最新在后）
    """
    limit = get_history_limit(poller, hours)
    
    history = poller.db.get_server_history(node_id, limit=limit)
    history = filter_history_by_time(history, hours)
    if not history:
        return {'timestamps': [], 'online': []}
    
    # 按时间升序排列（最旧在前，最新在后）
    history = sort_history_by_timestamp(history)
    
    timestamps = [h.get('timestamp') for h in history]
    online_list = [h.get('online', False) for h in history]
    
    return {
        'timestamps': timestamps,
        'online': online_list
    }
