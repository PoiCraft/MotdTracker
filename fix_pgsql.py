#!/usr/bin/env python3
"""
PostgreSQL 表结构修复工具
用于删除旧的错误表结构并重新创建
"""
import json
import sys
import logging

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """主函数"""
    print("=" * 60)
    print("PostgreSQL 表结构修复工具")
    print("删除旧表并重新创建（修复布尔类型默认值问题）")
    print("=" * 60)
    print()
    
    # 加载配置
    config_path = 'config.json'
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except FileNotFoundError:
        logger.error(f"配置文件不存在: {config_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        logger.error(f"配置文件格式错误: {e}")
        sys.exit(1)
    
    # 检查 PostgreSQL 配置
    pgsql_config = config.get('postgresql')
    if not pgsql_config:
        logger.error("配置文件中未找到 PostgreSQL 配置")
        sys.exit(1)
    
    required_keys = ['host', 'port', 'database', 'user', 'password']
    missing_keys = [k for k in required_keys if k not in pgsql_config]
    if missing_keys:
        logger.error(f"PostgreSQL 配置缺少必要参数: {', '.join(missing_keys)}")
        sys.exit(1)
    
    print(f"PostgreSQL 服务器: {pgsql_config['host']}:{pgsql_config['port']}")
    print(f"PostgreSQL 数据库: {pgsql_config['database']}")
    print()
    
    print("⚠️  警告：此操作将删除以下表及其所有数据：")
    print("  - player_sessions")
    print("  - player_session_history")
    print("  - status_logs")
    print("  - servers")
    print()
    print("此脚本会修复以下问题：")
    print("  1. 布尔类型默认值 (DEFAULT 0 -> DEFAULT false)")
    print("  2. 时间戳类型 (TIMESTAMP -> TIMESTAMP WITHOUT TIME ZONE)")
    print()
    print("所有历史数据将丢失！请确保已备份重要数据。")
    print()
    
    # 确认
    response = input("确认继续？(输入 'YES' 继续): ")
    if response != 'YES':
        print("操作已取消")
        sys.exit(0)
    
    print()
    
    # 连接到 PostgreSQL
    try:
        import psycopg2
        logger.info("连接到 PostgreSQL...")
        conn = psycopg2.connect(
            host=pgsql_config['host'],
            port=pgsql_config['port'],
            database=pgsql_config['database'],
            user=pgsql_config['user'],
            password=pgsql_config['password'],
            connect_timeout=30
        )
        logger.info("连接成功")
    except Exception as e:
        logger.error(f"无法连接到 PostgreSQL: {e}")
        sys.exit(1)
    
    try:
        cursor = conn.cursor()
        
        # 删除旧表（按依赖关系逆序）
        tables = ['player_session_history', 'player_sessions', 'status_logs', 'servers']
        
        for table in tables:
            logger.info(f"删除表: {table}")
            cursor.execute(f'DROP TABLE IF EXISTS {table} CASCADE')
        
        conn.commit()
        logger.info("旧表删除完成")
        
        # 重新创建表结构
        logger.info("创建新表结构...")
        
        from database_pgsql import PostgreSQLDatabase
        _ = PostgreSQLDatabase(
            host=pgsql_config['host'],
            port=pgsql_config['port'],
            database=pgsql_config['database'],
            user=pgsql_config['user'],
            password=pgsql_config['password']
        )
        
        logger.info("表结构创建完成")
        
        print()
        print("=" * 60)
        print("✅ 修复完成！")
        print("=" * 60)
        print()
        print("后续步骤:")
        print("1. 如果需要迁移 SQLite 数据，删除 .migrated 文件")
        print("2. 运行 uv run main.py 启动应用")
        print("3. 或运行 uv run migrate.py 重新迁移数据")
        print()
        
    except Exception as e:
        logger.error(f"修复过程中出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
