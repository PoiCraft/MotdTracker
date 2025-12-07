# Badge生成器

本地SVG Badge生成器,支持多种样式,无需依赖外部服务。

## 功能特性

- ✅ **完全本地化**: 不依赖shields.io等外部服务
- ✅ **多种样式**: 支持5种不同的badge样式
- ✅ **颜色预设**: 内置常用颜色映射
- ✅ **文本转义**: 自动处理特殊字符
- ✅ **响应式宽度**: 根据文本长度自动调整
- ✅ **无障碍支持**: 包含aria-label和title标签

## 支持的样式

### 1. Flat (默认)
经典平面设计,带有轻微渐变效果
```python
generate_badge('label', 'message', 'blue', 'flat')
```

### 2. Flat Square
完全平面的方形设计
```python
generate_badge('label', 'message', 'blue', 'flat-square')
```

### 3. Plastic
塑料质感,带有光泽效果
```python
generate_badge('label', 'message', 'blue', 'plastic')
```

### 4. For The Badge
大号字体,醒目的设计
```python
generate_badge('label', 'message', 'blue', 'for-the-badge')
```

### 5. Social
社交媒体风格,带有分隔效果
```python
generate_badge('label', 'message', 'blue', 'social')
```

## 颜色预设

支持以下预设颜色名称:

| 颜色名称 | 十六进制值 | 用途 |
|---------|-----------|------|
| `brightgreen` | `#4c1` | 优秀状态 |
| `green` | `#97ca00` | 良好状态 |
| `yellowgreen` | `#a4a61d` | 一般状态 |
| `yellow` | `#dfb317` | 警告 |
| `orange` | `#fe7d37` | 注意 |
| `red` | `#e05d44` | 错误/离线 |
| `lightgrey` | `#9f9f9f` | 未知/不可用 |
| `blue` | `#007ec6` | 信息 |
| `success` | `#10b981` | 成功 |
| `info` | `#6366f1` | 信息 |
| `warning` | `#f59e0b` | 警告 |
| `danger` | `#ef4444` | 危险 |

也可以使用任何有效的十六进制颜色值,如 `#ff0000`。

## 使用示例

### 基础使用

```python
from badge_generator import generate_badge

# 生成简单badge
svg = generate_badge('status', 'online', 'brightgreen')

# 指定样式
svg = generate_badge('build', 'passing', 'success', 'flat-square')

# 使用自定义颜色
svg = generate_badge('custom', 'badge', '#ff6600', 'plastic')
```

### 在Flask中使用

```python
from flask import Response
from badge_generator import generate_badge

@app.route('/badge')
def my_badge():
    svg = generate_badge('label', 'value', 'blue', 'flat')
    return Response(svg, mimetype='image/svg+xml')
```

## 技术实现

### 文本宽度计算
使用字符类型智能估算文本宽度:
- 大写字母和宽字符 (M, W): 7.5px
- 窄字符 (i, l, 1): 3.5px
- 空格: 3px
- 其他字符: 6px

### SVG优化
- 使用`textLength`属性确保文本精确适配
- 应用`geometricPrecision`渲染以提高质量
- 使用clip-path或mask实现圆角效果
- 利用linearGradient添加视觉效果

### 无障碍性
- 添加`role="img"`和`aria-label`属性
- 包含`<title>`元素描述badge内容
- 使用`aria-hidden`隐藏装饰性文本

## API参考

### `generate_badge(label, message, color='blue', style='flat')`

生成SVG格式的badge。

**参数:**
- `label` (str): 标签文本,显示在左侧
- `message` (str): 消息文本,显示在右侧
- `color` (str, 可选): 颜色名称或十六进制值,默认'blue'
- `style` (str, 可选): 样式名称,默认'flat'

**返回:**
- str: SVG XML字符串

**示例:**
```python
svg = generate_badge('downloads', '1.2k', 'brightgreen', 'for-the-badge')
```

## 性能特点

- ⚡ 纯Python实现,无网络请求
- 📦 零外部依赖(仅使用Python标准库)
- 🚀 毫秒级生成速度
- 💾 轻量级SVG输出(通常<2KB)

## 测试

运行测试脚本验证所有样式:

```bash
python test_badge.py
```

## 与shields.io对比

| 特性 | 本地生成器 | shields.io |
|-----|----------|------------|
| 网络依赖 | ❌ 无 | ✅ 需要 |
| 响应速度 | ⚡ <1ms | 🐌 100-500ms |
| 可用性 | ✅ 100% | ⚠️ 依赖服务 |
| 自定义性 | ✅ 完全可控 | ⚠️ 受限 |
| 样式数量 | 5种 | 10+种 |
| 图标支持 | ❌ 无 | ✅ 有 |

## 未来改进

- [ ] 添加图标支持
- [ ] 更多样式选项
- [ ] 动画效果
- [ ] 更精确的文本宽度计算
- [ ] 字体嵌入选项
