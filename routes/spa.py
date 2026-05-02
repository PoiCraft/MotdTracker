import os
from flask import send_from_directory, request


def register_spa_routes(app):
    """Register 404 fallback for React SPA client-side routing.

    When no Flask route matches and the path is not an API/static path,
    serve index.html so react-router can handle client-side routing.
    """

    dist_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")

    if not os.path.isdir(dist_dir):
        return

    @app.errorhandler(404)
    def spa_fallback(error):
        path = request.path.lstrip("/")

        if path.startswith("api/") or path.startswith("static/"):
            return error

        if not path:
            return send_from_directory(dist_dir, "index.html")

        file_path = os.path.join(dist_dir, path)
        if os.path.isfile(file_path):
            return send_from_directory(dist_dir, path)

        return send_from_directory(dist_dir, "index.html")
