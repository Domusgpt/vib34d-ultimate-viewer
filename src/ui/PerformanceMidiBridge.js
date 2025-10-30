const DEFAULT_OPTIONS = {
    storageKey: 'vib34d-hardware-mappings',
    autoConnect: false,
    pickupThreshold: 0.04,
    smoothing: 0.18,
    channel: 'omni'
};

const SUPPORTED_MESSAGE_TYPES = {
    cc: 0xB0
};

function createId(prefix = 'map') {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp01(value) {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
}

export class PerformanceMidiBridge {
    constructor({ container = null, hub = null, parameterManager = null, config = {}, onStatusChange = null } = {}) {
        this.container = container || this.ensureContainer();
        this.hub = hub;
        this.parameterManager = parameterManager;
        this.config = { ...DEFAULT_OPTIONS, ...(config || {}) };
        this.onStatusChange = typeof onStatusChange === 'function' ? onStatusChange : () => {};

        this.storageKey = this.config.storageKey || DEFAULT_OPTIONS.storageKey;
        this.mappings = [];
        this.mappingRefs = new Map();
        this.inputs = new Map();
        this.activeInputId = null;
        this.pendingInputId = null;
        this.midiAccess = null;
        this.learnMappingId = null;
        this.status = 'disabled';
        this.parameterOptions = this.parameterManager?.listParameterMetadata?.() || [];

        this.statusEl = null;
        this.inputSelect = null;
        this.enableButton = null;
        this.refreshButton = null;
        this.addButton = null;
        this.mappingList = null;
        this.webMidiUnsupportedMessage = null;

        this.onMIDIMessageBound = this.onMIDIMessage.bind(this);
        this.onMIDIAccessChangeBound = this.onMIDIAccessChange.bind(this);

        const storedState = this.loadState();
        if (storedState) {
            this.mappings = Array.isArray(storedState.mappings)
                ? storedState.mappings.map(mapping => ({ ...mapping, lastValue: 0, lastNormalized: 0 }))
                : [];
            this.pendingInputId = storedState.inputId || null;
            this.pendingEnable = storedState.enabled === true;
        } else {
            this.mappings = [];
            this.pendingInputId = null;
            this.pendingEnable = false;
        }

        this.render();
        this.refreshParameterOptions();

        if (this.config.autoConnect || this.pendingEnable) {
            this.requestAccess({ silent: true });
        }
    }

    ensureContainer() {
        if (typeof document === 'undefined') {
            return null;
        }
        const section = document.createElement('section');
        section.className = 'performance-block performance-hardware';
        return section;
    }

    render() {
        if (!this.container) return;

        this.container.classList.add('performance-block', 'performance-hardware');
        this.container.innerHTML = `
            <header class="performance-block__header">
                <div>
                    <h3 class="performance-block__title">Hardware Bridge</h3>
                    <p class="performance-block__subtitle">Map MIDI controllers to parameters for tactile playback.</p>
                </div>
            </header>
            <div class="hardware-bridge__status" data-role="status">${this.statusLabel()}</div>
            <div class="hardware-bridge__controls">
                <button type="button" class="hardware-bridge__enable">Enable MIDI</button>
                <select class="hardware-bridge__inputs" disabled></select>
                <button type="button" class="hardware-bridge__refresh" disabled>Refresh</button>
            </div>
            <div class="hardware-bridge__warning" data-role="unsupported" hidden>
                Web MIDI is not available in this browser. Connect through a companion bridge or
                launch the viewer in Chrome / Edge with MIDI enabled.
            </div>
            <div class="hardware-bridge__mappings">
                <div class="hardware-bridge__mappings-header">
                    <h4>Mappings</h4>
                    <button type="button" class="hardware-bridge__add" ${this.parameterOptions.length ? '' : 'disabled'}>Add mapping</button>
                </div>
                <ul class="hardware-bridge__list"></ul>
                <p class="hardware-bridge__hint">Use “Learn” to capture CC messages, then move the selected control.
                    Values are smoothed automatically to avoid jumps on stage.</p>
            </div>
        `;

        this.statusEl = this.container.querySelector('[data-role="status"]');
        this.inputSelect = this.container.querySelector('.hardware-bridge__inputs');
        this.enableButton = this.container.querySelector('.hardware-bridge__enable');
        this.refreshButton = this.container.querySelector('.hardware-bridge__refresh');
        this.addButton = this.container.querySelector('.hardware-bridge__add');
        this.mappingList = this.container.querySelector('.hardware-bridge__list');
        this.webMidiUnsupportedMessage = this.container.querySelector('[data-role="unsupported"]');

        this.enableButton.addEventListener('click', () => this.requestAccess());
        this.refreshButton.addEventListener('click', () => this.refreshInputs());
        this.inputSelect.addEventListener('change', () => this.handleInputSelection());
        if (this.addButton) {
            this.addButton.addEventListener('click', () => this.addMapping());
        }

        this.renderInputOptions();
        this.renderMappings();
    }

    refreshParameterOptions() {
        if (!this.parameterManager || typeof this.parameterManager.listParameterMetadata !== 'function') {
            return;
        }
        const metadata = this.parameterManager.listParameterMetadata();
        if (Array.isArray(metadata) && metadata.length) {
            this.parameterOptions = metadata;
            if (this.addButton) {
                this.addButton.disabled = false;
            }
            this.mappings.forEach(mapping => {
                if (!mapping.parameter) {
                    mapping.parameter = metadata[0].id;
                }
            });
            this.renderMappings();
        } else if (this.addButton) {
            this.addButton.disabled = true;
        }
    }

    statusLabel() {
        switch (this.status) {
            case 'enabled':
                return 'MIDI enabled';
            case 'waiting':
                return 'Waiting for permission…';
            case 'learning':
                return 'Learning control… move a knob or fader';
            case 'no-inputs':
                return 'No MIDI inputs detected';
            default:
                return 'MIDI disabled';
        }
    }

    updateStatus(status, notify = true) {
        this.status = status;
        if (this.statusEl) {
            this.statusEl.textContent = this.statusLabel();
        }
        if (notify) {
            this.onStatusChange(this.statusLabel());
        }
    }

    requestAccess({ silent = false } = {}) {
        if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
            if (this.webMidiUnsupportedMessage) {
                this.webMidiUnsupportedMessage.hidden = false;
            }
            this.updateStatus('disabled', !silent);
            return;
        }

        if (!silent) {
            this.updateStatus('waiting');
        }

        navigator.requestMIDIAccess({ sysex: false }).then(access => {
            this.midiAccess = access;
            this.midiAccess.onstatechange = this.onMIDIAccessChangeBound;
            this.refreshInputs();
            if (this.pendingInputId && this.inputs.has(this.pendingInputId)) {
                this.setActiveInput(this.pendingInputId);
            } else {
                const firstInputId = this.inputs.size ? Array.from(this.inputs.keys())[0] : null;
                if (firstInputId) {
                    this.setActiveInput(firstInputId);
                }
            }
            this.updateStatus(this.inputs.size ? 'enabled' : 'no-inputs');
            this.persistState({ enabled: true });
        }).catch(error => {
            console.warn('PerformanceMidiBridge failed to obtain MIDI access', error);
            this.updateStatus('disabled', !silent);
        });
    }

    refreshInputs() {
        if (!this.midiAccess) {
            this.inputSelect.disabled = true;
            if (this.refreshButton) {
                this.refreshButton.disabled = true;
            }
            return;
        }

        this.inputs.forEach(input => {
            if (input) {
                input.onmidimessage = null;
            }
        });

        this.inputs.clear();
        this.midiAccess.inputs.forEach((input, key) => {
            this.inputs.set(key, input);
        });

        this.renderInputOptions();

        if (this.inputs.size === 0) {
            this.updateStatus('no-inputs');
        } else if (this.activeInputId && this.inputs.has(this.activeInputId)) {
            this.setActiveInput(this.activeInputId);
        }
    }

    renderInputOptions() {
        if (!this.inputSelect) return;
        const previousValue = this.inputSelect.value;
        this.inputSelect.innerHTML = '';

        if (this.inputs.size === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No inputs detected';
            this.inputSelect.appendChild(option);
            this.inputSelect.disabled = true;
            if (this.refreshButton) {
                this.refreshButton.disabled = true;
            }
            return;
        }

        this.inputs.forEach((input, id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = input.name || `Input ${id}`;
            this.inputSelect.appendChild(option);
        });

        this.inputSelect.disabled = false;
        if (this.refreshButton) {
            this.refreshButton.disabled = false;
        }

        const targetValue = this.activeInputId || this.pendingInputId || previousValue;
        if (targetValue && this.inputs.has(targetValue)) {
            this.inputSelect.value = targetValue;
        } else {
            this.inputSelect.selectedIndex = 0;
        }
    }

    handleInputSelection() {
        if (!this.inputSelect) return;
        const selected = this.inputSelect.value;
        if (!selected || !this.inputs.has(selected)) {
            return;
        }
        this.setActiveInput(selected);
        this.persistState();
    }

    setActiveInput(id) {
        if (!this.inputs.has(id)) {
            return;
        }

        if (this.activeInputId && this.inputs.has(this.activeInputId)) {
            const prev = this.inputs.get(this.activeInputId);
            if (prev) {
                prev.onmidimessage = null;
            }
        }

        this.activeInputId = id;
        const input = this.inputs.get(id);
        if (input) {
            input.onmidimessage = this.onMIDIMessageBound;
        }
        if (this.inputSelect) {
            this.inputSelect.value = id;
        }
    }

    onMIDIAccessChange() {
        this.refreshInputs();
    }

    addMapping() {
        const parameter = this.parameterOptions.length ? this.parameterOptions[0].id : null;
        if (!parameter) {
            return;
        }
        const mapping = {
            id: createId('mapping'),
            parameter,
            channel: this.config.channel || 'omni',
            control: null,
            type: 'cc',
            smoothing: typeof this.config.smoothing === 'number' ? this.config.smoothing : DEFAULT_OPTIONS.smoothing,
            pickupThreshold: typeof this.config.pickupThreshold === 'number' ? this.config.pickupThreshold : DEFAULT_OPTIONS.pickupThreshold,
            lastValue: 0,
            lastNormalized: 0,
            armed: false
        };
        this.mappings.push(mapping);
        this.persistState();
        this.renderMappings();
    }

    removeMapping(id) {
        this.mappings = this.mappings.filter(mapping => mapping.id !== id);
        this.mappingRefs.delete(id);
        this.persistState();
        this.renderMappings();
    }

    renderMappings() {
        if (!this.mappingList) return;
        this.mappingList.innerHTML = '';
        this.mappingRefs.clear();

        if (!this.mappings.length) {
            const empty = document.createElement('li');
            empty.className = 'hardware-bridge__empty';
            empty.textContent = this.parameterOptions.length
                ? 'No mappings yet. Add one to begin learning hardware controls.'
                : 'Parameter metadata unavailable. Connect to an engine to load parameters.';
            this.mappingList.appendChild(empty);
            return;
        }

        this.mappings.forEach(mapping => {
            const item = document.createElement('li');
            item.className = 'hardware-bridge__mapping';
            item.dataset.id = mapping.id;
            item.innerHTML = `
                <div class="hardware-bridge__mapping-target">
                    <label>
                        <span>Parameter</span>
                        <select></select>
                    </label>
                </div>
                <div class="hardware-bridge__mapping-binding" data-role="binding">${this.describeBinding(mapping)}</div>
                <div class="hardware-bridge__mapping-value" data-role="value">--</div>
                <div class="hardware-bridge__mapping-actions">
                    <button type="button" data-action="learn">Learn</button>
                    <button type="button" data-action="remove">Remove</button>
                </div>
            `;

            const select = item.querySelector('select');
            if (select) {
                this.parameterOptions.forEach(option => {
                    const opt = document.createElement('option');
                    opt.value = option.id;
                    opt.textContent = option.label;
                    if (option.group) {
                        opt.dataset.group = option.group;
                    }
                    select.appendChild(opt);
                });
                const hasExisting = this.parameterOptions.some(option => option.id === mapping.parameter);
                if (!hasExisting && this.parameterOptions.length) {
                    mapping.parameter = this.parameterOptions[0].id;
                }
                select.value = mapping.parameter || '';
                select.addEventListener('change', () => {
                    mapping.parameter = select.value;
                    this.persistState();
                });
            }

            const learnButton = item.querySelector('[data-action="learn"]');
            learnButton.addEventListener('click', () => this.armMapping(mapping.id));
            const removeButton = item.querySelector('[data-action="remove"]');
            removeButton.addEventListener('click', () => this.removeMapping(mapping.id));

            const bindingLabel = item.querySelector('[data-role="binding"]');
            const valueLabel = item.querySelector('[data-role="value"]');

            this.mappingRefs.set(mapping.id, { element: item, bindingLabel, valueLabel });

            this.mappingList.appendChild(item);
        });
    }

    describeBinding(mapping) {
        if (!mapping.control && mapping.control !== 0) {
            return 'Unassigned – click Learn';
        }
        const channel = typeof mapping.channel === 'number' ? mapping.channel + 1 : mapping.channel;
        return `CC ${mapping.control}${channel ? ` · Ch ${channel}` : ''}`;
    }

    armMapping(id) {
        if (!this.inputs.size) {
            this.updateStatus('no-inputs');
            return;
        }

        this.learnMappingId = id;
        this.updateStatus('learning');
        this.mappings.forEach(mapping => {
            mapping.armed = mapping.id === id;
            const ref = this.mappingRefs.get(mapping.id);
            if (ref?.element) {
                ref.element.classList.toggle('hardware-bridge__mapping--armed', mapping.armed);
            }
        });
    }

    onMIDIMessage(event) {
        if (!event?.data || event.data.length < 3) return;
        const [status, data1, data2] = event.data;
        const messageType = status & 0xF0;
        const channel = status & 0x0F;

        if (messageType !== SUPPORTED_MESSAGE_TYPES.cc) {
            return;
        }

        const control = data1;
        const value = data2 / 127;

        if (this.learnMappingId) {
            this.assignLearnedControl(channel, control);
            return;
        }

        this.mappings.forEach(mapping => {
            if (!mapping.control && mapping.control !== 0) return;
            if (typeof mapping.channel === 'number' && mapping.channel !== channel) return;
            const smoothed = this.applySmoothing(mapping, value);
            this.applyMappingValue(mapping, smoothed);
        });
    }

    assignLearnedControl(channel, control) {
        const mapping = this.mappings.find(entry => entry.id === this.learnMappingId);
        if (!mapping) {
            this.learnMappingId = null;
            this.updateStatus('enabled');
            return;
        }

        mapping.channel = this.config.channel === 'omni' ? 'omni' : channel;
        mapping.control = control;
        mapping.armed = false;
        mapping.lastValue = 0;
        mapping.lastNormalized = 0;
        this.learnMappingId = null;
        this.persistState();
        this.updateStatus('enabled');

        const ref = this.mappingRefs.get(mapping.id);
        if (ref?.bindingLabel) {
            ref.bindingLabel.textContent = this.describeBinding(mapping);
        }
    }

    applySmoothing(mapping, incomingNormalized) {
        const smoothing = clamp01(typeof mapping.smoothing === 'number' ? mapping.smoothing : this.config.smoothing);
        const previous = typeof mapping.lastNormalized === 'number' ? mapping.lastNormalized : incomingNormalized;
        const next = previous + (incomingNormalized - previous) * (1 - smoothing);
        mapping.lastNormalized = next;
        mapping.lastValue = incomingNormalized;
        return next;
    }

    applyMappingValue(mapping, normalized) {
        const parameterId = mapping.parameter;
        if (!parameterId) return;

        const def = this.parameterManager?.getParameterDefinition?.(parameterId);
        let value = normalized;
        if (def) {
            value = def.min + (def.max - def.min) * clamp01(normalized);
            if (def.type === 'int') {
                value = Math.round(value);
            }
        }

        this.parameterManager?.setParameter?.(parameterId, value, 'midi');
        this.hub?.emit?.('hardware:midi-value', {
            mappingId: mapping.id,
            parameter: parameterId,
            value,
            normalized: clamp01(normalized),
            control: mapping.control,
            channel: mapping.channel,
            inputId: this.activeInputId
        });

        const ref = this.mappingRefs.get(mapping.id);
        if (ref?.valueLabel) {
            const display = def?.type === 'int' ? value.toFixed(0) : value.toFixed(3);
            ref.valueLabel.textContent = display;
        }
    }

    persistState(partial = {}) {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const enabledStatuses = new Set(['enabled', 'learning', 'no-inputs']);
        const payload = {
            mappings: this.mappings.map(mapping => ({
                id: mapping.id,
                parameter: mapping.parameter,
                channel: mapping.channel,
                control: mapping.control,
                type: mapping.type,
                smoothing: mapping.smoothing,
                pickupThreshold: mapping.pickupThreshold
            })),
            inputId: this.activeInputId,
            enabled: enabledStatuses.has(this.status),
            ...partial
        };
        try {
            window.localStorage.setItem(this.storageKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('PerformanceMidiBridge failed to persist state', error);
        }
    }

    loadState() {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        try {
            const raw = window.localStorage.getItem(this.storageKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                return null;
            }
            if (Array.isArray(parsed.presets) && !parsed.mappings) {
                return null;
            }
            return {
                mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
                inputId: parsed.inputId || null,
                enabled: parsed.enabled === true
            };
        } catch (error) {
            console.warn('PerformanceMidiBridge failed to load state', error);
            return null;
        }
    }

    getState() {
        const enabledStatuses = new Set(['enabled', 'learning', 'no-inputs']);
        return {
            mappings: this.mappings.map(mapping => ({
                id: mapping.id,
                parameter: mapping.parameter,
                channel: mapping.channel,
                control: mapping.control,
                type: mapping.type,
                smoothing: mapping.smoothing,
                pickupThreshold: mapping.pickupThreshold
            })),
            inputId: this.activeInputId,
            enabled: enabledStatuses.has(this.status)
        };
    }

    applyState(state = {}) {
        if (Array.isArray(state.mappings)) {
            this.mappings = state.mappings.map(mapping => ({
                id: mapping.id || createId('mapping'),
                parameter: mapping.parameter,
                channel: mapping.channel ?? (this.config.channel || 'omni'),
                control: typeof mapping.control === 'number' ? mapping.control : null,
                type: mapping.type || 'cc',
                smoothing: typeof mapping.smoothing === 'number' ? mapping.smoothing : this.config.smoothing,
                pickupThreshold: typeof mapping.pickupThreshold === 'number' ? mapping.pickupThreshold : this.config.pickupThreshold,
                lastValue: 0,
                lastNormalized: 0,
                armed: false
            }));
        }
        if (state.inputId) {
            this.pendingInputId = state.inputId;
            if (this.inputs.has(state.inputId)) {
                this.setActiveInput(state.inputId);
            }
        }
        if (state.enabled && !this.midiAccess) {
            this.requestAccess({ silent: true });
        }
        this.refreshParameterOptions();
        this.persistState();
    }

    destroy() {
        if (this.inputs) {
            this.inputs.forEach(input => {
                if (input) {
                    input.onmidimessage = null;
                }
            });
            this.inputs.clear();
        }
        if (this.midiAccess) {
            this.midiAccess.onstatechange = null;
        }
        this.mappingRefs.clear();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
