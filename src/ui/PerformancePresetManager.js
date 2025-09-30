/**
 * Performance Preset Manager
 * Handles saving presets and choreographed sequences for live shows
 */

const STORAGE_KEY = 'vib34d_performance_presets_v1';

export class PerformancePresetManager {
    constructor(options = {}) {
        const {
            parameterManager,
            touchPadController = null,
            audioPanel = null,
            container = null,
            onPresetApply = null
        } = options;

        this.parameterManager = parameterManager;
        this.touchPadController = touchPadController;
        this.audioPanel = audioPanel;
        this.onPresetApply = onPresetApply;
        this.container = container || this.ensureContainer();

        this.parameterOptions = this.buildParameterOptions();
        this.parameterLabels = new Map(this.parameterOptions.map(option => [option.id, option.label]));

        this.presets = this.loadPresets();
        this.sequence = [];
        this.sequencePlaying = false;
        this.currentPresetId = null;

        this.buildUI();
        this.renderPresetList();
        this.renderSequence();
    }

    ensureContainer() {
        const existing = document.getElementById('performance-presets');
        if (existing) return existing;

        const section = document.createElement('section');
        section.id = 'performance-presets';
        section.classList.add('performance-presets');
        document.body.appendChild(section);
        return section;
    }

    buildUI() {
        this.parameterOptions = this.buildParameterOptions();
        this.parameterLabels = new Map(this.parameterOptions.map(option => [option.id, option.label]));
        this.container.innerHTML = '';
        this.container.innerHTML = `
            <header class="performance-section-header">
                <div>
                    <h3>Show Presets & Choreography</h3>
                    <p class="performance-subtitle">Capture parameter states, pad mappings and audio settings for instant recall.</p>
                </div>
            </header>
            <div class="preset-controls">
                <div class="preset-create">
                    <input type="text" id="preset-name" placeholder="Preset name (e.g. "Midnight Drop")">
                    <div class="preset-actions">
                        <button id="preset-save">Save Preset</button>
                        <button id="preset-update" disabled>Update</button>
                        <button id="preset-reset">Clear</button>
                    </div>
                </div>
                <div class="preset-flourish">
                    <label>
                        <span>Flourish Parameter</span>
                        <select id="preset-flourish-parameter"></select>
                    </label>
                    <label>
                        <span>Flourish Boost</span>
                        <input type="range" id="preset-flourish-amount" min="0.1" max="1" step="0.05" value="0.5">
                    </label>
                    <label>
                        <span>Flourish Duration (ms)</span>
                        <input type="number" id="preset-flourish-duration" min="200" max="4000" step="100" value="1200">
                    </label>
                </div>
            </div>
            <div class="preset-list" id="preset-list"></div>
            <div class="sequence-builder">
                <div class="sequence-header">
                    <h4>Choreography Timeline</h4>
                    <div class="sequence-actions">
                        <button id="sequence-play">Play Sequence</button>
                        <button id="sequence-clear">Clear</button>
                    </div>
                </div>
                <div class="sequence-form">
                    <select id="sequence-preset"></select>
                    <input type="number" id="sequence-transition" placeholder="Transition ms" min="100" value="1800">
                    <input type="number" id="sequence-hold" placeholder="Hold ms" min="0" value="1200">
                    <label class="sequence-flourish">
                        <input type="checkbox" id="sequence-flourish">
                        <span>Trigger flourish</span>
                    </label>
                    <button id="sequence-add">Add Cue</button>
                </div>
                <ol class="sequence-list" id="sequence-list"></ol>
            </div>
        `;

        this.populateFlourishParameterOptions();
        this.bindEvents();
    }

    populateFlourishParameterOptions() {
        const select = this.container.querySelector('#preset-flourish-parameter');
        if (!select || !this.parameterManager) return;

        const defaultValue = this.parameterOptions[0]?.id || '';
        select.innerHTML = this.renderParameterOptions(this.parameterOptions, defaultValue);
        select.value = defaultValue;
    }

    bindEvents() {
        const saveBtn = this.container.querySelector('#preset-save');
        const updateBtn = this.container.querySelector('#preset-update');
        const resetBtn = this.container.querySelector('#preset-reset');
        const playBtn = this.container.querySelector('#sequence-play');
        const clearBtn = this.container.querySelector('#sequence-clear');
        const addBtn = this.container.querySelector('#sequence-add');

        saveBtn.addEventListener('click', () => this.savePreset());
        updateBtn.addEventListener('click', () => this.updatePreset());
        resetBtn.addEventListener('click', () => this.resetForm());
        playBtn.addEventListener('click', () => this.playSequence());
        clearBtn.addEventListener('click', () => this.clearSequence());
        addBtn.addEventListener('click', () => this.addSequenceCue());
    }

