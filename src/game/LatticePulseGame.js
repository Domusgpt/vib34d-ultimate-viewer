import { EventDirector } from './EventDirector.js';
import { SpawnSystem } from './SpawnSystem.js';
import { EffectsManager } from './EffectsManager.js';
import { HUDRenderer } from './ui/HUDRenderer.js';
import { AudioReactivityEngine } from './AudioReactivityEngine.js';

const defaultClock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class LatticePulseGame {
    constructor(options = {}) {
        const {
            clock = defaultClock,
            eventDirector,
            spawnSystem,
            hudRenderer,
            effectsManager,
            audioEngine,
            hudRoot = null,
            hudOptions = {},
            eventOptions = {},
            spawnOptions = {},
            effectsOptions = {},
            audioOptions = {},
        } = options;

        this.clock = typeof clock === 'function' ? clock : defaultClock;

        this.audioEngine = audioEngine || (audioOptions === false ? null : new AudioReactivityEngine(audioOptions));
        this.eventDirector = eventDirector || new EventDirector({
            ...eventOptions,
            clock: () => this.clock(),
            audioEngine: this.audioEngine,
        });
        this.spawnSystem = spawnSystem || new SpawnSystem(spawnOptions);
        this.hudRenderer = hudRenderer || new HUDRenderer(hudRoot, hudOptions);
        this.effectsManager = effectsManager || new EffectsManager(effectsOptions);

        this.spawnSystem.onPause = (directive) => this.handleSpawnPause(directive);
        this.spawnSystem.onResume = (directive) => this.handleSpawnResume(directive);

        this.isRunning = false;
        this.lastTick = null;
        this.loopHandle = null;
    }

    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.lastTick = this.clock();
        this.scheduleNextFrame();
        if (this.audioEngine?.resume) {
            this.audioEngine.resume().catch(() => {});
        }
    }

    stop() {
        this.isRunning = false;
        if (this.loopHandle != null) {
            if (typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(this.loopHandle);
            } else if (typeof clearTimeout === 'function') {
                clearTimeout(this.loopHandle);
            }
            this.loopHandle = null;
        }
        if (this.audioEngine?.suspend) {
            this.audioEngine.suspend().catch(() => {});
        }
    }

    scheduleNextFrame() {
        if (!this.isRunning) {
            return;
        }

        if (typeof requestAnimationFrame === 'function') {
            this.loopHandle = requestAnimationFrame(() => this.loop());
        } else {
            this.loopHandle = setTimeout(() => this.loop(), 16);
        }
    }

    loop() {
        if (!this.isRunning) {
            return;
        }
        const currentTime = this.clock();
        const deltaMs = this.lastTick != null ? currentTime - this.lastTick : 0;
        this.lastTick = currentTime;

        this.tick(deltaMs);
        this.scheduleNextFrame();
    }

    tick(deltaMs) {
        const currentTime = this.clock();
        const { expired } = this.eventDirector.update(currentTime);

        expired.forEach((directive) => this.handleDirectiveExpired(directive));
        this.syncDirectiveOverlay(currentTime);

        const spawnDirective = this.eventDirector.getSpawnDirectives(currentTime);
        const deltaSeconds = Math.max(0, deltaMs / 1000);
        this.spawnSystem.update(deltaSeconds, spawnDirective);

        if (typeof this.effectsManager.updateAmbientDirective === 'function') {
            this.effectsManager.updateAmbientDirective(spawnDirective);
        }
    }

    startGestureDirective(config = {}) {
        return this.startDirective('gestureDirective', config);
    }

    startQuickDraw(config = {}) {
        return this.startDirective('quickDraw', config);
    }

    startDirective(type, config = {}) {
        const directive = this.eventDirector.activateDirective(type, config);
        if (!directive) {
            return null;
        }
        this.announceDirectiveStart(directive);
        return directive;
    }

    completeGesture(result = {}) {
        return this.resolveDirective('gestureDirective', result);
    }

    resolveQuickDraw(result = {}) {
        return this.resolveDirective('quickDraw', result);
    }

    resolveDirective(type, result = {}) {
        const directive = this.eventDirector.resolveDirective(type, result);
        if (!directive) {
            return null;
        }

        const active = this.hudRenderer.getActiveDirective();
        if (active?.id === directive.id) {
            this.hudRenderer.hideDirectiveOverlay();
        }

        if (typeof this.effectsManager.handleDirectiveComplete === 'function') {
            this.effectsManager.handleDirectiveComplete({ directive, result: directive.result });
        }

        this.syncDirectiveOverlay(this.clock());
        return directive;
    }

    handleDirectiveExpired(directive) {
        if (!directive) {
            return;
        }

        const active = this.hudRenderer.getActiveDirective();
        if (active?.id === directive.id) {
            this.hudRenderer.hideDirectiveOverlay();
        }

        if (typeof this.effectsManager.handleDirectiveComplete === 'function') {
            this.effectsManager.handleDirectiveComplete({
                directive,
                result: directive.result,
                reason: 'timeout',
            });
        }
    }

    announceDirectiveStart(directive) {
        if (!directive) {
            return;
        }
        this.hudRenderer.showDirectiveOverlay(directive);
        if (typeof this.effectsManager.handleDirectiveStart === 'function') {
            this.effectsManager.handleDirectiveStart(directive);
        }
    }

    syncDirectiveOverlay(currentTime = this.clock()) {
        const directive = this.eventDirector.getPrimaryDirectiveState(currentTime);
        const active = this.hudRenderer.getActiveDirective();

        if (!directive) {
            if (active) {
                this.hudRenderer.hideDirectiveOverlay();
            }
            return;
        }

        if (!active || active.id !== directive.id) {
            this.hudRenderer.showDirectiveOverlay(directive);
        } else {
            this.hudRenderer.updateDirectiveCountdown(directive);
        }
    }

    handleSpawnPause(spawnDirective) {
        const directiveState = spawnDirective?.directive;
        if (!directiveState) {
            return;
        }

        const active = this.hudRenderer.getActiveDirective();
        if (!active || active.id !== directiveState.id) {
            this.hudRenderer.showDirectiveOverlay(directiveState);
        } else {
            this.hudRenderer.updateDirectiveCountdown(directiveState);
        }

        if (typeof this.effectsManager.handleDirectiveStart === 'function'
            && this.effectsManager.activeDirectiveId !== directiveState.id) {
            this.effectsManager.handleDirectiveStart(directiveState);
        }
    }

    handleSpawnResume(spawnDirective) {
        const directiveState = spawnDirective?.directive;
        if (directiveState) {
            const active = this.hudRenderer.getActiveDirective();
            if (!active || active.id !== directiveState.id) {
                this.hudRenderer.showDirectiveOverlay(directiveState);
            } else {
                this.hudRenderer.updateDirectiveCountdown(directiveState);
            }
        }
        this.syncDirectiveOverlay(this.clock());
    }

    getLatestAudioFrame() {
        return this.eventDirector.getLastAudioFrame();
    }
}

export default LatticePulseGame;
