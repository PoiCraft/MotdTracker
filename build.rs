use std::path::Path;
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=frontend/src");
    println!("cargo:rerun-if-changed=frontend/package.json");
    println!("cargo:rerun-if-changed=frontend/package-lock.json");
    println!("cargo:rerun-if-changed=frontend/vite.config.js");
    println!("cargo:rerun-if-changed=frontend/index.html");
    println!("cargo:rerun-if-changed=.git/HEAD");
    if let Ok(head) = std::fs::read_to_string(".git/HEAD") {
        let head = head.trim();
        if let Some(ref_path) = head.strip_prefix("ref: ") {
            println!("cargo:rerun-if-changed=.git/{}", ref_path);
        }
    }

    // Generate pseudo version: vA.B.C-yyyyMMddhhmmss-{git-hash-short}
    let pkg_version = std::env::var("CARGO_PKG_VERSION").unwrap();
    let git_hash = Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let now = {
        use std::time::{SystemTime, UNIX_EPOCH};
        let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
        let secs = duration.as_secs();
        let tm = time_from_epoch(secs);
        format!(
            "{:04}{:02}{:02}{:02}{:02}{:02}",
            tm.0, tm.1, tm.2, tm.3, tm.4, tm.5
        )
    };
    let app_version = format!("v{}-{}-{}", pkg_version, now, git_hash);
    println!("cargo:rustc-env=APP_VERSION={}", app_version);

    let npm = if cfg!(target_os = "windows") {
        "npm.cmd"
    } else {
        "npm"
    };

    if !Path::new("frontend/node_modules").exists() {
        let status = Command::new(npm)
            .args(["ci"])
            .current_dir("frontend")
            .status()
            .expect("Failed to execute npm ci");

        if !status.success() {
            panic!("npm ci failed with status: {}", status);
        }
    }

    let status = Command::new(npm)
        .args(["run", "build"])
        .current_dir("frontend")
        .env("APP_VERSION", &app_version)
        .status()
        .expect("Failed to execute npm run build");

    if !status.success() {
        panic!("npm run build failed with status: {}", status);
    }
}

/// Convert Unix epoch seconds to (year, month, day, hour, minute, second) in UTC.
fn time_from_epoch(secs: u64) -> (u32, u32, u32, u32, u32, u32) {
    let mut z = secs / 86400;
    let hms = secs % 86400;
    let hour = (hms / 3600) as u32;
    let minute = ((hms % 3600) / 60) as u32;
    let second = (hms % 60) as u32;

    z += 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let month = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let year = if month <= 2 { y + 1 } else { y } as u32;

    (year, month, day, hour, minute, second)
}
