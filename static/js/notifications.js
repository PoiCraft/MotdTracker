/**
 * MotdTracker 通知系统
 * 支持页面内 Toast 通知和浏览器 Notification
 */

(function() {
    'use strict';

    // 通知配置
    const CONFIG = {
        toastDuration: 5000,      // Toast 显示时长（毫秒）
        maxToasts: 5,             // 最大同时显示的 Toast 数量
        notificationIcon: '/static/poi.png'  // 浏览器通知图标
    };

    // 通知容器
    let toastContainer = null;

    // 初始化通知容器
    function initToastContainer() {
        if (toastContainer) return;
        
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    /**
     * 检查页面是否在后台
     */
    function isPageHidden() {
        return document.hidden || document.visibilityState === 'hidden';
    }

    /**
     * 请求浏览器通知权限
     */
    function requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('[Notify] Browser does not support notifications');
            return Promise.resolve('denied');
        }
        
        if (Notification.permission === 'granted') {
            return Promise.resolve('granted');
        }
        
        if (Notification.permission !== 'denied') {
            return Notification.requestPermission();
        }
        
        return Promise.resolve(Notification.permission);
    }

    /**
     * 发送浏览器通知
     */
    function sendBrowserNotification(title, options = {}) {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return null;
        }
        
        const defaultOptions = {
            icon: CONFIG.notificationIcon,
            badge: CONFIG.notificationIcon,
            tag: options.tag || 'motdtracker-' + Date.now(),
            renotify: false,
            silent: false
        };
        
        const notification = new Notification(title, { ...defaultOptions, ...options });
        
        // 点击通知时聚焦窗口
        notification.onclick = function() {
            window.focus();
            notification.close();
        };
        
        // 自动关闭
        setTimeout(() => notification.close(), CONFIG.toastDuration);
        
        return notification;
    }

    /**
     * 显示 Toast 通知
     * @param {string} message - 消息内容
     * @param {string} type - 类型: 'info', 'success', 'warning', 'error'
     * @param {object} options - 额外选项
     */
    function showToast(message, type = 'info', options = {}) {
        initToastContainer();
        
        // 限制最大数量
        const toasts = toastContainer.querySelectorAll('.toast');
        if (toasts.length >= CONFIG.maxToasts) {
            toasts[0].remove();
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // 图标
        const icons = {
            info: '📢',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            player_online: '🟢',
            player_offline: '🔴',
            node_online: '🖥️',
            node_offline: '💔'
        };
        
        const icon = options.icon || icons[type] || icons.info;
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${escapeHtml(message)}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        toastContainer.appendChild(toast);
        
        // 触发动画
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
        });
        
        // 自动移除（duration = 0 表示不自动消失）
        const duration = options.duration !== undefined ? options.duration : CONFIG.toastDuration;
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('toast-show');
                toast.classList.add('toast-hide');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
        
        return toast;
    }

    /**
     * HTML 转义
     */
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * 发送通知（自动选择 Toast 或浏览器通知）
     * @param {string} title - 标题
     * @param {string} message - 消息
     * @param {string} type - 类型
     * @param {object} options - 额外选项
     */
    function notify(title, message, type = 'info', options = {}) {
        const fullMessage = message || title;
        
        if (isPageHidden()) {
            // 页面在后台，发送浏览器通知
            sendBrowserNotification(title, {
                body: message,
                tag: options.tag,
                ...options
            });
        } else {
            // 页面在前台，显示 Toast
            const displayMessage = message ? `${title}: ${message}` : title;
            showToast(displayMessage, type, options);
        }
        
        // 跟踪事件
        if (window.trackEvent) {
            window.trackEvent('notification', { type, title, hidden: isPageHidden() });
        }
    }

    // ==================== 状态变化检测 ====================

    // 缓存上一次的状态
    let previousState = {
        nodes: {},      // { nodeId: { online: boolean, name: string } }
        players: {}     // { playerName: { online: boolean } }
    };

    /**
     * 检测节点状态变化
     * @param {Array} nodes - 当前节点列表 [{ id, name, online }]
     */
    function checkNodeChanges(nodes) {
        if (!nodes || !Array.isArray(nodes)) return;
        
        const currentNodes = {};
        
        nodes.forEach(node => {
            const nodeId = node.id;
            const nodeName = node.name;
            // 支持两种格式: node.online 或 node.latest_status?.online
            const isOnline = typeof node.online === 'boolean' 
                ? node.online 
                : (node.latest_status?.online || false);
            
            currentNodes[nodeId] = { online: isOnline, name: nodeName };
            
            // 检查状态变化
            const prev = previousState.nodes[nodeId];
            if (prev !== undefined) {
                if (prev.online && !isOnline) {
                    // 节点离线
                    notify(
                        '节点离线',
                        `${nodeName} 已离线`,
                        'node_offline',
                        { tag: `node-${nodeId}`, icon: '💔' }
                    );
                } else if (!prev.online && isOnline) {
                    // 节点上线
                    notify(
                        '节点上线',
                        `${nodeName} 已上线`,
                        'node_online',
                        { tag: `node-${nodeId}`, icon: '🖥️' }
                    );
                }
            }
        });
        
        previousState.nodes = currentNodes;
    }

    /**
     * 检测玩家状态变化
     * @param {Array} players - 当前玩家列表 [{ name|player_name, online }]
     */
    function checkPlayerChanges(players) {
        if (!players || !Array.isArray(players)) return;
        
        const currentPlayers = {};
        
        players.forEach(player => {
            // 支持两种格式: player.name 或 player.player_name
            const name = player.name || player.player_name;
            const isOnline = player.online || false;
            
            currentPlayers[name] = { online: isOnline };
            
            // 检查状态变化
            const prev = previousState.players[name];
            if (prev !== undefined) {
                if (prev.online && !isOnline) {
                    // 玩家离线
                    notify(
                        '玩家离线',
                        `${name} 离开了游戏`,
                        'player_offline',
                        { tag: `player-${name}`, icon: '🔴' }
                    );
                } else if (!prev.online && isOnline) {
                    // 玩家上线
                    notify(
                        '玩家上线',
                        `${name} 加入了游戏`,
                        'player_online',
                        { tag: `player-${name}`, icon: '🟢' }
                    );
                }
            }
        });
        
        // 检测新玩家（之前不存在的）
        Object.keys(currentPlayers).forEach(name => {
            if (!(name in previousState.players) && currentPlayers[name].online) {
                // 新玩家上线
                notify(
                    '玩家上线',
                    `${name} 加入了游戏`,
                    'player_online',
                    { tag: `player-${name}`, icon: '🟢' }
                );
            }
        });
        
        // 检测消失的玩家（之前在线，现在不在列表中）
        Object.keys(previousState.players).forEach(name => {
            if (previousState.players[name].online && !(name in currentPlayers)) {
                // 玩家离线
                notify(
                    '玩家离线',
                    `${name} 离开了游戏`,
                    'player_offline',
                    { tag: `player-${name}`, icon: '🔴' }
                );
            }
        });
        
        previousState.players = currentPlayers;
    }

    /**
     * 初始化状态（不触发通知）
     * @param {object} data - 包含 nodes 和 players 的数据
     */
    function initState(data) {
        if (data.nodes && Array.isArray(data.nodes)) {
            data.nodes.forEach(node => {
                // 支持两种格式
                const isOnline = typeof node.online === 'boolean' 
                    ? node.online 
                    : (node.latest_status?.online || false);
                previousState.nodes[node.id] = {
                    online: isOnline,
                    name: node.name
                };
            });
        }
        
        if (data.players && Array.isArray(data.players)) {
            data.players.forEach(player => {
                // 支持两种格式: player.name 或 player.player_name
                const name = player.name || player.player_name;
                previousState.players[name] = {
                    online: player.online || false
                };
            });
        }
    }

    /**
     * 更新状态并检测变化
     * @param {object} data - 包含 nodes 和 players 的数据
     */
    function updateState(data) {
        if (data.nodes) {
            checkNodeChanges(data.nodes);
        }
        if (data.players) {
            checkPlayerChanges(data.players);
        }
    }

    // ==================== 导出 API ====================

    window.MotdNotify = {
        // 基础方法
        showToast,
        sendBrowserNotification,
        notify,
        requestPermission: requestNotificationPermission,
        
        // 状态检测
        initState,
        updateState,
        checkNodeChanges,
        checkPlayerChanges,
        
        // 快捷方法
        info: (msg, opts) => showToast(msg, 'info', opts),
        success: (msg, opts) => showToast(msg, 'success', opts),
        warning: (msg, opts) => showToast(msg, 'warning', opts),
        error: (msg, opts) => showToast(msg, 'error', opts),
        
        // 配置
        config: CONFIG
    };

    // 自动请求通知权限
    document.addEventListener('DOMContentLoaded', () => {
        // 延迟请求权限，避免首次加载时打扰用户
        setTimeout(() => {
            if (Notification.permission === 'default') {
                // 可以在这里添加一个 UI 提示用户授权
                console.log('[Notify] Notification permission not yet requested');
            }
        }, 3000);
    });

})();