    savePreset() {
        const nameInput = this.container.querySelector('#preset-name');
        const flourishSelect = this.container.querySelector('#preset-flourish-parameter');
        const flourishParam = flourishSelect?.value || this.parameterOptions[0]?.id || '';
        const flourishAmount = parseFloat(this.container.querySelector('#preset-flourish-amount').value);
        const flourishDuration = parseInt(this.container.querySelector('#preset-flourish-duration').value, 10);

        const preset = {
            id: this.generatePresetId(),
            name: nameInput.value.trim() || `Preset ${new Date().toLocaleTimeString()}`,
            createdAt: Date.now(),
            params: this.parameterManager?.getAllParameters() || {},
            mappings: this.touchPadController?.getMappings() || [],
            audio: this.audioPanel?.getSettings() || null,
            flourish: {
                parameter: flourishParam,
                amount: flourishAmount,
                duration: flourishDuration
            }
        };

        this.presets.push(preset);
        this.persistPresets();
        this.renderPresetList();
        this.renderSequenceOptions();
        this.resetForm();
    }

    updatePreset() {
        if (!this.currentPresetId) return;

        const preset = this.presets.find(item => item.id === this.currentPresetId);
        if (!preset) return;

        const flourishSelect = this.container.querySelector('#preset-flourish-parameter');
        const flourishParam = flourishSelect?.value || this.parameterOptions[0]?.id || '';
        const flourishAmount = parseFloat(this.container.querySelector('#preset-flourish-amount').value);
        const flourishDuration = parseInt(this.container.querySelector('#preset-flourish-duration').value, 10);
        const nameInput = this.container.querySelector('#preset-name');

        preset.name = nameInput.value.trim() || preset.name;
        preset.params = this.parameterManager?.getAllParameters() || preset.params;
        preset.mappings = this.touchPadController?.getMappings() || preset.mappings;
        preset.audio = this.audioPanel?.getSettings() || preset.audio;
        preset.flourish = {
            parameter: flourishParam,
            amount: flourishAmount,
            duration: flourishDuration
        };

        this.persistPresets();
        this.renderPresetList();
        this.renderSequenceOptions();
    }

    resetForm() {
        this.currentPresetId = null;
        this.container.querySelector('#preset-name').value = '';
        this.container.querySelector('#preset-update').disabled = true;
        const flourishSelect = this.container.querySelector('#preset-flourish-parameter');
        if (flourishSelect) {
            flourishSelect.value = this.parameterOptions[0]?.id || '';
        }
        const amount = this.container.querySelector('#preset-flourish-amount');
        if (amount) amount.value = 0.5;
        const duration = this.container.querySelector('#preset-flourish-duration');
        if (duration) duration.value = 1200;
    }

    renderPresetList() {
        const list = this.container.querySelector('#preset-list');
        if (!list) return;

        if (this.presets.length === 0) {
            list.innerHTML = '<p class="preset-empty">No presets yet. Dial in a look and save it for instant recall.</p>';
            this.renderSequenceOptions();
            return;
        }

        list.innerHTML = '';
        this.presets
            .sort((a, b) => b.createdAt - a.createdAt)
            .forEach(preset => {
                const item = document.createElement('div');
                item.classList.add('preset-item');
                const mappingSummary = this.describeMappingSummary(preset.mappings);
                const audioSummary = preset.audio ? 'Audio: custom matrix' : 'Audio: default';
                const flourishSummary = preset.flourish ? `Flourish: ${this.getParameterLabel(preset.flourish.parameter)}` : 'Flourish: none';
                item.innerHTML = `
                    <div class="preset-meta">
                        <h4>${preset.name}</h4>
                        <span>${new Date(preset.createdAt).toLocaleString()}</span>
                        <p class="preset-summary">${mappingSummary}</p>
                        <p class="preset-meta-detail">${audioSummary} • ${flourishSummary}</p>
                    </div>
                    <div class="preset-buttons">
                        <button data-action="apply" data-id="${preset.id}">Apply</button>
                        <button data-action="flourish" data-id="${preset.id}">Flourish</button>
                        <button data-action="edit" data-id="${preset.id}">Edit</button>
                        <button data-action="delete" data-id="${preset.id}">Delete</button>
                    </div>
                `;

                item.querySelectorAll('button').forEach(button => {
                    button.addEventListener('click', () => this.handlePresetAction(button.dataset.action, preset.id));
                });

                list.appendChild(item);
            });

        this.renderSequenceOptions();
    }

