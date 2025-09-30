import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

const AXES = ['x', 'y', 'gesture'];

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

export class TouchPadController {
    constructor(options = {}) {
        const {
            parameterManager,
            container = null,
            config = DEFAULT_PERFORMANCE_CONFIG.touchPads,
            onMappingChange = null,
            onLayoutChange = null,
            padCount = null,
            defaultMappings = null
        } = options;

        this.parameterManager = parameterManager;
        this.onMappingChange = onMappingChange;
        this.onLayoutChange = onLayoutChange;
        this.config = JSON.parse(JSON.stringify(config || DEFAULT_PERFORMANCE_CONFIG.touchPads));
        this.availableParameters = this.buildParameterOptions();
        this.parameterLabels = new Map(this.availableParameters.map(meta => [meta.id, meta.label]));
        this.modeLabelMap = new Map(this.config.axis.modes.map(mode => [mode.value, mode.label]));

        this.container = container || this.ensureContainer();
        this.padGrid = null;
        this.layoutControls = null;
        this.layoutControlRefs = {};

        const resolvedMappings = Array.isArray(defaultMappings) && defaultMappings.length
            ? defaultMappings
            : this.config.defaultMappings;

        const defaultPadCount = padCount ?? this.config.pads?.defaultCount ?? resolvedMappings.length ?? 3;
        this.padCount = this.normalizePadCount(defaultPadCount);

        this.layoutSettings = {
            ...this.config.layout
        };

        this.padStates = [];
        this.suspendNotify = false;

        this.buildUI();
        this.renderPads(resolvedMappings.map(mapping => ({ bindings: mapping })));
        this.applyLayoutToContainer();
        this.syncLayoutControls();
        this.emitLayoutChange();
    }

    ensureContainer() {
        const existing = document.getElementById('performance-touchpads');
        if (existing) {
            existing.classList.add('performance-touchpads');
            return existing;
        }

        const element = document.createElement('section');
        element.id = 'performance-touchpads';
        element.classList.add('performance-touchpads');
        document.body.appendChild(element);
        return element;
    }

    buildParameterOptions() {
        if (!this.parameterManager) return [];
        const metadata = this.parameterManager.listParameterMetadata();
        return metadata.map(meta => ({
            id: meta.id,
            label: meta.label,
            group: meta.group,
            min: meta.min,
            max: meta.max,
            type: meta.type,
            step: meta.step,
            tags: meta.tags
        }));
    }

    groupParametersByGroup() {
        const groups = new Map();
        this.availableParameters.forEach(meta => {
            const group = meta.group || 'General';
            if (!groups.has(group)) {
                groups.set(group, []);
            }
            groups.get(group).push(meta);
        });

        return Array.from(groups.entries())
            .map(([group, options]) => ({
                group,
                options: options.sort((a, b) => a.label.localeCompare(b.label))
            }))
            .sort((a, b) => a.group.localeCompare(b.group));
    }

    buildUI() {
        if (!this.container) return;

        this.container.classList.add('performance-touchpads');
        this.container.innerHTML = '';

        const header = document.createElement('header');
        header.classList.add('performance-section-header');
        header.innerHTML = `
            <div>
                <h3>Multi-Touch Control Pads</h3>
                <p class="performance-subtitle">Assign any parameter to expressive XY pads and capture live gestures.</p>
            </div>
        `;
        this.container.appendChild(header);

        this.layoutControls = this.createLayoutControls();
        this.container.appendChild(this.layoutControls);

        this.padGrid = document.createElement('div');
        this.padGrid.classList.add('touchpad-grid');
        this.container.appendChild(this.padGrid);
    }

