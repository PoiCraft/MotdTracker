"""SQL 查询 API

提供类SQL查询接口，允许用户使用类SQL语法查询数据。
"""
from flask import request
from flask_restx import Namespace, Resource, fields
from utils.query_parser import QueryParser, QueryParseError, ALLOWED_TABLES


def register_query_routes(api, poller):
    """注册查询API路由"""
    query_ns = Namespace('query', description='类SQL查询接口', path='/query')
    
    # 确定数据库类型
    db_type = 'postgresql' if hasattr(poller.db, 'host') else 'sqlite'
    parser = QueryParser(db_type=db_type)
    
    # 请求模型
    query_model = query_ns.model('QueryRequest', {
        'query': fields.String(
            required=True, 
            description='类SQL查询语句',
            example="SELECT name, host, port FROM servers WHERE id = 1"
        )
    })
    
    # 响应模型
    result_model = query_ns.model('QueryResult', {
        'success': fields.Boolean(description='查询是否成功'),
        'data': fields.List(fields.Raw, description='查询结果'),
        'count': fields.Integer(description='返回的行数'),
        'sql': fields.String(description='实际执行的SQL（调试用）'),
        'error': fields.String(description='错误信息（仅失败时）')
    })
    
    schema_model = query_ns.model('SchemaInfo', {
        'tables': fields.Raw(description='可查询的表及其字段'),
        'operators': fields.List(fields.String, description='支持的操作符'),
        'functions': fields.List(fields.String, description='支持的聚合函数'),
        'max_limit': fields.Integer(description='最大返回行数'),
        'default_limit': fields.Integer(description='默认返回行数')
    })

    @query_ns.route('/schema')
    class QuerySchema(Resource):
        @query_ns.doc(
            '获取查询架构',
            description='获取可查询的表、字段、操作符等信息'
        )
        @query_ns.marshal_with(schema_model)
        def get(self):
            """获取可查询的表结构信息"""
            return parser.get_schema()

    @query_ns.route('')
    class QueryExecute(Resource):
        @query_ns.doc(
            '执行类SQL查询',
            description='''执行类SQL查询语句，返回查询结果。

**支持的语法:**
- `SELECT field1, field2 FROM table`
- `SELECT * FROM table`
- `SELECT COUNT(*) FROM table`
- `SELECT ... FROM table WHERE condition`
- `SELECT ... FROM table WHERE cond1 AND/OR cond2`
- `SELECT ... FROM table ORDER BY field ASC/DESC`
- `SELECT ... FROM table LIMIT n OFFSET m`

**支持的操作符:**
- 比较: `=`, `!=`, `<>`, `<`, `>`, `<=`, `>=`
- 模式匹配: `LIKE`
- 列表: `IN`, `NOT IN`
- 空值: `IS NULL`, `IS NOT NULL`

**聚合函数:** `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`

**示例查询:**
```sql
SELECT * FROM servers
SELECT name, host FROM servers WHERE id = 1
SELECT COUNT(*) FROM status_logs WHERE online = true
SELECT * FROM player_sessions WHERE player_name LIKE '%Steve%' ORDER BY last_seen DESC LIMIT 10
SELECT AVG(latency) FROM status_logs WHERE server_id = 1 AND online = true
```
'''
        )
        @query_ns.expect(query_model)
        @query_ns.marshal_with(result_model)
        def post(self):
            """执行类SQL查询"""
            data = request.get_json()
            
            if not data or 'query' not in data:
                return {
                    'success': False,
                    'data': [],
                    'count': 0,
                    'error': '缺少 query 参数'
                }, 400
            
            query_str = data['query']
            
            try:
                # 解析查询
                parsed = parser.parse(query_str)
                
                # 构建参数化SQL
                sql, params = parser.build_sql(parsed)
                
                # 执行查询
                conn = poller.db.get_connection()
                try:
                    cursor = conn.cursor()
                    
                    if db_type == 'postgresql':
                        cursor.execute(sql, params)
                    else:
                        cursor.execute(sql, params)
                    
                    # 获取列名
                    columns = [desc[0] for desc in cursor.description]
                    
                    # 获取结果
                    rows = cursor.fetchall()
                    
                    # 转换为字典列表
                    result = []
                    for row in rows:
                        row_dict = {}
                        for i, col in enumerate(columns):
                            value = row[i]
                            # 处理特殊类型
                            if hasattr(value, 'isoformat'):
                                value = value.isoformat()
                            row_dict[col] = value
                        result.append(row_dict)
                    
                    return {
                        'success': True,
                        'data': result,
                        'count': len(result),
                        'sql': sql  # 调试用，可在生产环境移除
                    }
                    
                finally:
                    conn.close()
                    
            except QueryParseError as e:
                return {
                    'success': False,
                    'data': [],
                    'count': 0,
                    'error': str(e)
                }, 400
                
            except Exception as e:
                return {
                    'success': False,
                    'data': [],
                    'count': 0,
                    'error': f'查询执行失败: {str(e)}'
                }, 500

    @query_ns.route('/tables')
    class QueryTables(Resource):
        @query_ns.doc(
            '获取可查询的表列表',
            description='获取所有可查询的表名及其描述'
        )
        def get(self):
            """获取可查询的表列表"""
            return {
                table: {
                    'description': info['description'],
                    'field_count': len(info['fields'])
                }
                for table, info in ALLOWED_TABLES.items()
            }

    @query_ns.route('/tables/<string:table_name>')
    class QueryTableDetail(Resource):
        @query_ns.doc(
            '获取表详情',
            description='获取指定表的字段列表',
            params={'table_name': '表名'}
        )
        def get(self, table_name):
            """获取指定表的字段列表"""
            table_name = table_name.lower()
            if table_name not in ALLOWED_TABLES:
                return {
                    'error': f"表 '{table_name}' 不存在。可用的表: {', '.join(ALLOWED_TABLES.keys())}"
                }, 404
            
            return {
                'table': table_name,
                'description': ALLOWED_TABLES[table_name]['description'],
                'fields': ALLOWED_TABLES[table_name]['fields']
            }

    api.add_namespace(query_ns)
