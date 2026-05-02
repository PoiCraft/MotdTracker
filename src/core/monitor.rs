//! Minecraft 服务器查询模块

use std::time::Duration;
use tokio::net::TcpStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::time::timeout;
use tracing::{debug, warn};
use serde_json::Value;

use crate::models::ServerStatus;

/// Minecraft 服务器查询器
pub struct MinecraftQuerier;

impl MinecraftQuerier {
    /// 查询 Minecraft 服务器状态
    ///
    /// 参考: https://wiki.vg/Server_List_Ping
    pub async fn query_server(
        host: &str,
        port: u16,
        query_timeout: Duration,
    ) -> ServerStatus {
        let address = format!("{}:{}", host, port);
        
        debug!("正在查询服务器: {}", address);
        
        // 尝试连接
        let connect_result = timeout(query_timeout, TcpStream::connect(&address)).await;
        
        match connect_result {
            Ok(Ok(mut stream)) => {
                // 成功连接，开始计时测量延迟
                let ping_start = std::time::Instant::now();
                
                // 发送握手包
                if let Err(e) = Self::send_handshake(&mut stream, host, port, 1).await {
                    warn!("握手失败: {}", e);
                    return ServerStatus {
                        online: false,
                        error: Some(format!("握手失败: {}", e)),
                        ..Default::default()
                    };
                }
                
                // 发送状态请求
                if let Err(e) = Self::send_status_request(&mut stream).await {
                    warn!("状态请求失败: {}", e);
                    return ServerStatus {
                        online: false,
                        error: Some(format!("状态请求失败: {}", e)),
                        ..Default::default()
                    };
                }
                
                // 读取状态响应
                let response = Self::read_status_response(&mut stream).await;
                
                let latency = ping_start.elapsed().as_millis() as f64;
                
                match response {
                    Ok(status) => {
                        debug!("服务器 {} 查询成功，延迟: {}ms", address, latency);
                        ServerStatus {
                            online: true,
                            latency: Some(latency),
                            ..status
                        }
                    }
                    Err(e) => {
                        warn!("读取响应失败: {}", e);
                        ServerStatus {
                            online: false,
                            latency: Some(latency),
                            error: Some(format!("读取响应失败: {}", e)),
                            ..Default::default()
                        }
                    }
                }
            }
            Ok(Err(e)) => {
                warn!("连接失败: {}", e);
                ServerStatus {
                    online: false,
                    error: Some(format!("连接失败: {}", e)),
                    ..Default::default()
                }
            }
            Err(_) => {
                warn!("连接超时");
                ServerStatus {
                    online: false,
                    error: Some("连接超时".to_string()),
                    ..Default::default()
                }
            }
        }
    }
    
    /// 发送握手包
    ///
    /// 格式: [协议版本] [地址长度] [地址] [端口] [状态(1)]
    async fn send_handshake(
        stream: &mut TcpStream,
        host: &str,
        port: u16,
        state: u8,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let host_bytes = host.as_bytes();
        let host_len = host_bytes.len() as u8;
        
        // 构建握手包
        let mut packet: Vec<u8> = Vec::new();
        
        // 协议版本 (-1 = 任意版本，VarInt 编码为 5 字节)
        let protocol_version: i32 = -1;
        
        // 数据包长度（变长整数）
        let data_len = 1
            + Self::var_int_len(protocol_version)
            + Self::var_int_len(host_len as i32)
            + host_bytes.len()
            + 2
            + Self::var_int_len(state as i32);
        Self::write_var_int(&mut packet, data_len as i32);
        
        // 数据包 ID (0 = handshake)
        Self::write_var_int(&mut packet, 0);
        
        // 协议版本
        Self::write_var_int(&mut packet, protocol_version);
        
        // 地址长度和地址
        Self::write_var_int(&mut packet, host_len as i32);
        packet.extend_from_slice(host_bytes);
        
        // 端口（大端序）
        packet.extend_from_slice(&port.to_be_bytes());
        
        // 状态 (1 = status)
        Self::write_var_int(&mut packet, state as i32);
        
        stream.write_all(&packet).await?;
        stream.flush().await?;
        
        Ok(())
    }
    
    /// 发送状态请求包
    async fn send_status_request(
        stream: &mut TcpStream,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // 状态请求包很简单，只有长度和 ID
        let packet: Vec<u8> = [1, 0].to_vec(); // 长度=1, ID=0
        stream.write_all(&packet).await?;
        stream.flush().await?;
        
        Ok(())
    }
    
