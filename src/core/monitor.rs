//! Minecraft 服务器查询模块

use serde_json::Value;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::net::UdpSocket;
use tokio::time::timeout;
use tracing::{debug, warn};

use crate::config::ServerEdition;
use crate::models::ServerStatus;

/// RakNet Unconnected Ping Magic bytes
const RAKNET_MAGIC: [u8; 16] = [
    0x00, 0xFF, 0xFF, 0x00, 0xFE, 0xFE, 0xFE, 0xFE, 0xFD, 0xFD, 0xFD, 0xFD, 0x12, 0x34, 0x56, 0x78,
];

/// Minecraft 服务器查询器
pub struct MinecraftQuerier;

impl MinecraftQuerier {
    /// 查询 Minecraft 服务器状态
    ///
    /// 根据 edition 自动选择 Java TCP 或 Bedrock UDP 查询协议
    pub async fn query_server(
        host: &str,
        port: u16,
        query_timeout: Duration,
        edition: &ServerEdition,
    ) -> ServerStatus {
        match edition {
            ServerEdition::Java => Self::query_java_server(host, port, query_timeout).await,
            ServerEdition::Bedrock => Self::query_bedrock_server(host, port, query_timeout).await,
        }
    }

    /// 查询 Java 版服务器状态
    ///
    /// 参考: https://wiki.vg/Server_List_Ping
    async fn query_java_server(host: &str, port: u16, query_timeout: Duration) -> ServerStatus {
        let address = format!("{}:{}", host, port);

        debug!("正在查询 Java 服务器: {}", address);

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
                        debug!("Java 服务器 {} 查询成功，延迟: {}ms", address, latency);
                        ServerStatus {
                            online: true,
                            latency: Some(latency),
                            edition: Some(ServerEdition::Java),
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

    /// 查询基岩版服务器状态
    ///
    /// 使用 RakNet Unconnected Ping 协议 (UDP)
    /// 参考: https://wiki.vg/Raknet_Protocol#Unconnected_Ping
    async fn query_bedrock_server(host: &str, port: u16, query_timeout: Duration) -> ServerStatus {
        let address = format!("{}:{}", host, port);

        debug!("正在查询基岩版服务器: {}", address);

        // 绑定本地 UDP socket
        let bind_result =
            timeout(query_timeout, async { UdpSocket::bind("0.0.0.0:0").await }).await;

        let socket = match bind_result {
            Ok(Ok(s)) => s,
            Ok(Err(e)) => {
                warn!("绑定 UDP socket 失败: {}", e);
                return ServerStatus {
                    online: false,
                    error: Some(format!("绑定 UDP socket 失败: {}", e)),
                    ..Default::default()
                };
            }
            Err(_) => {
                warn!("绑定 UDP socket 超时");
                return ServerStatus {
                    online: false,
                    error: Some("绑定 UDP socket 超时".to_string()),
                    ..Default::default()
                };
            }
        };

        // 连接到目标地址
        if let Err(e) = socket.connect(&address).await {
            warn!("UDP 连接失败: {}", e);
            return ServerStatus {
                online: false,
                error: Some(format!("UDP 连接失败: {}", e)),
                ..Default::default()
            };
        }

        // 构建 Unconnected Ping 包
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let mut packet = Vec::with_capacity(35);
        packet.push(0x01); // Packet ID: Unconnected Ping
        packet.extend_from_slice(&timestamp.to_be_bytes()); // Timestamp (i64)
        packet.extend_from_slice(&RAKNET_MAGIC); // Magic (16 bytes)
        packet.extend_from_slice(&0i64.to_be_bytes()); // Client GUID (i64)

        let ping_start = std::time::Instant::now();

        // 发送 ping 包
        if let Err(e) = socket.send(&packet).await {
            warn!("发送 RakNet ping 失败: {}", e);
            return ServerStatus {
                online: false,
                error: Some(format!("发送 RakNet ping 失败: {}", e)),
                ..Default::default()
            };
        }

        // 接收 pong 响应
        let mut recv_buf = vec![0u8; 2048];
        let recv_result = timeout(query_timeout, socket.recv(&mut recv_buf)).await;

        let latency = ping_start.elapsed().as_millis() as f64;

        let n = match recv_result {
            Ok(Ok(n)) => n,
            Ok(Err(e)) => {
                warn!("接收 RakNet pong 失败: {}", e);
                return ServerStatus {
                    online: false,
                    latency: Some(latency),
                    error: Some(format!("接收 RakNet pong 失败: {}", e)),
                    ..Default::default()
                };
            }
            Err(_) => {
                warn!("接收 RakNet pong 超时");
                return ServerStatus {
                    online: false,
                    latency: Some(latency),
                    error: Some("接收 RakNet pong 超时".to_string()),
                    ..Default::default()
                };
            }
        };

        recv_buf.truncate(n);

        // 解析 Unconnected Pong 响应
        match Self::parse_bedrock_pong(&recv_buf) {
            Ok(status) => {
                debug!("基岩版服务器 {} 查询成功，延迟: {}ms", address, latency);
                ServerStatus {
                    online: true,
                    latency: Some(latency),
                    edition: Some(ServerEdition::Bedrock),
                    ..status
                }
            }
            Err(e) => {
                warn!("解析基岩版响应失败: {}", e);
                ServerStatus {
                    online: false,
                    latency: Some(latency),
                    error: Some(format!("解析基岩版响应失败: {}", e)),
                    ..Default::default()
                }
            }
        }
    }

    /// 解析 RakNet Unconnected Pong 响应
    ///
    /// 响应格式：
    ///   Packet ID (1 byte) = 0x1c
    ///   Timestamp (i64, 8 bytes)
    ///   Server GUID (i64, 8 bytes)
    ///   Magic (16 bytes)
    ///   String Length (u16, 2 bytes big-endian)
    ///   Server ID String (UTF-8, `;` delimited)
    ///
    /// Server ID String 字段:
    ///   Edition;Motd;Protocol;VersionName;PlayersOnline;PlayersMax;ServerUniqueId;WorldName;GameMode;...
    fn parse_bedrock_pong(
        data: &[u8],
    ) -> Result<ServerStatus, Box<dyn std::error::Error + Send + Sync>> {
        if data.len() < 35 {
            return Err("响应数据过短".into());
        }

        let mut offset = 0;

        // Packet ID
        let packet_id = data[offset];
        offset += 1;
        if packet_id != 0x1c {
            return Err(format!("意外的数据包 ID: 0x{:02x}，期望 0x1c", packet_id).into());
        }

        // Timestamp (i64) - skip
        offset += 8;

        // Server GUID (i64) - skip
        offset += 8;

        // Magic (16 bytes)
        if data[offset..offset + 16] != RAKNET_MAGIC {
            return Err("无效的 RakNet Magic 字节".into());
        }
        offset += 16;

        // String Length (u16 big-endian)
        if data.len() < offset + 2 {
            return Err("数据不足以读取字符串长度".into());
        }
        let str_len = u16::from_be_bytes([data[offset], data[offset + 1]]) as usize;
        offset += 2;

        // Server ID String
        if data.len() < offset + str_len {
            return Err("数据不足以读取服务器 ID 字符串".into());
        }
        let server_id_str = String::from_utf8_lossy(&data[offset..offset + str_len]);
        let status = Self::parse_bedrock_server_id(&server_id_str);

        Ok(status)
    }

    /// 解析基岩版 Server ID String
    ///
    /// 格式: Edition;Motd;Protocol;VersionName;PlayersOnline;PlayersMax;ServerUniqueId;WorldName;GameMode;...
    fn parse_bedrock_server_id(server_id: &str) -> ServerStatus {
        let parts: Vec<&str> = server_id.split(';').collect();

        let motd = if parts.len() > 1 {
            Some(parts[1].to_string())
        } else {
            None
        };

        let version = if parts.len() > 3 {
            Some(parts[3].to_string())
        } else {
            None
        };

        let players_online = if parts.len() > 4 {
            parts[4].parse::<u32>().ok()
        } else {
            None
        };

        let players_max = if parts.len() > 5 {
            parts[5].parse::<u32>().ok()
        } else {
            None
        };

        let map = if parts.len() > 7 {
            let world_name = parts[7];
            if !world_name.is_empty() {
                Some(world_name.to_string())
            } else {
                None
            }
        } else {
            None
        };

        let software = if !parts.is_empty() {
            Some(format!("Bedrock/{}", parts[0]))
        } else {
            Some("Bedrock".to_string())
        };

        ServerStatus {
            online: true,
            latency: None,
            players_online,
            players_max,
            version,
            motd,
            sample_players: None,
            software,
            plugins: None,
            map,
            error: None,
            edition: Some(ServerEdition::Bedrock),
        }
    }

    // ==================== Java Edition 协议 ====================

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
        let version = json
            .get("version")
            .and_then(|v| v.get("name"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string());

        let motd = json
            .get("description")
            .and_then(Self::extract_motd)
            .map(|s| s.to_string());

        let players_online = json
            .get("players")
            .and_then(|p| p.get("online"))
            .and_then(|o| o.as_u64())
            .map(|n| n as u32);

        let players_max = json
            .get("players")
            .and_then(|p| p.get("max"))
            .and_then(|m| m.as_u64())
            .map(|n| n as u32);

        let sample_players = json
            .get("players")
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

    /// 提取 MOTD（支持简单字符串、复杂格式和 extra 嵌套）
    fn extract_motd(value: &Value) -> Option<String> {
        if value.is_string() {
            value.as_str().map(|s| s.to_string())
        } else if value.is_object() {
            // 处理 {"text": "...", "extra": [...]} 格式
            let text = value.get("text").and_then(|t| t.as_str()).unwrap_or("");
            let extra = value.get("extra").and_then(|e| e.as_array()).map(|arr| {
                arr.iter()
                    .filter_map(Self::extract_motd)
                    .collect::<Vec<_>>()
                    .join("")
            });
            let result = match extra {
                Some(e) if !e.is_empty() => format!("{}{}", text, e),
                _ => text.to_string(),
            };
            if result.is_empty() {
                None
            } else {
                Some(result)
            }
        } else if value.is_array() {
            // 处理 [{"text": "line1"}, {"text": "line2"}] 格式
            value.as_array().map(|arr| {
                arr.iter()
                    .filter_map(Self::extract_motd)
                    .collect::<Vec<_>>()
                    .join("")
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
    async fn read_var_int(
        stream: &mut TcpStream,
    ) -> Result<i32, Box<dyn std::error::Error + Send + Sync>> {
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

    #[test]
    fn test_parse_bedrock_server_id() {
        let server_id = "MCPE;Dedicated Server;627;1.21.60;0;10;123456789;Bedrock level;Survival;1;19132;19133;";
        let status = MinecraftQuerier::parse_bedrock_server_id(server_id);

        assert!(status.online);
        assert_eq!(status.motd, Some("Dedicated Server".to_string()));
        assert_eq!(status.version, Some("1.21.60".to_string()));
        assert_eq!(status.players_online, Some(0));
        assert_eq!(status.players_max, Some(10));
        assert_eq!(status.map, Some("Bedrock level".to_string()));
        assert_eq!(status.software, Some("Bedrock/MCPE".to_string()));
        assert_eq!(status.edition, Some(ServerEdition::Bedrock));
    }

    #[test]
    fn test_parse_bedrock_server_id_minimal() {
        let server_id = "MCPE;My Server;0;1.0.0;5;20;abc";
        let status = MinecraftQuerier::parse_bedrock_server_id(server_id);

        assert_eq!(status.motd, Some("My Server".to_string()));
        assert_eq!(status.players_online, Some(5));
        assert_eq!(status.players_max, Some(20));
        assert_eq!(status.map, None);
    }

    #[tokio::test]
    async fn test_query_java_server() {
        let status =
            MinecraftQuerier::query_java_server("mc.hypixel.net", 25565, Duration::from_secs(5))
                .await;

        println!("Java 查询结果: {:?}", status);
    }

    #[tokio::test]
    async fn test_query_bedrock_server() {
        let status = MinecraftQuerier::query_bedrock_server(
            "play.nethergames.org",
            19132,
            Duration::from_secs(5),
        )
        .await;

        println!("Bedrock 查询结果: {:?}", status);
    }
}
