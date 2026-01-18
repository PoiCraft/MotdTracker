"""生成 PWA 所需的不同尺寸图标

从 poi.png 生成多种尺寸的 PWA 图标。
需要 Pillow 库：uv add pillow
"""
import os
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("需要安装 Pillow 库：uv add pillow")
    exit(1)


# 图标尺寸
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]


def generate_icons():
    """生成不同尺寸的图标"""
    # 获取项目根目录
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    # 源图标路径
    source_icon = project_root / "static" / "poi.png"
    
    if not source_icon.exists():
        print(f"错误：找不到源图标 {source_icon}")
        return
    
    # 输出目录
    output_dir = project_root / "static" / "icons"
    output_dir.mkdir(exist_ok=True)
    
    # 打开源图标
    with Image.open(source_icon) as img:
        # 确保是 RGBA 模式
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        for size in SIZES:
            # 使用高质量缩放
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            
            # 保存
            output_path = output_dir / f"icon-{size}x{size}.png"
            resized.save(output_path, "PNG", optimize=True)
            print(f"✓ 生成 {output_path.name}")
    
    print(f"\n完成！图标已保存到 {output_dir}")


if __name__ == "__main__":
    generate_icons()
