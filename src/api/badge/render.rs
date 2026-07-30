//! badge SVG 渲染模块（纯函数）
//!
//! 字宽表、XML 转义、shields.io 风格 SVG 生成。无数据库依赖，独立可测。

use axum::response::Response;

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
    if truncated.is_multiple_of(2) {
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

pub fn generate_badge(label: &str, value: &str, color: &str) -> String {
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

pub fn svg_response(svg: String) -> Response {
    Response::builder()
        .header("Content-Type", "image/svg+xml")
        .header("Cache-Control", "no-cache")
        .body(svg.into())
        .unwrap()
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
