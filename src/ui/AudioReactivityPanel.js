import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

/**
 * Audio Reactivity Control Panel
 * Provides live performance grade audio mapping configuration
 */

const DEFAULT_SETTINGS = {
    master: true,
    globalSensitivity: 1.0,
    smoothing: 0.35,
    tempo: {
        enabled: false,
        bpm: 120,
        subdivision: '1/4',
        followClock: false
    },
    gating: {
        enabled: true,
        freezeWhenSilent: true,
        silenceThreshold: 0.08,
        holdMs: 420
    },
    envelope: {
        attack: 160,
        release: 340
    },
    bands: {
        bass: { enabled: true, parameter: 'gridDensity', mode: 'swing', depth: 0.7, curve: 1.2 },
        mid: { enabled: true, parameter: 'hue', mode: 'absolute', depth: 0.6, curve: 1.1 },
        high: { enabled: true, parameter: 'intensity', mode: 'absolute', depth: 0.5, curve: 1.3 },
        energy: { enabled: true, parameter: 'speed', mode: 'absolute', depth: 0.5, curve: 1.0 },
        rhythm: { enabled: false, parameter: 'chaos', mode: 'swing', depth: 0.4, curve: 1.0 }
    },
    flourish: {
        enabled: true,
        band: 'energy',
        threshold: 0.65,
        boost: 0.45,
        parameter: 'intensity',
        duration: 1400,
        cooldown: 1600
    }
};

export class AudioReactivityPanel {
    constructor(options = {}) {
        const {
            parameterManager,
            container = null,
            onSettingsChange = null,
            settings = null,
            config = DEFAULT_PERFORMANCE_CONFIG.audio,
            hub = null
        } = options;

        this.parameterManager = parameterManager;
        this.onSettingsChange = onSettingsChange;
        this.hub = hub;
        this.config = config || DEFAULT_PERFORMANCE_CONFIG.audio;
        this.availableParameters = this.buildParameterOptions();
        this.parameterLabels = new Map(this.availableParameters.map(meta => [meta.id, meta.label]));
        this.tempoOptions = this.getTempoSubdivisionOptions();
        this.settings = this.mergeSettings(DEFAULT_SETTINGS, settings || {});
        this.ensureTempoOptionExists(this.settings.tempo?.subdivision);
        this.container = container || this.ensureContainer();
        this.bandControls = new Map();
        this.rhythmControls = null;

        this.buildUI();
        this.applySettingsToControls();
        this.notifyChange();
    }

    buildParameterOptions() {
        if (!this.parameterManager) return [];
        return this.parameterManager.listParameterMetadata().map(meta => ({
            id: meta.id,
            label: meta.label,
            group: meta.group || 'General'
        }));
    }

    getTempoSubdivisionOptions() {
        if (Array.isArray(this.config?.tempo?.subdivisions) && this.config.tempo.subdivisions.length) {
            return this.config.tempo.subdivisions.map(option => ({ ...option }));
        }

        return [
            { value: '1/2', label: 'Half' },
            { value: '1/4', label: 'Quarter' },
            { value: '1/8', label: 'Eighth' },
            { value: '1/16', label: 'Sixteenth' }
        ];
    }

    ensureTempoOptionExists(value) {
        if (!value) return;
        if (this.tempoOptions.some(option => option.value === value)) {
            return;
        }
        this.tempoOptions.push({ value, label: value });
    }

    renderParameterOptions(selectedValue, { allowNone = false } = {}) {
        const groups = new Map();
        this.availableParameters.forEach(meta => {
            const group = meta.group || 'General';
            if (!groups.has(group)) {
                groups.set(group, []);
            }
            groups.get(group).push(meta);
        });

        const fragments = [];

        if (allowNone) {
            fragments.push(`<option value="none"${selectedValue === 'none' ? ' selected' : ''}>None</option>`);
        }

        groups.forEach((options, group) => {
            const optionMarkup = options
                .sort((a, b) => a.label.localeCompare(b.label))
                .map(option => `<option value="${option.id}"${option.id === selectedValue ? ' selected' : ''}>${option.label}</option>`)
                .join('');
            fragments.push(`<optgroup label="${group}">${optionMarkup}</optgroup>`);
        });

        if (fragments.length === 0) {
            return '<option value="" disabled>No parameters</option>';
        }

        return fragments.join('');
    }

