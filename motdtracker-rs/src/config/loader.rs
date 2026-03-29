//! 配置加载器

use std::path::Path;

use super::AppConfig;
use thiserror::Error;

/// 配置加载错误
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("配置文件未找到: {0}")]
    NotFound(String),
    
    #[error("配置文件解析错误: {0}")]
    ParseError(#[from] toml::de::Error),
    
    #[error("IO 错误: {0}")]
    IoError(#[from] std::io::Error),
}

/// 加载配置文件
///
/// 按以下顺序查找配置文件：
/// 1. `config.toml`（当前目录）
/// 2. `config.example.toml`（示例配置）
pub fn load_config() -> Result<AppConfig, ConfigError> {
    load_config_from_path("config.toml")
}

/// 从指定路径加载配置文件
pub fn load_config_from_path<P: AsRef<Path>>(path: P) -> Result<AppConfig, ConfigError> {
    let path = path.as_ref();
    
    if !path.exists() {
        return Err(ConfigError::NotFound(path.display().to_string()));
    }
    
    let content = std::fs::read_to_string(path)?;
    let config: AppConfig = toml::from_str(&content)?;
    
    Ok(config)
}

/// 加载配置文件，支持自定义路径和交互式生成
pub fn load_config_with_fallback(custom_path: Option<&str>) -> Result<AppConfig, ConfigError> {
    // 如果指定了自定义路径，优先使用
    if let Some(path) = custom_path {
        return load_config_from_path(path);
    }
    
    // 尝试加载默认配置
    if Path::new("config.toml").exists() {
        return load_config_from_path("config.toml");
    }
    
    // 尝试加载示例配置
    if Path::new("config.example.toml").exists() {
        tracing::info!("未找到 config.toml，使用 config.example.toml");
        return load_config_from_path("config.example.toml");
    }
    
    Err(ConfigError::NotFound(
        "未找到 config.toml 或 config.example.toml".to_string(),
    ))
}

/// 交互式生成配置文件
#[cfg(feature = "interactive")]
pub fn generate_config_interactive() -> Result<AppConfig, ConfigError> {
    use dialoguer::Input;
    
    println!("\n=== MotdTracker 配置向导 ===\n");
    
    // 基本配置
    let server_name: String = Input::new()
        .with_prompt("服务器名称")
        .default("MotdTracker".to_string())
        .interact_text()
        .map_err(|e| ConfigError::NotFound(e.to_string()))?;
    
    let port: u16 = Input::new()
        .with_prompt("监听端口")
        .default(5011u16)
        .interact_text()
        .map_err(|e| ConfigError::NotFound(e.to_string()))?;
    
    let poll_interval: u64 = Input::new()
        .with_prompt("轮询间隔（秒）")
        .default(60u64)
        .interact_text()
        .map_err(|e| ConfigError::NotFound(e.to_string()))?;
    
    // 数据库配置
    println!("\n=== 数据库配置 ===");
    let database: String = Input::new()
        .with_prompt("SQLite 数据库路径")
        .default("data/motdtracker.db".to_string())
        .interact_text()
        .map_err(|e| ConfigError::NotFound(e.to_string()))?;
    
    // 创建默认配置
    let config = AppConfig {
        server_name,
        port,
        poll_interval,
        database,
        nodes: vec![], // 可以在配置文件中手动添加
        postgresql: None,
        napcat_alert: None,
        umami: None,
    };
    
    Ok(config)
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let toml_str = r###"
server_name = "TestServer"
database = "test.db"
poll_interval = 30
port = 8080

[[nodes]]
id = 1
name = "主节点"
host = "localhost"
port = 25565
color = "#ff0000"
enable = true
"###;
        let config: AppConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.server_name, "TestServer");
        assert_eq!(config.nodes.len(), 1);
        assert_eq!(config.nodes[0].name, "主节点");
    }
}
