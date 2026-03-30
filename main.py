from flask import Flask
from flask_socketio import SocketIO
from flask_restx import Api
from flask_cors import CORS
from core.poller import ServerPoller
from utils.app_utils import get_version
from utils.config_loader import load_config
import atexit
import signal
import sys

from routes.pages import register_page_routes
from routes.node_api import register_node_routes
from routes.server_api import register_server_routes
from routes.player_api import register_player_routes
from routes.exporter import register_exporter_routes
from routes.badge_api import register_badge_routes
from routes.web_api import register_web_routes
from routes.query_api import register_query_routes
from routes.graphql_api import register_graphql_routes


# 创建Flask应用
app = Flask(__name__)
app.config['SECRET_KEY'] = 'minecraft-tracker-secret-key'

try:
    bootstrap_config = load_config()
except Exception:
    bootstrap_config = {}

frontend_origins = bootstrap_config.get('frontend_origins', '*')
CORS(app, resources={r"/api/*": {"origins": frontend_origins}})

# 添加全局上下文处理器，使版本号对所有模板可用
@app.context_processor
def inject_version():
    return {'app_version': get_version()}


# 添加 Umami 分析配置上下文处理器
@app.context_processor
def inject_umami_config():
    from utils.config_loader import load_config
    try:
        config = load_config()
        umami = config.get('umami', {})
        if umami.get('enabled', False):
            return {
                'umami_enabled': True,
                'umami_script_url': umami.get('script_url', ''),
                'umami_website_id': umami.get('website_id', ''),
                'umami_domains': umami.get('domains', '')
            }
    except Exception:
        pass
    return {'umami_enabled': False}

# 初始化SocketIO，调整路径到 /api/socket.io，便于与 API 前缀保持一致
socketio = SocketIO(
    app,
    cors_allowed_origins=frontend_origins,
    path="/api/socket.io"
)

# 初始化 Swagger API（基础路径 /api）
api = Api(
    app,
    title='MotdTracker API',
    version=get_version(),
    description='Minecraft 服务器监控 API 文档',
    doc='/api/docs',
    prefix='/api'
)

# 初始化轮询器（自动检测 config.toml 或 config.json）
poller = ServerPoller(socketio=socketio)

if not poller.config.get('api_only', False):
    register_page_routes(app, poller)
register_node_routes(api, poller)
register_server_routes(api, poller)
register_player_routes(api, poller)
register_exporter_routes(api, poller)
register_badge_routes(api, poller)
register_web_routes(api, poller)  # Web 前端专用 API
register_query_routes(api, poller)  # 类SQL查询 API
register_graphql_routes(app, poller)  # GraphQL API


def main():
    """主函数"""
    def graceful_shutdown(signum=None, frame=None):
        print("收到退出信号，正在停止服务...")
        try:
            poller.stop()
        finally:
            sys.exit(0)

    for sig_name in ("SIGINT", "SIGTERM"):
        sig = getattr(signal, sig_name, None)
        if sig is not None:
            try:
                signal.signal(sig, graceful_shutdown)
            except Exception:
                pass

    poller.start()
    atexit.register(poller.stop)

    print("Minecraft服务器监控已启动")
    print("访问 http://127.0.0.1:5011 查看监控面板")
    print("按 Ctrl+C 停止服务")

    port = poller.config.get('port', 5011)
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)


if __name__ == '__main__':
    main()

