import { EventDirector } from './EventDirector.js';
import { SpawnSystem } from './SpawnSystem.js';
import { EffectsManager } from './EffectsManager.js';
import { HUDRenderer } from './ui/HUDRenderer.js';

/**
 * LatticePulseGame coordinates the event director, spawn system, HUD and
 * effects manager. The class exposes a minimal lifecycle so it can run inside
 * the existing viewer infrastructure without owning the render loop.
 */
export class LatticePulseGame {
    constructor(options = {}) {
        const {
            clock,
            eventDirector,
            spawnSystem,
            effectsManager,
            hudRenderer,
            hudRoot,
            hudOptions,
            eventOptions,
            spawnOptions,
            effectsOptions,
        } = options;

        this.clock = typeof clock === 'function'
            ? clock
            : () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

        this.hudRenderer = hudRenderer || new HUDRenderer(hudRoot, hudOptions);
        this.effectsManager = effectsManager || new EffectsManager(effectsOptions);
        this.eventDirector = eventDirector || new EventDirector({
            ...(eventOptions || {}),
            clock: () => this.clock(),
        });

        const spawnHandlers = {
            ...(spawnOptions || {}),
        };

        if (!spawnSystem) {
            const userOnPause = typeof spawnHandlers.onPause === 'function'
                ? spawnHandlers.onPause
                : null;
            const userOnResume = typeof spawnHandlers.onResume === 'function'
                ? spawnHandlers.onResume
                : null;

            spawnHandlers.onPause = (directive) => {
                if (userOnPause) {
                    userOnPause(directive);
                }
                this.handleSpawnPause(directive);
            };
            spawnHandlers.onResume = (directive) => {
                if (userOnResume) {
                    userOnResume(directive);
                }
                this.handleSpawnResume(directive);
            };
        }

        this.spawnSystem = spawnSystem || new SpawnSystem(spawnHandlers);

        this.isRunning = false;
        this.lastTimestamp = null;
        this.loopHandle = null;
    }

    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.lastTimestamp = this.clock();
        this.scheduleNextFrame();
    }

    stop() {
        this.isRunning = false;
        if (typeof cancelAnimationFrame === 'function' && this.loopHandle != null) {
            cancelAnimationFrame(this.loopHandle);
        }
        this.loopHandle = null;
    }

    scheduleNextFrame() {
        if (typeof requestAnimationFrame === 'function') {
            this.loopHandle = requestAnimationFrame(() => this.loop());
        }
    }

    loop() {
        if (!this.isRunning) {
            return;
        }

        const now = this.clock();
        const delta = this.lastTimestamp != null ? now - this.lastTimestamp : 0;
        this.lastTimestamp = now;

        this.tick(delta);
        this.scheduleNextFrame();
    }

    tick(deltaMs = 0) {
        const now = this.clock();
        const { expired } = this.eventDirector.update(now);
        expired.forEach((directive) => this.handleDirectiveExpired(directive));

        const directiveState = this.eventDirector.getPrimaryDirectiveState(now);
        this.syncDirectiveOverlay(directiveState);

        const spawnDirective = this.eventDirector.getSpawnDirectives();
        const deltaSeconds = Number.isFinite(deltaMs) ? Math.max(0, deltaMs / 1000) : 0;
        this.spawnSystem.update(deltaSeconds, spawnDirective);
        this.effectsManager.updateAmbientDirective(spawnDirective);
    }

    startGestureDirective(config = {}) {
        return this.startDirective('gestureDirective', config);
    }

    startQuickDraw(config = {}) {
        return this.startDirective('quickDraw', config);
    }

    completeGesture(result = {}) {
        const type = result.type || 'gestureDirective';
        return this.resolveDirective(type, result);
    }

    resolveQuickDraw(result = {}) {
        const type = result.type || 'quickDraw';
        return this.resolveDirective(type, result);
    }

    startDirective(type, config = {}) {
        const directive = this.eventDirector.activateDirective(type, config);
        if (!directive) {
            return null;
        }
        this.hudRenderer.showDirectiveOverlay(directive);
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

        this.effectsManager.handleDirectiveComplete({
            directive,
            result: directive.result,
        });
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
            result: directive.result || { success: false, reason: directive.reason || 'timeout' },
        });
    }

    syncDirectiveOverlay(directiveState) {
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
        if (directive?.directive) {
            this.syncDirectiveOverlay(directive.directive);
        }
    }

    handleSpawnResume() {
        const directiveState = this.eventDirector.getPrimaryDirectiveState();
        this.syncDirectiveOverlay(directiveState);
    }
}

export default LatticePulseGame;
