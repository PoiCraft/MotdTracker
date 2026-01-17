"""类SQL查询解析器

提供安全的类SQL查询接口，解析用户输入并构建参数化查询。
只允许 SELECT 操作，通过白名单控制可查询的表和字段。
"""
import re
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass


# 允许查询的表及其字段白名单
ALLOWED_TABLES = {
    'servers': {
        'fields': ['id', 'name', 'host', 'port', 'color'],
        'description': '服务器/节点配置表'
    },
    'status_logs': {
        'fields': ['id', 'server_id', 'timestamp', 'online', 'latency', 
                   'players_online', 'players_max', 'version', 'motd', 
                   'sample_players', 'software', 'plugins', 'map'],
        'description': '服务器状态历史记录表'
    },
    'player_sessions': {
        'fields': ['server_id', 'player_name', 'first_seen', 'session_start',
                   'last_seen', 'is_online', 'total_playtime'],
        'description': '玩家会话记录表'
    }
}

# 允许的操作符
ALLOWED_OPERATORS = ['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'IN', 'NOT IN', 'IS', 'IS NOT']

# 允许的逻辑连接符
ALLOWED_CONNECTORS = ['AND', 'OR']

# 允许的排序方向
ALLOWED_ORDER = ['ASC', 'DESC']

# 允许的聚合函数
ALLOWED_FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']


@dataclass
class ParsedQuery:
    """解析后的查询结构"""
    table: str
    fields: List[str]
    conditions: List[Dict[str, Any]]
    order_by: Optional[List[Tuple[str, str]]]
    limit: int
    offset: int
    is_count: bool = False


class QueryParseError(Exception):
    """查询解析错误"""
    pass


class QueryParser:
    """类SQL查询解析器"""
    
    MAX_LIMIT = 1000  # 最大返回行数
    DEFAULT_LIMIT = 100  # 默认返回行数
    
    def __init__(self, db_type: str = 'sqlite'):
        """
        初始化解析器
        
        Args:
            db_type: 数据库类型 ('sqlite' 或 'postgresql')
        """
        self.db_type = db_type
    
    def get_schema(self) -> Dict[str, Any]:
        """获取可查询的表结构信息"""
        return {
            'tables': {
                name: {
                    'fields': info['fields'],
                    'description': info['description']
                }
                for name, info in ALLOWED_TABLES.items()
            },
            'operators': ALLOWED_OPERATORS,
            'functions': ALLOWED_FUNCTIONS,
            'max_limit': self.MAX_LIMIT,
            'default_limit': self.DEFAULT_LIMIT
        }
    
    def parse(self, query: str) -> ParsedQuery:
        """
        解析类SQL查询语句
        
        支持的语法:
            SELECT field1, field2 FROM table
            SELECT * FROM table
            SELECT COUNT(*) FROM table
            SELECT ... FROM table WHERE condition
            SELECT ... FROM table WHERE cond1 AND cond2
            SELECT ... FROM table ORDER BY field ASC/DESC
            SELECT ... FROM table LIMIT n OFFSET m
        
        Args:
            query: 类SQL查询字符串
            
        Returns:
            ParsedQuery: 解析后的查询结构
            
        Raises:
            QueryParseError: 解析失败时抛出
        """
        if not query or not query.strip():
            raise QueryParseError("查询语句不能为空")
        
        # 规范化查询字符串
        query = ' '.join(query.split())  # 合并多余空格
        
        # 检查是否以 SELECT 开头
        if not query.upper().startswith('SELECT '):
            raise QueryParseError("只支持 SELECT 查询")
        
        # 提取各部分
        try:
            return self._parse_select(query)
        except QueryParseError:
            raise
        except Exception as e:
            raise QueryParseError(f"查询解析失败: {str(e)}")
    
    def _parse_select(self, query: str) -> ParsedQuery:
        """解析 SELECT 语句"""
        upper_query = query.upper()
        
        # 提取 LIMIT 和 OFFSET
        limit = self.DEFAULT_LIMIT
        offset = 0
        
        limit_match = re.search(r'\bLIMIT\s+(\d+)', upper_query)
        if limit_match:
            limit = min(int(limit_match.group(1)), self.MAX_LIMIT)
            query = query[:limit_match.start()] + query[limit_match.end():]
            upper_query = query.upper()
        
        offset_match = re.search(r'\bOFFSET\s+(\d+)', upper_query)
        if offset_match:
            offset = int(offset_match.group(1))
            query = query[:offset_match.start()] + query[offset_match.end():]
            upper_query = query.upper()
        
        # 提取 ORDER BY
        order_by = None
        order_match = re.search(r'\bORDER\s+BY\s+(.+?)(?=\s*$)', upper_query)
        if order_match:
            order_clause = query[order_match.start():order_match.end()]
            order_by = self._parse_order_by(order_clause)
            query = query[:order_match.start()]
            upper_query = query.upper()
        
        # 提取 WHERE
        conditions = []
        where_match = re.search(r'\bWHERE\s+(.+?)(?=\s*$)', upper_query)
        if where_match:
            where_clause = query[where_match.start() + 6:].strip()  # 跳过 "WHERE "
            conditions = self._parse_where(where_clause)
            query = query[:where_match.start()]
            upper_query = query.upper()
        
        # 提取 FROM
        from_match = re.search(r'\bFROM\s+(\w+)', upper_query)
        if not from_match:
            raise QueryParseError("缺少 FROM 子句")
        
        table = from_match.group(1).lower()
        if table not in ALLOWED_TABLES:
            raise QueryParseError(f"不允许查询的表: {table}。允许的表: {', '.join(ALLOWED_TABLES.keys())}")
        
        # 提取字段列表
        select_part = query[7:from_match.start()].strip()  # 跳过 "SELECT "
        fields, is_count = self._parse_fields(select_part, table)
        
        # 验证 ORDER BY 字段
        if order_by:
            for field, _ in order_by:
                if field != '*' and field.lower() not in [f.lower() for f in ALLOWED_TABLES[table]['fields']]:
                    raise QueryParseError(f"ORDER BY 中的字段 '{field}' 不在表 '{table}' 的允许字段中")
        
        return ParsedQuery(
            table=table,
            fields=fields,
            conditions=conditions,
            order_by=order_by,
            limit=limit,
            offset=offset,
            is_count=is_count
        )
    
    def _parse_fields(self, fields_str: str, table: str) -> Tuple[List[str], bool]:
        """解析字段列表"""
        fields_str = fields_str.strip()
        
        # 检查 COUNT(*)
        if re.match(r'^COUNT\s*\(\s*\*\s*\)$', fields_str.upper()):
            return ['COUNT(*)'], True
        
        # 检查其他聚合函数
        func_match = re.match(r'^(\w+)\s*\(\s*(\w+|\*)\s*\)$', fields_str.upper())
        if func_match:
            func_name = func_match.group(1)
            if func_name in ALLOWED_FUNCTIONS:
                field = func_match.group(2)
                if field != '*' and field.lower() not in [f.lower() for f in ALLOWED_TABLES[table]['fields']]:
                    raise QueryParseError(f"聚合函数中的字段 '{field}' 不在表 '{table}' 的允许字段中")
                return [f"{func_name}({field})"], True
        
        # 处理 * 
        if fields_str == '*':
            return ALLOWED_TABLES[table]['fields'].copy(), False
        
        # 解析字段列表
        fields = [f.strip() for f in fields_str.split(',')]
        validated_fields = []
        allowed_fields_lower = [f.lower() for f in ALLOWED_TABLES[table]['fields']]
        
        for field in fields:
            field_lower = field.lower()
            if field_lower not in allowed_fields_lower:
                raise QueryParseError(
                    f"字段 '{field}' 不在表 '{table}' 的允许字段中。"
                    f"允许的字段: {', '.join(ALLOWED_TABLES[table]['fields'])}"
                )
            # 使用原始大小写
            idx = allowed_fields_lower.index(field_lower)
            validated_fields.append(ALLOWED_TABLES[table]['fields'][idx])
        
        return validated_fields, False
    
    def _parse_order_by(self, order_clause: str) -> List[Tuple[str, str]]:
        """解析 ORDER BY 子句"""
        # 移除 "ORDER BY " 前缀
        order_clause = re.sub(r'^ORDER\s+BY\s+', '', order_clause, flags=re.IGNORECASE).strip()
        
        result = []
        parts = order_clause.split(',')
        
        for part in parts:
            part = part.strip()
            tokens = part.split()
            
            if not tokens:
                continue
            
            field = tokens[0]
            direction = 'ASC'
            
            if len(tokens) > 1:
                dir_upper = tokens[1].upper()
                if dir_upper in ALLOWED_ORDER:
                    direction = dir_upper
                else:
                    raise QueryParseError(f"无效的排序方向: {tokens[1]}。允许: ASC, DESC")
            
            result.append((field, direction))
        
        return result
    
    def _parse_where(self, where_clause: str) -> List[Dict[str, Any]]:
        """
        解析 WHERE 子句
        
        返回条件列表，每个条件包含:
        - field: 字段名
        - operator: 操作符
        - value: 值
        - connector: 与下一个条件的连接符 (AND/OR)，最后一个为 None
        """
        conditions = []
        
        # 简单的条件解析（支持 AND/OR）
        # 使用正则分割，保留连接符
        pattern = r'\s+(AND|OR)\s+'
        parts = re.split(pattern, where_clause, flags=re.IGNORECASE)
        
        i = 0
        while i < len(parts):
            condition_str = parts[i].strip()
            connector = None
            
            if i + 1 < len(parts):
                connector = parts[i + 1].upper()
                i += 2
            else:
                i += 1
            
            if not condition_str:
                continue
            
            condition = self._parse_condition(condition_str)
            condition['connector'] = connector
            conditions.append(condition)
        
        return conditions
    
    def _parse_condition(self, condition_str: str) -> Dict[str, Any]:
        """解析单个条件"""
        condition_str = condition_str.strip()
        
        # 处理 IS NULL / IS NOT NULL
        is_null_match = re.match(r'^(\w+)\s+(IS\s+NOT\s+NULL|IS\s+NULL)$', condition_str, re.IGNORECASE)
        if is_null_match:
            return {
                'field': is_null_match.group(1),
                'operator': 'IS NOT NULL' if 'NOT' in is_null_match.group(2).upper() else 'IS NULL',
                'value': None
            }
        
        # 处理 IN / NOT IN
        in_match = re.match(r'^(\w+)\s+(NOT\s+IN|IN)\s*\((.+)\)$', condition_str, re.IGNORECASE)
        if in_match:
            field = in_match.group(1)
            operator = 'NOT IN' if 'NOT' in in_match.group(2).upper() else 'IN'
            values_str = in_match.group(3)
            values = self._parse_value_list(values_str)
            return {
                'field': field,
                'operator': operator,
                'value': values
            }
        
        # 处理 LIKE
        like_match = re.match(r'^(\w+)\s+(LIKE)\s+(.+)$', condition_str, re.IGNORECASE)
        if like_match:
            return {
                'field': like_match.group(1),
                'operator': 'LIKE',
                'value': self._parse_value(like_match.group(3).strip())
            }
        
        # 处理比较操作符
        for op in ['!=', '<>', '<=', '>=', '=', '<', '>']:
            if op in condition_str:
                parts = condition_str.split(op, 1)
                if len(parts) == 2:
                    return {
                        'field': parts[0].strip(),
                        'operator': op,
                        'value': self._parse_value(parts[1].strip())
                    }
        
        raise QueryParseError(f"无法解析条件: {condition_str}")
    
    def _parse_value(self, value_str: str) -> Any:
        """解析值"""
        value_str = value_str.strip()
        
        # 字符串（单引号或双引号）
        if (value_str.startswith("'") and value_str.endswith("'")) or \
           (value_str.startswith('"') and value_str.endswith('"')):
            return value_str[1:-1]
        
        # NULL
        if value_str.upper() == 'NULL':
            return None
        
        # 布尔值
        if value_str.upper() == 'TRUE':
            return True
        if value_str.upper() == 'FALSE':
            return False
        
        # 数字
        try:
            if '.' in value_str:
                return float(value_str)
            return int(value_str)
        except ValueError:
            pass
        
        # 作为字符串处理
        return value_str
    
    def _parse_value_list(self, values_str: str) -> List[Any]:
        """解析值列表（用于 IN 操作符）"""
        values = []
        # 简单分割，注意处理字符串中的逗号
        current = ''
        in_string = False
        string_char = None
        
        for char in values_str:
            if char in ("'", '"') and not in_string:
                in_string = True
                string_char = char
                current += char
            elif char == string_char and in_string:
                in_string = False
                string_char = None
                current += char
            elif char == ',' and not in_string:
                if current.strip():
                    values.append(self._parse_value(current.strip()))
                current = ''
            else:
                current += char
        
        if current.strip():
            values.append(self._parse_value(current.strip()))
        
        return values
    
    def build_sql(self, parsed: ParsedQuery) -> Tuple[str, List[Any]]:
        """
        根据解析结果构建参数化SQL
        
        Args:
            parsed: 解析后的查询结构
            
        Returns:
            Tuple[str, List[Any]]: (SQL语句, 参数列表)
        """
        params = []
        
        # 构建 SELECT 部分
        if parsed.is_count:
            fields_str = parsed.fields[0]
        else:
            fields_str = ', '.join(parsed.fields)
        
        sql = f"SELECT {fields_str} FROM {parsed.table}"
        
        # 构建 WHERE 部分
        if parsed.conditions:
            where_parts = []
            for i, cond in enumerate(parsed.conditions):
                field = cond['field']
                operator = cond['operator']
                value = cond['value']
                
                # 验证字段
                if field.lower() not in [f.lower() for f in ALLOWED_TABLES[parsed.table]['fields']]:
                    raise QueryParseError(f"WHERE 中的字段 '{field}' 不在表 '{parsed.table}' 的允许字段中")
                
                if operator in ('IS NULL', 'IS NOT NULL'):
                    where_parts.append(f"{field} {operator}")
                elif operator in ('IN', 'NOT IN'):
                    placeholders = ', '.join([self._get_placeholder(len(params) + j) for j in range(len(value))])
                    where_parts.append(f"{field} {operator} ({placeholders})")
                    params.extend(value)
                else:
                    where_parts.append(f"{field} {operator} {self._get_placeholder(len(params))}")
                    params.append(value)
                
                if cond.get('connector'):
                    where_parts.append(cond['connector'])
            
            sql += " WHERE " + ' '.join(where_parts)
        
        # 构建 ORDER BY 部分
        if parsed.order_by:
            order_parts = [f"{field} {direction}" for field, direction in parsed.order_by]
            sql += " ORDER BY " + ', '.join(order_parts)
        
        # 构建 LIMIT 和 OFFSET
        sql += f" LIMIT {parsed.limit}"
        if parsed.offset > 0:
            sql += f" OFFSET {parsed.offset}"
        
        return sql, params
    
    def _get_placeholder(self, index: int) -> str:
        """获取参数占位符"""
        if self.db_type == 'postgresql':
            return f"${index + 1}"
        return '?'
