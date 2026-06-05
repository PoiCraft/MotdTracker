//! 管理员与配置模型

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AdminUser {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AdminSession {
    pub id: i64,
    pub user_id: i64,
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AppConfigEntry {
    pub key: String,
    pub value: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SetupRequest {
    pub username: String,
    pub password: String,
}
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub old_password: String,
    pub new_password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub server_name: String,
    pub poll_interval: u64,
    pub port: u16,
    pub webhook_alert: Option<WebhookAlertSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookAlertSettings {
    pub url: String,
    #[serde(default = "default_method")]
    pub method: String,
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,
    pub body: String,
    pub delta_minutes: u64,
    pub offline_confirm_frames: u32,
    pub online_confirm_frames: u32,
    pub enable: bool,
}

fn default_method() -> String {
    "POST".to_string()
}
