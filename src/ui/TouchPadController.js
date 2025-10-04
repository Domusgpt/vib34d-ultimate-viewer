import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

const DEFAULT_PAD_COUNT = 3;
const AXES = ['x', 'y', 'spread'];
const POINTER_IDLE_TIMEOUT = 3500;

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

export class TouchPadController {
    constructor({
        parameterManager = null,
        container = null,
        config = DEFAULT_PERFORMANCE_CONFIG.touchPads,
        hub = null,
        onMappingChange = null
    } = {}) {
        this.parameterManager = parameterManager;
        this.hub = hub;
        this.config = { ...DEFAULT_PERFORMANCE_CONFIG.touchPads, ...(config || {}) };
        this.onMappingChange = typeof onMappingChange === 'function' ? onMappingChange : () => {};
        this.parameterOptions = this.getParameterOptions();
        this.storageKey = this.config.storageKey || 'vib34d-touchpads';

        const storedState = this.loadStoredState();
        this.padCount = storedState?.padCount || this.config.padCount || DEFAULT_PAD_COUNT;
        this.mappings = storedState?.mappings || this.createDefaultMappings(this.padCount);

        this.container = container || this.ensureContainer();
        this.padRefs = [];
        this.padStates = this.mappings.map(() => this.createPadState());
        this.animationFrame = null;

        this.render();
        this.startLoop();
        this.notifyState();
    }

    ensureContainer() {
        const existing = document.getElementById('performance-touchpads');
        if (existing) {
            existing.innerHTML = '';
            return existing;
        }
        const section = document.createElement('section');
        section.id = 'performance-touchpads';
        return section;
    }

    getParameterOptions() {
        if (!this.parameterManager || typeof this.parameterManager.listParameterMetadata !== 'function') {
            return [];
        }
        const tags = this.config.parameterTags;
        const tagged = Array.isArray(tags) && tags.length
            ? this.parameterManager.listParameterMetadata({ tags })
            : [];
        if (tagged.length) return tagged;
        return this.parameterManager.listParameterMetadata();
    }

