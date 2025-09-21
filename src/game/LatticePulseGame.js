import { EventDirector } from './EventDirector.js';
import { SpawnSystem } from './SpawnSystem.js';
import { EffectsManager } from './EffectsManager.js';
import { HUDRenderer } from './ui/HUDRenderer.js';
import { AudioReactivityEngine } from './AudioReactivityEngine.js';

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
            audioEngine,
            audioOptions,
        } = options;

        this.clock = typeof clock === 'function'
            ? clock
            : (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));

        this.audioOptions = audioOptions || {};

        let resolvedAudioEngine = audioEngine || null;
        if (!resolvedAudioEngine && audioOptions !== false) {
            try {
                resolvedAudioEngine = new AudioReactivityEngine(audioOptions);
            } catch (error) {
                resolvedAudioEngine = null;
            }
        }

        this.audioEngine = resolvedAudioEngine;

        this.hudRenderer = hudRenderer || new HUDRenderer(hudRoot, hudOptions);
        this.effectsManager = effectsManager || new EffectsManager(effectsOptions);
        this.eventDirector = eventDirector || new EventDirector({
            ...(eventOptions || {}),
            clock: () => this.clock(),
            audioEngine: this.audioEngine,
        });
        this.spawnSystem = spawnSystem || new SpawnSystem(spawnOptions);

        if (this.eventDirector && !this.eventDirector.audioEngine && this.audioEngine) {
            this.eventDirector.audioEngine = this.audioEngine;
        }

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
        if (this.audioEngine?.resume) {
            this.audioEngine.resume().catch(() => {});
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
        if (this.audioEngine?.suspend) {
            this.audioEngine.suspend().catch(() => {});
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
        const updateResult = this.eventDirector.update(now) || {};
        const activated = Array.isArray(updateResult) ? [] : (updateResult.activated || []);
        const expired = Array.isArray(updateResult) ? updateResult : (updateResult.expired || []);

        activated.forEach((directive) => this.announceDirectiveStart(directive));
        expired.forEach((directive) => this.handleDirectiveExpired(directive));

        this.syncDirectiveOverlay(now);

        const spawnDirective = this.eventDirector.getSpawnDirectives();
        const deltaSeconds = deltaMs / 1000;
        this.spawnSystem.update(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, spawnDirective);

        if (this.effectsManager?.updateAmbientDirective) {
            this.effectsManager.updateAmbientDirective(spawnDirective);
        }
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
        this.announceDirectiveStart(directive);
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
        this.syncDirectiveOverlay();
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

        this.syncDirectiveOverlay();
    }

    syncDirectiveOverlay(now = this.clock()) {
        const directiveState = this.eventDirector.getPrimaryDirectiveState(now);
        const hudActive = this.hudRenderer.getActiveDirective();

        if (!directiveState) {
            if (hudActive) {
                this.hudRenderer.hideDirectiveOverlay();
            }
            return;
        }

        if (!hudActive || hudActive.id !== directiveState.id) {
            this.hudRenderer.showDirectiveOverlay(directiveState);
        } else {
            this.hudRenderer.updateDirectiveCountdown(directiveState);
        }
    }

    handleSpawnPause(directive) {
        this.isSpawnPaused = true;
        if (directive?.directive) {
            this.syncDirectiveOverlay();
        }
    }

    handleSpawnResume() {
        this.isSpawnPaused = false;
    }

    announceDirectiveStart(directive) {
        if (!directive) {
            return;
        }

        const hudActive = this.hudRenderer.getActiveDirective();
        if (!hudActive || hudActive.id !== directive.id) {
            this.hudRenderer.showDirectiveOverlay(directive);
        } else {
            this.hudRenderer.updateDirectiveCountdown(directive);
        }

        this.effectsManager.handleDirectiveStart(directive);
    }

    async connectMicrophone(constraints) {
        if (!this.audioEngine) {
            try {
                this.audioEngine = new AudioReactivityEngine(this.audioOptions);
            } catch (error) {
                throw error;
            }
            if (this.eventDirector) {
                this.eventDirector.audioEngine = this.audioEngine;
            }
        }

        if (!this.audioEngine?.connectToMic) {
            throw new Error('Microphone capture is not available in this environment.');
        }

        return this.audioEngine.connectToMic(constraints);
    }

    connectAudioElement(element) {
        if (!this.audioEngine) {
            try {
                this.audioEngine = new AudioReactivityEngine(this.audioOptions);
            } catch (error) {
                this.audioEngine = null;
            }
            if (this.eventDirector && this.audioEngine) {
                this.eventDirector.audioEngine = this.audioEngine;
            }
        }

        if (!this.audioEngine?.connectToMediaElement) {
            return null;
        }

        return this.audioEngine.connectToMediaElement(element);
    }

    getLatestAudioFrame() {
        return this.eventDirector?.getLastAudioFrame() || null;
    }

    setDifficulty(level) {
        if (this.eventDirector?.setDifficulty) {
            this.eventDirector.setDifficulty(level);
        }
    }
}
