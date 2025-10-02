import { TouchPadController } from './TouchPadController.js';
import { AudioReactivityPanel } from './AudioReactivityPanel.js';
import { PerformancePresetManager } from './PerformancePresetManager.js';
import { PerformanceHub } from './PerformanceHub.js';
import { mergePerformanceConfig } from './PerformanceConfig.js';
import { PerformanceShowPlanner } from './PerformanceShowPlanner.js';

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
        this.subscriptions = [];
        this.showPlanner = null;

        this.mountLayout();
        this.initModules();
    }

    mountLayout() {
        if (typeof document === 'undefined') return;
        const host = document.getElementById('controlPanel') || document.body;
        this.root = document.createElement('section');
        this.root.className = 'performance-suite';
        this.root.innerHTML = `
            <header class="performance-suite__header">
                <div>
                    <h2>Live Performance Suite</h2>
                    <p>Designed for DJs, bands, and visual operators performing in sync.</p>
                </div>
                <div class="performance-suite__status" data-role="status">Ready</div>
            </header>
            <div class="performance-suite__columns">
                <section class="performance-suite__column performance-suite__column--pads"></section>
                <section class="performance-suite__column performance-suite__column--audio"></section>
                <section class="performance-suite__column performance-suite__column--presets">
                    <div class="performance-suite__stack" data-role="presets"></div>
                    <div class="performance-suite__stack" data-role="planner"></div>
                </section>
            </div>
        `;
        host.appendChild(this.root);

        this.statusEl = this.root.querySelector('[data-role="status"]');
        this.touchpadContainer = this.root.querySelector('.performance-suite__column--pads');
        this.audioContainer = this.root.querySelector('.performance-suite__column--audio');
        this.presetsContainer = this.root.querySelector('[data-role="presets"]');
        this.showPlannerContainer = this.root.querySelector('[data-role="planner"]');
    }

    initModules() {
        if (!this.touchpadContainer || !this.audioContainer || !this.presetsContainer || !this.showPlannerContainer) {
            return;
        }
        this.touchPadController = new TouchPadController({
            parameterManager: this.parameterManager,
            container: this.touchpadContainer,
            config: this.config.touchPads,
            hub: this.hub,
            onMappingChange: () => this.updateStatus('Touch pads ready')
        });

        this.audioPanel = new AudioReactivityPanel({
            parameterManager: this.parameterManager,
            container: this.audioContainer,
            config: this.config.audio,
            hub: this.hub,
            onSettingsChange: (settings) => this.applyAudioSettings(settings)
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
            container: this.showPlannerContainer,
            hub: this.hub,
            presetManager: this.presetManager,
            config: this.config.showPlanner
        });

        this.subscriptions.push(this.hub.on('preset:loaded', () => this.updateStatus('Preset loaded')));
        this.subscriptions.push(this.hub.on('preset:playlist-start', () => this.updateStatus('Playlist launched')));
        this.subscriptions.push(this.hub.on('audio:flourish', () => this.updateStatus('Flourish triggered')));
        this.subscriptions.push(this.hub.on('show:cue-trigger', ({ cue } = {}) => {
            if (cue?.label) {
                this.updateStatus(`Cue triggered: ${cue.label}`);
            }
        }));
    }

    applyAudioSettings(settings) {
        if (this.engine && typeof this.engine.setLiveAudioSettings === 'function') {
            this.engine.setLiveAudioSettings(settings);
        }
        this.updateStatus('Audio reactivity updated');
    }

    updateStatus(message) {
        if (!this.statusEl) return;
        this.statusEl.textContent = message;
        clearTimeout(this.statusTimeout);
        this.statusTimeout = setTimeout(() => {
            this.statusEl.textContent = 'Ready';
        }, 2500);
    }

    getState() {
        return {
            touchPads: this.touchPadController?.getState?.() || {},
            audio: this.audioPanel?.getSettings?.() || {},
            presets: this.presetManager?.getState?.() || { presets: [], playlist: [] },
            showPlanner: this.showPlanner?.getState?.() || { cues: [] }
        };
    }

    applyState(state = {}) {
        if (state.touchPads && this.touchPadController?.applyState) {
            this.touchPadController.applyState(state.touchPads);
        }
        if (state.audio && this.audioPanel?.applySettings) {
            this.audioPanel.applySettings(state.audio);
        }
        if (state.presets && this.presetManager?.applyState) {
            this.presetManager.applyState(state.presets);
        }
        if (state.showPlanner && this.showPlanner?.applyState) {
            this.showPlanner.applyState(state.showPlanner);
        }
    }

    destroy() {
        if (this.touchPadController) {
            this.touchPadController.destroy();
            this.touchPadController = null;
        }
        if (this.audioPanel) {
            this.audioPanel = null;
        }
        if (this.presetManager) {
            this.presetManager = null;
        }
        if (this.showPlanner) {
            this.showPlanner.destroy();
            this.showPlanner = null;
        }
        this.subscriptions.forEach(unsubscribe => unsubscribe?.());
        this.subscriptions = [];
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
            this.statusTimeout = null;
        }
        if (this.root && this.root.parentNode) {
            this.root.parentNode.removeChild(this.root);
        }
    }
}
