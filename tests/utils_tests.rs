/// 工具模块单元测试
///
/// 测试统计计算、时间处理等工具函数的正确性

#[cfg(test)]
mod tests {
    use chrono::Timelike;
    use motdtracker::models::StatusLog;
    use motdtracker::utils::{
        calculate_latency_stats, days_ago, end_of_day, format_duration, get_latency_color,
        get_uptime_color, hours_ago, is_within_range, now_gmt8, start_of_day,
    };

    fn create_test_log(online: bool, latency: Option<f64>) -> StatusLog {
        StatusLog {
            id: 0,
            server_id: 1,
            timestamp: now_gmt8(),
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
            edition: None,
        }
    }

    #[test]
    fn test_calculate_latency_stats_all_online() {
        let history = vec![
            create_test_log(true, Some(10.0)),
            create_test_log(true, Some(20.0)),
            create_test_log(true, Some(30.0)),
            create_test_log(true, Some(40.0)),
            create_test_log(true, Some(50.0)),
        ];

        let stats = calculate_latency_stats(&history);

        assert_eq!(stats.total_checks, 5);
        assert_eq!(stats.online_checks, 5);
        assert!((stats.uptime_percentage - 100.0).abs() < 0.01);
        assert_eq!(stats.avg_latency, Some(30.0));
        assert_eq!(stats.min_latency, Some(10.0));
        assert_eq!(stats.max_latency, Some(50.0));
    }

    #[test]
    fn test_calculate_latency_stats_mixed() {
        let history = vec![
            create_test_log(true, Some(10.0)),
            create_test_log(true, Some(20.0)),
            create_test_log(true, Some(30.0)),
            create_test_log(true, Some(40.0)),
            create_test_log(true, Some(50.0)),
            create_test_log(false, None),
            create_test_log(false, None),
        ];

        let stats = calculate_latency_stats(&history);

        assert_eq!(stats.total_checks, 7);
        assert_eq!(stats.online_checks, 5);
        assert!((stats.uptime_percentage - 71.43).abs() < 0.1);
        assert_eq!(stats.avg_latency, Some(30.0));
    }

    #[test]
    fn test_calculate_latency_stats_all_offline() {
        let history = vec![
            create_test_log(false, None),
            create_test_log(false, None),
            create_test_log(false, None),
        ];

        let stats = calculate_latency_stats(&history);

        assert_eq!(stats.total_checks, 3);
        assert_eq!(stats.online_checks, 0);
        assert!((stats.uptime_percentage - 0.0).abs() < 0.01);
        assert_eq!(stats.avg_latency, None);
    }

    #[test]
    fn test_calculate_latency_stats_single_entry() {
        let history = vec![create_test_log(true, Some(25.0))];

        let stats = calculate_latency_stats(&history);

        assert_eq!(stats.total_checks, 1);
        assert_eq!(stats.online_checks, 1);
        assert_eq!(stats.avg_latency, Some(25.0));
        assert_eq!(stats.min_latency, Some(25.0));
        assert_eq!(stats.max_latency, Some(25.0));
    }

    #[test]
    fn test_get_uptime_color() {
        assert_eq!(get_uptime_color(99.5), "#4c1");
        assert_eq!(get_uptime_color(99.0), "#4c1");
        assert_eq!(get_uptime_color(96.0), "#97CA00");
        assert_eq!(get_uptime_color(92.0), "#a4a61d");
        assert_eq!(get_uptime_color(80.0), "#dfb317");
        assert_eq!(get_uptime_color(60.0), "#fe7d37");
        assert_eq!(get_uptime_color(40.0), "#e05d44");
        assert_eq!(get_uptime_color(0.0), "#e05d44");
    }

    #[test]
    fn test_get_latency_color() {
        assert_eq!(get_latency_color(25.0), "#4c1");
        assert_eq!(get_latency_color(100.0), "#97CA00");
        assert_eq!(get_latency_color(150.0), "#a4a61d");
        assert_eq!(get_latency_color(200.0), "#dfb317");
        assert_eq!(get_latency_color(250.0), "#fe7d37");
        assert_eq!(get_latency_color(350.0), "#e05d44");
    }

