import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

const BAND_LABELS = {
    bass: 'Bass',
    mid: 'Mid',
    treble: 'Treble',
    energy: 'Energy'
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

export class AudioReactivityPanel {
    constructor({
        parameterManager = null,
        container = null,
        config = DEFAULT_PERFORMANCE_CONFIG.audio,
        hub = null,
        onSettingsChange = null,
        settings = null
    } = {}) {
        this.parameterManager = parameterManager;
        this.hub = hub;
        this.config = { ...DEFAULT_PERFORMANCE_CONFIG.audio, ...(config || {}) };
        this.onSettingsChange = typeof onSettingsChange === 'function' ? onSettingsChange : () => {};

        this.container = container || this.ensureContainer();
        const defaults = clone(this.config.defaults || {});
        this.settings = Object.assign(defaults, clone(settings || {}));

        this.render();
        this.applySettingsToForm();
        this.emitChange();
    }

    ensureContainer() {
        const existing = document.getElementById('performance-audio');
        if (existing) {
            existing.innerHTML = '';
            return existing;
        }
        const section = document.createElement('section');
        section.id = 'performance-audio';
        return section;
    }

    render() {
        if (!this.container) return;
        this.container.classList.add('performance-block');
        this.container.innerHTML = '';

        const header = document.createElement('header');
        header.className = 'performance-block__header';
        header.innerHTML = `
            <div>
                <h3 class="performance-block__title">Audio Reactivity</h3>
                <p class="performance-block__subtitle">Blend live sound with your choreography. Toggle bands, tune weights, and launch flourishes.</p>
            </div>
            <div class="performance-block__actions">
                <button type="button" class="audio-reset">Reset</button>
            </div>
        `;
        this.container.appendChild(header);

        header.querySelector('.audio-reset').addEventListener('click', () => {
            this.settings = clone(this.config.defaults || {});
            this.applySettingsToForm();
            this.emitChange();
        });

        const form = document.createElement('form');
        form.className = 'audio-panel';
        form.addEventListener('submit', (event) => event.preventDefault());

        form.appendChild(this.renderMasterSection());
        form.appendChild(this.renderBandSection());
        form.appendChild(this.renderFlourishSection());

        this.container.appendChild(form);
        this.form = form;
    }

    renderMasterSection() {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'audio-panel__fieldset';
        fieldset.innerHTML = `
            <legend>Master</legend>
            <label class="toggle-pill">
                <input type="checkbox" name="enabled">
                <span>Enable audio reactivity</span>
            </label>
            <label class="toggle-pill">
                <input type="checkbox" name="beatSync">
                <span>Beat sync</span>
            </label>
            <label class="slider-control">
                <span>Sensitivity</span>
                <input type="range" name="sensitivity" min="0" max="1" step="0.05">
            </label>
            <label class="slider-control">
                <span>Smoothing</span>
                <input type="range" name="smoothing" min="0" max="0.9" step="0.05">
            </label>
        `;

        fieldset.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => this.handleMasterChange());
            input.addEventListener('change', () => this.handleMasterChange());
        });

        return fieldset;
    }

    renderBandSection() {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'audio-panel__fieldset';
        fieldset.innerHTML = '<legend>Bands</legend>';

        Object.keys(BAND_LABELS).forEach(band => {
            const row = document.createElement('div');
            row.className = 'audio-panel__band-row';
            row.innerHTML = `
                <div class="audio-panel__band-label">
                    <span>${BAND_LABELS[band]}</span>
                </div>
                <label class="toggle-pill">
                    <input type="checkbox" name="band-${band}">
                    <span>Active</span>
                </label>
                <label class="slider-control">
                    <span>Weight</span>
                    <input type="range" name="band-${band}-weight" min="0" max="1" step="0.05">
                </label>
            `;

            row.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', () => this.handleBandChange(band));
                input.addEventListener('change', () => this.handleBandChange(band));
            });

            fieldset.appendChild(row);
        });

        return fieldset;
    }

    renderFlourishSection() {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'audio-panel__fieldset';
        fieldset.innerHTML = `
            <legend>Flourish</legend>
            <label class="toggle-pill">
                <input type="checkbox" name="flourish-enabled">
                <span>Enable flourish boost</span>
            </label>
            <label class="audio-select">
                <span>Parameter</span>
                <select name="flourish-parameter"></select>
            </label>
            <label class="slider-control">
                <span>Trigger threshold</span>
                <input type="range" name="flourish-threshold" min="0" max="1" step="0.05">
            </label>
            <label class="slider-control">
                <span>Boost amount</span>
                <input type="range" name="flourish-amount" min="0" max="1" step="0.05">
            </label>
            <div class="audio-panel__flourish-actions">
                <button type="button" class="flourish-trigger">Trigger flourish</button>
            </div>
        `;

        fieldset.querySelector('.flourish-trigger').addEventListener('click', () => {
            this.triggerFlourish();
        });

        const select = fieldset.querySelector('select');
        this.populateParameterOptions(select);
        this.ensureFlourishParameter(select);
        select.addEventListener('change', (event) => {
            this.settings.flourish.parameter = event.target.value;
            this.emitChange();
        });

        fieldset.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => this.handleFlourishChange());
            input.addEventListener('change', () => this.handleFlourishChange());
        });

        return fieldset;
    }

    populateParameterOptions(select) {
        if (!select) return;
        const options = this.parameterManager?.listParameterMetadata({ tags: ['performance', 'dynamics', 'color'] })
            || this.parameterManager?.listParameterMetadata()
            || [];
        select.innerHTML = options.map(meta => `<option value="${meta.id}">${meta.label}</option>`).join('');
    }

    ensureFlourishParameter(select) {
        if (!select) return;
        const available = Array.from(select.options).map(option => option.value);
        if (!available.length) {
            this.settings.flourish.parameter = '';
            return;
        }
        if (available.includes(this.settings.flourish?.parameter)) {
            select.value = this.settings.flourish.parameter;
            return;
        }
        select.value = available[0];
        if (!this.settings.flourish) {
            this.settings.flourish = {};
        }
        this.settings.flourish.parameter = select.value;
    }

    applySettingsToForm() {
        if (!this.form) return;
        const settings = this.settings;
        this.form.querySelector('[name="enabled"]').checked = Boolean(settings.enabled);
        this.form.querySelector('[name="beatSync"]').checked = Boolean(settings.beatSync);
        this.form.querySelector('[name="sensitivity"]').value = settings.sensitivity ?? 0.5;
        this.form.querySelector('[name="smoothing"]').value = settings.smoothing ?? 0.2;

        Object.keys(BAND_LABELS).forEach(band => {
            const bandSettings = settings.bands?.[band] || { enabled: false, weight: 0 };
            this.form.querySelector(`[name="band-${band}"]`).checked = Boolean(bandSettings.enabled);
            this.form.querySelector(`[name="band-${band}-weight"]`).value = bandSettings.weight ?? 0;
        });

        const flourish = settings.flourish || {};
        this.form.querySelector('[name="flourish-enabled"]').checked = Boolean(flourish.enabled);
        const select = this.form.querySelector('[name="flourish-parameter"]');
        this.ensureFlourishParameter(select);
        this.form.querySelector('[name="flourish-threshold"]').value = flourish.threshold ?? 0.5;
        this.form.querySelector('[name="flourish-amount"]').value = flourish.amount ?? 0.3;
    }

    handleMasterChange() {
        const formData = new FormData(this.form);
        this.settings.enabled = formData.get('enabled') === 'on';
        this.settings.beatSync = formData.get('beatSync') === 'on';
        const sensitivity = Number(formData.get('sensitivity'));
        const smoothing = Number(formData.get('smoothing'));
        this.settings.sensitivity = Math.max(0, Math.min(1, sensitivity));
        this.settings.smoothing = Math.max(0, Math.min(0.9, smoothing));
        this.emitChange();
    }

    handleBandChange(band) {
        if (!this.settings.bands) {
            this.settings.bands = {};
        }
        const enabled = this.form.querySelector(`[name="band-${band}"]`).checked;
        const weight = Number(this.form.querySelector(`[name="band-${band}-weight"]`).value);
        const clampedWeight = Math.max(0, Math.min(1, weight));
        this.settings.bands[band] = { enabled, weight: clampedWeight };
        this.emitChange();
    }

    handleFlourishChange() {
        const flourish = this.settings.flourish || (this.settings.flourish = {});
        flourish.enabled = this.form.querySelector('[name="flourish-enabled"]').checked;
        const threshold = Number(this.form.querySelector('[name="flourish-threshold"]').value);
        const amount = Number(this.form.querySelector('[name="flourish-amount"]').value);
        flourish.threshold = Math.max(0, Math.min(1, threshold));
        flourish.amount = Math.max(0, Math.min(1, amount));
        this.emitChange();
    }

    triggerFlourish() {
        const flourish = this.settings.flourish || {};
        if (!flourish.enabled) return;
        this.hub?.emit?.('audio:flourish', clone(flourish));
    }

    emitChange() {
        const settings = this.getSettings();
        this.onSettingsChange(settings);
        this.hub?.emit?.('audio:settings', settings);
    }

    getSettings() {
        return clone(this.settings);
    }

    applySettings(settings = {}) {
        this.settings = Object.assign(clone(this.config.defaults || {}), clone(settings));
        this.applySettingsToForm();
        this.emitChange();
    }
}
