"""GraphQL Schema 定义

定义所有 GraphQL 类型和查询接口。
"""
import graphene
from graphene import ObjectType, String, Int, Float, Boolean, List, Field
from collections import defaultdict
from utils.app_utils import parse_dt, get_server_nodes_data
from utils.data_stats import calculate_latency_stats
from utils.data_processing import filter_history_by_time, select_representative_record


# ==================== 基础类型 ====================

class LatencyStats(ObjectType):
    """延迟统计信息"""
    uptime_percentage = Float(description="在线率百分比")
    avg_latency = Float(description="平均延迟(ms)")
    std_dev = Float(description="延迟标准差(ms)")
    min_latency = Float(description="最小延迟(ms)")
    max_latency = Float(description="最大延迟(ms)")
    p95_latency = Float(description="P95延迟(ms)")
    cv = Float(description="变异系数(%)")
    total_checks = Int(description="总检查次数")
    online_checks = Int(description="在线次数")


class NodeStatus(ObjectType):
    """节点状态"""
    id = Int(description="状态记录ID")
    server_id = Int(description="节点ID")
    timestamp = String(description="记录时间")
    online = Boolean(description="是否在线")
    latency = Float(description="延迟(ms)")
    players_online = Int(description="在线玩家数")
    players_max = Int(description="最大玩家数")
    version = String(description="服务器版本")
    motd = String(description="服务器MOTD")
    sample_players = List(String, description="玩家列表样本")
    software = String(description="服务端软件")
    plugins = List(String, description="插件列表")
    map_name = String(description="地图名称")


class Node(ObjectType):
    """服务器节点"""
    id = Int(description="节点ID")
    name = String(description="节点名称")
    host = String(description="服务器地址")
    port = Int(description="服务器端口")
    color = String(description="节点颜色(十六进制)")
    enabled = Boolean(description="是否启用")
    latest_status = Field(NodeStatus, description="最新状态")
    latency_stats = Field(LatencyStats, description="24小时延迟统计")
    
    # 动态字段需要 resolver
    history = List(
        lambda: NodeHistoryRecord,
        hours=Int(default_value=12, description="时间范围(小时)"),
        description="历史记录"
    )
    
    def resolve_history(self, info, hours=12):
        """解析节点历史记录"""
        poller = info.context.get('poller')
        if not poller:
            return []
        
        poll_interval = poller.config.get('poll_interval', 60)
        limit = max(1, int(hours * 3600 / poll_interval))
        
        history_raw = poller.db.get_server_history(self.id, limit=limit)
        history = filter_history_by_time(history_raw, hours)
        
        return [NodeHistoryRecord(
            timestamp=h.get('timestamp'),
            online=h.get('online'),
            latency=h.get('latency'),
            players_online=h.get('players_online'),
            players_max=h.get('players_max'),
            version=h.get('version'),
            motd=h.get('motd')
        ) for h in history]


class NodeHistoryRecord(ObjectType):
    """节点历史记录"""
    timestamp = String(description="记录时间")
    online = Boolean(description="是否在线")
    latency = Float(description="延迟(ms)")
    players_online = Int(description="在线玩家数")
    players_max = Int(description="最大玩家数")
    version = String(description="服务器版本")
    motd = String(description="MOTD")


class LatencyMap(ObjectType):
    """节点延迟映射项"""
    node_name = String(description="节点名称")
    latency = Float(description="延迟(ms)")


class ServerHistoryRecord(ObjectType):
    """服务器聚合历史记录"""
    timestamp = String(description="记录时间")
    online = Boolean(description="是否在线(任一节点)")
    players_online = Int(description="在线玩家数")
    players_max = Int(description="最大玩家数")
    version = String(description="服务器版本")
    motd = String(description="MOTD")
    latencies = List(LatencyMap, description="各节点延迟")


class ServerHead(ObjectType):
    """服务器实时聚合状态"""
    timestamp = String(description="时间戳")
    online = Boolean(description="是否在线")
    players_online = Int(description="在线玩家数")
    players_max = Int(description="最大玩家数")
    version = String(description="服务器版本")
    motd = String(description="服务器MOTD")
    latencies = List(LatencyMap, description="各节点延迟")
    nodes = List(Node, description="节点列表")


