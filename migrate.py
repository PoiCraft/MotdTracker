#!/usr/bin/env python3
"""
手动数据库迁移工具
用于将 SQLite 数据迁移到 PostgreSQL
"""
import json
import sys
import logging
from database_factory import migrate_sqlite_to_pgsql

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """主函数"""
    print("=" * 60)
    print("MotdTracker 数据库迁移工具")
    print("从 SQLite 迁移到 PostgreSQL")
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
        logger.info("请在 config.json 中添加 postgresql 配置节")
        sys.exit(1)
    
    required_keys = ['host', 'port', 'database', 'user', 'password']
    missing_keys = [k for k in required_keys if k not in pgsql_config]
    if missing_keys:
        logger.error(f"PostgreSQL 配置缺少必要参数: {', '.join(missing_keys)}")
        sys.exit(1)
    
    # 获取 SQLite 路径
    sqlite_path = config.get('database', 'minecraft_stats.db')
    
    print(f"SQLite 数据库: {sqlite_path}")
    print(f"PostgreSQL 服务器: {pgsql_config['host']}:{pgsql_config['port']}")
    print(f"PostgreSQL 数据库: {pgsql_config['database']}")
    print()
    
    # 确认
    response = input("确认开始迁移？这将覆盖 PostgreSQL 中的现有数据 (yes/no): ")
    if response.lower() != 'yes':
        print("取消迁移")
        sys.exit(0)
    
    print()
    
    # 创建 PostgreSQL 数据库实例
    try:
        logger.info("连接到 PostgreSQL...")
        from database_postgresql import PostgreSQLDatabase
        pgsql_db = PostgreSQLDatabase(
            host=pgsql_config['host'],
            port=pgsql_config['port'],
            database=pgsql_config['database'],
            user=pgsql_config['user'],
            password=pgsql_config['password']
        )
        logger.info("PostgreSQL 连接成功")
    except Exception as e:
        logger.error(f"无法连接到 PostgreSQL: {e}")
        sys.exit(1)
    
    # 执行迁移
    try:
        migrate_sqlite_to_pgsql(sqlite_path, pgsql_db)
        print()
        print("=" * 60)
        print("✅ 迁移完成！")
        print("=" * 60)
        print()
        print("后续步骤:")
        print("1. 验证 PostgreSQL 中的数据")
        print("2. 启动应用测试功能")
        print("3. 确认无误后可以删除或归档 SQLite 文件")
        print()
    except Exception as e:
        logger.error(f"迁移过程中出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
