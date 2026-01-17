"""
Badge SVG生成器 - 使用 anybadge 库
"""
import anybadge


def generate_badge(label, value, color='lightgrey', style='flat'):
    """
    使用 anybadge 生成 SVG badge
    
    Args:
        label: 左侧标签文本
        value: 右侧值文本
        color: 颜色 (支持颜色名或十六进制)
        style: 样式 (anybadge 主要支持 flat 样式)
    
    Returns:
        SVG 字符串
    """
    # anybadge 颜色映射
    color_map = {
        'brightgreen': '#4c1',
        'green': '#97ca00',
        'yellowgreen': '#a4a61d',
        'yellow': '#dfb317',
        'orange': '#fe7d37',
        'red': '#e05d44',
        'lightgrey': '#9f9f9f',
        'blue': '#007ec6',
        'success': '#10b981',
        'info': '#6366f1',
        'warning': '#f59e0b',
        'danger': '#ef4444'
    }
    
    # 转换颜色
    badge_color = color_map.get(color, color)
    
    # 创建 badge
    badge = anybadge.Badge(
        label=label,
        value=value,
        default_color=badge_color,
        num_padding_chars=1
    )
    
    return badge.badge_svg_text