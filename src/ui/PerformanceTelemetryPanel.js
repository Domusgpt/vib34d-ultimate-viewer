const DEFAULT_ROTATION_PARAMS = ['rot4dXW', 'rot4dYW', 'rot4dZW'];
const DEFAULT_DYNAMICS_PARAMS = ['dimension', 'speed', 'chaos', 'intensity'];

function clamp01(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

function formatNumber(value, precision = 2) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '0.00';
    }
    return value.toFixed(precision);
}

export class PerformanceTelemetryPanel {
    constructor({ parameterManager = null, container = null, hub = null, config = {} } = {}) {
        this.parameterManager = parameterManager;
        this.hub = hub;
        this.config = {
            rotationParameters: DEFAULT_ROTATION_PARAMS,
            dynamicsParameters: DEFAULT_DYNAMICS_PARAMS,
            historySize: 180,
            pulseFadeMs: 2600,
            ...config
        };

        this.container = container;
        this.root = null;
        this.rotationRefs = new Map();
        this.dynamicsRefs = new Map();
        this.energyEl = null;
        this.pulseEl = null;
        this.historyEl = null;
        this.activityEl = null;
        this.currentValues = {};
        this.history = [];
        this.subscriptions = [];
        this.unsubscribeParams = null;
        this.pulseTimeout = null;

        this.mount();
        this.bindListeners();
        this.refreshAll();
    }

    mount() {
        if (!this.container || typeof document === 'undefined') {
            return;
        }
        this.container.classList.add('performance-block', 'performance-telemetry');
        this.container.innerHTML = `
            <header class="performance-block__header performance-telemetry__header">
                <div>
                    <h3 class="performance-block__title">Live Telemetry</h3>
                    <p class="performance-block__subtitle">Monitor 4D rotation vectors, dynamics, and incoming control pulses.</p>
                </div>
                <span class="performance-telemetry__energy-badge" data-role="rotation-energy">0%</span>
            </header>
            <div class="performance-telemetry__body">
                <section class="performance-telemetry__section" data-section="rotation">
                    <h4>4D Rotation Field</h4>
                    <div class="performance-telemetry__metrics" data-role="rotation-metrics"></div>
                </section>
                <section class="performance-telemetry__section" data-section="dynamics">
                    <h4>Dynamics &amp; Atmosphere</h4>
                    <div class="performance-telemetry__metrics" data-role="dynamics-metrics"></div>
                    <div class="performance-telemetry__activity" data-role="activity">Activity index <strong>0.00</strong></div>
                </section>
                <section class="performance-telemetry__section" data-section="inputs">
                    <h4>Input Pulses</h4>
                    <div class="performance-telemetry__pulse" data-role="pulse">Awaiting input...</div>
                    <ul class="performance-telemetry__history" data-role="history"></ul>
                </section>
            </div>
        `;
        this.root = this.container;

        const rotationContainer = this.root.querySelector('[data-role="rotation-metrics"]');
        const dynamicsContainer = this.root.querySelector('[data-role="dynamics-metrics"]');
        this.energyEl = this.root.querySelector('[data-role="rotation-energy"]');
        this.pulseEl = this.root.querySelector('[data-role="pulse"]');
        this.historyEl = this.root.querySelector('[data-role="history"]');
        this.activityEl = this.root.querySelector('[data-role="activity"] strong');

        this.renderMetrics(rotationContainer, this.config.rotationParameters, this.rotationRefs);
        this.renderMetrics(dynamicsContainer, this.config.dynamicsParameters, this.dynamicsRefs);
    }

    renderMetrics(container, parameters, refMap) {
        if (!container) return;
        container.innerHTML = '';
        parameters
            .map(param => (typeof param === 'string' ? param : null))
            .filter(Boolean)
            .forEach(param => {
                const wrapper = document.createElement('div');
                wrapper.className = 'performance-telemetry__metric';
                wrapper.dataset.parameter = param;
                wrapper.innerHTML = `
                    <span class="performance-telemetry__metric-label">${this.getParameterLabel(param)}</span>
                    <div class="performance-telemetry__metric-bar">
                        <span class="performance-telemetry__metric-fill" style="width:0%"></span>
                    </div>
                    <span class="performance-telemetry__metric-value">0.00</span>
                `;
                container.appendChild(wrapper);
                refMap.set(param, {
                    bar: wrapper.querySelector('.performance-telemetry__metric-fill'),
                    value: wrapper.querySelector('.performance-telemetry__metric-value')
                });
            });
    }

    bindListeners() {
        if (this.parameterManager?.addChangeListener) {
            this.unsubscribeParams = this.parameterManager.addChangeListener(change => this.handleParameterChange(change));
        }

        if (this.hub?.on) {
            this.subscriptions.push(this.hub.on('touchpad:update', payload => this.registerPulse('Touch pad', payload?.padId, payload?.parameter)));
            this.subscriptions.push(this.hub.on('hardware:midi-value', payload => this.registerPulse('MIDI', payload?.inputId || 'device', payload?.parameter)));
            this.subscriptions.push(this.hub.on('gestures:playback-event', payload => this.registerPulse('Gesture', payload?.recordingId, payload?.event?.parameter)));
            this.subscriptions.push(this.hub.on('show:cue-trigger', payload => this.registerPulse('Cue', payload?.cue?.label || 'Unnamed cue', payload?.cue?.presetId)));
        }
    }

    refreshAll() {
        const rotationValues = this.config.rotationParameters.map(param => this.getParameterValue(param));
        this.config.rotationParameters.forEach((param, index) => {
            this.updateMetric(param, rotationValues[index], this.rotationRefs);
        });
        this.updateRotationEnergy(rotationValues);

        const dynamicsValues = this.config.dynamicsParameters.map(param => this.getParameterValue(param));
        this.config.dynamicsParameters.forEach((param, index) => {
            this.updateMetric(param, dynamicsValues[index], this.dynamicsRefs);
        });
        this.updateActivityIndex(dynamicsValues);
    }

