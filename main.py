from flask import Flask
from flask_socketio import SocketIO
from flask_restx import Api
from poller import ServerPoller
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


# 创建Flask应用
app = Flask(__name__)
app.config['SECRET_KEY'] = 'minecraft-tracker-secret-key'

# 初始化SocketIO，调整路径到 /api/socket.io，便于与 API 前缀保持一致
socketio = SocketIO(app, cors_allowed_origins="*", path="/api/socket.io")

# 初始化 Swagger API（基础路径 /api）
api = Api(
    app,
    title='MotdTracker API',
    version='1.0',
    description='Minecraft 服务器监控 API 文档',
    doc='/api/docs',
    prefix='/api'
)

# 初始化轮询器
poller = ServerPoller('config.json', socketio=socketio)

register_page_routes(app, poller)
register_node_routes(api, poller)
register_server_routes(api, poller)
register_player_routes(api, poller)
register_exporter_routes(api, poller)
register_badge_routes(api, poller)
register_web_routes(api, poller)  # Web 前端专用 API


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

