const DEFAULT_CONFIG = {
    storageKey: 'vib34d-performance-osc',
    defaults: {
        enabled: false,
        autoConnect: false,
        endpoint: 'ws://localhost:3030',
        namespace: '/performance',
        forward: {
            touchpad: true,
            audio: true,
            show: true,
            presets: true,
            hardware: true,
            gestures: true,
            theme: true
        }
    }
};

const EVENT_MAP = {
    touchpad: ['touchpad:update', 'touchpad:mappings'],
    audio: ['audio:settings', 'audio:flourish'],
    show: ['show:start', 'show:stop', 'show:cue-trigger'],
    presets: ['preset:saved', 'preset:loaded', 'preset:playlist-start', 'preset:list-changed'],
    hardware: ['hardware:midi-value'],
    gestures: [
        'gestures:recording-start',
        'gestures:recording-stop',
        'gestures:playback-start',
        'gestures:playback-event',
        'gestures:playback-stop',
        'gestures:playback-complete',
        'gestures:list'
    ],
    theme: ['theme:updated', 'theme:applied']
};

const LOG_LIMIT = 12;

function clone(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        console.warn('PerformanceOscBridge failed to clone value', error);
        return value;
    }
}

function mergeForward(defaults = {}, overrides = {}) {
    const result = { ...defaults };
    Object.keys(defaults).forEach(key => {
        if (Object.prototype.hasOwnProperty.call(overrides, key)) {
            result[key] = !!overrides[key];
        }
    });
    Object.keys(overrides || {}).forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(result, key)) {
            result[key] = !!overrides[key];
        }
    });
    return result;
}

function normalizeState(state = {}, defaults = DEFAULT_CONFIG.defaults) {
    const base = clone(defaults || DEFAULT_CONFIG.defaults);
    const merged = { ...base, ...(state || {}) };
    merged.forward = mergeForward(base.forward, state.forward || {});
    Object.keys(EVENT_MAP).forEach(key => {
        if (typeof merged.forward[key] === 'undefined') {
            merged.forward[key] = false;
        } else {
            merged.forward[key] = !!merged.forward[key];
        }
    });
    merged.enabled = !!merged.enabled;
    merged.autoConnect = !!merged.autoConnect;
    merged.endpoint = typeof merged.endpoint === 'string' && merged.endpoint.trim()
        ? merged.endpoint.trim()
        : base.endpoint;
    merged.namespace = typeof merged.namespace === 'string' && merged.namespace.trim()
        ? merged.namespace.trim()
        : base.namespace;
    return merged;
}

