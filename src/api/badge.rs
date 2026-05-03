use axum::{
    extract::{Path, State},
    response::Response,
    routing::get,
    Router,
};
use serde::Deserialize;

use super::AppState;
use crate::utils::{get_latency_color, get_uptime_color, now_gmt8};

#[derive(Deserialize)]
struct HoursQuery {
    #[serde(default = "default_hours")]
    hours: u32,
}

fn default_hours() -> u32 {
    24
}

#[derive(Deserialize)]
struct StatQuery {
    #[serde(default = "default_stat")]
    stat: String,
    #[serde(default = "default_hours")]
    hours: u32,
}

fn default_stat() -> String {
    "avg".to_string()
}

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/server/status", get(badge_server_status))
        .route("/server/uptime", get(badge_server_uptime))
        .route("/server/players", get(badge_server_players))
        .route("/node/:id/status", get(badge_node_status))
        .route("/node/:id/uptime", get(badge_node_uptime))
        .route("/node/:id/latency", get(badge_node_latency))
        .route("/node/:id/latency-stats", get(badge_node_latency_stats))
        .route("/node/:id/players", get(badge_node_players))
        .route("/player/:name/status", get(badge_player_status))
        .route(
            "/player/:name/current-session",
            get(badge_player_current_session),
        )
        .route(
            "/player/:name/period-playtime",
            get(badge_player_period_playtime),
        )
        .route("/player/:name/live", get(badge_player_live))
}

// Verdana 11px character width lookup table (CSS pixels).
// Source: anafanafo (github.com/metabolize/anafanafo) — verdana-11px-normal.json
// Indexed by ASCII code - 32 (space through tilde).
const VERDANA_11PX_WIDTHS: [f64; 95] = [
    3.87,  // 32  (space)
    4.33,  // 33  !
    5.05,  // 34  "
    9.00,  // 35  #
    6.99,  // 36  $
    11.84, // 37  %
    7.99,  // 38  &
    2.95,  // 39  '
    5.00,  // 40  (
    5.00,  // 41  )
    6.99,  // 42  *
    9.00,  // 43  +
    4.00,  // 44  ,
    5.00,  // 45  -
    4.00,  // 46  .
    5.00,  // 47  /
    6.99,  // 48  0
    6.99,  // 49  1
    6.99,  // 50  2
    6.99,  // 51  3
    6.99,  // 52  4
    6.99,  // 53  5
    6.99,  // 54  6
    6.99,  // 55  7
    6.99,  // 56  8
    6.99,  // 57  9
    5.00,  // 58  :
    5.00,  // 59  ;
    9.00,  // 60  <
    9.00,  // 61  =
    9.00,  // 62  >
    6.00,  // 63  ?
    11.00, // 64  @
    7.52,  // 65  A
    7.54,  // 66  B
    7.68,  // 67  C
    8.48,  // 68  D
    6.96,  // 69  E
    6.32,  // 70  F
    8.53,  // 71  G
    8.27,  // 72  H
    4.63,  // 73  I
    5.00,  // 74  J
    7.62,  // 75  K
    6.12,  // 76  L
    9.27,  // 77  M
    8.23,  // 78  N
    8.66,  // 79  O
    6.63,  // 80  P
    8.66,  // 81  Q
    7.65,  // 82  R
    7.52,  // 83  S
    6.78,  // 84  T
    8.05,  // 85  U
    7.52,  // 86  V
    10.88, // 87  W
    7.54,  // 88  X
    6.77,  // 89  Y
    7.54,  // 90  Z
    5.00,  // 91  [
    5.00,  // 92  backslash
    5.00,  // 93  ]
    9.00,  // 94  ^
    6.99,  // 95  _
    6.99,  // 96  `
    6.61,  // 97  a
    6.85,  // 98  b
    5.73,  // 99  c
    6.85,  // 100 d
    6.55,  // 101 e
    3.87,  // 102 f
    6.85,  // 103 g
    6.96,  // 104 h
    3.02,  // 105 i
    3.79,  // 106 j
    6.51,  // 107 k
    3.02,  // 108 l
    10.70, // 109 m
    6.96,  // 110 n
    6.68,  // 111 o
    6.85,  // 112 p
    6.85,  // 113 q
    4.69,  // 114 r
    5.73,  // 115 s
    4.33,  // 116 t
    6.96,  // 117 u
    6.51,  // 118 v
    9.00,  // 119 w
    6.51,  // 120 x
    6.51,  // 121 y
    5.78,  // 122 z
    6.98,  // 123 {
    5.00,  // 124 |
    6.98,  // 125 }
    9.00,  // 126 ~
];

