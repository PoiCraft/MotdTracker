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

pub fn load_config() -> Result<AppConfig, ConfigError> {
    load_config_from_path("config.toml")
}

pub fn load_config_from_path<P: AsRef<Path>>(path: P) -> Result<AppConfig, ConfigError> {
    let path = path.as_ref();
    if !path.exists() {
        return Err(ConfigError::NotFound(path.display().to_string()));
    }
    let content = std::fs::read_to_string(path)?;
    let config: AppConfig = toml::from_str(&content)?;
    Ok(config)
}

pub fn load_config_with_fallback(custom_path: Option<&str>) -> Result<AppConfig, ConfigError> {
    if let Some(path) = custom_path {
        return load_config_from_path(path);
    }
    if Path::new("config.toml").exists() {
        return load_config_from_path("config.toml");
    }
    if Path::new("config.example.toml").exists() {
        tracing::info!("未找到 config.toml，使用 config.example.toml");
        return load_config_from_path("config.example.toml");
    }
    Err(ConfigError::NotFound(
        "未找到 config.toml 或 config.example.toml".to_string(),
    ))
}

#[cfg(feature = "interactive")]
pub fn generate_config_interactive() -> Result<AppConfig, ConfigError> {
    use dialoguer::Input;
    use super::DatabaseConfig;
    
    println!("\n=== MotdTracker 配置向导 ===\n");
    
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
    
    println!("\n=== 数据库配置 ===");
    let database: String = Input::new()
        .with_prompt("SQLite 数据库路径")
        .default("data/motdtracker.db".to_string())
        .interact_text()
        .map_err(|e| ConfigError::NotFound(e.to_string()))?;
    
    let config = AppConfig {
        server_name,
        port,
        poll_interval,
        database: DatabaseConfig {
            path: database,
        },
        nodes: vec![],
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
        let toml_str = r#"
server_name = "TestServer"
poll_interval = 30
port = 8080

[database]
path = "test.db"
"#;
        let config: AppConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.server_name, "TestServer");
        assert_eq!(config.poll_interval, 30);
        assert_eq!(config.database.path, "test.db");
    }

    #[test]
    fn test_config_with_defaults() {
        let toml_str = r#"
server_name = "MyServer"

[database]
path = "data.db"
"#;
        let config: AppConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.poll_interval, 60);
        assert_eq!(config.port, 5011);
        assert_eq!(config.database.path, "data.db");
    }
}
