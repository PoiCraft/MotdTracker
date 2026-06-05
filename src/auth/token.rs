//! 会话令牌工具

use uuid::Uuid;

/// 生成新的会话令牌
pub fn generate_session_token() -> String {
    Uuid::new_v4().to_string().replace('-', "")
}

/// 验证令牌格式（非空且长度合理）
pub fn validate_token_format(token: &str) -> bool {
    !token.is_empty() && token.len() >= 32 && token.len() <= 128
}
