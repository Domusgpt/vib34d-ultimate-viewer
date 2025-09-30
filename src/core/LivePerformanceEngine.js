import { PerformancePresetManager } from './PerformancePresetManager.js';
import { AudioReactivityController } from './AudioReactivityController.js';
import { LiveTouchPadConsole } from '../ui/LiveTouchPadConsole.js';

export class LivePerformanceEngine {
    constructor({
        parameterSchema = window.parameterMapper?.unifiedSchema || {},
        updateParameter = (param, value) => window.updateParameter?.(param, value),
        reactivityManager = window.unifiedReactivityManager,
        container = document.body
    } = {}) {
        this.schema = parameterSchema;
        this.updateParameter = updateParameter;
        this.reactivityManager = reactivityManager;
        this.container = container;

        this.audioEnabled = window.audioEnabled ?? true;
        this.audioBands = {
            bass: true,
            mid: true,
            high: true,
            energy: true,
            ...(window.audioReactivityBands || {})
        };

        this.reactiveFlourish = null;
        this.reactiveConfig = { threshold: 0.85, band: 'energy', cooldown: 2000, lastTrigger: 0 };
        this.monitorHandle = null;

        this.touchPadConsole = new LiveTouchPadConsole({
            parameterSchema: this.schema,
            container: this.container,
            onParameterChange: (param, value) => this.handleParameterChange(param, value),
            onAxisChange: (index, mappings) => this.handleAxisChange(index, mappings)
        });

        this.presetManager = new PerformancePresetManager({
            schema: this.schema,
            captureState: () => this.collectCurrentParameters(),
            applyParameter: (param, value) => this.applyParameter(param, value)
        });

        this.buildControlPanel();
        this.monitorAudio();

        window.livePerformanceEngine = this;
    }

    collectCurrentParameters() {
        if (typeof window.getCurrentUIParameterState === 'function') {
            return { ...window.getCurrentUIParameterState(), ...this.presetManager.currentLiveState };
        }

        const state = { ...this.presetManager.currentLiveState };
        Object.keys(this.schema).forEach(param => {
            if (state[param] !== undefined) return;
            const input = document.getElementById(param);
            if (input) {
                state[param] = parseFloat(input.value);
            }
        });
        return state;
    }

    applyParameter(param, value) {
        if (typeof this.updateParameter === 'function') {
            this.updateParameter(param, value);
        }
    }

    handleParameterChange(param, value) {
        this.applyParameter(param, value);
        this.presetManager.recordLiveValue(param, value);
    }

    handleAxisChange(index, mappings) {
        console.log(`🎚️ Touch pad ${index} mappings updated`, mappings);
    }

