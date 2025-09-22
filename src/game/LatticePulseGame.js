import { EventDirector } from './EventDirector.js';
import { SpawnSystem } from './SpawnSystem.js';
import { EffectsManager } from './EffectsManager.js';
import { HUDRenderer } from './ui/HUDRenderer.js';

function createClock(clock) {
    if (typeof clock === 'function') {
        return clock;
    }
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return () => performance.now();
    }
    return () => Date.now();
}

function toSeconds(deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
        return 0;
    }
    return deltaMs / 1000;
}

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
            effectsOptions,
        } = options;

        this.clock = createClock(clock);

        this.eventDirector = eventDirector || new EventDirector({ clock: () => this.clock() });
        this.spawnSystem = spawnSystem || new SpawnSystem();
        this.effectsManager = effectsManager || new EffectsManager(effectsOptions);
        this.hudRenderer = hudRenderer || new HUDRenderer(hudRoot, hudOptions);

        this.isRunning = false;
        this.lastUpdate = null;
        this.loopHandle = null;
        this.isSpawnPaused = false;

        this.bindSpawnHooks();
    }

    bindSpawnHooks() {
        if (!this.spawnSystem) {
            return;
        }

        const originalPause = this.spawnSystem.onPause;
        const originalResume = this.spawnSystem.onResume;

        this.spawnSystem.onPause = (directive) => {
            if (typeof originalPause === 'function') {
                originalPause(directive);
            }
            this.handleSpawnPause(directive);
        };

        this.spawnSystem.onResume = (directive) => {
            if (typeof originalResume === 'function') {
                originalResume(directive);
            }
            this.handleSpawnResume(directive);
        };
    }

    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.lastUpdate = this.clock();

        if (typeof requestAnimationFrame === 'function') {
            this.loopHandle = requestAnimationFrame(() => this.loop());
        }
    }

    stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        if (typeof cancelAnimationFrame === 'function' && this.loopHandle) {
            cancelAnimationFrame(this.loopHandle);
        }
        this.loopHandle = null;
        this.lastUpdate = null;
    }

    loop() {
        if (!this.isRunning) {
            return;
        }

        const now = this.clock();
        const delta = this.lastUpdate != null ? now - this.lastUpdate : 0;
        this.lastUpdate = now;

        this.tick(delta);

        if (typeof requestAnimationFrame === 'function') {
            this.loopHandle = requestAnimationFrame(() => this.loop());
        }
    }

    tick(deltaMs = 0) {
        const now = this.clock();
        const updateResult = this.eventDirector.update(now);
        const expired = updateResult?.expired ?? [];

        expired.forEach((directive) => this.handleDirectiveExpired(directive));

        const spawnDirective = this.eventDirector.getSpawnDirectives();
        this.spawnSystem.update(toSeconds(deltaMs), spawnDirective);

        this.syncDirectiveOverlay(now);
    }

    startGestureDirective(config = {}) {
        return this.startDirective('gestureDirective', config);
    }

    startQuickDraw(config = {}) {
        return this.startDirective('quickDraw', config);
    }

    completeGesture(result = {}) {
        return this.resolveDirective('gestureDirective', { success: true, ...result });
    }

    resolveQuickDraw(result = {}) {
        return this.resolveDirective('quickDraw', { success: true, ...result });
    }

    startDirective(type, config = {}) {
        const directive = this.eventDirector.activateDirective(type, config);
        if (!directive) {
            return null;
        }

        const state = this.eventDirector.getDirectiveState(type);
        if (state) {
            this.announceDirectiveStart(state);
        }
        return state ?? directive;
    }

    resolveDirective(type, result = {}) {
        const directive = this.eventDirector.resolveDirective(type, result);
        if (!directive) {
            return null;
        }

        this.effectsManager.handleDirectiveComplete({ directive, result });
        const hudActive = this.hudRenderer.getActiveDirective();
        if (hudActive && hudActive.id === directive.id) {
            this.hudRenderer.hideDirectiveOverlay();
        }
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
        });
        this.syncDirectiveOverlay();
    }

    announceDirectiveStart(directive) {
        if (!directive) {
            return;
        }

        this.hudRenderer.showDirectiveOverlay(directive);
        this.effectsManager.handleDirectiveStart(directive);
    }

    syncDirectiveOverlay(now = this.clock()) {
        const directiveState = this.eventDirector.getPrimaryDirective(now);
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
            this.hudRenderer.showDirectiveOverlay(directive.directive);
        }
    }

    handleSpawnResume() {
        this.isSpawnPaused = false;
        this.syncDirectiveOverlay();
    }
}
