//! 密码哈希工具

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

/// 使用 Argon2 哈希密码
pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("密码哈希失败: {}", e))?;
    Ok(hash.to_string())
}

/// 验证密码
/// 注意：如果 hash 格式无效也返回 false（而非错误），防止格式解析的时序差异泄露信息
pub fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    let parsed_hash = match PasswordHash::new(hash) {
        Ok(h) => h,
        Err(_) => return Ok(false),
    };
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}
