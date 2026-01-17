"""API 响应模型定义

为 Swagger 文档提供响应示例值。
"""
from flask_restx import fields


def create_api_models(ns):
    """
    创建 API 响应模型
    
    Args:
        ns: Flask-RESTX Namespace
        
    Returns:
        dict: 模型字典
    """
    models = {}
    
    # ==================== 通用模型 ====================
    
    models['latency_stats'] = ns.model('LatencyStats', {
        'uptime_percentage': fields.Float(
            description='在线率百分比',
            example=99.5
        ),
        'avg_latency': fields.Float(
            description='平均延迟(ms)',
            example=35.2
        ),
        'std_dev': fields.Float(
            description='延迟标准差(ms)',
            example=8.5
        ),
        'min_latency': fields.Float(
            description='最小延迟(ms)',
            example=15.0
        ),
        'max_latency': fields.Float(
            description='最大延迟(ms)',
            example=120.0
        ),
        'p95_latency': fields.Float(
            description='P95延迟(ms)',
            example=55.0
        ),
        'cv': fields.Float(
            description='变异系数(%)',
            example=24.1
        ),
        'total_checks': fields.Integer(
            description='总检查次数',
            example=5760
        ),
        'online_checks': fields.Integer(
            description='在线次数',
            example=5732
        )
    })
    
    # ==================== 节点模型 ====================
    
    models['node_status'] = ns.model('NodeStatus', {
        'id': fields.Integer(description='状态记录ID', example=12345),
        'server_id': fields.Integer(description='节点ID', example=1),
        'timestamp': fields.String(description='记录时间', example='2026-01-17T15:30:00'),
        'online': fields.Boolean(description='是否在线', example=True),
        'latency': fields.Float(description='延迟(ms)', example=35.2),
        'players_online': fields.Integer(description='在线玩家数', example=42),
        'players_max': fields.Integer(description='最大玩家数', example=100),
        'version': fields.String(description='服务器版本', example='Paper 1.20.4'),
        'motd': fields.String(description='服务器MOTD', example='§aPoiCraft §7- §e欢迎加入!'),
        'sample_players': fields.List(fields.String, description='玩家列表样本', example=['Steve', 'Alex']),
        'software': fields.String(description='服务端软件', example='Paper'),
        'plugins': fields.List(fields.String, description='插件列表', example=['EssentialsX', 'WorldEdit']),
        'map': fields.String(description='地图名称', example='world')
    })
    
    models['node_info'] = ns.model('NodeInfo', {
        'id': fields.Integer(description='节点ID', example=1),
        'name': fields.String(description='节点名称', example='主线入口'),
        'host': fields.String(description='服务器地址', example='play.example.com'),
        'port': fields.Integer(description='服务器端口', example=25565),
        'color': fields.String(description='节点颜色', example='#10b981')
    })
    
    models['node_head'] = ns.model('NodeHead', {
        'id': fields.Integer(description='节点ID', example=1),
        'name': fields.String(description='节点名称', example='主线入口'),
        'host': fields.String(description='服务器地址', example='play.example.com'),
        'port': fields.Integer(description='服务器端口', example=25565),
        'color': fields.String(description='节点颜色', example='#10b981'),
        'enabled': fields.Boolean(description='是否启用', example=True),
        'latest_status': fields.Nested(models['node_status'], description='最新状态', allow_null=True)
    })
    
    models['node_history_record'] = ns.model('NodeHistoryRecord', {
        'timestamp': fields.String(description='记录时间', example='2026-01-17T15:30:00'),
        'online': fields.Boolean(description='是否在线', example=True),
        'latency': fields.Float(description='延迟(ms)', example=35.2),
        'players_online': fields.Integer(description='在线玩家数', example=42),
        'players_max': fields.Integer(description='最大玩家数', example=100),
        'version': fields.String(description='服务器版本', example='Paper 1.20.4'),
        'motd': fields.String(description='MOTD', example='§aPoiCraft')
    })
    
    models['node_history_compact'] = ns.model('NodeHistoryCompact', {
        'timestamps': fields.List(fields.String, description='时间戳列表', example=['2026-01-17T15:00:00', '2026-01-17T15:00:15']),
        'online': fields.List(fields.Boolean, description='在线状态列表', example=[True, True]),
        'latency': fields.List(fields.Float, description='延迟列表(ms)', example=[35.2, 38.1]),
        'players': fields.List(fields.Integer, description='玩家数列表', example=[42, 43])
    })
    
    models['uptime_info'] = ns.model('UptimeInfo', {
        'uptime_percentage': fields.Float(description='在线率百分比', example=99.5),
        'total_checks': fields.Integer(description='总检查次数', example=5760),
        'online_checks': fields.Integer(description='在线次数', example=5732)
    })
    
    models['status_timeline_record'] = ns.model('StatusTimelineRecord', {
        'timestamp': fields.String(description='时间戳', example='2026-01-17T15:00:00'),
        'online': fields.Boolean(description='是否在线', example=True),
        'latency': fields.Float(description='延迟(ms)', example=35.2, allow_null=True)
    })
    
    # ==================== 玩家模型 ====================
    
    models['player_online'] = ns.model('PlayerOnline', {
        'player_name': fields.String(description='玩家名称', example='Steve'),
        'online': fields.Boolean(description='是否在线', example=True),
        'session_start': fields.String(description='会话开始时间', example='2026-01-17T14:00:00'),
        'last_seen': fields.String(description='最后在线时间', example='2026-01-17T15:30:00'),
        'duration_seconds': fields.Integer(description='会话时长(秒)', example=5400)
    })
    
    models['player_server_entry'] = ns.model('PlayerServerEntry', {
        'server_id': fields.Integer(description='节点ID', example=1),
        'server_name': fields.String(description='节点名称', example='主线入口'),
        'online': fields.Boolean(description='是否在线', example=True),
        'session_start': fields.String(description='会话开始时间', example='2026-01-17T14:00:00'),
        'last_seen': fields.String(description='最后在线时间', example='2026-01-17T15:30:00'),
        'duration_seconds': fields.Integer(description='会话时长(秒)', example=5400)
    })
    
    models['player_aggregated'] = ns.model('PlayerAggregated', {
        'player_name': fields.String(description='玩家名称', example='Steve'),
        'online': fields.Boolean(description='是否在线', example=True),
        'session_start': fields.String(description='会话开始时间', example='2026-01-17T14:00:00'),
        'last_seen': fields.String(description='最后在线时间', example='2026-01-17T15:30:00'),
        'duration_seconds': fields.Integer(description='会话时长(秒)', example=5400),
        'servers': fields.List(fields.Nested(models['player_server_entry']), description='节点会话列表')
    })
    
    models['player_detail'] = ns.model('PlayerDetail', {
        'player_name': fields.String(description='玩家名称', example='Steve'),
        'online': fields.Boolean(description='是否在线', example=True),
        'session_start': fields.String(description='会话开始时间', example='2026-01-17T14:00:00'),
        'last_seen': fields.String(description='最后在线时间', example='2026-01-17T15:30:00'),
        'duration_seconds': fields.Integer(description='当前会话时长(秒)', example=5400)
    })
    
    models['player_session'] = ns.model('PlayerSession', {
        'session_start': fields.String(description='会话开始时间', example='2026-01-17T14:00:00'),
        'session_end': fields.String(description='会话结束时间', example='2026-01-17T16:30:00'),
        'duration_seconds': fields.Integer(description='会话时长(秒)', example=9000),
        'server_id': fields.Integer(description='节点ID', example=1),
        'server_name': fields.String(description='节点名称', example='主线入口')
    })
    
    models['player_daily_stats'] = ns.model('PlayerDailyStats', {
        'date': fields.String(description='日期', example='2026-01-17'),
        'total_playtime': fields.Integer(description='当日游戏时长(秒)', example=14400),
        'session_count': fields.Integer(description='会话次数', example=3)
    })
    
    models['player_sessions_response'] = ns.model('PlayerSessionsResponse', {
        'heatmap': fields.List(fields.Nested(models['player_daily_stats']), description='热力图数据'),
        'sessions': fields.List(fields.Nested(models['player_session']), description='会话列表'),
        'stats': fields.Raw(description='统计信息', example={
            'total_sessions': 25,
            'total_playtime': 360000,
            'avg_session_duration': 14400,
            'days_active': 15
        })
    })
    
    models['player_weekly_stats'] = ns.model('PlayerWeeklyStats', {
        'week_start': fields.String(description='周起始日期', example='2026-01-13'),
        'week_end': fields.String(description='周结束日期', example='2026-01-19'),
        'total_playtime': fields.Integer(description='周游戏时长(秒)', example=50400),
        'session_count': fields.Integer(description='会话次数', example=12),
        'days_active': fields.Integer(description='活跃天数', example=5)
    })
    
    # ==================== 服务器聚合模型 ====================
    
    models['server_node_with_stats'] = ns.model('ServerNodeWithStats', {
        'id': fields.Integer(description='节点ID', example=1),
        'name': fields.String(description='节点名称', example='主线入口'),
        'host': fields.String(description='服务器地址', example='play.example.com'),
        'port': fields.Integer(description='服务器端口', example=25565),
        'color': fields.String(description='节点颜色', example='#10b981'),
        'enabled': fields.Boolean(description='是否启用', example=True),
        'latest_status': fields.Nested(models['node_status'], description='最新状态', allow_null=True),
        'latency_stats': fields.Nested(models['latency_stats'], description='24h延迟统计')
    })
    
    models['server_head'] = ns.model('ServerHead', {
        'timestamp': fields.String(description='数据时间', example='2026-01-17T15:30:00'),
        'online': fields.Boolean(description='服务器是否在线', example=True),
        'players_online': fields.Integer(description='在线玩家数', example=42),
        'players_max': fields.Integer(description='最大玩家数', example=100),
        'latencies': fields.Raw(description='各节点延迟', example={'主线入口': 35.2, '备用线路': 42.1}),
        'version': fields.String(description='服务器版本', example='Paper 1.20.4'),
        'motd': fields.String(description='MOTD', example='§aPoiCraft'),
        'nodes': fields.List(fields.Raw, description='节点状态列表')
    })
    
    models['server_history_record'] = ns.model('ServerHistoryRecord', {
        'timestamp': fields.String(description='记录时间', example='2026-01-17T15:30:00'),
        'online': fields.Boolean(description='是否在线', example=True),
        'players_online': fields.Integer(description='在线玩家数', example=42),
        'players_max': fields.Integer(description='最大玩家数', example=100),
        'latencies': fields.Raw(description='各节点延迟', example={'主线入口': 35.2, '备用线路': 42.1}),
        'version': fields.String(description='服务器版本', example='Paper 1.20.4'),
        'motd': fields.String(description='MOTD', example='§aPoiCraft')
    })
    
    models['server_history_compact'] = ns.model('ServerHistoryCompact', {
        'timestamps': fields.List(fields.String, description='时间戳列表', example=['2026-01-17T15:00:00', '2026-01-17T15:00:15']),
        'online': fields.List(fields.Boolean, description='在线状态列表', example=[True, True]),
        'players_online': fields.List(fields.Integer, description='玩家数列表', example=[42, 43]),
        'players_max': fields.List(fields.Integer, description='最大玩家数列表', example=[100, 100]),
        'latencies': fields.Raw(description='各节点延迟列表', example={'主线入口': [35.2, 38.1], '备用线路': [42.1, 40.5]})
    })
    
    models['server_stats'] = ns.model('ServerStats', {
        'uptime_percentage': fields.Float(description='在线率百分比', example=99.5),
        'avg_latency': fields.Float(description='平均延迟(ms)', example=35.2),
        'total_checks': fields.Integer(description='总检查次数', example=5760),
        'online_checks': fields.Integer(description='在线次数', example=5732)
    })
    
    models['server_config'] = ns.model('ServerConfig', {
        'poll_interval': fields.Integer(description='轮询间隔(秒)', example=15),
        'server_name': fields.String(description='服务器名称', example='PoiCraft')
    })
    
    models['server_player'] = ns.model('ServerPlayer', {
        'server_id': fields.Integer(description='节点ID', example=1),
        'server_name': fields.String(description='节点名称', example='主线入口'),
        'player_name': fields.String(description='玩家名称', example='Steve'),
        'online': fields.Boolean(description='是否在线', example=True),
        'session_start': fields.String(description='会话开始时间', example='2026-01-17T14:00:00'),
        'last_seen': fields.String(description='最后在线时间', example='2026-01-17T15:30:00'),
        'duration_seconds': fields.Integer(description='会话时长(秒)', example=5400)
    })
    
    return models


