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
        this.bandControlRefs = {};
        this.advancedControlRefs = {};

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
        form.appendChild(this.renderAdvancedControls());
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

        this.bandControlRefs = {};

        const grid = document.createElement('div');
        grid.className = 'audio-band-grid';
        fieldset.appendChild(grid);

        this.bandOrder.forEach(band => {
            const row = this.createBandRow(band);
            grid.appendChild(row.wrapper);
            this.bandControlRefs[band] = row;
        });

        return fieldset;
    }

    createBandRow(band) {
        const wrapper = document.createElement('div');
        wrapper.className = 'audio-band-row';
        wrapper.dataset.band = band;

        const toggle = document.createElement('label');
        toggle.className = 'toggle-pill';
        toggle.innerHTML = `
            <input type="checkbox" name="band-${band}">
            <span>${band.charAt(0).toUpperCase() + band.slice(1)}</span>
        `;
        const toggleInput = toggle.querySelector('input');
        toggleInput.addEventListener('change', () => {
            this.handleBandToggle(band, toggleInput.checked);
            this.setBandRowState(band, toggleInput.checked);
        });

        const controls = document.createElement('div');
        controls.className = 'audio-band-row__controls';

        const selectWrapper = document.createElement('label');
        selectWrapper.className = 'audio-select audio-select--inline';
        selectWrapper.innerHTML = `
            <span>Route to</span>
            <select name="band-param-${band}"></select>
        `;
        const select = selectWrapper.querySelector('select');
        this.populateParameterOptions(select, { allowEmpty: true });
        select.addEventListener('change', (event) => {
            this.handleBandMappingChange(band, { parameter: event.target.value });
        });

        const sliderWrapper = document.createElement('label');
        sliderWrapper.className = 'slider-control slider-control--inline';
        sliderWrapper.innerHTML = `
            <span>Amount</span>
            <div class="slider-control__track">
                <input type="range" name="band-amount-${band}" min="0" max="1" step="0.05">
                <span class="slider-control__value" data-role="band-amount-value">100%</span>
            </div>
        `;
        const slider = sliderWrapper.querySelector('input');
        const valueLabel = sliderWrapper.querySelector('[data-role="band-amount-value"]');
        slider.addEventListener('input', () => {
            const amount = Number(slider.value);
            valueLabel.textContent = `${Math.round(amount * 100)}%`;
            this.handleBandMappingChange(band, { amount });
        });

        controls.appendChild(selectWrapper);
        controls.appendChild(sliderWrapper);

        wrapper.appendChild(toggle);
        wrapper.appendChild(controls);

        return { wrapper, toggle: toggleInput, select, slider, valueLabel };
    }

    setBandRowState(band, enabled) {
        const refs = this.bandControlRefs[band];
        if (!refs) return;
        refs.select.disabled = !enabled;
        refs.slider.disabled = !enabled;
        refs.wrapper.classList.toggle('is-disabled', !enabled);
    }

    renderAdvancedControls() {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'audio-fieldset';
        fieldset.innerHTML = '
            <legend>Advanced</legend>
        ';

        const autoGainToggle = document.createElement('label');
        autoGainToggle.className = 'toggle-pill';
        autoGainToggle.innerHTML = `
            <input type="checkbox" name="advanced-autoGain">
            <span>Auto gain compensation</span>
        `;
        const dynamicSmoothingToggle = document.createElement('label');
        dynamicSmoothingToggle.className = 'toggle-pill';
        dynamicSmoothingToggle.innerHTML = `
            <input type="checkbox" name="advanced-dynamicSmoothing">
            <span>Dynamic smoothing</span>
        `;
        const tempoFollowToggle = document.createElement('label');
        tempoFollowToggle.className = 'toggle-pill';
        tempoFollowToggle.innerHTML = `
            <input type="checkbox" name="advanced-tempoFollow">
            <span>Tempo-follow modulation</span>
        `;

        [autoGainToggle, dynamicSmoothingToggle, tempoFollowToggle].forEach(toggle => fieldset.appendChild(toggle));

        const envelopeGroup = document.createElement('div');
        envelopeGroup.className = 'audio-fieldset__group';

        const attackControl = document.createElement('label');
        attackControl.className = 'slider-control slider-control--inline';
        attackControl.innerHTML = `
            <span>Envelope attack</span>
            <div class="slider-control__track">
                <input type="range" name="envelope-attack" min="0" max="0.95" step="0.05">
                <span class="slider-control__value" data-role="attackValue">0ms</span>
            </div>
        `;
        const releaseControl = document.createElement('label');
        releaseControl.className = 'slider-control slider-control--inline';
        releaseControl.innerHTML = `
            <span>Envelope release</span>
            <div class="slider-control__track">
                <input type="range" name="envelope-release" min="0" max="0.95" step="0.05">
                <span class="slider-control__value" data-role="releaseValue">0ms</span>
            </div>
        `;

        envelopeGroup.appendChild(attackControl);
        envelopeGroup.appendChild(releaseControl);
        fieldset.appendChild(envelopeGroup);

        const autoGainInput = autoGainToggle.querySelector('input');
        const dynamicInput = dynamicSmoothingToggle.querySelector('input');
        const tempoInput = tempoFollowToggle.querySelector('input');
        autoGainInput.addEventListener('change', () => this.handleAdvancedToggle('autoGain', autoGainInput.checked));
        dynamicInput.addEventListener('change', () => this.handleAdvancedToggle('dynamicSmoothing', dynamicInput.checked));
        tempoInput.addEventListener('change', () => this.handleAdvancedToggle('tempoFollow', tempoInput.checked));

        const attackInput = attackControl.querySelector('input');
        const releaseInput = releaseControl.querySelector('input');
        const attackValue = attackControl.querySelector('[data-role="attackValue"]');
        const releaseValue = releaseControl.querySelector('[data-role="releaseValue"]');
        attackInput.addEventListener('input', () => this.handleEnvelopeChange('attack', Number(attackInput.value), attackValue));
        releaseInput.addEventListener('input', () => this.handleEnvelopeChange('release', Number(releaseInput.value), releaseValue));

        this.advancedControlRefs = {
            autoGain: autoGainInput,
            dynamicSmoothing: dynamicInput,
            tempoFollow: tempoInput,
            attackInput,
            releaseInput,
            attackValue,
            releaseValue
        };

        return fieldset;
    }

    ensureBandMapping(band) {
        if (!this.settings.bandMappings) {
            this.settings.bandMappings = {};
        }
        if (!this.settings.bandMappings[band]) {
            this.settings.bandMappings[band] = { parameter: '', amount: 1 };
        }
    }

    handleBandMappingChange(band, updates) {
        this.ensureBandMapping(band);
        Object.assign(this.settings.bandMappings[band], updates);
        this.notifyChange();
    }

    handleAdvancedToggle(key, enabled) {
        if (!this.settings.advanced) {
            this.settings.advanced = {};
        }
        this.settings.advanced[key] = enabled;
        this.notifyChange();
    }

    handleEnvelopeChange(key, value, labelEl) {
        if (!this.settings.advanced) {
            this.settings.advanced = {};
        }
        if (!this.settings.advanced.envelope) {
            this.settings.advanced.envelope = {};
        }
        this.settings.advanced.envelope[key] = value;
        if (labelEl) {
            labelEl.textContent = `${Math.round(value * 1000)}ms`;
        }
        this.notifyChange();
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
            <label class="slider-control slider-control--inline">
                <span>Cooldown (ms)</span>
                <div class="slider-control__track">
                    <input type="range" name="flourishCooldown" min="200" max="2000" step="50">
                    <span class="slider-control__value" data-role="flourishCooldownValue">900ms</span>
                </div>
            </label>
            <label class="audio-select">
                <span>Flourish parameter</span>
                <select name="flourishParameter"></select>
            </label>
            <label class="audio-select">
                <span>Flourish style</span>
                <select name="flourishMode">
                    <option value="boost">Boost</option>
                    <option value="swell">Swell</option>
                    <option value="pulse">Pulse</option>
                </select>
            </label>
        `;

        const cooldownValue = fieldset.querySelector('[data-role="flourishCooldownValue"]');

        fieldset.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => this.handleFlourishChange());
            input.addEventListener('change', () => this.handleFlourishChange());
        });

        const parameterSelect = fieldset.querySelector('select[name="flourishParameter"]');
        const modeSelect = fieldset.querySelector('select[name="flourishMode"]');
        this.populateParameterOptions(parameterSelect);
        parameterSelect.addEventListener('change', () => this.handleFlourishChange());
        modeSelect.addEventListener('change', () => this.handleFlourishChange());

        const cooldownInput = fieldset.querySelector('input[name="flourishCooldown"]');
        if (cooldownInput && cooldownValue) {
            cooldownInput.addEventListener('input', () => {
                cooldownValue.textContent = `${cooldownInput.value}ms`;
            });
        }

        return fieldset;
    }

    populateParameterOptions(select, { allowEmpty = false } = {}) {
        if (!select) return;

        const options = this.parameterManager?.listParameterMetadata({ tags: ['color', 'dynamics', 'performance'] })
            || this.parameterManager?.listParameterMetadata()
            || [];

        const entries = allowEmpty
            ? [{ id: '', label: 'None' }, ...options]
            : options;

        select.innerHTML = entries.map(meta => `<option value="${meta.id}">${meta.label}</option>`).join('');
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
        if (!this.settings.bands) {
            this.settings.bands = {};
        }
        this.settings.bands[band] = enabled;
        this.ensureBandMapping(band);
        this.notifyChange();
    }

    handleFlourishChange() {
        const formData = new FormData(this.form);
        this.settings.flourish.enabled = formData.get('flourishEnabled') === 'on';
        this.settings.flourish.threshold = Number(formData.get('flourishThreshold'));
        this.settings.flourish.amount = Number(formData.get('flourishAmount'));
        this.settings.flourish.cooldown = Number(formData.get('flourishCooldown'));
        this.settings.flourish.parameter = formData.get('flourishParameter') || this.settings.flourish.parameter;
        this.settings.flourish.mode = formData.get('flourishMode') || this.settings.flourish.mode || 'boost';
        this.notifyChange();
    }

    applySettingsToForm() {
        if (!this.form) return;
        this.form.querySelector('input[name="enabled"]').checked = Boolean(this.settings.enabled);
        this.form.querySelector('input[name="beatSync"]').checked = Boolean(this.settings.beatSync);
        this.form.querySelector('input[name="sensitivity"]').value = Number(this.settings.sensitivity ?? 0.75);
        this.form.querySelector('input[name="smoothing"]').value = Number(this.settings.smoothing ?? 0.35);

        this.bandOrder.forEach(band => {
            const input = this.form.querySelector(`input[name="band-${band}"]`);
            if (input) {
                input.checked = Boolean(this.settings.bands?.[band]);
            }
            const refs = this.bandControlRefs[band];
            if (refs) {
                const mapping = this.settings.bandMappings?.[band] || {};
                refs.toggle.checked = Boolean(this.settings.bands?.[band]);
                this.populateParameterOptions(refs.select, { allowEmpty: true });
                refs.select.value = mapping.parameter || '';
                refs.slider.value = Number(mapping.amount ?? 1);
                refs.valueLabel.textContent = `${Math.round(refs.slider.value * 100)}%`;
                this.setBandRowState(band, Boolean(this.settings.bands?.[band]));
            }
        });

        this.form.querySelector('input[name="flourishEnabled"]').checked = Boolean(this.settings.flourish?.enabled);
        this.form.querySelector('input[name="flourishThreshold"]').value = Number(this.settings.flourish?.threshold ?? 0.65);
        this.form.querySelector('input[name="flourishAmount"]').value = Number(this.settings.flourish?.amount ?? 0.4);
        const cooldownInput = this.form.querySelector('input[name="flourishCooldown"]');
        if (cooldownInput) {
            cooldownInput.value = Number(this.settings.flourish?.cooldown ?? 900);
            const cooldownValue = this.form.querySelector('[data-role="flourishCooldownValue"]');
            if (cooldownValue) {
                cooldownValue.textContent = `${cooldownInput.value}ms`;
            }
        }

        const flourishSelect = this.form.querySelector('select[name="flourishParameter"]');
        if (flourishSelect) {
            this.populateParameterOptions(flourishSelect);
            if (this.settings.flourish?.parameter) {
                flourishSelect.value = this.settings.flourish.parameter;
            }
        }
        const flourishMode = this.form.querySelector('select[name="flourishMode"]');
        if (flourishMode) {
            flourishMode.value = this.settings.flourish?.mode || 'boost';
        }

        if (this.advancedControlRefs.autoGain) {
            this.advancedControlRefs.autoGain.checked = Boolean(this.settings.advanced?.autoGain);
        }
        if (this.advancedControlRefs.dynamicSmoothing) {
            this.advancedControlRefs.dynamicSmoothing.checked = Boolean(this.settings.advanced?.dynamicSmoothing);
        }
        if (this.advancedControlRefs.tempoFollow) {
            this.advancedControlRefs.tempoFollow.checked = Boolean(this.settings.advanced?.tempoFollow);
        }
        if (this.advancedControlRefs.attackInput) {
            const attack = Number(this.settings.advanced?.envelope?.attack ?? 0.25);
            this.advancedControlRefs.attackInput.value = attack;
            if (this.advancedControlRefs.attackValue) {
                this.advancedControlRefs.attackValue.textContent = `${Math.round(attack * 1000)}ms`;
            }
        }
        if (this.advancedControlRefs.releaseInput) {
            const release = Number(this.settings.advanced?.envelope?.release ?? 0.45);
            this.advancedControlRefs.releaseInput.value = release;
            if (this.advancedControlRefs.releaseValue) {
                this.advancedControlRefs.releaseValue.textContent = `${Math.round(release * 1000)}ms`;
            }
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

    applySettings(settings) {
        this.settings = this.mergeSettings(this.config.defaults, settings || {});
        this.applySettingsToForm();
        this.notifyChange();
    }
}
