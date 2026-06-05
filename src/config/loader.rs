//! 配置加载器

use std::env;
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

    #[error("环境变量 {name} 值无效: {value} ({message})")]
    InvalidEnvVar {
        name: String,
        value: String,
        message: String,
    },

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
    let mut config: AppConfig = toml::from_str(&content)?;
    apply_env_overrides(&mut config)?;
    validate_config(&config)?;
    Ok(config)
}

fn apply_env_overrides(config: &mut AppConfig) -> Result<(), ConfigError> {
    if let Some(value) = read_env_parsed::<u64>("MOTDTRACKER_POLL_INTERVAL")? {
        config.poll_interval = value;
    }

    if let Some(value) = read_env_parsed::<u16>("MOTDTRACKER_PORT")? {
        config.port = value;
    }

    if let Some(value) = read_env_string("MOTDTRACKER_DATABASE_PATH") {
        config.database.path = value;
    }

    if let Some(value) = read_env_string("MOTDTRACKER_CORS_ORIGIN") {
        config.cors_origin = value;
    }

    Ok(())
}

fn read_env_string(name: &str) -> Option<String> {
    env::var(name).ok().filter(|value| !value.trim().is_empty())
}

fn read_env_parsed<T>(name: &str) -> Result<Option<T>, ConfigError>
where
    T: std::str::FromStr,
    T::Err: std::fmt::Display,
{
    match env::var(name) {
        Ok(value) if value.trim().is_empty() => Ok(None),
        Ok(value) => value
            .parse::<T>()
            .map(Some)
            .map_err(|error| ConfigError::InvalidEnvVar {
                name: name.to_string(),
                value,
                message: error.to_string(),
            }),
        Err(env::VarError::NotPresent) => Ok(None),
        Err(error) => Err(ConfigError::InvalidEnvVar {
            name: name.to_string(),
            value: String::new(),
            message: error.to_string(),
        }),
    }
}

fn validate_config(_config: &AppConfig) -> Result<(), ConfigError> {
    // 节点校验已不再需要（业务配置完全由数据库管理）
    Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let toml_str = r#"
poll_interval = 30
port = 8080

[database]
path = "test.db"
"#;
        let config: AppConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.poll_interval, 30);
        assert_eq!(config.database.path, "test.db");
    }

    #[test]
    fn test_config_with_defaults() {
        let toml_str = r#"

[database]
path = "data.db"
"#;
        let config: AppConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.poll_interval, 60);
        assert_eq!(config.port, 5011);
        assert_eq!(config.database.path, "data.db");
    }

    #[test]
    fn test_env_overrides_file_values() {
        let temp_path = std::env::temp_dir().join("motdtracker-config-env-override.toml");
        let toml_str = r#"
poll_interval = 30
port = 8080

[database]
path = "file.db"
"#;
        std::fs::write(&temp_path, toml_str).unwrap();

        std::env::set_var("MOTDTRACKER_POLL_INTERVAL", "120");
        std::env::set_var("MOTDTRACKER_PORT", "6500");
        std::env::set_var("MOTDTRACKER_DATABASE_PATH", "env.db");

        let config = load_config_from_path(&temp_path).unwrap();

        std::env::remove_var("MOTDTRACKER_POLL_INTERVAL");
        std::env::remove_var("MOTDTRACKER_PORT");
        std::env::remove_var("MOTDTRACKER_DATABASE_PATH");
        let _ = std::fs::remove_file(&temp_path);

        assert_eq!(config.poll_interval, 120);
        assert_eq!(config.port, 6500);
        assert_eq!(config.database.path, "env.db");
    }
}
