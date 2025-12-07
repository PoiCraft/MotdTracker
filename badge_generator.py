"""
Badge SVG生成器
支持多种样式: flat, flat-square, plastic, for-the-badge, social
"""
from xml.sax.saxutils import escape


class BadgeGenerator:
    """生成SVG格式的badge"""
    
    # 颜色映射
    COLOR_MAP = {
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
    
    @staticmethod
    def _get_text_width(text, font_size=11, bold=False):
        """估算文本宽度"""
        # 粗略估算,基于字符类型
        width = 0
        multiplier = 1.15 if bold else 1.0
        
        for char in text:
            if char.isupper() or char in 'mwMW':
                width += 7.5 * multiplier
            elif char in 'il1':
                width += 3.5 * multiplier
            elif char in ' ':
                width += 3 * multiplier
            else:
                width += 6 * multiplier
        
        # 根据字体大小调整
        width = width * (font_size / 11)
        return width
    
    @staticmethod
    def _get_color(color):
        """获取颜色值"""
        return BadgeGenerator.COLOR_MAP.get(color, color)
    
    @classmethod
    def generate(cls, label, message, color='blue', style='flat'):
        """
        生成badge SVG
        
        Args:
            label: 标签文本
            message: 消息文本
            color: 颜色(预设名称或hex值)
            style: 样式(flat, flat-square, plastic, for-the-badge, social)
        
        Returns:
            SVG字符串
        """
        # 转义文本
        label = escape(str(label))
        message = escape(str(message))
        
        # 根据样式选择生成方法
        if style == 'flat-square':
            return cls._generate_flat_square(label, message, color)
        elif style == 'plastic':
            return cls._generate_plastic(label, message, color)
        elif style == 'for-the-badge':
            return cls._generate_for_the_badge(label, message, color)
        elif style == 'social':
            return cls._generate_social(label, message, color)
        else:  # flat (默认)
            return cls._generate_flat(label, message, color)
    
    @classmethod
    def _generate_flat(cls, label, message, color):
        """生成flat样式的badge"""
        label_width = cls._get_text_width(label) + 10
        message_width = cls._get_text_width(message) + 10
        total_width = label_width + message_width
        bg_color = cls._get_color(color)
        
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width:.0f}" height="20" role="img" aria-label="{label}: {message}">
    <title>{label}: {message}</title>
    <linearGradient id="s" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
        <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <clipPath id="r">
        <rect width="{total_width:.0f}" height="20" rx="3" fill="#fff"/>
    </clipPath>
    <g clip-path="url(#r)">
        <rect width="{label_width:.0f}" height="20" fill="#555"/>
        <rect x="{label_width:.0f}" width="{message_width:.0f}" height="20" fill="{bg_color}"/>
        <rect width="{total_width:.0f}" height="20" fill="url(#s)"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
        <text aria-hidden="true" x="{label_width/2*10:.0f}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="{(label_width-10)*10:.0f}">{label}</text>
        <text x="{label_width/2*10:.0f}" y="140" transform="scale(.1)" fill="#fff" textLength="{(label_width-10)*10:.0f}">{label}</text>
        <text aria-hidden="true" x="{(label_width + message_width/2)*10:.0f}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="{(message_width-10)*10:.0f}">{message}</text>
        <text x="{(label_width + message_width/2)*10:.0f}" y="140" transform="scale(.1)" fill="#fff" textLength="{(message_width-10)*10:.0f}">{message}</text>
    </g>
</svg>'''
        return svg
    
    @classmethod
    def _generate_flat_square(cls, label, message, color):
        """生成flat-square样式的badge"""
        label_width = cls._get_text_width(label) + 10
        message_width = cls._get_text_width(message) + 10
        total_width = label_width + message_width
        bg_color = cls._get_color(color)
        
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width:.0f}" height="20" role="img" aria-label="{label}: {message}">
    <title>{label}: {message}</title>
    <g shape-rendering="crispEdges">
        <rect width="{label_width:.0f}" height="20" fill="#555"/>
        <rect x="{label_width:.0f}" width="{message_width:.0f}" height="20" fill="{bg_color}"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
        <text x="{label_width/2*10:.0f}" y="140" transform="scale(.1)" fill="#fff" textLength="{(label_width-10)*10:.0f}">{label}</text>
        <text x="{(label_width + message_width/2)*10:.0f}" y="140" transform="scale(.1)" fill="#fff" textLength="{(message_width-10)*10:.0f}">{message}</text>
    </g>
</svg>'''
        return svg
    
    @classmethod
    def _generate_plastic(cls, label, message, color):
        """生成plastic样式的badge"""
        label_width = cls._get_text_width(label) + 10
        message_width = cls._get_text_width(message) + 10
        total_width = label_width + message_width
        bg_color = cls._get_color(color)
        
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width:.0f}" height="18" role="img" aria-label="{label}: {message}">
    <title>{label}: {message}</title>
    <linearGradient id="s" x2="0" y2="100%">
        <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
        <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
        <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
        <stop offset="1" stop-color="#000" stop-opacity=".5"/>
    </linearGradient>
    <clipPath id="r">
        <rect width="{total_width:.0f}" height="18" rx="4" fill="#fff"/>
    </clipPath>
    <g clip-path="url(#r)">
        <rect width="{label_width:.0f}" height="18" fill="#555"/>
        <rect x="{label_width:.0f}" width="{message_width:.0f}" height="18" fill="{bg_color}"/>
        <rect width="{total_width:.0f}" height="18" fill="url(#s)"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
        <text aria-hidden="true" x="{label_width/2*10:.0f}" y="140" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="{(label_width-10)*10:.0f}">{label}</text>
        <text x="{label_width/2*10:.0f}" y="130" transform="scale(.1)" fill="#fff" textLength="{(label_width-10)*10:.0f}">{label}</text>
        <text aria-hidden="true" x="{(label_width + message_width/2)*10:.0f}" y="140" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="{(message_width-10)*10:.0f}">{message}</text>
        <text x="{(label_width + message_width/2)*10:.0f}" y="130" transform="scale(.1)" fill="#fff" textLength="{(message_width-10)*10:.0f}">{message}</text>
    </g>
