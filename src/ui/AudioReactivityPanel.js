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
        bpm: DEFAULT_PERFORMANCE_CONFIG.audio?.tempo?.defaultBpm ?? 120,
        subdivision: DEFAULT_PERFORMANCE_CONFIG.audio?.tempo?.defaultSubdivision ?? '1/4',
        autoFollow: true,
        sourceBand: 'energy',
        linkToPads: true,
        nudge: 0
    },
    routing: {
        sendToPads: true,
        sendToPresets: false,
        broadcastMidiClock: false
    },
    advanced: {
        freezeOnSilence: DEFAULT_PERFORMANCE_CONFIG.audio?.advanced?.defaults?.freezeOnSilence ?? false,
        accentuatePeaks: DEFAULT_PERFORMANCE_CONFIG.audio?.advanced?.defaults?.accentuatePeaks ?? true,
        headroom: DEFAULT_PERFORMANCE_CONFIG.audio?.advanced?.defaults?.headroom ?? 0.2
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
        this.tempoConfig = this.config.tempo || DEFAULT_PERFORMANCE_CONFIG.audio.tempo || {};
        this.routingConfig = this.config.routing || DEFAULT_PERFORMANCE_CONFIG.audio.routing || {};
        this.availableParameters = this.buildParameterOptions();
        this.parameterLabels = new Map(this.availableParameters.map(meta => [meta.id, meta.label]));
        this.settings = this.mergeSettings(DEFAULT_SETTINGS, settings || {});
        this.ensureTempoSourceBand();
        this.ensureRoutingDefaults();
        this.container = container || this.ensureContainer();
        this.bandControls = new Map();
        this.tapTimestamps = [];

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

    ensureTempoSourceBand() {
        const bandKeys = Object.keys(this.settings.bands || {});
        if (bandKeys.length === 0) {
            this.settings.tempo.sourceBand = 'energy';
            return;
        }
        if (!bandKeys.includes(this.settings.tempo.sourceBand)) {
            this.settings.tempo.sourceBand = bandKeys.includes('energy') ? 'energy' : bandKeys[0];
        }
    }

    ensureRoutingDefaults() {
        const toggles = Array.isArray(this.routingConfig?.toggles) && this.routingConfig.toggles.length
            ? this.routingConfig.toggles
            : [
                { key: 'sendToPads', label: 'Drive Touch Pads' },
                { key: 'sendToPresets', label: 'Influence Presets' },
                { key: 'broadcastMidiClock', label: 'Broadcast MIDI Clock' }
            ];
        if (!this.settings.routing || typeof this.settings.routing !== 'object') {
            this.settings.routing = {};
        }
        toggles.forEach(toggle => {
            if (typeof this.settings.routing[toggle.key] !== 'boolean') {
                this.settings.routing[toggle.key] = toggle.key === 'sendToPads';
            }
        });
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

    renderSubdivisionOptions(selectedValue) {
        const subdivisions = Array.isArray(this.tempoConfig?.subdivisions) && this.tempoConfig.subdivisions.length
            ? this.tempoConfig.subdivisions
            : DEFAULT_PERFORMANCE_CONFIG.audio.tempo.subdivisions;
        return subdivisions
            .map(option => `<option value="${option.value}"${option.value === selectedValue ? ' selected' : ''}>${option.label}</option>`)
            .join('');
    }

    renderTempoBandOptions(selectedValue) {
        const bandKeys = Object.keys(this.settings.bands || {});
        if (bandKeys.length === 0) {
            return '<option value="energy">Energy</option>';
        }
        return bandKeys
            .map(band => `<option value="${band}"${band === selectedValue ? ' selected' : ''}>${this.formatBandLabel(band)}</option>`)
            .join('');
    }

    renderRoutingToggles() {
        const toggles = Array.isArray(this.routingConfig?.toggles) && this.routingConfig.toggles.length
            ? this.routingConfig.toggles
            : [
                { key: 'sendToPads', label: 'Drive Touch Pads' },
                { key: 'sendToPresets', label: 'Influence Presets' },
                { key: 'broadcastMidiClock', label: 'Broadcast MIDI Clock' }
            ];
        return toggles.map(toggle => `
            <label class="toggle-pill">
                <input type="checkbox" data-routing-toggle="${toggle.key}" ${this.settings.routing?.[toggle.key] ? 'checked' : ''}>
                <span>${toggle.label}</span>
            </label>
        `).join('');
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

        const bandGrid = document.createElement('div');
        bandGrid.classList.add('audio-band-grid');
        this.container.appendChild(bandGrid);

        Object.entries(this.settings.bands).forEach(([band, bandSettings]) => {
            const bandElement = this.createBandControl(band, bandSettings);
            bandGrid.appendChild(bandElement);
        });

        const tempoSection = document.createElement('div');
        tempoSection.classList.add('audio-tempo');
        tempoSection.innerHTML = `
            <div class="tempo-header">
                <h4>Tempo &amp; Sync</h4>
                <label class="toggle-pill">
                    <input type="checkbox" id="tempo-enabled" ${this.settings.tempo.enabled ? 'checked' : ''}>
                    <span>Enable</span>
                </label>
            </div>
            <div class="tempo-grid">
                <label>
                    <span>BPM</span>
                    <input type="number" id="tempo-bpm" min="40" max="220" step="1" value="${Math.round(this.settings.tempo.bpm)}">
                </label>
                <label>
                    <span>Subdivision</span>
                    <select id="tempo-subdivision">${this.renderSubdivisionOptions(this.settings.tempo.subdivision)}</select>
                </label>
                <label>
                    <span>Follow Band</span>
                    <select id="tempo-source-band">${this.renderTempoBandOptions(this.settings.tempo.sourceBand)}</select>
                </label>
                <label class="toggle-pill tempo-toggle">
                    <input type="checkbox" id="tempo-auto" ${this.settings.tempo.autoFollow ? 'checked' : ''}>
                    <span>Adaptive BPM</span>
                </label>
                <label class="toggle-pill tempo-toggle">
                    <input type="checkbox" id="tempo-link-pads" ${this.settings.tempo.linkToPads ? 'checked' : ''}>
                    <span>Drive Touch Pads</span>
                </label>
                <label class="tempo-nudge">
                    <span>Nudge</span>
                    <input type="range" id="tempo-nudge" min="-0.5" max="0.5" step="0.01" value="${this.settings.tempo.nudge}">
                    <span class="tempo-nudge-value">${this.formatTempoNudge(this.settings.tempo.nudge)}</span>
                </label>
                <button id="tempo-tap" class="tempo-tap">Tap Tempo</button>
            </div>
        `;
        this.container.appendChild(tempoSection);

        const routingSection = document.createElement('div');
        routingSection.classList.add('audio-routing');
        routingSection.innerHTML = `
            <h4>Routing</h4>
            <div class="routing-grid">${this.renderRoutingToggles()}</div>
        `;
        this.container.appendChild(routingSection);

        const advancedSection = document.createElement('div');
        advancedSection.classList.add('audio-advanced');
        advancedSection.innerHTML = `
            <h4>Advanced Dynamics</h4>
            <div class="advanced-grid">
                <label class="toggle-pill">
                    <input type="checkbox" id="advanced-freeze" ${this.settings.advanced.freezeOnSilence ? 'checked' : ''}>
                    <span>Freeze on Silence</span>
                </label>
                <label class="toggle-pill">
                    <input type="checkbox" id="advanced-peaks" ${this.settings.advanced.accentuatePeaks ? 'checked' : ''}>
                    <span>Accentuate Peaks</span>
                </label>
                <label class="advanced-headroom">
                    <span>Headroom</span>
                    <input type="range" id="advanced-headroom" min="0" max="0.5" step="0.01" value="${this.settings.advanced.headroom}">
                    <span class="advanced-headroom-value">${Math.round(this.settings.advanced.headroom * 100)}%</span>
                </label>
            </div>
        `;
        this.container.appendChild(advancedSection);

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
        this.bindTempoEvents();
        this.bindRoutingEvents();
        this.bindAdvancedEvents();
        this.bindFlourishEvents();
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

    bindTempoEvents() {
        const enabledToggle = this.container.querySelector('#tempo-enabled');
        const bpmInput = this.container.querySelector('#tempo-bpm');
        const subdivisionSelect = this.container.querySelector('#tempo-subdivision');
        const sourceSelect = this.container.querySelector('#tempo-source-band');
        const autoToggle = this.container.querySelector('#tempo-auto');
        const linkToggle = this.container.querySelector('#tempo-link-pads');
        const nudgeInput = this.container.querySelector('#tempo-nudge');
        const nudgeValue = this.container.querySelector('.tempo-nudge-value');
        const tapButton = this.container.querySelector('#tempo-tap');

        if (enabledToggle) {
            enabledToggle.addEventListener('change', () => {
                this.settings.tempo.enabled = enabledToggle.checked;
                this.notifyChange();
            });
        }

        if (bpmInput) {
            bpmInput.addEventListener('input', () => {
                const numeric = parseFloat(bpmInput.value);
                if (Number.isFinite(numeric)) {
                    this.settings.tempo.bpm = Math.max(40, Math.min(220, numeric));
                    this.notifyChange();
                }
            });
        }

        if (subdivisionSelect) {
            subdivisionSelect.addEventListener('change', () => {
                this.settings.tempo.subdivision = subdivisionSelect.value;
                this.notifyChange();
            });
        }

        if (sourceSelect) {
            sourceSelect.addEventListener('change', () => {
                this.settings.tempo.sourceBand = sourceSelect.value;
                this.notifyChange();
            });
        }

        if (autoToggle) {
            autoToggle.addEventListener('change', () => {
                this.settings.tempo.autoFollow = autoToggle.checked;
                this.notifyChange();
            });
        }

        if (linkToggle) {
            linkToggle.addEventListener('change', () => {
                this.settings.tempo.linkToPads = linkToggle.checked;
                this.notifyChange();
            });
        }

        if (nudgeInput) {
            nudgeInput.addEventListener('input', () => {
                const numeric = parseFloat(nudgeInput.value);
                if (Number.isFinite(numeric)) {
                    this.settings.tempo.nudge = Math.max(-0.5, Math.min(0.5, numeric));
                    if (nudgeValue) {
                        nudgeValue.textContent = this.formatTempoNudge(this.settings.tempo.nudge);
                    }
                    this.notifyChange();
                }
            });
        }

        if (tapButton) {
            tapButton.addEventListener('click', () => {
                const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
                this.tapTimestamps = (this.tapTimestamps || []).filter(timestamp => now - timestamp < 4000);
                this.tapTimestamps.push(now);
                if (this.tapTimestamps.length >= 2) {
                    const intervals = [];
                    for (let index = 1; index < this.tapTimestamps.length; index++) {
                        intervals.push(this.tapTimestamps[index] - this.tapTimestamps[index - 1]);
                    }
                    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
                    const bpm = Math.max(40, Math.min(220, Math.round(60000 / Math.max(average, 1)))) || this.settings.tempo.bpm;
                    this.settings.tempo.bpm = bpm;
                    if (bpmInput) {
                        bpmInput.value = String(bpm);
                    }
                    this.notifyChange();
                }
            });
        }
    }

    bindRoutingEvents() {
        const routingInputs = this.container.querySelectorAll('[data-routing-toggle]');
        routingInputs.forEach(input => {
            input.addEventListener('change', () => {
                const key = input.dataset.routingToggle;
                if (!key) return;
                if (!this.settings.routing) {
                    this.settings.routing = {};
                }
                this.settings.routing[key] = input.checked;
                this.notifyChange();
            });
        });
    }

    bindAdvancedEvents() {
        const freezeToggle = this.container.querySelector('#advanced-freeze');
        const peaksToggle = this.container.querySelector('#advanced-peaks');
        const headroomRange = this.container.querySelector('#advanced-headroom');
        const headroomValue = this.container.querySelector('.advanced-headroom-value');

        if (freezeToggle) {
            freezeToggle.addEventListener('change', () => {
                this.settings.advanced.freezeOnSilence = freezeToggle.checked;
                this.notifyChange();
            });
        }

        if (peaksToggle) {
            peaksToggle.addEventListener('change', () => {
                this.settings.advanced.accentuatePeaks = peaksToggle.checked;
                this.notifyChange();
            });
        }

        if (headroomRange) {
            headroomRange.addEventListener('input', () => {
                const numeric = parseFloat(headroomRange.value);
                if (Number.isFinite(numeric)) {
                    this.settings.advanced.headroom = Math.max(0, Math.min(0.5, numeric));
                    if (headroomValue) {
                        headroomValue.textContent = `${Math.round(this.settings.advanced.headroom * 100)}%`;
                    }
                    this.notifyChange();
                }
            });
        }
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

        const tempoEnabled = this.container.querySelector('#tempo-enabled');
        const tempoBpm = this.container.querySelector('#tempo-bpm');
        const tempoSubdivision = this.container.querySelector('#tempo-subdivision');
        const tempoBand = this.container.querySelector('#tempo-source-band');
        const tempoAuto = this.container.querySelector('#tempo-auto');
        const tempoLink = this.container.querySelector('#tempo-link-pads');
        const tempoNudge = this.container.querySelector('#tempo-nudge');
        const tempoNudgeValue = this.container.querySelector('.tempo-nudge-value');
        if (tempoEnabled) tempoEnabled.checked = !!this.settings.tempo.enabled;
        if (tempoBpm && Number.isFinite(this.settings.tempo.bpm)) tempoBpm.value = Math.round(this.settings.tempo.bpm);
        if (tempoSubdivision) tempoSubdivision.value = this.settings.tempo.subdivision;
        if (tempoBand) {
            tempoBand.innerHTML = this.renderTempoBandOptions(this.settings.tempo.sourceBand);
            tempoBand.value = this.settings.tempo.sourceBand;
        }
        if (tempoAuto) tempoAuto.checked = !!this.settings.tempo.autoFollow;
        if (tempoLink) tempoLink.checked = !!this.settings.tempo.linkToPads;
        if (tempoNudge && Number.isFinite(this.settings.tempo.nudge)) {
            tempoNudge.value = String(this.settings.tempo.nudge);
        }
        if (tempoNudgeValue) tempoNudgeValue.textContent = this.formatTempoNudge(this.settings.tempo.nudge);

        const routingInputs = this.container.querySelectorAll('[data-routing-toggle]');
        routingInputs.forEach(input => {
            const key = input.dataset.routingToggle;
            input.checked = !!this.settings.routing?.[key];
        });

        const freezeToggle = this.container.querySelector('#advanced-freeze');
        const peaksToggle = this.container.querySelector('#advanced-peaks');
        const headroomRange = this.container.querySelector('#advanced-headroom');
        const headroomValue = this.container.querySelector('.advanced-headroom-value');
        if (freezeToggle) freezeToggle.checked = !!this.settings.advanced.freezeOnSilence;
        if (peaksToggle) peaksToggle.checked = !!this.settings.advanced.accentuatePeaks;
        if (headroomRange && Number.isFinite(this.settings.advanced.headroom)) {
            headroomRange.value = String(this.settings.advanced.headroom);
        }
        if (headroomValue) headroomValue.textContent = `${Math.round(this.settings.advanced.headroom * 100)}%`;
    }

    mergeSettings(base, overrides) {
        const merged = JSON.parse(JSON.stringify(base));
        if (!overrides) return merged;

        if (typeof overrides.master === 'boolean') merged.master = overrides.master;
        if (typeof overrides.globalSensitivity === 'number') merged.globalSensitivity = overrides.globalSensitivity;
        if (typeof overrides.smoothing === 'number') merged.smoothing = overrides.smoothing;

        if (overrides.tempo) {
            merged.tempo = { ...merged.tempo, ...overrides.tempo };
        }

        if (overrides.routing) {
            merged.routing = { ...merged.routing, ...overrides.routing };
        }

        if (overrides.advanced) {
            merged.advanced = { ...merged.advanced, ...overrides.advanced };
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

    formatTempoNudge(value) {
        if (!Number.isFinite(value)) return '0%';
        const percentage = Math.round(value * 100);
        if (percentage === 0) return '0%';
        const prefix = percentage > 0 ? '+' : '';
        return `${prefix}${percentage}%`;
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
            if (snapshot.tempo) {
                this.hub.emit('audio-tempo-change', { tempo: JSON.parse(JSON.stringify(snapshot.tempo)) });
            }
            if (snapshot.routing) {
                this.hub.emit('audio-routing-change', { routing: JSON.parse(JSON.stringify(snapshot.routing)) });
            }
            if (snapshot.advanced) {
                this.hub.emit('audio-advanced-change', { advanced: JSON.parse(JSON.stringify(snapshot.advanced)) });
            }
        }
    }

    setSettings(settings) {
        this.settings = this.mergeSettings(DEFAULT_SETTINGS, settings || {});
        this.availableParameters = this.buildParameterOptions();
        this.parameterLabels = new Map(this.availableParameters.map(meta => [meta.id, meta.label]));
        this.ensureTempoSourceBand();
        this.ensureRoutingDefaults();
        this.tapTimestamps = [];
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
