import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

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
        this.config = { ...DEFAULT_PERFORMANCE_CONFIG.audio, ...(config || {}) };
        this.hub = hub;
        this.onSettingsChange = typeof onSettingsChange === 'function' ? onSettingsChange : () => {};

        this.container = container || this.ensureContainer();
        this.settings = this.mergeSettings(this.config.defaults, settings || {});
        this.bandOrder = ['bass', 'mid', 'treble', 'energy'];
        this.normalizeBandSettings();
        this.bandControls = {};

        this.render();
        this.applySettingsToForm();
        this.notifyChange();
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

    mergeSettings(defaults, overrides) {
        const merged = JSON.parse(JSON.stringify(defaults || {}));
        if (!overrides || typeof overrides !== 'object') {
            return merged;
        }
        Object.keys(overrides).forEach(key => {
            if (typeof overrides[key] === 'object' && overrides[key] !== null && !(overrides[key] instanceof Array)) {
                merged[key] = this.mergeSettings(merged[key] || {}, overrides[key]);
            } else {
                merged[key] = overrides[key];
            }
        });
        return merged;
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
                <p class="performance-block__subtitle">Dial in how the engine listens to the crowd. Toggle frequency bands, beat sync and flourishes.</p>
            </div>
        `;
        this.container.appendChild(header);

        const form = document.createElement('form');
        form.className = 'audio-form';
        form.addEventListener('submit', (event) => event.preventDefault());

        form.appendChild(this.renderMasterControls());
        form.appendChild(this.renderBandControls());
        form.appendChild(this.renderFlourishControls());

        this.container.appendChild(form);
        this.form = form;
    }

    renderMasterControls() {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'audio-fieldset';
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

    renderBandControls() {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'audio-fieldset';
        fieldset.innerHTML = '<legend>Bands</legend>';

        this.bandOrder.forEach(band => {
            const control = this.createBandControl(band);
            this.bandControls[band] = control;
            fieldset.appendChild(control.wrapper);
        });

        const selectWrapper = document.createElement('label');
        selectWrapper.className = 'audio-select';
        selectWrapper.innerHTML = `
            <span>Flourish parameter</span>
            <select name="flourishParameter"></select>
        `;

        this.populateParameterOptions(selectWrapper.querySelector('select'));
        selectWrapper.querySelector('select').addEventListener('change', (event) => {
            this.settings.flourish.parameter = event.target.value;
            this.notifyChange();
        });

        fieldset.appendChild(selectWrapper);
        return fieldset;
    }

    renderFlourishControls() {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'audio-fieldset';
        fieldset.innerHTML = `
            <legend>Flourish</legend>
            <label class="toggle-pill">
                <input type="checkbox" name="flourishEnabled">
                <span>Enable flourish boost</span>
            </label>
            <label class="slider-control">
                <span>Trigger threshold</span>
                <input type="range" name="flourishThreshold" min="0" max="1" step="0.05">
            </label>
            <label class="slider-control">
                <span>Boost amount</span>
                <input type="range" name="flourishAmount" min="0" max="1" step="0.05">
            </label>
        `;

        fieldset.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => this.handleFlourishChange());
            input.addEventListener('change', () => this.handleFlourishChange());
        });

        return fieldset;
    }

    populateParameterOptions(select) {
        if (!select) return;

        const options = this.parameterManager?.listParameterMetadata({ tags: ['color', 'dynamics', 'performance'] })
            || this.parameterManager?.listParameterMetadata()
            || [];

        select.innerHTML = options.map(meta => `<option value="${meta.id}">${meta.label}</option>`).join('');
    }

    handleMasterChange() {
        const formData = new FormData(this.form);
        this.settings.enabled = formData.get('enabled') === 'on';
        this.settings.beatSync = formData.get('beatSync') === 'on';
        this.settings.sensitivity = Number(formData.get('sensitivity'));
        this.settings.smoothing = Number(formData.get('smoothing'));
        this.notifyChange();
    }

    handleBandToggle(band, enabled) {
        const bandSetting = this.ensureBandSetting(band);
        bandSetting.enabled = enabled;
        this.updateBandControlUI(band);
        this.notifyChange();
    }

    handleBandWeightChange(band, weight) {
        const bandSetting = this.ensureBandSetting(band);
        bandSetting.weight = this.clampBandWeight(weight);
        this.updateBandControlUI(band);
        this.notifyChange();
    }

    handleFlourishChange() {
        const formData = new FormData(this.form);
        this.settings.flourish.enabled = formData.get('flourishEnabled') === 'on';
        this.settings.flourish.threshold = Number(formData.get('flourishThreshold'));
        this.settings.flourish.amount = Number(formData.get('flourishAmount'));
        this.notifyChange();
    }

    applySettingsToForm() {
        if (!this.form) return;
        this.form.querySelector('input[name="enabled"]').checked = Boolean(this.settings.enabled);
        this.form.querySelector('input[name="beatSync"]').checked = Boolean(this.settings.beatSync);
        this.form.querySelector('input[name="sensitivity"]').value = Number(this.settings.sensitivity ?? 0.75);
        this.form.querySelector('input[name="smoothing"]').value = Number(this.settings.smoothing ?? 0.35);

        this.bandOrder.forEach(band => this.updateBandControlUI(band));

        this.form.querySelector('input[name="flourishEnabled"]').checked = Boolean(this.settings.flourish?.enabled);
        this.form.querySelector('input[name="flourishThreshold"]').value = Number(this.settings.flourish?.threshold ?? 0.65);
        this.form.querySelector('input[name="flourishAmount"]').value = Number(this.settings.flourish?.amount ?? 0.4);

        const flourishSelect = this.form.querySelector('select[name="flourishParameter"]');
        if (flourishSelect && this.settings.flourish?.parameter) {
            flourishSelect.value = this.settings.flourish.parameter;
        }
    }

    notifyChange() {
        this.onSettingsChange(this.getSettings());
        if (this.hub) {
            this.hub.emit('audio-settings-change', { settings: this.getSettings() });
        }
    }

    getSettings() {
        return this.mergeSettings({}, this.settings);
    }

    normalizeBandSettings() {
        if (!this.settings.bands || typeof this.settings.bands !== 'object') {
            this.settings.bands = {};
        }
        this.bandOrder.forEach(band => {
            this.ensureBandSetting(band);
        });
    }

    ensureBandSetting(band) {
        if (!this.settings.bands) {
            this.settings.bands = {};
        }
        const raw = this.settings.bands[band];
        if (raw && typeof raw === 'object') {
            const normalized = {
                enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : true,
                weight: this.clampBandWeight(raw.weight !== undefined ? raw.weight : 1)
            };
            this.settings.bands[band] = normalized;
            return normalized;
        }
        if (typeof raw === 'number') {
            const normalized = {
                enabled: raw > 0,
                weight: this.clampBandWeight(raw)
            };
            this.settings.bands[band] = normalized;
            return normalized;
        }
        const normalized = {
            enabled: Boolean(raw),
            weight: Boolean(raw) ? 1 : 0
        };
        this.settings.bands[band] = normalized;
        return normalized;
    }

    clampBandWeight(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        return Math.max(0, Math.min(2, numeric));
    }

    createBandControl(band) {
        const wrapper = document.createElement('div');
        wrapper.className = 'audio-band';

        const toggle = document.createElement('label');
        toggle.className = 'toggle-pill';
        toggle.innerHTML = `
            <input type="checkbox" name="band-${band}-enabled">
            <span>${band.charAt(0).toUpperCase() + band.slice(1)}</span>
        `;

        const sliderWrapper = document.createElement('div');
        sliderWrapper.className = 'audio-band__weight';

        const sliderLabel = document.createElement('span');
        sliderLabel.textContent = 'Weight';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.name = `band-${band}-weight`;
        slider.min = '0';
        slider.max = '2';
        slider.step = '0.1';

        const valueLabel = document.createElement('span');
        valueLabel.className = 'audio-band__value';

        sliderWrapper.appendChild(sliderLabel);
        sliderWrapper.appendChild(slider);
        sliderWrapper.appendChild(valueLabel);

        toggle.querySelector('input').addEventListener('change', (event) => {
            this.handleBandToggle(band, event.target.checked);
        });

        slider.addEventListener('input', () => {
            this.handleBandWeightChange(band, Number(slider.value));
        });

        wrapper.appendChild(toggle);
        wrapper.appendChild(sliderWrapper);

        return {
            wrapper,
            toggle: toggle.querySelector('input'),
            slider,
            valueLabel
        };
    }

    updateBandControlUI(band) {
        const control = this.bandControls?.[band];
        if (!control) return;
        const setting = this.ensureBandSetting(band);
        control.toggle.checked = Boolean(setting.enabled);
        control.slider.value = String(setting.weight);
        control.valueLabel.textContent = `${Number(setting.weight).toFixed(1)}x`;
        control.slider.disabled = !control.toggle.checked;
        control.wrapper.classList.toggle('audio-band--disabled', !control.toggle.checked);
    }

    applySettings(settings) {
        this.settings = this.mergeSettings(this.config.defaults, settings || {});
        this.applySettingsToForm();
        this.notifyChange();
    }
}