</svg>'''
        return svg
    
    @classmethod
    def _generate_for_the_badge(cls, label, message, color):
        """生成for-the-badge样式的badge"""
        # 这个样式使用更大的字体和更宽的间距
        font_size = 10  # 更大的字体
        label_width = cls._get_text_width(label.upper(), font_size, bold=True) + 20
        message_width = cls._get_text_width(message.upper(), font_size, bold=True) + 20
        total_width = label_width + message_width
        bg_color = cls._get_color(color)
        height = 28
        
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width:.0f}" height="{height}" role="img" aria-label="{label}: {message}">
    <title>{label}: {message}</title>
    <g shape-rendering="crispEdges">
        <rect width="{label_width:.0f}" height="{height}" fill="#555"/>
        <rect x="{label_width:.0f}" width="{message_width:.0f}" height="{height}" fill="{bg_color}"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="100">
        <text transform="scale(.1)" x="{label_width/2*10:.0f}" y="175" textLength="{(label_width-20)*10:.0f}" fill="#fff" font-weight="bold">{label.upper()}</text>
        <text transform="scale(.1)" x="{(label_width + message_width/2)*10:.0f}" y="175" textLength="{(message_width-20)*10:.0f}" fill="#fff" font-weight="bold">{message.upper()}</text>
    </g>
</svg>'''
        return svg
    
    @classmethod
    def _generate_social(cls, label, message, color):
        """生成social样式的badge"""
        label_width = cls._get_text_width(label) + 10
        message_width = cls._get_text_width(message) + 10
        total_width = label_width + message_width + 6  # 添加额外间距
        bg_color = cls._get_color(color)
        
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width:.0f}" height="20" role="img" aria-label="{label}: {message}">
    <title>{label}: {message}</title>
    <linearGradient id="s" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
        <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <clipPath id="r">
        <rect width="{total_width:.0f}" height="20" rx="3" fill="#fff"/>
    </clipPath>
    <g clip-path="url(#r)">
        <rect width="{label_width:.0f}" height="20" fill="#555"/>
        <rect x="{label_width:.0f}" width="{message_width + 6:.0f}" height="20" fill="{bg_color}"/>
        <rect x="{label_width:.0f}" width="3" height="20" fill="{bg_color}"/>
        <rect width="{total_width:.0f}" height="20" fill="url(#s)"/>
    </g>
    <g aria-hidden="true" fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
        <text x="{label_width/2*10:.0f}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="{(label_width-10)*10:.0f}">{label}</text>
        <text x="{label_width/2*10:.0f}" y="140" transform="scale(.1)" fill="#fff" textLength="{(label_width-10)*10:.0f}">{label}</text>
        <text x="{(label_width + message_width/2 + 6)*10:.0f}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="{(message_width-10)*10:.0f}">{message}</text>
        <text id="rlink" x="{(label_width + message_width/2 + 6)*10:.0f}" y="140" transform="scale(.1)" fill="#fff" textLength="{(message_width-10)*10:.0f}">{message}</text>
    </g>
    <rect id="llink" stroke="#d5d5d5" fill="url(#a)" x=".5" y=".5" width="{label_width-1:.0f}" height="19" rx="2"/>
</svg>'''
        return svg


def generate_badge(label, message, color='blue', style='flat'):
    """
    便捷函数: 生成badge SVG
    
    Args:
        label: 标签文本
        message: 消息文本
        color: 颜色(预设名称或hex值)
        style: 样式(flat, flat-square, plastic, for-the-badge, social)
    
    Returns:
        SVG字符串
    """
    return BadgeGenerator.generate(label, message, color, style)