function safeParse(value, fallback = null) {
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function formatTime(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export class PerformanceOscBridge {
    constructor({ container = null, config = {}, hub = null, onStatusChange = null } = {}) {
        this.container = container || this.ensureContainer();
        this.config = { ...DEFAULT_CONFIG, ...(config || {}) };
        this.defaults = clone(this.config.defaults || DEFAULT_CONFIG.defaults);
        this.hub = hub;
        this.onStatusChange = typeof onStatusChange === 'function' ? onStatusChange : () => {};

        this.storageKey = this.config.storageKey || DEFAULT_CONFIG.storageKey;
        this.state = normalizeState(this.loadState(), this.defaults);
        this.socket = null;
        this.isConnected = false;
        this.subscriptions = [];
        this.log = [];

        this.statusEl = null;
        this.endpointInput = null;
        this.namespaceInput = null;
        this.enableToggle = null;
        this.autoConnectToggle = null;
        this.connectButton = null;
        this.testButton = null;
        this.logList = null;
        this.forwardToggles = new Map();

        this.render();
        this.bindEvents();
        this.subscribeToHub();
        this.refreshUI();

        if (this.state.enabled && this.state.autoConnect) {
            this.connect({ silent: true });
        } else {
            this.updateStatus(this.state.enabled ? 'Bridge idle' : 'Bridge disabled');
        }
    }

    ensureContainer() {
        if (typeof document === 'undefined') {
            return null;
        }
        const section = document.createElement('section');
        section.className = 'performance-block performance-osc';
        return section;
    }

    render() {
        if (!this.container) return;

        this.container.classList.add('performance-block', 'performance-osc');
        this.container.innerHTML = `
            <header class="performance-block__header">
                <div>
                    <h3 class="performance-block__title">Network / OSC Bridge</h3>
                    <p class="performance-block__subtitle">Mirror hub events to remote rigs over WebSocket.</p>
                </div>
            </header>
            <div class="osc-bridge__status" data-role="status">Bridge disabled</div>
            <div class="osc-bridge__controls">
                <label class="osc-bridge__field">
                    <span>Endpoint</span>
                    <input type="text" data-role="endpoint" placeholder="ws://localhost:3030" />
                </label>
                <label class="osc-bridge__field">
                    <span>Namespace</span>
                    <input type="text" data-role="namespace" placeholder="/performance" />
                </label>
                <label class="osc-bridge__toggle">
                    <input type="checkbox" data-role="enabled" /> Enable bridge
                </label>
                <label class="osc-bridge__toggle">
                    <input type="checkbox" data-role="auto" /> Auto-connect
                </label>
                <button type="button" class="osc-bridge__connect" data-role="connect">Connect</button>
                <button type="button" class="osc-bridge__test" data-role="test">Send heartbeat</button>
            </div>
            <div class="osc-bridge__forward">
                <h4>Forward events</h4>
                <div class="osc-bridge__forward-grid" data-role="forward-grid"></div>
            </div>
            <div class="osc-bridge__log">
                <h4>Recent messages</h4>
                <ul data-role="log"></ul>
            </div>
        `;

        this.statusEl = this.container.querySelector('[data-role="status"]');
        this.endpointInput = this.container.querySelector('[data-role="endpoint"]');
        this.namespaceInput = this.container.querySelector('[data-role="namespace"]');
        this.enableToggle = this.container.querySelector('[data-role="enabled"]');
        this.autoConnectToggle = this.container.querySelector('[data-role="auto"]');
        this.connectButton = this.container.querySelector('[data-role="connect"]');
        this.testButton = this.container.querySelector('[data-role="test"]');
        this.logList = this.container.querySelector('[data-role="log"]');

        const forwardGrid = this.container.querySelector('[data-role="forward-grid"]');
        forwardGrid.innerHTML = '';
        Object.keys(EVENT_MAP).forEach(key => {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            const item = document.createElement('label');
            item.className = 'osc-bridge__forward-item';
            item.innerHTML = `
                <input type="checkbox" data-role="forward" data-key="${key}" />
                <span>${label}</span>
            `;
            forwardGrid.appendChild(item);
            const checkbox = item.querySelector('input[data-role="forward"]');
            this.forwardToggles.set(key, checkbox);
        });
    }

    bindEvents() {
        if (!this.container) return;

        this.endpointInput?.addEventListener('change', () => {
            this.state.endpoint = this.endpointInput.value.trim();
            if (!this.state.endpoint) {
                this.state.endpoint = this.defaults.endpoint;
                this.refreshUI();
            }
            this.persistState();
        });
        this.namespaceInput?.addEventListener('change', () => {
            this.state.namespace = this.namespaceInput.value.trim();
            if (!this.state.namespace) {
                this.state.namespace = this.defaults.namespace;
                this.refreshUI();
            }
            this.persistState();
        });
        this.enableToggle?.addEventListener('change', () => {
            this.setEnabled(this.enableToggle.checked);
        });
        this.autoConnectToggle?.addEventListener('change', () => {
            this.state.autoConnect = this.autoConnectToggle.checked;
            this.persistState();
            if (this.state.enabled && this.state.autoConnect && !this.isConnected) {
                this.connect();
            }
        });
        this.connectButton?.addEventListener('click', () => {
            if (this.isConnected) {
                this.disconnect({ manual: true });
            } else {
                this.connect();
            }
        });
        this.testButton?.addEventListener('click', () => {
            this.sendTestHeartbeat();
        });
        this.forwardToggles.forEach((checkbox, key) => {
            checkbox.addEventListener('change', () => {
                this.state.forward[key] = checkbox.checked;
                this.persistState();
            });
        });
    }

    subscribeToHub() {
        if (!this.hub || typeof this.hub.on !== 'function') {
            return;
        }
        Object.keys(EVENT_MAP).forEach(category => {
            EVENT_MAP[category].forEach(eventName => {
                const unsubscribe = this.hub.on(eventName, payload => {
                    this.forwardEvent(eventName, payload, category);
                });
                this.subscriptions.push(unsubscribe);
            });
        });
    }

    refreshUI() {
        if (this.endpointInput) {
            this.endpointInput.value = this.state.endpoint;
        }
        if (this.namespaceInput) {
            this.namespaceInput.value = this.state.namespace;
        }
        if (this.enableToggle) {
            this.enableToggle.checked = this.state.enabled;
        }
        if (this.autoConnectToggle) {
            this.autoConnectToggle.checked = this.state.autoConnect;
        }
        this.forwardToggles.forEach((checkbox, key) => {
            checkbox.checked = !!this.state.forward[key];
        });
        this.updateConnectButton();
        this.renderLog();
    }

    updateConnectButton() {
        if (!this.connectButton) return;
        if (this.isConnected) {
            this.connectButton.textContent = 'Disconnect';
            this.connectButton.classList.add('is-active');
        } else {
            this.connectButton.textContent = 'Connect';
            this.connectButton.classList.remove('is-active');
        }
    }

    loadState() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return clone(this.defaults);
        }
        try {
            const stored = window.localStorage.getItem(this.storageKey);
            if (!stored) {
                return clone(this.defaults);
            }
            const parsed = safeParse(stored, this.defaults);
            return { ...this.defaults, ...(parsed || {}) };
        } catch (error) {
            console.warn('PerformanceOscBridge failed to load stored state', error);
            return clone(this.defaults);
        }
    }

    persistState() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        try {
            window.localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('PerformanceOscBridge failed to persist state', error);
        }
    }

    setEnabled(enabled) {
        this.state.enabled = !!enabled;
        this.persistState();
        if (!this.state.enabled) {
            this.disconnect({ silent: true });
            this.updateStatus('Bridge disabled');
        } else {
            this.updateStatus('Bridge idle');
            if (this.state.autoConnect && !this.isConnected) {
                this.connect({ silent: true });
            }
        }
    }

    connect({ silent = false } = {}) {
        if (!this.state.enabled) {
            this.updateStatus('Enable bridge before connecting');
            return;
        }
        if (typeof window === 'undefined' || typeof window.WebSocket === 'undefined') {
            this.updateStatus('WebSocket unavailable in this environment');
            return;
        }
        if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
            this.socket.close();
        }
        try {
            this.socket = new WebSocket(this.state.endpoint);
        } catch (error) {
            this.appendLog('error', 'connect', { message: error.message });
            this.updateStatus('Connection failed');
            return;
        }

        this.socket.addEventListener('open', () => {
            this.isConnected = true;
            this.updateConnectButton();
            this.updateStatus('Bridge connected');
            this.appendLog('info', 'connected', {});
        });

        this.socket.addEventListener('close', () => {
            const wasConnected = this.isConnected;
            this.isConnected = false;
            this.updateConnectButton();
            if (!silent) {
                this.updateStatus(wasConnected ? 'Bridge disconnected' : 'Connection closed');
            }
            this.appendLog('info', 'disconnected', {});
        });

        this.socket.addEventListener('error', (event) => {
            this.appendLog('error', 'socket-error', { message: event?.message || 'Socket error' });
            this.updateStatus('Bridge error');
        });
    }

    disconnect({ silent = false, manual = false } = {}) {
        if (this.socket) {
            try {
                this.socket.close();
            } catch (error) {
                // ignore
            }
            this.socket = null;
        }
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.updateConnectButton();
        if (!silent) {
            this.updateStatus(manual ? 'Bridge disconnected' : 'Bridge idle');
        } else if (!wasConnected) {
            this.updateStatus('Bridge idle');
        }
    }

    shouldForward(category) {
        if (!this.state.enabled) return false;
        if (!this.state.forward) return false;
        return !!this.state.forward[category];
    }

    buildAddress(eventName) {
        const base = this.state.namespace || '/performance';
        const prefix = base.startsWith('/') ? base : `/${base}`;
        const path = eventName.replace(/[:\s]+/g, '/');
        return `${prefix}/${path}`;
    }

    forwardEvent(eventName, payload, category) {
        if (!this.shouldForward(category)) {
            return;
        }
        const message = {
            type: 'event',
            event: eventName,
            category,
            address: this.buildAddress(eventName),
            timestamp: Date.now(),
            payload: payload === undefined ? null : clone(payload)
        };

        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.appendLog('pending', eventName, { category, reason: 'not connected', payload: message.payload });
            return;
        }

        try {
            this.socket.send(JSON.stringify(message));
            this.appendLog('outgoing', eventName, { category, payload: message.payload });
        } catch (error) {
            this.appendLog('error', eventName, { category, message: error.message });
            this.updateStatus('Bridge send error');
        }
    }

    sendTestHeartbeat() {
        const message = {
            type: 'heartbeat',
            timestamp: Date.now(),
            address: this.buildAddress('bridge:heartbeat'),
            note: 'Manual heartbeat'
        };
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.appendLog('pending', 'bridge:heartbeat', { category: 'system', reason: 'not connected' });
            this.updateStatus('Heartbeat queued (connect to send)');
            return;
        }
        try {
            this.socket.send(JSON.stringify(message));
            this.appendLog('outgoing', 'bridge:heartbeat', { category: 'system' });
            this.updateStatus('Heartbeat sent');
        } catch (error) {
            this.appendLog('error', 'bridge:heartbeat', { category: 'system', message: error.message });
            this.updateStatus('Heartbeat failed');
        }
    }

    appendLog(direction, eventName, data = {}) {
        const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date(),
            direction,
            event: eventName,
            data
        };
        this.log.unshift(entry);
        if (this.log.length > LOG_LIMIT) {
            this.log.length = LOG_LIMIT;
        }
        this.renderLog();
    }

    renderLog() {
        if (!this.logList) return;
        if (!this.log.length) {
            this.logList.innerHTML = '<li class="osc-bridge__log-empty">No messages yet.</li>';
            return;
        }
        this.logList.innerHTML = this.log.map(entry => {
            const { direction, event, data, timestamp } = entry;
            const badgeClass = {
                outgoing: 'is-outgoing',
                pending: 'is-pending',
                error: 'is-error',
                info: 'is-info'
            }[direction] || '';
            const category = data?.category ? `<span class="osc-bridge__log-category">${data.category}</span>` : '';
            return `
                <li class="osc-bridge__log-item ${badgeClass}">
                    <span class="osc-bridge__log-time">${formatTime(timestamp)}</span>
                    <span class="osc-bridge__log-event">${event}</span>
                    ${category}
                </li>
            `;
        }).join('');
    }

    updateStatus(status) {
        if (this.statusEl) {
            this.statusEl.textContent = status;
        }
        this.onStatusChange(status);
    }

    getState() {
        return clone(this.state);
    }

    applyState(nextState = {}) {
        const normalized = normalizeState({ ...this.state, ...(nextState || {}) }, this.defaults);
        this.state = normalized;
        this.refreshUI();
        if (!this.state.enabled) {
            this.disconnect({ silent: true });
        } else if (this.state.autoConnect) {
            this.connect({ silent: true });
        }
    }

    destroy() {
        this.disconnect({ silent: true });
        this.subscriptions.forEach(unsubscribe => unsubscribe?.());
        this.subscriptions = [];
        this.forwardToggles.clear();
        this.container = null;
        this.statusEl = null;
        this.endpointInput = null;
        this.namespaceInput = null;
        this.enableToggle = null;
        this.autoConnectToggle = null;
        this.connectButton = null;
        this.testButton = null;
        this.logList = null;
    }
}
