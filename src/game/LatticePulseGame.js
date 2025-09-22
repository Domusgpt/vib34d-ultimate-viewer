import { EventDirector } from './EventDirector.js';
import { SpawnSystem } from './SpawnSystem.js';
import { EffectsManager } from './EffectsManager.js';
import { HUDRenderer } from './ui/HUDRenderer.js';
import { AudioReactivityEngine } from './AudioReactivityEngine.js';

const defaultClock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
            onSpawn,
            spawnCallback,
            syntheticAudio = true,
            syntheticTempo = 120,
            syntheticVariance = 0.25,
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

        const spawnHandler = typeof onSpawn === 'function'
            ? onSpawn
            : (typeof spawnCallback === 'function' ? spawnCallback : null);
        if (spawnHandler) {
            this.spawnSystem.setSpawnCallback(spawnHandler);
        }

        this.spawnSystem.onPause = (directive) => this.handleSpawnPause(directive);
        this.spawnSystem.onResume = (directive) => this.handleSpawnResume(directive);

        this.isRunning = false;
        this.lastTick = null;
        this.loopHandle = null;

        const resolvedTempo = Math.max(30, Number(syntheticTempo) || 120);
        this.syntheticAudio = {
            enabled: syntheticAudio !== false,
            tempo: resolvedTempo,
            variance: Math.max(0, Number(syntheticVariance) || 0.25),
            accumulator: 0,
            beat: 0,
            lastFrame: null,
        };

        this.latestAudioFrame = null;
    }

    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.lastTick = this.clock();
        if (this.syntheticAudio) {
            this.syntheticAudio.accumulator = 0;
            this.syntheticAudio.beat = 0;
            this.syntheticAudio.lastFrame = null;
        }
        if (typeof this.spawnSystem?.reset === 'function') {
            this.spawnSystem.reset();
        }
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
        if (typeof this.spawnSystem?.reset === 'function') {
            this.spawnSystem.reset();
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

    shouldUseSyntheticAudio() {
        if (!this.syntheticAudio?.enabled) {
            return false;
        }
        if (!this.audioEngine) {
            return true;
        }
        if (typeof this.audioEngine.isConnected === 'function') {
            return !this.audioEngine.isConnected();
        }
        return false;
    }

    generateSyntheticAudioFrame(deltaSeconds, currentTime) {
        if (!this.syntheticAudio || deltaSeconds <= 0) {
            return this.syntheticAudio?.lastFrame || null;
        }

        const secondsPerBeat = 60 / this.syntheticAudio.tempo;
        this.syntheticAudio.accumulator += deltaSeconds;

        let beatImpulse = 0;
        while (this.syntheticAudio.accumulator >= secondsPerBeat) {
            this.syntheticAudio.accumulator -= secondsPerBeat;
            this.syntheticAudio.beat += 1;
            beatImpulse = 1;
        }

        const phase = clamp(this.syntheticAudio.accumulator / secondsPerBeat, 0, 1);
        const envelope = Math.sin(Math.PI * phase);
        const noise = (Math.random() * 2 - 1) * this.syntheticAudio.variance;
        const baseLevel = clamp(envelope * 0.75 + beatImpulse * 0.3 + noise, 0, 1);

        const frame = {
            timestamp: currentTime,
            level: baseLevel,
            rms: baseLevel * 0.7,
            peak: clamp(baseLevel + beatImpulse * 0.25, 0, 1),
            bands: {
                low: clamp(baseLevel * 0.9 + beatImpulse * 0.1, 0, 1),
                mid: clamp((0.5 + envelope * 0.4) + noise * 0.2, 0, 1),
                high: clamp((1 - phase) * 0.6 + beatImpulse * 0.3, 0, 1),
            },
        };

        this.syntheticAudio.lastFrame = frame;
        return frame;
    }

    tick(deltaMs) {
        const currentTime = this.clock();
        const deltaSeconds = Math.max(0, deltaMs / 1000);

        if (this.shouldUseSyntheticAudio()) {
            const syntheticFrame = this.generateSyntheticAudioFrame(deltaSeconds, currentTime);
            if (syntheticFrame) {
                this.eventDirector.submitAudioFrame(syntheticFrame, currentTime);
                this.latestAudioFrame = syntheticFrame;
            }
        }

        const { expired, audioFrame } = this.eventDirector.update(currentTime);
        if (audioFrame) {
            this.latestAudioFrame = audioFrame;
        }

        expired.forEach((directive) => this.handleDirectiveExpired(directive));
        this.syncDirectiveOverlay(currentTime);

        const spawnDirective = this.eventDirector.getSpawnDirectives(currentTime);
        this.spawnSystem.update(deltaSeconds, spawnDirective);

        if (typeof this.effectsManager.updateAmbientDirective === 'function') {
            this.effectsManager.updateAmbientDirective(spawnDirective);
        }

        const frameForEffects = spawnDirective?.audioFrame || audioFrame || this.latestAudioFrame;
        if (frameForEffects) {
            this.latestAudioFrame = frameForEffects;
        }
        if (frameForEffects && typeof this.effectsManager.updateAudioProfile === 'function') {
            this.effectsManager.updateAudioProfile(frameForEffects);
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
        const completedAt = this.clock();
        const directive = this.eventDirector.resolveDirective(type, result, completedAt);
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

    setSpawnHandler(callback) {
        if (this.spawnSystem) {
            this.spawnSystem.setSpawnCallback(callback);
        }
    }

    setSyntheticAudioEnabled(enabled) {
        if (!this.syntheticAudio) {
            return;
        }
        this.syntheticAudio.enabled = Boolean(enabled);
    }

    isSyntheticAudioEnabled() {
        return Boolean(this.syntheticAudio?.enabled);
    }

    setSyntheticTempo(tempo) {
        if (!this.syntheticAudio) {
            return;
        }
        const resolved = Math.max(30, Number(tempo) || this.syntheticAudio.tempo || 120);
        this.syntheticAudio.tempo = resolved;
    }

    async connectToMicrophone(constraints = { audio: true }) {
        if (!this.audioEngine?.connectToMic) {
            throw new Error('Audio engine does not support microphone connections in this environment.');
        }
        const stream = await this.audioEngine.connectToMic(constraints);
        this.syntheticAudio.lastFrame = null;
        return stream;
    }

    connectToAudioElement(element) {
        if (!this.audioEngine?.connectToMediaElement) {
            return null;
        }
        const frame = this.audioEngine.connectToMediaElement(element);
        this.syntheticAudio.lastFrame = null;
        return frame;
    }

    disconnectAudioSource() {
        if (this.audioEngine?.disconnect) {
            this.audioEngine.disconnect();
        }
    }

    destroy() {
        this.stop();
        if (this.audioEngine?.dispose) {
            this.audioEngine.dispose();
        }
        this.spawnSystem.onPause = null;
        this.spawnSystem.onResume = null;
    }

    getActiveDirectives() {
        return this.eventDirector.getActiveDirectives();
    }

    getSpawnDensity() {
        return this.eventDirector.getCurrentDensity();
    }

    getLatestAudioFrame() {
        return this.latestAudioFrame || this.eventDirector.getLastAudioFrame();
    }
}

export default LatticePulseGame;
