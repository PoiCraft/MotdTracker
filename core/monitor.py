import time
from typing import Dict
from mcstatus import JavaServer


class MinecraftMonitor:
    """Minecraft服务器监控类"""
    
    @staticmethod
    def query_server(host: str, port: int = 25565, timeout: int = 5) -> Dict:
        """
        查询Minecraft服务器状态
        
        Args:
            host: 服务器地址
            port: 服务器端口
            timeout: 超时时间(秒)
            
        Returns:
            包含服务器状态信息的字典
        """
        result = {
            'online': False,
            'latency': None,
            'players_online': None,
            'players_max': None,
            'version': None,
            'motd': None,
            'sample_players': None,
            'software': None,
            'plugins': None,
            'map': None,
            'error': None
        }
        
        try:
            # 创建服务器对象
            server = JavaServer(host, port)
            
            # 测量延迟
            start_time = time.time()
            status = server.status()
            latency = (time.time() - start_time) * 1000  # 转换为毫秒
            
            # 提取服务器信息
            result['online'] = True
            result['latency'] = round(latency, 2)
            result['players_online'] = status.players.online
            result['players_max'] = status.players.max
            result['version'] = status.version.name

            # 尝试从 status() 采集玩家样本（部分服务器提供）
            try:
                if hasattr(status, 'players') and hasattr(status.players, 'sample') and status.players.sample:
                    # mcstatus 返回 Player 对象列表，取 name
                    result['sample_players'] = [p.name for p in status.players.sample if hasattr(p, 'name')]
            except Exception:
                pass
            
            # 处理MOTD (可能包含格式化代码)
            if hasattr(status, 'description'):
                if isinstance(status.description, str):
                    result['motd'] = status.description
                else:
                    # 如果是复杂对象，转换为字符串
                    result['motd'] = str(status.description)

            # 尝试执行 query() 获取更多详细信息（需要服务器启用 query）
            try:
                query = server.query()
                # 玩家样本列表
                if hasattr(query, 'players') and hasattr(query.players, 'names'):
                    # 若 status 已有样本，扩展合并去重
                    query_names = list(query.players.names) if query.players.names else []
                    if query_names:
                        if result['sample_players']:
                            merged = list({*result['sample_players'], *query_names})
                            result['sample_players'] = merged
                        else:
                            result['sample_players'] = query_names
                # 软件/核心信息
                if hasattr(query, 'software'):
                    result['software'] = query.software
                # 插件信息
                if hasattr(query, 'plugins'):
                    # mcstatus 可能提供列表或字符串，统一为列表
                    plugins_val = query.plugins
                    if isinstance(plugins_val, list):
                        result['plugins'] = plugins_val
                    elif isinstance(plugins_val, str):
                        # 按逗号拆分粗略解析
                        result['plugins'] = [p.strip() for p in plugins_val.split(',') if p.strip()]
                # 地图名称
                if hasattr(query, 'map'):
                    result['map'] = query.map
            except Exception:
                # query 可能关闭或不支持，忽略
                pass
            
        except ConnectionRefusedError:
            result['error'] = '连接被拒绝'
        except TimeoutError:
            result['error'] = '连接超时'
        except Exception as e:
            result['error'] = f'查询失败: {str(e)}'
        
        return result
    
    @staticmethod
    def format_status(status: Dict) -> str:
        """
        格式化状态信息为可读字符串
        
        Args:
            status: 服务器状态字典
            
        Returns:
            格式化的字符串
        """
        if not status['online']:
            return f"离线 - {status.get('error', '未知错误')}"
        
        return (
            f"在线 | "
            f"延迟: {status['latency']}ms | "
            f"玩家: {status['players_online']}/{status['players_max']} | "
            f"版本: {status['version']}"
        )