    renderSubdivisionOptions(selectedValue) {
        return this.tempoOptions
            .map(option => `<option value="${option.value}"${option.value === selectedValue ? ' selected' : ''}>${option.label}</option>`)
            .join('');
    }

    renderModeOptions(selectedValue) {
        const modes = Array.isArray(this.config?.modes) && this.config.modes.length > 0
            ? this.config.modes
            : [
                { value: 'absolute', label: 'Absolute' },
                { value: 'swing', label: 'Swing' },
                { value: 'relative', label: 'Relative' }
            ];

        return modes
            .map(mode => `<option value="${mode.value}"${mode.value === selectedValue ? ' selected' : ''}>${mode.label}</option>`)
            .join('');
    }

    ensureContainer() {
        const existing = document.getElementById('performance-audio-reactivity');
        if (existing) return existing;

        const section = document.createElement('section');
        section.id = 'performance-audio-reactivity';
        section.classList.add('performance-audio');
        document.body.appendChild(section);
        return section;
    }

    buildUI() {
        this.container.innerHTML = '';
        this.bandControls.clear();

        const header = document.createElement('header');
        header.classList.add('performance-section-header');
        header.innerHTML = `
            <div>
                <h3>Audio Reactivity Matrix</h3>
                <p class="performance-subtitle">Tune frequency bands, sensitivity and dynamic flourishes for synced shows.</p>
            </div>
            <label class="toggle-pill">
                <input type="checkbox" id="audio-master-toggle" ${this.settings.master ? 'checked' : ''}>
                <span>Audio Reactive</span>
            </label>
        `;

        this.container.appendChild(header);

        const globalControls = document.createElement('div');
        globalControls.classList.add('audio-global-controls');
        globalControls.innerHTML = `
            <label>
                <span>Sensitivity</span>
                <input type="range" id="audio-sensitivity" min="0.2" max="3" step="0.05" value="${this.settings.globalSensitivity}">
            </label>
            <label>
                <span>Smoothing</span>
                <input type="range" id="audio-smoothing" min="0" max="0.9" step="0.05" value="${this.settings.smoothing}">
            </label>
        `;

        this.container.appendChild(globalControls);

        this.rhythmControls = this.createRhythmControls();
        this.container.appendChild(this.rhythmControls);

        const bandGrid = document.createElement('div');
        bandGrid.classList.add('audio-band-grid');
        this.container.appendChild(bandGrid);

        Object.entries(this.settings.bands).forEach(([band, bandSettings]) => {
            const bandElement = this.createBandControl(band, bandSettings);
            bandGrid.appendChild(bandElement);
        });

        const flourishSection = document.createElement('div');
        flourishSection.classList.add('audio-flourish');
        flourishSection.innerHTML = `
            <div class="flourish-header">
                <h4>Reactive Flourish</h4>
                <label class="toggle-pill">
                    <input type="checkbox" id="flourish-toggle" ${this.settings.flourish.enabled ? 'checked' : ''}>
                    <span>Enable</span>
                </label>
            </div>
            <div class="flourish-grid">
                <label>
                    <span>Trigger Band</span>
                    <select id="flourish-band">
                        ${Object.keys(this.settings.bands).map(band => `<option value="${band}">${this.formatBandLabel(band)}</option>`).join('')}
                    </select>
                </label>
                <label>
                    <span>Parameter</span>
                    <select id="flourish-parameter">
                        ${this.renderParameterOptions(this.settings.flourish.parameter)}
                    </select>
                </label>
                <label>
                    <span>Threshold</span>
                    <input type="range" id="flourish-threshold" min="0.2" max="0.95" step="0.05" value="${this.settings.flourish.threshold}">
                </label>
                <label>
                    <span>Boost</span>
                    <input type="range" id="flourish-boost" min="0.1" max="1" step="0.05" value="${this.settings.flourish.boost}">
                </label>
                <label>
                    <span>Duration (ms)</span>
                    <input type="number" id="flourish-duration" min="200" max="6000" step="100" value="${this.settings.flourish.duration}">
                </label>
                <label>
                    <span>Cooldown (ms)</span>
                    <input type="number" id="flourish-cooldown" min="200" max="6000" step="100" value="${this.settings.flourish.cooldown}">
                </label>
            </div>
        `;

        this.container.appendChild(flourishSection);

        this.bindGlobalEvents();
        this.bindRhythmEvents();
        this.bindFlourishEvents();
    }