    createLayoutControls() {
        const wrapper = document.createElement('div');
        wrapper.classList.add('touchpad-layout-controls');

        const padCountControl = document.createElement('label');
        padCountControl.classList.add('layout-control');
        padCountControl.innerHTML = `
            <span class="layout-control-label">Pads</span>
            <input type="number" class="layout-control-input" min="${this.config.pads?.min ?? 1}" max="${this.config.pads?.max ?? 8}" step="1">
        `;
        const padCountInput = padCountControl.querySelector('input');
        padCountInput.value = this.padCount;
        padCountInput.addEventListener('change', () => {
            this.setPadCount(parseInt(padCountInput.value, 10));
        });
        padCountInput.addEventListener('input', () => {
            this.updateLayoutDisplay('padCount', parseInt(padCountInput.value, 10));
        });
        this.layoutControlRefs.padCount = { input: padCountInput, display: null };
        wrapper.appendChild(padCountControl);

        const padSizeControl = this.createSliderControl({
            label: 'Pad Size',
            key: 'minWidth',
            min: this.config.layout?.minWidth ?? 160,
            max: this.config.layout?.maxWidth ?? 420,
            step: 10,
            unit: 'px',
            format: value => `${Math.round(value)}px`
        });
        wrapper.appendChild(padSizeControl);

        const gapControl = this.createSliderControl({
            label: 'Pad Gap',
            key: 'gap',
            min: 6,
            max: 48,
            step: 2,
            unit: 'px',
            format: value => `${Math.round(value)}px`
        });
        wrapper.appendChild(gapControl);

        const aspectControl = this.createSliderControl({
            label: 'Aspect',
            key: 'aspectRatio',
            min: 0.6,
            max: 1.4,
            step: 0.05,
            format: value => value.toFixed(2)
        });
        wrapper.appendChild(aspectControl);

        const columnsControl = document.createElement('label');
        columnsControl.classList.add('layout-control');
        columnsControl.innerHTML = `
            <span class="layout-control-label">Columns</span>
            <select class="layout-control-input">
                <option value="auto">Auto</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
            </select>
        `;
        const columnsSelect = columnsControl.querySelector('select');
        columnsSelect.value = this.layoutSettings.columns ? String(this.layoutSettings.columns) : 'auto';
        columnsSelect.addEventListener('change', () => {
            const raw = columnsSelect.value;
            const value = raw === 'auto' ? 'auto' : parseInt(raw, 10);
            this.updateLayoutSetting('columns', value);
        });
        this.layoutControlRefs.columns = { input: columnsSelect };
        wrapper.appendChild(columnsControl);

        return wrapper;
    }

    createSliderControl({ label, key, min, max, step, unit = '', format = value => value }) {
        const control = document.createElement('label');
        control.classList.add('layout-control');
        control.innerHTML = `
            <span class="layout-control-label">${label}</span>
            <div class="layout-control-slider">
                <input type="range" min="${min}" max="${max}" step="${step}">
                <span class="layout-control-value"></span>
            </div>
        `;

        const input = control.querySelector('input');
        const valueLabel = control.querySelector('.layout-control-value');

        input.addEventListener('input', event => {
            const numericValue = parseFloat(event.target.value);
            this.updateLayoutSetting(key, numericValue);
        });

        this.layoutControlRefs[key] = { input, display: valueLabel, format, unit };

        const currentValue = this.layoutSettings[key] ?? min;
        input.value = currentValue;
        valueLabel.textContent = `${format(currentValue)}${unit}`;

        return control;
    }

    renderPads(padSeeds = null) {
        if (!this.padGrid) return;

        const seeds = this.buildPadSeeds(padSeeds);
        this.padGrid.innerHTML = '';
        this.padStates = [];

        for (let index = 0; index < this.padCount; index++) {
            const seed = seeds[index] || {};
            const padState = this.createPadState(index, seed.bindings, seed.modes);
            this.padStates.push(padState);
            this.padGrid.appendChild(padState.element);
        }

        this.updatePadSummaries();
        this.notifyMappingChange();
    }
    buildPadSeeds(padSeeds) {
        if (Array.isArray(padSeeds)) {
            return padSeeds.map(seed => ({
                bindings: seed.bindings || seed.axisBindings || {},
                modes: seed.modes || seed.axisModes || {}
            }));
        }

        return this.padStates.map(state => ({
            bindings: { ...state.axisBindings },
            modes: { ...state.axisModes }
        }));
    }