fn char_width(ch: char) -> f64 {
    let code = ch as usize;
    if (32..=126).contains(&code) {
        VERDANA_11PX_WIDTHS[code - 32]
    } else if is_cjk(ch) {
        // CJK ideographs are full-width (~1em = 11px at 11px font-size).
        // Browser will fall back to a system CJK font since Verdana has no CJK glyphs.
        11.0
    } else if is_cjk_punctuation(ch) {
        // CJK punctuation and symbols
        6.0
    } else {
        // Latin-extended, Cyrillic, etc. — approximate as average Latin width
        7.0
    }
}

fn is_cjk(ch: char) -> bool {
    matches!(ch,
        '\u{2E80}'..='\u{2EFF}'   |  // CJK Radicals Supplement
        '\u{2F00}'..='\u{2FDF}'   |  // Kangxi Radicals
        '\u{3040}'..='\u{309F}'   |  // Hiragana
        '\u{30A0}'..='\u{30FF}'   |  // Katakana
        '\u{3100}'..='\u{312F}'   |  // Bopomofo
        '\u{31A0}'..='\u{31BF}'   |  // Bopomofo Extended
        '\u{31F0}'..='\u{31FF}'   |  // Katakana Phonetic Extensions
        '\u{3400}'..='\u{4DBF}'   |  // CJK Unified Ideographs Extension A
        '\u{4E00}'..='\u{9FFF}'   |  // CJK Unified Ideographs
        '\u{F900}'..='\u{FAFF}'   |  // CJK Compatibility Ideographs
        '\u{FE30}'..='\u{FE4F}'   |  // CJK Compatibility Forms
        '\u{20000}'..='\u{2A6DF}' |  // CJK Unified Ideographs Extension B
        '\u{2A700}'..='\u{2B73F}' |  // CJK Unified Ideographs Extension C
        '\u{2B740}'..='\u{2B81F}' |  // CJK Unified Ideographs Extension D
        '\u{2B820}'..='\u{2CEAF}' |  // CJK Unified Ideographs Extension E
        '\u{2CEB0}'..='\u{2EBEF}' |  // CJK Unified Ideographs Extension F
        '\u{30000}'..='\u{3134F}'    // CJK Unified Ideographs Extension G
    )
}

fn is_cjk_punctuation(ch: char) -> bool {
    matches!(ch,
        '\u{3000}'..='\u{303F}'   |  // CJK Symbols and Punctuation
        '\u{FF01}'..='\u{FF0F}'   |  // Fullwidth punctuation ！＂＃...
        '\u{FF1A}'..='\u{FF20}'   |  // Fullwidth punctuation ：；＜...
        '\u{FF3B}'..='\u{FF40}'   |  // Fullwidth punctuation ［＼］...
        '\u{FF5B}'..='\u{FF5E}'   |  // Fullwidth punctuation ｛｜｝～
        '\u{FE10}'..='\u{FE1F}'   |  // Vertical forms
        '\u{FE50}'..='\u{FE6F}'    // Small Form Variants
    )
}