    /// 读取状态响应
    async fn read_status_response(
        stream: &mut TcpStream,
    ) -> Result<ServerStatus, Box<dyn std::error::Error + Send + Sync>> {
        // 读取数据包长度（变长整数）
        let len = Self::read_var_int(stream).await?;
        
        // 读取数据包内容
        let mut buffer = vec![0u8; len as usize];
        stream.read_exact(&mut buffer).await?;
        
        // 解析数据包 ID
        let mut offset = 0;
        let packet_id = Self::read_var_int_from_slice(&buffer, &mut offset);
        
        if packet_id != 0 {
            return Err(format!("意外的数据包 ID: {}", packet_id).into());
        }
        
        // 读取 JSON 长度
        let json_len = Self::read_var_int_from_slice(&buffer, &mut offset);
        let json_start = offset;
        let json_end = json_start + json_len as usize;
        
        if json_end > buffer.len() {
            return Err("JSON 数据超出缓冲区范围".into());
        }
        
        // 解析 JSON
        let json_str = String::from_utf8_lossy(&buffer[json_start..json_end]);
        let json: Value = serde_json::from_str(&json_str)?;
        
        // 构建 ServerStatus
        let status = Self::parse_status_json(&json);
        
        Ok(status)
    }
    
    /// 解析状态 JSON
    fn parse_status_json(json: &Value) -> ServerStatus {
        let version = json.get("version")
            .and_then(|v| v.get("name"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string());
        
        let motd = json.get("description")
            .and_then(|d| Self::extract_motd(d))
            .map(|s| s.to_string());
        
        let players_online = json.get("players")
            .and_then(|p| p.get("online"))
            .and_then(|o| o.as_u64())
            .map(|n| n as u32);
        
        let players_max = json.get("players")
            .and_then(|p| p.get("max"))
            .and_then(|m| m.as_u64())
            .map(|n| n as u32);
        
        let sample_players = json.get("players")
            .and_then(|p| p.get("sample"))
            .and_then(|s| s.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|p| p.get("name").and_then(|n| n.as_str()))
                    .map(|s| s.to_string())
                    .collect::<Vec<String>>()
            });
        
        ServerStatus {
            online: true,
            latency: None,
            players_online,
            players_max,
            version,
            motd,
            sample_players,
            ..Default::default()
        }
    }
    
    /// 提取 MOTD（支持简单字符串和复杂格式）
    fn extract_motd(value: &Value) -> Option<String> {
        if value.is_string() {
            value.as_str().map(|s| s.to_string())
        } else if value.is_object() {
            // 处理 {"text": "motd"} 格式
            value.get("text").and_then(|t| t.as_str()).map(|s| s.to_string())
        } else if value.is_array() {
            // 处理 [{"text": "line1"}, {"text": "line2"}] 格式
            value.as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|item| item.get("text").and_then(|t| t.as_str()))
                        .collect::<Vec<_>>()
                        .join("\n")
                })
        } else {
            None
        }
    }
    
    /// 写入变长整数
    fn write_var_int(buffer: &mut Vec<u8>, value: i32) {
        let mut val = value as u32;
        loop {
            let mut byte = (val & 0x7F) as u8;
            val >>= 7;
            if val != 0 {
                byte |= 0x80;
            }
            buffer.push(byte);
            if val == 0 {
                break;
            }
        }
    }
    
    /// 计算变长整数长度
    fn var_int_len(value: i32) -> usize {
        let mut len = 0;
        let mut val = value as u32;
        loop {
            len += 1;
            val >>= 7;
            if val == 0 {
                break;
            }
        }
        len
    }
    
    /// 从流读取变长整数
    async fn read_var_int(stream: &mut TcpStream) -> Result<i32, Box<dyn std::error::Error + Send + Sync>> {
        let mut result = 0;
        let mut shift = 0;
        
        loop {
            let mut byte = [0u8; 1];
            stream.read_exact(&mut byte).await?;
            let byte = byte[0];
            
            result |= ((byte & 0x7F) as i32) << shift;
            shift += 7;
            
            if byte & 0x80 == 0 {
                break;
            }
            
            if shift >= 32 {
                return Err("变长整数过长".into());
            }
        }
        
        Ok(result)
    }
    
    /// 从切片读取变长整数
    fn read_var_int_from_slice(buffer: &[u8], offset: &mut usize) -> i32 {
        let mut result = 0;
        let mut shift = 0;
        
        loop {
            let byte = buffer[*offset];
            *offset += 1;
            
            result |= ((byte & 0x7F) as i32) << shift;
            shift += 7;
            
            if byte & 0x80 == 0 {
                break;
            }
        }
        
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_query_server() {
        // 测试一个已知的服务器（可能需要调整）
        let status = MinecraftQuerier::query_server(
            "mc.hypixel.net",
            25565,
            Duration::from_secs(5),
        ).await;
        
        // 注意：实际测试可能因网络状况而不同
        println!("查询结果: {:?}", status);
    }
}