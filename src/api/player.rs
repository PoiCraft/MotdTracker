use axum::{
    routing::get,
    Router,
    extract::{State, Path},
    Json,
};
use serde::Deserialize;
use chrono::{DateTime, Utc, Duration, Datelike, Timelike};
use std::collections::{HashMap, HashSet};

use super::AppState;
use crate::models::{PlayerListItem, PlayerDetail};
use crate::utils::time::{now_gmt8, format_gmt8_naive};

#[derive(Deserialize)]
struct DaysQuery {
    #[serde(default = "default_days")]
    days: u32,
}

fn default_days() -> u32 { 30 }

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", get(get_players))
        .route("/:name/detail", get(get_player_detail))
        .route("/:name/sessions", get(get_player_sessions))
        .route("/:name/weekly-stats", get(get_player_weekly_stats))
        .route("/:name/heatmap", get(get_player_heatmap))
}

async fn get_players(
    State(state): State<AppState>,
) -> Json<Vec<PlayerListItem>> {
    let all_names = match state.db.get_all_player_names().await {
        Ok(names) => names,
        Err(_) => return Json(Vec::new()),
    };

    let mut result: Vec<PlayerListItem> = Vec::new();

    for name in all_names {
        if let Ok(Some(detail)) = state.db.get_player_detail(&name).await {
            result.push(PlayerListItem {
                player_name: detail.player_name,
                online: detail.online,
                session_start: detail.session_start,
                last_seen: Some(detail.last_seen),
                duration_seconds: detail.duration_seconds,
                servers: detail.servers,
            });
        }
    }

    result.sort_by(|a, b| {
        match (a.online, b.online) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => {
                let a_time = a.last_seen.unwrap_or_else(now_gmt8);
                let b_time = b.last_seen.unwrap_or_else(now_gmt8);
                b_time.cmp(&a_time)
            }
        }
    });

    Json(result)
}

