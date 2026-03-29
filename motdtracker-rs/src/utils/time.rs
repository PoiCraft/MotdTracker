//! 时间工具模块

use chrono::{DateTime, Utc, TimeZone, Duration};

/// 将时间转换为人类可读格式
pub fn format_duration(seconds: i64) -> String {
    let days = seconds / 86400;
    let hours = (seconds % 86400) / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;
    
    if days > 0 {
        format!("{}天 {}小时", days, hours)
    } else if hours > 0 {
        format!("{}小时 {}分钟", hours, minutes)
    } else if minutes > 0 {
        format!("{}分钟 {}秒", minutes, secs)
    } else {
        format!("{}秒", secs)
    }
}

/// 解析 RFC3339 时间字符串
pub fn parse_rfc3339(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .ok()
}

/// 获取指定小时前的时间
pub fn hours_ago(hours: u32) -> DateTime<Utc> {
    Utc::now() - Duration::hours(hours as i64)
}

/// 获取指定天数前的时间
pub fn days_ago(days: u32) -> DateTime<Utc> {
    Utc::now() - Duration::days(days as i64)
}

/// 判断时间是否在指定范围内
pub fn is_within_range(time: DateTime<Utc>, start: DateTime<Utc>, end: DateTime<Utc>) -> bool {
    time >= start && time <= end
}

/// 获取当天的开始时间 (00:00:00)
pub fn start_of_day(time: DateTime<Utc>) -> DateTime<Utc> {
    time.date_naive()
        .and_hms_opt(0, 0, 0)
        .map(|dt| Utc.from_utc_datetime(&dt))
        .unwrap_or(time)
}

/// 获取当天的结束时间 (23:59:59)
pub fn end_of_day(time: DateTime<Utc>) -> DateTime<Utc> {
    time.date_naive()
        .and_hms_opt(23, 59, 59)
        .map(|dt| Utc.from_utc_datetime(&dt))
        .unwrap_or(time)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_format_duration() {
        assert_eq!(format_duration(90061), "1天 1小时");
        assert_eq!(format_duration(3661), "1小时 1分钟");
        assert_eq!(format_duration(61), "1分钟 1秒");
        assert_eq!(format_duration(30), "30秒");
    }
    
    #[test]
    fn test_hours_ago() {
        let now = Utc::now();
        let two_hours_ago = hours_ago(2);
        let diff = now - two_hours_ago;
        let seconds = diff.num_seconds();
        assert!(seconds >= 7200 - 60 && seconds <= 7200 + 60);
    }
}