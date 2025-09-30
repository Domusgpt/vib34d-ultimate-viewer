import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

const CURVE_OPTIONS = [
    { id: 'linear', label: 'Linear' },
    { id: 'ease-in', label: 'Ease In' },
    { id: 'ease-out', label: 'Ease Out' },
    { id: 'ease-in-out', label: 'Ease In/Out' },
    { id: 'expo', label: 'Exponential' },
    { id: 'sine', label: 'Sine Wave' }
];

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function copyMapping(mapping) {
    return JSON.parse(JSON.stringify(mapping));
}

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
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

        this.container = container || this.ensureContainer();
        this.parameterOptions = this.buildParameterOptions();
        this.padCount = Math.max(1, this.config.padCount || 3);
        this.pads = [];
        this.grid = null;
        this.layoutSettings = this.buildLayoutSettings();
        this.layoutControlRefs = {};
        this.smoothingState = new Map();

        this.render();
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

    buildParameterOptions() {
        if (!this.parameterManager || typeof this.parameterManager.listParameterMetadata !== 'function') {
            return [];
        }

        const filter = Array.isArray(this.config.parameterTags) && this.config.parameterTags.length
            ? { tags: this.config.parameterTags }
            : {};

        const options = this.parameterManager.listParameterMetadata(filter);
        if (options.length > 0) {
            return options;
        }

        // Fall back to every parameter if no filtered options
        return this.parameterManager.listParameterMetadata();
    }

    buildLayoutSettings() {
        const layout = this.config.layout || {};
        return {
            minWidth: toNumber(layout.minWidth, 220),
            gap: toNumber(layout.gap, 12),
            aspectRatio: toNumber(layout.aspectRatio, 1)
        };
    }

    getAxisDefaults(axisKey) {
        const axisDefaults = this.config.axisDefaults || {};
        const globalCurve = axisDefaults.curve || 'linear';
        const globalSmoothing = toNumber(axisDefaults.smoothing, 0.1);
        const specific = axisDefaults[axisKey] || {};
        return {
            curve: specific.curve || globalCurve,
            smoothing: toNumber(specific.smoothing, globalSmoothing)
        };
    }

    normaliseMapping(mapping = {}) {
        const xDefaults = this.getAxisDefaults('x');
        const yDefaults = this.getAxisDefaults('y');
        const spreadDefaults = this.getAxisDefaults('spread');
        return {
            id: mapping.id || '',
            label: mapping.label || '',
            xParam: mapping.xParam || '',
            yParam: mapping.yParam || '',
            spreadParam: mapping.spreadParam || '',
            invertX: Boolean(mapping.invertX),
            invertY: Boolean(mapping.invertY),
            xCurve: mapping.xCurve || xDefaults.curve,
            yCurve: mapping.yCurve || yDefaults.curve,
            spreadCurve: mapping.spreadCurve || spreadDefaults.curve,
            xSmoothing: Math.min(0.95, Math.max(0, toNumber(mapping.xSmoothing, xDefaults.smoothing))),
            ySmoothing: Math.min(0.95, Math.max(0, toNumber(mapping.ySmoothing, yDefaults.smoothing))),
            spreadSmoothing: Math.min(0.95, Math.max(0, toNumber(mapping.spreadSmoothing, spreadDefaults.smoothing)))
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
                <h3 class="performance-block__title">Touch Pads</h3>
                <p class="performance-block__subtitle">Assign any parameter to expressive XY pads. Use a two-finger spread to drive a third parameter.</p>
            </div>
        `;
        this.container.appendChild(header);

        const layoutControls = this.renderLayoutControls();
        if (layoutControls) {
            this.container.appendChild(layoutControls);
        }

        const grid = document.createElement('div');
        grid.className = 'touchpad-grid';
        this.container.appendChild(grid);
        this.grid = grid;

        const mappings = this.config.defaultMappings || [];
        this.pads = [];
        for (let index = 0; index < this.padCount; index += 1) {
            const mapping = copyMapping(mappings[index] || {});
            const pad = this.createPad(mapping || {});
            this.pads.push(pad);
            grid.appendChild(pad.wrapper);
        }

        this.updateLayoutControlUI();
        this.updateLayoutVariables();

        // Notify initial mapping state
        this.notifyMappingChange();
    }

    renderLayoutControls() {
        const wrapper = document.createElement('div');
        wrapper.className = 'touchpad-layout';

        const header = document.createElement('div');
        header.className = 'touchpad-layout__header';
        header.innerHTML = `
            <strong>Pad Layout</strong>
            <span>Tune pad size, spacing and aspect</span>
        `;
        wrapper.appendChild(header);

        const controls = document.createElement('div');
        controls.className = 'touchpad-layout__controls';

        const minWidthControl = this.createLayoutControl({
            label: 'Pad width',
            min: 180,
            max: 380,
            step: 10,
            role: 'minWidth',
            formatter: (value) => `${Math.round(value)}px`
        });
        const gapControl = this.createLayoutControl({
            label: 'Grid gap',
            min: 8,
            max: 32,
            step: 2,
            role: 'gap',
            formatter: (value) => `${Math.round(value)}px`
        });
        const aspectControl = this.createLayoutControl({
            label: 'Aspect ratio',
            min: 0.75,
            max: 1.4,
            step: 0.05,
            role: 'aspectRatio',
            formatter: (value) => `${Number(value).toFixed(2)} : 1`
        });

        controls.appendChild(minWidthControl.wrapper);
        controls.appendChild(gapControl.wrapper);
        controls.appendChild(aspectControl.wrapper);
        wrapper.appendChild(controls);

        this.layoutControlRefs = {
            minWidthInput: minWidthControl.input,
            minWidthValue: minWidthControl.valueLabel,
            gapInput: gapControl.input,
            gapValue: gapControl.valueLabel,
            aspectRatioInput: aspectControl.input,
            aspectRatioValue: aspectControl.valueLabel
        };

        return wrapper;
    }

    createLayoutControl({ label, min, max, step, role, formatter }) {
        const wrapper = document.createElement('label');
        wrapper.className = 'touchpad-layout__control';

        const title = document.createElement('span');
        title.className = 'touchpad-layout__label';
        title.textContent = label;
        wrapper.appendChild(title);

        const row = document.createElement('div');
        row.className = 'touchpad-layout__row';

        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.dataset.role = role;

        const valueLabel = document.createElement('span');
        valueLabel.className = 'touchpad-layout__value';

        row.appendChild(input);
        row.appendChild(valueLabel);
        wrapper.appendChild(row);

        const commitChange = () => {
            const currentValue = toNumber(input.value, this.layoutSettings[role]);
            this.layoutSettings = {
                ...this.layoutSettings,
                [role]: currentValue
            };
            valueLabel.textContent = formatter(currentValue);
            this.updateLayoutVariables();
            this.notifyLayoutChange();
        };

        input.addEventListener('input', commitChange);

        return { wrapper, input, valueLabel, formatter };
    }

    updateLayoutVariables() {
        if (this.grid) {
            this.grid.style.setProperty('--touchpad-grid-gap', `${this.layoutSettings.gap}px`);
            this.grid.style.setProperty('--touchpad-min-width', `${this.layoutSettings.minWidth}px`);
        }
        if (this.container) {
            this.container.style.setProperty('--touchpad-aspect', this.layoutSettings.aspectRatio);
        }
    }

    updateLayoutControlUI() {
        const refs = this.layoutControlRefs;
        if (!refs) return;

        if (refs.minWidthInput) {
            refs.minWidthInput.value = String(this.layoutSettings.minWidth);
            refs.minWidthValue.textContent = `${Math.round(this.layoutSettings.minWidth)}px`;
        }
        if (refs.gapInput) {
            refs.gapInput.value = String(this.layoutSettings.gap);
            refs.gapValue.textContent = `${Math.round(this.layoutSettings.gap)}px`;
        }
        if (refs.aspectRatioInput) {
            refs.aspectRatioInput.value = String(this.layoutSettings.aspectRatio);
            refs.aspectRatioValue.textContent = `${this.layoutSettings.aspectRatio.toFixed(2)} : 1`;
        }
    }

    notifyLayoutChange() {
        this.notifyMappingChange();
        if (this.hub) {
            this.hub.emit('touchpad-layout-change', { layout: this.getLayoutSettings() });
        }
    }

    getLayoutSettings() {
        return {
            minWidth: this.layoutSettings.minWidth,
            gap: this.layoutSettings.gap,
            aspectRatio: this.layoutSettings.aspectRatio
        };
    }

    applyLayout(layout = {}) {
        if (!layout || typeof layout !== 'object') return;
        this.layoutSettings = {
            ...this.layoutSettings,
            minWidth: toNumber(layout.minWidth, this.layoutSettings.minWidth),
            gap: toNumber(layout.gap, this.layoutSettings.gap),
            aspectRatio: toNumber(layout.aspectRatio, this.layoutSettings.aspectRatio)
        };
        this.updateLayoutControlUI();
        this.updateLayoutVariables();
        this.notifyLayoutChange();
    }

    getState() {
        return {
            mappings: this.getMappings(),
            layout: this.getLayoutSettings()
        };
    }

    applyState(state) {
        if (!state) return;
        if (Array.isArray(state)) {
            this.applyMappings(state);
            return;
        }

        if (state.mappings) {
            this.applyMappings(state.mappings);
        }
        if (state.layout) {
            this.applyLayout(state.layout);
        }
    }

    createPad(mapping = {}) {
        const padId = mapping.id || `pad-${this.pads.length + 1}`;
        const label = mapping.label || `Pad ${this.pads.length + 1}`;
        const normalizedMapping = this.normaliseMapping({ ...mapping, id: padId, label });

        const wrapper = document.createElement('article');
        wrapper.className = 'touchpad-card';

        const header = document.createElement('header');
        header.className = 'touchpad-card__header';
        header.innerHTML = `
            <h4>${label}</h4>
            <span class="touchpad-card__status" data-role="status">Ready</span>
        `;

        const padSurface = document.createElement('div');
        padSurface.className = 'touchpad-surface';
        padSurface.setAttribute('data-pad-id', padId);

        const indicator = document.createElement('div');
        indicator.className = 'touchpad-indicator';
        padSurface.appendChild(indicator);

        const controls = document.createElement('div');
        controls.className = 'touchpad-controls';

        const pointerState = new Map();

        const padState = {
            id: padId,
            label,
            wrapper,
            header,
            surface: padSurface,
            indicator,
            statusEl: header.querySelector('[data-role="status"]'),
            mapping: { ...normalizedMapping },
            pointerState,
            controls: {}
        };

        const xSelect = this.createParameterSelect('X Axis', padState.mapping.xParam || '', (value) => {
            if (padState.mapping.xParam && padState.mapping.xParam !== value) {
                this.clearSmoothingState(padState.mapping.xParam, 'touchpad-x');
            }
            padState.mapping.xParam = value || '';
            this.notifyMappingChange();
        }, { role: 'xParam' });
        const ySelect = this.createParameterSelect('Y Axis', padState.mapping.yParam || '', (value) => {
            if (padState.mapping.yParam && padState.mapping.yParam !== value) {
                this.clearSmoothingState(padState.mapping.yParam, 'touchpad-y');
            }
            padState.mapping.yParam = value || '';
            this.notifyMappingChange();
        }, { role: 'yParam' });
        const gestureSelect = this.createParameterSelect('Spread', padState.mapping.spreadParam || '', (value) => {
            if (padState.mapping.spreadParam && padState.mapping.spreadParam !== value) {
                this.clearSmoothingState(padState.mapping.spreadParam, 'touchpad-gesture');
            }
            padState.mapping.spreadParam = value || '';
            this.notifyMappingChange();
        }, { allowNone: true, placeholder: 'None', role: 'spreadParam' });

        const axisRow = document.createElement('div');
        axisRow.className = 'touchpad-controls__row';
        axisRow.appendChild(xSelect.wrapper);
        axisRow.appendChild(ySelect.wrapper);

        const gestureRow = document.createElement('div');
        gestureRow.className = 'touchpad-controls__row';
        gestureRow.appendChild(gestureSelect.wrapper);

        const invertRow = document.createElement('div');
        invertRow.className = 'touchpad-controls__row touchpad-controls__row--toggles';
        const invertXToggle = this.createToggle('Invert X', Boolean(padState.mapping.invertX), (checked) => {
            padState.mapping.invertX = checked;
            this.notifyMappingChange();
        }, 'invertX');
        const invertYToggle = this.createToggle('Invert Y', Boolean(padState.mapping.invertY), (checked) => {
            padState.mapping.invertY = checked;
            this.notifyMappingChange();
        }, 'invertY');
        const swapButton = document.createElement('button');
        swapButton.type = 'button';
        swapButton.className = 'touchpad-swap';
        swapButton.textContent = 'Swap Axes';
        swapButton.addEventListener('click', () => {
            const {
                xParam,
                yParam,
                xCurve,
                yCurve,
                xSmoothing,
                ySmoothing,
                invertX,
                invertY
            } = padState.mapping;
            this.clearSmoothingState(xParam, 'touchpad-x');
            this.clearSmoothingState(yParam, 'touchpad-y');

            padState.mapping.xParam = yParam;
            padState.mapping.yParam = xParam;
            padState.mapping.xCurve = yCurve;
            padState.mapping.yCurve = xCurve;
            padState.mapping.xSmoothing = ySmoothing;
            padState.mapping.ySmoothing = xSmoothing;
            padState.mapping.invertX = invertY;
            padState.mapping.invertY = invertX;
            xSelect.select.value = padState.mapping.xParam || '';
            ySelect.select.value = padState.mapping.yParam || '';
            if (padState.controls.xResponse) {
                padState.controls.xResponse.select.value = padState.mapping.xCurve || this.getAxisDefaults('x').curve;
                padState.controls.xResponse.slider.value = String(padState.mapping.xSmoothing);
                padState.controls.xResponse.updateLabel();
            }
            if (padState.controls.yResponse) {
                padState.controls.yResponse.select.value = padState.mapping.yCurve || this.getAxisDefaults('y').curve;
                padState.controls.yResponse.slider.value = String(padState.mapping.ySmoothing);
                padState.controls.yResponse.updateLabel();
            }
            invertXToggle.input.checked = padState.mapping.invertX;
            invertYToggle.input.checked = padState.mapping.invertY;
            this.notifyMappingChange();
        });

        invertRow.appendChild(invertXToggle.wrapper);
        invertRow.appendChild(invertYToggle.wrapper);
        invertRow.appendChild(swapButton);

        const responseGroup = document.createElement('div');
        responseGroup.className = 'touchpad-response-group';

        const xResponse = this.createResponseControl('X Response', {
            curve: padState.mapping.xCurve,
            smoothing: padState.mapping.xSmoothing
        }, 'x', (next) => {
            padState.mapping.xCurve = next.curve;
            padState.mapping.xSmoothing = next.smoothing;
        });

        const yResponse = this.createResponseControl('Y Response', {
            curve: padState.mapping.yCurve,
            smoothing: padState.mapping.ySmoothing
        }, 'y', (next) => {
            padState.mapping.yCurve = next.curve;
            padState.mapping.ySmoothing = next.smoothing;
        });

        const spreadResponse = this.createResponseControl('Spread Gesture', {
            curve: padState.mapping.spreadCurve,
            smoothing: padState.mapping.spreadSmoothing
        }, 'spread', (next) => {
            padState.mapping.spreadCurve = next.curve;
            padState.mapping.spreadSmoothing = next.smoothing;
        });

        responseGroup.appendChild(xResponse.wrapper);
        responseGroup.appendChild(yResponse.wrapper);
        responseGroup.appendChild(spreadResponse.wrapper);

        padState.controls = {
            xResponse,
            yResponse,
            spreadResponse
        };

        controls.appendChild(axisRow);
        controls.appendChild(gestureRow);
        controls.appendChild(invertRow);
        controls.appendChild(responseGroup);

        wrapper.appendChild(header);
        wrapper.appendChild(padSurface);
        wrapper.appendChild(controls);

        this.bindPadEvents(padState);
        return padState;
    }

    createParameterSelect(label, value, onChange, { allowNone = false, placeholder = 'Select parameter', role = '' } = {}) {
        const wrapper = document.createElement('label');
        wrapper.className = 'touchpad-select';
        const span = document.createElement('span');
        span.textContent = label;
        const select = document.createElement('select');

        const options = [];
        if (allowNone) {
            options.push({ id: '', label: placeholder });
        }

        this.parameterOptions.forEach(option => {
            options.push({ id: option.id, label: option.label });
        });

        select.innerHTML = options.map(option => {
            const selected = option.id === value ? ' selected' : '';
            const disabled = option.id === '' && !allowNone ? ' disabled' : '';
            return `<option value="${option.id}"${selected}${disabled}>${option.label}</option>`;
        }).join('');

        select.value = value || '';
        if (role) {
            select.dataset.role = role;
        }
        select.addEventListener('change', () => {
            onChange(select.value);
        });

        wrapper.appendChild(span);
        wrapper.appendChild(select);
        return { wrapper, select };
    }

    createToggle(label, checked, onChange, role = '') {
        const wrapper = document.createElement('label');
        wrapper.className = 'touchpad-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = checked;
        if (role) {
            input.dataset.role = role;
        }
        input.addEventListener('change', () => onChange(input.checked));
        const span = document.createElement('span');
        span.textContent = label;
        wrapper.appendChild(input);
        wrapper.appendChild(span);
        return { wrapper, input };
    }

    createResponseControl(label, value, rolePrefix, onChange) {
        const wrapper = document.createElement('div');
        wrapper.className = 'touchpad-response';

        const header = document.createElement('div');
        header.className = 'touchpad-response__header';
        const title = document.createElement('span');
        title.textContent = label;
        const valueLabel = document.createElement('span');
        valueLabel.className = 'touchpad-response__value';
        valueLabel.dataset.role = `${rolePrefix}SmoothingValue`;
        header.appendChild(title);
        header.appendChild(valueLabel);

        const select = document.createElement('select');
        select.className = 'touchpad-response__select';
        select.dataset.role = `${rolePrefix}Curve`;
        select.innerHTML = CURVE_OPTIONS.map(option => {
            const selected = option.id === value.curve ? ' selected' : '';
            return `<option value="${option.id}"${selected}>${option.label}</option>`;
        }).join('');

        const sliderRow = document.createElement('div');
        sliderRow.className = 'touchpad-response__slider-row';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '0.95';
        slider.step = '0.05';
        slider.value = String(value.smoothing);
        slider.dataset.role = `${rolePrefix}Smoothing`;
        slider.className = 'touchpad-response__slider';
        sliderRow.appendChild(slider);

        const updateLabel = () => {
            valueLabel.textContent = this.formatSmoothingLabel(Number(slider.value));
        };
        updateLabel();

        const commit = () => {
            const next = {
                curve: select.value || 'linear',
                smoothing: toNumber(slider.value, value.smoothing)
            };
            onChange(next);
        };

        select.addEventListener('change', () => {
            commit();
            this.notifyMappingChange();
        });
        slider.addEventListener('input', () => {
            updateLabel();
            commit();
            this.notifyMappingChange();
        });

        wrapper.appendChild(header);
        wrapper.appendChild(select);
        wrapper.appendChild(sliderRow);

        return {
            wrapper,
            select,
            slider,
            updateLabel
        };
    }

    formatSmoothingLabel(value) {
        const percent = Math.round(clamp01(value) * 100);
        return `${percent}% damping`;
    }

    applyCurveValue(value, curve) {
        const v = clamp01(value);
        switch (curve) {
            case 'ease-in':
                return v * v;
            case 'ease-out':
                return 1 - (1 - v) * (1 - v);
            case 'ease-in-out':
                return v < 0.5
                    ? 2 * v * v
                    : 1 - Math.pow(-2 * v + 2, 2) / 2;
            case 'expo':
                return v === 0 ? 0 : Math.pow(v, 1.75);
            case 'sine':
                return Math.sin((v * Math.PI) / 2);
            default:
                return v;
        }
    }

    bindPadEvents(pad) {
        const handlePointerDown = (event) => {
            event.preventDefault();
            pad.surface.setPointerCapture(event.pointerId);
            pad.pointerState.set(event.pointerId, this.normalizePointer(event, pad.surface));
            this.updatePadFromPointers(pad);
        };

        const handlePointerMove = (event) => {
            if (!pad.pointerState.has(event.pointerId)) return;
            pad.pointerState.set(event.pointerId, this.normalizePointer(event, pad.surface));
            this.updatePadFromPointers(pad);
        };

        const handlePointerUp = (event) => {
            pad.pointerState.delete(event.pointerId);
            this.updatePadFromPointers(pad);
        };

        const handleLeave = () => {
            pad.pointerState.clear();
            this.updatePadFromPointers(pad);
        };

        pad.surface.addEventListener('pointerdown', handlePointerDown);
        pad.surface.addEventListener('pointermove', handlePointerMove);
        pad.surface.addEventListener('pointerup', handlePointerUp);
        pad.surface.addEventListener('pointercancel', handlePointerUp);
        pad.surface.addEventListener('pointerleave', handleLeave);

        pad.cleanup = () => {
            pad.surface.removeEventListener('pointerdown', handlePointerDown);
            pad.surface.removeEventListener('pointermove', handlePointerMove);
            pad.surface.removeEventListener('pointerup', handlePointerUp);
            pad.surface.removeEventListener('pointercancel', handlePointerUp);
            pad.surface.removeEventListener('pointerleave', handleLeave);
        };
    }

    normalizePointer(event, element) {
        const rect = element.getBoundingClientRect();
        const x = clamp01((event.clientX - rect.left) / rect.width);
        const y = clamp01((event.clientY - rect.top) / rect.height);
        return { x, y, pointerId: event.pointerId };
    }

    updatePadFromPointers(pad) {
        const pointers = Array.from(pad.pointerState.values());
        const pointerCount = pointers.length;
        const statusLabel = pointerCount > 0 ? `${pointerCount} touch${pointerCount > 1 ? 'es' : ''}` : 'Ready';
        if (pad.statusEl) {
            pad.statusEl.textContent = statusLabel;
        }

        if (pointerCount === 0) {
            pad.indicator.style.opacity = '0';
            return;
        }

        const centroid = pointers.reduce((acc, pointer) => {
            acc.x += pointer.x;
            acc.y += pointer.y;
            return acc;
        }, { x: 0, y: 0 });

        centroid.x /= pointerCount;
        centroid.y /= pointerCount;

        pad.indicator.style.opacity = '1';
        pad.indicator.style.transform = `translate(${centroid.x * 100}%, ${centroid.y * 100}%)`;

        const { mapping } = pad;
        if (!this.parameterManager) return;

        if (mapping.xParam) {
            this.applyAxisValue({
                parameter: mapping.xParam,
                invert: mapping.invertX,
                curve: mapping.xCurve,
                smoothing: mapping.xSmoothing
            }, centroid.x, 'touchpad-x');
        }
        if (mapping.yParam) {
            this.applyAxisValue({
                parameter: mapping.yParam,
                invert: mapping.invertY,
                curve: mapping.yCurve,
                smoothing: mapping.ySmoothing
            }, centroid.y, 'touchpad-y');
        }
        if (mapping.spreadParam && pointerCount > 1) {
            const spreadValue = this.calculateSpreadValue(pointers);
            this.applyAxisValue({
                parameter: mapping.spreadParam,
                invert: false,
                curve: mapping.spreadCurve,
                smoothing: mapping.spreadSmoothing
            }, spreadValue, 'touchpad-gesture');
        }

        if (this.hub) {
            this.hub.emit('touchpad-input', {
                padId: mapping.id,
                centroid,
                pointerCount,
                mapping: { ...mapping }
            });
        }
    }

    calculateSpreadValue(pointers) {
        if (pointers.length < 2) return 0;
        let maxDistance = 0;
        for (let i = 0; i < pointers.length; i += 1) {
            for (let j = i + 1; j < pointers.length; j += 1) {
                const dx = pointers[i].x - pointers[j].x;
                const dy = pointers[i].y - pointers[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > maxDistance) {
                    maxDistance = distance;
                }
            }
        }
        return clamp01(maxDistance * Math.SQRT2);
    }

    applyAxisValue(axisConfig, normalizedValue, source) {
        if (!this.parameterManager || !axisConfig || !axisConfig.parameter) return;
        const def = this.parameterManager.getParameterDefinition(axisConfig.parameter);
        if (!def) return;

        const inverted = axisConfig.invert ? 1 - clamp01(normalizedValue) : clamp01(normalizedValue);
        const curved = this.applyCurveValue(inverted, axisConfig.curve);
        const smoothing = Math.min(0.95, Math.max(0, axisConfig.smoothing ?? 0));
        const stateKey = `${axisConfig.parameter}:${source || 'touchpad'}`;
        const previous = this.smoothingState.get(stateKey);
        const lerpFactor = 1 - smoothing;
        const smoothed = previous === undefined ? curved : previous + (curved - previous) * lerpFactor;
        this.smoothingState.set(stateKey, smoothed);

        const value = def.min + (def.max - def.min) * smoothed;
        this.parameterManager.setParameter(axisConfig.parameter, value, source || 'touchpad');
    }

    clearSmoothingState(parameter, source) {
        if (!parameter) return;
        const key = `${parameter}:${source || 'touchpad'}`;
        this.smoothingState.delete(key);
    }

    notifyMappingChange() {
        const state = this.getState();
        this.onMappingChange(state);
        if (this.hub) {
            this.hub.emit('touchpad-mapping-change', state);
        }
    }

    getMappings() {
        return this.pads.map(pad => ({ ...pad.mapping }));
    }

    applyMappings(mappings = []) {
        if (!Array.isArray(mappings) || mappings.length === 0) return;
        this.smoothingState.clear();
        mappings.forEach((mapping, index) => {
            const pad = this.pads[index];
            if (!pad) return;

            pad.mapping = this.normaliseMapping({
                ...pad.mapping,
                ...mapping,
                id: pad.mapping.id,
                label: pad.mapping.label
            });

            const xSelect = pad.wrapper.querySelector('[data-role="xParam"]');
            if (xSelect) xSelect.value = pad.mapping.xParam || '';
            const ySelect = pad.wrapper.querySelector('[data-role="yParam"]');
            if (ySelect) ySelect.value = pad.mapping.yParam || '';
            const spreadSelect = pad.wrapper.querySelector('[data-role="spreadParam"]');
            if (spreadSelect) spreadSelect.value = pad.mapping.spreadParam || '';

            const invertXInput = pad.wrapper.querySelector('[data-role="invertX"]');
            if (invertXInput) invertXInput.checked = Boolean(pad.mapping.invertX);
            const invertYInput = pad.wrapper.querySelector('[data-role="invertY"]');
            if (invertYInput) invertYInput.checked = Boolean(pad.mapping.invertY);

            if (pad.controls?.xResponse) {
                pad.controls.xResponse.select.value = pad.mapping.xCurve || this.getAxisDefaults('x').curve;
                pad.controls.xResponse.slider.value = String(pad.mapping.xSmoothing);
                pad.controls.xResponse.updateLabel();
            }
            if (pad.controls?.yResponse) {
                pad.controls.yResponse.select.value = pad.mapping.yCurve || this.getAxisDefaults('y').curve;
                pad.controls.yResponse.slider.value = String(pad.mapping.ySmoothing);
                pad.controls.yResponse.updateLabel();
            }
            if (pad.controls?.spreadResponse) {
                pad.controls.spreadResponse.select.value = pad.mapping.spreadCurve || this.getAxisDefaults('spread').curve;
                pad.controls.spreadResponse.slider.value = String(pad.mapping.spreadSmoothing);
                pad.controls.spreadResponse.updateLabel();
            }
        });

        this.notifyMappingChange();
    }

    destroy() {
        this.pads.forEach(pad => {
            if (pad.cleanup) pad.cleanup();
        });
        this.pads = [];
        this.grid = null;
        this.layoutControlRefs = {};
        this.smoothingState.clear();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
