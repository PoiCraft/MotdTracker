from datetime import datetime, timedelta
from flask import request
from flask_restx import Namespace, Resource
from app_utils import utc8_now
from app_utils import parse_dt


def register_player_routes(api, poller):
    player_ns = Namespace("player", description="玩家相关接口", path="/player")

    @player_ns.route("")
    class AllPlayers(Resource):
        @player_ns.doc(
            "获取玩家列表",
            description="获取所有玩家的汇总列表（包括历史玩家），包含所有节点的玩家数据",
        )
        def get(self):
            # 获取所有玩家名字（包括历史）
            all_player_names = poller.db.get_all_player_names()
            servers = poller.db.get_all_servers()
            aggregated = {}

            # 首先收集当前会话中的玩家信息
            for server in servers:
                sessions = poller.db.get_all_player_sessions(server["id"])
                for s in sessions:
                    name = s.get("player_name")
                    if not name:
                        continue
                    start_dt = parse_dt(s.get("session_start"))
                    last_dt = parse_dt(s.get("last_seen"))
                    duration_seconds = (
                        s.get("duration_seconds") if s.get("online") else None
                    )

                    server_entry = {
                        "server_id": server["id"],
                        "server_name": server["name"],
                        "online": s.get("online"),
                        "session_start": start_dt.isoformat() if start_dt else None,
                        "last_seen": last_dt.isoformat() if last_dt else None,
                        "last_seen_dt": last_dt,
                        "duration_seconds": duration_seconds,
                    }

                    if name not in aggregated:
                        aggregated[name] = {
                            "player_name": name,
                            "online": bool(s.get("online")),
                            "session_start": start_dt.isoformat()
                            if s.get("online") and start_dt
                            else None,
                            "last_seen": last_dt.isoformat() if last_dt else None,
                            "last_seen_dt": last_dt,
                            "duration_seconds": duration_seconds
                            if s.get("online")
                            else None,
                            "servers": [server_entry],
                        }
                    else:
                        agg = aggregated[name]
                        agg["servers"].append(server_entry)
                        agg["online"] = agg["online"] or bool(s.get("online"))

                        if last_dt and (
                            agg["last_seen_dt"] is None or last_dt > agg["last_seen_dt"]
                        ):
                            agg["last_seen_dt"] = last_dt
                            agg["last_seen"] = last_dt.isoformat()

                        if s.get("online"):
                            if start_dt:
                                if agg["session_start"] is None:
                                    agg["session_start"] = start_dt.isoformat()
                                else:
                                    try:
                                        agg_start = datetime.fromisoformat(
                                            agg["session_start"]
                                        )
                                        if start_dt < agg_start:
                                            agg["session_start"] = start_dt.isoformat()
                                    except Exception:
                                        agg["session_start"] = start_dt.isoformat()

                            if duration_seconds is not None:
                                if (
                                    agg["duration_seconds"] is None
                                    or duration_seconds > agg["duration_seconds"]
                                ):
                                    agg["duration_seconds"] = duration_seconds

            # 为没有当前会话的玩家添加占位符（仅显示在列表中，但标记为离线）
            for player_name in all_player_names:
                if player_name not in aggregated:
                    aggregated[player_name] = {
                        "player_name": player_name,
                        "online": False,
                        "session_start": None,
                        "last_seen": None,
                        "last_seen_dt": None,
                        "duration_seconds": None,
                        "servers": [],
                    }

            players = list(aggregated.values())
            # 排序逻辑：
            # 1. 在线玩家优先
            # 2. 在线玩家按字母顺序排序
            # 3. 离线玩家按最后在线时间（last_seen）降序排序
            players.sort(
                key=lambda x: (
                    not x["online"],  # 在线玩家在前
                    x["player_name"].lower() if x["online"] else "",  # 在线玩家按字母排序，离线玩家此键为空字符串（会被忽略）
                    -(x["last_seen_dt"].timestamp() if not x["online"] and x["last_seen_dt"] else float("-inf")),  # 离线玩家按最后在线时间降序，无记录的排在最后
                )
            )

            for p in players:
                p.pop("last_seen_dt", None)
                for s in p["servers"]:
                    s.pop("last_seen_dt", None)

            return players

    @player_ns.route("/<string:player_name>/detail")
    class PlayerDetail(Resource):
        @player_ns.doc(
            "获取玩家详情",
            description="获取指定玩家的详细信息，包括当前在线状态、连接节点等",
        )
        def get(self, player_name):
            servers = poller.db.get_all_servers()

            player_online = False
            earliest_session_start = None
            latest_last_seen = None
            max_duration = None

            for server in servers:
                all_sessions = poller.db.get_all_player_sessions(server["id"])
                online_sessions = [
                    s
                    for s in all_sessions
                    if s.get("online") and s.get("player_name") == player_name
                ]
                player_sessions = [
                    s for s in all_sessions if s.get("player_name") == player_name
                ]

                if not player_sessions:
                    continue

                if online_sessions:
                    player_online = True
                    for s in online_sessions:
                        start_dt = parse_dt(s.get("session_start"))
                        if start_dt:
                            if (
                                earliest_session_start is None
                                or start_dt < earliest_session_start
                            ):
                                earliest_session_start = start_dt
                            if s.get("duration_seconds") is not None:
                                if (
                                    max_duration is None
                                    or s.get("duration_seconds") > max_duration
                                ):
                                    max_duration = s.get("duration_seconds")

                for s in player_sessions:
                    last_dt = parse_dt(s.get("last_seen"))
                    if last_dt and (
                        latest_last_seen is None or last_dt > latest_last_seen
                    ):
                        latest_last_seen = last_dt

            summary = {
                "player_name": player_name,
                "online": player_online,
                "session_start": earliest_session_start.isoformat()
                if earliest_session_start
                else None,
                "last_seen": latest_last_seen.isoformat() if latest_last_seen else None,
                "duration_seconds": max_duration,
            }

            return summary

    @player_ns.route("/<string:player_name>/sessions")
    class PlayerSessions(Resource):
        @player_ns.doc(
            "获取玩家会话",
            description="获取玩家会话历史数据，包括热力图、每日会话列表和统计信息（默认30天）",
            params={"days": "可选，整数，覆盖默认天数，示例：?days=7"},
        )
        def get(self, player_name):
            days = int(poller.config.get("player_calendar_days", 30))
            try:
                days = int(request.args.get("days", days))
            except Exception:
                pass

            history = poller.db.get_player_history(player_name, days)

            now = utc8_now()

            server_to_group = {}
            for server in poller.db.get_all_servers():
                server_config = next(
                    (
                        s
                        for s in poller.config.get("servers", [])
                        if s["host"] == server["host"] and s["port"] == server["port"]
                    ),
                    None,
                )
                server_name = (
                    server_config.get("group", "默认") if server_config else "默认"
                )
                server_to_group[server["id"]] = server_name

            # 检查玩家是否在线
            player_online = False
            for server in poller.db.get_all_servers():
                sessions = poller.db.get_all_player_sessions(server["id"])
                for s in sessions:
                    if s.get("player_name") != player_name:
                        continue
                    if s.get("online"):
                        player_online = True
                        start = s.get("session_start")
                        history.append(
                            {
                                "session_start": start,
                                "session_end": now.isoformat(),
                                "server_id": server["id"],
                            }
                        )

            def merge_intervals(intervals):
                if not intervals:
                    return []
                intervals.sort(key=lambda x: x[0])
                merged = [intervals[0]]
                for current_start, current_end, server_id in intervals[1:]:
                    last_start, last_end, last_server = merged[-1]
                    if current_start <= last_end:
                        merged[-1] = (
                            last_start,
                            max(last_end, current_end),
                            last_server,
                        )
                    else:
                        merged.append((current_start, current_end, server_id))
                return merged

            intervals = []
            for item in history:
                start = (
                    datetime.fromisoformat(item["session_start"])
                    if isinstance(item["session_start"], str)
                    else item["session_start"]
                )
                end = (
                    datetime.fromisoformat(item["session_end"])
                    if isinstance(item["session_end"], str)
                    else item["session_end"]
                )
                if not start or not end or end <= start:
                    continue
                intervals.append((start, end, item["server_id"]))

            merged_sessions = merge_intervals(intervals)

            daily = {}
            hour_totals = {h: 0 for h in range(24)}
            total_duration = 0
            session_count = len(merged_sessions)

            def split_by_hour(s: datetime, e: datetime):
                current = s
                while current < e:
                    next_hour = current.replace(
                        minute=0, second=0, microsecond=0
                    ) + timedelta(hours=1)
                    segment_end = min(next_hour, e)
                    yield current, segment_end
                    current = segment_end

            def split_by_day(s: datetime, e: datetime):
                current = s
                while current < e:
                    next_day = datetime.combine(
                        current.date() + timedelta(days=1), datetime.min.time()
                    )
                    segment_end = min(next_day, e)
                    yield current, segment_end
                    current = segment_end

            for start, end, server_id in merged_sessions:
                dur = (end - start).total_seconds()
                total_duration += dur

                for ds, de in split_by_day(start, end):
                    day_key = ds.date()
                    if day_key not in daily:
                        daily[day_key] = {
                            "total_seconds": 0,
                            "sessions": [],
                            "heat": {},
                        }
                    server_name = server_to_group.get(server_id, "默认")
                    daily[day_key]["sessions"].append(
                        {
                            "start": ds.isoformat(),
                            "end": de.isoformat(),
                            "server_name": server_name,
                        }
                    )

                for hs, he in split_by_hour(start, end):
                    day_key = hs.date()
                    if day_key not in daily:
                        daily[day_key] = {
                            "total_seconds": 0,
                            "sessions": [],
                            "heat": {},
                        }
                    segment_dur = (he - hs).total_seconds()
                    hour_totals[hs.hour] += segment_dur
                    daily[day_key]["heat"][hs.hour] = (
                        daily[day_key]["heat"].get(hs.hour, 0) + segment_dur
                    )
                    daily[day_key]["total_seconds"] += segment_dur

            dates_sorted = sorted(daily.keys())
            days_count = len(dates_sorted) if dates_sorted else 1

            heatmap = []
            for day in dates_sorted:
                heat = daily[day].get("heat", {})
                for hour in range(24):
                    heatmap.append(
                        {
                            "date": day.isoformat(),
                            "hour": hour,
                            "seconds": heat.get(hour, 0),
                        }
                    )

            hourly_avg = []
            for hour in range(24):
                hourly_avg.append(
                    {"hour": hour, "avg_seconds": hour_totals[hour] / days_count}
                )

            avg_daily_seconds = total_duration / days_count if days_count else 0
            avg_session_seconds = total_duration / session_count if session_count else 0

            response = {
                "days": days,
                "player_online": player_online,  # 玩家是否在线
                "heatmap": heatmap,
                "daily": [
                    {
                        "date": day.isoformat(),
                        "total_seconds": daily[day].get("total_seconds", 0),
                        "sessions": daily[day].get("sessions", []),
                    }
                    for day in dates_sorted
                ],
                "average_daily_seconds": avg_daily_seconds,
                "average_session_seconds": avg_session_seconds,
                "hourly_average": hourly_avg,
            }

            return response

    @player_ns.route("/<string:player_name>/weekly-stats")
    class PlayerWeeklyStats(Resource):
        @player_ns.doc(
            "获取玩家周统计",
            description="获取玩家全量历史数据的周活跃统计，包括每周各时段的平均在线时长和星期偏好",
        )
        def get(self, player_name):
            # 获取全量历史数据（不限制天数）
            history = poller.db.get_player_history(player_name, days=None)

            now = utc8_now()

            # 添加当前在线会话（使用 set 去重，避免多服务器重复）
            online_sessions = []
            for server in poller.db.get_all_servers():
                sessions = poller.db.get_all_player_sessions(server["id"])
                for s in sessions:
                    if s.get("player_name") != player_name:
                        continue
                    if s.get("online"):
                        start = s.get("session_start")
                        online_sessions.append({
                            "session_start": start,
                            "session_end": now.isoformat(),
                            "server_id": server["id"],
                        })
            
            # 合并历史数据和当前在线会话
            history.extend(online_sessions)

            # 合并重叠的时间段（避免多服务器同时在线导致重复计算）
            def merge_intervals(intervals):
                """合并重叠的时间区间"""
                if not intervals:
                    return []
                intervals.sort(key=lambda x: x[0])
                merged = [intervals[0]]
                for current_start, current_end, server_id in intervals[1:]:
                    last_start, last_end, last_server = merged[-1]
                    if current_start <= last_end:
                        # 重叠，合并
                        merged[-1] = (
                            last_start,
                            max(last_end, current_end),
                            last_server,
                        )
                    else:
                        merged.append((current_start, current_end, server_id))
                return merged

            # 转换为区间列表并合并
            intervals = []
            for item in history:
                start = (
                    datetime.fromisoformat(item["session_start"])
                    if isinstance(item["session_start"], str)
                    else item["session_start"]
                )
                end = (
                    datetime.fromisoformat(item["session_end"])
                    if isinstance(item["session_end"], str)
                    else item["session_end"]
                )
                if not start or not end or end <= start:
                    continue
                intervals.append((start, end, item.get("server_id")))

            merged_sessions = merge_intervals(intervals)

            # 初始化周统计数据结构
            # weekday_hours[dayOfWeek][hour] = { total_seconds, sample_count }
            weekday_hours = {d: {h: {"total": 0, "count": 0} for h in range(24)} for d in range(7)}
            # weekday_totals[dayOfWeek] = { total_seconds, day_count }
            weekday_totals = {d: {"total": 0, "days": set()} for d in range(7)}

            def split_by_hour(start: datetime, end: datetime):
                """将会话按小时切分"""
                current = start
                while current < end:
                    next_hour = current.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
                    segment_end = min(next_hour, end)
                    yield current, segment_end
                    current = next_hour

            # 处理每个合并后的会话（已去重）
            for start, end, server_id in merged_sessions:
                # 按小时切分并统计
                for seg_start, seg_end in split_by_hour(start, end):
                    day_of_week = seg_start.weekday()  # 0=周一, 6=周日
                    hour = seg_start.hour
                    seconds = (seg_end - seg_start).total_seconds()

                    weekday_hours[day_of_week][hour]["total"] += seconds
                    
                    # 记录这一天作为样本
                    day_key = seg_start.date()
                    weekday_totals[day_of_week]["days"].add(day_key)
                    weekday_totals[day_of_week]["total"] += seconds

            # 计算每个时段的样本数（以天为单位）
            for d in range(7):
                day_count = len(weekday_totals[d]["days"])
                for h in range(24):
                    weekday_hours[d][h]["count"] = day_count

            # 生成周热力图数据 (7天 x 24小时)
            weekly_heatmap = []
            weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
            for d in range(7):
                for h in range(24):
                    data = weekday_hours[d][h]
                    avg = data["total"] / data["count"] if data["count"] > 0 else 0
                    weekly_heatmap.append({
                        "day": d,
                        "day_name": weekday_names[d],
                        "hour": h,
                        "avg_seconds": avg,
                        "sample_days": data["count"],
                    })

            # 生成星期偏好数据
            weekday_preference = []
            for d in range(7):
                day_count = len(weekday_totals[d]["days"])
                avg = weekday_totals[d]["total"] / day_count if day_count > 0 else 0
                weekday_preference.append({
                    "day": d,
                    "day_name": weekday_names[d],
                    "avg_seconds": avg,
                    "sample_days": day_count,
                })

            # 统计总天数
            all_days = set()
            for d in range(7):
                all_days.update(weekday_totals[d]["days"])

            return {
                "player_name": player_name,
                "total_sample_days": len(all_days),
                "weekly_heatmap": weekly_heatmap,
                "weekday_preference": weekday_preference,
            }

    api.add_namespace(player_ns)
    return player_ns
