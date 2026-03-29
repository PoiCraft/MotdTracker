//! 缁熻璁＄畻妯″潡

use crate::models::{StatusLog, LatencyStats};

/// 璁＄畻寤惰繜缁熻
pub fn calculate_latency_stats(history: &[StatusLog]) -> LatencyStats {
    let total_checks = history.len() as u32;
    let online_checks = history.iter().filter(|h| h.online).count() as u32;
    
    let uptime_percentage = if total_checks > 0 {
        (online_checks as f64 / total_checks as f64) * 100.0
    } else {
        0.0
    };
    
    // 鏀堕泦鏈夋晥寤惰繜鍊?
    let latencies: Vec<f64> = history.iter()
        .filter(|h| h.online && h.latency.is_some())
        .map(|h| h.latency.unwrap())
        .collect();
    
    if latencies.is_empty() {
        return LatencyStats {
            uptime_percentage,
            avg_latency: None,
            std_dev: None,
            min_latency: None,
            max_latency: None,
            p95_latency: None,
            cv: None,
            total_checks,
            online_checks,
        };
    }
    
    // 璁＄畻骞冲潎鍊?
    let sum: f64 = latencies.iter().sum();
    let avg = sum / latencies.len() as f64;
    
    // 璁＄畻鏍囧噯宸?
    let std_dev = if latencies.len() > 1 {
        let variance: f64 = latencies.iter()
            .map(|x| (x - avg).powi(2))
            .sum::<f64>() / (latencies.len() - 1) as f64;
        Some(variance.sqrt())
    } else {
        Some(0.0)
    };
    
    // 璁＄畻鏈€灏?鏈€澶у€?
    let min = latencies.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = latencies.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    
    // 璁＄畻 P95
    let mut sorted = latencies.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let p95_index = ((sorted.len() as f64 * 0.95).ceil() as usize).saturating_sub(1);
    let p95 = sorted.get(p95_index).copied().unwrap_or(max);
    
    // 璁＄畻鍙樺紓绯绘暟
    let cv = if avg > 0.0 && std_dev.is_some() {
        Some((std_dev.unwrap() / avg) * 100.0)
    } else {
        None
    };
    
    LatencyStats {
        uptime_percentage,
        avg_latency: Some(avg),
        std_dev,
        min_latency: Some(min),
        max_latency: Some(max),
        p95_latency: Some(p95),
        cv,
        total_checks,
        online_checks,
    }
}

/// 鏍规嵁鍦ㄧ嚎鐜囪幏鍙栭鑹?
pub fn get_uptime_color(uptime: f64) -> &'static str {
    if uptime >= 99.0 {
        "green"
    } else if uptime >= 95.0 {
        "limegreen"
    } else if uptime >= 90.0 {
        "yellowgreen"
    } else if uptime >= 75.0 {
        "yellow"
    } else if uptime >= 50.0 {
        "orange"
    } else {
        "red"
    }
}

/// 鏍规嵁寤惰繜鑾峰彇棰滆壊
pub fn get_latency_color(latency: f64) -> &'static str {
    if latency <= 50.0 {
        "green"
    } else if latency <= 100.0 {
        "limegreen"
    } else if latency <= 150.0 {
        "yellowgreen"
    } else if latency <= 200.0 {
        "yellow"
    } else if latency <= 300.0 {
        "orange"
    } else {
        "red"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    
    fn create_status_log(online: bool, latency: Option<f64>) -> StatusLog {
        StatusLog {
            id: 0,
            server_id: 1,
            timestamp: Utc::now(),
            online,
            latency,
            players_online: None,
            players_max: None,
            version: None,
            motd: None,
            sample_players: None,
            software: None,
            plugins: None,
            map: None,
        }
    }
    
    #[test]
    fn test_calculate_latency_stats() {
        let history = vec![
            create_status_log(true, Some(10.0)),
            create_status_log(true, Some(20.0)),
            create_status_log(true, Some(30.0)),
            create_status_log(true, Some(40.0)),
            create_status_log(true, Some(50.0)),
            create_status_log(false, None),
        ];
        
        let stats = calculate_latency_stats(&history);
        
        assert_eq!(stats.total_checks, 6);
        assert_eq!(stats.online_checks, 5);
        assert!((stats.uptime_percentage - 83.333).abs() < 0.1);
        assert_eq!(stats.avg_latency, Some(30.0));
        assert_eq!(stats.min_latency, Some(10.0));
        assert_eq!(stats.max_latency, Some(50.0));
    }
    
    #[test]
    fn test_get_uptime_color() {
        assert_eq!(get_uptime_color(99.5), "green");
        assert_eq!(get_uptime_color(96.0), "limegreen");
        assert_eq!(get_uptime_color(92.0), "yellowgreen");
        assert_eq!(get_uptime_color(80.0), "yellow");
        assert_eq!(get_uptime_color(60.0), "orange");
        assert_eq!(get_uptime_color(40.0), "red");
    }
}
