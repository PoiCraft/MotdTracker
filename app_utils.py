from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from flask import Request

# UTC+8 timezone constant
UTC8 = timezone(timedelta(hours=8))


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
