use std::path::Path;
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=frontend/src");
    println!("cargo:rerun-if-changed=frontend/package.json");
    println!("cargo:rerun-if-changed=frontend/package-lock.json");
    println!("cargo:rerun-if-changed=frontend/vite.config.js");
    println!("cargo:rerun-if-changed=frontend/index.html");

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
        .status()
        .expect("Failed to execute npm run build");

    if !status.success() {
        panic!("npm run build failed with status: {}", status);
    }
}
