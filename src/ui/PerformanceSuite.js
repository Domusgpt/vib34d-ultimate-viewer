import { TouchPadController } from './TouchPadController.js';
import { AudioReactivityPanel } from './AudioReactivityPanel.js';
import { PerformancePresetManager } from './PerformancePresetManager.js';
import { PerformanceHub } from './PerformanceHub.js';
import { mergePerformanceConfig } from './PerformanceConfig.js';

export class PerformanceSuite {
    constructor({ engine = null, parameterManager = null, config = {} } = {}) {
        this.engine = engine;
        this.parameterManager = parameterManager;
        this.config = mergePerformanceConfig(config);

        this.hub = new PerformanceHub({ engine: this.engine, parameterManager: this.parameterManager });
        this.root = null;
        this.touchPadController = null;
        this.audioPanel = null;
        this.presetManager = null;
        this.mappingSnapshot = [];
        this.audioSettings = null;

        this.init();
    }

    init() {
        this.mountLayout();
        this.touchPadController = new TouchPadController({
            parameterManager: this.parameterManager,
            container: this.touchpadContainer,
            config: this.config.touchPads,
            hub: this.hub,
            onMappingChange: (mappings) => {
                this.mappingSnapshot = mappings;
            }
        });

        this.audioPanel = new AudioReactivityPanel({
            parameterManager: this.parameterManager,
            container: this.audioContainer,
            config: this.config.audio,
            hub: this.hub,
            onSettingsChange: (settings) => this.handleAudioSettings(settings)
        });

        this.presetManager = new PerformancePresetManager({
            parameterManager: this.parameterManager,
            touchPadController: this.touchPadController,
            audioPanel: this.audioPanel,
            container: this.presetsContainer,
            hub: this.hub,
            config: this.config.presets
        });

        this.mappingSnapshot = this.touchPadController.getMappings();
        this.audioSettings = this.audioPanel.getSettings();
        this.applyAudioSettings();
    }

    mountLayout() {
        const host = document.getElementById('controlPanel') || document.body;
        this.root = document.createElement('section');
        this.root.className = 'performance-suite';

        const columns = document.createElement('div');
        columns.className = 'performance-suite__columns';

        this.touchpadContainer = document.createElement('section');
        this.touchpadContainer.className = 'performance-suite__column';
        columns.appendChild(this.touchpadContainer);

        this.audioContainer = document.createElement('section');
        this.audioContainer.className = 'performance-suite__column';
        columns.appendChild(this.audioContainer);

        this.presetsContainer = document.createElement('section');
        this.presetsContainer.className = 'performance-suite__column';
        columns.appendChild(this.presetsContainer);

        this.root.appendChild(columns);
        host.appendChild(this.root);
    }

    handleAudioSettings(settings) {
        this.audioSettings = settings;
        this.applyAudioSettings();
    }

    applyAudioSettings() {
        if (this.engine && typeof this.engine.setLiveAudioSettings === 'function') {
            this.engine.setLiveAudioSettings(this.audioSettings);
        }
    }

    getState() {
        return {
            mappings: this.touchPadController?.getMappings?.() || [],
            audio: this.audioPanel?.getSettings?.() || {},
            presets: this.presetManager?.getState?.().presets || []
        };
    }

    applyState(state = {}) {
        if (state.mappings && this.touchPadController) {
            this.touchPadController.applyMappings(state.mappings);
        }
        if (state.audio && this.audioPanel) {
            this.audioPanel.applySettings(state.audio);
        }
        if (Array.isArray(state.presets) && this.presetManager) {
            this.presetManager.presets = state.presets;
            this.presetManager.persist();
            this.presetManager.renderPresetList();
        }
    }

    destroy() {
        if (this.touchPadController) {
            this.touchPadController.destroy();
            this.touchPadController = null;
        }
        this.audioPanel = null;
        this.presetManager = null;
        if (this.root && this.root.parentNode) {
            this.root.parentNode.removeChild(this.root);
        }
    }
}