    handleParameterChange({ name, value } = {}) {
        if (!name) return;
        this.currentValues[name] = value;

        if (this.rotationRefs.has(name)) {
            this.updateMetric(name, value, this.rotationRefs);
            const rotationValues = this.config.rotationParameters.map(param => this.currentValues[param] ?? this.getParameterValue(param));
            this.updateRotationEnergy(rotationValues);
        }

        if (this.dynamicsRefs.has(name)) {
            this.updateMetric(name, value, this.dynamicsRefs);
            const dynamicsValues = this.config.dynamicsParameters.map(param => this.currentValues[param] ?? this.getParameterValue(param));
            this.updateActivityIndex(dynamicsValues);
        }
    }

    updateMetric(parameterId, value, refMap) {
        const refs = refMap.get(parameterId);
        if (!refs) return;

        const def = this.parameterManager?.getParameterDefinition?.(parameterId) || null;
        let normalized = 0;
        if (def) {
            const range = def.max - def.min;
            const safeRange = range === 0 ? 1 : range;
            normalized = clamp01((value - def.min) / safeRange);
        }
        const displayValue = def?.type === 'int' ? formatNumber(value, 0) : formatNumber(value, 2);
        refs.value.textContent = displayValue;
        refs.bar.style.width = `${(normalized * 100).toFixed(1)}%`;
    }

    updateRotationEnergy(values = []) {
        if (!this.energyEl) return;
        if (!Array.isArray(values) || values.length === 0) {
            this.energyEl.textContent = '0%';
            return;
        }
        const normalizedSquares = values.map((value, index) => {
            const param = this.config.rotationParameters[index];
            const def = this.parameterManager?.getParameterDefinition?.(param);
            if (!def) return 0;
            const range = def.max - def.min || 1;
            const normalized = clamp01((value - def.min) / range);
            const centered = normalized * 2 - 1;
            return centered * centered;
        });
        const energy = Math.sqrt(normalizedSquares.reduce((sum, sq) => sum + sq, 0) / normalizedSquares.length);
        const percentage = clamp01(energy) * 100;
        this.energyEl.textContent = `${percentage.toFixed(0)}%`;
        this.pushHistorySample({ rotationEnergy: energy });
    }

    updateActivityIndex(values = []) {
        if (!this.activityEl) return;
        if (!Array.isArray(values) || values.length === 0) {
            this.activityEl.textContent = '0.00';
            return;
        }
        const normalizedValues = values.map((value, index) => {
            const param = this.config.dynamicsParameters[index];
            const def = this.parameterManager?.getParameterDefinition?.(param);
            if (!def) return 0;
            const range = def.max - def.min || 1;
            return clamp01((value - def.min) / range);
        });
        const average = normalizedValues.reduce((sum, v) => sum + v, 0) / normalizedValues.length;
        this.activityEl.textContent = average.toFixed(2);
        this.pushHistorySample({ activity: average });
    }

    pushHistorySample(sample = {}) {
        if (!this.historyEl) return;
        const timestamp = Date.now();
        this.history.push({ timestamp, ...sample });
        while (this.history.length > this.config.historySize) {
            this.history.shift();
        }

        const latest = this.history.slice(-5).reverse();
        this.historyEl.innerHTML = latest.map(entry => {
            const secondsAgo = Math.max(0, Math.round((timestamp - entry.timestamp) / 1000));
            const energy = typeof entry.rotationEnergy === 'number' ? `${Math.round(entry.rotationEnergy * 100)}%` : '—';
            const activity = typeof entry.activity === 'number' ? entry.activity.toFixed(2) : '—';
            return `<li><span>${secondsAgo}s ago</span><span>energy ${energy}</span><span>activity ${activity}</span></li>`;
        }).join('');
    }

    registerPulse(source = 'Input', id = '', parameter = '') {
        if (!this.pulseEl) return;
        const descriptor = [source, id].filter(Boolean).join(' · ');
        const parameterLabel = parameter ? this.getParameterLabel(parameter) : '';
        const suffix = parameterLabel ? ` → ${parameterLabel}` : '';
        this.pulseEl.textContent = `${descriptor || source}${suffix}`;
        this.pulseEl.classList.add('is-active');
        clearTimeout(this.pulseTimeout);
        this.pulseTimeout = setTimeout(() => {
            this.pulseEl?.classList.remove('is-active');
        }, this.config.pulseFadeMs);
    }

    getParameterLabel(parameterId) {
        const def = this.parameterManager?.getParameterDefinition?.(parameterId);
        if (def?.label) {
            return def.label;
        }
        if (!parameterId) return 'Parameter';
        return parameterId
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, char => char.toUpperCase())
            .trim();
    }

    getParameterValue(parameterId) {
        if (!parameterId) return 0;
        if (this.currentValues && Object.prototype.hasOwnProperty.call(this.currentValues, parameterId)) {
            return this.currentValues[parameterId];
        }
        return this.parameterManager?.getParameter?.(parameterId) ?? 0;
    }

    destroy() {
        if (this.unsubscribeParams) {
            this.unsubscribeParams();
            this.unsubscribeParams = null;
        }
        this.subscriptions.forEach(unsub => unsub?.());
        this.subscriptions = [];
        if (this.pulseTimeout) {
            clearTimeout(this.pulseTimeout);
            this.pulseTimeout = null;
        }
        if (this.root) {
            this.root.innerHTML = '';
        }
    }
}
