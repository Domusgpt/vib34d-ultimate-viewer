import { TouchPadController } from './TouchPadController.js';
import { AudioReactivityPanel } from './AudioReactivityPanel.js';
import { PerformancePresetManager } from './PerformancePresetManager.js';
import { DEFAULT_PERFORMANCE_CONFIG, mergePerformanceConfig } from './PerformanceConfig.js';

/**
 * PerformanceSuite orchestrates live performance controls for the engine.
 */
export class PerformanceSuite {
    constructor(options = {}) {
        const { engine, parameterManager, config = {}, host = null, mountSelector = null } = options;
        this.engine = engine;
        this.parameterManager = parameterManager;
        this.config = mergePerformanceConfig(config);
        this.host = host || null;
        this.mountSelector = mountSelector || this.config?.hostSelector || null;

        this.root = null;
        this.touchPadController = null;
        this.audioPanel = null;
        this.presetManager = null;
        this.mappingSnapshot = [];
        this.audioSettings = null;
        this.unsubscribe = null;
        this.layoutSettings = { ...this.config.touchPads.layout };

        this.init();
    }

    init() {
        this.createLayout();
        this.touchPadController = new TouchPadController({
            parameterManager: this.parameterManager,
            container: this.touchpadContainer,
            config: this.config.touchPads,
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
        const host = this.resolveHostElement();
        this.host = host;

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

    resolveHostElement() {
        if (this.host instanceof HTMLElement) {
            return this.host;
        }

        if (this.mountSelector) {
            const target = document.querySelector(this.mountSelector);
            if (target) {
                return target;
            }
        }

        const explicitHost = document.getElementById('performance-suite-host');
        if (explicitHost) {
            return explicitHost;
        }

        return document.getElementById('controlPanel') || document.body;
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

    getSnapshot() {
        return {
            mappings: this.touchPadController?.getMappings() || null,
            audio: this.audioPanel?.getSettings() || null,
            layout: { ...this.layoutSettings }
        };
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        this.touchPadController?.destroy();
        this.audioPanel?.destroy();
        this.root?.remove();
        this.root = null;
        if (typeof window !== 'undefined' && window.performanceSuite === this) {
            delete window.performanceSuite;
        }
    }
}
