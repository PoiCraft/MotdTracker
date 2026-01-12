#!/bin/bash
# Rust版本构建脚本

set -e

echo "=== MotdTracker Rust版本构建脚本 ==="

# 检查Rust安装
if ! command -v cargo &> /dev/null; then
    echo "错误: 未找到Cargo，请先安装Rust"
    echo "访问: https://rustup.rs/"
    exit 1
fi

echo "Rust版本:"
rustc --version
cargo --version

# 选择构建模式
MODE=${1:-release}

if [ "$MODE" == "debug" ]; then
    echo ""
    echo "=== 构建调试版本 ==="
    cargo build
    BINARY="./target/debug/motdtracker"
else
    echo ""
    echo "=== 构建发布版本（优化编译） ==="
    cargo build --release
    BINARY="./target/release/motdtracker"
fi

# 检查构建结果
if [ -f "$BINARY" ]; then
    echo ""
    echo "✅ 构建成功！"
    echo "可执行文件: $BINARY"
    echo "文件大小: $(du -h $BINARY | cut -f1)"
    echo ""
    echo "运行命令:"
    echo "  $BINARY"
    echo ""
    echo "或使用Cargo运行:"
    if [ "$MODE" == "debug" ]; then
        echo "  cargo run"
    else
        echo "  cargo run --release"
    fi
else
    echo "❌ 构建失败"
    exit 1
fi