def get_node_models(ns):
    """获取节点 API 模型"""
    return create_api_models(ns)


def get_server_models(ns):
    """获取服务器 API 模型"""
    return create_api_models(ns)


def get_player_models(ns):
    """获取玩家 API 模型"""
    models = create_api_models(ns)
    
    # 添加 player_sessions 模型
    models['heatmap_entry'] = ns.model('HeatmapEntry', {
        'date': fields.String(description='日期', example='2026-01-17'),
        'hour': fields.Integer(description='小时(0-23)', example=14),
        'seconds': fields.Float(description='该时段游戏时长(秒)', example=1800.0)
    })
    
    models['daily_session'] = ns.model('DailySession', {
        'start': fields.String(description='会话开始时间', example='2026-01-17T14:00:00'),
        'end': fields.String(description='会话结束时间', example='2026-01-17T16:00:00'),
        'server_name': fields.String(description='节点分组', example='默认')
    })
    
    models['daily_entry'] = ns.model('DailyEntry', {
        'date': fields.String(description='日期', example='2026-01-17'),
        'total_seconds': fields.Float(description='当日总游戏时长(秒)', example=7200.0),
        'sessions': fields.List(fields.Nested(models['daily_session']), description='会话列表')
    })
    
    models['hourly_avg'] = ns.model('HourlyAverage', {
        'hour': fields.Integer(description='小时(0-23)', example=20),
        'avg_seconds': fields.Float(description='平均游戏时长(秒)', example=1200.0)
    })
    
    models['player_sessions'] = ns.model('PlayerSessions', {
        'days': fields.Integer(description='查询天数', example=30),
        'player_online': fields.Boolean(description='玩家当前是否在线', example=True),
        'heatmap': fields.List(fields.Nested(models['heatmap_entry']), description='热力图数据'),
        'daily': fields.List(fields.Nested(models['daily_entry']), description='每日会话数据'),
        'average_daily_seconds': fields.Float(description='日均游戏时长(秒)', example=7200.0),
        'average_session_seconds': fields.Float(description='平均单次会话时长(秒)', example=3600.0),
        'hourly_average': fields.List(fields.Nested(models['hourly_avg']), description='每小时平均游戏时长')
    })
    
    models['weekly_heatmap_entry'] = ns.model('WeeklyHeatmapEntry', {
        'day': fields.Integer(description='星期几(0=周一,6=周日)', example=5),
        'day_name': fields.String(description='星期名称', example='周六'),
        'hour': fields.Integer(description='小时(0-23)', example=20),
        'avg_seconds': fields.Float(description='平均游戏时长(秒)', example=1800.0),
        'sample_days': fields.Integer(description='样本天数', example=4)
    })
    
    models['weekday_preference'] = ns.model('WeekdayPreference', {
        'day': fields.Integer(description='星期几(0=周一,6=周日)', example=5),
        'day_name': fields.String(description='星期名称', example='周六'),
        'avg_seconds': fields.Float(description='平均游戏时长(秒)', example=14400.0),
        'sample_days': fields.Integer(description='样本天数', example=4)
    })
    
    models['player_weekly_stats'] = ns.model('PlayerWeeklyStatsResponse', {
        'player_name': fields.String(description='玩家名称', example='Steve'),
        'total_sample_days': fields.Integer(description='总样本天数', example=30),
        'weekly_heatmap': fields.List(fields.Nested(models['weekly_heatmap_entry']), description='周热力图数据'),
        'weekday_preference': fields.List(fields.Nested(models['weekday_preference']), description='星期偏好数据')
    })
    
    return models


