use std::sync::OnceLock;

static VERSION: OnceLock<String> = OnceLock::new();

/// 获取应用版本号
/// 格式: v{version}-{timestamp}-{git_hash}
pub fn get_version() -> &'static str {
    VERSION.get_or_init(|| {
        let version = env!("CARGO_PKG_VERSION");
        
        // 尝试获取git信息
        let git_hash = std::process::Command::new("git")
            .args(&["rev-parse", "--short", "HEAD"])
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "unknown".to_string());
        
        let timestamp = chrono::Utc::now().format("%Y%m%d%H%M%S");
        
        format!("v{}-{}-{}", version, timestamp, git_hash)
    })
}