    createRhythmControls() {
        const wrapper = document.createElement('div');
        wrapper.classList.add('audio-rhythm-controls');
        wrapper.innerHTML = `
            <div class="audio-rhythm-header">
                <h4>Rhythm &amp; Dynamics</h4>
                <p>Quantize modulation steps, gate silence, and tune response curves for stage pacing.</p>
            </div>
            <div class="audio-rhythm-grid">
                <label class="toggle-pill">
                    <input type="checkbox" id="audio-tempo-enabled" ${this.settings.tempo.enabled ? 'checked' : ''}>
                    <span>Quantize to tempo</span>
                </label>
                <label>
                    <span>BPM</span>
                    <input type="number" id="audio-tempo-bpm" min="40" max="220" step="1" value="${this.settings.tempo.bpm}">
                </label>
                <label>
                    <span>Subdivision</span>
                    <select id="audio-tempo-subdivision">
                        ${this.renderSubdivisionOptions(this.settings.tempo.subdivision)}
                    </select>
                </label>
                <label class="toggle-pill">
                    <input type="checkbox" id="audio-tempo-follow" ${this.settings.tempo.followClock ? 'checked' : ''}>
                    <span>Follow global clock</span>
                </label>
                <label class="toggle-pill">
                    <input type="checkbox" id="audio-gating-enabled" ${this.settings.gating.enabled ? 'checked' : ''}>
                    <span>Silence gate</span>
                </label>
                <label class="toggle-pill">
                    <input type="checkbox" id="audio-gating-freeze" ${this.settings.gating.freezeWhenSilent ? 'checked' : ''}>
                    <span>Freeze when silent</span>
                </label>
                <label>
                    <span>Silence threshold</span>
                    <div class="range-with-value">
                        <input type="range" id="audio-gating-threshold" min="0" max="0.5" step="0.01" value="${this.settings.gating.silenceThreshold}">
                        <span data-audio-threshold-value>${this.settings.gating.silenceThreshold.toFixed(2)}</span>
                    </div>
                </label>
                <label>
                    <span>Hold (ms)</span>
                    <input type="number" id="audio-gating-hold" min="0" max="6000" step="20" value="${this.settings.gating.holdMs}">
                </label>
                <label>
                    <span>Attack (ms)</span>
                    <input type="number" id="audio-envelope-attack" min="0" max="3000" step="10" value="${this.settings.envelope.attack}">
                </label>
                <label>
                    <span>Release (ms)</span>
                    <input type="number" id="audio-envelope-release" min="0" max="4000" step="10" value="${this.settings.envelope.release}">
                </label>
            </div>
        `;
        return wrapper;
    }