    handlePresetAction(action, presetId) {
        const preset = this.presets.find(item => item.id === presetId);
        if (!preset) return;

        switch (action) {
            case 'apply':
                this.applyPreset(preset);
                break;
            case 'flourish':
                this.triggerFlourish(preset);
                break;
            case 'edit':
                this.populateForm(preset);
                break;
            case 'delete':
                this.deletePreset(presetId);
                break;
        }
    }

    populateForm(preset) {
        this.currentPresetId = preset.id;
        this.container.querySelector('#preset-name').value = preset.name;
        const flourishSelect = this.container.querySelector('#preset-flourish-parameter');
        const targetParameter = preset.flourish?.parameter || this.parameterOptions[0]?.id || '';
        if (flourishSelect) {
            if (!flourishSelect.querySelector(`option[value="${targetParameter}"]`)) {
                flourishSelect.innerHTML = this.renderParameterOptions(this.parameterOptions, targetParameter);
            }
            flourishSelect.value = targetParameter;
        }
        this.container.querySelector('#preset-flourish-amount').value = preset.flourish?.amount ?? 0.5;
        this.container.querySelector('#preset-flourish-duration').value = preset.flourish?.duration ?? 1200;
        this.container.querySelector('#preset-update').disabled = false;
    }

    deletePreset(presetId) {
        this.presets = this.presets.filter(item => item.id !== presetId);
        this.persistPresets();
        this.renderPresetList();
        this.renderSequenceOptions();
    }

    applyPreset(preset, options = {}) {
        const transition = options.transition || 1800;
        if (this.parameterManager) {
            this.parameterManager.interpolateTo(preset.params, transition, { source: 'preset' });
        }

        if (this.touchPadController && preset.mappings) {
            this.touchPadController.applyMappings(preset.mappings);
        }

        if (this.audioPanel && preset.audio) {
            this.audioPanel.setSettings(preset.audio);
        }

        if (typeof this.onPresetApply === 'function') {
            this.onPresetApply(preset);
        }
    }

    triggerFlourish(preset) {
        if (!preset?.flourish || !this.parameterManager) return;

        const { parameter, amount, duration } = preset.flourish;
        const definition = this.parameterManager.getParameterDefinition(parameter);
        if (!definition) return;

        const baseValue = this.parameterManager.getParameter(parameter);
        const span = definition.max - definition.min;
        const target = this.parameterManager.clampToDefinition(parameter, baseValue + span * amount);

        this.parameterManager.animateParameter(parameter, target, duration, {
            source: 'flourish',
            onComplete: () => {
                this.parameterManager.animateParameter(parameter, baseValue, duration, { source: 'flourish-return' });
            }
        });
    }

    addSequenceCue() {
        const select = this.container.querySelector('#sequence-preset');
        const transitionInput = this.container.querySelector('#sequence-transition');
        const holdInput = this.container.querySelector('#sequence-hold');
        const flourishToggle = this.container.querySelector('#sequence-flourish');

        if (!select.value) return;

        this.sequence.push({
            presetId: select.value,
            transition: parseInt(transitionInput.value, 10) || 1800,
            hold: parseInt(holdInput.value, 10) || 0,
            flourish: flourishToggle.checked
        });

        flourishToggle.checked = false;
        this.renderSequence();
    }

    renderSequence() {
        const list = this.container.querySelector('#sequence-list');
        if (!list) return;

        list.innerHTML = '';
        this.sequence.forEach((cue, index) => {
            const preset = this.presets.find(item => item.id === cue.presetId);
            if (!preset) return;

            const item = document.createElement('li');
            item.innerHTML = `
                <span>${index + 1}. ${preset.name} — ${cue.transition}ms transition, ${cue.hold}ms hold${cue.flourish ? ', flourish' : ''}</span>
                <button data-index="${index}">Remove</button>
            `;

            item.querySelector('button').addEventListener('click', () => {
                this.sequence.splice(index, 1);
                this.renderSequence();
            });

            list.appendChild(item);
        });
    }

