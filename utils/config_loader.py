"""配置文件加载器

支持 TOML 格式的配置文件加载。
"""
import tomllib
import os
from typing import Dict, Any


def load_config(config_path: str = None) -> Dict[str, Any]:
    """
    加载 TOML 配置文件
    
    Args:
        config_path: 配置文件路径，默认为 config.toml
        
    Returns:
        配置字典
        
    Raises:
        FileNotFoundError: 找不到配置文件
        ValueError: 配置文件格式错误
    """
    if config_path is None:
        config_path = 'config.toml'
    
    if not os.path.exists(config_path):
        raise FileNotFoundError(
            f"配置文件不存在: {config_path}\n"
            "可参考 config.example.toml 创建配置文件：cp config.example.toml config.toml"
        )
    
    try:
        with open(config_path, 'rb') as f:
            return tomllib.load(f)
    except tomllib.TOMLDecodeError as e:
        raise ValueError(f"TOML 配置文件格式错误: {e}")


def get_config_path() -> str:
    """
    获取配置文件路径
    
    Returns:
        配置文件路径
    """
    return 'config.toml'