    createBandControl(band, bandSettings) {
        const bandElement = document.createElement('div');
        bandElement.classList.add('audio-band');
        bandElement.dataset.band = band;
        bandElement.innerHTML = `
            <div class="band-header">
                <label class="toggle-pill">
                    <input type="checkbox" data-band-toggle value="${band}" ${bandSettings.enabled ? 'checked' : ''}>
                    <span>${this.formatBandLabel(band)}</span>
                </label>
                <span class="band-preview" data-band-preview>${this.getParameterLabel(bandSettings.parameter)}</span>
            </div>
            <div class="band-control-grid">
                <label>
                    <span>Parameter</span>
                    <select data-band-parameter>
                        ${this.renderParameterOptions(bandSettings.parameter)}
                    </select>
                </label>
                <label>
                    <span>Mode</span>
                    <select data-band-mode>
                        ${this.renderModeOptions(bandSettings.mode)}
                    </select>
                </label>
                <label>
                    <span>Depth</span>
                    <input type="range" data-band-depth min="0" max="1" step="0.05" value="${bandSettings.depth}">
                </label>
                <label>
                    <span>Curve</span>
                    <input type="range" data-band-curve min="0.5" max="3" step="0.1" value="${bandSettings.curve}">
                </label>
            </div>
        `;

        const controls = {
            toggle: bandElement.querySelector('[data-band-toggle]'),
            parameter: bandElement.querySelector('[data-band-parameter]'),
            mode: bandElement.querySelector('[data-band-mode]'),
            depth: bandElement.querySelector('[data-band-depth]'),
            curve: bandElement.querySelector('[data-band-curve]'),
            preview: bandElement.querySelector('[data-band-preview]')
        };

        controls.parameter.value = bandSettings.parameter;
        if (controls.parameter.value !== bandSettings.parameter) {
            controls.parameter.selectedIndex = 0;
        }
        controls.mode.value = bandSettings.mode;
        if (controls.mode.value !== bandSettings.mode) {
            controls.mode.selectedIndex = 0;
            this.settings.bands[band].mode = controls.mode.value;
        }

        controls.parameter.addEventListener('change', () => {
            this.settings.bands[band].parameter = controls.parameter.value;
            controls.preview.textContent = this.getParameterLabel(controls.parameter.value);
            this.notifyChange();
        });

        controls.mode.addEventListener('change', () => {
            this.settings.bands[band].mode = controls.mode.value;
            this.notifyChange();
        });

        controls.depth.addEventListener('input', () => {
            this.settings.bands[band].depth = parseFloat(controls.depth.value);
            this.notifyChange();
        });

        controls.curve.addEventListener('input', () => {
            this.settings.bands[band].curve = parseFloat(controls.curve.value);
            this.notifyChange();
        });

        controls.toggle.addEventListener('change', () => {
            this.settings.bands[band].enabled = controls.toggle.checked;
            bandElement.classList.toggle('disabled', !controls.toggle.checked);
            this.notifyChange();
        });

        bandElement.classList.toggle('disabled', !controls.toggle.checked);

        this.bandControls.set(band, controls);
        return bandElement;
    }

    bindGlobalEvents() {
        const masterToggle = this.container.querySelector('#audio-master-toggle');
        const sensitivityRange = this.container.querySelector('#audio-sensitivity');
        const smoothingRange = this.container.querySelector('#audio-smoothing');

        masterToggle.addEventListener('change', () => {
            this.settings.master = masterToggle.checked;
            this.notifyChange();
        });

        sensitivityRange.addEventListener('input', () => {
            this.settings.globalSensitivity = parseFloat(sensitivityRange.value);
            this.notifyChange();
        });

        smoothingRange.addEventListener('input', () => {
            this.settings.smoothing = parseFloat(smoothingRange.value);
            this.notifyChange();
        });
    }

