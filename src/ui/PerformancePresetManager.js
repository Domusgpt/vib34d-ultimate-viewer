import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

/**
 * Performance Preset Manager
 * Handles saving presets and choreographed sequences for live shows
 */

const STORAGE_KEY = 'vib34d_performance_presets_v1';
const FLOURISH_CURVES = [
    { value: 'linear', label: 'Linear' },
    { value: 'easeIn', label: 'Ease In' },
    { value: 'easeOut', label: 'Ease Out' },
    { value: 'easeInOut', label: 'Ease In-Out' }
];

export class PerformancePresetManager {
    constructor(options = {}) {
        const {
            parameterManager,
            touchPadController = null,
            audioPanel = null,
            container = null,
            onPresetApply = null,
            hub = null
        } = options;

        this.parameterManager = parameterManager;
        this.touchPadController = touchPadController;
        this.audioPanel = audioPanel;
        this.onPresetApply = onPresetApply;
        this.container = container || this.ensureContainer();
        this.hub = hub;

        this.parameterOptions = this.buildParameterOptions();
        this.parameterLabels = new Map(this.parameterOptions.map(option => [option.id, option.label]));

        this.axisModeLabels = new Map();
        this.axisCurveLabels = new Map();
        this.gestureModeLabels = new Map();
        this.axisSmoothingMax = 1;
        this.axisSmoothingMin = 0;
        this.initializeAxisMetadata();

        this.presets = this.loadPresets();
        this.sequence = [];
        this.sequenceSettings = this.initializeSequenceSettings();
        this.sequenceAbort = false;
        this.sequenceWaitTimeout = null;
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

    initializeAxisMetadata() {
        const axisConfig = this.touchPadController?.config?.axis || {};
        const fallback = DEFAULT_PERFORMANCE_CONFIG.touchPads.axis;
        const gestureConfig = this.touchPadController?.config?.gesture || DEFAULT_PERFORMANCE_CONFIG.touchPads.gesture || {};

        const modeConfig = Array.isArray(axisConfig.modes) && axisConfig.modes.length
            ? axisConfig.modes
            : fallback.modes;
        const curveConfig = Array.isArray(axisConfig.curves) && axisConfig.curves.length
            ? axisConfig.curves
            : fallback.curves;
        const smoothingConfig = axisConfig.smoothing || fallback.smoothing || {};
        const gestureModes = Array.isArray(gestureConfig.modes) && gestureConfig.modes.length
            ? gestureConfig.modes
            : (DEFAULT_PERFORMANCE_CONFIG.touchPads.gesture?.modes || []);

        this.axisModeLabels = new Map(modeConfig.map(mode => [mode.value, mode.label]));
        this.axisCurveLabels = new Map(curveConfig.map(curve => [curve.value, curve.label]));
        this.gestureModeLabels = new Map(gestureModes.map(mode => [mode.value, mode.label]));
        this.axisSmoothingMax = smoothingConfig.max ?? 1;
        this.axisSmoothingMin = smoothingConfig.min ?? 0;
    }

    initializeSequenceSettings() {
        const tempo = this.audioPanel?.getSettings?.()?.tempo || {};
        return {
            loop: false,
            syncToTempo: false,
            subdivision: tempo.subdivision || tempo.defaultSubdivision || DEFAULT_PERFORMANCE_CONFIG.audio.tempo.defaultSubdivision || '1/4',
            quantize: false
        };
    }

    exportState() {
        return {
            presets: this.presets.map(preset => this.clonePreset(preset)),
            sequence: this.cloneSequence(this.sequence),
            sequenceSettings: { ...this.sequenceSettings }
        };
    }

    importState(state = {}) {
        const presets = Array.isArray(state.presets) ? state.presets : [];
        const sequence = Array.isArray(state.sequence) ? state.sequence : [];
        const sequenceSettings = state.sequenceSettings && typeof state.sequenceSettings === 'object'
            ? state.sequenceSettings
            : null;

        this.presets = presets
            .map(preset => this.clonePreset(preset))
            .filter(Boolean);
        this.sequence = this.cloneSequence(sequence);
        if (sequenceSettings) {
            this.sequenceSettings = {
                ...this.sequenceSettings,
                ...sequenceSettings
            };
        }

        this.persistPresets();
        this.renderPresetList();
        this.renderSequence();
        this.renderSequenceOptions();
        this.applySequenceSettingsToControls();
        this.updateSequencePlaceholders();
        this.notifyPresetListChange();
        this.notifySequenceChange();
    }

    clonePreset(preset) {
        if (!preset) return null;
        return JSON.parse(JSON.stringify(preset));
    }

    cloneSequence(sequence) {
        if (!Array.isArray(sequence)) return [];
        return sequence.map(cue => ({ ...cue }));
    }

    notifyPresetListChange() {
        if (this.hub) {
            const state = this.exportState();
            this.hub.emit('preset-list-changed', {
                presets: state.presets,
                sequence: state.sequence
            });
        }
    }

    notifySequenceChange() {
        if (this.hub) {
            this.hub.emit('sequence-changed', {
                sequence: this.cloneSequence(this.sequence),
                settings: { ...this.sequenceSettings }
            });
        }
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
                    <label>
                        <span>Flourish Ease</span>
                        <select id="preset-flourish-curve"></select>
                    </label>
                    <label>
                        <span>Return Ease</span>
                        <select id="preset-flourish-return"></select>
                    </label>
                    <label>
                        <span>Hold (ms)</span>
                        <input type="number" id="preset-flourish-hold" min="0" max="4000" step="100" value="400">
                    </label>
                </div>
            </div>
            <div class="preset-list" id="preset-list"></div>
            <div class="sequence-builder">
                <div class="sequence-header">
                    <h4>Choreography Timeline</h4>
                    <div class="sequence-actions">
                        <button id="sequence-play">Play Sequence</button>
                        <button id="sequence-stop" class="secondary">Stop</button>
                        <button id="sequence-clear">Clear</button>
                    </div>
                </div>
                <div class="sequence-settings">
                    <label class="toggle-pill">
                        <input type="checkbox" id="sequence-loop">
                        <span>Loop</span>
                    </label>
                    <label class="toggle-pill">
                        <input type="checkbox" id="sequence-sync">
                        <span>Tempo Sync</span>
                    </label>
                    <label class="toggle-pill">
                        <input type="checkbox" id="sequence-quantize">
                        <span>Quantize</span>
                    </label>
                    <label>
                        <span>Subdivision</span>
                        <select id="sequence-subdivision">${this.renderTempoSubdivisionOptions(this.sequenceSettings.subdivision)}</select>
                    </label>
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
        this.populateFlourishCurves();
        this.bindEvents();
        this.applySequenceSettingsToControls();
        this.updateSequencePlaceholders();
    }

    populateFlourishParameterOptions() {
        const select = this.container.querySelector('#preset-flourish-parameter');
        if (!select || !this.parameterManager) return;

        const defaultValue = this.parameterOptions[0]?.id || '';
        select.innerHTML = this.renderParameterOptions(this.parameterOptions, defaultValue);
        select.value = defaultValue;
    }

    populateFlourishCurves() {
        const easeSelect = this.container.querySelector('#preset-flourish-curve');
        const returnSelect = this.container.querySelector('#preset-flourish-return');
        if (easeSelect) {
            easeSelect.innerHTML = this.renderFlourishCurveOptions('easeOut');
            easeSelect.value = 'easeOut';
        }
        if (returnSelect) {
            returnSelect.innerHTML = this.renderFlourishCurveOptions('easeInOut');
            returnSelect.value = 'easeInOut';
        }
    }

    bindEvents() {
        const saveBtn = this.container.querySelector('#preset-save');
        const updateBtn = this.container.querySelector('#preset-update');
        const resetBtn = this.container.querySelector('#preset-reset');
        const playBtn = this.container.querySelector('#sequence-play');
        const clearBtn = this.container.querySelector('#sequence-clear');
        const addBtn = this.container.querySelector('#sequence-add');
        const stopBtn = this.container.querySelector('#sequence-stop');
        const loopToggle = this.container.querySelector('#sequence-loop');
        const syncToggle = this.container.querySelector('#sequence-sync');
        const quantizeToggle = this.container.querySelector('#sequence-quantize');
        const subdivisionSelect = this.container.querySelector('#sequence-subdivision');

        saveBtn.addEventListener('click', () => this.savePreset());
        updateBtn.addEventListener('click', () => this.updatePreset());
        resetBtn.addEventListener('click', () => this.resetForm());
        playBtn.addEventListener('click', () => this.playSequence());
        clearBtn.addEventListener('click', () => this.clearSequence());
        addBtn.addEventListener('click', () => this.addSequenceCue());
        stopBtn.addEventListener('click', () => this.stopSequence());

        loopToggle.addEventListener('change', () => {
            this.sequenceSettings.loop = loopToggle.checked;
            this.renderSequence();
            this.notifySequenceChange();
        });

        syncToggle.addEventListener('change', () => {
            this.sequenceSettings.syncToTempo = syncToggle.checked;
            this.updateSequencePlaceholders();
            this.renderSequence();
            this.notifySequenceChange();
        });

        quantizeToggle.addEventListener('change', () => {
            this.sequenceSettings.quantize = quantizeToggle.checked;
            this.notifySequenceChange();
        });

        subdivisionSelect.addEventListener('change', () => {
            this.sequenceSettings.subdivision = subdivisionSelect.value;
            this.renderSequence();
            this.notifySequenceChange();
        });
    }

    applySequenceSettingsToControls() {
        const loopToggle = this.container.querySelector('#sequence-loop');
        const syncToggle = this.container.querySelector('#sequence-sync');
        const quantizeToggle = this.container.querySelector('#sequence-quantize');
        const subdivisionSelect = this.container.querySelector('#sequence-subdivision');
        if (loopToggle) loopToggle.checked = !!this.sequenceSettings.loop;
        if (syncToggle) syncToggle.checked = !!this.sequenceSettings.syncToTempo;
        if (quantizeToggle) quantizeToggle.checked = !!this.sequenceSettings.quantize;
        if (subdivisionSelect) subdivisionSelect.value = this.sequenceSettings.subdivision;
    }

    updateSequencePlaceholders() {
        const transitionInput = this.container.querySelector('#sequence-transition');
        const holdInput = this.container.querySelector('#sequence-hold');
        if (!transitionInput || !holdInput) return;
        if (this.sequenceSettings.syncToTempo) {
            transitionInput.placeholder = 'Transition (beats)';
            holdInput.placeholder = 'Hold (beats)';
        } else {
            transitionInput.placeholder = 'Transition ms';
            holdInput.placeholder = 'Hold ms';
        }
    }

    savePreset() {
        const nameInput = this.container.querySelector('#preset-name');
        const flourishSelect = this.container.querySelector('#preset-flourish-parameter');
        const flourishParam = flourishSelect?.value || this.parameterOptions[0]?.id || '';
        const flourishAmount = parseFloat(this.container.querySelector('#preset-flourish-amount').value);
        const flourishDuration = parseInt(this.container.querySelector('#preset-flourish-duration').value, 10);
        const flourishCurve = this.container.querySelector('#preset-flourish-curve')?.value || 'easeOut';
        const flourishReturn = this.container.querySelector('#preset-flourish-return')?.value || 'easeInOut';
        const flourishHold = parseInt(this.container.querySelector('#preset-flourish-hold').value, 10) || 0;

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
                duration: flourishDuration,
                curve: flourishCurve,
                returnCurve: flourishReturn,
                hold: flourishHold
            }
        };

