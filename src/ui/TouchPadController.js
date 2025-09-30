import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

const AXES = ['x', 'y', 'gesture'];

const LAYOUT_KEYS = ['minWidth', 'gap', 'aspectRatio', 'columns'];
const LAYOUT_TOLERANCES = {
    minWidth: 0.5,
    gap: 0.5,
    aspectRatio: 0.01
};

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
        this.gestureConfig = this.config.gesture || {};
        this.availableGestureModes = Array.isArray(this.gestureConfig.modes)
            ? this.gestureConfig.modes
            : [];
        this.gestureModeMap = new Map(this.availableGestureModes.map(mode => [mode.value, mode.label]));
        this.defaultGestureMode = this.normalizeGestureMode(this.gestureConfig.defaultMode);
        this.gestureVelocityScale = Number.isFinite(this.gestureConfig.velocityScale)
            ? this.gestureConfig.velocityScale
            : 2.4;
        this.gesturePressureFallback = Number.isFinite(this.gestureConfig.pressureFallback)
            ? this.gestureConfig.pressureFallback
            : 0.6;

        this.padTemplates = this.normalizePadTemplates(this.config.templates || []);
        this.templateLabelMap = new Map(this.padTemplates.map(template => [template.id, template.name]));
        this.templateHintDefault = 'Design bespoke mapping by adjusting controls.';

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

        this.layoutPresetStorageKey = 'vib34d_touchpad_layout_presets_v1';
        this.layoutPresetRefs = { select: null, deleteButton: null, hint: null };
        this.baseLayoutPresets = this.normalizeLayoutPresets(this.config.layoutPresets || [], true);
        this.customLayoutPresets = this.loadCustomLayoutPresets();
        this.composeLayoutPresets();
        this.activeLayoutPresetId = null;
        this.suspendPresetDetection = false;

        this.padStates = [];
        this.suspendNotify = false;

        this.buildUI();
        this.renderPads(resolvedMappings);
        this.applyLayoutToContainer();
        this.syncLayoutControls();
        this.refreshLayoutPresetSelection();
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

    normalizeGestureMode(mode) {
        if (mode && this.gestureModeMap.has(mode)) {
            return mode;
        }
        if (mode && typeof mode === 'string') {
            const normalized = this.availableGestureModes.find(candidate => candidate.value === mode);
            if (normalized) {
                return normalized.value;
            }
        }
        return this.availableGestureModes[0]?.value || 'spread';
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

        const presetControls = this.createLayoutPresetControls();
        if (presetControls) {
            wrapper.appendChild(presetControls);
        }

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

    createLayoutPresetControls() {
        const container = document.createElement('div');
        container.classList.add('layout-preset-controls');

        const selectWrapper = document.createElement('label');
        selectWrapper.classList.add('layout-control', 'layout-preset-select-wrap');

        const label = document.createElement('span');
        label.classList.add('layout-control-label');
        label.textContent = 'Layout Preset';

        const select = document.createElement('select');
        select.classList.add('layout-control-input', 'layout-preset-select');
        select.addEventListener('change', () => {
            const value = select.value;
            if (!value || value === '__custom') {
                this.activeLayoutPresetId = null;
                this.updateLayoutPresetHintAndActions();
                return;
            }
            if (value === this.activeLayoutPresetId) {
                return;
            }
            this.applyLayoutPreset(value);
        });

        selectWrapper.appendChild(label);
        selectWrapper.appendChild(select);
        container.appendChild(selectWrapper);

        const actions = document.createElement('div');
        actions.classList.add('layout-preset-actions');

        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.classList.add('layout-preset-save');
        saveButton.textContent = 'Save Layout';
        saveButton.addEventListener('click', () => this.promptSaveLayoutPreset());

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.classList.add('layout-preset-delete');
        deleteButton.textContent = 'Delete Preset';
        deleteButton.disabled = true;
        deleteButton.addEventListener('click', () => this.deleteActiveLayoutPreset());

        actions.appendChild(saveButton);
        actions.appendChild(deleteButton);
        container.appendChild(actions);

        const hint = document.createElement('p');
        hint.classList.add('layout-preset-hint');
        hint.textContent = 'Capture stage-specific pad layouts for quick recall.';
        container.appendChild(hint);

        this.layoutPresetRefs.select = select;
        this.layoutPresetRefs.deleteButton = deleteButton;
        this.layoutPresetRefs.hint = hint;

        this.updateLayoutPresetControlsState();

        return container;
    }

    populateLayoutPresetSelect() {
        const select = this.layoutPresetRefs.select;
        if (!select) return;

        this.composeLayoutPresets();

        const previousValue = select.value;
        select.innerHTML = '';

        const customOption = document.createElement('option');
        customOption.value = '__custom';
        customOption.textContent = 'Custom Layout';
        select.appendChild(customOption);

        if (this.baseLayoutPresets.length > 0) {
            const factoryGroup = document.createElement('optgroup');
            factoryGroup.label = 'Stage Layouts';
            this.baseLayoutPresets.forEach(preset => {
                factoryGroup.appendChild(this.createLayoutPresetOption(preset));
            });
            select.appendChild(factoryGroup);
        }

        if (this.customLayoutPresets.length > 0) {
            const customGroup = document.createElement('optgroup');
            customGroup.label = 'Saved Layouts';
            this.customLayoutPresets.forEach(preset => {
                customGroup.appendChild(this.createLayoutPresetOption(preset));
            });
            select.appendChild(customGroup);
        }

        const desiredValue = (this.activeLayoutPresetId && select.querySelector(`option[value="${this.activeLayoutPresetId}"]`))
            ? this.activeLayoutPresetId
            : (select.querySelector(`option[value="${previousValue}"]`) ? previousValue : '__custom');

        select.value = desiredValue;
    }

    createLayoutPresetOption(preset) {
        const option = document.createElement('option');
        option.value = preset.id;
        const summary = this.formatLayoutSummary(preset.layout);
        option.textContent = summary ? `${preset.name} — ${summary}` : preset.name;
        return option;
    }

    updateLayoutPresetSelect() {
        const select = this.layoutPresetRefs.select;
        if (!select) return;
        const target = this.activeLayoutPresetId && select.querySelector(`option[value="${this.activeLayoutPresetId}"]`)
            ? this.activeLayoutPresetId
            : '__custom';
        if (select.value !== target) {
            select.value = target;
        }
    }

    updateLayoutPresetHintAndActions() {
        const preset = this.layoutPresets?.find(item => item.id === this.activeLayoutPresetId) || null;

        if (this.layoutPresetRefs.deleteButton) {
            const deletable = Boolean(preset) && !preset.builtIn;
            this.layoutPresetRefs.deleteButton.disabled = !deletable;
            this.layoutPresetRefs.deleteButton.title = deletable
                ? 'Remove this saved layout preset'
                : 'Only custom layouts can be deleted';
        }

        if (this.layoutPresetRefs.hint) {
            const summarySource = preset?.layout || this.getCurrentLayoutDefinition();
            const summary = this.formatLayoutSummary(summarySource);
            if (preset) {
                const description = preset.description && preset.description.length ? preset.description : null;
                this.layoutPresetRefs.hint.textContent = description
                    ? `${description}${summary ? ` (${summary})` : ''}`
                    : summary || 'Preset layout applied.';
            } else {
                this.layoutPresetRefs.hint.textContent = summary
                    ? `Custom layout — ${summary}`
                    : 'Custom layout — adjust controls to suit the venue.';
            }
        }
    }

    updateLayoutPresetControlsState() {
        this.populateLayoutPresetSelect();
        this.updateLayoutPresetSelect();
        this.updateLayoutPresetHintAndActions();
    }

    formatLayoutSummary(layout = {}) {
        if (!layout) return '';
        const parts = [];
        const padCount = Number.isFinite(layout.padCount) ? layout.padCount : this.padCount;
        if (Number.isFinite(padCount)) {
            parts.push(`${padCount} ${padCount === 1 ? 'pad' : 'pads'}`);
        }
        const columns = layout.columns ?? this.layoutSettings.columns ?? 'auto';
        if (columns === 'auto') {
            parts.push('Auto columns');
        } else if (Number.isFinite(columns)) {
            parts.push(`${columns} ${columns === 1 ? 'column' : 'columns'}`);
        }
        if (Number.isFinite(layout.minWidth)) {
            parts.push(`${Math.round(layout.minWidth)}px`);
        }
        if (Number.isFinite(layout.gap)) {
            parts.push(`${Math.round(layout.gap)}px gap`);
        }
        if (Number.isFinite(layout.aspectRatio)) {
            parts.push(`AR ${layout.aspectRatio.toFixed(2)}`);
        }
        return parts.join(' · ');
    }

    getCurrentLayoutDefinition() {
        return {
            padCount: this.padCount,
            minWidth: this.layoutSettings.minWidth,
            gap: this.layoutSettings.gap,
            aspectRatio: this.layoutSettings.aspectRatio,
            columns: this.layoutSettings.columns ?? 'auto'
        };
    }

    generateSuggestedLayoutPresetName() {
        const padCount = this.padCount;
        const columns = this.layoutSettings.columns ?? 'auto';
        const columnLabel = columns === 'auto' ? 'Auto Grid' : `${columns} Col`;
        return `${padCount} Pads · ${columnLabel}`;
    }

    promptSaveLayoutPreset() {
        if (typeof window === 'undefined') {
            return;
        }
        const suggested = this.generateSuggestedLayoutPresetName();
        const name = window.prompt('Name for this layout preset?', suggested);
        if (!name) return;
        this.saveLayoutPreset(name);
    }

    saveLayoutPreset(name) {
        const trimmed = typeof name === 'string' ? name.trim() : '';
        if (!trimmed) return;

        const layout = this.normalizeLayoutDefinition(this.getCurrentLayoutDefinition());
        const existing = this.customLayoutPresets.find(preset => preset.name.toLowerCase() === trimmed.toLowerCase());

        if (existing) {
            existing.layout = layout;
            this.activeLayoutPresetId = existing.id;
        } else {
            const id = this.generateLayoutPresetId(trimmed);
            const preset = {
                id,
                name: trimmed,
                description: '',
                layout,
                builtIn: false
            };
            this.customLayoutPresets.push(preset);
            this.activeLayoutPresetId = id;
        }

        this.persistCustomLayoutPresets();
        this.composeLayoutPresets();
        this.updateLayoutPresetControlsState();
        this.refreshLayoutPresetSelection();
    }

    deleteActiveLayoutPreset() {
        if (!this.activeLayoutPresetId) return;
        const preset = this.customLayoutPresets.find(item => item.id === this.activeLayoutPresetId);
        if (!preset) return;

        if (typeof window !== 'undefined') {
            const confirmed = window.confirm(`Delete layout preset "${preset.name}"?`);
            if (!confirmed) return;
        }

        this.customLayoutPresets = this.customLayoutPresets.filter(item => item.id !== this.activeLayoutPresetId);
        this.persistCustomLayoutPresets();
        this.composeLayoutPresets();
        this.activeLayoutPresetId = null;
        this.updateLayoutPresetControlsState();
        this.refreshLayoutPresetSelection();
    }

    applyLayoutPreset(presetId) {
        const preset = this.layoutPresets.find(item => item.id === presetId);
        if (!preset) return;

        this.withPresetRefreshSuspended(() => {
            LAYOUT_KEYS.forEach(key => {
                if (preset.layout[key] !== undefined) {
                    this.updateLayoutSetting(key, preset.layout[key], { notify: false });
                }
            });
            if (preset.layout.padCount !== undefined) {
                this.setPadCount(preset.layout.padCount, { notify: false });
            }
        });

        this.activeLayoutPresetId = presetId;
        this.syncLayoutControls();
        this.updateLayoutPresetControlsState();
        this.emitLayoutChange();
    }

    withPresetRefreshSuspended(callback) {
        const previous = this.suspendPresetDetection;
        this.suspendPresetDetection = true;
        try {
            callback();
        } finally {
            this.suspendPresetDetection = previous;
        }
        if (!previous) {
            this.refreshLayoutPresetSelection();
        }
    }

    refreshLayoutPresetSelection() {
        if (this.suspendPresetDetection) return;
        const match = this.matchLayoutToPreset(this.layoutSettings, this.padCount);
        this.activeLayoutPresetId = match;
        this.updateLayoutPresetControlsState();
    }

    matchLayoutToPreset(layout, padCount) {
        if (!Array.isArray(this.layoutPresets) || this.layoutPresets.length === 0) {
            return null;
        }

        for (const preset of this.layoutPresets) {
            if (this.layoutsAreEquivalent(preset.layout, layout, padCount)) {
                return preset.id;
            }
        }
        return null;
    }

    layoutsAreEquivalent(presetLayout = {}, layout = {}, padCount = this.padCount) {
        if (presetLayout.padCount !== undefined) {
            if (this.normalizePadCount(presetLayout.padCount) !== this.normalizePadCount(padCount)) {
                return false;
            }
        }

        for (const key of LAYOUT_KEYS) {
            if (presetLayout[key] === undefined) continue;
            if (key === 'columns') {
                const presetColumns = presetLayout[key] === 'auto'
                    ? 'auto'
                    : parseInt(presetLayout[key], 10);
                let currentColumns;
                if (layout[key] === undefined) {
                    currentColumns = this.layoutSettings.columns ?? 'auto';
                } else if (layout[key] === 'auto') {
                    currentColumns = 'auto';
                } else {
                    currentColumns = parseInt(layout[key], 10);
                }
                if (presetColumns !== currentColumns) {
                    return false;
                }
                continue;
            }

            const tolerance = LAYOUT_TOLERANCES[key] ?? 0;
            const currentValue = layout[key];
            if (!this.numbersAreClose(presetLayout[key], currentValue, tolerance)) {
                return false;
            }
        }

        return true;
    }

    numbersAreClose(a, b, tolerance = 0.0001) {
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
            return false;
        }
        return Math.abs(a - b) <= tolerance;
    }

    normalizeLayoutDefinition(definition = {}) {
        if (!definition || typeof definition !== 'object') {
            return {};
        }

        const normalized = {};

        if (definition.padCount !== undefined) {
            normalized.padCount = this.normalizePadCount(definition.padCount);
        }

        LAYOUT_KEYS.forEach(key => {
            if (definition[key] === undefined) return;
            const value = this.normalizeLayoutValue(key, definition[key]);
            if (value !== undefined) {
                normalized[key] = value;
            }
        });

        return normalized;
    }

    normalizeLayoutValue(key, value) {
        if (value === undefined || value === null) return undefined;

        if (key === 'columns') {
            if (value === 'auto') {
                return 'auto';
            }
            const numeric = parseInt(value, 10);
            return Number.isFinite(numeric) && numeric > 0 ? numeric : 'auto';
        }

        const numeric = parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return undefined;
        }

        if (key === 'minWidth') {
            const minBound = this.config.layout?.minWidth ?? 160;
            const maxBound = this.config.layout?.maxWidth ?? Math.max(minBound, numeric);
            return Math.max(minBound, Math.min(maxBound, numeric));
        }

        if (key === 'gap') {
            const minGap = 0;
            const maxGap = this.config.layout?.maxGap ?? 96;
            return Math.max(minGap, Math.min(maxGap, numeric));
        }

        if (key === 'aspectRatio') {
            const minAspect = this.config.layout?.minAspect ?? 0.5;
            const maxAspect = this.config.layout?.maxAspect ?? 2;
            return Math.max(minAspect, Math.min(maxAspect, numeric));
        }

        return numeric;
    }

    normalizeLayoutPresets(presets, builtIn = false) {
        if (!Array.isArray(presets)) return [];
        return presets
            .map((preset, index) => {
                if (!preset) return null;
                const name = typeof preset.name === 'string' && preset.name.trim().length
                    ? preset.name.trim()
                    : `Layout ${index + 1}`;
                const id = typeof preset.id === 'string' && preset.id.trim().length
                    ? preset.id.trim()
                    : `${builtIn ? 'builtin' : 'user'}-${index}`;
                const description = typeof preset.description === 'string'
                    ? preset.description.trim()
                    : '';
                const layout = this.normalizeLayoutDefinition(preset.layout || preset.settings || {});
                return {
                    id,
                    name,
                    description,
                    layout,
                    builtIn
                };
            })
            .filter(Boolean);
    }

    normalizePadTemplates(templates) {
        if (!Array.isArray(templates)) return [];
        return templates
            .map((template, index) => {
                if (!template) return null;

                const id = typeof template.id === 'string' && template.id.trim().length
                    ? template.id.trim()
                    : `template-${index}`;
                const name = typeof template.name === 'string' && template.name.trim().length
                    ? template.name.trim()
                    : `Template ${index + 1}`;
                const description = typeof template.description === 'string'
                    ? template.description.trim()
                    : '';

                const bindings = {};
                AXES.forEach(axis => {
                    const candidate = template.bindings?.[axis]
                        ?? template.axisBindings?.[axis]
                        ?? template[axis]
                        ?? 'none';
                    bindings[axis] = candidate || candidate === '' ? candidate : 'none';
                });

                const modes = {};
                AXES.forEach(axis => {
                    const candidate = template.modes?.[axis]
                        ?? template.axisModes?.[axis]
                        ?? this.config.axis?.defaultModes?.[axis]
                        ?? 'absolute';
                    modes[axis] = candidate;
                });

                const settings = this.buildAxisSettings(template.settings || template.axisSettings || {});
                const gestureMode = this.normalizeGestureMode(
                    template.gestureMode
                    || template.gesture?.mode
                    || template.settings?.gestureMode
                );

                return {
                    id,
                    name,
                    description,
                    bindings,
                    modes,
                    settings,
                    gestureMode
                };
            })
            .filter(Boolean);
    }

    getTemplateById(templateId) {
        if (!templateId) return null;
        return this.padTemplates.find(template => template.id === templateId) || null;
    }

    getTemplateLabel(templateId) {
        if (!templateId) return '';
        return this.templateLabelMap.get(templateId) || '';
    }

    listTemplates() {
        return this.padTemplates.map(template => ({
            id: template.id,
            name: template.name,
            description: template.description
        }));
    }

    composeLayoutPresets() {
        this.layoutPresets = [
            ...(Array.isArray(this.baseLayoutPresets) ? this.baseLayoutPresets : []),
            ...(Array.isArray(this.customLayoutPresets) ? this.customLayoutPresets : [])
        ];
        return this.layoutPresets;
    }

    loadCustomLayoutPresets() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return [];
        }
        try {
            const stored = window.localStorage.getItem(this.layoutPresetStorageKey);
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            return this.normalizeLayoutPresets(parsed, false);
        } catch (error) {
            console.warn('TouchPadController: unable to load layout presets', error);
            return [];
        }
    }

    persistCustomLayoutPresets() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        try {
            const payload = this.customLayoutPresets.map(preset => ({
                id: preset.id,
                name: preset.name,
                description: preset.description,
                layout: preset.layout
            }));
            window.localStorage.setItem(this.layoutPresetStorageKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('TouchPadController: unable to persist layout presets', error);
        }
    }

    generateLayoutPresetId(name) {
        const base = typeof name === 'string' && name.trim().length ? name.trim().toLowerCase() : 'layout';
        const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'layout';
        const existing = new Set((this.layoutPresets || []).map(preset => preset.id));
        let candidate = `user-${slug}`;
        let attempt = 1;
        while (existing.has(candidate)) {
            candidate = `user-${slug}-${attempt++}`;
        }
        return candidate;
    }

    renderPads(padSeeds = null) {
        if (!this.padGrid) return;

        const seeds = this.buildPadSeeds(padSeeds);
        this.padGrid.innerHTML = '';
        this.padStates = [];

        for (let index = 0; index < this.padCount; index++) {
            const seed = seeds[index] || {};
            const padState = this.createPadState(index, seed.bindings, seed.modes, seed.settings, seed);
            this.padStates.push(padState);
            this.padGrid.appendChild(padState.element);
        }

        this.updatePadSummaries();
        this.notifyMappingChange();
    }
    buildPadSeeds(padSeeds) {
        if (Array.isArray(padSeeds)) {
            return padSeeds.map(seed => {
                if (!seed) {
                    return { bindings: {}, modes: {}, settings: null, gestureMode: this.defaultGestureMode };
                }

                const bindings = seed.bindings || seed.axisBindings || this.extractBindingsFromSeed(seed);
                const modes = seed.modes || seed.axisModes || {};
                const settings = this.extractAxisSettings(seed);
                const gestureMode = this.resolveGestureModeFromSeed(seed);
                const templateId = this.resolveTemplateAssignment(seed.templateId, {
                    axisBindings: bindings || {},
                    axisModes: modes || {},
                    axisSettings: settings ? this.buildAxisSettings(settings) : this.buildAxisSettings({}),
                    gestureMode
                });

                return {
                    bindings: bindings || {},
                    modes: modes || {},
                    settings,
                    gestureMode,
                    templateId
                };
            });
        }

        return this.padStates.map(state => ({
            bindings: { ...state.axisBindings },
            modes: { ...state.axisModes },
            settings: this.cloneAxisSettings(state.axisSettings),
            gestureMode: state.gestureMode,
            templateId: state.templateId || null
        }));
    }

    resolveTemplateAssignment(seedTemplateId, padLikeState) {
        if (!padLikeState) return null;
        const explicit = this.getTemplateById(seedTemplateId);
        if (explicit && this.doesPadMatchTemplate(padLikeState, explicit)) {
            return explicit.id;
        }

        const match = this.padTemplates.find(template => this.doesPadMatchTemplate(padLikeState, template));
        return match ? match.id : null;
    }

    doesPadMatchTemplate(padState, template) {
        if (!padState || !template) return false;
        const settings = template.settings || {};
        return AXES.every(axis => {
            const binding = template.bindings?.[axis];
            if (binding !== undefined && binding !== padState.axisBindings?.[axis]) {
                return false;
            }

            const mode = template.modes?.[axis];
            if (mode !== undefined && mode !== padState.axisModes?.[axis]) {
                return false;
            }

            const curve = settings.curve?.[axis];
            if (curve && padState.axisSettings?.curve?.[axis] && padState.axisSettings.curve[axis] !== curve) {
                return false;
            }

            const invert = settings.invert?.[axis];
            if (typeof invert === 'boolean' && padState.axisSettings?.invert?.[axis] !== invert) {
                return false;
            }

            const smoothing = settings.smoothing?.[axis];
            if (typeof smoothing === 'number') {
                const current = padState.axisSettings?.smoothing?.[axis];
                if (typeof current !== 'number' || !this.areNumbersClose(current, smoothing, 0.015)) {
                    return false;
                }
            }

            return true;
        }) && (() => {
            const templateGesture = template.gestureMode ? this.normalizeGestureMode(template.gestureMode) : null;
            if (!templateGesture) return true;
            return padState.gestureMode === templateGesture;
        })();
    }

    areNumbersClose(a, b, tolerance = 0.01) {
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
            return false;
        }
        return Math.abs(a - b) <= tolerance;
    }

    detectTemplateForPad(padState) {
        if (!padState || padState.applyingTemplate) return;
        const match = this.padTemplates.find(template => this.doesPadMatchTemplate(padState, template)) || null;

        const templateId = match ? match.id : null;
        if (padState.templateId !== templateId) {
            padState.templateId = templateId;
        }
        this.updateTemplateControl(padState, match);
    }

    ensureSelectValue(select, value, label) {
        if (!select || value === undefined || value === null) return;
        if (!select.querySelector(`option[value="${value}"]`)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label || value;
            select.appendChild(option);
        }
        select.value = value;
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

    resolveGestureModeFromSeed(seed = {}) {
        const candidate = seed?.gestureMode
            || seed?.gesture?.mode
            || seed?.settings?.gestureMode
            || this.gestureConfig.defaultMode
            || this.defaultGestureMode;
        return this.normalizeGestureMode(candidate);
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

    createPadState(index, bindings = {}, modes = {}, settings = {}, extras = {}) {
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
        const gestureMode = this.normalizeGestureMode(
            extras?.gestureMode
            || extras?.gesture?.mode
            || settings?.gestureMode
            || this.gestureConfig.defaultMode
        );
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
            centroid: { x: 0.5, y: 0.5 },
            previousCentroid: null,
            previousTimestamp: null,
            gestureMode,
            templateId: null,
            applyingTemplate: false
        };

        padState.templateId = this.resolveTemplateAssignment(extras?.templateId, padState);

        const templateControl = this.createTemplateControl(padState);
        if (templateControl) {
            padState.controls.template = templateControl;
            mappingContainer.appendChild(templateControl.container);
        }

        padState.controls.x = this.createAxisControl('X Axis', 'x', padState);
        padState.controls.y = this.createAxisControl('Y Axis', 'y', padState);
        padState.controls.gesture = this.createAxisControl('Gesture', 'gesture', padState, true);

        mappingContainer.appendChild(padState.controls.x.container);
        mappingContainer.appendChild(padState.controls.y.container);
        mappingContainer.appendChild(padState.controls.gesture.container);

        this.updateTemplateControl(padState, this.getTemplateById(padState.templateId));

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
        let gestureSelect = null;
        if (axisKey === 'gesture' && this.availableGestureModes.length > 0) {
            const gestureWrapper = document.createElement('label');
            gestureWrapper.classList.add('axis-advanced-label', 'axis-gesture-mode');
            const gestureLabel = document.createElement('span');
            gestureLabel.textContent = 'Interpret';
            gestureSelect = document.createElement('select');
            gestureSelect.classList.add('axis-gesture-select');
            this.populateGestureModeSelect(gestureSelect, padState.gestureMode);
            gestureSelect.addEventListener('change', () => {
                this.updateGestureInterpretation(padState, gestureSelect.value);
            });
            gestureWrapper.appendChild(gestureLabel);
            gestureWrapper.appendChild(gestureSelect);
            advancedRow.appendChild(gestureWrapper);
        }

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
            },
            gestureMode: gestureSelect
        };
    }

    createTemplateControl(padState) {
        if (!this.padTemplates.length) return null;

        const container = document.createElement('div');
        container.classList.add('pad-template-control');

        const label = document.createElement('span');
        label.classList.add('pad-template-label');
        label.textContent = 'Template';

        const select = document.createElement('select');
        select.classList.add('pad-template-select');
        this.populateTemplateSelect(select, padState.templateId);
        select.addEventListener('change', () => {
            this.handleTemplateSelection(padState, select.value);
        });

        const description = document.createElement('p');
        description.classList.add('pad-template-description');

        container.appendChild(label);
        container.appendChild(select);
        container.appendChild(description);

        return { container, select, description };
    }

    populateTemplateSelect(select, selectedValue = null) {
        if (!select) return;
        select.innerHTML = '';

        const customOption = document.createElement('option');
        customOption.value = '__custom';
        customOption.textContent = 'Custom Setup';
        select.appendChild(customOption);

        this.padTemplates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            select.appendChild(option);
        });

        if (selectedValue && this.getTemplateById(selectedValue)) {
            select.value = selectedValue;
        } else {
            select.value = '__custom';
        }
    }

    handleTemplateSelection(padState, value) {
        if (!padState) return;
        if (!value || value === '__custom') {
            this.clearTemplateAssignment(padState);
            return;
        }

        const template = this.getTemplateById(value);
        if (!template) {
            this.clearTemplateAssignment(padState);
            return;
        }

        this.applyTemplateToPad(padState, template.id);
    }

    clearTemplateAssignment(padState, notify = true) {
        if (!padState) return;
        padState.templateId = null;
        this.updateTemplateControl(padState, null);
        this.updatePadSummary(padState);
        if (notify) {
            this.notifyMappingChange();
        }
    }

    updateTemplateControl(padState, template = null) {
        if (!padState) return;
        const control = padState.controls?.template;
        if (!control) return;

        const selectValue = template?.id || padState.templateId || '__custom';
        if (control.select) {
            this.ensureSelectValue(control.select, '__custom', 'Custom Setup');
            if (template) {
                this.ensureSelectValue(control.select, template.id, template.name);
                control.select.value = template.id;
            } else if (padState.templateId) {
                const resolved = this.getTemplateById(padState.templateId);
                if (resolved) {
                    this.ensureSelectValue(control.select, resolved.id, resolved.name);
                    control.select.value = resolved.id;
                } else {
                    control.select.value = '__custom';
                }
            } else {
                control.select.value = '__custom';
            }
        }

        if (control.description) {
            if (template) {
                control.description.textContent = template.description || '';
            } else if (padState.templateId) {
                const resolved = this.getTemplateById(padState.templateId);
                control.description.textContent = resolved?.description || this.templateHintDefault;
            } else {
                control.description.textContent = this.templateHintDefault;
            }
        }
    }

    applyTemplateToPad(padState, templateId) {
        const template = this.getTemplateById(templateId);
        if (!padState || !template) {
            this.clearTemplateAssignment(padState);
            return;
        }

        const previousSuspend = this.suspendNotify;
        padState.applyingTemplate = true;
        this.suspendNotify = true;

        AXES.forEach(axis => {
            const binding = template.bindings?.[axis] ?? padState.axisBindings[axis];
            if (binding !== undefined) {
                this.ensureSelectValue(padState.controls?.[axis]?.select, binding, this.getParameterLabel(binding));
                this.updateAxisBinding(padState, axis, binding);
            }

            const mode = template.modes?.[axis] ?? padState.axisModes[axis];
            if (mode !== undefined) {
                this.ensureSelectValue(padState.controls?.[axis]?.mode, mode, this.modeLabelMap.get(mode) || mode);
                this.updateAxisMode(padState, axis, mode);
            }

            const curve = template.settings?.curve?.[axis];
            if (curve) {
                this.ensureSelectValue(padState.controls?.[axis]?.curve, curve, this.curveLabelMap.get(curve) || curve);
                this.updateAxisCurve(padState, axis, curve);
            }

            const invert = template.settings?.invert?.[axis];
            if (padState.controls?.[axis]?.invert) {
                padState.controls[axis].invert.checked = Boolean(invert);
            }
            if (typeof invert === 'boolean') {
                this.updateAxisInvert(padState, axis, invert);
            }

            const smoothing = template.settings?.smoothing?.[axis];
            if (typeof smoothing === 'number' && padState.controls?.[axis]?.smoothing) {
                padState.controls[axis].smoothing.input.value = String(smoothing);
                padState.controls[axis].smoothing.display.textContent = this.formatSmoothingLabel(smoothing);
                this.updateAxisSmoothing(padState, axis, smoothing);
            }
        });

        if (template.gestureMode) {
            if (padState.controls?.gesture?.gestureMode) {
                this.ensureSelectValue(
                    padState.controls.gesture.gestureMode,
                    template.gestureMode,
                    this.formatGestureModeLabel(template.gestureMode)
                );
            }
            this.updateGestureInterpretation(padState, template.gestureMode);
        }

        padState.applyingTemplate = false;
        this.suspendNotify = previousSuspend;
        padState.templateId = template.id;
        this.updateTemplateControl(padState, template);
        this.updatePadSummary(padState);
        this.notifyMappingChange();
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

    populateGestureModeSelect(select, selectedValue) {
        select.innerHTML = '';
        this.availableGestureModes.forEach(mode => {
            const option = document.createElement('option');
            option.value = mode.value;
            option.textContent = mode.label;
            select.appendChild(option);
        });
        const normalized = this.normalizeGestureMode(selectedValue);
        if (select.querySelector(`option[value="${normalized}"]`)) {
            select.value = normalized;
        }
    }

    updateAxisCurve(padState, axis, curve) {
        const normalized = this.curveLabelMap.has(curve) ? curve : 'linear';
        padState.axisSettings.curve[axis] = normalized;
        if (padState.activePointers.size > 0) {
            this.updatePadFromPointers(padState);
        }
        if (!padState.applyingTemplate) {
            this.detectTemplateForPad(padState);
        }
        this.updatePadSummary(padState);
        this.notifyMappingChange();
    }

    updateAxisInvert(padState, axis, invert) {
        padState.axisSettings.invert[axis] = Boolean(invert);
        if (padState.activePointers.size > 0) {
            this.updatePadFromPointers(padState);
        }
        if (!padState.applyingTemplate) {
            this.detectTemplateForPad(padState);
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
        if (!padState.applyingTemplate) {
            this.detectTemplateForPad(padState);
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

    formatGestureModeLabel(mode) {
        if (!mode) return '';
        if (this.gestureModeMap.has(mode)) {
            return this.gestureModeMap.get(mode);
        }
        return mode.charAt(0).toUpperCase() + mode.slice(1);
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

        if (padState.activePointers.size === 1) {
            padState.previousCentroid = { ...point };
            padState.previousTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
        }

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
            padState.previousCentroid = null;
            padState.previousTimestamp = null;
        } else {
            this.updatePadFromPointers(padState);
        }
    }

    eventToPoint(event, surface) {
        const rect = surface.getBoundingClientRect();
        const x = clamp01((event.clientX - rect.left) / rect.width);
        const y = clamp01((event.clientY - rect.top) / rect.height);
        const fallback = Number.isFinite(this.gesturePressureFallback) ? this.gesturePressureFallback : 0.6;
        const pressureFallback = event.pointerType === 'mouse'
            ? (event.buttons ? Math.min(1, fallback + 0.2) : fallback)
            : fallback;
        const pressure = (typeof event.pressure === 'number' && event.pressure > 0)
            ? event.pressure
            : pressureFallback;
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
        const gestureValue = this.calculateGestureValue(padState, points, centroid);

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

    calculateGestureValue(padState, points, centroid) {
        const mode = padState.gestureMode || this.defaultGestureMode;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

        if (mode === 'pressure') {
            const fallback = Number.isFinite(this.gesturePressureFallback) ? this.gesturePressureFallback : 0.6;
            const total = points.reduce((sum, point) => sum + (typeof point.pressure === 'number' ? point.pressure : fallback), 0);
            const average = total / Math.max(points.length, 1);
            padState.previousCentroid = { ...centroid };
            padState.previousTimestamp = now;
            return clamp01(average);
        }

        if (mode === 'velocity') {
            const previous = padState.previousCentroid || centroid;
            const deltaTime = Math.max(1, now - (padState.previousTimestamp ?? now));
            const dx = centroid.x - previous.x;
            const dy = centroid.y - previous.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const seconds = deltaTime / 1000;
            const speed = seconds > 0 ? distance / seconds : 0;
            const scaled = speed * (this.gestureVelocityScale || 1);
            padState.previousCentroid = { ...centroid };
            padState.previousTimestamp = now;
            return clamp01(scaled);
        }

        if (points.length <= 1) {
            const fallback = Number.isFinite(this.gesturePressureFallback) ? this.gesturePressureFallback : 0.5;
            const pressure = points[0]?.pressure ?? fallback;
            padState.previousCentroid = { ...centroid };
            padState.previousTimestamp = now;
            return clamp01(pressure);
        }

        const distances = points.map(point => {
            const dx = point.x - centroid.x;
            const dy = point.y - centroid.y;
            return Math.sqrt(dx * dx + dy * dy);
        });

        const average = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
        const { minimumSpread = 0.05, maximumSpread = 0.65 } = this.gestureConfig || {};
        const normalized = (average - minimumSpread) / (maximumSpread - minimumSpread || 1);
        padState.previousCentroid = { ...centroid };
        padState.previousTimestamp = now;
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
        if (!padState.applyingTemplate) {
            this.detectTemplateForPad(padState);
        }
        this.updatePadSummary(padState);
        this.notifyMappingChange();
    }

    updateAxisMode(padState, axis, mode) {
        padState.axisModes[axis] = mode;
        if (!padState.applyingTemplate) {
            this.detectTemplateForPad(padState);
        }
        this.updatePadSummary(padState);
        this.notifyMappingChange();
    }

    updateGestureInterpretation(padState, mode) {
        const normalized = this.normalizeGestureMode(mode);
        padState.gestureMode = normalized;
        padState.previousCentroid = null;
        padState.previousTimestamp = null;
        if (padState.controls?.gesture?.gestureMode) {
            const select = padState.controls.gesture.gestureMode;
            if (select && select.value !== normalized && select.querySelector(`option[value="${normalized}"]`)) {
                select.value = normalized;
            }
        }
        if (padState.activePointers.size > 0) {
            this.updatePadFromPointers(padState);
        }
        if (!padState.applyingTemplate) {
            this.detectTemplateForPad(padState);
        }
        this.updatePadSummary(padState);
        this.notifyMappingChange();
    }

    updatePadSummaries() {
        this.padStates.forEach(padState => this.updatePadSummary(padState));
    }

    updatePadSummary(padState) {
        if (!padState?.summary) return;
        const fragments = [];
        const templateLabel = this.getTemplateLabel(padState.templateId);
        if (templateLabel) {
            fragments.push(`Template: ${templateLabel}`);
        } else if (this.padTemplates.length) {
            fragments.push('Template: Custom Setup');
        }

        const axisFragments = AXES.map(axis => {
            const label = axis === 'x' ? 'X' : axis === 'y' ? 'Y' : 'Gesture';
            const binding = padState.axisBindings[axis];
            const bindingLabel = this.getParameterLabel(binding);
            const modeLabel = padState.axisModes[axis];
            const modeText = this.modeLabelMap.get(modeLabel) || modeLabel;
            const details = [];

            if (axis === 'gesture') {
                const interpretation = this.formatGestureModeLabel(padState.gestureMode);
                if (interpretation) {
                    details.push(interpretation);
                }
            }

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
        padState.summary.textContent = [...fragments, ...axisFragments].join(' · ');
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

    setPadCount(count, options = {}) {
        const { notify = true } = options;
        const normalized = this.normalizePadCount(count);
        if (normalized === this.padCount) {
            this.syncLayoutControls();
            this.refreshLayoutPresetSelection();
            return;
        }
        this.padCount = normalized;
        this.renderPads();
        this.syncLayoutControls();
        this.refreshLayoutPresetSelection();
        if (notify) {
            this.emitLayoutChange();
        }
    }

    updateLayoutSetting(key, value, options = {}) {
        const { notify = true } = options;
        const normalized = this.normalizeLayoutValue(key, value);
        if (normalized === undefined) return;

        this.layoutSettings[key] = normalized;
        this.updateLayoutDisplay(key, normalized);
        this.applyLayoutToContainer();

        if (!this.suspendPresetDetection) {
            this.refreshLayoutPresetSelection();
        }

        if (notify) {
            this.emitLayoutChange();
        }
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
                settings: this.cloneAxisSettings(padState.axisSettings),
                gestureMode: padState.gestureMode,
                templateId: padState.templateId || null
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
            const layoutDefinition = this.normalizeLayoutDefinition(normalized.layout);
            this.layoutSettings = {
                ...this.layoutSettings,
                ...layoutDefinition
            };
            this.applyLayoutToContainer();
        }

        if (normalized.padCount !== undefined) {
            this.padCount = this.normalizePadCount(normalized.padCount);
        }

        this.renderPads(normalized.padSeeds);
        this.suspendNotify = false;
        this.syncLayoutControls();
        this.refreshLayoutPresetSelection();
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