    bindRhythmEvents() {
        const tempoToggle = this.container.querySelector('#audio-tempo-enabled');
        const tempoBpm = this.container.querySelector('#audio-tempo-bpm');
        const tempoSubdivision = this.container.querySelector('#audio-tempo-subdivision');
        const tempoFollow = this.container.querySelector('#audio-tempo-follow');
        const gateToggle = this.container.querySelector('#audio-gating-enabled');
        const gateFreeze = this.container.querySelector('#audio-gating-freeze');
        const gateThreshold = this.container.querySelector('#audio-gating-threshold');
        const gateHold = this.container.querySelector('#audio-gating-hold');
        const thresholdDisplay = this.container.querySelector('[data-audio-threshold-value]');
        const attackInput = this.container.querySelector('#audio-envelope-attack');
        const releaseInput = this.container.querySelector('#audio-envelope-release');

        const updateThresholdDisplay = () => {
            if (thresholdDisplay && gateThreshold) {
                thresholdDisplay.textContent = parseFloat(gateThreshold.value).toFixed(2);
            }
        };

        if (tempoToggle) {
            tempoToggle.addEventListener('change', () => {
                this.settings.tempo.enabled = tempoToggle.checked;
                this.notifyChange();
            });
        }

        if (tempoBpm) {
            tempoBpm.addEventListener('input', () => {
                const value = parseInt(tempoBpm.value, 10);
                if (Number.isFinite(value)) {
                    this.settings.tempo.bpm = Math.max(30, Math.min(360, value));
                    tempoBpm.value = this.settings.tempo.bpm;
                    this.notifyChange();
                }
            });
        }

        if (tempoSubdivision) {
            tempoSubdivision.addEventListener('change', () => {
                this.settings.tempo.subdivision = tempoSubdivision.value;
                this.ensureTempoOptionExists(tempoSubdivision.value);
                this.notifyChange();
            });
        }

        if (tempoFollow) {
            tempoFollow.addEventListener('change', () => {
                this.settings.tempo.followClock = tempoFollow.checked;
                this.notifyChange();
            });
        }

        if (gateToggle) {
            gateToggle.addEventListener('change', () => {
                this.settings.gating.enabled = gateToggle.checked;
                this.notifyChange();
            });
        }

        if (gateFreeze) {
            gateFreeze.addEventListener('change', () => {
                this.settings.gating.freezeWhenSilent = gateFreeze.checked;
                this.notifyChange();
            });
        }

        if (gateThreshold) {
            gateThreshold.addEventListener('input', () => {
                this.settings.gating.silenceThreshold = parseFloat(gateThreshold.value);
                updateThresholdDisplay();
                this.notifyChange();
            });
        }

        if (gateHold) {
            gateHold.addEventListener('input', () => {
                const value = parseInt(gateHold.value, 10);
                if (Number.isFinite(value)) {
                    this.settings.gating.holdMs = Math.max(0, value);
                    gateHold.value = this.settings.gating.holdMs;
                    this.notifyChange();
                }
            });
        }

        if (attackInput) {
            attackInput.addEventListener('input', () => {
                const value = parseInt(attackInput.value, 10);
                if (Number.isFinite(value)) {
                    this.settings.envelope.attack = Math.max(0, value);
                    attackInput.value = this.settings.envelope.attack;
                    this.notifyChange();
                }
            });
        }

        if (releaseInput) {
            releaseInput.addEventListener('input', () => {
                const value = parseInt(releaseInput.value, 10);
                if (Number.isFinite(value)) {
                    this.settings.envelope.release = Math.max(0, value);
                    releaseInput.value = this.settings.envelope.release;
                    this.notifyChange();
                }
            });
        }

        updateThresholdDisplay();
    }

    bindFlourishEvents() {
        const toggle = this.container.querySelector('#flourish-toggle');
        const bandSelect = this.container.querySelector('#flourish-band');
        const parameterSelect = this.container.querySelector('#flourish-parameter');
        const thresholdRange = this.container.querySelector('#flourish-threshold');
        const boostRange = this.container.querySelector('#flourish-boost');
        const durationInput = this.container.querySelector('#flourish-duration');
        const cooldownInput = this.container.querySelector('#flourish-cooldown');

        toggle.addEventListener('change', () => {
            this.settings.flourish.enabled = toggle.checked;
            this.notifyChange();
        });

        bandSelect.value = this.settings.flourish.band;
        bandSelect.addEventListener('change', () => {
            this.settings.flourish.band = bandSelect.value;
            this.notifyChange();
        });

        parameterSelect.value = this.settings.flourish.parameter;
        parameterSelect.addEventListener('change', () => {
            this.settings.flourish.parameter = parameterSelect.value;
            this.notifyChange();
        });

        thresholdRange.addEventListener('input', () => {
            this.settings.flourish.threshold = parseFloat(thresholdRange.value);
            this.notifyChange();
        });

        boostRange.addEventListener('input', () => {
            this.settings.flourish.boost = parseFloat(boostRange.value);
            this.notifyChange();
        });

        durationInput.addEventListener('input', () => {
            this.settings.flourish.duration = parseInt(durationInput.value, 10);
            this.notifyChange();
        });

        cooldownInput.addEventListener('input', () => {
            this.settings.flourish.cooldown = parseInt(cooldownInput.value, 10);
            this.notifyChange();
        });
    }