    createPadState(index, bindings = {}, modes = {}) {
        const padWrapper = document.createElement('div');
        padWrapper.classList.add('touchpad-wrapper');

        const header = document.createElement('div');
        header.classList.add('touchpad-header');
        const title = document.createElement('div');
        title.classList.add('touchpad-title');
        title.textContent = `Pad ${index + 1}`;
        const summary = document.createElement('div');
        summary.classList.add('touchpad-summary');
        header.appendChild(title);
        header.appendChild(summary);
        padWrapper.appendChild(header);

        const mappingContainer = document.createElement('div');
        mappingContainer.classList.add('touchpad-mapping');
        padWrapper.appendChild(mappingContainer);

        const padSurface = document.createElement('div');
        padSurface.classList.add('touchpad-surface');
        padSurface.setAttribute('tabindex', '0');
        padSurface.dataset.padIndex = String(index);

        const crosshair = document.createElement('div');
        crosshair.classList.add('touchpad-crosshair');
        padSurface.appendChild(crosshair);

        const readout = this.createReadout();
        padWrapper.appendChild(padSurface);
        padWrapper.appendChild(readout.container);

        const padMapping = this.getDefaultMapping(index);
        const axisBindings = {
            x: bindings?.x || padMapping.x,
            y: bindings?.y || padMapping.y,
            gesture: bindings?.gesture || padMapping.gesture || 'none'
        };

        const axisModes = {
            x: modes?.x || this.config.axis.defaultModes?.x || 'absolute',
            y: modes?.y || this.config.axis.defaultModes?.y || 'absolute',
            gesture: modes?.gesture || this.config.axis.defaultModes?.gesture || 'bipolar'
        };

        const padState = {
            id: index,
            element: padWrapper,
            surface: padSurface,
            crosshair,
            summary,
            readout,
            axisBindings,
            axisModes,
            axisBaselines: { x: null, y: null, gesture: null },
            activePointers: new Map(),
            controls: {},
            centroid: { x: 0.5, y: 0.5 }
        };

        padState.controls.x = this.createAxisControl('X Axis', 'x', padState);
        padState.controls.y = this.createAxisControl('Y Axis', 'y', padState);
        padState.controls.gesture = this.createAxisControl('Gesture', 'gesture', padState, true);

        mappingContainer.appendChild(padState.controls.x.container);
        mappingContainer.appendChild(padState.controls.y.container);
        mappingContainer.appendChild(padState.controls.gesture.container);

        this.attachPadEvents(padState);
        this.updateReadout(padState, 'x', null);
        this.updateReadout(padState, 'y', null);
        this.updateReadout(padState, 'gesture', null);

        return padState;
    }

    getDefaultMapping(index) {
        if (!Array.isArray(this.config.defaultMappings) || this.config.defaultMappings.length === 0) {
            return { x: 'rot4dXW', y: 'rot4dYW', gesture: 'none' };
        }
        if (index < this.config.defaultMappings.length) {
            return this.config.defaultMappings[index];
        }
        return this.config.defaultMappings[this.config.defaultMappings.length - 1];
    }

    createAxisControl(label, axisKey, padState, allowNone = false) {
        const container = document.createElement('div');
        container.classList.add('axis-control');

        const labelEl = document.createElement('span');
        labelEl.classList.add('axis-control-label');
        labelEl.textContent = label;
        container.appendChild(labelEl);

        const row = document.createElement('div');
        row.classList.add('axis-control-row');
        container.appendChild(row);

        const select = document.createElement('select');
        select.classList.add('axis-select');
        this.populateParameterSelect(select, padState.axisBindings[axisKey], allowNone);
        select.addEventListener('change', () => {
            this.updateAxisBinding(padState, axisKey, select.value);
        });

        const modeSelect = document.createElement('select');
        modeSelect.classList.add('axis-mode-select');
        this.populateModeSelect(modeSelect, padState.axisModes[axisKey]);
        modeSelect.addEventListener('change', () => {
            this.updateAxisMode(padState, axisKey, modeSelect.value);
        });

        row.appendChild(select);
        row.appendChild(modeSelect);

        return { container, select, mode: modeSelect };
    }