    #[test]
    fn test_format_duration() {
        assert_eq!(format_duration(90061), "1天 1小时");
        assert_eq!(format_duration(3661), "1小时 1分钟");
        assert_eq!(format_duration(61), "1分钟 1秒");
        assert_eq!(format_duration(30), "30秒");
        assert_eq!(format_duration(0), "0秒");
        assert_eq!(format_duration(86400), "1天 0小时");
    }

    #[test]
    fn test_is_within_range() {
        let now = now_gmt8();
        let earlier = now - chrono::Duration::hours(2);
        let later = now + chrono::Duration::hours(2);

        assert!(is_within_range(now, earlier, later));
        assert!(is_within_range(earlier, earlier, later));
        assert!(is_within_range(later, earlier, later));

        let outside_before = earlier - chrono::Duration::hours(1);
        assert!(!is_within_range(outside_before, earlier, later));

        let outside_after = later + chrono::Duration::hours(1);
        assert!(!is_within_range(outside_after, earlier, later));
    }

    #[test]
    fn test_hours_ago() {
        let now = now_gmt8();
        let two_hours_ago = hours_ago(2);
        let diff_duration = now - two_hours_ago;

        let seconds = diff_duration.num_seconds();
        assert!(
            seconds >= 7140 && seconds <= 7260,
            "Expected ~7200s, got {}",
            seconds
        );
    }

    #[test]
    fn test_days_ago() {
        let now = now_gmt8();
        let seven_days_ago = days_ago(7);
        let diff_duration = now - seven_days_ago;

        let seconds = diff_duration.num_seconds();
        assert!(
            seconds >= 604740 && seconds <= 604860,
            "Expected ~604800s, got {}",
            seconds
        );
    }

    #[test]
    fn test_start_of_day() {
        let time = now_gmt8();
        let start = start_of_day(time);

        // 应该是今天的 00:00:00
        assert_eq!(start.hour(), 0);
        assert_eq!(start.minute(), 0);
        assert_eq!(start.second(), 0);
        assert_eq!(start.date_naive(), time.date_naive());
    }

    #[test]
    fn test_end_of_day() {
        let time = now_gmt8();
        let end = end_of_day(time);

        // 应该是今天的 23:59:59
        assert_eq!(end.hour(), 23);
        assert_eq!(end.minute(), 59);
        assert_eq!(end.second(), 59);
        assert_eq!(end.date_naive(), time.date_naive());
    }

    #[test]
    fn test_standard_deviation_calculation() {
        // 测试方差和标准差计算（CV 值）
        let history = vec![
            create_test_log(true, Some(100.0)),
            create_test_log(true, Some(110.0)),
            create_test_log(true, Some(90.0)),
            create_test_log(true, Some(100.0)),
        ];

        let stats = calculate_latency_stats(&history);

        // 平均值应该是 100
        assert_eq!(stats.avg_latency, Some(100.0));

        // 标准差应该存在
        assert!(stats.std_dev.is_some());

        // CV（变异系数）应该存在
        assert!(stats.cv.is_some());
    }

    #[test]
    fn test_p95_calculation() {
        // 创建 100 个数据点用于 P95 计算
        let mut history = vec![];
        for i in 0..100 {
            history.push(create_test_log(true, Some(i as f64)));
        }

        let stats = calculate_latency_stats(&history);

        // P95 应该约为第 95 个值
        assert!(stats.p95_latency.is_some());
        let p95 = stats.p95_latency.unwrap();
        assert!(p95 >= 94.0 && p95 <= 96.0); // 允许小的浮动
    }

    #[test]
    fn test_empty_history() {
        let history: Vec<StatusLog> = vec![];
        let stats = calculate_latency_stats(&history);

        assert_eq!(stats.total_checks, 0);
        assert_eq!(stats.online_checks, 0);
        assert_eq!(stats.uptime_percentage, 0.0);
        assert_eq!(stats.avg_latency, None);
    }
}
