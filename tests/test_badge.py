"""
Badge生成器测试（复制版）
"""
from utils.badge_generator import generate_badge

# 测试不同样式
styles = ['flat', 'flat-square', 'plastic', 'for-the-badge', 'social']

print("测试badge生成器...")
print("=" * 60)

for style in styles:
    svg = generate_badge('test', 'success', 'brightgreen', style)
    print(f"\n{style}样式:")
    print(f"  SVG长度: {len(svg)} 字符")
    print(f"  包含样式名: {style in svg or 'flat' == style}")
    
    # 验证SVG基本结构
    assert svg.startswith('<svg'), f"{style}样式SVG格式错误"
    assert svg.endswith('</svg>'), f"{style}样式SVG未正确闭合"
    assert 'test' in svg, f"{style}样式缺少标签"
    assert 'success' in svg, f"{style}样式缺少消息"
    
print("\n" + "=" * 60)
print("✓ 所有测试通过!")