    populateParameterSelect(select, selectedValue, allowNone) {
        select.innerHTML = '';

        if (allowNone) {
            const noneOption = document.createElement('option');
            noneOption.value = 'none';
            noneOption.textContent = '— None —';
            select.appendChild(noneOption);
        }

        const groups = this.groupParametersByGroup();
        groups.forEach(({ group, options }) => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group;
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option.id;
                opt.textContent = option.label;
                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        });

        if (selectedValue && select.querySelector(`option[value="${selectedValue}"]`)) {
            select.value = selectedValue;
        } else if (allowNone) {
            select.value = 'none';
        } else if (this.availableParameters.length > 0) {
            select.value = this.availableParameters[0].id;
        }
    }

    populateModeSelect(select, selectedValue) {
        select.innerHTML = '';
        this.config.axis.modes.forEach(mode => {
            const option = document.createElement('option');
            option.value = mode.value;
            option.textContent = mode.label;
            select.appendChild(option);
        });
        if (selectedValue && select.querySelector(`option[value="${selectedValue}"]`)) {
            select.value = selectedValue;
        }
    }

    createReadout() {
        const container = document.createElement('div');
        container.classList.add('touchpad-readout');

        const createLine = (label, axis) => {
            const line = document.createElement('div');
            line.classList.add('touchpad-readout-line');
            if (axis === 'gesture') {
                line.classList.add('touchpad-gesture');
            }
            const labelEl = document.createElement('span');
            labelEl.textContent = `${label}:`;
            const valueEl = document.createElement('strong');
            valueEl.dataset.axisValue = axis;
            valueEl.textContent = '—';
            line.appendChild(labelEl);
            line.appendChild(valueEl);
            return { line, valueEl };
        };

        const xLine = createLine('X', 'x');
        const yLine = createLine('Y', 'y');
        const gestureLine = createLine('Gesture', 'gesture');

        container.appendChild(xLine.line);
        container.appendChild(yLine.line);
        container.appendChild(gestureLine.line);

        return {
            container,
            values: {
                x: xLine.valueEl,
                y: yLine.valueEl,
                gesture: gestureLine.valueEl
            }
        };
    }

    attachPadEvents(padState) {
        const { surface } = padState;

        surface.addEventListener('pointerdown', event => this.handlePointerStart(padState, event));
        surface.addEventListener('pointermove', event => this.handlePointerMove(padState, event));
        ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'].forEach(type => {
            surface.addEventListener(type, event => this.handlePointerEnd(padState, event));
        });
    }

    handlePointerStart(padState, event) {
        event.preventDefault();
        padState.surface.setPointerCapture?.(event.pointerId);
        const point = this.eventToPoint(event, padState.surface);
        padState.activePointers.set(event.pointerId, point);

        AXES.forEach(axis => {
            if (padState.axisModes[axis] === 'relative' && padState.axisBaselines[axis] === null) {
                const binding = padState.axisBindings[axis];
                if (binding && binding !== 'none') {
                    padState.axisBaselines[axis] = this.parameterManager?.getParameter(binding) ?? 0;
                }
            }
        });

        this.updatePadFromPointers(padState);
    }

    handlePointerMove(padState, event) {
        if (!padState.activePointers.has(event.pointerId)) return;
        const point = this.eventToPoint(event, padState.surface);
        padState.activePointers.set(event.pointerId, point);
        this.updatePadFromPointers(padState);
    }

    handlePointerEnd(padState, event) {
        if (padState.activePointers.has(event.pointerId)) {
            padState.activePointers.delete(event.pointerId);
        }

        if (padState.activePointers.size === 0) {
            AXES.forEach(axis => {
                if (padState.axisModes[axis] === 'relative') {
                    padState.axisBaselines[axis] = null;
                }
            });
        } else {
            this.updatePadFromPointers(padState);
        }
    }

    eventToPoint(event, surface) {
        const rect = surface.getBoundingClientRect();
        const x = clamp01((event.clientX - rect.left) / rect.width);
        const y = clamp01((event.clientY - rect.top) / rect.height);
        const pressure = event.pressure && event.pressure > 0 ? event.pressure : (event.pointerType === 'mouse' ? (event.buttons ? 0.8 : 0.5) : 0.5);
        return { x, y, pressure };
    }

    updatePadFromPointers(padState) {
        if (padState.activePointers.size === 0) return;

        const points = Array.from(padState.activePointers.values());
        const centroid = this.calculateCentroid(points);
        padState.centroid = centroid;

        padState.crosshair.style.setProperty('--x', `${(centroid.x * 100).toFixed(2)}%`);
        padState.crosshair.style.setProperty('--y', `${(centroid.y * 100).toFixed(2)}%`);

        const normalizedX = centroid.x;
        const normalizedY = 1 - centroid.y;
        const gestureValue = this.calculateGestureValue(points, centroid);

        this.applyAxisValue(padState, 'x', normalizedX);
        this.applyAxisValue(padState, 'y', normalizedY);
        this.applyAxisValue(padState, 'gesture', gestureValue);
    }

    calculateCentroid(points) {
        const total = points.reduce((acc, point) => {
            acc.x += point.x;
            acc.y += point.y;
            return acc;
        }, { x: 0, y: 0 });

        return {
            x: clamp01(total.x / points.length),
            y: clamp01(total.y / points.length)
        };
    }

    calculateGestureValue(points, centroid) {
        if (points.length <= 1) {
            return clamp01(points[0]?.pressure ?? 0.5);
        }

        const distances = points.map(point => {
            const dx = point.x - centroid.x;
            const dy = point.y - centroid.y;
            return Math.sqrt(dx * dx + dy * dy);
        });

        const average = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
        const { minimumSpread = 0.05, maximumSpread = 0.65 } = this.config.gesture || {};
        const normalized = (average - minimumSpread) / (maximumSpread - minimumSpread || 1);
        return clamp01(normalized);
    }

    applyAxisValue(padState, axis, normalizedValue) {
        const binding = padState.axisBindings[axis];
        if (!binding || binding === 'none') {
            this.updateReadout(padState, axis, normalizedValue, true);
            return;
        }

        const def = this.parameterManager?.getParameterDefinition(binding);
        if (!def) {
            this.updateReadout(padState, axis, normalizedValue, true);
            return;
        }

        const mode = padState.axisModes[axis];
        let value;

        if (mode === 'absolute') {
            value = def.min + (def.max - def.min) * normalizedValue;
        } else if (mode === 'bipolar') {
            const center = (def.min + def.max) / 2;
            const amplitude = (def.max - def.min) / 2;
            value = center + (normalizedValue - 0.5) * 2 * amplitude;
        } else if (mode === 'relative') {
            const baseline = padState.axisBaselines[axis] ?? this.parameterManager.getParameter(binding) ?? ((def.min + def.max) / 2);
            const range = def.max - def.min;
            const strength = this.config.axis.relativeStrength ?? 0.4;
            const offset = (normalizedValue - 0.5) * range * strength;
            value = baseline + offset;
        } else {
            value = def.min + (def.max - def.min) * normalizedValue;
        }

        const clamped = this.parameterManager.clampToDefinition(binding, value);
        this.parameterManager.setParameter(binding, clamped, 'touchpad');
        this.updateReadout(padState, axis, clamped);
    }

    updateReadout(padState, axis, value, normalizedOnly = false) {
        const target = padState.readout.values[axis];
        if (!target) return;

        if (value === null || value === undefined) {
            target.textContent = '—';
            return;
        }

        if (normalizedOnly) {
            target.textContent = value.toFixed(2);
            return;
        }

        const def = this.parameterManager?.getParameterDefinition(padState.axisBindings[axis]);
        if (def?.type === 'int') {
            target.textContent = Math.round(value).toString();
        } else {
            target.textContent = value.toFixed(2);
        }
    }
    updateAxisBinding(padState, axis, value) {
        padState.axisBindings[axis] = value;
        if (value !== 'none') {
            padState.axisBaselines[axis] = null;
        }
        this.updatePadSummary(padState);
        this.notifyMappingChange();
    }

    updateAxisMode(padState, axis, mode) {
        padState.axisModes[axis] = mode;
        this.updatePadSummary(padState);
        this.notifyMappingChange();
    }

    updatePadSummaries() {
        this.padStates.forEach(padState => this.updatePadSummary(padState));
    }

    updatePadSummary(padState) {
        if (!padState?.summary) return;
        const fragments = AXES.map(axis => {
            const label = axis === 'x' ? 'X' : axis === 'y' ? 'Y' : 'Gesture';
            const binding = padState.axisBindings[axis];
            const bindingLabel = this.getParameterLabel(binding);
            const modeLabel = padState.axisModes[axis];
            const modeText = this.modeLabelMap.get(modeLabel) || modeLabel;
            return `${label}: ${bindingLabel}${binding && binding !== 'none' ? ` (${modeText})` : ''}`;
        });
        padState.summary.textContent = fragments.join(' · ');
    }

    getParameterLabel(parameter) {
        if (!parameter || parameter === 'none') {
            return 'None';
        }
        return this.parameterLabels.get(parameter) || this.parameterManager?.formatParameterLabel(parameter) || parameter;
    }

    normalizePadCount(count) {
        const min = this.config.pads?.min ?? 1;
        const max = this.config.pads?.max ?? Math.max(min, 6);
        const numeric = Number.isFinite(count) ? count : min;
        return Math.min(Math.max(Math.round(numeric), min), max);
    }

    setPadCount(count) {
        const normalized = this.normalizePadCount(count);
        if (normalized === this.padCount) {
            this.syncLayoutControls();
            return;
        }
        this.padCount = normalized;
        this.renderPads();
        this.syncLayoutControls();
        this.emitLayoutChange();
    }

    updateLayoutSetting(key, value) {
        if (value === undefined || value === null) return;
        if (key === 'columns' && value !== 'auto') {
            value = parseInt(value, 10);
            if (!Number.isFinite(value) || value <= 0) {
                value = 'auto';
            }
        }

        if (key === 'minWidth') {
            const minBound = this.config.layout?.minWidth ?? 160;
            const maxBound = this.config.layout?.maxWidth ?? Math.max(minBound, value);
            value = Math.max(minBound, Math.min(maxBound, value));
        }

        if (key === 'gap') {
            const minGap = 0;
            const maxGap = this.config.layout?.maxGap ?? 96;
            value = Math.max(minGap, Math.min(maxGap, value));
        }

        if (key === 'aspectRatio') {
            const minAspect = this.config.layout?.minAspect ?? 0.5;
            const maxAspect = this.config.layout?.maxAspect ?? 2;
            value = Math.max(minAspect, Math.min(maxAspect, value));
        }

        this.layoutSettings[key] = value;
        this.updateLayoutDisplay(key, value);
        this.applyLayoutToContainer();
        this.emitLayoutChange();
    }

    updateLayoutDisplay(key, value, formatted = null) {
        const ref = this.layoutControlRefs[key];
        if (!ref) return;
        if (ref.input && key !== 'padCount') {
            ref.input.value = value;
        }
        if (ref.display) {
            const formatter = ref.format || (val => val);
            const valueText = formatted ?? formatter(value);
            const unit = ref.unit || '';
            ref.display.textContent = `${valueText}${unit}`;
        }
        if (key === 'padCount' && this.layoutControlRefs.padCount?.input) {
            this.layoutControlRefs.padCount.input.value = value;
        }
        if (key === 'columns' && this.layoutControlRefs.columns?.input) {
            const raw = value === 'auto' ? 'auto' : String(value);
            this.layoutControlRefs.columns.input.value = raw;
        }
    }

    applyLayoutToContainer() {
        if (!this.container) return;
        const layout = this.layoutSettings;
        if (layout.minWidth) {
            this.container.style.setProperty('--touchpad-min-width', `${layout.minWidth}px`);
        }
        if (layout.gap !== undefined) {
            this.container.style.setProperty('--touchpad-gap', `${layout.gap}px`);
        }
        if (layout.aspectRatio) {
            this.container.style.setProperty('--touchpad-aspect-ratio', layout.aspectRatio);
        }
        if (layout.crosshairSize) {
            this.container.style.setProperty('--touchpad-crosshair-size', `${layout.crosshairSize}px`);
        }
        if (layout.columns && layout.columns !== 'auto') {
            this.container.style.setProperty('--touchpad-columns', layout.columns);
        } else {
            this.container.style.removeProperty('--touchpad-columns');
        }
    }

    syncLayoutControls() {
        this.updateLayoutDisplay('padCount', this.padCount);
        ['minWidth', 'gap', 'aspectRatio'].forEach(key => {
            const value = this.layoutSettings[key];
            if (value !== undefined) {
                this.updateLayoutDisplay(key, value);
            }
        });
        const columnsValue = this.layoutSettings.columns ?? 'auto';
        this.updateLayoutDisplay('columns', columnsValue);
    }

    notifyMappingChange() {
        if (this.suspendNotify) return;
        if (typeof this.onMappingChange === 'function') {
            this.onMappingChange(this.getMappings());
        }
    }

    emitLayoutChange() {
        if (typeof this.onLayoutChange === 'function') {
            this.onLayoutChange({ ...this.layoutSettings, padCount: this.padCount });
        }
    }

    getMappings() {
        return {
            padCount: this.padCount,
            layout: { ...this.layoutSettings },
            pads: this.padStates.map(padState => ({
                id: padState.id,
                bindings: { ...padState.axisBindings },
                modes: { ...padState.axisModes }
            }))
        };
    }

    applyMappings(mappings = []) {
        const normalized = this.normalizeMappingsInput(mappings);
        this.suspendNotify = true;

        if (normalized.layout) {
            this.layoutSettings = {
                ...this.layoutSettings,
                ...normalized.layout
            };
            this.applyLayoutToContainer();
        }

        if (normalized.padCount !== undefined) {
            this.padCount = this.normalizePadCount(normalized.padCount);
        }

        this.renderPads(normalized.padSeeds);
        this.suspendNotify = false;
        this.syncLayoutControls();
        this.emitLayoutChange();
        this.notifyMappingChange();
    }

    normalizeMappingsInput(mappings) {
        if (!mappings) {
            return {
                padCount: this.padCount,
                padSeeds: this.buildPadSeeds()
            };
        }

        if (Array.isArray(mappings)) {
            return {
                padCount: mappings.length,
                padSeeds: mappings
            };
        }

        const padSeeds = Array.isArray(mappings.pads)
            ? mappings.pads
            : Array.isArray(mappings.padStates)
                ? mappings.padStates
                : [];

        return {
            layout: mappings.layout || null,
            padCount: mappings.padCount ?? padSeeds.length ?? this.padCount,
            padSeeds
        };
    }

    destroy() {
        this.padStates.forEach(padState => {
            padState.activePointers.clear();
        });
        this.padStates = [];
        if (this.container) {
            this.container.style.removeProperty('--touchpad-min-width');
            this.container.style.removeProperty('--touchpad-gap');
            this.container.style.removeProperty('--touchpad-aspect-ratio');
            this.container.style.removeProperty('--touchpad-crosshair-size');
            this.container.style.removeProperty('--touchpad-columns');
        }
    }
}
