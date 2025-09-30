import { TouchPadController } from './TouchPadController.js';
import { AudioReactivityPanel } from './AudioReactivityPanel.js';
import { PerformancePresetManager } from './PerformancePresetManager.js';

/**
 * PerformanceSuite orchestrates live performance controls for the engine.
 */
export class PerformanceSuite {
    constructor(options = {}) {
        const { engine, parameterManager } = options;
        this.engine = engine;
        this.parameterManager = parameterManager;

        this.root = null;
        this.touchPadController = null;
        this.audioPanel = null;
        this.presetManager = null;
        this.mappingSnapshot = [];
        this.audioSettings = null;
        this.unsubscribe = null;

        this.init();
    }

    init() {
        this.createLayout();
        this.touchPadController = new TouchPadController({
            parameterManager: this.parameterManager,
            container: this.touchpadContainer,
            onMappingChange: (mappings) => {
                this.mappingSnapshot = mappings;
            }
        });

        this.audioPanel = new AudioReactivityPanel({
            parameterManager: this.parameterManager,
            container: this.audioContainer,
            onSettingsChange: (settings) => this.handleAudioSettingsChange(settings)
        });

        this.presetManager = new PerformancePresetManager({
            parameterManager: this.parameterManager,
            touchPadController: this.touchPadController,
            audioPanel: this.audioPanel,
            container: this.presetsContainer,
            onPresetApply: (preset) => this.handlePresetApplied(preset)
        });

        this.mappingSnapshot = this.touchPadController.getMappings();
        this.audioSettings = this.audioPanel.getSettings();
        this.applyAudioSettingsToEngine();

        if (this.parameterManager) {
            this.unsubscribe = this.parameterManager.addChangeListener(() => {
                // Could be used for analytics or additional behaviours.
            });
        }

        window.performanceSuite = this;
    }

    createLayout() {
        const host = document.getElementById('controlPanel') || document.body;

        this.root = document.createElement('section');
        this.root.classList.add('performance-suite');

        const columns = document.createElement('div');
        columns.classList.add('performance-columns');

        this.touchpadContainer = document.createElement('section');
        this.touchpadContainer.classList.add('performance-column', 'performance-column--touchpads');

        this.audioContainer = document.createElement('section');
        this.audioContainer.classList.add('performance-column', 'performance-column--audio');

        this.presetsContainer = document.createElement('section');
        this.presetsContainer.classList.add('performance-column', 'performance-column--presets');

        columns.appendChild(this.touchpadContainer);
        columns.appendChild(this.audioContainer);
        columns.appendChild(this.presetsContainer);

        this.root.appendChild(columns);
        host.appendChild(this.root);
    }

    handleAudioSettingsChange(settings) {
        this.audioSettings = settings;
        this.applyAudioSettingsToEngine();
    }

    applyAudioSettingsToEngine() {
        if (!this.engine) return;
        this.engine.liveAudioSettings = this.audioSettings;
    }

    handlePresetApplied(preset) {
        if (!preset) return;
        this.mappingSnapshot = preset.mappings || this.mappingSnapshot;
        if (preset.audio) {
            this.audioSettings = preset.audio;
            this.applyAudioSettingsToEngine();
        }
    }

    getAudioSettings() {
        return this.audioSettings;
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        this.touchPadController?.destroy();
        this.audioPanel?.destroy();
        this.root?.remove();
    }
}
