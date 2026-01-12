use chrono::{DateTime, FixedOffset, Utc};

/// 获取UTC+8时区
pub fn utc8_offset() -> FixedOffset {
    FixedOffset::east_opt(8 * 3600).unwrap()
}

/// 获取当前UTC+8时间
pub fn utc8_now() -> DateTime<Utc> {
    Utc::now()
}

/// 将UTC时间转换为UTC+8显示
pub fn to_utc8_string(dt: DateTime<Utc>) -> String {
    dt.with_timezone(&utc8_offset()).format("%Y-%m-%d %H:%M:%S").to_string()
}
