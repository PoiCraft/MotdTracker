"""GraphQL API 路由

提供 GraphQL 查询端点和 GraphiQL 交互式界面。
"""
from flask import Blueprint, request, jsonify, render_template_string
from routes.graphql_schema import schema


# GraphiQL HTML 模板
GRAPHIQL_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>MotdTracker GraphQL</title>
    <link href="https://unpkg.com/graphiql@3.0.10/graphiql.min.css" rel="stylesheet" />
</head>
<body style="margin: 0; overflow: hidden;">
    <div id="graphiql" style="height: 100vh;"></div>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/graphiql@3.0.10/graphiql.min.js"></script>
    <script>
        const fetcher = GraphiQL.createFetcher({
            url: window.location.origin + '/api/graphql',
        });
        const root = ReactDOM.createRoot(document.getElementById('graphiql'));
        root.render(
            React.createElement(GraphiQL, {
                fetcher: fetcher,
                defaultEditorToolsVisibility: true,
                defaultQuery: `# MotdTracker GraphQL API
# 
# 示例查询：获取所有节点及其最新状态

{
  nodes {
    id
    name
    host
    port
    color
    enabled
    latestStatus {
      online
      latency
      playersOnline
      playersMax
      version
    }
    latencyStats {
      uptimePercentage
      avgLatency
      p95Latency
    }
  }
}

# 更多查询示例:
#
# 获取服务器实时状态:
# {
#   serverHead {
#     online
#     playersOnline
#     playersMax
#     version
#     latencies {
#       nodeName
#       latency
#     }
#   }
# }
#
# 获取在线玩家:
# {
#   onlinePlayers {
#     playerName
#     sessionStart
#     durationSeconds
#     servers {
#       serverName
#       online
#     }
#   }
# }
#
# 获取玩家详情:
# {
#   player(name: "Steve", days: 7) {
#     playerName
#     online
#     firstSeen
#     totalPlaytimeSeconds
#     sessions {
#       sessionStart
#       sessionEnd
#       durationSeconds
#     }
#   }
# }
`,
            })
        );
    </script>
</body>
</html>
'''


def register_graphql_routes(app, poller):
    """
    注册 GraphQL 路由
    
    Args:
        app: Flask 应用实例
        poller: ServerPoller 实例
    """
    graphql_bp = Blueprint('graphql', __name__, url_prefix='/api')
    
    @graphql_bp.route('/graphql', methods=['GET', 'POST'])
    def graphql_endpoint():
        """GraphQL 端点"""
        # GET 请求返回 GraphiQL 界面
        if request.method == 'GET':
            # 检查是否请求 GraphiQL 界面
            if request.accept_mimetypes.best == 'text/html':
                return render_template_string(GRAPHIQL_TEMPLATE)
            # 否则尝试从 query string 获取查询
            query = request.args.get('query')
            variables = request.args.get('variables')
            operation_name = request.args.get('operationName')
        else:
            # POST 请求
            content_type = request.content_type or ''
            
            if 'application/json' in content_type:
                data = request.get_json(silent=True) or {}
            elif 'application/graphql' in content_type:
                data = {'query': request.data.decode('utf-8')}
            else:
                data = request.get_json(silent=True) or {}
            
            query = data.get('query')
            variables = data.get('variables')
            operation_name = data.get('operationName')
        
        if not query:
            return jsonify({'errors': [{'message': 'Must provide query string.'}]}), 400
        
        # 解析 variables
        if isinstance(variables, str):
            import json
            try:
                variables = json.loads(variables)
            except json.JSONDecodeError:
                variables = None
        
        # 执行查询
        result = schema.execute(
            query,
            variables=variables,
            operation_name=operation_name,
            context={'poller': poller}
        )
        
        response_data = {}
        
        if result.data:
            response_data['data'] = result.data
        
        if result.errors:
            response_data['errors'] = [
                {
                    'message': str(error),
                    'locations': [
                        {'line': loc.line, 'column': loc.column}
                        for loc in (error.locations or [])
                    ] if hasattr(error, 'locations') else None,
                    'path': error.path if hasattr(error, 'path') else None
                }
                for error in result.errors
            ]
        
        status_code = 200 if not result.errors else 400
        return jsonify(response_data), status_code
    
    @graphql_bp.route('/graphiql')
    def graphiql():
        """GraphiQL 交互式界面"""
        return render_template_string(GRAPHIQL_TEMPLATE)
    
    app.register_blueprint(graphql_bp)
