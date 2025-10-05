import { TouchPadController } from './TouchPadController.js';
import { AudioReactivityPanel } from './AudioReactivityPanel.js';
import { PerformancePresetManager } from './PerformancePresetManager.js';
import { PerformanceHub } from './PerformanceHub.js';
import { mergePerformanceConfig } from './PerformanceConfig.js';
import { PerformanceShowPlanner } from './PerformanceShowPlanner.js';
import { PerformanceThemePanel } from './PerformanceThemePanel.js';
import { normalizeThemeState, normalizeThemeTransition, DEFAULT_THEME_TRANSITION } from './PerformanceThemeUtils.js';
import { PerformanceMidiBridge } from './PerformanceMidiBridge.js';
import { PerformanceGestureRecorder } from './PerformanceGestureRecorder.js';

export class PerformanceSuite {
    constructor({ engine = null, parameterManager = null, config = {}, themeContext = {} } = {}) {
        this.engine = engine;
        this.parameterManager = parameterManager;
        this.config = mergePerformanceConfig(config);
        this.themeContext = themeContext || {};
        this.transitionDefaults = normalizeThemeTransition(
            this.config?.theme?.transitionDefaults,
            DEFAULT_THEME_TRANSITION
        );

        this.hub = new PerformanceHub({ engine: this.engine, parameterManager: this.parameterManager });
        this.root = null;
        this.touchPadController = null;
        this.audioPanel = null;
        this.presetManager = null;
        this.subscriptions = [];
        this.showPlanner = null;
        this.themePanel = null;
        this.hardwareBridge = null;
        this.gestureRecorder = null;

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
                <section class="performance-suite__column performance-suite__column--pads">
                    <div class="performance-suite__stack" data-role="pads"></div>
                    <div class="performance-suite__stack" data-role="gestures"></div>
                </section>
                <section class="performance-suite__column performance-suite__column--audio">
                    <div class="performance-suite__stack" data-role="theme"></div>
                    <div class="performance-suite__stack" data-role="audio"></div>
                    <div class="performance-suite__stack" data-role="hardware"></div>
                </section>
                <section class="performance-suite__column performance-suite__column--presets">
                    <div class="performance-suite__stack" data-role="presets"></div>
                    <div class="performance-suite__stack" data-role="planner"></div>
                </section>
            </div>
        `;
        host.appendChild(this.root);

        this.statusEl = this.root.querySelector('[data-role="status"]');
        this.touchpadContainer = this.root.querySelector('[data-role="pads"]')
            || this.root.querySelector('.performance-suite__column--pads');
        this.gestureContainer = this.root.querySelector('[data-role="gestures"]')
            || this.root.querySelector('.performance-suite__column--pads');
        this.audioColumn = this.root.querySelector('.performance-suite__column--audio');
        this.themeContainer = this.root.querySelector('[data-role="theme"]');
        this.audioContainer = this.root.querySelector('[data-role="audio"]');
        this.hardwareContainer = this.root.querySelector('[data-role="hardware"]');
        this.presetsContainer = this.root.querySelector('[data-role="presets"]');
        this.showPlannerContainer = this.root.querySelector('[data-role="planner"]');
    }

    initModules() {
        if (!this.touchpadContainer || !this.audioContainer || !this.presetsContainer || !this.showPlannerContainer) {
            return;
        }

        if (this.themeContainer || this.audioColumn) {
            this.themePanel = new PerformanceThemePanel({
                container: this.themeContainer || this.audioColumn,
                config: this.config.theme,
                context: this.themeContext,
                onThemeChange: (state) => this.applyThemeState(state, { notifyHost: true })
            });

            let initialTheme = this.themeContext?.themeState;
            if ((!initialTheme || (initialTheme.paletteId === 'system' && !initialTheme.overrides)) && this.config?.theme?.storageKey) {
                const storedTheme = this.loadStoredThemeState();
                if (storedTheme) {
                    initialTheme = storedTheme;
                }
            }

            if (!initialTheme) {
                initialTheme = { paletteId: 'system' };
            }
            this.applyThemeState(initialTheme, { notifyHost: true, silentStatus: true });
        }

        this.touchPadController = new TouchPadController({
            parameterManager: this.parameterManager,
            container: this.touchpadContainer,
            config: this.config.touchPads,
            hub: this.hub,
            onMappingChange: () => this.updateStatus('Touch pads ready')
        });

        if (this.gestureContainer) {
            this.gestureRecorder = new PerformanceGestureRecorder({
                parameterManager: this.parameterManager,
                container: this.gestureContainer,
                config: this.config.gestures,
                hub: this.hub,
                onStatusChange: (status) => this.updateStatus(status)
            });
        }

        this.audioPanel = new AudioReactivityPanel({
            parameterManager: this.parameterManager,
            container: this.audioContainer,
            config: this.config.audio,
            hub: this.hub,
            onSettingsChange: (settings) => this.applyAudioSettings(settings)
        });

        this.hardwareBridge = new PerformanceMidiBridge({
            parameterManager: this.parameterManager,
            container: this.hardwareContainer || this.audioColumn,
            config: this.config.hardware,
            hub: this.hub,
            onStatusChange: (status) => this.updateStatus(status)
        });

        this.presetManager = new PerformancePresetManager({
            parameterManager: this.parameterManager,
            touchPadController: this.touchPadController,
            audioPanel: this.audioPanel,
            hardwareBridge: this.hardwareBridge,
            gestureRecorder: this.gestureRecorder,
            container: this.presetsContainer,
            hub: this.hub,
            config: this.config.presets,
            themeOptions: this.config.theme,
            themeContext: this.themeContext,
            getThemeState: () => this.themePanel?.getState?.() || this.themeContext?.themeState || { paletteId: 'system' },
            applyThemeState: (state) => this.applyThemeState(state, { notifyHost: true, silentStatus: true })
        });

        this.showPlanner = new PerformanceShowPlanner({
            container: this.showPlannerContainer,
            hub: this.hub,
            presetManager: this.presetManager,
            config: this.config.showPlanner,
            themeOptions: this.config.theme,
            themeContext: this.themeContext,
            applyThemeState: (themeState, meta) => this.applyCueThemeState(themeState, meta),
            gestureOptions: this.gestureRecorder?.getSummaries?.() || []
        });

        const activeTheme = this.themePanel?.getState?.() || this.themeContext?.themeState || { paletteId: 'system' };
        this.presetManager?.setActiveThemeState?.(activeTheme);
        this.showPlanner?.setActiveThemeState?.(activeTheme);
        if (this.gestureRecorder && this.showPlanner?.setGestureOptions) {
            this.showPlanner.setGestureOptions(this.gestureRecorder.getSummaries());
        }

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
            hardware: this.hardwareBridge?.getState?.() || {},
            gestures: this.gestureRecorder?.getState?.() || { recordings: [] },
            presets: this.presetManager?.getState?.() || { presets: [], playlist: [] },
            showPlanner: this.showPlanner?.getState?.() || { cues: [] },
            theme: this.themePanel?.getState?.() || this.themeContext?.themeState || { paletteId: 'system' }
        };
    }

    applyState(state = {}) {
        if (state.theme) {
            this.applyThemeState(state.theme, { notifyHost: true, silentStatus: true });
        }
        if (state.touchPads && this.touchPadController?.applyState) {
            this.touchPadController.applyState(state.touchPads);
        }
        if (state.audio && this.audioPanel?.applySettings) {
            this.audioPanel.applySettings(state.audio);
        }
        if (state.hardware && this.hardwareBridge?.applyState) {
            this.hardwareBridge.applyState(state.hardware);
        }
        if (state.gestures && this.gestureRecorder?.applyState) {
            this.gestureRecorder.applyState(state.gestures);
        }
        if (state.presets && this.presetManager?.applyState) {
            this.presetManager.applyState(state.presets);
        }
        if (state.showPlanner && this.showPlanner?.applyState) {
            this.showPlanner.applyState(state.showPlanner);
        }
    }

    applyThemeState(themeState, { notifyHost = false, silentStatus = false, transition = null } = {}) {
        const baseState = themeState ? { ...themeState } : { paletteId: 'system' };
        if (transition) {
            baseState.transition = transition;
        }

        const normalizedTarget = normalizeThemeState(baseState, { transitionDefaults: this.transitionDefaults });

        if (this.themePanel) {
            this.themePanel.applyState(normalizedTarget, { notify: false });
        }

        this.themeContext = this.themeContext || {};
        const normalizedState = this.themePanel?.getState?.()
            || normalizeThemeState(normalizedTarget, { transitionDefaults: this.transitionDefaults });
        this.themeContext.themeState = normalizedState;

        this.persistThemeState(normalizedState);

        this.presetManager?.setActiveThemeState?.(normalizedState);
        this.showPlanner?.setActiveThemeState?.(normalizedState);

        this.hub?.emit?.('theme:updated', { state: normalizedState });

        if (notifyHost && typeof this.themeContext?.onThemeChange === 'function') {
            this.themeContext.onThemeChange(normalizedState);
        }

        if (!silentStatus) {
            this.updateStatus('Theme updated');
        }
    }

    applyCueThemeState(themeState, { cueLabel = '', mode = '', transition = null } = {}) {
        if (!themeState && !transition) {
            return;
        }
        const state = themeState ? { ...themeState } : { paletteId: 'system' };
        if (transition) {
            state.transition = transition;
        }
        this.applyThemeState(state, { notifyHost: true, silentStatus: true });
        if (cueLabel) {
            const descriptor = mode === 'palette' ? 'palette' : 'theme';
            this.updateStatus(`Cue ${descriptor} applied: ${cueLabel}`);
        } else {
            this.updateStatus('Cue theme applied');
        }
    }

    loadStoredThemeState() {
        const storageKey = this.config?.theme?.storageKey;
        if (!storageKey || typeof window === 'undefined') {
            return null;
        }

        try {
            const raw = window.localStorage.getItem(storageKey);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('PerformanceSuite failed to load stored theme state', error);
            return null;
        }
    }

    persistThemeState(state) {
        const storageKey = this.config?.theme?.storageKey;
        if (!storageKey || typeof window === 'undefined') {
            return;
        }

        try {
            window.localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (error) {
            console.warn('PerformanceSuite failed to persist theme state', error);
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
        if (this.hardwareBridge) {
            this.hardwareBridge.destroy();
            this.hardwareBridge = null;
        }
        if (this.gestureRecorder) {
            this.gestureRecorder.destroy();
            this.gestureRecorder = null;
        }
        if (this.presetManager) {
            this.presetManager = null;
        }
        if (this.showPlanner) {
            this.showPlanner.destroy();
            this.showPlanner = null;
        }
        if (this.themePanel) {
            this.themePanel.destroy();
            this.themePanel = null;
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