    buildControlPanel() {
        const panel = document.createElement('div');
        panel.className = 'performance-control-panel';
        panel.innerHTML = `
            <style>
                #live-touch-console .performance-control-panel {
                    margin-top: 16px;
                    background: rgba(0, 14, 26, 0.9);
                    border: 1px solid rgba(0, 180, 255, 0.35);
                    border-radius: 12px;
                    padding: 12px;
                    font-size: 0.7rem;
                }

                .performance-control-panel h3 {
                    margin: 8px 0;
                    font-size: 0.75rem;
                    color: #7ff6ff;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                }

                .toggle-row, .preset-row, .flourish-row {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    margin-bottom: 8px;
                }

                .toggle-row button {
                    flex: 1 1 80px;
                    background: rgba(0, 60, 100, 0.6);
                    border: 1px solid rgba(0, 200, 255, 0.4);
                    border-radius: 8px;
                    color: #c8f6ff;
                    padding: 6px 8px;
                    cursor: pointer;
                    transition: background 0.2s ease, color 0.2s ease, border 0.2s ease;
                }

                .toggle-row button.active {
                    background: linear-gradient(120deg, #00f6ff, #0094ff);
                    color: #00111f;
                    border-color: rgba(0, 255, 255, 0.8);
                }

                .preset-row input, .flourish-row input, .flourish-row select, .preset-row select {
                    flex: 1 1 120px;
                    background: rgba(0, 40, 70, 0.8);
                    color: #e0f8ff;
                    border: 1px solid rgba(0, 200, 255, 0.4);
                    border-radius: 6px;
                    padding: 5px 6px;
                }

                .preset-row button, .flourish-row button {
                    flex: 0 0 auto;
                    background: rgba(0, 80, 120, 0.7);
                    border: 1px solid rgba(0, 200, 255, 0.5);
                    color: #dffbff;
                    border-radius: 6px;
                    padding: 5px 10px;
                    cursor: pointer;
                }

                .preset-row button:hover, .flourish-row button:hover, .toggle-row button:hover {
                    background: rgba(0, 160, 220, 0.9);
                }
            </style>
            <div class="panel-section">
                <h3>Audio Reactivity</h3>
                <div class="toggle-row">
                    <button data-band="master">Audio</button>
                    <button data-band="bass">Bass</button>
                    <button data-band="mid">Mid</button>
                    <button data-band="high">High</button>
                    <button data-band="energy">Energy</button>
                </div>
            </div>
            <div class="panel-section">
                <h3>Presets</h3>
                <div class="preset-row">
                    <input type="text" class="preset-name" placeholder="Preset name" />
                    <input type="number" class="preset-duration" placeholder="Transition (ms)" min="0" value="1200" />
                    <button data-action="save-preset">Save</button>
                </div>
                <div class="preset-row">
                    <select class="preset-select"></select>
                    <button data-action="load-preset">Load</button>
                    <button data-action="delete-preset">Delete</button>
                </div>
            </div>
            <div class="panel-section">
                <h3>Flourishes</h3>
                <div class="flourish-row">
                    <input type="text" class="flourish-name" placeholder="Flourish name" />
                    <input type="number" class="flourish-duration" placeholder="Duration (ms)" value="1000" min="0" />
                    <input type="number" class="flourish-hold" placeholder="Hold (ms)" value="0" min="0" />
                    <button data-action="add-step">Add Step</button>
                </div>
                <div class="flourish-row">
                    <select class="flourish-select"></select>
                    <button data-action="play-flourish">Play</button>
                    <button data-action="clear-flourish">Clear</button>
                </div>
                <div class="flourish-row">
                    <select class="reactive-band">
                        <option value="energy">Energy</option>
                        <option value="bass">Bass</option>
                        <option value="mid">Mid</option>
                        <option value="high">High</option>
                    </select>
                    <input type="number" class="reactive-threshold" value="0.85" step="0.05" min="0" max="1" />
                    <input type="number" class="reactive-cooldown" value="2000" min="0" />
                    <button data-action="set-reactive">Set Reactive</button>
                </div>
            </div>
        `;

        this.touchPadConsole.root.appendChild(panel);

        this.audioButtons = panel.querySelectorAll('.toggle-row button');
        this.presetNameInput = panel.querySelector('.preset-name');
        this.presetDurationInput = panel.querySelector('.preset-duration');
        this.presetSelect = panel.querySelector('.preset-select');
        this.flourishNameInput = panel.querySelector('.flourish-name');
        this.flourishDurationInput = panel.querySelector('.flourish-duration');
        this.flourishHoldInput = panel.querySelector('.flourish-hold');
        this.flourishSelect = panel.querySelector('.flourish-select');
        this.reactiveBandSelect = panel.querySelector('.reactive-band');
        this.reactiveThresholdInput = panel.querySelector('.reactive-threshold');
        this.reactiveCooldownInput = panel.querySelector('.reactive-cooldown');

        panel.querySelector('[data-action="save-preset"]').addEventListener('click', () => this.savePreset());
        panel.querySelector('[data-action="load-preset"]').addEventListener('click', () => this.loadPreset());
        panel.querySelector('[data-action="delete-preset"]').addEventListener('click', () => this.deletePreset());
        panel.querySelector('[data-action="add-step"]').addEventListener('click', () => this.addFlourishStep());
        panel.querySelector('[data-action="play-flourish"]').addEventListener('click', () => this.playFlourish());
        panel.querySelector('[data-action="clear-flourish"]').addEventListener('click', () => this.clearFlourish());
        panel.querySelector('[data-action="set-reactive"]').addEventListener('click', () => this.configureReactiveFlourish());

        this.audioButtons.forEach(button => {
            button.addEventListener('click', () => this.toggleAudio(button.dataset.band));
        });

        this.syncAudioUI();
        this.updatePresetSelect();
        this.updateFlourishSelect();
    }

    toggleAudio(band) {
        if (band === 'master') {
            this.audioEnabled = !this.audioEnabled;
            this.applyAudioState();
        } else {
            this.audioBands[band] = !this.audioBands[band];
            this.applyAudioState();
        }
    }

