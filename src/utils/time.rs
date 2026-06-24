//! 时间工具模块
//!
//! 项目内部统一使用带时区信息的 GMT+8 类型 `Gmt8Time` (= `DateTime<FixedOffset>`)。
//!
//! ## 为什么不用 `DateTime<Utc>`
//!
//! 历史上本项目把 GMT+8 的本地时间值塞进 `DateTime<Utc>`，类型上无法与真正的 UTC 时间区分，
//! 编译器无法阻止 `Utc::now()` 与 `now_gmt8()` 混用 —— 这是经典的类型 footgun。
//!
//! 改用 `DateTime<FixedOffset>` 后：
//! - `now_gmt8()` 返回真正带 `+08:00` 时区偏移的值，语义自洽。
//! - `DateTime<Utc>`（真正 UTC）与 `Gmt8Time` 在类型层面不兼容，混用直接编译失败。
//! - 数据库存储 / API 输出统一使用 `%Y-%m-%d %H:%M:%S` 无时区后缀格式（保持向后兼容）。
//! - 所有获取"当前时间"的入口应使用 `now_gmt8()`，禁止直接调用 `Utc::now()`。

use chrono::{DateTime, FixedOffset, NaiveDateTime, TimeZone, Utc};

/// GMT+8 固定偏移
pub fn gmt8_offset() -> FixedOffset {
    FixedOffset::east_opt(8 * 3600).expect("8*3600 是合法偏移")
}

/// 项目标准时间类型：带 GMT+8 时区偏移的 DateTime
pub type Gmt8Time = DateTime<FixedOffset>;

/// 将任意时区的 DateTime 转换为 GMT+8 表示（仅调整偏移，物理时刻不变）
pub fn to_gmt8<T: chrono::TimeZone>(dt: DateTime<T>) -> Gmt8Time {
    dt.with_timezone(&gmt8_offset())
}

const GMT8_NAIVE_FORMAT: &str = "%Y-%m-%d %H:%M:%S";

/// 获取当前 GMT+8 时间（带 `+08:00` 偏移）
pub fn now_gmt8() -> Gmt8Time {
    Utc::now().with_timezone(&gmt8_offset())
}

/// 将 GMT+8 时间格式化为无时区后缀的字符串（数据库存储 / API 输出口径）
pub fn format_gmt8_naive(dt: Gmt8Time) -> String {
    dt.format(GMT8_NAIVE_FORMAT).to_string()
}

/// 解析无时区后缀的 GMT+8 字符串，返回带 `+08:00` 偏移的 `Gmt8Time`
pub fn parse_gmt8_naive(s: &str) -> Option<Gmt8Time> {
    NaiveDateTime::parse_from_str(s, GMT8_NAIVE_FORMAT)
        .map(|naive| gmt8_offset().from_local_datetime(&naive).unwrap())
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

/// 解析 RFC3339 时间字符串（带时区），并归一化为 GMT+8
pub fn parse_rfc3339(s: &str) -> Option<Gmt8Time> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| to_gmt8(dt.with_timezone(&Utc)))
        .or_else(|_| {
            NaiveDateTime::parse_from_str(s, GMT8_NAIVE_FORMAT)
                .map(|dt| gmt8_offset().from_local_datetime(&dt).unwrap())
        })
        .ok()
}

/// 修正从 SQLite 读取的日期时间偏移。
///
/// SQLite 存储的是无时区信息的 GMT+8 墙钟时间字符串（如 `"2026-06-24 13:54:05"`），
/// 但 sqlx 的 `FromRow` 将其解码为 `DateTime<FixedOffset>` 时默认按 UTC（`+00:00`）解释。
/// 这会导致 `now_gmt8() - db_time` 的差值偏移 8 小时。
///
/// 本函数将 sqlx 读出的时间取其墙钟值，重新赋予 `+08:00` 偏移。
pub fn fix_db_time(dt: Gmt8Time) -> Gmt8Time {
    let naive = dt.naive_utc();
    gmt8_offset().from_local_datetime(&naive).unwrap()
}

/// 获取指定小时前的时间
pub fn hours_ago(hours: u32) -> Gmt8Time {
    now_gmt8() - chrono::Duration::hours(hours as i64)
}

/// 获取指定天数前的时间
pub fn days_ago(days: u32) -> Gmt8Time {
    now_gmt8() - chrono::Duration::days(days as i64)
}

/// 判断时间是否在指定范围内
pub fn is_within_range(time: Gmt8Time, start: Gmt8Time, end: Gmt8Time) -> bool {
    time >= start && time <= end
}

/// 获取当天的开始时间 (00:00:00)
pub fn start_of_day(time: Gmt8Time) -> Gmt8Time {
    time.date_naive()
        .and_hms_opt(0, 0, 0)
        .map(|dt| gmt8_offset().from_local_datetime(&dt).unwrap())
        .unwrap_or(time)
}

/// 获取当天的结束时间 (23:59:59)
pub fn end_of_day(time: Gmt8Time) -> Gmt8Time {
    time.date_naive()
        .and_hms_opt(23, 59, 59)
        .map(|dt| gmt8_offset().from_local_datetime(&dt).unwrap())
        .unwrap_or(time)
}

/// serde 模块：将 `Gmt8Time` 序列化/反序列化为 GMT+8 无时区字符串
pub mod serde_gmt8 {
    use super::{format_gmt8_naive, parse_gmt8_naive, Gmt8Time};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(dt: &Gmt8Time, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&format_gmt8_naive(*dt))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Gmt8Time, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        parse_gmt8_naive(&s).ok_or_else(|| serde::de::Error::custom("invalid GMT+8 naive datetime"))
    }
}

/// serde 模块：将 `Option<Gmt8Time>` 序列化/反序列化为 GMT+8 无时区字符串
pub mod serde_gmt8_opt {
    use super::{format_gmt8_naive, parse_gmt8_naive, Gmt8Time};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(opt: &Option<Gmt8Time>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match opt {
            Some(dt) => serializer.serialize_str(&format_gmt8_naive(*dt)),
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<Gmt8Time>, D::Error>
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

    #[test]
    fn test_now_gmt8_has_correct_offset() {
        let now = now_gmt8();
        assert_eq!(now.offset().local_minus_utc(), 8 * 3600);
    }

    #[test]
    fn test_format_and_parse_roundtrip() {
        // now_gmt8() 带亚秒精度，但格式化串丢弃小数部分，因此比较格式化后的字符串
        let now = now_gmt8();
        let s = format_gmt8_naive(now);
        let parsed = parse_gmt8_naive(&s).unwrap();
        // 解析回来的值应与格式化前的字符串一致
        assert_eq!(s, format_gmt8_naive(parsed));
        assert_eq!(parsed.offset().local_minus_utc(), 8 * 3600);
    }
}
