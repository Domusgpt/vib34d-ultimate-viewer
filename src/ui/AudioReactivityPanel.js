/**
 * Audio Reactivity Control Panel
 * Provides live performance grade audio mapping configuration
 */

const DEFAULT_SETTINGS = {
    master: true,
    globalSensitivity: 1.0,
    smoothing: 0.35,
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
            settings = null
        } = options;

        this.parameterManager = parameterManager;
        this.onSettingsChange = onSettingsChange;
        this.availableParameters = parameterManager?.listParameters() || [];
        this.settings = this.mergeSettings(DEFAULT_SETTINGS, settings || {});
        this.container = container || this.ensureContainer();
        this.bandControls = new Map();

        this.buildUI();
        this.applySettingsToControls();
        this.notifyChange();
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
                        ${this.availableParameters.map(param => `<option value="${param}">${this.formatParameterName(param)}</option>`).join('')}
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
                <span class="band-preview" data-band-preview>${this.formatParameterName(bandSettings.parameter)}</span>
            </div>
            <div class="band-control-grid">
                <label>
                    <span>Parameter</span>
                    <select data-band-parameter>
                        ${this.availableParameters.map(param => `<option value="${param}">${this.formatParameterName(param)}</option>`).join('')}
                    </select>
                </label>
                <label>
                    <span>Mode</span>
                    <select data-band-mode>
                        <option value="absolute">Absolute</option>
                        <option value="swing">Swing</option>
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
        controls.mode.value = bandSettings.mode;

        controls.parameter.addEventListener('change', () => {
            this.settings.bands[band].parameter = controls.parameter.value;
            controls.preview.textContent = this.formatParameterName(controls.parameter.value);
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
            controls.mode.value = bandSettings.mode;
            controls.depth.value = bandSettings.depth;
            controls.curve.value = bandSettings.curve;
            controls.preview.textContent = this.formatParameterName(bandSettings.parameter);
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
        if (parameterSelect) parameterSelect.value = this.settings.flourish.parameter;
        if (thresholdRange) thresholdRange.value = this.settings.flourish.threshold;
        if (boostRange) boostRange.value = this.settings.flourish.boost;
        if (durationInput) durationInput.value = this.settings.flourish.duration;
        if (cooldownInput) cooldownInput.value = this.settings.flourish.cooldown;
        if (toggle) toggle.checked = this.settings.flourish.enabled;
    }

    mergeSettings(base, overrides) {
        const merged = JSON.parse(JSON.stringify(base));
        if (!overrides) return merged;

        if (typeof overrides.master === 'boolean') merged.master = overrides.master;
        if (typeof overrides.globalSensitivity === 'number') merged.globalSensitivity = overrides.globalSensitivity;
        if (typeof overrides.smoothing === 'number') merged.smoothing = overrides.smoothing;

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

    formatParameterName(name) {
        return name
            .replace(/rot4d/, '4D ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, char => char.toUpperCase())
            .trim();
    }

    getSettings() {
        return JSON.parse(JSON.stringify(this.settings));
    }

    notifyChange() {
        if (typeof this.onSettingsChange === 'function') {
            this.onSettingsChange(this.getSettings());
        }
    }

    setSettings(settings) {
        this.settings = this.mergeSettings(DEFAULT_SETTINGS, settings || {});
        this.buildUI();
        this.applySettingsToControls();
        this.notifyChange();
    }

    destroy() {
        this.bandControls.clear();
    }
}