    renderSequenceOptions() {
        const select = this.container.querySelector('#sequence-preset');
        if (!select) return;

        select.innerHTML = this.presets
            .map(preset => `<option value="${preset.id}">${preset.name}</option>`)
            .join('');
    }

    buildParameterOptions() {
        if (!this.parameterManager) return [];
        return this.parameterManager.listParameterMetadata().map(meta => ({
            id: meta.id,
            label: meta.label,
            group: meta.group || 'General'
        }));
    }

    renderParameterOptions(options, selectedValue) {
        const groups = new Map();
        options.forEach(option => {
            const group = option.group || 'General';
            if (!groups.has(group)) {
                groups.set(group, []);
            }
            groups.get(group).push(option);
        });

        const fragments = [];
        groups.forEach((groupOptions, group) => {
            const markup = groupOptions
                .sort((a, b) => a.label.localeCompare(b.label))
                .map(option => `<option value="${option.id}"${option.id === selectedValue ? ' selected' : ''}>${option.label}</option>`)
                .join('');
            fragments.push(`<optgroup label="${group}">${markup}</optgroup>`);
        });

        if (fragments.length === 0) {
            return '<option value="" disabled>No parameters</option>';
        }

        return fragments.join('');
    }

    normalizeMappingsForSummary(mappings) {
        if (!mappings) {
            return { padCount: 0, pads: [] };
        }

        if (Array.isArray(mappings)) {
            return {
                padCount: mappings.length,
                pads: mappings.map((pad, index) => ({
                    id: pad.id ?? index,
                    bindings: pad.bindings || pad.axisBindings || {}
                }))
            };
        }

        const pads = Array.isArray(mappings.pads)
            ? mappings.pads
            : Array.isArray(mappings.padStates)
                ? mappings.padStates
                : [];

        return {
            padCount: mappings.padCount ?? pads.length,
            pads: pads.map((pad, index) => ({
                id: pad.id ?? index,
                bindings: pad.bindings || pad.axisBindings || {}
            }))
        };
    }

    describeMappingSummary(mappings) {
        const normalized = this.normalizeMappingsForSummary(mappings);
        if (!normalized.pads.length) {
            return 'No pad mappings set';
        }

        return normalized.pads
            .map(pad => {
                const xLabel = this.getParameterLabel(pad.bindings?.x);
                const yLabel = this.getParameterLabel(pad.bindings?.y);
                const gesture = pad.bindings?.gesture && pad.bindings.gesture !== 'none'
                    ? `, Gesture → ${this.getParameterLabel(pad.bindings.gesture)}`
                    : '';
                return `Pad ${(pad.id ?? 0) + 1}: X → ${xLabel}, Y → ${yLabel}${gesture}`;
            })
            .join(' • ');
    }

    async playSequence() {
        if (this.sequencePlaying || this.sequence.length === 0) return;

        this.sequencePlaying = true;
        for (const cue of this.sequence) {
            const preset = this.presets.find(item => item.id === cue.presetId);
            if (!preset) continue;

            this.applyPreset(preset, { transition: cue.transition });
            if (cue.flourish) {
                setTimeout(() => this.triggerFlourish(preset), cue.transition / 2);
            }

            await this.wait(cue.transition + cue.hold);
        }
        this.sequencePlaying = false;
    }

    clearSequence() {
        this.sequence = [];
        this.renderSequence();
    }

    wait(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    generatePresetId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return `preset-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    }

    loadPresets() {
        try {
            const data = window.localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.warn('Unable to load performance presets:', error);
            return [];
        }
    }

    persistPresets() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.presets));
        } catch (error) {
            console.warn('Unable to persist presets:', error);
        }
    }

    clearSequenceOptions() {
        const select = this.container.querySelector('#sequence-preset');
        if (select) select.innerHTML = '';
    }

    getParameterLabel(name) {
        if (!name || name === 'none') {
            return 'None';
        }
        return this.parameterLabels?.get(name)
            || this.parameterManager?.formatParameterLabel?.(name)
            || this.formatFallbackName(name);
    }

    formatParameterName(name) {
        return this.getParameterLabel(name);
    }

    formatFallbackName(name) {
        return name
            .replace(/rot4d/gi, '4D ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, char => char.toUpperCase())
            .trim();
    }
}
