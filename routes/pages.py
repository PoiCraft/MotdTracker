from flask import render_template, redirect, url_for, request
from utils.app_utils import get_server_nodes_data


def register_page_routes(app, poller):
    """Register HTML page routes."""

    @app.route('/')
    def index():
        return redirect(url_for('server_page'))

    @app.route('/server')
    def server_page():
        return render_template(
            'server.html',
            server_name=poller.config.get('server_name', 'Minecraft Server'),
            active_page='server'
        )

    @app.route('/nodes')
    def nodes_page():
        servers = get_server_nodes_data(poller)
        return render_template('nodes.html', servers=servers, active_page='nodes')

    @app.route('/players')
    def players_page():
        return render_template('players.html', active_page='players')

    @app.route('/player/<player_name>')
    def player_page(player_name):
        return render_template('player_detail.html', active_page='players')

    @app.route('/badges')
    def badges_page():
        nodes = poller.db.get_all_servers()
        base_url = request.url_root.rstrip('/')
        
        # 获取所有玩家列表（包括历史）
        player_list = poller.db.get_all_player_names()
        
        return render_template('badges.html', nodes=nodes, players=player_list, base_url=base_url, active_page='badges')