async fn get_player_detail(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<PlayerDetail>, axum::http::StatusCode> {
    match state.db.get_player_detail(&name).await {
        Ok(Some(detail)) => Ok(Json(detail)),
        Ok(None) => Err(axum::http::StatusCode::NOT_FOUND),
        Err(_) => Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_player_sessions(
    State(state): State<AppState>,
    Path(name): Path<String>,
    axum::extract::Query(query): axum::extract::Query<DaysQuery>,
) -> Json<serde_json::Value> {
    let days = query.days.clamp(1, 365);
    let now = now_gmt8();

    let history = state.db.get_player_history(&name, Some(days)).await.unwrap_or_default();

    let servers = state.db.get_all_servers().await.unwrap_or_default();
    let server_name_map: HashMap<i32, String> = servers.iter()
        .map(|s| (s.id, s.name.clone()))
        .collect();

    let mut player_online = false;
    let mut all_intervals: Vec<(DateTime<Utc>, DateTime<Utc>, i32)> = Vec::new();

    for h in &history {
        if h.session_end > h.session_start {
            all_intervals.push((h.session_start, h.session_end, h.server_id));
        }
    }

    for server in &servers {
        let sessions = state.db.get_all_player_sessions(server.id).await.unwrap_or_default();
        for s in &sessions {
            if s.player_name == name && s.online {
                player_online = true;
                if let Some(start) = s.session_start {
                    all_intervals.push((start, now, server.id));
                }
            }
        }
    }

    all_intervals.sort_by(|a, b| a.0.cmp(&b.0));
    let merged = merge_intervals(all_intervals);

    let mut daily: HashMap<chrono::NaiveDate, DailyAccum> = HashMap::new();
    let mut hour_totals: [f64; 24] = [0.0; 24];
    let mut total_duration = 0.0f64;
    let session_count = merged.len();

    for (start, end, server_id) in &merged {
        let dur = (*end - *start).num_seconds() as f64;
        total_duration += dur;

        let server_group = server_name_map.get(server_id).cloned().unwrap_or_else(|| "默认".to_string());

        let mut current = *start;
        while current < *end {
            let day_key = current.date_naive();
            let entry = daily.entry(day_key).or_default();

            let _next_day = (current + Duration::days(1)).date_naive().and_hms_opt(0, 0, 0).unwrap();
            let next_day_utc = chrono::NaiveDateTime::new(current.date_naive(), chrono::NaiveTime::from_hms_opt(0, 0, 0).unwrap())
                + Duration::days(1);
            let seg_end = if end.naive_utc() < next_day_utc { end.naive_utc() } else { next_day_utc };
            let seg_dur = (seg_end - current.naive_utc()).num_seconds() as f64;

            entry.total_seconds += seg_dur;
            entry.sessions.push(SessionInfo {
                start: format_gmt8_naive(current),
                end: format_gmt8_naive(std::cmp::min(*end, chrono::DateTime::<Utc>::from_naive_utc_and_offset(seg_end, Utc))),
                server_name: server_group.clone(),
            });

            current = chrono::DateTime::<Utc>::from_naive_utc_and_offset(seg_end, Utc);
        }

        let mut current = *start;
        while current < *end {
            let hour = current.hour();
            let next_hour = (current + Duration::hours(1))
                .with_minute(0).unwrap()
                .with_second(0).unwrap()
                .with_nanosecond(0).unwrap();
            let seg_end = std::cmp::min(next_hour, *end);
            let seg_dur = (seg_end - current).num_seconds() as f64;

            hour_totals[hour as usize] += seg_dur;

            let day_key = current.date_naive();
            let entry = daily.entry(day_key).or_default();
            *entry.heat.entry(hour).or_insert(0.0) += seg_dur;

            current = seg_end;
        }
    }

    let dates_sorted: Vec<chrono::NaiveDate> = {
        let mut keys: Vec<_> = daily.keys().cloned().collect();
        keys.sort();
        keys
    };
    let days_count = if dates_sorted.is_empty() { 1.0 } else { dates_sorted.len() as f64 };

    let mut heatmap = Vec::new();
    for day in &dates_sorted {
        let entry = &daily[day];
        for hour in 0..24 {
            heatmap.push(serde_json::json!({
                "date": day.to_string(),
                "hour": hour,
                "seconds": entry.heat.get(&hour).copied().unwrap_or(0.0),
            }));
        }
    }

    let daily_result: Vec<serde_json::Value> = dates_sorted.iter().map(|day| {
        let entry = &daily[day];
        serde_json::json!({
            "date": day.to_string(),
            "total_seconds": entry.total_seconds,
            "sessions": entry.sessions,
        })
    }).collect();

    let hourly_average: Vec<serde_json::Value> = (0..24).map(|hour| {
        serde_json::json!({
            "hour": hour,
            "avg_seconds": hour_totals[hour as usize] / days_count,
        })
    }).collect();

    let avg_daily = total_duration / days_count;
    let avg_session = if session_count > 0 { total_duration / session_count as f64 } else { 0.0 };

    Json(serde_json::json!({
        "days": days,
        "player_online": player_online,
        "heatmap": heatmap,
        "daily": daily_result,
        "average_daily_seconds": avg_daily,
        "average_session_seconds": avg_session,
        "hourly_average": hourly_average,
    }))
}

async fn get_player_weekly_stats(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Json<serde_json::Value> {
    let history = state.db.get_player_history(&name, None).await.unwrap_or_default();
    let now = now_gmt8();

    let servers = state.db.get_all_servers().await.unwrap_or_default();

    let mut all_intervals: Vec<(DateTime<Utc>, DateTime<Utc>, Option<i32>)> = Vec::new();

    for h in &history {
        if h.session_end > h.session_start {
            all_intervals.push((h.session_start, h.session_end, Some(h.server_id)));
        }
    }

    for server in &servers {
        let sessions = state.db.get_all_player_sessions(server.id).await.unwrap_or_default();
        for s in &sessions {
            if s.player_name == name && s.online {
                if let Some(start) = s.session_start {
                    all_intervals.push((start, now, Some(server.id)));
                }
            }
        }
    }

    all_intervals.sort_by(|a, b| a.0.cmp(&b.0));
    let merged = merge_intervals_opt(all_intervals);

    let weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

    let mut weekday_hours: Vec<Vec<HourAccum>> = vec![vec![HourAccum::default(); 24]; 7];
    let mut weekday_totals: Vec<WeekdayTotal> = vec![WeekdayTotal::default(); 7];

    for (start, end, _server_id) in &merged {
        let mut current = *start;
        while current < *end {
            let next_hour = (current + Duration::hours(1))
                .with_minute(0).unwrap()
                .with_second(0).unwrap()
                .with_nanosecond(0).unwrap();
            let seg_end = std::cmp::min(next_hour, *end);
            let seconds = (seg_end - current).num_seconds() as f64;

            let day_of_week = current.weekday().num_days_from_monday() as usize;
            let hour = current.hour() as usize;

            weekday_hours[day_of_week][hour].total += seconds;
            let day_key = current.date_naive();
            weekday_totals[day_of_week].days.insert(day_key);
            weekday_totals[day_of_week].total += seconds;

            current = seg_end;
        }
    }

    for d in 0..7 {
        let day_count = weekday_totals[d].days.len() as f64;
        for h in 0..24 {
            weekday_hours[d][h].count = day_count;
        }
    }

    let mut weekly_heatmap = Vec::new();
    for d in 0..7 {
        for h in 0..24 {
            let data = &weekday_hours[d][h];
            let avg = if data.count > 0.0 { data.total / data.count } else { 0.0 };
            weekly_heatmap.push(serde_json::json!({
                "day": d,
                "day_name": weekday_names[d],
                "hour": h,
                "avg_seconds": avg,
                "sample_days": data.count as u32,
            }));
        }
    }

    let weekday_preference: Vec<serde_json::Value> = (0..7).map(|d| {
        let day_count = weekday_totals[d].days.len() as f64;
        let avg = if day_count > 0.0 { weekday_totals[d].total / day_count } else { 0.0 };
        serde_json::json!({
            "day": d,
            "day_name": weekday_names[d],
            "avg_seconds": avg,
            "sample_days": day_count as u32,
        })
    }).collect();

    let mut all_days: HashSet<chrono::NaiveDate> = HashSet::new();
    for d in 0..7 {
        all_days.extend(&weekday_totals[d].days);
    }

    Json(serde_json::json!({
        "player_name": name,
        "total_sample_days": all_days.len(),
        "weekly_heatmap": weekly_heatmap,
        "weekday_preference": weekday_preference,
    }))
}

async fn get_player_heatmap(
    State(state): State<AppState>,
    Path(name): Path<String>,
    axum::extract::Query(query): axum::extract::Query<DaysQuery>,
) -> Json<serde_json::Value> {
    let days = query.days.clamp(1, 365);

    match state.db.get_player_heatmap(&name, days).await {
        Ok(heatmap) => {
            Json(serde_json::to_value(heatmap).unwrap_or(serde_json::json!([])))
        }
        Err(_) => Json(serde_json::json!([])),
    }
}

#[derive(Default)]
struct DailyAccum {
    total_seconds: f64,
    sessions: Vec<SessionInfo>,
    heat: HashMap<u32, f64>,
}

#[derive(Clone, serde::Serialize)]
struct SessionInfo {
    start: String,
    end: String,
    server_name: String,
}

#[derive(Default, Clone)]
struct HourAccum {
    total: f64,
    count: f64,
}

#[derive(Default, Clone)]
struct WeekdayTotal {
    total: f64,
    days: HashSet<chrono::NaiveDate>,
}

fn merge_intervals(mut intervals: Vec<(DateTime<Utc>, DateTime<Utc>, i32)>) -> Vec<(DateTime<Utc>, DateTime<Utc>, i32)> {
    if intervals.is_empty() {
        return vec![];
    }
    intervals.sort_by(|a, b| a.0.cmp(&b.0));
    let mut merged = vec![intervals[0]];
    for (start, end, server_id) in intervals.into_iter().skip(1) {
        let last = merged.last_mut().unwrap();
        if start <= last.1 {
            if end > last.1 {
                last.1 = end;
            }
        } else {
            merged.push((start, end, server_id));
        }
    }
    merged
}

fn merge_intervals_opt(mut intervals: Vec<(DateTime<Utc>, DateTime<Utc>, Option<i32>)>) -> Vec<(DateTime<Utc>, DateTime<Utc>, Option<i32>)> {
    if intervals.is_empty() {
        return vec![];
    }
    intervals.sort_by(|a, b| a.0.cmp(&b.0));
    let mut merged = vec![intervals[0]];
    for (start, end, server_id) in intervals.into_iter().skip(1) {
        let last = merged.last_mut().unwrap();
        if start <= last.1 {
            if end > last.1 {
                last.1 = end;
            }
        } else {
            merged.push((start, end, server_id));
        }
    }
    merged
}
