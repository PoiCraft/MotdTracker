//! HTML 页面路由

use axum::response::Html;

/// 服务器监控页面
pub async fn server_page() -> Html<&'static str> {
    Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>服务器监控 - MotdTracker</title>
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <div id="app">
        <h1>服务器监控</h1>
        <p>正在加载...</p>
    </div>
    <script src="/static/js/socket.io.min.js"></script>
    <script src="/static/js/chart.min.js"></script>
    <script src="/static/js/app.js"></script>
</body>
</html>
"#)
}

/// 节点列表页面
pub async fn nodes_page() -> Html<&'static str> {
    Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>节点列表 - MotdTracker</title>
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <div id="app">
        <h1>节点列表</h1>
        <p>正在加载...</p>
    </div>
</body>
</html>
"#)
}

/// 玩家列表页面
pub async fn players_page() -> Html<&'static str> {
    Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>玩家列表 - MotdTracker</title>
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <div id="app">
        <h1>玩家列表</h1>
        <p>正在加载...</p>
    </div>
</body>
</html>
"#)
}

/// 玩家详情页面
pub async fn player_detail_page(
    axum::extract::Path(_name): axum::extract::Path<String>,
) -> Html<&'static str> {
    Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>玩家详情 - MotdTracker</title>
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <div id="app">
        <h1>玩家详情</h1>
        <p>正在加载...</p>
    </div>
</body>
</html>
"#)
}

/// Badge 展示页面
pub async fn badges_page() -> Html<&'static str> {
    Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>Badges - MotdTracker</title>
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <div id="app">
        <h1>Badges</h1>
        <p>正在加载...</p>
    </div>
</body>
</html>
"#)
}
