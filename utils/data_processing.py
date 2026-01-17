"""
数据处理工具
包含历史数据排序、过滤、格式转换等通用操作
"""
from datetime import timedelta
from typing import Dict, List, Optional, Any
from utils.app_utils import parse_dt, utc8_now


def filter_history_by_time(history: List[Dict[str, Any]], hours: int) -> List[Dict[str, Any]]:
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


def sort_history_by_timestamp(history: List[Dict[str, Any]], reverse: bool = False) -> List[Dict[str, Any]]:
    """
    按时间戳排序历史数据
    
    Args:
        history: 历史记录列表
        reverse: 是否降序排列，默认 False（升序：最旧在前，最新在后）
    
    Returns:
        排序后的历史记录列表
    """
    if not history:
        return []
    return sorted(history, key=lambda x: x.get('timestamp', ''), reverse=reverse)


def select_representative_record(records: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    从记录列表中选择一个代表性记录（优先选择在线的）
    
    Args:
        records: 记录列表
    
    Returns:
        第一个在线的记录，如果没有则返回第一条记录，如果列表为空返回 None
    """
    if not records:
        return None
    return next((r for r in records if r.get('online')), records[0])


def format_compact_history(history: List[Dict[str, Any]]) -> Dict[str, List]:
    """
    将历史数据转换为紧凑格式（用于图表渲染）
    
    Args:
        history: 历史记录列表（应已排序）
    
    Returns:
        紧凑格式的字典，包含 timestamps, online, latency, players_online, players_max 数组
        数据按时间升序排列（最旧在前，最新在后），适合图表从左到右显示
    """
    if not history:
        return {}
    
    timestamps = []
    online_list = []
    latencies = []
    players_online_list = []
    players_max_list = []
    
    for record in history:
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