class ServerStats(ObjectType):
    """服务器统计信息"""
    uptime_percentage = Float(description="在线率百分比")
    avg_latency = Float(description="平均延迟(ms)")
    std_dev = Float(description="延迟标准差(ms)")
    min_latency = Float(description="最小延迟(ms)")
    max_latency = Float(description="最大延迟(ms)")
    p95_latency = Float(description="P95延迟(ms)")
    cv = Float(description="变异系数(%)")
    total_checks = Int(description="总检查次数")
    online_checks = Int(description="在线次数")


class UptimeInfo(ObjectType):
    """在线率信息"""
    uptime_percentage = Float(description="在线率百分比")
    total_checks = Int(description="总检查次数")
    online_checks = Int(description="在线次数")


# ==================== 玩家类型 ====================

class PlayerServerEntry(ObjectType):
    """玩家在某节点的状态"""
    server_id = Int(description="节点ID")
    server_name = String(description="节点名称")
    online = Boolean(description="是否在线")
    session_start = String(description="会话开始时间")
    last_seen = String(description="最后在线时间")
    duration_seconds = Int(description="会话时长(秒)")


class Player(ObjectType):
    """玩家信息"""
    player_name = String(description="玩家名称")
    online = Boolean(description="是否在线")
    session_start = String(description="会话开始时间")
    last_seen = String(description="最后在线时间")
    duration_seconds = Int(description="会话时长(秒)")
    servers = List(PlayerServerEntry, description="各节点状态")


class PlayerSession(ObjectType):
    """玩家会话历史"""
    session_start = String(description="会话开始时间")
    session_end = String(description="会话结束时间")
    duration_seconds = Int(description="会话时长(秒)")
    server_id = Int(description="节点ID")
    server_name = String(description="节点名称")


class PlayerDetail(ObjectType):
    """玩家详细信息"""
    player_name = String(description="玩家名称")
    online = Boolean(description="当前是否在线")
    first_seen = String(description="首次出现时间")
    last_seen = String(description="最后在线时间")
    total_playtime_seconds = Int(description="总在线时长(秒)")
    sessions = List(PlayerSession, description="会话历史")


# ==================== 查询根类型 ====================