    applySettingsToControls() {
        // Ensure controls reflect current settings (for external updates)
        this.bandControls.forEach((controls, band) => {
            const bandSettings = this.settings.bands[band];
            if (!bandSettings) return;
            controls.toggle.checked = !!bandSettings.enabled;
            controls.parameter.value = bandSettings.parameter;
            if (controls.parameter.value !== bandSettings.parameter) {
                controls.parameter.selectedIndex = 0;
            }
            controls.mode.value = bandSettings.mode;
            if (controls.mode.value !== bandSettings.mode) {
                controls.mode.selectedIndex = 0;
                this.settings.bands[band].mode = controls.mode.value;
            }
            controls.depth.value = bandSettings.depth;
            controls.curve.value = bandSettings.curve;
            controls.preview.textContent = this.getParameterLabel(controls.parameter.value);
            controls.toggle.dispatchEvent(new Event('change'));
        });

        const bandSelect = this.container.querySelector('#flourish-band');
        const parameterSelect = this.container.querySelector('#flourish-parameter');
        const thresholdRange = this.container.querySelector('#flourish-threshold');
        const boostRange = this.container.querySelector('#flourish-boost');
        const durationInput = this.container.querySelector('#flourish-duration');
        const cooldownInput = this.container.querySelector('#flourish-cooldown');
        const toggle = this.container.querySelector('#flourish-toggle');
        const tempoToggle = this.container.querySelector('#audio-tempo-enabled');
        const tempoBpm = this.container.querySelector('#audio-tempo-bpm');
        const tempoSubdivision = this.container.querySelector('#audio-tempo-subdivision');
        const tempoFollow = this.container.querySelector('#audio-tempo-follow');
        const gateToggle = this.container.querySelector('#audio-gating-enabled');
        const gateFreeze = this.container.querySelector('#audio-gating-freeze');
        const gateThreshold = this.container.querySelector('#audio-gating-threshold');
        const gateHold = this.container.querySelector('#audio-gating-hold');
        const thresholdDisplay = this.container.querySelector('[data-audio-threshold-value]');
        const attackInput = this.container.querySelector('#audio-envelope-attack');
        const releaseInput = this.container.querySelector('#audio-envelope-release');

        if (bandSelect) bandSelect.value = this.settings.flourish.band;
        if (parameterSelect) {
            parameterSelect.value = this.settings.flourish.parameter;
            if (parameterSelect.value !== this.settings.flourish.parameter && parameterSelect.options.length > 0) {
                parameterSelect.selectedIndex = 0;
            }
        }
        if (thresholdRange) thresholdRange.value = this.settings.flourish.threshold;
        if (boostRange) boostRange.value = this.settings.flourish.boost;
        if (durationInput) durationInput.value = this.settings.flourish.duration;
        if (cooldownInput) cooldownInput.value = this.settings.flourish.cooldown;
        if (toggle) toggle.checked = this.settings.flourish.enabled;
        if (tempoToggle) tempoToggle.checked = !!this.settings.tempo.enabled;
        if (tempoBpm) tempoBpm.value = this.settings.tempo.bpm;
        if (tempoSubdivision) {
            this.ensureTempoOptionExists(this.settings.tempo.subdivision);
            if (!Array.from(tempoSubdivision.options).some(option => option.value === this.settings.tempo.subdivision)) {
                const option = document.createElement('option');
                option.value = this.settings.tempo.subdivision;
                option.textContent = this.tempoOptions.find(opt => opt.value === option.value)?.label || option.value;
                tempoSubdivision.appendChild(option);
            }
            tempoSubdivision.value = this.settings.tempo.subdivision;
        }
        if (tempoFollow) tempoFollow.checked = !!this.settings.tempo.followClock;
        if (gateToggle) gateToggle.checked = !!this.settings.gating.enabled;
        if (gateFreeze) gateFreeze.checked = !!this.settings.gating.freezeWhenSilent;
        if (gateThreshold) gateThreshold.value = this.settings.gating.silenceThreshold;
        if (gateHold) gateHold.value = this.settings.gating.holdMs;
        if (thresholdDisplay && gateThreshold) {
            thresholdDisplay.textContent = parseFloat(gateThreshold.value).toFixed(2);
        }
        if (attackInput) attackInput.value = this.settings.envelope.attack;
        if (releaseInput) releaseInput.value = this.settings.envelope.release;
    }

