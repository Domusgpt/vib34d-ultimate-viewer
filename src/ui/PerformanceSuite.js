import { TouchPadController } from './TouchPadController.js';
import { AudioReactivityPanel } from './AudioReactivityPanel.js';
import { PerformancePresetManager } from './PerformancePresetManager.js';
import { PerformanceHub } from './PerformanceHub.js';
import { PerformanceShowPlanner } from './PerformanceShowPlanner.js';
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
        this.showPlanner = null;
        this.touchPadState = { mappings: [], layout: null };
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
            onMappingChange: (state) => {
                this.touchPadState = state;
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

        this.showPlanner = new PerformanceShowPlanner({
            presetManager: this.presetManager,
            container: this.presetsContainer,
            hub: this.hub,
            config: this.config.presets?.showPlanner
        });

        this.touchPadState = this.touchPadController.getState();
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
        const touchPads = this.touchPadController?.getState?.() || { mappings: [] };
        return {
            touchPads,
            mappings: touchPads.mappings,
            audio: this.audioPanel?.getSettings?.() || {},
            presets: this.presetManager?.getState?.().presets || [],
            showPlanner: this.showPlanner?.getState?.() || { cues: [] }
        };
    }

    applyState(state = {}) {
        if (state.touchPads && this.touchPadController?.applyState) {
            this.touchPadController.applyState(state.touchPads);
        } else if (state.mappings && this.touchPadController) {
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
        if (state.showPlanner && this.showPlanner) {
            this.showPlanner.applyState(state.showPlanner);
        }
        this.touchPadState = this.touchPadController?.getState?.() || this.touchPadState;
    }

    destroy() {
        if (this.touchPadController) {
            this.touchPadController.destroy();
            this.touchPadController = null;
        }
        if (this.showPlanner) {
            this.showPlanner.destroy();
            this.showPlanner = null;
        }
        this.audioPanel = null;
        this.presetManager = null;
        if (this.root && this.root.parentNode) {
            this.root.parentNode.removeChild(this.root);
        }
    }
}
