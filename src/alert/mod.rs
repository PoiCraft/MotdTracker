//! 告警模块

use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::config::WebhookAlertConfig;
use crate::utils::time::{format_gmt8_naive, now_gmt8};

/// 告警状态
#[derive(Debug, Clone)]
pub enum AlertState {
    /// 正常（有节点在线）
    Online,
    /// 离线
    Offline,
}

/// 告警管理器
pub struct AlertManager {
    /// Webhook 配置
    config: WebhookAlertConfig,
    /// 服务器名称（用于模板变量）
    server_name: String,
    /// 当前告警状态
    state: Arc<RwLock<AlertState>>,
    /// 连续帧计数
    online_streak: AtomicU32,
    offline_streak: AtomicU32,
    /// 上次告警时间
    last_alert_time: Arc<RwLock<Option<DateTime<Utc>>>>,
}

/// 渲染模板字符串，替换 {var} 占位符
fn render_template(template: &str, vars: &HashMap<&str, &str>) -> String {
    let mut result = template.to_string();
    for (key, value) in vars {
        result = result.replace(&format!("{{{}}}", key), value);
    }
    result
}

impl AlertManager {
    /// 创建新的告警管理器
    pub fn new(config: WebhookAlertConfig, server_name: String) -> Self {
        Self {
            config,
            server_name,
            state: Arc::new(RwLock::new(AlertState::Online)),
            online_streak: AtomicU32::new(0),
            offline_streak: AtomicU32::new(0),
            last_alert_time: Arc::new(RwLock::new(None)),
        }
    }

    /// 检查并发送告警
    pub async fn check_and_alert(&self, any_online: bool, online_count: u32, total_count: u32) {
        // 更新连续帧计数
        if any_online {
            self.online_streak.fetch_add(1, Ordering::Relaxed);
            self.offline_streak.store(0, Ordering::Relaxed);
        } else {
            self.offline_streak.fetch_add(1, Ordering::Relaxed);
            self.online_streak.store(0, Ordering::Relaxed);
        }

        let offline_streak = self.offline_streak.load(Ordering::Relaxed);
        let online_streak = self.online_streak.load(Ordering::Relaxed);

        let mut state = self.state.write().await;
        let current_state = state.clone();

        match current_state {
            AlertState::Online => {
                // 检查是否需要发送离线告警
                if !any_online && offline_streak >= self.config.offline_confirm_frames {
                    warn!("检测到所有节点离线，发送告警");
                    self.send_webhook("offline", online_count, total_count)
                        .await;
                    *state = AlertState::Offline;
                    *self.last_alert_time.write().await = Some(now_gmt8());
                }
            }
            AlertState::Offline => {
                // 检查是否需要发送恢复告警
                if any_online && online_streak >= self.config.online_confirm_frames {
                    info!("节点已恢复，发送通知");
                    self.send_webhook("recovery", online_count, total_count)
                        .await;
                    *state = AlertState::Online;
                    *self.last_alert_time.write().await = Some(now_gmt8());
                } else if !any_online {
                    // 检查是否需要重复告警
                    let should_repeat = if let Some(last_time) = *self.last_alert_time.read().await
                    {
                        let elapsed = (now_gmt8() - last_time).num_minutes() as u64;
                        elapsed >= self.config.delta_minutes
                    } else {
                        true
                    };

                    if should_repeat {
                        warn!("所有节点仍然离线，重复发送告警");
                        self.send_webhook("offline", online_count, total_count)
                            .await;
                        *self.last_alert_time.write().await = Some(now_gmt8());
                    }
                }
            }
        }
    }

    /// 发送 webhook 通知
    async fn send_webhook(&self, status: &str, online_count: u32, total_count: u32) {
        let status_text = match status {
            "offline" => "离线",
            "recovery" => "恢复",
            _ => "未知",
        };

        let mut vars = HashMap::new();
        let online_count_str = online_count.to_string();
        let total_count_str = total_count.to_string();
        let timestamp_str = format_gmt8_naive(now_gmt8());
        vars.insert("status", status);
        vars.insert("status_text", status_text);
        vars.insert("online_count", &online_count_str);
        vars.insert("total_count", &total_count_str);
        vars.insert("timestamp", &timestamp_str);
        vars.insert("server_name", &self.server_name);

        let body = render_template(&self.config.body, &vars);

        let method = self.config.method.to_uppercase();
        let client = reqwest::Client::new();
        let mut req = match method.as_str() {
            "PUT" => client.put(&self.config.url),
            _ => client.post(&self.config.url),
        };

        // 应用自定义 headers（值支持模板变量）
        for (key, value_template) in &self.config.headers {
            let value = render_template(value_template, &vars);
            req = req.header(key.as_str(), value.as_str());
        }

        req = req
            .body(body.clone())
            .timeout(std::time::Duration::from_secs(10));

        match req.send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    info!("Webhook 告警发送成功: status={}", status);
                } else {
                    warn!(
                        "Webhook 告警发送失败: status={}, http={}",
                        status,
                        resp.status()
                    );
                }
            }
            Err(e) => {
                warn!("Webhook 告警发送错误: status={}, error={}", status, e);
            }
        }
    }
}
