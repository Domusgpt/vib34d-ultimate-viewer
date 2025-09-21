import { EventDirector } from './EventDirector.js';
import { SpawnSystem } from './SpawnSystem.js';
import { EffectsManager } from './EffectsManager.js';
import { HUDRenderer } from './ui/HUDRenderer.js';
import { AudioReactiveAnalyzer } from './audio/AudioReactiveAnalyzer.js';

/**
 * LatticePulseGame orchestrates the interaction between the event director,
 * spawn system, HUD, and visual effects.
 */
export class LatticePulseGame {
    constructor(options = {}) {
        const {
            clock,
            eventDirector,
            spawnSystem,
            hudRenderer,
            effectsManager,
            hudRoot,
            hudOptions,
            eventOptions,
            spawnOptions,
            effectsOptions,
            audioAnalyzer,
            audioOptions,
            autoEnableAudio = true,
        } = options;

        this.clock = typeof clock === 'function'
            ? clock
            : (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));

        this.hudRenderer = hudRenderer || new HUDRenderer(hudRoot, hudOptions);
        this.effectsManager = effectsManager || new EffectsManager(effectsOptions);
        this.eventDirector = eventDirector || new EventDirector({
            ...(eventOptions || {}),
            clock: () => this.clock(),
        });
        this.spawnSystem = spawnSystem || new SpawnSystem(spawnOptions);

        if (audioAnalyzer) {
            this.audioAnalyzer = audioAnalyzer;
        } else if (audioOptions !== false) {
            this.audioAnalyzer = new AudioReactiveAnalyzer(audioOptions);
        } else {
            this.audioAnalyzer = null;
        }

        this.autoEnableAudio = autoEnableAudio !== false;
        this.audioInitialized = false;
        this.currentAudioState = this.eventDirector.getAudioState();

        this.lastUpdateTimestamp = null;
        this.isRunning = false;
        this.loopHandle = null;
        this.isSpawnPaused = false;

