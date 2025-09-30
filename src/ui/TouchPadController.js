import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

const AXES = ['x', 'y', 'gesture'];

const DEFAULT_CURVE_OPTIONS = [
    { value: 'linear', label: 'Linear' },
    { value: 'ease-in', label: 'Ease In' },
    { value: 'ease-out', label: 'Ease Out' },
    { value: 'ease-in-out', label: 'Ease In-Out' },
    { value: 'expo', label: 'Exponential' }
];

const CURVE_FUNCTIONS = {
    linear: value => value,
    'ease-in': value => value * value,
    'ease-out': value => 1 - Math.pow(1 - value, 2),
    'ease-in-out': value => (value < 0.5)
        ? 2 * value * value
        : 1 - Math.pow(-2 * value + 2, 2) / 2,
    expo: value => Math.pow(value, 3)
};

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
            defaultMappings = null,
            hub = null
        } = options;

        this.parameterManager = parameterManager;
        this.onMappingChange = onMappingChange;
        this.onLayoutChange = onLayoutChange;
        this.hub = hub;
        this.config = JSON.parse(JSON.stringify(config || DEFAULT_PERFORMANCE_CONFIG.touchPads));
        this.availableParameters = this.buildParameterOptions();
        this.parameterLabels = new Map(this.availableParameters.map(meta => [meta.id, meta.label]));
        this.modeLabelMap = new Map(this.config.axis.modes.map(mode => [mode.value, mode.label]));
        this.curveOptions = Array.isArray(this.config.axis?.curves) && this.config.axis.curves.length
            ? this.config.axis.curves
            : DEFAULT_CURVE_OPTIONS;
        this.curveLabelMap = new Map(this.curveOptions.map(curve => [curve.value, curve.label]));
        const smoothingConfig = this.config.axis?.smoothing || {};
        this.smoothingConfig = {
            min: smoothingConfig.min ?? 0,
            max: smoothingConfig.max ?? 0.6,
            step: smoothingConfig.step ?? 0.05,
            default: smoothingConfig.default ?? 0
        };

        this.container = container || this.ensureContainer();
        this.padGrid = null;
        this.layoutControls = null;
        this.layoutControlRefs = {};
        this.paletteControls = null;
        this.paletteControlRefs = {};

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
        this.renderPads(resolvedMappings);
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

        this.paletteControls = this.createPaletteControls();
        if (this.paletteControls?.container) {
            this.container.appendChild(this.paletteControls.container);
        }

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

    createPaletteControls() {
        const wrapper = document.createElement('div');
        wrapper.classList.add('touchpad-palette-controls');

        const header = document.createElement('div');
        header.classList.add('touchpad-palette-header');
        header.innerHTML = `
            <h4>Axis Palette</h4>
            <p>Broadcast assignments across pads or restore curated defaults instantly.</p>
        `;
        wrapper.appendChild(header);

        const grid = document.createElement('div');
        grid.classList.add('touchpad-palette-grid');

        const axisLabel = document.createElement('label');
        axisLabel.innerHTML = '<span>Axis</span>';
        const axisSelect = document.createElement('select');
        axisSelect.classList.add('palette-axis-select');
        axisSelect.innerHTML = `
            <option value="x">X Axis</option>
            <option value="y">Y Axis</option>
            <option value="gesture">Gesture</option>
        `;
        axisLabel.appendChild(axisSelect);

        const parameterLabel = document.createElement('label');
        parameterLabel.innerHTML = '<span>Parameter</span>';
        const parameterSelect = document.createElement('select');
        parameterSelect.classList.add('palette-parameter-select');
        this.populateParameterSelect(parameterSelect, this.availableParameters[0]?.id || '', false);
        parameterLabel.appendChild(parameterSelect);

        grid.appendChild(axisLabel);
        grid.appendChild(parameterLabel);
        wrapper.appendChild(grid);

        const actions = document.createElement('div');
        actions.classList.add('touchpad-palette-actions');

        const applyButton = document.createElement('button');
        applyButton.type = 'button';
        applyButton.textContent = 'Apply to all pads';
        applyButton.addEventListener('click', () => {
            const axis = axisSelect.value;
            const parameter = parameterSelect.value;
            this.applyAxisBindingAcrossPads(axis, parameter);
        });

        const restoreButton = document.createElement('button');
        restoreButton.type = 'button';
        restoreButton.textContent = 'Restore defaults';
        restoreButton.addEventListener('click', () => {
            const axis = axisSelect.value;
            this.restoreAxisDefaults(axis);
            this.syncPaletteSelection(axis);
        });

        const swapButton = document.createElement('button');
        swapButton.type = 'button';
        swapButton.textContent = 'Swap X ↔ Y';
        swapButton.addEventListener('click', () => {
            this.swapAxesAcrossPads();
            this.syncPaletteSelection(axisSelect.value);
        });

        actions.appendChild(applyButton);
        actions.appendChild(restoreButton);
        actions.appendChild(swapButton);
        wrapper.appendChild(actions);

        axisSelect.addEventListener('change', () => {
            this.syncPaletteSelection(axisSelect.value);
        });

        this.paletteControlRefs = {
            axisSelect,
            parameterSelect,
            applyButton,
            restoreButton,
            swapButton
        };

        return { container: wrapper, axisSelect, parameterSelect };
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
            const padState = this.createPadState(index, seed.bindings, seed.modes, seed.settings);
            this.padStates.push(padState);
            this.padGrid.appendChild(padState.element);
        }

        this.updatePadSummaries();
        this.notifyMappingChange();
        this.syncPaletteSelection();
    }
    buildPadSeeds(padSeeds) {
        if (Array.isArray(padSeeds)) {
            return padSeeds.map(seed => {
                if (!seed) {
                    return { bindings: {}, modes: {}, settings: null };
                }

                const bindings = seed.bindings || seed.axisBindings || this.extractBindingsFromSeed(seed);
                const modes = seed.modes || seed.axisModes || {};
                const settings = this.extractAxisSettings(seed);

                return {
                    bindings: bindings || {},
                    modes: modes || {},
                    settings
                };
            });
        }

        return this.padStates.map(state => ({
            bindings: { ...state.axisBindings },
            modes: { ...state.axisModes },
            settings: this.cloneAxisSettings(state.axisSettings)
        }));
    }

    extractBindingsFromSeed(seed) {
        const bindings = {};
        AXES.forEach(axis => {
            if (axis in seed) {
                bindings[axis] = seed[axis];
            }
        });
        return Object.keys(bindings).length ? bindings : {};
    }

    extractAxisSettings(seed) {
        if (!seed) return null;
        const source = seed.settings || seed.axisSettings || null;
        const categories = ['curve', 'invert', 'smoothing'];
        const output = {};

        categories.forEach(category => {
            const candidate = source?.[category] ?? seed?.[category];
            if (candidate !== undefined) {
                if (candidate && typeof candidate === 'object') {
                    output[category] = { ...candidate };
                } else {
                    output[category] = candidate;
                }
            }
        });

        return Object.keys(output).length ? output : null;
    }

    cloneAxisSettings(settings = {}) {
        const cloneCategory = (category) => {
            const source = settings?.[category] || {};
            const result = {};
            AXES.forEach(axis => {
                result[axis] = source[axis];
            });
            return result;
        };

        return {
            curve: cloneCategory('curve'),
            invert: cloneCategory('invert'),
            smoothing: cloneCategory('smoothing')
        };
    }

    resolveAxisSetting(category, axis, overrides = {}, defaults = {}, fallback) {
        const overrideCategory = overrides?.[category];
        if (overrideCategory !== undefined) {
            if (typeof overrideCategory === 'object' && overrideCategory !== null && axis in overrideCategory) {
                return overrideCategory[axis];
            }
            if (typeof overrideCategory !== 'object') {
                return overrideCategory;
            }
        }

        const defaultCategory = defaults?.[category];
        if (defaultCategory !== undefined) {
            if (typeof defaultCategory === 'object' && defaultCategory !== null && axis in defaultCategory) {
                return defaultCategory[axis];
            }
            if (typeof defaultCategory !== 'object') {
                return defaultCategory;
            }
        }

        return fallback;
    }

    buildAxisSettings(overrides = {}) {
        const defaults = this.config.axis?.defaults || {};
        const smoothingDefault = this.smoothingConfig?.default ?? 0;

        const settings = {
            curve: {},
            invert: {},
            smoothing: {}
        };

        AXES.forEach(axis => {
            const curve = this.resolveAxisSetting('curve', axis, overrides, defaults, 'linear');
            const invert = this.resolveAxisSetting('invert', axis, overrides, defaults, false);
            const smoothing = this.resolveAxisSetting('smoothing', axis, overrides, defaults, smoothingDefault);

            settings.curve[axis] = (typeof curve === 'string') ? curve : 'linear';
            settings.invert[axis] = Boolean(invert);

            const numericSmoothing = typeof smoothing === 'number' ? smoothing : smoothingDefault;
            const min = this.smoothingConfig?.min ?? 0;
            const max = this.smoothingConfig?.max ?? 1;
            settings.smoothing[axis] = Math.min(Math.max(numericSmoothing, min), max);
        });

        return settings;
    }

    createPadState(index, bindings = {}, modes = {}, settings = {}) {
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
        const axisSettings = this.buildAxisSettings(settings);
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
            axisSettings,
            axisBaselines: { x: null, y: null, gesture: null },
            axisSmoothed: { x: null, y: null, gesture: null },
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

        const advancedRow = document.createElement('div');
        advancedRow.classList.add('axis-advanced-row');

        const curveWrapper = document.createElement('label');
        curveWrapper.classList.add('axis-advanced-label');
        const curveLabel = document.createElement('span');
        curveLabel.textContent = 'Curve';
        const curveSelect = document.createElement('select');
        curveSelect.classList.add('axis-curve-select');
        this.populateCurveSelect(curveSelect, padState.axisSettings.curve[axisKey]);
        curveSelect.addEventListener('change', () => {
            this.updateAxisCurve(padState, axisKey, curveSelect.value);
        });
        curveWrapper.appendChild(curveLabel);
        curveWrapper.appendChild(curveSelect);

        const invertWrapper = document.createElement('label');
        invertWrapper.classList.add('axis-invert-toggle');
        const invertInput = document.createElement('input');
        invertInput.type = 'checkbox';
        invertInput.checked = Boolean(padState.axisSettings.invert[axisKey]);
        invertInput.addEventListener('change', () => {
            this.updateAxisInvert(padState, axisKey, invertInput.checked);
        });
        const invertText = document.createElement('span');
        invertText.textContent = 'Invert';
        invertWrapper.appendChild(invertInput);
        invertWrapper.appendChild(invertText);

        const smoothingWrapper = document.createElement('div');
        smoothingWrapper.classList.add('axis-smoothing-wrapper');
        const smoothingLabel = document.createElement('span');
        smoothingLabel.textContent = 'Smooth';
        const smoothingInput = document.createElement('input');
        smoothingInput.type = 'range';
        smoothingInput.classList.add('axis-smoothing');
        smoothingInput.min = String(this.smoothingConfig.min);
        smoothingInput.max = String(this.smoothingConfig.max);
        smoothingInput.step = String(this.smoothingConfig.step);
        smoothingInput.value = String(padState.axisSettings.smoothing[axisKey]);
        const smoothingValue = document.createElement('span');
        smoothingValue.classList.add('axis-smoothing-value');
        smoothingValue.textContent = this.formatSmoothingLabel(padState.axisSettings.smoothing[axisKey]);
        smoothingInput.addEventListener('input', () => {
            const numeric = parseFloat(smoothingInput.value);
            this.updateAxisSmoothing(padState, axisKey, numeric);
            smoothingValue.textContent = this.formatSmoothingLabel(numeric);
        });
        smoothingWrapper.appendChild(smoothingLabel);
        smoothingWrapper.appendChild(smoothingInput);
        smoothingWrapper.appendChild(smoothingValue);

        advancedRow.appendChild(curveWrapper);
        advancedRow.appendChild(invertWrapper);
        advancedRow.appendChild(smoothingWrapper);

        container.appendChild(advancedRow);

        return {
            container,
            select,
            mode: modeSelect,
            curve: curveSelect,
            invert: invertInput,
            smoothing: {
                input: smoothingInput,
                display: smoothingValue
            }
        };
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

    populateCurveSelect(select, selectedValue) {
        select.innerHTML = '';
        this.curveOptions.forEach(curve => {
            const option = document.createElement('option');
            option.value = curve.value;
            option.textContent = curve.label;
            select.appendChild(option);
        });
        if (selectedValue && select.querySelector(`option[value="${selectedValue}"]`)) {
            select.value = selectedValue;
        }
    }

    updateAxisCurve(padState, axis, curve) {
        const normalized = this.curveLabelMap.has(curve) ? curve : 'linear';
        padState.axisSettings.curve[axis] = normalized;
        if (padState.activePointers.size > 0) {
            this.updatePadFromPointers(padState);
        }
        this.updatePadSummary(padState);
        this.notifyMappingChange();
    }

    updateAxisInvert(padState, axis, invert) {
        padState.axisSettings.invert[axis] = Boolean(invert);
        if (padState.activePointers.size > 0) {
            this.updatePadFromPointers(padState);
        }
        this.updatePadSummary(padState);
        this.notifyMappingChange();
    }

    updateAxisSmoothing(padState, axis, value) {
        const min = this.smoothingConfig.min ?? 0;
        const max = this.smoothingConfig.max ?? 1;
        const clamped = Math.min(Math.max(value, min), max);
        padState.axisSettings.smoothing[axis] = clamped;
        padState.axisSmoothed[axis] = null;
        if (padState.activePointers.size > 0) {
            this.updatePadFromPointers(padState);
        }
        this.updatePadSummary(padState);
        this.notifyMappingChange();
    }

    formatSmoothingLabel(value) {
        if (value <= 0) return 'Off';
        const max = this.smoothingConfig.max || 1;
        const percentage = Math.round((value / max) * 100);
        return `${percentage}%`;
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
        const processedValue = this.processNormalizedValue(padState, axis, normalizedValue);
        const binding = padState.axisBindings[axis];
        if (!binding || binding === 'none') {
            this.updateReadout(padState, axis, processedValue, true);
            return;
        }

        const def = this.parameterManager?.getParameterDefinition(binding);
        if (!def) {
            this.updateReadout(padState, axis, processedValue, true);
            return;
        }

        const mode = padState.axisModes[axis];
        let value;

        if (mode === 'absolute') {
            value = def.min + (def.max - def.min) * processedValue;
        } else if (mode === 'bipolar') {
            const center = (def.min + def.max) / 2;
            const amplitude = (def.max - def.min) / 2;
            value = center + (processedValue - 0.5) * 2 * amplitude;
        } else if (mode === 'relative') {
            const baseline = padState.axisBaselines[axis] ?? this.parameterManager.getParameter(binding) ?? ((def.min + def.max) / 2);
            const range = def.max - def.min;
            const strength = this.config.axis.relativeStrength ?? 0.4;
            const offset = (processedValue - 0.5) * range * strength;
            value = baseline + offset;
        } else {
            value = def.min + (def.max - def.min) * processedValue;
        }

        const clamped = this.parameterManager.clampToDefinition(binding, value);
        this.parameterManager.setParameter(binding, clamped, 'touchpad');
        this.updateReadout(padState, axis, clamped);
    }

    processNormalizedValue(padState, axis, rawValue) {
        if (!padState?.axisSettings) {
            return clamp01(rawValue);
        }

        let value = clamp01(rawValue);

        if (padState.axisSettings.invert[axis]) {
            value = 1 - value;
        }

        value = this.applyCurveTransform(value, padState.axisSettings.curve[axis]);

        const smoothing = padState.axisSettings.smoothing[axis];
        if (typeof smoothing === 'number' && smoothing > 0) {
            const max = this.smoothingConfig.max || 1;
            const normalizedSmoothing = Math.min(Math.max(smoothing / max, 0), 0.95);
            const previous = padState.axisSmoothed[axis];
            if (previous === null || previous === undefined) {
                padState.axisSmoothed[axis] = value;
            } else {
                value = previous + (value - previous) * (1 - normalizedSmoothing);
                padState.axisSmoothed[axis] = value;
            }
        } else {
            padState.axisSmoothed[axis] = value;
        }

        return clamp01(value);
    }

    applyCurveTransform(value, curveType) {
        const fn = CURVE_FUNCTIONS[curveType] || CURVE_FUNCTIONS.linear;
        const result = fn(clamp01(value));
        return clamp01(result);
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
        padState.axisSmoothed[axis] = null;
        this.updatePadSummary(padState);
        this.notifyMappingChange();
    }

    updateAxisMode(padState, axis, mode) {
        padState.axisModes[axis] = mode;
        this.updatePadSummary(padState);
        this.notifyMappingChange();
    }

    applyAxisBindingAcrossPads(axis, value) {
        if (!AXES.includes(axis)) return;
        this.suspendNotify = true;
        this.padStates.forEach(padState => {
            this.updateAxisBinding(padState, axis, value);
            this.syncAxisControlUI(padState, axis);
        });
        this.suspendNotify = false;
        this.updatePadSummaries();
        this.notifyMappingChange();
        this.syncPaletteSelection(axis);
    }

    restoreAxisDefaults(axis) {
        if (!AXES.includes(axis)) return;
        this.suspendNotify = true;
        this.padStates.forEach((padState, index) => {
            const defaults = this.getDefaultMapping(index);
            const fallback = defaults?.[axis] ?? (axis === 'gesture' ? 'none' : this.availableParameters[0]?.id || '');
            this.updateAxisBinding(padState, axis, fallback);
            this.syncAxisControlUI(padState, axis);
        });
        this.suspendNotify = false;
        this.updatePadSummaries();
        this.notifyMappingChange();
        this.syncPaletteSelection(axis);
    }

    swapAxesAcrossPads() {
        this.suspendNotify = true;
        this.padStates.forEach(padState => {
            const originalBindings = { ...padState.axisBindings };
            const originalModes = { ...padState.axisModes };
            const originalSettings = this.cloneAxisSettings(padState.axisSettings);

            this.updateAxisBinding(padState, 'x', originalBindings.y);
            this.updateAxisBinding(padState, 'y', originalBindings.x);
            this.updateAxisMode(padState, 'x', originalModes.y);
            this.updateAxisMode(padState, 'y', originalModes.x);

            ['curve', 'invert', 'smoothing'].forEach(category => {
                const buffer = padState.axisSettings[category].x;
                padState.axisSettings[category].x = originalSettings[category].y;
                padState.axisSettings[category].y = buffer;
            });

            padState.axisBaselines.x = null;
            padState.axisBaselines.y = null;
            padState.axisSmoothed.x = null;
            padState.axisSmoothed.y = null;

            this.syncAxisControlUI(padState, 'x');
            this.syncAxisControlUI(padState, 'y');
        });
        this.suspendNotify = false;
        this.updatePadSummaries();
        this.notifyMappingChange();
        this.syncPaletteSelection(this.paletteControlRefs?.axisSelect?.value);
    }

    syncAxisControlUI(padState, axis) {
        const control = padState.controls?.[axis];
        if (!control) return;

        if (control.select) {
            const binding = padState.axisBindings[axis];
            if (!control.select.querySelector(`option[value="${binding}"]`)) {
                const fallback = axis === 'gesture' ? 'none' : this.availableParameters[0]?.id || '';
                control.select.value = fallback;
                padState.axisBindings[axis] = fallback;
            } else {
                control.select.value = binding;
            }
        }
        if (control.mode) {
            control.mode.value = padState.axisModes[axis];
        }
        if (control.curve) {
            control.curve.value = padState.axisSettings.curve[axis];
        }
        if (control.invert) {
            control.invert.checked = !!padState.axisSettings.invert[axis];
        }
        if (control.smoothing?.input) {
            control.smoothing.input.value = padState.axisSettings.smoothing[axis];
            if (control.smoothing.display) {
                control.smoothing.display.textContent = this.formatSmoothingLabel(padState.axisSettings.smoothing[axis]);
            }
        }
    }

    syncPaletteSelection(axis = this.paletteControlRefs?.axisSelect?.value) {
        if (!axis || !this.paletteControlRefs?.parameterSelect) return;
        const allowNone = axis === 'gesture';
        const primaryPad = this.padStates[0];
        const fallback = allowNone ? 'none' : this.availableParameters[0]?.id || '';
        const value = primaryPad?.axisBindings?.[axis] ?? fallback;
        this.populateParameterSelect(this.paletteControlRefs.parameterSelect, value, allowNone);
        this.paletteControlRefs.parameterSelect.value = value;
    }

    refreshParameterOptions(metadata = null) {
        if (Array.isArray(metadata) && metadata.length) {
            this.availableParameters = metadata.map(meta => ({
                id: meta.id,
                label: meta.label || meta.name || meta.id,
                group: meta.group || meta.category || 'General',
                min: meta.min,
                max: meta.max,
                type: meta.type,
                step: meta.step,
                tags: meta.tags
            }));
        } else {
            this.availableParameters = this.buildParameterOptions();
        }

        this.parameterLabels = new Map(this.availableParameters.map(meta => [meta.id, meta.label]));
        this.suspendNotify = true;
        const snapshot = this.getMappings();
        this.renderPads(snapshot.pads);
        this.suspendNotify = false;
        this.updatePadSummaries();
        this.notifyMappingChange();
        this.syncPaletteSelection();
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
            const details = [];

            if (binding && binding !== 'none') {
                details.push(modeText);
            }

            const curve = padState.axisSettings.curve[axis];
            const curveLabel = this.curveLabelMap.get(curve);
            if (curve && curveLabel && curve !== 'linear') {
                details.push(curveLabel);
            }

            if (padState.axisSettings.invert[axis]) {
                details.push('Invert');
            }

            const smoothingValue = padState.axisSettings.smoothing[axis];
            if (typeof smoothingValue === 'number' && smoothingValue > (this.smoothingConfig.min ?? 0)) {
                details.push(`Smooth ${this.formatSmoothingLabel(smoothingValue)}`);
            }

            const detailText = details.length ? ` (${details.join(' · ')})` : '';
            return `${label}: ${bindingLabel}${detailText}`;
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
        const snapshot = this.getMappings();
        if (typeof this.onMappingChange === 'function') {
            this.onMappingChange(snapshot);
        }
        if (this.hub) {
            this.hub.emit('touchpad-mapping-change', { mappings: JSON.parse(JSON.stringify(snapshot)) });
        }
    }

    emitLayoutChange() {
        if (typeof this.onLayoutChange === 'function') {
            this.onLayoutChange({ ...this.layoutSettings, padCount: this.padCount });
        }
        if (this.hub) {
            this.hub.emit('touchpad-layout-change', {
                layout: { ...this.layoutSettings, padCount: this.padCount }
            });
        }
    }

    getMappings() {
        return {
            padCount: this.padCount,
            layout: { ...this.layoutSettings },
            pads: this.padStates.map(padState => ({
                id: padState.id,
                bindings: { ...padState.axisBindings },
                modes: { ...padState.axisModes },
                settings: this.cloneAxisSettings(padState.axisSettings)
            }))
        };
    }

    exportState() {
        return this.cloneMappings();
    }

    importState(state) {
        if (!state) return;
        this.applyMappings(state);
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

    cloneMappings() {
        return JSON.parse(JSON.stringify(this.getMappings()));
    }
}