    mergeSettings(base, overrides) {
        const merged = JSON.parse(JSON.stringify(base));
        if (!overrides) return merged;

        if (typeof overrides.master === 'boolean') merged.master = overrides.master;
        if (typeof overrides.globalSensitivity === 'number') merged.globalSensitivity = overrides.globalSensitivity;
        if (typeof overrides.smoothing === 'number') merged.smoothing = overrides.smoothing;

        if (overrides.tempo) {
            merged.tempo = { ...merged.tempo, ...overrides.tempo };
            this.ensureTempoOptionExists(merged.tempo.subdivision);
        }

        if (overrides.gating) {
            merged.gating = { ...merged.gating, ...overrides.gating };
        }

        if (overrides.envelope) {
            merged.envelope = { ...merged.envelope, ...overrides.envelope };
        }

        if (overrides.bands) {
            Object.entries(overrides.bands).forEach(([band, config]) => {
                merged.bands[band] = { ...merged.bands[band], ...config };
            });
        }

        if (overrides.flourish) {
            merged.flourish = { ...merged.flourish, ...overrides.flourish };
        }

        return merged;
    }

    formatBandLabel(band) {
        return band.charAt(0).toUpperCase() + band.slice(1);
    }

    getParameterLabel(name) {
        if (!name || name === 'none') {
            return 'None';
        }
        return this.parameterLabels.get(name)
            || this.parameterManager?.formatParameterLabel?.(name)
            || this.formatFallbackName(name);
    }

    formatFallbackName(name) {
        return name
            .replace(/rot4d/gi, '4D ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, char => char.toUpperCase())
            .trim();
    }

    formatParameterName(name) {
        return this.getParameterLabel(name);
    }

    getSettings() {
        return JSON.parse(JSON.stringify(this.settings));
    }

    notifyChange() {
        const snapshot = this.getSettings();
        const payload = JSON.parse(JSON.stringify(snapshot));
        if (typeof this.onSettingsChange === 'function') {
            this.onSettingsChange(snapshot);
        }
        if (this.hub) {
            this.hub.emit('audio-settings-change', { settings: payload });
        }
    }

    setSettings(settings) {
        this.settings = this.mergeSettings(DEFAULT_SETTINGS, settings || {});
        this.availableParameters = this.buildParameterOptions();
        this.parameterLabels = new Map(this.availableParameters.map(meta => [meta.id, meta.label]));
        this.tempoOptions = this.getTempoSubdivisionOptions();
        this.ensureTempoOptionExists(this.settings.tempo?.subdivision);
        this.buildUI();
        this.applySettingsToControls();
        this.notifyChange();
    }

    exportState() {
        return this.getSettings();
    }

    importState(state) {
        if (!state) return;
        this.setSettings(state);
    }

    destroy() {
        this.bandControls.clear();
    }
}
