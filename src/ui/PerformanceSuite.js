import { TouchPadController } from './TouchPadController.js';
import { AudioReactivityPanel } from './AudioReactivityPanel.js';
import { PerformancePresetManager } from './PerformancePresetManager.js';
import { PerformanceHub } from './PerformanceHub.js';
import { DEFAULT_PERFORMANCE_CONFIG, mergePerformanceConfig } from './PerformanceConfig.js';

/**
 * PerformanceSuite orchestrates live performance controls for the engine.
 */
export class PerformanceSuite {
    constructor(options = {}) {
        const { engine, parameterManager, config = {} } = options;
        this.engine = engine;
        this.parameterManager = parameterManager;
        this.config = mergePerformanceConfig(config);

        this.root = null;
        this.touchPadController = null;
        this.audioPanel = null;
        this.presetManager = null;
        this.hub = new PerformanceHub({
            engine: this.engine,
            parameterManager: this.parameterManager
        });
        this.mappingSnapshot = [];
        this.audioSettings = null;
        this.unsubscribe = null;
        this.layoutSettings = { ...this.config.touchPads.layout };
        this.eventUnsubscribers = [];
        this.extensionUnregister = null;

        this.init();
    }

    init() {
        this.createLayout();
        this.touchPadController = new TouchPadController({
            parameterManager: this.parameterManager,
            container: this.touchpadContainer,
            config: this.config.touchPads,
            hub: this.hub,
            onMappingChange: (mappings) => {
                this.mappingSnapshot = mappings;
            },
            onLayoutChange: (layout) => {
                this.layoutSettings = layout;
                this.applyTouchPadLayout(layout);
            }
        });

        this.audioPanel = new AudioReactivityPanel({
            parameterManager: this.parameterManager,
            container: this.audioContainer,
            config: this.config.audio,
            hub: this.hub,
            onSettingsChange: (settings) => this.handleAudioSettingsChange(settings)
        });

        this.presetManager = new PerformancePresetManager({
            parameterManager: this.parameterManager,
            touchPadController: this.touchPadController,
            audioPanel: this.audioPanel,
            container: this.presetsContainer,
            hub: this.hub,
            onPresetApply: (preset) => this.handlePresetApplied(preset)
        });

        this.bindHubEvents();
        this.hub.registerTouchPadController(this.touchPadController);
        this.hub.registerAudioPanel(this.audioPanel);
        this.hub.registerPresetManager(this.presetManager);
        this.extensionUnregister = this.hub.registerExtension('performance-suite', {
            getState: () => this.getState(),
            applyState: (state) => this.applyState(state),
            getModules: () => ({
                touchPads: this.touchPadController,
                audio: this.audioPanel,
                presets: this.presetManager
            })
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
        window.performanceHub = this.hub;
    }

    bindHubEvents() {
        const subscriptions = [
            this.hub.on('touchpad-mapping-change', ({ mappings }) => {
                this.mappingSnapshot = mappings;
            }),
            this.hub.on('touchpad-layout-change', ({ layout }) => {
                if (!layout) return;
                this.layoutSettings = { ...this.layoutSettings, ...layout };
                this.applyTouchPadLayout(this.layoutSettings);
            }),
            this.hub.on('audio-settings-change', ({ settings }) => {
                if (!settings) return;
                this.audioSettings = settings;
                this.applyAudioSettingsToEngine();
            }),
            this.hub.on('preset-applied', ({ preset }) => {
                if (!preset) return;
                this.handlePresetApplied(preset);
            })
        ];

        this.eventUnsubscribers.push(...subscriptions);
    }

    createLayout() {
        const host = document.getElementById('controlPanel') || document.body;

        this.root = document.createElement('section');
        this.root.classList.add('performance-suite');
        this.applyTouchPadLayout(this.layoutSettings);

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

    applyTouchPadLayout(layout = DEFAULT_PERFORMANCE_CONFIG.touchPads.layout) {
        if (!this.root || !layout) return;

        const target = this.touchpadContainer || this.root;
        if (!target) return;

        if (layout.minWidth) {
            target.style.setProperty('--touchpad-min-width', `${layout.minWidth}px`);
        }
        if (layout.gap !== undefined) {
            target.style.setProperty('--touchpad-gap', `${layout.gap}px`);
        }
        if (layout.aspectRatio) {
            target.style.setProperty('--touchpad-aspect-ratio', layout.aspectRatio);
        }
        if (layout.crosshairSize) {
            target.style.setProperty('--touchpad-crosshair-size', `${layout.crosshairSize}px`);
        }
        if (layout.columns && layout.columns !== 'auto') {
            target.style.setProperty('--touchpad-columns', layout.columns);
        } else {
            target.style.removeProperty('--touchpad-columns');
        }
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

    getState() {
        return this.hub.getState();
    }

    applyState(state) {
        this.hub.applyState(state);
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        this.eventUnsubscribers.forEach(unsub => {
            try {
                unsub?.();
            } catch (error) {
                console.warn('Failed to unsubscribe hub listener:', error);
            }
        });
        this.eventUnsubscribers = [];
        this.touchPadController?.destroy();
        this.audioPanel?.destroy();
        this.root?.remove();
        if (typeof this.extensionUnregister === 'function') {
            try {
                this.extensionUnregister();
            } catch (error) {
                console.warn('Failed to unregister hub extension:', error);
            }
            this.extensionUnregister = null;
        }
        this.hub?.destroy();
        if (typeof window !== 'undefined') {
            if (window.performanceSuite === this) {
                window.performanceSuite = null;
            }
            if (window.performanceHub === this.hub) {
                window.performanceHub = null;
            }
        }
    }
}