    applyAudioState() {
        if (this.reactivityManager?.setState) {
            this.reactivityManager.setState({
                audio: this.audioEnabled,
                audioBands: { ...this.audioBands }
            });
        } else {
            window.audioEnabled = this.audioEnabled;
            AudioReactivityController.setBands(this.audioBands);
        }
        this.syncAudioUI();
    }

    syncAudioUI() {
        this.audioButtons.forEach(button => {
            if (button.dataset.band === 'master') {
                button.classList.toggle('active', !!this.audioEnabled);
                button.textContent = this.audioEnabled ? 'Audio ON' : 'Audio OFF';
            } else {
                button.classList.toggle('active', this.audioBands[button.dataset.band] !== false);
            }
        });
    }

    savePreset() {
        const name = (this.presetNameInput.value || '').trim();
        if (!name) {
            alert('Enter a preset name');
            return;
        }
        this.presetManager.savePreset(name);
        this.updatePresetSelect(name);
    }

    loadPreset() {
        const name = this.presetSelect.value;
        if (!name) return;
        const duration = parseInt(this.presetDurationInput.value, 10);
        if (duration > 0) {
            this.presetManager.loadPreset(name, { duration });
        } else {
            this.presetManager.loadPreset(name);
        }
    }

    deletePreset() {
        const name = this.presetSelect.value;
        if (!name) return;
        this.presetManager.deletePreset(name);
        this.updatePresetSelect();
    }

    updatePresetSelect(selected) {
        const names = this.presetManager.getPresetNames();
        this.presetSelect.innerHTML = names.map(name => `<option value="${name}">${name}</option>`).join('');
        if (selected && names.includes(selected)) {
            this.presetSelect.value = selected;
        }
    }

    addFlourishStep() {
        const name = (this.flourishNameInput.value || '').trim();
        if (!name) {
            alert('Enter a flourish name');
            return;
        }
        if (!this.presetManager.flourishes.has(name)) {
            this.presetManager.startFlourish(name);
        }
        const duration = Math.max(0, parseInt(this.flourishDurationInput.value, 10) || 0);
        const hold = Math.max(0, parseInt(this.flourishHoldInput.value, 10) || 0);
        this.presetManager.addFlourishStep(name, {
            state: this.collectCurrentParameters(),
            duration,
            hold
        });
        this.updateFlourishSelect(name);
    }

    playFlourish() {
        const name = this.flourishSelect.value || this.flourishNameInput.value;
        if (!name) return;
        this.presetManager.triggerFlourish(name);
    }

    clearFlourish() {
        const name = this.flourishSelect.value || this.flourishNameInput.value;
        if (!name) return;
        this.presetManager.clearFlourish(name);
        if (this.reactiveFlourish === name) {
            this.reactiveFlourish = null;
        }
        this.updateFlourishSelect();
    }

    configureReactiveFlourish() {
        const name = this.flourishSelect.value || this.flourishNameInput.value;
        if (!name) return;
        this.reactiveFlourish = name;
        this.reactiveConfig = {
            band: this.reactiveBandSelect.value,
            threshold: parseFloat(this.reactiveThresholdInput.value) || 0.85,
            cooldown: parseInt(this.reactiveCooldownInput.value, 10) || 2000,
            lastTrigger: 0
        };
        this.presetManager.setFlourishReactive(name, this.reactiveConfig);
    }

    updateFlourishSelect(selected) {
        const names = this.presetManager.getFlourishNames();
        this.flourishSelect.innerHTML = names.map(name => `<option value="${name}">${name}</option>`).join('');
        if (selected && names.includes(selected)) {
            this.flourishSelect.value = selected;
        }
    }

    monitorAudio() {
        const step = () => {
            const bands = AudioReactivityController.getFilteredBands();
            if (bands && this.reactiveFlourish) {
                const value = bands[this.reactiveConfig.band] ?? bands.energy ?? 0;
                const now = performance.now();
                if (value >= this.reactiveConfig.threshold && (now - this.reactiveConfig.lastTrigger) > this.reactiveConfig.cooldown) {
                    this.presetManager.triggerFlourish(this.reactiveFlourish);
                    this.reactiveConfig.lastTrigger = now;
                }
            }
            this.monitorHandle = requestAnimationFrame(step);
        };
        this.monitorHandle = requestAnimationFrame(step);
    }

    destroy() {
        if (this.monitorHandle) {
            cancelAnimationFrame(this.monitorHandle);
            this.monitorHandle = null;
        }
        if (this.touchPadConsole) {
            this.touchPadConsole.destroy();
        }
    }
}

window.LivePerformanceEngine = LivePerformanceEngine;