        if (!spawnSystem) {
            this.spawnSystem.onPause = (directive) => this.handleSpawnPause(directive);
            this.spawnSystem.onResume = (directive) => this.handleSpawnResume(directive);
        }
    }

    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.lastUpdateTimestamp = this.clock();
        if (this.audioAnalyzer && this.autoEnableAudio && !this.audioInitialized) {
            this.enableAudioCapture().catch(() => {
                // Audio is optional; failures should not break the loop.
            });
        }
        if (typeof requestAnimationFrame === 'function') {
            this.loopHandle = requestAnimationFrame(() => this.loop());
        }
    }

    stop() {
        this.isRunning = false;
        if (typeof cancelAnimationFrame === 'function' && this.loopHandle) {
            cancelAnimationFrame(this.loopHandle);
            this.loopHandle = null;
        }
    }

    loop() {
        if (!this.isRunning) {
            return;
        }

        const now = this.clock();
        const delta = this.lastUpdateTimestamp != null ? now - this.lastUpdateTimestamp : 0;
        this.lastUpdateTimestamp = now;

        this.tick(delta);

        if (typeof requestAnimationFrame === 'function') {
            this.loopHandle = requestAnimationFrame(() => this.loop());
        }
    }

    tick(deltaMs = 0) {
        const now = this.clock();

        let audioState = null;
        if (this.audioAnalyzer) {
            audioState = this.audioAnalyzer.update(now);
        }
        const normalizedAudio = this.eventDirector.updateAudioState(audioState);
        this.currentAudioState = normalizedAudio;

        if (typeof this.effectsManager.updateAudioState === 'function') {
            this.effectsManager.updateAudioState(normalizedAudio);
        }

        const expired = this.eventDirector.update(now);
        expired.forEach((directive) => this.handleDirectiveExpired(directive));

        this.syncDirectiveOverlay(now, normalizedAudio);

        const spawnDirective = this.eventDirector.getSpawnDirectives();
        const deltaSeconds = deltaMs / 1000;
        this.spawnSystem.update(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, spawnDirective);
    }

    startGestureDirective(config = {}) {
        return this.startDirective('gestureDirective', config);
    }

    startQuickDraw(config = {}) {
        return this.startDirective('quickDraw', config);
    }

    completeGesture(result = {}) {
        const type = result.type || 'gestureDirective';
        const outcome = { success: result.success ?? true, ...result };
        return this.resolveDirective(type, outcome);
    }

    resolveQuickDraw(result = {}) {
        const type = result.type || 'quickDraw';
        return this.resolveDirective(type, { success: result.success ?? true, ...result });
    }

    startDirective(type, config = {}) {
        const directive = this.eventDirector.activateDirective(type, config);
        if (!directive) {
            return null;
        }

        const hudActive = this.hudRenderer.getActiveDirective();
        if (!hudActive || hudActive.id !== directive.id) {
            this.hudRenderer.showDirectiveOverlay(directive);
        }

        this.effectsManager.handleDirectiveStart(directive);
        return directive;
    }

    resolveDirective(type, result = {}) {
        const directive = this.eventDirector.resolveDirective(type, result);
        if (!directive) {
            return null;
        }

        const hudActive = this.hudRenderer.getActiveDirective();
        if (hudActive && hudActive.id === directive.id) {
            this.hudRenderer.hideDirectiveOverlay();
        }

        this.effectsManager.handleDirectiveComplete({ directive, result: directive.result });
        this.syncDirectiveOverlay(undefined, this.eventDirector.getAudioState());
        return directive;
    }

    handleDirectiveExpired(directive) {
        if (!directive) {
            return;
        }

        const hudActive = this.hudRenderer.getActiveDirective();
        if (hudActive && hudActive.id === directive.id) {
            this.hudRenderer.hideDirectiveOverlay();
        }

        this.effectsManager.handleDirectiveComplete({
            directive,
            result: directive.result,
            reason: directive.reason || 'timeout',
        });

        this.syncDirectiveOverlay(undefined, this.eventDirector.getAudioState());
    }

    syncDirectiveOverlay(now = this.clock(), audioState = this.eventDirector.getAudioState()) {
        const directiveState = this.eventDirector.getPrimaryDirectiveState(now);
        const hudActive = this.hudRenderer.getActiveDirective();

        if (!directiveState) {
            if (hudActive) {
                this.hudRenderer.hideDirectiveOverlay();
            }
            if (typeof this.hudRenderer.updateAudioState === 'function') {
                this.hudRenderer.updateAudioState(audioState, null);
            }
            return;
        }

        if (!hudActive || hudActive.id !== directiveState.id) {
            this.hudRenderer.showDirectiveOverlay(directiveState);
        } else {
            this.hudRenderer.updateDirectiveCountdown(directiveState);
        }

        if (typeof this.hudRenderer.updateAudioState === 'function') {
            this.hudRenderer.updateAudioState(audioState, directiveState);
        }
    }

    handleSpawnPause(directive) {
        this.isSpawnPaused = true;
        if (directive?.directive) {
            this.syncDirectiveOverlay(undefined, this.eventDirector.getAudioState());
        }
    }

    handleSpawnResume() {
        this.isSpawnPaused = false;
    }

    async enableAudioCapture() {
        if (!this.audioAnalyzer || this.audioInitialized) {
            return false;
        }

        try {
            const initialized = await this.audioAnalyzer.initialize();
            this.audioInitialized = initialized;
            return initialized;
        } catch (error) {
            this.audioInitialized = false;
            return false;
        }
    }

    setAudioAnalyzer(analyzer, options = {}) {
        this.audioAnalyzer = analyzer;
        this.audioInitialized = false;
        if (this.audioAnalyzer && options.autoEnable !== false) {
            this.enableAudioCapture().catch(() => {});
        }
    }

    getAudioState() {
        return this.currentAudioState;
    }
}
