import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

const CURVE_OPTIONS = [
    { id: 'linear', label: 'Linear' },
    { id: 'ease-in', label: 'Ease In' },
    { id: 'ease-out', label: 'Ease Out' },
    { id: 'ease-in-out', label: 'Ease In/Out' },
    { id: 'expo', label: 'Exponential' },
    { id: 'sine', label: 'Sine Wave' }
];

const CUSTOM_TEMPLATE_ID = 'custom';
const CUSTOM_LAYOUT_ID = 'custom';
const CUSTOM_TEMPLATE_LABEL = 'Custom mapping';
const CUSTOM_TEMPLATE_DESCRIPTION = 'Design your own mapping for improvised gestures.';
const CUSTOM_LAYOUT_DESCRIPTION = 'Dial in pad spacing to match any rig or touchscreen.';
const DEFAULT_MAX_PAD_COUNT = 6;

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
        this.parameterLookup = new Map(this.parameterOptions.map(option => [option.id, option]));
        this.availableParameterTags = this.buildAvailableParameterTags();
        this.parameterFilter = '';
        this.activeTagFilters = new Set();
        this.parameterSelectRefs = new Set();
        this.parameterFilterRefs = null;
        const maxPads = Math.max(1, toNumber(this.config.maxPadCount, DEFAULT_MAX_PAD_COUNT));
        this.padCount = Math.min(Math.max(1, this.config.padCount || 3), maxPads);
        this.padCountControlRef = null;
        this.pads = [];
        this.grid = null;
        this.layoutSettings = this.buildLayoutSettings();
        this.layoutControlRefs = {};
        this.layoutPresetRefs = null;
        this.templates = this.buildTemplates();
        this.templateIndex = new Map(this.templates.map(template => [template.id, template]));
        this.layoutPresets = this.buildLayoutPresets();
        this.layoutPresetIndex = new Map(this.layoutPresets.map(preset => [preset.id, preset]));
        this.activeLayoutPresetId = this.detectLayoutPresetId();
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

    buildAvailableParameterTags() {
        const tagSet = new Set();
        this.parameterOptions.forEach(option => {
            if (!Array.isArray(option.tags)) return;
            option.tags.forEach(tag => {
                if (typeof tag === 'string' && tag.trim()) {
                    tagSet.add(tag.trim());
                }
            });
        });
        return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
    }

    buildLayoutSettings() {
        const layout = this.config.layout || {};
        return {
            minWidth: toNumber(layout.minWidth, 220),
            gap: toNumber(layout.gap, 12),
            aspectRatio: toNumber(layout.aspectRatio, 1)
        };
    }

    buildTemplates() {
        if (!Array.isArray(this.config.templates)) {
            return [];
        }
        return this.config.templates.map(template => {
            const base = template?.mapping || {};
            const normalized = this.normaliseMapping({
                ...base,
                label: base.label || template.label || ''
            });
            return {
                id: template.id,
                label: template.label,
                description: template.description,
                mapping: normalized
            };
        });
    }

    buildLayoutPresets() {
        if (!Array.isArray(this.config.layoutPresets)) {
            return [];
        }
        return this.config.layoutPresets.map(preset => ({
            id: preset.id,
            label: preset.label,
            description: preset.description,
            settings: {
                minWidth: toNumber(preset.settings?.minWidth, this.layoutSettings.minWidth),
                gap: toNumber(preset.settings?.gap, this.layoutSettings.gap),
                aspectRatio: toNumber(preset.settings?.aspectRatio, this.layoutSettings.aspectRatio)
            }
        }));
    }

    detectLayoutPresetId() {
        const match = this.layoutPresets.find(preset => this.layoutMatchesPreset(preset.settings));
        return match ? match.id : CUSTOM_LAYOUT_ID;
    }

    layoutMatchesPreset(settings = {}) {
        if (!settings) return false;
        const epsilon = 0.01;
        return Math.abs((settings.minWidth ?? 0) - this.layoutSettings.minWidth) < 0.51
            && Math.abs((settings.gap ?? 0) - this.layoutSettings.gap) < 0.51
            && Math.abs((settings.aspectRatio ?? 0) - this.layoutSettings.aspectRatio) < epsilon;
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
            spreadSmoothing: Math.min(0.95, Math.max(0, toNumber(mapping.spreadSmoothing, spreadDefaults.smoothing))),
            templateId: mapping.templateId || ''
        };
    }

    render() {
        if (!this.container) return;

        this.container.classList.add('performance-block');
        this.container.innerHTML = '';
        this.parameterSelectRefs.clear();
        this.parameterFilterRefs = null;

        const header = document.createElement('header');
        header.className = 'performance-block__header';
        header.innerHTML = `
            <div>
                <h3 class="performance-block__title">Touch Pads</h3>
                <p class="performance-block__subtitle">Assign any parameter to expressive XY pads. Use a two-finger spread to drive a third parameter.</p>
            </div>
        `;
        this.container.appendChild(header);

        const parameterFilters = this.renderParameterFilter();
        if (parameterFilters) {
            this.container.appendChild(parameterFilters);
        }

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

    renderParameterFilter() {
        if (!this.parameterOptions.length) {
            return null;
        }

        const wrapper = document.createElement('section');
        wrapper.className = 'touchpad-parameter-filter';

        const searchLabel = document.createElement('label');
        searchLabel.className = 'touchpad-parameter-filter__search';
        const searchTitle = document.createElement('span');
        searchTitle.textContent = 'Find parameters';
        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.placeholder = 'Search by name or tag';
        searchInput.value = this.parameterFilter;
        searchInput.addEventListener('input', () => {
            this.parameterFilter = searchInput.value.trim();
            this.refreshParameterSelectOptions();
            this.updateParameterFilterSummary();
        });
        searchLabel.appendChild(searchTitle);
        searchLabel.appendChild(searchInput);
        wrapper.appendChild(searchLabel);

        const tagButtons = new Map();
        if (this.availableParameterTags.length) {
            const tagsRow = document.createElement('div');
            tagsRow.className = 'touchpad-parameter-filter__tags';
            const tagsLabel = document.createElement('span');
            tagsLabel.className = 'touchpad-parameter-filter__tags-label';
            tagsLabel.textContent = 'Quick tags';
            tagsRow.appendChild(tagsLabel);

            const tagList = document.createElement('div');
            tagList.className = 'touchpad-parameter-filter__tag-list';
            this.availableParameterTags.forEach(tag => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'touchpad-tag';
                button.textContent = tag;
                button.addEventListener('click', () => {
                    if (this.activeTagFilters.has(tag)) {
                        this.activeTagFilters.delete(tag);
                    } else {
                        this.activeTagFilters.add(tag);
                    }
                    this.refreshParameterSelectOptions();
                    this.updateParameterFilterSummary();
                });
                tagList.appendChild(button);
                tagButtons.set(tag, button);
            });
            tagsRow.appendChild(tagList);
            wrapper.appendChild(tagsRow);
        }

        const footer = document.createElement('div');
        footer.className = 'touchpad-parameter-filter__footer';
        const summary = document.createElement('span');
        summary.className = 'touchpad-parameter-filter__summary';
        footer.appendChild(summary);

        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.className = 'touchpad-tag touchpad-tag--reset';
        resetButton.textContent = 'Reset filters';
        resetButton.hidden = true;
        resetButton.addEventListener('click', () => {
            this.parameterFilter = '';
            this.activeTagFilters.clear();
            searchInput.value = '';
            this.refreshParameterSelectOptions();
            this.updateParameterFilterSummary();
        });
        footer.appendChild(resetButton);
        wrapper.appendChild(footer);

        this.parameterFilterRefs = {
            wrapper,
            summary,
            searchInput,
            tagButtons,
            resetButton
        };

        this.updateParameterFilterSummary();

        return wrapper;
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

        const padCountControl = this.createPadCountControl();
        controls.appendChild(padCountControl.wrapper);
        this.padCountControlRef = padCountControl;

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

        const presetControl = this.createLayoutPresetControl();
        controls.appendChild(presetControl.wrapper);
        wrapper.appendChild(controls);

        this.layoutControlRefs = {
            minWidthInput: minWidthControl.input,
            minWidthValue: minWidthControl.valueLabel,
            gapInput: gapControl.input,
            gapValue: gapControl.valueLabel,
            aspectRatioInput: aspectControl.input,
            aspectRatioValue: aspectControl.valueLabel
        };
        this.layoutPresetRefs = presetControl;

        this.updatePadCountUI();
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
            this.markLayoutAsCustom({ skipNotify: true });
            this.updateLayoutVariables();
            this.notifyLayoutChange();
        };

        input.addEventListener('input', commitChange);

        return { wrapper, input, valueLabel, formatter };
    }

    createPadCountControl() {
        const wrapper = document.createElement('label');
        wrapper.className = 'touchpad-layout__control touchpad-layout__control--pads';

        const title = document.createElement('span');
        title.className = 'touchpad-layout__label';
        title.textContent = 'Pad slots';
        wrapper.appendChild(title);

        const row = document.createElement('div');
        row.className = 'touchpad-layout__row';

        const input = document.createElement('input');
        input.type = 'range';
        input.min = '1';
        input.max = String(this.getMaxPadCount());
        input.step = '1';
        input.value = String(this.padCount);

        const valueLabel = document.createElement('span');
        valueLabel.className = 'touchpad-layout__value';
        valueLabel.textContent = this.formatPadCount(this.padCount);

        const commit = () => {
            const next = Math.round(toNumber(input.value, this.padCount));
            valueLabel.textContent = this.formatPadCount(next);
            if (next !== this.padCount) {
                this.setPadCount(next);
            } else {
                this.updatePadCountUI();
            }
        };

        input.addEventListener('input', () => {
            const preview = Math.round(toNumber(input.value, this.padCount));
            valueLabel.textContent = this.formatPadCount(preview);
        });
        input.addEventListener('change', commit);

        row.appendChild(input);
        row.appendChild(valueLabel);
        wrapper.appendChild(row);

        return { wrapper, input, valueLabel };
    }

    createLayoutPresetControl() {
        const wrapper = document.createElement('div');
        wrapper.className = 'touchpad-layout__preset';

        const label = document.createElement('label');
        label.className = 'touchpad-select';
        const title = document.createElement('span');
        title.textContent = 'Layout preset';
        const select = document.createElement('select');

        const options = [
            { value: CUSTOM_LAYOUT_ID, label: 'Custom layout' },
            ...this.layoutPresets.map(preset => ({ value: preset.id, label: preset.label }))
        ];

        select.innerHTML = options.map(option => `<option value="${option.value}">${option.label}</option>`).join('');
        select.value = this.activeLayoutPresetId;

        select.addEventListener('change', () => {
            const value = select.value;
            if (value === CUSTOM_LAYOUT_ID) {
                this.activeLayoutPresetId = CUSTOM_LAYOUT_ID;
                this.refreshLayoutPresetUI();
                this.notifyLayoutChange();
                return;
            }
            this.applyLayoutPreset(value);
        });

        label.appendChild(title);
        label.appendChild(select);

        const description = document.createElement('p');
        description.className = 'touchpad-layout__preset-description';
        description.textContent = CUSTOM_LAYOUT_DESCRIPTION;

        wrapper.appendChild(label);
        wrapper.appendChild(description);

        return { wrapper, select, description };
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
        this.refreshLayoutPresetUI();
    }

    notifyLayoutChange() {
        const detected = this.detectLayoutPresetId();
        if (detected !== this.activeLayoutPresetId) {
            this.activeLayoutPresetId = detected;
            this.refreshLayoutPresetUI();
        }
        this.notifyMappingChange();
        if (this.hub) {
            this.hub.emit('touchpad-layout-change', {
                layout: this.getLayoutSettings(),
                layoutPresetId: this.activeLayoutPresetId
            });
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

    applyLayoutPreset(presetId) {
        const preset = this.layoutPresetIndex.get(presetId);
        if (!preset) {
            this.markLayoutAsCustom();
            return;
        }
        this.layoutSettings = {
            ...this.layoutSettings,
            ...preset.settings
        };
        this.activeLayoutPresetId = preset.id;
        this.updateLayoutControlUI();
        this.updateLayoutVariables();
        this.notifyLayoutChange();
    }

    markLayoutAsCustom({ skipNotify = false } = {}) {
        this.activeLayoutPresetId = CUSTOM_LAYOUT_ID;
        this.refreshLayoutPresetUI();
        if (!skipNotify) {
            this.notifyLayoutChange();
        }
    }

    refreshLayoutPresetUI() {
        if (!this.layoutPresetRefs?.select) return;
        const select = this.layoutPresetRefs.select;
        const description = this.layoutPresetRefs.description;
        const preset = this.layoutPresetIndex.get(this.activeLayoutPresetId);
        select.value = this.activeLayoutPresetId;
        if (description) {
            description.textContent = preset?.description || CUSTOM_LAYOUT_DESCRIPTION;
        }
    }

    getMaxPadCount() {
        return Math.max(1, toNumber(this.config.maxPadCount, DEFAULT_MAX_PAD_COUNT));
    }

    formatPadCount(count) {
        const value = Math.max(1, Math.round(count));
        return `${value} pad${value === 1 ? '' : 's'}`;
    }

    updatePadCountUI() {
        if (!this.padCountControlRef) return;
        const { input, valueLabel } = this.padCountControlRef;
        if (input) {
            input.max = String(this.getMaxPadCount());
            input.value = String(this.padCount);
        }
        if (valueLabel) {
            valueLabel.textContent = this.formatPadCount(this.padCount);
        }
    }

    setPadCount(count, { silent = false } = {}) {
        if (!this.grid) return;
        const maxCount = this.getMaxPadCount();
        const target = Math.min(Math.max(1, Math.round(count)), maxCount);
        if (target === this.padCount) {
            this.updatePadCountUI();
            return;
        }

        if (target > this.padCount) {
            for (let index = this.padCount; index < target; index += 1) {
                const mapping = this.getDefaultMappingForIndex(index);
                const pad = this.createPad(mapping);
                this.pads.push(pad);
                this.grid.appendChild(pad.wrapper);
            }
        } else {
            for (let index = this.padCount - 1; index >= target; index -= 1) {
                const pad = this.pads[index];
                if (!pad) continue;
                ['xParam', 'yParam', 'spreadParam'].forEach(key => {
                    if (pad.mapping?.[key]) {
                        const source = key === 'xParam' ? 'touchpad-x' : key === 'yParam' ? 'touchpad-y' : 'touchpad-gesture';
                        this.clearSmoothingState(pad.mapping[key], source);
                    }
                });
                if (pad.cleanup) {
                    pad.cleanup();
                }
                if (pad.wrapper?.parentNode) {
                    pad.wrapper.parentNode.removeChild(pad.wrapper);
                }
                if (pad.controls?.xSelect?.ref) {
                    this.parameterSelectRefs.delete(pad.controls.xSelect.ref);
                }
                if (pad.controls?.ySelect?.ref) {
                    this.parameterSelectRefs.delete(pad.controls.ySelect.ref);
                }
                if (pad.controls?.spreadSelect?.ref) {
                    this.parameterSelectRefs.delete(pad.controls.spreadSelect.ref);
                }
                this.pads.pop();
            }
        }

        this.padCount = target;
        this.updatePadCountUI();
        this.refreshParameterSelectOptions();

        if (this.hub) {
            this.hub.emit('touchpad-pad-count-change', { padCount: this.padCount });
        }
        if (!silent) {
            this.notifyMappingChange();
        }
    }

    getDefaultMappingForIndex(index) {
        const defaults = Array.isArray(this.config.defaultMappings) ? this.config.defaultMappings : [];
        const template = defaults[index];
        return template ? copyMapping(template) : {};
    }

    getState() {
        return {
            mappings: this.getMappings(),
            layout: this.getLayoutSettings(),
            layoutPresetId: this.activeLayoutPresetId,
            padCount: this.padCount
        };
    }

    applyState(state) {
        if (!state) return;
        if (Array.isArray(state)) {
            this.applyMappings(state);
            return;
        }

        let didApplyMappings = false;
        if (state.mappings) {
            if (Array.isArray(state.mappings) && state.mappings.length && state.mappings.length !== this.padCount) {
                this.setPadCount(state.mappings.length, { silent: true });
            }
            this.applyMappings(state.mappings);
            didApplyMappings = true;
        }
        if (typeof state.padCount === 'number' && state.padCount !== this.padCount) {
            this.setPadCount(state.padCount, { silent: true });
        }
        const layoutPresetId = state.layoutPresetId || state.layoutPreset || state.layout?.presetId;
        let appliedPreset = false;
        if (layoutPresetId && layoutPresetId !== CUSTOM_LAYOUT_ID && this.layoutPresetIndex.has(layoutPresetId)) {
            this.applyLayoutPreset(layoutPresetId);
            appliedPreset = true;
        }
        if (state.layout && !appliedPreset) {
            this.applyLayout(state.layout);
            if (layoutPresetId === CUSTOM_LAYOUT_ID) {
                this.markLayoutAsCustom({ skipNotify: true });
                this.refreshLayoutPresetUI();
            }
        } else if (!state.layout && layoutPresetId === CUSTOM_LAYOUT_ID) {
            this.markLayoutAsCustom({ skipNotify: true });
        }

        if (!didApplyMappings) {
            this.notifyMappingChange();
        }
    }

    createPad(mapping = {}) {
        const index = this.pads.length + 1;
        const padId = mapping.id || `pad-${index}`;
        const label = mapping.label || `Pad ${index}`;
        const normalizedMapping = this.normaliseMapping({ ...mapping, id: padId, label });
        let templateId = mapping.templateId;
        if (!templateId) {
            templateId = this.detectTemplateId(normalizedMapping);
        }
        if (!templateId) {
            templateId = CUSTOM_TEMPLATE_ID;
        }
        normalizedMapping.templateId = templateId;

        const wrapper = document.createElement('article');
        wrapper.className = 'touchpad-card';

        const header = document.createElement('header');
        header.className = 'touchpad-card__header';

        const titleGroup = document.createElement('div');
        titleGroup.className = 'touchpad-card__title-group';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'touchpad-card__name';
        nameInput.value = normalizedMapping.label || label;
        nameInput.placeholder = 'Pad name';

        titleGroup.appendChild(nameInput);

        const statusEl = document.createElement('span');
        statusEl.className = 'touchpad-card__status';
        statusEl.dataset.role = 'status';
        statusEl.textContent = 'Ready';

        header.appendChild(titleGroup);
        header.appendChild(statusEl);

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
            label: normalizedMapping.label,
            wrapper,
            header,
            surface: padSurface,
            indicator,
            statusEl,
            mapping: { ...normalizedMapping },
            pointerState,
            controls: {}
        };

        nameInput.addEventListener('input', () => {
            padState.mapping.label = nameInput.value;
            padState.label = nameInput.value;
            this.notifyMappingChange();
        });

        const templateControl = this.createTemplateControl(padState);
        controls.appendChild(templateControl.wrapper);

        const xSelect = this.createParameterSelect('X Axis', padState.mapping.xParam || '', (value) => {
            if (padState.mapping.xParam && padState.mapping.xParam !== value) {
                this.clearSmoothingState(padState.mapping.xParam, 'touchpad-x');
            }
            padState.mapping.xParam = value || '';
            this.flagPadAsCustom(padState);
            this.notifyMappingChange();
        }, { role: 'xParam' });
        const ySelect = this.createParameterSelect('Y Axis', padState.mapping.yParam || '', (value) => {
            if (padState.mapping.yParam && padState.mapping.yParam !== value) {
                this.clearSmoothingState(padState.mapping.yParam, 'touchpad-y');
            }
            padState.mapping.yParam = value || '';
            this.flagPadAsCustom(padState);
            this.notifyMappingChange();
        }, { role: 'yParam' });
        const gestureSelect = this.createParameterSelect('Spread', padState.mapping.spreadParam || '', (value) => {
            if (padState.mapping.spreadParam && padState.mapping.spreadParam !== value) {
                this.clearSmoothingState(padState.mapping.spreadParam, 'touchpad-gesture');
            }
            padState.mapping.spreadParam = value || '';
            this.flagPadAsCustom(padState);
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
            this.flagPadAsCustom(padState);
            this.notifyMappingChange();
        }, 'invertX');
        const invertYToggle = this.createToggle('Invert Y', Boolean(padState.mapping.invertY), (checked) => {
            padState.mapping.invertY = checked;
            this.flagPadAsCustom(padState);
            this.notifyMappingChange();
        }, 'invertY');
        const swapButton = document.createElement('button');
        swapButton.type = 'button';
        swapButton.className = 'touchpad-swap';
        swapButton.textContent = 'Swap Axes';
        swapButton.addEventListener('click', () => {
            const previous = { ...padState.mapping };
            this.clearSmoothingState(previous.xParam, 'touchpad-x');
            this.clearSmoothingState(previous.yParam, 'touchpad-y');

            padState.mapping.xParam = previous.yParam;
            padState.mapping.yParam = previous.xParam;
            padState.mapping.xCurve = previous.yCurve;
            padState.mapping.yCurve = previous.xCurve;
            padState.mapping.xSmoothing = previous.ySmoothing;
            padState.mapping.ySmoothing = previous.xSmoothing;
            padState.mapping.invertX = previous.invertY;
            padState.mapping.invertY = previous.invertX;

            this.updatePadControlsFromMapping(padState);
            this.flagPadAsCustom(padState);
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
            this.flagPadAsCustom(padState);
        });

        const yResponse = this.createResponseControl('Y Response', {
            curve: padState.mapping.yCurve,
            smoothing: padState.mapping.ySmoothing
        }, 'y', (next) => {
            padState.mapping.yCurve = next.curve;
            padState.mapping.ySmoothing = next.smoothing;
            this.flagPadAsCustom(padState);
        });

        const spreadResponse = this.createResponseControl('Spread Gesture', {
            curve: padState.mapping.spreadCurve,
            smoothing: padState.mapping.spreadSmoothing
        }, 'spread', (next) => {
            padState.mapping.spreadCurve = next.curve;
            padState.mapping.spreadSmoothing = next.smoothing;
            this.flagPadAsCustom(padState);
        });

        responseGroup.appendChild(xResponse.wrapper);
        responseGroup.appendChild(yResponse.wrapper);
        responseGroup.appendChild(spreadResponse.wrapper);

        padState.controls = {
            nameInput,
            template: templateControl,
            xSelect,
            ySelect,
            spreadSelect: gestureSelect,
            invertX: invertXToggle,
            invertY: invertYToggle,
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
        this.updatePadControlsFromMapping(padState);
        return padState;
    }

    createTemplateControl(padState) {
        const wrapper = document.createElement('div');
        wrapper.className = 'touchpad-template';

        const label = document.createElement('label');
        label.className = 'touchpad-select';
        const title = document.createElement('span');
        title.textContent = 'Pad template';
        const select = document.createElement('select');

        const options = [
            { id: CUSTOM_TEMPLATE_ID, label: CUSTOM_TEMPLATE_LABEL },
            ...this.templates.map(template => ({ id: template.id, label: template.label }))
        ];

        select.innerHTML = options.map(option => `<option value="${option.id}">${option.label}</option>`).join('');
        select.value = padState.mapping.templateId || CUSTOM_TEMPLATE_ID;

        select.addEventListener('change', () => {
            this.applyTemplateToPad(padState, select.value);
        });

        label.appendChild(title);
        label.appendChild(select);

        const description = document.createElement('p');
        description.className = 'touchpad-template__description';
        description.textContent = this.getTemplateDescription(padState.mapping.templateId);

        wrapper.appendChild(label);
        wrapper.appendChild(description);

        return { wrapper, select, description };
    }

    flagPadAsCustom(padState) {
        if (!padState || !padState.mapping) return;
        if (padState.mapping.templateId === CUSTOM_TEMPLATE_ID) return;
        padState.mapping.templateId = CUSTOM_TEMPLATE_ID;
        this.updatePadTemplateUI(padState);
    }

    applyTemplateToPad(padState, templateId) {
        if (!padState || !padState.mapping) return;
        if (!templateId || templateId === CUSTOM_TEMPLATE_ID) {
            padState.mapping.templateId = CUSTOM_TEMPLATE_ID;
            this.updatePadControlsFromMapping(padState);
            this.notifyMappingChange();
            return;
        }

        const template = this.templateIndex.get(templateId);
        if (!template) {
            this.flagPadAsCustom(padState);
            this.notifyMappingChange();
            return;
        }

        const previous = { ...padState.mapping };
        const nextMapping = this.normaliseMapping({
            ...template.mapping,
            id: padState.id,
            label: template.label,
            templateId: template.id
        });

        const axes = [
            { key: 'xParam', source: 'touchpad-x' },
            { key: 'yParam', source: 'touchpad-y' },
            { key: 'spreadParam', source: 'touchpad-gesture' }
        ];
        axes.forEach(({ key, source }) => {
            if (previous[key] && previous[key] !== nextMapping[key]) {
                this.clearSmoothingState(previous[key], source);
            }
        });

        padState.mapping = { ...padState.mapping, ...nextMapping };
        padState.label = padState.mapping.label;
        this.updatePadControlsFromMapping(padState);
        this.notifyMappingChange();
    }

    getTemplateDescription(templateId) {
        if (!templateId || templateId === CUSTOM_TEMPLATE_ID) {
            return CUSTOM_TEMPLATE_DESCRIPTION;
        }
        const template = this.templateIndex.get(templateId);
        return template?.description || CUSTOM_TEMPLATE_DESCRIPTION;
    }

    updatePadTemplateUI(padState) {
        if (!padState?.controls?.template) return;
        const templateId = padState.mapping.templateId || CUSTOM_TEMPLATE_ID;
        const control = padState.controls.template;
        control.select.value = templateId;
        control.description.textContent = this.getTemplateDescription(templateId);
        control.wrapper.classList.toggle('touchpad-template--custom', templateId === CUSTOM_TEMPLATE_ID);
    }

    updatePadControlsFromMapping(padState) {
        if (!padState || !padState.mapping) return;
        const mapping = padState.mapping;

        if (!mapping.templateId) {
            const detected = this.detectTemplateId(mapping);
            mapping.templateId = detected || CUSTOM_TEMPLATE_ID;
        }

        const nameInput = padState.controls?.nameInput;
        if (nameInput && document.activeElement !== nameInput) {
            nameInput.value = mapping.label || '';
        }

        if (padState.controls?.xSelect?.ref) {
            this.populateParameterSelect(padState.controls.xSelect.ref, mapping.xParam || '');
        }
        if (padState.controls?.ySelect?.ref) {
            this.populateParameterSelect(padState.controls.ySelect.ref, mapping.yParam || '');
        }
        if (padState.controls?.spreadSelect?.ref) {
            this.populateParameterSelect(padState.controls.spreadSelect.ref, mapping.spreadParam || '');
        }
        if (padState.controls?.invertX) {
            padState.controls.invertX.input.checked = Boolean(mapping.invertX);
        }
        if (padState.controls?.invertY) {
            padState.controls.invertY.input.checked = Boolean(mapping.invertY);
        }
        if (padState.controls?.xResponse) {
            padState.controls.xResponse.select.value = mapping.xCurve || this.getAxisDefaults('x').curve;
            padState.controls.xResponse.slider.value = String(mapping.xSmoothing);
            padState.controls.xResponse.updateLabel();
        }
        if (padState.controls?.yResponse) {
            padState.controls.yResponse.select.value = mapping.yCurve || this.getAxisDefaults('y').curve;
            padState.controls.yResponse.slider.value = String(mapping.ySmoothing);
            padState.controls.yResponse.updateLabel();
        }
        if (padState.controls?.spreadResponse) {
            padState.controls.spreadResponse.select.value = mapping.spreadCurve || this.getAxisDefaults('spread').curve;
            padState.controls.spreadResponse.slider.value = String(mapping.spreadSmoothing);
            padState.controls.spreadResponse.updateLabel();
        }

        this.updatePadTemplateUI(padState);
    }

    detectTemplateId(mapping = {}) {
        const normalized = this.normaliseMapping(mapping);
        const match = this.templates.find(template => this.mappingMatchesTemplate(normalized, template.mapping));
        return match ? match.id : '';
    }

    mappingMatchesTemplate(mapping, templateMapping) {
        if (!mapping || !templateMapping) return false;
        const keys = ['xParam', 'yParam', 'spreadParam', 'invertX', 'invertY', 'xCurve', 'yCurve', 'spreadCurve'];
        const smoothingKeys = ['xSmoothing', 'ySmoothing', 'spreadSmoothing'];
        return keys.every(key => (mapping[key] || '') === (templateMapping[key] || ''))
            && smoothingKeys.every(key => Math.abs((mapping[key] ?? 0) - (templateMapping[key] ?? 0)) < 0.0001);
    }

    createParameterSelect(label, value, onChange, { allowNone = false, placeholder = 'Select parameter', role = '' } = {}) {
        const wrapper = document.createElement('label');
        wrapper.className = 'touchpad-select';
        const span = document.createElement('span');
        span.textContent = label;
        const select = document.createElement('select');
        if (role) {
            select.dataset.role = role;
        }

        const selectRef = { select, allowNone, placeholder };
        this.parameterSelectRefs.add(selectRef);
        this.populateParameterSelect(selectRef, value || '');

        select.addEventListener('change', () => {
            onChange(select.value);
        });

        wrapper.appendChild(span);
        wrapper.appendChild(select);
        return { wrapper, select, ref: selectRef };
    }

    populateParameterSelect(selectRef, value = '') {
        if (!selectRef?.select) return;
        const { select, allowNone, placeholder } = selectRef;
        const currentValue = value ?? '';
        const filtered = this.getFilteredParameters({ includeIds: currentValue ? [currentValue] : [] });

        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }

        if (allowNone) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = placeholder || 'Select parameter';
            select.appendChild(option);
        } else if (!currentValue) {
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = placeholder || 'Select parameter';
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            select.appendChild(placeholderOption);
        }

        const groups = new Map();
        filtered.forEach(meta => {
            const groupLabel = meta.group || 'Parameters';
            if (!groups.has(groupLabel)) {
                groups.set(groupLabel, []);
            }
            groups.get(groupLabel).push(meta);
        });

        groups.forEach((items, groupLabel) => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = groupLabel;
            items.forEach(meta => {
                const option = document.createElement('option');
                option.value = meta.id;
                option.textContent = meta.label;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        });

        if (currentValue) {
            const hasValue = Array.from(select.options).some(option => option.value === currentValue);
            if (!hasValue) {
                const fallback = document.createElement('option');
                fallback.value = currentValue;
                const meta = this.parameterLookup.get(currentValue);
                fallback.textContent = meta ? `${meta.label} (filtered)` : currentValue;
                select.appendChild(fallback);
            }
        }

        if (currentValue && Array.from(select.options).some(option => option.value === currentValue)) {
            select.value = currentValue;
        } else if (allowNone) {
            select.value = '';
        } else {
            const firstAvailable = Array.from(select.options).find(option => option.value);
            if (firstAvailable) {
                select.value = firstAvailable.value;
            }
        }

        return select.value;
    }

    refreshParameterSelectOptions() {
        this.parameterSelectRefs.forEach(selectRef => {
            const currentValue = selectRef.select?.value || '';
            this.populateParameterSelect(selectRef, currentValue);
        });
    }

    getFilteredParameters({ includeIds = [] } = {}) {
        const query = (this.parameterFilter || '').toLowerCase();
        const includes = new Set((includeIds || []).filter(Boolean));
        const results = [];
        const seen = new Set();
        const activeTagCount = this.activeTagFilters.size;

        this.parameterOptions.forEach(meta => {
            if (!meta) return;
            const label = String(meta.label || '').toLowerCase();
            const id = String(meta.id || '').toLowerCase();
            const tags = Array.isArray(meta.tags) ? meta.tags : [];
            const matchesSearch = !query
                || label.includes(query)
                || id.includes(query)
                || tags.some(tag => String(tag).toLowerCase().includes(query));
            const matchesTags = !activeTagCount
                || tags.some(tag => this.activeTagFilters.has(tag));

            if ((matchesSearch && matchesTags) || includes.has(meta.id)) {
                results.push(meta);
                seen.add(meta.id);
                includes.delete(meta.id);
            }
        });

        includes.forEach(id => {
            if (seen.has(id)) return;
            const meta = this.parameterLookup.get(id);
            if (meta) {
                results.push(meta);
            } else if (id) {
                results.push({ id, label: id, group: 'Parameters', tags: [] });
            }
        });

        return results.sort((a, b) => {
            if (a.group === b.group) {
                return a.label.localeCompare(b.label);
            }
            return (a.group || '').localeCompare(b.group || '');
        });
    }

    countFilteredParameters() {
        const filtered = this.getFilteredParameters();
        return { filtered: filtered.length, total: this.parameterOptions.length };
    }

    updateParameterFilterSummary() {
        if (!this.parameterFilterRefs) return;
        const { summary, resetButton, tagButtons, wrapper } = this.parameterFilterRefs;
        const { filtered, total } = this.countFilteredParameters();
        const hasFilter = Boolean((this.parameterFilter || '').length) || this.activeTagFilters.size > 0;

        if (summary) {
            if (filtered === 0 && hasFilter) {
                summary.textContent = 'No parameters match these filters';
            } else if (filtered === total) {
                summary.textContent = `Showing ${total} parameter${total === 1 ? '' : 's'}`;
            } else {
                summary.textContent = `Showing ${filtered} of ${total} parameters`;
            }
        }
        if (resetButton) {
            resetButton.hidden = !hasFilter;
        }
        if (wrapper) {
            wrapper.classList.toggle('touchpad-parameter-filter--active', hasFilter);
        }
        if (tagButtons instanceof Map) {
            tagButtons.forEach((button, tag) => {
                button.classList.toggle('touchpad-tag--active', this.activeTagFilters.has(tag));
            });
        }
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

            const previous = { ...pad.mapping };
            const nextMapping = this.normaliseMapping({
                ...pad.mapping,
                ...mapping,
                id: pad.mapping.id,
                label: mapping.label || pad.mapping.label
            });

            let templateId = mapping.templateId ?? pad.mapping.templateId ?? '';
            if (templateId && templateId !== CUSTOM_TEMPLATE_ID) {
                const template = this.templateIndex.get(templateId);
                if (!template || !this.mappingMatchesTemplate(nextMapping, template.mapping)) {
                    templateId = this.detectTemplateId(nextMapping);
                }
            } else if (!templateId) {
                templateId = this.detectTemplateId(nextMapping);
            }
            nextMapping.templateId = templateId || CUSTOM_TEMPLATE_ID;

            const axes = [
                { key: 'xParam', source: 'touchpad-x' },
                { key: 'yParam', source: 'touchpad-y' },
                { key: 'spreadParam', source: 'touchpad-gesture' }
            ];
            axes.forEach(({ key, source }) => {
                if (previous[key] && previous[key] !== nextMapping[key]) {
                    this.clearSmoothingState(previous[key], source);
                }
            });

            pad.mapping = { ...pad.mapping, ...nextMapping };
            pad.label = pad.mapping.label;
            this.updatePadControlsFromMapping(pad);
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
        this.parameterSelectRefs.clear();
        this.activeTagFilters.clear();
        this.parameterFilter = '';
        this.parameterFilterRefs = null;
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