        this.presets.push(preset);
        this.persistPresets();
        this.renderPresetList();
        this.renderSequenceOptions();
        this.resetForm();
        const snapshot = this.clonePreset(preset);
        if (this.hub) {
            this.hub.emit('preset-saved', { preset: snapshot });
        }
        this.notifyPresetListChange();
    }

    updatePreset() {
        if (!this.currentPresetId) return;

        const preset = this.presets.find(item => item.id === this.currentPresetId);
        if (!preset) return;

        const flourishSelect = this.container.querySelector('#preset-flourish-parameter');
        const flourishParam = flourishSelect?.value || this.parameterOptions[0]?.id || '';
        const flourishAmount = parseFloat(this.container.querySelector('#preset-flourish-amount').value);
        const flourishDuration = parseInt(this.container.querySelector('#preset-flourish-duration').value, 10);
        const flourishCurve = this.container.querySelector('#preset-flourish-curve')?.value || 'easeOut';
        const flourishReturn = this.container.querySelector('#preset-flourish-return')?.value || 'easeInOut';
        const flourishHold = parseInt(this.container.querySelector('#preset-flourish-hold').value, 10) || 0;
        const nameInput = this.container.querySelector('#preset-name');

        preset.name = nameInput.value.trim() || preset.name;
        preset.params = this.parameterManager?.getAllParameters() || preset.params;
        preset.mappings = this.touchPadController?.getMappings() || preset.mappings;
        preset.audio = this.audioPanel?.getSettings() || preset.audio;
        preset.flourish = {
            parameter: flourishParam,
            amount: flourishAmount,
            duration: flourishDuration,
            curve: flourishCurve,
            returnCurve: flourishReturn,
            hold: flourishHold
        };

        const snapshot = this.clonePreset(preset);
        this.persistPresets();
        this.renderPresetList();
        this.renderSequenceOptions();
        if (this.hub) {
            this.hub.emit('preset-updated', { preset: snapshot });
        }
        this.notifyPresetListChange();
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
        const curve = this.container.querySelector('#preset-flourish-curve');
        if (curve) curve.value = 'easeOut';
        const returnCurve = this.container.querySelector('#preset-flourish-return');
        if (returnCurve) returnCurve.value = 'easeInOut';
        const hold = this.container.querySelector('#preset-flourish-hold');
        if (hold) hold.value = 400;
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
                const flourishSummary = preset.flourish
                    ? `Flourish: ${this.getParameterLabel(preset.flourish.parameter)} (${preset.flourish.curve || 'easeOut'} → ${preset.flourish.returnCurve || 'easeInOut'})`
                    : 'Flourish: none';
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
        const curveSelect = this.container.querySelector('#preset-flourish-curve');
        if (curveSelect) {
            curveSelect.innerHTML = this.renderFlourishCurveOptions(curveSelect.value || 'easeOut');
            curveSelect.value = preset.flourish?.curve ?? 'easeOut';
        }
        const returnSelect = this.container.querySelector('#preset-flourish-return');
        if (returnSelect) {
            returnSelect.innerHTML = this.renderFlourishCurveOptions(returnSelect.value || 'easeInOut');
            returnSelect.value = preset.flourish?.returnCurve ?? 'easeInOut';
        }
        const holdInput = this.container.querySelector('#preset-flourish-hold');
        if (holdInput) {
            holdInput.value = preset.flourish?.hold ?? 400;
        }
        this.container.querySelector('#preset-update').disabled = false;
    }

    deletePreset(presetId) {
        this.presets = this.presets.filter(item => item.id !== presetId);
        this.persistPresets();
        this.renderPresetList();
        this.renderSequenceOptions();
        if (this.hub) {
            this.hub.emit('preset-deleted', { presetId });
        }
        this.notifyPresetListChange();
    }

    applyPreset(preset, options = {}) {
        const transition = options.transition || 1800;
        const snapshot = this.clonePreset(preset);
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
        if (this.hub) {
            this.hub.emit('preset-applied', { preset: snapshot, transition });
        }
    }

    triggerFlourish(preset) {
        if (!preset?.flourish || !this.parameterManager) return;

        const { parameter, amount, duration, hold = 0, curve = 'easeOut', returnCurve = 'easeInOut' } = preset.flourish;
        const definition = this.parameterManager.getParameterDefinition(parameter);
        if (!definition) return;

        const baseValue = this.parameterManager.getParameter(parameter);
        const span = definition.max - definition.min;
        const target = this.parameterManager.clampToDefinition(parameter, baseValue + span * amount);

        this.parameterManager.animateParameter(parameter, target, duration, {
            source: 'flourish',
            easing: curve,
            onComplete: () => {
                const resume = () => this.parameterManager.animateParameter(parameter, baseValue, duration, {
                    source: 'flourish-return',
                    easing: returnCurve
                });
                if (hold > 0) {
                    setTimeout(resume, hold);
                } else {
                    resume();
                }
            }
        });
        if (this.hub) {
            this.hub.emit('preset-flourish', {
                preset: this.clonePreset(preset),
                parameter,
                amount,
                duration,
                target,
                hold,
                curve,
                returnCurve
            });
        }
    }

    addSequenceCue() {
        const select = this.container.querySelector('#sequence-preset');
        const transitionInput = this.container.querySelector('#sequence-transition');
        const holdInput = this.container.querySelector('#sequence-hold');
        const flourishToggle = this.container.querySelector('#sequence-flourish');

        if (!select.value) return;

        const resolved = this.resolveCueInput(transitionInput.value, holdInput.value);
        const cue = {
            presetId: select.value,
            transition: resolved.transition,
            hold: resolved.hold,
            flourish: flourishToggle.checked,
            transitionBeats: resolved.transitionBeats,
            holdBeats: resolved.holdBeats,
            subdivision: resolved.subdivision,
            tempoSync: resolved.tempoSync
        };

        this.sequence.push(cue);

        flourishToggle.checked = false;
        this.renderSequence();
        this.notifySequenceChange();
    }

    renderSequence() {
        const list = this.container.querySelector('#sequence-list');
        if (!list) return;

        list.innerHTML = '';
        this.sequence.forEach((cue, index) => {
            const preset = this.presets.find(item => item.id === cue.presetId);
            if (!preset) return;

            const item = document.createElement('li');
            const durations = this.resolveCueDurations(cue);
            const transitionLabel = this.formatSequenceDuration(cue, durations, 'transition');
            const holdLabel = this.formatSequenceDuration(cue, durations, 'hold');
            const flags = [];
            if (cue.flourish) flags.push('flourish');
            if (this.sequenceSettings.syncToTempo || cue.tempoSync) flags.push('tempo-synced');
            const flagText = flags.length ? ` (${flags.join(', ')})` : '';
            item.innerHTML = `
                <span>${index + 1}. ${preset.name} — ${transitionLabel} transition, ${holdLabel} hold${flagText}</span>
                <button data-index="${index}">Remove</button>
            `;

            item.querySelector('button').addEventListener('click', () => {
                this.sequence.splice(index, 1);
                this.renderSequence();
                this.notifySequenceChange();
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

    renderFlourishCurveOptions(selectedValue) {
        return FLOURISH_CURVES
            .map(curve => `<option value="${curve.value}"${curve.value === selectedValue ? ' selected' : ''}>${curve.label}</option>`)
            .join('');
    }

    renderTempoSubdivisionOptions(selectedValue) {
        const tempoConfig = this.audioPanel?.config?.tempo || DEFAULT_PERFORMANCE_CONFIG.audio.tempo;
        const subdivisions = Array.isArray(tempoConfig?.subdivisions) && tempoConfig.subdivisions.length
            ? tempoConfig.subdivisions
            : DEFAULT_PERFORMANCE_CONFIG.audio.tempo.subdivisions;
        return subdivisions
            .map(option => `<option value="${option.value}"${option.value === selectedValue ? ' selected' : ''}>${option.label}</option>`)
            .join('');
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
                    bindings: pad.bindings || pad.axisBindings || {},
                    modes: pad.modes || pad.axisModes || {},
                    settings: pad.settings || pad.axisSettings || {},
                    gestureMode: pad.gestureMode || pad.gesture?.mode,
                    templateId: pad.templateId || null
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
                bindings: pad.bindings || pad.axisBindings || {},
                modes: pad.modes || pad.axisModes || {},
                settings: pad.settings || pad.axisSettings || {},
                gestureMode: pad.gestureMode || pad.gesture?.mode,
                templateId: pad.templateId || null
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
                const parts = ['x', 'y', 'gesture']
                    .map(axis => this.describeAxisMapping(axis, pad))
                    .filter(Boolean);
                const templateLabel = this.touchPadController?.getTemplateLabel?.(pad.templateId);
                const padLabel = templateLabel
                    ? `Pad ${(pad.id ?? 0) + 1} (${templateLabel})`
                    : `Pad ${(pad.id ?? 0) + 1}`;
                return `${padLabel}: ${parts.join(' • ')}`;
            })
            .join(' • ');
    }

    describeAxisMapping(axis, pad) {
        const label = axis === 'x' ? 'X' : axis === 'y' ? 'Y' : 'Gesture';
        const binding = pad.bindings?.[axis];
        const parameterLabel = this.getParameterLabel(binding);

        if (!binding || binding === 'none') {
            return `${label} → None`;
        }

        const details = [];
        if (axis === 'gesture' && pad.gestureMode) {
            const interpretation = this.gestureModeLabels.get(pad.gestureMode) || pad.gestureMode;
            if (interpretation) {
                details.push(interpretation);
            }
        }
        const mode = pad.modes?.[axis];
        const modeLabel = this.axisModeLabels.get(mode) || mode;
        if (modeLabel) {
            details.push(modeLabel);
        }

        const curve = pad.settings?.curve?.[axis];
        const curveLabel = this.axisCurveLabels.get(curve);
        if (curve && curveLabel && curve !== 'linear') {
            details.push(curveLabel);
        }

        if (pad.settings?.invert?.[axis]) {
            details.push('Invert');
        }

        const smoothing = pad.settings?.smoothing?.[axis];
        if (typeof smoothing === 'number' && smoothing > (this.axisSmoothingMin ?? 0)) {
            const max = this.axisSmoothingMax || 1;
            const percentage = Math.round((smoothing / max) * 100);
            details.push(`Smooth ${percentage}%`);
        }

        const detailText = details.length ? ` (${details.join(' · ')})` : '';
        return `${label} → ${parameterLabel}${detailText}`;
    }

    getTempoSettings() {
        const audioSettings = this.audioPanel?.getSettings?.() || {};
        const tempo = audioSettings.tempo || {};
        const baseBpm = Math.max(40, tempo.bpm ?? DEFAULT_PERFORMANCE_CONFIG.audio.tempo.defaultBpm);
        const nudge = Number.isFinite(tempo.nudge) ? tempo.nudge : 0;
        const effectiveBpm = Math.max(40, baseBpm * (1 + nudge));
        return {
            bpm: effectiveBpm,
            rawBpm: baseBpm,
            subdivision: tempo.subdivision || tempo.defaultSubdivision || DEFAULT_PERFORMANCE_CONFIG.audio.tempo.defaultSubdivision || '1/4'
        };
    }

    getSubdivisionMultiplier(subdivision) {
        if (typeof subdivision !== 'string') return 1;
        const isTriplet = subdivision.endsWith('T');
        const fraction = isTriplet ? subdivision.slice(0, -1) : subdivision;
        const [numerator, denominator] = fraction.split('/').map(value => parseFloat(value));
        if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
            return 1;
        }
        let beats = (4 / denominator) * numerator;
        if (isTriplet) {
            beats *= 2 / 3;
        }
        return beats;
    }

    beatsToMs(beats, bpm) {
        const safeBpm = Math.max(1, bpm || 120);
        return (60000 / safeBpm) * beats;
    }

    msToBeats(ms, bpm) {
        const safeBpm = Math.max(1, bpm || 120);
        return ms / (60000 / safeBpm);
    }

    applyQuantization(value) {
        if (!Number.isFinite(value)) return 0;
        return Math.max(0, Math.round(value * 4) / 4);
    }

    resolveCueInput(transitionValue, holdValue) {
        const tempo = this.getTempoSettings();
        const subdivision = this.sequenceSettings.subdivision || tempo.subdivision;
        const multiplier = this.getSubdivisionMultiplier(subdivision);

        if (this.sequenceSettings.syncToTempo) {
            let transitionBeats = parseFloat(transitionValue);
            if (!Number.isFinite(transitionBeats)) transitionBeats = 1;
            let holdBeats = parseFloat(holdValue);
            if (!Number.isFinite(holdBeats)) holdBeats = 0;
            if (this.sequenceSettings.quantize) {
                transitionBeats = this.applyQuantization(transitionBeats);
                holdBeats = this.applyQuantization(holdBeats);
            }
            const transitionMs = this.beatsToMs(transitionBeats * multiplier, tempo.bpm);
            const holdMs = this.beatsToMs(holdBeats * multiplier, tempo.bpm);
            return {
                transition: Math.round(transitionMs),
                hold: Math.round(holdMs),
                transitionBeats,
                holdBeats,
                subdivision,
                tempoSync: true
            };
        }

        const transitionMs = parseInt(transitionValue, 10) || 0;
        const holdMs = parseInt(holdValue, 10) || 0;
        const transitionBeats = this.msToBeats(transitionMs, tempo.bpm) / multiplier;
        const holdBeats = this.msToBeats(holdMs, tempo.bpm) / multiplier;
        return {
            transition: transitionMs,
            hold: holdMs,
            transitionBeats,
            holdBeats,
            subdivision,
            tempoSync: false
        };
    }

    resolveCueDurations(cue) {
        const tempo = this.getTempoSettings();
        const subdivision = cue.subdivision || this.sequenceSettings.subdivision || tempo.subdivision;
        const multiplier = this.getSubdivisionMultiplier(subdivision);
        if (this.sequenceSettings.syncToTempo || cue.tempoSync) {
            const transitionBeats = Number.isFinite(cue.transitionBeats)
                ? cue.transitionBeats
                : this.msToBeats(cue.transition, tempo.bpm) / multiplier;
            const holdBeats = Number.isFinite(cue.holdBeats)
                ? cue.holdBeats
                : this.msToBeats(cue.hold, tempo.bpm) / multiplier;
            const transitionMs = this.beatsToMs(transitionBeats * multiplier, tempo.bpm);
            const holdMs = this.beatsToMs(holdBeats * multiplier, tempo.bpm);
            return {
                transition: Math.round(transitionMs),
                hold: Math.round(holdMs)
            };
        }
        return {
            transition: cue.transition,
            hold: cue.hold
        };
    }

    formatSequenceDuration(cue, durations, type) {
        const tempo = this.getTempoSettings();
        const subdivision = cue.subdivision || this.sequenceSettings.subdivision || tempo.subdivision;
        const multiplier = this.getSubdivisionMultiplier(subdivision);
        const msValue = type === 'transition' ? durations.transition : durations.hold;
        const beats = type === 'transition'
            ? (Number.isFinite(cue.transitionBeats) ? cue.transitionBeats : this.msToBeats(durations.transition, tempo.bpm) / multiplier)
            : (Number.isFinite(cue.holdBeats) ? cue.holdBeats : this.msToBeats(durations.hold, tempo.bpm) / multiplier);
        if (this.sequenceSettings.syncToTempo || cue.tempoSync) {
            return `${msValue}ms (${beats.toFixed(2)}×${subdivision})`;
        }
        return `${msValue}ms`;
    }

    async playSequence() {
        if (this.sequencePlaying || this.sequence.length === 0) return;

        this.sequencePlaying = true;
        this.sequenceAbort = false;
        if (this.hub) {
            this.hub.emit('sequence-play-started', {
                sequence: this.cloneSequence(this.sequence)
            });
        }
        const runOnce = async () => {
            for (const cue of this.sequence) {
                if (this.sequenceAbort) break;
                const preset = this.presets.find(item => item.id === cue.presetId);
                if (!preset) continue;

                const durations = this.resolveCueDurations(cue);
                this.applyPreset(preset, { transition: durations.transition });
                if (this.hub) {
                    this.hub.emit('sequence-play-step', {
                        preset: this.clonePreset(preset),
                        cue: { ...cue },
                        durations
                    });
                }
                if (cue.flourish) {
                    setTimeout(() => this.triggerFlourish(preset), Math.max(0, durations.transition / 2));
                }

                await this.wait(durations.transition + durations.hold);
                if (this.sequenceAbort) break;
            }
        };

        do {
            await runOnce();
        } while (this.sequenceSettings.loop && !this.sequenceAbort);

        this.sequencePlaying = false;
        this.sequenceAbort = false;
        this.sequenceWaitTimeout = null;
        if (this.hub) {
            this.hub.emit('sequence-play-complete', {});
        }
    }

    clearSequence() {
        this.sequence = [];
        this.sequenceAbort = false;
        this.sequencePlaying = false;
        if (this.sequenceWaitTimeout) {
            clearTimeout(this.sequenceWaitTimeout);
            this.sequenceWaitTimeout = null;
        }
        this.renderSequence();
        this.notifySequenceChange();
    }

    wait(duration) {
        return new Promise(resolve => {
            if (this.sequenceAbort) {
                resolve();
                return;
            }
            this.sequenceWaitTimeout = setTimeout(() => {
                this.sequenceWaitTimeout = null;
                resolve();
            }, duration);
        });
    }

    stopSequence() {
        if (!this.sequencePlaying) return;
        this.sequenceAbort = true;
        if (this.sequenceWaitTimeout) {
            clearTimeout(this.sequenceWaitTimeout);
            this.sequenceWaitTimeout = null;
        }
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
