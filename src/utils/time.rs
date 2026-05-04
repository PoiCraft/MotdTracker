//! 时间工具模块
//!
//! 项目内部统一按 GMT+8 无时区值处理：
//! - `DateTime<Utc>` 承载的是 GMT+8 的本地时间值（而非真正的 UTC）
//! - 数据库存储 / API 输出均使用 `%Y-%m-%d %H:%M:%S` 无时区后缀格式
//! - 所有获取"当前时间"的入口应使用 `now_gmt8()`，禁止直接调用 `Utc::now()`

use chrono::{DateTime, Duration, NaiveDateTime, TimeZone, Utc};

const GMT8_NAIVE_FORMAT: &str = "%Y-%m-%d %H:%M:%S";

/// 获取当前 GMT+8 的无时区时间（以 DateTime<Utc> 承载）
///
/// 说明：项目内部统一按 GMT+8 的无时区值处理，数据库/API 输出也保持该口径。
pub fn now_gmt8() -> DateTime<Utc> {
    Utc::now() + Duration::hours(8)
}

/// 将时间格式化为无时区的 GMT+8 字符串
pub fn format_gmt8_naive(dt: DateTime<Utc>) -> String {
    dt.format(GMT8_NAIVE_FORMAT).to_string()
}

/// 解析无时区的 GMT+8 字符串
pub fn parse_gmt8_naive(s: &str) -> Option<DateTime<Utc>> {
    NaiveDateTime::parse_from_str(s, GMT8_NAIVE_FORMAT)
        .map(|naive| Utc.from_utc_datetime(&naive))
        .ok()
}

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
        .or_else(|_| {
            NaiveDateTime::parse_from_str(s, GMT8_NAIVE_FORMAT).map(|dt| Utc.from_utc_datetime(&dt))
        })
        .ok()
}

/// 获取指定小时前的时间
pub fn hours_ago(hours: u32) -> DateTime<Utc> {
    now_gmt8() - Duration::hours(hours as i64)
}

/// 获取指定天数前的时间
pub fn days_ago(days: u32) -> DateTime<Utc> {
    now_gmt8() - Duration::days(days as i64)
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

/// serde 模块：将 `DateTime<Utc>` 序列化/反序列化为 GMT+8 无时区字符串
pub mod serde_gmt8 {
    use super::{format_gmt8_naive, parse_gmt8_naive};
    use chrono::{DateTime, Utc};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(dt: &DateTime<Utc>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&format_gmt8_naive(*dt))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        parse_gmt8_naive(&s).ok_or_else(|| serde::de::Error::custom("invalid GMT+8 naive datetime"))
    }
}

/// serde 模块：将 `Option<DateTime<Utc>>` 序列化/反序列化为 GMT+8 无时区字符串
pub mod serde_gmt8_opt {
    use super::{format_gmt8_naive, parse_gmt8_naive};
    use chrono::{DateTime, Utc};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(opt: &Option<DateTime<Utc>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match opt {
            Some(dt) => serializer.serialize_str(&format_gmt8_naive(*dt)),
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<DateTime<Utc>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt = Option::<String>::deserialize(deserializer)?;
        match opt {
            Some(s) => parse_gmt8_naive(&s)
                .map(Some)
                .ok_or_else(|| serde::de::Error::custom("invalid GMT+8 naive datetime")),
            None => Ok(None),
        }
    }
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
        let now = now_gmt8();
        let two_hours_ago = hours_ago(2);
        let diff = now - two_hours_ago;
        let seconds = diff.num_seconds();
        assert!((7200 - 60..=7200 + 60).contains(&seconds));
    }
}