fn preferred_width_of(text: &str) -> u32 {
    let raw: f64 = text.chars().map(char_width).sum();
    let truncated = raw as u32;
    if truncated % 2 == 0 {
        truncated + 1
    } else {
        truncated
    }
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn generate_badge(label: &str, value: &str, color: &str) -> String {
    const HORIZ_PADDING: u32 = 5;
    const BADGE_HEIGHT: u32 = 20;
    const SCALE: u32 = 10;

    let label_color = "#555";

    let label_width = if label.is_empty() {
        0
    } else {
        preferred_width_of(label)
    };
    let left_width = if label.is_empty() {
        0
    } else {
        label_width + 2 * HORIZ_PADDING
    };
    let value_width = preferred_width_of(value);
    let value_margin = if left_width > 0 { left_width - 1 } else { 1 };
    let right_width = value_width + 2 * HORIZ_PADDING;
    let total_width = left_width + right_width;

    let label_x = SCALE + SCALE * label_width / 2 + SCALE * HORIZ_PADDING;
    let value_x = SCALE * value_margin + SCALE * value_width / 2 + SCALE * HORIZ_PADDING;
    let label_text_len = SCALE * label_width;
    let value_text_len = SCALE * value_width;

    let accessible_text = if label.is_empty() {
        value.to_string()
    } else {
        format!("{}: {}", label, value)
    };
    let escaped_accessible = xml_escape(&accessible_text);
    let escaped_label = xml_escape(label);
    let escaped_value = xml_escape(value);

    let mut svg = String::with_capacity(1024);

    svg.push_str(r##"<svg xmlns="http://www.w3.org/2000/svg" width=""##);
    push_u32(&mut svg, total_width);
    svg.push_str(r##"" height=""##);
    push_u32(&mut svg, BADGE_HEIGHT);
    svg.push_str(r##"" role="img" aria-label=""##);
    svg.push_str(&escaped_accessible);
    svg.push_str(r##""><title>"##);
    svg.push_str(&escaped_accessible);
    svg.push_str(r##"</title><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width=""##);
    push_u32(&mut svg, total_width);
    svg.push_str(r##"" height=""##);
    push_u32(&mut svg, BADGE_HEIGHT);
    svg.push_str(r##"" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)">"##);

    if left_width > 0 {
        svg.push_str(r##"<rect width=""##);
        push_u32(&mut svg, left_width);
        svg.push_str(r##"" height=""##);
        push_u32(&mut svg, BADGE_HEIGHT);
        svg.push_str(r##"" fill=""##);
        svg.push_str(label_color);
        svg.push_str(r##""/>"##);
    }

    svg.push_str(r##"<rect x=""##);
    push_u32(&mut svg, left_width);
    svg.push_str(r##"" width=""##);
    push_u32(&mut svg, right_width);
    svg.push_str(r##"" height=""##);
    push_u32(&mut svg, BADGE_HEIGHT);
    svg.push_str(r##"" fill=""##);
    svg.push_str(color);
    svg.push_str(r##""/><rect width=""##);
    push_u32(&mut svg, total_width);
    svg.push_str(r##"" height=""##);
    push_u32(&mut svg, BADGE_HEIGHT);
    svg.push_str(r##"" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">"##);

    if !label.is_empty() {
        push_text_elements(&mut svg, label_x, label_text_len, &escaped_label);
    }

    push_text_elements(&mut svg, value_x, value_text_len, &escaped_value);

    svg.push_str("</g></svg>");
    svg
}

fn push_text_elements(svg: &mut String, x: u32, text_len: u32, content: &str) {
    svg.push_str(r##"<text aria-hidden="true" x=""##);
    push_u32(svg, x);
    svg.push_str(
        r##"" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength=""##,
    );
    push_u32(svg, text_len);
    svg.push_str(r##"">"##);
    svg.push_str(content);
    svg.push_str(r##"</text><text x=""##);
    push_u32(svg, x);
    svg.push_str(r##"" y="140" transform="scale(.1)" fill="#fff" textLength=""##);
    push_u32(svg, text_len);
    svg.push_str(r##"">"##);
    svg.push_str(content);
    svg.push_str("</text>");
}

fn push_u32(buf: &mut String, val: u32) {
    use std::fmt::Write;
    let _ = write!(buf, "{}", val);
}

fn svg_response(svg: String) -> Response {
    Response::builder()
        .header("Content-Type", "image/svg+xml")
        .header("Cache-Control", "no-cache")
        .body(svg.into())
        .unwrap()
}

async fn badge_server_status(State(state): State<AppState>) -> Response {
    let latest_status = state.db.get_all_latest_status().await.ok();

    let (status_text, color) = if let Some(statuses) = latest_status {
        let online_count = statuses.iter().filter(|s| s.online).count();
        let total = statuses.len();

        if online_count == total && total > 0 {
            ("online", "#4c1")
        } else if online_count > 0 {
            ("partial", "#dfb317")
        } else {
            ("offline", "#e05d44")
        }
    } else {
        ("unknown", "#9f9f9f")
    };

    svg_response(generate_badge("status", status_text, color))
}

async fn badge_server_uptime(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Response {
    let hours = query.hours.clamp(1, 720);
    let history = state.db.get_all_history(hours).await.ok();

    let uptime_text = if let Some(history) = history {
        let mut total_checks = 0u32;
        let mut online_checks = 0u32;

        for logs in history.values() {
            total_checks += logs.len() as u32;
            online_checks += logs.iter().filter(|l| l.online).count() as u32;
        }

        if total_checks > 0 {
            let rate = (online_checks as f64 / total_checks as f64) * 100.0;
            format!("{:.1}%", rate)
        } else {
            "N/A".to_string()
        }
    } else {
        "N/A".to_string()
    };

    let uptime_value = uptime_text
        .trim_end_matches('%')
        .parse::<f64>()
        .unwrap_or(0.0);
    let color = get_uptime_color(uptime_value);

    svg_response(generate_badge("uptime", &uptime_text, color))
}

async fn badge_server_players(State(state): State<AppState>) -> Response {
    let latest_status = state.db.get_all_latest_status().await.ok();

    let players_text = if let Some(statuses) = latest_status {
        let online: u32 = statuses
            .iter()
            .filter_map(|s| s.players_online.map(|n| n as u32))
            .sum();
        let max: u32 = statuses
            .iter()
            .filter_map(|s| s.players_max.map(|n| n as u32))
            .sum();

        format!("{}/{}", online, max)
    } else {
        "N/A".to_string()
    };

    svg_response(generate_badge("players", &players_text, "#007ec6"))
}

async fn badge_node_status(State(state): State<AppState>, Path(id): Path<i32>) -> Response {
    let latest_status = state.db.get_server_latest_status(id).await.ok().flatten();

    let (status_text, color) = if let Some(status) = latest_status {
        if status.online {
            ("online", "#4c1")
        } else {
            ("offline", "#e05d44")
        }
    } else {
        ("unknown", "#9f9f9f")
    };

    svg_response(generate_badge("status", status_text, color))
}

async fn badge_node_uptime(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Response {
    let hours = query.hours.clamp(1, 720);
    let start = now_gmt8() - chrono::Duration::hours(hours as i64);
    let end = now_gmt8();

    let history = state.db.get_server_history_range(id, start, end).await.ok();

    let uptime_text = if let Some(logs) = history {
        let total = logs.len() as u32;
        let online = logs.iter().filter(|l| l.online).count() as u32;
        if total > 0 {
            let rate = (online as f64 / total as f64) * 100.0;
            format!("{:.1}%", rate)
        } else {
            "N/A".to_string()
        }
    } else {
        "N/A".to_string()
    };

    let uptime_value = uptime_text
        .trim_end_matches('%')
        .parse::<f64>()
        .unwrap_or(0.0);
    let color = get_uptime_color(uptime_value);

    svg_response(generate_badge("uptime", &uptime_text, color))
}

async fn badge_node_latency(State(state): State<AppState>, Path(id): Path<i32>) -> Response {
    let latest_status = state.db.get_server_latest_status(id).await.ok().flatten();

    let (latency_text, color) = if let Some(status) = latest_status {
        if status.online {
            if let Some(lat) = status.latency {
                (
                    format!("{}ms", lat.round() as u32),
                    get_latency_color(lat).to_string(),
                )
            } else {
                ("N/A".to_string(), "#9f9f9f".to_string())
            }
        } else {
            ("offline".to_string(), "#e05d44".to_string())
        }
    } else {
        ("unknown".to_string(), "#9f9f9f".to_string())
    };

    svg_response(generate_badge("latency", &latency_text, &color))
}

async fn badge_node_latency_stats(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    axum::extract::Query(query): axum::extract::Query<StatQuery>,
) -> Response {
    let hours = query.hours.clamp(1, 720);
    let start = now_gmt8() - chrono::Duration::hours(hours as i64);
    let end = now_gmt8();

    let history = state
        .db
        .get_server_history_range(id, start, end)
        .await
        .unwrap_or_default();
    let stats = crate::utils::calculate_latency_stats(&history);

    let (label, value, color) = match query.stat.as_str() {
        "avg" => {
            let v = stats.avg_latency.unwrap_or(0.0);
            (
                "avg latency".to_string(),
                format!("{}ms", v.round() as u32),
                get_latency_color(v).to_string(),
            )
        }
        "min" => {
            let v = stats.min_latency.unwrap_or(0.0);
            (
                "min latency".to_string(),
                format!("{}ms", v.round() as u32),
                get_latency_color(v).to_string(),
            )
        }
        "max" => {
            let v = stats.max_latency.unwrap_or(0.0);
            (
                "max latency".to_string(),
                format!("{}ms", v.round() as u32),
                get_latency_color(v).to_string(),
            )
        }
        "std" => {
            let v = stats.std_dev.unwrap_or(0.0);
            (
                "std dev".to_string(),
                format!("{}ms", v.round() as u32),
                "#007ec6".to_string(),
            )
        }
        "cv" => {
            let v = stats.cv.unwrap_or(0.0);
            (
                "cv".to_string(),
                format!("{:.1}%", v),
                "#007ec6".to_string(),
            )
        }
        "p95" => {
            let v = stats.p95_latency.unwrap_or(0.0);
            (
                "p95".to_string(),
                format!("{}ms", v.round() as u32),
                get_latency_color(v).to_string(),
            )
        }
        _ => {
            let v = stats.avg_latency.unwrap_or(0.0);
            (
                "avg latency".to_string(),
                format!("{}ms", v.round() as u32),
                get_latency_color(v).to_string(),
            )
        }
    };

    svg_response(generate_badge(&label, &value, &color))
}

async fn badge_node_players(State(state): State<AppState>, Path(id): Path<i32>) -> Response {
    let latest_status = state.db.get_server_latest_status(id).await.ok().flatten();

    let players_text = if let Some(status) = latest_status {
        let online = status.players_online.map(|n| n as u32).unwrap_or(0);
        let max = status.players_max.map(|n| n as u32).unwrap_or(0);
        format!("{}/{}", online, max)
    } else {
        "N/A".to_string()
    };

    svg_response(generate_badge("players", &players_text, "#007ec6"))
}

async fn badge_player_status(State(state): State<AppState>, Path(name): Path<String>) -> Response {
    let detail = state.db.get_player_detail(&name).await.ok().flatten();

    let (status_text, color) = if let Some(d) = detail {
        if d.online {
            ("online", "#4c1")
        } else {
            ("offline", "#e05d44")
        }
    } else {
        ("unknown", "#9f9f9f")
    };

    svg_response(generate_badge("status", status_text, color))
}

async fn badge_player_current_session(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Response {
    let detail = state.db.get_player_detail(&name).await.ok().flatten();

    let (text, color) = if let Some(d) = detail {
        if d.online {
            if let Some(secs) = d.duration_seconds {
                let hours = secs / 3600;
                let minutes = (secs % 3600) / 60;
                if hours > 0 {
                    (format!("{}h {}m", hours, minutes), "#4c1".to_string())
                } else {
                    (format!("{}m", minutes), "#4c1".to_string())
                }
            } else {
                ("online".to_string(), "#4c1".to_string())
            }
        } else {
            ("offline".to_string(), "#e05d44".to_string())
        }
    } else {
        ("unknown".to_string(), "#9f9f9f".to_string())
    };

    svg_response(generate_badge("session", &text, &color))
}

async fn badge_player_period_playtime(
    State(state): State<AppState>,
    Path(name): Path<String>,
    axum::extract::Query(query): axum::extract::Query<HoursQuery>,
) -> Response {
    let hours = query.hours.clamp(1, 720);
    let days = (hours + 23) / 24;
    let history = state
        .db
        .get_player_history(&name, Some(days))
        .await
        .unwrap_or_default();

    let cutoff = now_gmt8() - chrono::Duration::hours(hours as i64);
    let mut total_secs = 0i64;

    for h in &history {
        if h.session_end <= h.session_start {
            continue;
        }
        let start = if h.session_start < cutoff {
            cutoff
        } else {
            h.session_start
        };
        let dur = (h.session_end - start).num_seconds();
        if dur > 0 {
            total_secs += dur;
        }
    }

    let text = if total_secs <= 0 {
        "0m".to_string()
    } else {
        let h = total_secs / 3600;
        let m = (total_secs % 3600) / 60;
        if h > 0 {
            format!("{}h {}m", h, m)
        } else {
            format!("{}m", m)
        }
    };

    svg_response(generate_badge("playtime", &text, "#007ec6"))
}

async fn badge_player_live(State(state): State<AppState>, Path(name): Path<String>) -> Response {
    let detail = state.db.get_player_detail(&name).await.ok().flatten();

    let (text, color) = if let Some(d) = detail {
        if d.online {
            let server_names: Vec<String> = d
                .servers
                .iter()
                .filter(|s| s.online)
                .map(|s| s.server_name.clone())
                .collect();
            if server_names.is_empty() {
                ("online".to_string(), "#4c1".to_string())
            } else {
                (server_names.join(", "), "#4c1".to_string())
            }
        } else {
            let ago = if d.last_seen.timestamp() > 0 {
                let diff = now_gmt8() - d.last_seen;
                let mins = diff.num_minutes();
                if mins < 60 {
                    format!("{}m ago", mins)
                } else if mins < 1440 {
                    format!("{}h ago", mins / 60)
                } else {
                    format!("{}d ago", mins / 1440)
                }
            } else {
                "offline".to_string()
            };
            (ago, "#e05d44".to_string())
        }
    } else {
        ("unknown".to_string(), "#9f9f9f".to_string())
    };

    svg_response(generate_badge("live", &text, &color))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preferred_width_of() {
        assert_eq!(preferred_width_of("label"), 27);
        assert_eq!(preferred_width_of("value"), 29);
        assert_eq!(preferred_width_of("build"), 27);
        assert_eq!(preferred_width_of("passing"), 41);
        assert_eq!(preferred_width_of("online"), 33);
        assert_eq!(preferred_width_of("offline"), 33);
        assert_eq!(preferred_width_of("N/A"), 21);
    }

    #[test]
    fn test_generate_badge_structure() {
        let svg = generate_badge("label", "value", "#007ec6");
        assert!(svg.starts_with(r##"<svg xmlns="http://www.w3.org/2000/svg""##));
        assert!(svg.contains(r##"role="img""##));
        assert!(svg.contains(r##"aria-label="label: value""##));
        assert!(svg.contains("<title>label: value</title>"));
        assert!(svg.contains(r##"<linearGradient id="s""##));
        assert!(svg.contains(r##"<clipPath id="r">"##));
        assert!(svg.contains(r##"clip-path="url(#r)""##));
        assert!(svg.contains(r##"fill="#555""##));
        assert!(svg.contains(r##"fill="#007ec6""##));
        assert!(svg.contains(r##"fill="#010101" fill-opacity=".3""##));
        assert!(svg.contains(r##"font-family="Verdana,Geneva,DejaVu Sans,sans-serif""##));
        assert!(svg.contains(r##"text-rendering="geometricPrecision""##));
        assert!(svg.contains(r##"font-size="110""##));
        assert!(svg.contains(r##"transform="scale(.1)""##));
        assert!(svg.contains(r##"textLength="270""##));
        assert!(svg.contains(r##"textLength="290""##));
        assert!(svg.ends_with("</svg>"));
    }

    #[test]
    fn test_generate_badge_widths() {
        let svg = generate_badge("label", "value", "#007ec6");
        assert!(svg.contains(r##"width="76" height="20""##));
    }

    #[test]
    fn test_generate_badge_matches_shields_io() {
        let svg = generate_badge("build", "passing", "#4c1");
        assert_eq!(
            svg,
            r##"<svg xmlns="http://www.w3.org/2000/svg" width="88" height="20" role="img" aria-label="build: passing"><title>build: passing</title><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="88" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="37" height="20" fill="#555"/><rect x="37" width="51" height="20" fill="#4c1"/><rect width="88" height="20" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110"><text aria-hidden="true" x="195" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="270">build</text><text x="195" y="140" transform="scale(.1)" fill="#fff" textLength="270">build</text><text aria-hidden="true" x="615" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="410">passing</text><text x="615" y="140" transform="scale(.1)" fill="#fff" textLength="410">passing</text></g></svg>"##
        );
    }

    #[test]
    fn test_xml_escape() {
        assert_eq!(xml_escape("a & b"), "a &amp; b");
        assert_eq!(xml_escape("<tag>"), "&lt;tag&gt;");
        assert_eq!(xml_escape(r#"a "b" c"#), "a &quot;b&quot; c");
    }

    #[test]
    fn test_cjk_char_width() {
        // CJK characters should be ~11px (full-width)
        assert_eq!(char_width('中'), 11.0);
        assert_eq!(char_width('文'), 11.0);
        assert_eq!(char_width('服'), 11.0);
        // Fullwidth punctuation
        assert_eq!(char_width('，'), 6.0);
        assert_eq!(char_width('。'), 6.0);
        // ASCII still works
        assert_eq!(char_width('a'), 6.61);
        assert_eq!(char_width('A'), 7.52);
    }

    #[test]
    fn test_cjk_badge_width() {
        // Chinese text should produce wider badges
        let svg = generate_badge("status", "在线", "#4c1");
        // "在线" = 2 CJK chars × 11px = 22, roundUpToOdd(22) = 23
        // value rect = 23 + 10 = 33
        // "status" = 33.69px -> roundUpToOdd(33) = 33
        // label rect = 33 + 10 = 43
        // total = 43 + 33 = 76
        assert!(svg.contains(r##"width="76" height="20""##));
        assert!(svg.contains("在线"));
    }
}
