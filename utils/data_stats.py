"""
数据统计和分析工具
计算延迟统计、在线率、P95 等指标
"""
import statistics
from typing import Dict, List, Optional, Any


def calculate_uptime_percentage(history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    计算在线率百分比
    
    Args:
        history: 历史记录列表
    
    Returns:
        dict: 包含 uptime_percentage, total_checks, online_checks
    """
    if not history:
        return {
            'uptime_percentage': 0,
            'total_checks': 0,
            'online_checks': 0
        }
    
    total_checks = len(history)
    online_checks = sum(1 for h in history if h.get('online'))
    uptime_pct = (online_checks / total_checks * 100) if total_checks > 0 else 0
    
    return {
        'uptime_percentage': round(uptime_pct, 2),
        'total_checks': total_checks,
        'online_checks': online_checks
    }


def calculate_latency_stats(history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    计算延迟统计数据（平均、标准差、P95、CV 等）
    
    Args:
        history: 历史记录列表
    
    Returns:
        包含统计信息的字典：uptime_percentage, avg_latency, std_dev, 
        min_latency, max_latency, p95_latency, cv, total_checks, online_checks
    """
    if not history:
        return {
            'uptime_percentage': 0,
            'avg_latency': None,
            'std_dev': None,
            'min_latency': None,
            'max_latency': None,
            'p95_latency': None,
            'cv': None,
            'total_checks': 0,
            'online_checks': 0
        }
    
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
            'cv': round(cv, 2),
            'total_checks': total_checks,
            'online_checks': online_checks
        }
    else:
        return {
            'uptime_percentage': round(uptime_pct, 2),
            'avg_latency': None,
            'std_dev': None,
            'min_latency': None,
            'max_latency': None,
            'p95_latency': None,
            'cv': None,
            'total_checks': total_checks,
            'online_checks': online_checks
        }
