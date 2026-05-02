//! 告警模块

mod napcat;


use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use chrono::{DateTime, Utc};
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::config::NapCatAlertConfig;

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
    /// NapCat 配置
    config: NapCatAlertConfig,
    /// 当前告警状态
    state: Arc<RwLock<AlertState>>,
    /// 连续帧计数
    online_streak: AtomicU32,
    offline_streak: AtomicU32,
    /// 上次告警时间
    last_alert_time: Arc<RwLock<Option<DateTime<Utc>>>>,
}

impl AlertManager {
    /// 创建新的告警管理器
    pub fn new(config: NapCatAlertConfig) -> Self {
        Self {
            config,
            state: Arc::new(RwLock::new(AlertState::Online)),
            online_streak: AtomicU32::new(0),
            offline_streak: AtomicU32::new(0),
            last_alert_time: Arc::new(RwLock::new(None)),
        }
    }
    
    /// 检查并发送告警
    pub async fn check_and_alert(
        &self,
        any_online: bool,
        online_count: u32,
        total_count: u32,
    ) {
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
                    self.send_offline_alert(online_count, total_count).await;
                    *state = AlertState::Offline;
                    *self.last_alert_time.write().await = Some(Utc::now());
                }
            }
            AlertState::Offline => {
                // 检查是否需要发送恢复告警
                if any_online && online_streak >= self.config.online_confirm_frames {
                    info!("节点已恢复，发送通知");
                    self.send_recovery_alert(online_count, total_count).await;
                    *state = AlertState::Online;
                    *self.last_alert_time.write().await = Some(Utc::now());
                } else if !any_online {
                    // 检查是否需要重复告警
                    let should_repeat = if let Some(last_time) = *self.last_alert_time.read().await {
                        let elapsed = (Utc::now() - last_time).num_minutes() as u64;
                        elapsed >= self.config.delta_minutes
                    } else {
                        true
                    };
                    
                    if should_repeat {
                        warn!("所有节点仍然离线，重复发送告警");
                        self.send_offline_alert(online_count, total_count).await;
                        *self.last_alert_time.write().await = Some(Utc::now());
                    }
                }
            }
        }
    }
    
    /// 发送离线告警
    async fn send_offline_alert(&self, online_count: u32, total_count: u32) {
        let message = format!(
            "🚨 节点状态告警\n所有连接入口离线！\n在线: {}/{}\n时间: {}",
            online_count,
            total_count,
            Utc::now().format("%Y-%m-%d %H:%M:%S")
        );
        
        self.send_message(&message).await;
    }
    
    /// 发送恢复告警
    async fn send_recovery_alert(&self, online_count: u32, total_count: u32) {
        let message = format!(
            "✅ 节点已恢复\n在线入口: {}/{}\n时间: {}",
            online_count,
            total_count,
            Utc::now().format("%Y-%m-%d %H:%M:%S")
        );
        
        self.send_message(&message).await;
    }
    
    /// 发送消息到 NapCat
    async fn send_message(&self, message: &str) {
        let url = format!("http://{}/send_group_msg", self.config.host);
        
        for group in &self.config.groups {
            let body = serde_json::json!({
                "group_id": group,
                "message": message
            });
            
            match reqwest::Client::new()
                .post(&url)
                .json(&body)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await
            {
                Ok(resp) => {
                    if resp.status().is_success() {
                        info!("告警消息发送成功: 群 {}", group);
                    } else {
                        warn!("告警消息发送失败: 群 {}, 状态: {}", group, resp.status());
                    }
                }
                Err(e) => {
                    warn!("告警消息发送错误: 群 {}, 错误: {}", group, e);
                }
            }
        }
    }
}
