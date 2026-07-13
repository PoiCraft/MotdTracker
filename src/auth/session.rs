//! 会话认证

use axum::http::{header, HeaderMap, StatusCode};

use crate::auth::token::validate_token_format;
use crate::db::Database;
use crate::models::AdminUser;

pub fn extract_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .filter(|t| validate_token_format(t))
        .map(|t| t.to_string())
}

pub async fn authenticate(headers: &HeaderMap, db: &dyn Database) -> Result<AdminUser, StatusCode> {
    let token = extract_token(headers).ok_or(StatusCode::UNAUTHORIZED)?;
    db.validate_session(&token)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderMap;

    #[test]
    fn extract_token_returns_none_for_missing_authorization() {
        let headers = HeaderMap::new();
        assert!(extract_token(&headers).is_none());
    }

    #[test]
    fn extract_token_returns_none_for_invalid_prefix() {
        let mut headers = HeaderMap::new();
        headers.insert(header::AUTHORIZATION, "Basic abcdef".parse().unwrap());
        assert!(extract_token(&headers).is_none());
    }

    #[test]
    fn extract_token_returns_valid_bearer_token() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            "Bearer 12345678901234567890123456789012".parse().unwrap(),
        );
        assert_eq!(
            extract_token(&headers),
            Some("12345678901234567890123456789012".to_string())
        );
    }

    #[test]
    fn extract_token_returns_none_for_short_token() {
        let mut headers = HeaderMap::new();
        headers.insert(header::AUTHORIZATION, "Bearer short".parse().unwrap());
        assert!(extract_token(&headers).is_none());
    }
}
