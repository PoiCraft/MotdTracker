from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from flask import Request
import subprocess
import tomllib
from pathlib import Path

# UTC+8 timezone constant
UTC8 = timezone(timedelta(hours=8))

# 缓存版本号，只在启动时计算一次
_cached_version: Optional[str] = None


def get_project_version() -> str:
    """从 pyproject.toml 读取项目版本号"""
    try:
        pyproject_path = Path(__file__).parent / 'pyproject.toml'
        with open(pyproject_path, 'rb') as f:
            data = tomllib.load(f)
            return data.get('project', {}).get('version', '0.0.0')
    except Exception:
        return '0.0.0'


def get_version() -> str:
    """生成 Go Mod 伪版本格式的版本号: v{project_version}-yyyymmddhhmmss-abcdefabcdef
    
    版本号在首次调用时生成并缓存，后续调用直接返回缓存值。
    """
    global _cached_version
    
    if _cached_version is not None:
        return _cached_version
    
    base_version = get_project_version()
    
    try:
        # 获取最新 commit 的哈希和时间戳
        result = subprocess.run(
            ['git', 'log', '-1', '--format=%H %ct'],
            capture_output=True,
            text=True,
            timeout=2
        )
        
        if result.returncode == 0:
            output = result.stdout.strip()
            if output:
                parts = output.split()
                if len(parts) == 2:
                    commit_hash = parts[0][:12]  # 取前12位
                    timestamp = int(parts[1])
                    
                    # 转换时间戳为 UTC 时间格式
                    dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                    date_str = dt.strftime('%Y%m%d%H%M%S')
                    
                    _cached_version = f"v{base_version}-{date_str}-{commit_hash}"
                    return _cached_version
    except Exception:
        pass
    
    # 如果 git 命令失败，返回开发版本
    _cached_version = f"v{base_version}-dev"
    return _cached_version


def parse_dt(value: Any) -> Optional[datetime]:
    """Convert database datetime values (string or datetime) to naive datetime (treated as UTC+8)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(value)  # type: ignore[arg-type]
    except Exception:
        return None


def utc8_now() -> datetime:
    """Get current datetime in UTC+8 timezone (naive)."""
    return datetime.now(UTC8).replace(tzinfo=None)


def clamp_hours_param(request: Request, default: int = 12, max_hours: int = 720) -> int:
    """Parse hours from query string with sane bounds."""
    hours = default
    try:
        hours = int(request.args.get('hours', hours))
    except Exception:
        pass
    return max(1, min(hours, max_hours))


def get_server_nodes_data(poller) -> List[Dict[str, Any]]:
    """Build server nodes with their latest status attached."""
    servers = poller.db.get_all_servers()
    nodes = []
    for server in servers:
        latest_status = poller.db.get_server_latest_status(server['id'])
        nodes.append({**server, 'latest_status': latest_status})
    return nodes