    loadStoredState() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return null;
        }
        try {
            const raw = window.localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('TouchPadController failed to load state', error);
            return null;
        }
    }

    persistState() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        try {
            const payload = JSON.stringify(this.getState());
            window.localStorage.setItem(this.storageKey, payload);
        } catch (error) {
            console.warn('TouchPadController failed to persist state', error);
        }
    }

    createDefaultMappings(count) {
        const templates = Array.isArray(this.config.defaults) ? clone(this.config.defaults) : [];
        if (!templates.length) {
            return new Array(count).fill(null).map((_, index) => this.createEmptyMapping(index));
        }
        return new Array(count).fill(null).map((_, index) => {
            return templates[index] ? clone(templates[index]) : this.createEmptyMapping(index);
        });
    }

    createEmptyMapping(index) {
        const id = `pad-${index + 1}`;
        return {
            id,
            label: `Pad ${index + 1}`,
            axes: {
                x: { parameter: '', invert: false, smoothing: 0.2 },
                y: { parameter: '', invert: false, smoothing: 0.2 },
                spread: { parameter: '', invert: false, smoothing: 0.35 }
            }
        };
    }

    createPadState() {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        return {
            pointers: new Map(),
            target: { x: 0.5, y: 0.5, spread: 0 },
            smoothed: { x: 0.5, y: 0.5, spread: 0 },
            lastInteraction: now
        };
    }

    render() {
        if (!this.container) return;
        this.container.classList.add('performance-block');
        this.container.innerHTML = '';

        const header = document.createElement('header');
        header.className = 'performance-block__header';
        header.innerHTML = `
            <div>
                <h3 class="performance-block__title">Multi-Touch Pads</h3>
                <p class="performance-block__subtitle">Assign axes to any parameter and perform gestures with up to three pads at once.</p>
            </div>
            <div class="performance-block__actions">
                <label class="pad-count">
                    <span>Pads</span>
                    <input type="number" min="1" max="6" value="${this.padCount}" />
                </label>
                <button type="button" class="pad-reset">Reset mappings</button>
            </div>
        `;
        this.container.appendChild(header);

        const countInput = header.querySelector('input[type="number"]');
        const handleCountChange = (event) => {
            const next = Math.max(1, Math.min(6, Number(event.target.value) || this.padCount));
            if (next !== this.padCount) {
                this.padCount = next;
                this.syncPadCount();
                this.render();
                this.notifyState();
            } else {
                event.target.value = this.padCount;
            }
        };
        countInput.addEventListener('change', handleCountChange);
        countInput.addEventListener('input', handleCountChange);

        header.querySelector('.pad-reset').addEventListener('click', () => {
            this.mappings = this.createDefaultMappings(this.padCount);
            this.padStates = this.mappings.map(() => this.createPadState());
            this.render();
            this.notifyState();
        });

        const grid = document.createElement('div');
        grid.className = 'pad-grid';
        this.container.appendChild(grid);
        this.padRefs = [];

        this.mappings.slice(0, this.padCount).forEach((mapping, index) => {
            const padRef = this.renderPad(mapping, index);
            this.padRefs.push(padRef);
            grid.appendChild(padRef.root);
        });
    }

    renderPad(mapping, index) {
        const padState = this.padStates[index] || this.createPadState();
        this.padStates[index] = padState;

        const root = document.createElement('article');
        root.className = 'performance-pad';

        const header = document.createElement('header');
        header.className = 'performance-pad__header';
        header.innerHTML = `
            <input class="performance-pad__label" value="${mapping.label || ''}" aria-label="Pad label" />
            <span class="performance-pad__value" data-role="pad-values">${this.formatPadValues(padState.smoothed)}</span>
        `;
        root.appendChild(header);

        const controls = document.createElement('div');
        controls.className = 'performance-pad__controls';

        AXES.forEach(axis => {
            controls.appendChild(this.renderAxisControl(mapping, index, axis));
        });

        root.appendChild(controls);

        const surface = document.createElement('div');
        surface.className = 'performance-pad__surface';
        surface.setAttribute('role', 'application');
        surface.dataset.padIndex = index;
        surface.innerHTML = `
            <span class="performance-pad__surface-label">${mapping.label || `Pad ${index + 1}`}</span>
        `;

        surface.addEventListener('pointerdown', (event) => this.handlePointerDown(index, event));
        surface.addEventListener('pointermove', (event) => this.handlePointerMove(index, event));
        surface.addEventListener('pointerup', (event) => this.handlePointerUp(index, event));
        surface.addEventListener('pointercancel', (event) => this.handlePointerUp(index, event));
        surface.addEventListener('pointerleave', (event) => this.handlePointerLeave(index, event));

        root.appendChild(surface);

        const labelInput = header.querySelector('.performance-pad__label');
        labelInput.addEventListener('input', (event) => {
            mapping.label = event.target.value;
            surface.querySelector('.performance-pad__surface-label').textContent = event.target.value || `Pad ${index + 1}`;
            this.notifyState();
        });

        return {
            root,
            header,
            controls,
            surface,
            valueLabel: header.querySelector('[data-role="pad-values"]'),
            axisControls: this.collectAxisRefs(controls)
        };
    }

    collectAxisRefs(controlsRoot) {
        const refs = {};
        AXES.forEach(axis => {
            const scope = controlsRoot.querySelector(`[data-axis="${axis}"]`);
            refs[axis] = {
                scope,
                select: scope?.querySelector('select') || null,
                invert: scope?.querySelector('input[type="checkbox"]') || null,
                smoothing: scope?.querySelector('input[type="range"]') || null
            };
        });
        return refs;
    }

    renderAxisControl(mapping, index, axis) {
        const axisConfig = mapping.axes?.[axis] || { parameter: '', invert: false, smoothing: 0.2 };
        const wrapper = document.createElement('div');
        wrapper.className = 'performance-pad__axis';
        wrapper.dataset.axis = axis;
        wrapper.innerHTML = `
            <label>
                <span>${axis === 'spread' ? 'Spread / pinch' : axis.toUpperCase()} axis</span>
                <select aria-label="${axis} axis parameter">
                    <option value="">Unassigned</option>
                    ${this.parameterOptions.map(option => `
                        <option value="${option.id}" ${axisConfig.parameter === option.id ? 'selected' : ''}>${option.label}</option>
                    `).join('')}
                </select>
            </label>
            <label class="performance-pad__toggle">
                <input type="checkbox" ${axisConfig.invert ? 'checked' : ''} />
                <span>Invert</span>
            </label>
            <label class="performance-pad__slider">
                <span>Smoothing</span>
                <input type="range" min="0" max="0.95" step="0.05" value="${axisConfig.smoothing ?? 0.2}" />
            </label>
        `;

        const select = wrapper.querySelector('select');
        select.addEventListener('change', (event) => {
            this.updateAxisMapping(index, axis, { parameter: event.target.value });
        });

        const invert = wrapper.querySelector('input[type="checkbox"]');
        invert.addEventListener('change', (event) => {
            this.updateAxisMapping(index, axis, { invert: event.target.checked });
        });

        const smoothing = wrapper.querySelector('input[type="range"]');
        smoothing.addEventListener('input', (event) => {
            this.updateAxisMapping(index, axis, { smoothing: Number(event.target.value) });
        });

        return wrapper;
    }

    updateAxisMapping(padIndex, axis, patch) {
        const mapping = this.mappings[padIndex];
        if (!mapping.axes[axis]) {
            mapping.axes[axis] = { parameter: '', invert: false, smoothing: 0.2 };
        }
        Object.assign(mapping.axes[axis], patch);
        this.notifyState();
    }

    syncPadCount() {
        if (this.mappings.length < this.padCount) {
            const additional = this.createDefaultMappings(this.padCount - this.mappings.length);
            this.mappings = this.mappings.concat(additional);
        } else if (this.mappings.length > this.padCount) {
            this.mappings = this.mappings.slice(0, this.padCount);
        }
        this.padStates = this.mappings.map(() => this.createPadState());
    }

    handlePointerDown(index, event) {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        this.storePointer(index, event);
    }

    handlePointerMove(index, event) {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        this.storePointer(index, event);
    }

    handlePointerLeave(index, event) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) return;
        this.removePointer(index, event.pointerId);
    }

    handlePointerUp(index, event) {
        this.removePointer(index, event.pointerId);
    }

    storePointer(index, event) {
        const padState = this.padStates[index];
        if (!padState) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = clamp01((event.clientX - rect.left) / rect.width);
        const y = clamp01((event.clientY - rect.top) / rect.height);
        padState.pointers.set(event.pointerId, { x, y });
        padState.lastInteraction = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.updatePadTarget(index);
    }

    removePointer(index, pointerId) {
        const padState = this.padStates[index];
        if (!padState) return;
        padState.pointers.delete(pointerId);
        padState.lastInteraction = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.updatePadTarget(index);
    }

    updatePadTarget(index) {
        const padState = this.padStates[index];
        if (!padState) return;
        const pointers = padState.pointers;
        if (!pointers.size) {
            padState.target = { ...padState.smoothed };
            return;
        }
        let sumX = 0;
        let sumY = 0;
        pointers.forEach(point => {
            sumX += point.x;
            sumY += point.y;
        });
        const avgX = sumX / pointers.size;
        const avgY = sumY / pointers.size;

        let spread = 0;
        if (pointers.size > 1) {
            let totalDistance = 0;
            pointers.forEach(point => {
                const dx = point.x - avgX;
                const dy = point.y - avgY;
                totalDistance += Math.sqrt(dx * dx + dy * dy);
            });
            const meanDistance = totalDistance / pointers.size;
            spread = clamp01(meanDistance * Math.sqrt(2));
        }

        padState.target = { x: avgX, y: avgY, spread };
    }

    startLoop() {
        if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
            return;
        }
        const loop = () => {
            this.updatePads();
            this.animationFrame = window.requestAnimationFrame(loop);
        };
        this.animationFrame = window.requestAnimationFrame(loop);
    }

    updatePads() {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.padStates.forEach((padState, index) => {
            if (!padState) return;
            const mapping = this.mappings[index];
            if (!mapping) return;

            AXES.forEach(axis => {
                const axisConfig = mapping.axes?.[axis];
                if (!axisConfig || !axisConfig.parameter) return;
                const target = padState.target?.[axis] ?? 0;
                const previous = padState.smoothed?.[axis] ?? target;
                const smoothing = clamp01(axisConfig.smoothing ?? 0);
                const next = previous + (target - previous) * (1 - smoothing);
                padState.smoothed[axis] = next;

                const normalized = axisConfig.invert ? 1 - next : next;
                const clamped = clamp01(normalized);
                const value = this.normalizedToParameter(axisConfig.parameter, clamped);

                if (value !== null) {
                    this.parameterManager?.setParameter?.(axisConfig.parameter, value, 'touchpad');
                    this.hub?.emit?.('touchpad:update', {
                        padId: mapping.id,
                        axis,
                        parameter: axisConfig.parameter,
                        normalized: clamped,
                        value
                    });
                }
            });

            if (this.padRefs[index]?.valueLabel) {
                this.padRefs[index].valueLabel.textContent = this.formatPadValues(padState.smoothed);
            }

            if (now - padState.lastInteraction > POINTER_IDLE_TIMEOUT && padState.pointers.size === 0) {
                padState.target = { ...padState.smoothed };
            }
        });
    }

    normalizedToParameter(parameterId, normalizedValue) {
        if (!this.parameterManager || typeof this.parameterManager.getParameterDefinition !== 'function') {
            return normalizedValue;
        }
        const def = this.parameterManager.getParameterDefinition(parameterId);
        if (!def) return normalizedValue;
        const value = def.min + (def.max - def.min) * normalizedValue;
        if (def.type === 'int') {
            return Math.round(value);
        }
        return value;
    }

    formatPadValues(values = {}) {
        const x = (values.x ?? 0).toFixed(2);
        const y = (values.y ?? 0).toFixed(2);
        const spread = (values.spread ?? 0).toFixed(2);
        return `x ${x} / y ${y} / spread ${spread}`;
    }

    notifyState() {
        const state = this.getState();
        this.onMappingChange(state);
        this.persistState();
        this.hub?.emit?.('touchpad:mappings', state);
    }

    getState() {
        return {
            padCount: this.padCount,
            mappings: clone(this.mappings.slice(0, this.padCount))
        };
    }

    applyState(state = {}) {
        if (state.padCount) {
            this.padCount = Math.max(1, Math.min(6, Number(state.padCount)));
        }
        if (Array.isArray(state.mappings)) {
            this.mappings = clone(state.mappings);
        }
        this.syncPadCount();
        this.render();
        this.notifyState();
    }

    applyMappings(mappings = []) {
        if (!Array.isArray(mappings)) return;
        this.mappings = clone(mappings);
        this.syncPadCount();
        this.render();
        this.notifyState();
    }

    destroy() {
        if (this.animationFrame && typeof window !== 'undefined' && window.cancelAnimationFrame) {
            window.cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.padRefs = [];
        this.padStates = [];
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