class Query(ObjectType):
    """GraphQL 查询根类型"""
    
    # 节点查询
    nodes = List(
        Node,
        enabled_only=Boolean(default_value=True, description="仅返回已启用节点"),
        description="获取所有节点列表"
    )
    
    node = Field(
        Node,
        id=Int(required=True, description="节点ID"),
        description="获取单个节点"
    )
    
    # 服务器聚合查询
    server_head = Field(
        ServerHead,
        description="获取服务器实时聚合状态"
    )
    
    server_history = List(
        ServerHistoryRecord,
        hours=Int(default_value=12, description="时间范围(小时), 1-720"),
        description="获取服务器聚合历史"
    )
    
    server_stats = Field(
        ServerStats,
        hours=Int(default_value=24, description="时间范围(小时), 1-720"),
        description="获取服务器统计信息"
    )
    
    server_uptime = Field(
        UptimeInfo,
        hours=Int(default_value=24, description="时间范围(小时), 1-720"),
        description="获取服务器在线率"
    )
    
    # 玩家查询
    players = List(
        Player,
        online_only=Boolean(default_value=False, description="仅返回在线玩家"),
        description="获取玩家列表"
    )
    
    player = Field(
        PlayerDetail,
        name=String(required=True, description="玩家名称"),
        days=Int(default_value=30, description="历史天数"),
        description="获取玩家详情"
    )
    
    online_players = List(
        Player,
        description="获取当前在线玩家列表"
    )
    
    # Resolvers
    def resolve_nodes(self, info, enabled_only=True):
        poller = info.context.get('poller')
        if not poller:
            return []
        
        nodes_data = get_server_nodes_data(poller)
        if enabled_only:
            nodes_data = [n for n in nodes_data if n.get('enabled', True)]
        
        result = []
        for node in nodes_data:
            # 计算 24h 延迟统计
            history = poller.db.get_server_history(node['id'], limit=poller.get_24h_limit())
            history = filter_history_by_time(history, 24)
            stats = calculate_latency_stats(history) if history else {}
            
            latest = node.get('latest_status')
            latest_status = None
            if latest:
                latest_status = NodeStatus(
                    id=latest.get('id'),
                    server_id=latest.get('server_id'),
                    timestamp=latest.get('timestamp'),
                    online=latest.get('online'),
                    latency=latest.get('latency'),
                    players_online=latest.get('players_online'),
                    players_max=latest.get('players_max'),
                    version=latest.get('version'),
                    motd=latest.get('motd'),
                    sample_players=latest.get('sample_players'),
                    software=latest.get('software'),
                    plugins=latest.get('plugins'),
                    map_name=latest.get('map')
                )
            
            result.append(Node(
                id=node['id'],
                name=node['name'],
                host=node['host'],
                port=node['port'],
                color=node.get('color'),
                enabled=node.get('enabled', True),
                latest_status=latest_status,
                latency_stats=LatencyStats(**stats) if stats else None
            ))
        
        return result
    
    def resolve_node(self, info, id):
        poller = info.context.get('poller')
        if not poller:
            return None
        
        nodes_data = get_server_nodes_data(poller)
        node = next((n for n in nodes_data if n['id'] == id), None)
        if not node:
            return None
        
        # 计算 24h 延迟统计
        history = poller.db.get_server_history(node['id'], limit=poller.get_24h_limit())
        history = filter_history_by_time(history, 24)
        stats = calculate_latency_stats(history) if history else {}
        
        latest = node.get('latest_status')
        latest_status = None
        if latest:
            latest_status = NodeStatus(
                id=latest.get('id'),
                server_id=latest.get('server_id'),
                timestamp=latest.get('timestamp'),
                online=latest.get('online'),
                latency=latest.get('latency'),
                players_online=latest.get('players_online'),
                players_max=latest.get('players_max'),
                version=latest.get('version'),
                motd=latest.get('motd'),
                sample_players=latest.get('sample_players'),
                software=latest.get('software'),
                plugins=latest.get('plugins'),
                map_name=latest.get('map')
            )
        
        return Node(
            id=node['id'],
            name=node['name'],
            host=node['host'],
            port=node['port'],
            color=node.get('color'),
            enabled=node.get('enabled', True),
            latest_status=latest_status,
            latency_stats=LatencyStats(**stats) if stats else None
        )
    
    def resolve_server_head(self, info):
        poller = info.context.get('poller')
        if not poller:
            return None
        
        nodes_data = get_server_nodes_data(poller)
        enabled_nodes = [n for n in nodes_data if n.get('enabled', True)]
        nodes_with_status = [n for n in enabled_nodes if n.get('latest_status')]
        
        if not nodes_with_status:
            return ServerHead(nodes=[])
        
        online_nodes = [n for n in nodes_with_status if n['latest_status'].get('online')]
        selected = online_nodes[0] if online_nodes else nodes_with_status[0]
        selected_status = selected['latest_status']
        
        latencies = [
            LatencyMap(
                node_name=n['name'],
                latency=n['latest_status'].get('latency') if n['latest_status'].get('online') else None
            )
            for n in nodes_with_status
        ]
        
        # 构建节点列表
        nodes = []
        for n in nodes_with_status:
            latest = n.get('latest_status')
            latest_status = None
            if latest:
                latest_status = NodeStatus(
                    id=latest.get('id'),
                    server_id=latest.get('server_id'),
                    timestamp=latest.get('timestamp'),
                    online=latest.get('online'),
                    latency=latest.get('latency'),
                    players_online=latest.get('players_online'),
                    players_max=latest.get('players_max'),
                    version=latest.get('version'),
                    motd=latest.get('motd'),
                    sample_players=latest.get('sample_players'),
                    software=latest.get('software'),
                    plugins=latest.get('plugins'),
                    map_name=latest.get('map')
                )
            
            nodes.append(Node(
                id=n['id'],
                name=n['name'],
                host=n['host'],
                port=n['port'],
                color=n.get('color'),
                enabled=n.get('enabled', True),
                latest_status=latest_status
            ))
        
        return ServerHead(
            timestamp=selected_status.get('timestamp'),
            online=any(n['latest_status'].get('online') for n in nodes_with_status),
            players_online=selected_status.get('players_online'),
            players_max=selected_status.get('players_max'),
            version=selected_status.get('version'),
            motd=selected_status.get('motd'),
            latencies=latencies,
            nodes=nodes
        )
    
    def resolve_server_history(self, info, hours=12):
        poller = info.context.get('poller')
        if not poller:
            return []
        
        hours = max(1, min(hours, 720))
        poll_interval = poller.config.get('poll_interval', 60)
        limit = max(1, int(hours * 3600 / poll_interval))
        
        nodes_data = get_server_nodes_data(poller)
        servers = [n for n in nodes_data if n.get('enabled', True)]
        if not servers:
            return []
        
        nodes_history = {}
        for server in servers:
            history_raw = poller.db.get_server_history(server['id'], limit=limit)
            history = filter_history_by_time(history_raw, hours)
            nodes_history[server['name']] = history
        
        all_histories = {}
        for node_name, history in nodes_history.items():
            for record in history:
                timestamp = record['timestamp']
                if timestamp not in all_histories:
                    all_histories[timestamp] = {'timestamp': timestamp, 'nodes': {}}
                all_histories[timestamp]['nodes'][node_name] = record
        
        result = []
        for timestamp in sorted(all_histories.keys()):
            data = all_histories[timestamp]
            nodes_data_inner = data['nodes']
            
            selected_record = select_representative_record(list(nodes_data_inner.values()))
            latencies = [
                LatencyMap(
                    node_name=node_name,
                    latency=record.get('latency') if record['online'] else None
                )
                for node_name, record in nodes_data_inner.items()
            ]
            
            result.append(ServerHistoryRecord(
                timestamp=timestamp,
                online=any(r['online'] for r in nodes_data_inner.values()),
                players_online=selected_record.get('players_online') if selected_record else None,
                players_max=selected_record.get('players_max') if selected_record else None,
                version=selected_record.get('version') if selected_record else None,
                motd=selected_record.get('motd') if selected_record else None,
                latencies=latencies
            ))
        
        return result
    
    def resolve_server_stats(self, info, hours=24):
        poller = info.context.get('poller')
        if not poller:
            return None
        
        hours = max(1, min(hours, 720))
        poll_interval = poller.config.get('poll_interval', 60)
        limit = max(1, int(hours * 3600 / poll_interval))
        
        nodes_data = get_server_nodes_data(poller)
        servers = [n for n in nodes_data if n.get('enabled', True)]
        if not servers:
            return ServerStats(uptime_percentage=0, total_checks=0, online_checks=0)
        
        timestamp_status = defaultdict(list)
        all_latencies = []
        
        for server in servers:
            history_raw = poller.db.get_server_history(server['id'], limit=limit)
            history = filter_history_by_time(history_raw, hours)
            for h in history:
                timestamp_status[h['timestamp']].append(h['online'])
                if h['online'] and h['latency'] is not None:
                    all_latencies.append(h['latency'])
        
        total_checks = len(timestamp_status)
        online_checks = sum(1 for statuses in timestamp_status.values() if any(statuses))
        uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0
        
        stats = calculate_latency_stats([{'online': True, 'latency': lat} for lat in all_latencies]) if all_latencies else {}
        
        return ServerStats(
            uptime_percentage=round(uptime_percentage, 2),
            avg_latency=stats.get('avg_latency'),
            std_dev=stats.get('std_dev'),
            min_latency=stats.get('min_latency'),
            max_latency=stats.get('max_latency'),
            p95_latency=stats.get('p95_latency'),
            cv=stats.get('cv'),
            total_checks=total_checks,
            online_checks=online_checks
        )
    
    def resolve_server_uptime(self, info, hours=24):
        poller = info.context.get('poller')
        if not poller:
            return None
        
        hours = max(1, min(hours, 720))
        poll_interval = poller.config.get('poll_interval', 60)
        limit = max(1, int(hours * 3600 / poll_interval))
        
        nodes_data = get_server_nodes_data(poller)
        servers = [n for n in nodes_data if n.get('enabled', True)]
        if not servers:
            return UptimeInfo(uptime_percentage=0, total_checks=0, online_checks=0)
        
        timestamp_status = defaultdict(list)
        
        for server in servers:
            history_raw = poller.db.get_server_history(server['id'], limit=limit)
            history = filter_history_by_time(history_raw, hours)
            for h in history:
                timestamp_status[h['timestamp']].append(h['online'])
        
        total_checks = len(timestamp_status)
        online_checks = sum(1 for statuses in timestamp_status.values() if any(statuses))
        uptime_percentage = (online_checks / total_checks * 100) if total_checks > 0 else 0
        
        return UptimeInfo(
            uptime_percentage=round(uptime_percentage, 2),
            total_checks=total_checks,
            online_checks=online_checks
        )
    
    def resolve_players(self, info, online_only=False):
        poller = info.context.get('poller')
        if not poller:
            return []
        
        all_player_names = poller.db.get_all_player_names()
        servers = poller.db.get_all_servers()
        aggregated = {}
        
        for server in servers:
            sessions = poller.db.get_all_player_sessions(server['id'])
            for s in sessions:
                name = s.get('player_name')
                if not name:
                    continue
                
                start_dt = parse_dt(s.get('session_start'))
                last_dt = parse_dt(s.get('last_seen'))
                duration_seconds = s.get('duration_seconds') if s.get('online') else None
                
                server_entry = PlayerServerEntry(
                    server_id=server['id'],
                    server_name=server['name'],
                    online=s.get('online'),
                    session_start=start_dt.isoformat() if start_dt else None,
                    last_seen=last_dt.isoformat() if last_dt else None,
                    duration_seconds=duration_seconds
                )
                
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
                    
                    if last_dt and (agg['last_seen_dt'] is None or last_dt > agg['last_seen_dt']):
                        agg['last_seen_dt'] = last_dt
                        agg['last_seen'] = last_dt.isoformat()
                    
                    if s.get('online') and duration_seconds is not None:
                        if agg['duration_seconds'] is None or duration_seconds > agg['duration_seconds']:
                            agg['duration_seconds'] = duration_seconds
        
        # 添加历史玩家
        for player_name in all_player_names:
            if player_name not in aggregated:
                aggregated[player_name] = {
                    'player_name': player_name,
                    'online': False,
                    'session_start': None,
                    'last_seen': None,
                    'last_seen_dt': None,
                    'duration_seconds': None,
                    'servers': []
                }
        
        result = []
        for name, data in aggregated.items():
            if online_only and not data['online']:
                continue
            result.append(Player(
                player_name=data['player_name'],
                online=data['online'],
                session_start=data['session_start'],
                last_seen=data['last_seen'],
                duration_seconds=data['duration_seconds'],
                servers=data['servers']
            ))
        
        # 按最后在线时间排序
        result.sort(key=lambda x: x.last_seen or '', reverse=True)
        return result
    
    def resolve_online_players(self, info):
        return self.resolve_players(info, online_only=True)
    
    def resolve_player(self, info, name, days=30):
        poller = info.context.get('poller')
        if not poller:
            return None
        
        history = poller.db.get_player_history(name, days=days)
        if not history:
            return None
        
        servers = {s['id']: s['name'] for s in poller.db.get_all_servers()}
        
        sessions = []
        total_playtime = 0
        first_seen = None
        last_seen = None
        online = False
        
        for h in history:
            start_dt = parse_dt(h.get('session_start'))
            end_dt = parse_dt(h.get('session_end'))
            duration = h.get('duration_seconds', 0) or 0
            
            if start_dt:
                if first_seen is None or start_dt < first_seen:
                    first_seen = start_dt
            if end_dt:
                if last_seen is None or end_dt > last_seen:
                    last_seen = end_dt
            
            total_playtime += duration
            
            sessions.append(PlayerSession(
                session_start=start_dt.isoformat() if start_dt else None,
                session_end=end_dt.isoformat() if end_dt else None,
                duration_seconds=duration,
                server_id=h.get('server_id'),
                server_name=servers.get(h.get('server_id'), 'Unknown')
            ))
        
        # 检查是否当前在线
        for server in poller.db.get_all_servers():
            all_sessions = poller.db.get_all_player_sessions(server['id'])
            for s in all_sessions:
                if s.get('player_name') == name and s.get('online'):
                    online = True
                    break
        
        return PlayerDetail(
            player_name=name,
            online=online,
            first_seen=first_seen.isoformat() if first_seen else None,
            last_seen=last_seen.isoformat() if last_seen else None,
            total_playtime_seconds=total_playtime,
            sessions=sessions
        )


# 创建 Schema
schema = graphene.Schema(query=Query)