def get_web_models(ns):
    """获取 Web API 模型"""
    models = create_api_models(ns)
    
    # 服务器历史紧凑格式
    models['server_history_compact'] = ns.model('ServerHistoryCompact', {
        'timestamps': fields.List(fields.String, description='时间戳列表', example=['2026-01-17T15:00:00', '2026-01-17T15:00:15']),
        'online': fields.List(fields.Boolean, description='在线状态列表', example=[True, True]),
        'players_online': fields.List(fields.Integer, description='玩家数列表', example=[42, 43]),
        'players_max': fields.List(fields.Integer, description='最大玩家数列表', example=[100, 100]),
        'latencies': fields.Raw(description='各节点延迟列表', example={'主线入口': [35.2, 38.1], '备用线路': [42.1, 40.5]})
    })
    
    # Web 前端服务器完整数据
    models['web_server_full'] = ns.model('WebServerFull', {
        'nodes': fields.List(fields.Raw, description='所有节点信息'),
        'stats_by_id': fields.Raw(description='各节点统计数据', example={1: {'uptime_percentage': 99.5, 'avg_latency': 35.2}}),
        'history': fields.Nested(models['server_history_compact'], description='聚合历史数据'),
        'uptime': fields.Nested(models['uptime_info'], description='24h在线率'),
        'status_timeline': fields.List(fields.Raw, description='状态时间线'),
        'players': fields.List(fields.Raw, description='在线玩家列表'),
        'head': fields.Nested(models['server_head'], description='聚合实时状态'),
        'config': fields.Nested(models['server_config'], description='服务器配置')
    })
    
    # Web 前端服务器增量数据
    models['web_server_head'] = ns.model('WebServerHead', {
        'nodes': fields.List(fields.Raw, description='所有节点信息'),
        'stats_by_id': fields.Raw(description='各节点统计数据'),
        'latest_history_point': fields.Raw(description='最新历史数据点', allow_null=True),
        'uptime': fields.Nested(models['uptime_info'], description='24h在线率'),
        'status_timeline': fields.List(fields.Raw, description='状态时间线'),
        'players': fields.List(fields.Raw, description='在线玩家列表'),
        'head': fields.Nested(models['server_head'], description='聚合实时状态'),
        'config': fields.Nested(models['server_config'], description='服务器配置')
    })
    
    # Web 前端节点完整数据
    models['web_node_full'] = ns.model('WebNodeFull', {
        'server': fields.Raw(description='节点信息（含latest_status）'),
        'history': fields.Nested(models['node_history_compact'], description='历史数据'),
        'stats': fields.Nested(models['latency_stats'], description='统计数据', allow_null=True),
        'status_timeline': fields.List(fields.Raw, description='状态时间线'),
        'config': fields.Raw(description='配置信息', example={'poll_interval': 15})
    })
    
    # Web 前端节点增量数据
    models['web_node_head'] = ns.model('WebNodeHead', {
        'server': fields.Raw(description='节点信息'),
        'stats': fields.Nested(models['latency_stats'], description='统计数据', allow_null=True),
        'latest_history_point': fields.Raw(description='最新历史数据点', allow_null=True),
        'status_timeline': fields.List(fields.Raw, description='状态时间线'),
        'config': fields.Raw(description='配置信息', example={'poll_interval': 15})
    })
    
    return models
