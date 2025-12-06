// 全局变量
let charts = {};
let autoRefreshInterval;
let displayMode = 'grouped'; // 'grouped' or 'individual'
let chartHours = 12; // 全局图表小时数

// 工具函数
function getSnapshotLength() { 
    return chartHours * 3 * 60; 
}

function getChartLength() { 
    return chartHours * 60; 
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 加载服务器数据
async function loadData() {
    try {
        if (displayMode === 'grouped') {
            const response = await fetch('/api/groups');
            const groups = await response.json();
            displayGroups(groups);
        } else {
            const response = await fetch('/api/servers');
            const servers = await response.json();
            displayServers(servers);
        }
    } catch (error) {
        console.error('加载数据失败:', error);
        document.getElementById('servers-container').innerHTML = 
            '<div class="loading">❌ 加载数据失败，请刷新页面重试</div>';
    }
}

// 切换显示模式
function toggleDisplayMode() {
    displayMode = displayMode === 'grouped' ? 'individual' : 'grouped';
    document.getElementById('mode-btn').textContent = 
        displayMode === 'grouped' ? '📊 切换到单服务器视图' : '🔗 切换到分组视图';
    loadData();
}

// 显示分组服务器
async function displayGroups(groups) {
    const container = document.getElementById('servers-container');
    container.innerHTML = '';

    for (const group of groups) {
        const card = await createGroupCard(group);
        container.appendChild(card);
    }
}

// 显示服务器列表
async function displayServers(servers) {
    const container = document.getElementById('servers-container');
    container.innerHTML = '';

    for (const server of servers) {
        const card = await createServerCard(server);
        container.appendChild(card);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 全局时间跨度选择事件
    document.getElementById('global-range').addEventListener('change', function() {
        chartHours = parseInt(this.value);
        loadData();
    });

    // 初始加载
    loadData();

    // 自动刷新 (每60秒)
    autoRefreshInterval = setInterval(loadData, 60000);

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        Object.values(charts).forEach(chart => chart.destroy());
    });
});
