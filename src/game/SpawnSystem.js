/**
 * SpawnSystem is responsible for injecting beat-driven targets into the scene.
 * It consumes spawn directives from the EventDirector and respects pause signals
 * emitted when cinematic directives are active.
 */
export class SpawnSystem {
    constructor(options = {}) {
        const {
            beatInterval = 0.6,
            baseDensity = 1,
            limitPerBeat = Infinity,
            spawnHandler = null,
            targetFactory = null,
            onPause = null,
            onResume = null,
        } = options;

        this.beatInterval = beatInterval;
        this.baseDensity = baseDensity;
        this.limitPerBeat = limitPerBeat;
        this.spawnHandler = typeof spawnHandler === 'function' ? spawnHandler : null;
        this.targetFactory = typeof targetFactory === 'function' ? targetFactory : null;
        this.onPause = typeof onPause === 'function' ? onPause : null;
        this.onResume = typeof onResume === 'function' ? onResume : null;

        this.timeAccumulator = 0;
        this.isPaused = false;
        this.lastDirective = null;
        this.pausedReason = null;
    }

    update(deltaSeconds, directive = {}) {
        if (Number.isNaN(deltaSeconds) || !Number.isFinite(deltaSeconds)) {
            return;
        }

        const pauseRequested = Boolean(directive && directive.paused);
        const wasPaused = this.isPaused;
        this.lastDirective = directive;

        if (pauseRequested) {
            this.isPaused = true;
            this.pausedReason = directive.reason ?? 'directive';
            if (!wasPaused && this.onPause) {
                this.onPause(directive);
            }
            return;
        }

        if (wasPaused && this.onResume) {
            this.onResume(directive);
        }

        this.isPaused = false;
        this.pausedReason = null;

        this.timeAccumulator += Math.max(0, deltaSeconds);
        while (this.timeAccumulator >= this.beatInterval) {
            this.timeAccumulator -= this.beatInterval;
            this.injectBeatTargets(directive);
        }
    }

    injectBeatTargets(directive) {
        const density = typeof directive?.density === 'number'
            ? directive.density
            : this.baseDensity;

        const spawnCount = Math.max(0, Math.round(density));
        if (spawnCount <= 0) {
            if (this.spawnHandler) {
                this.spawnHandler([], {
                    directive,
                    density,
                    paused: this.isPaused,
                    visualProgram: directive?.visualProgram,
                    targetRules: directive?.targetRules,
                    audioSnapshot: directive?.audioSnapshot,
                    difficulty: directive?.difficulty,
                });
            }
            return [];
        }

        const cappedCount = Number.isFinite(this.limitPerBeat)
            ? Math.min(spawnCount, this.limitPerBeat)
            : spawnCount;

        const targets = [];
        for (let i = 0; i < cappedCount; i += 1) {
            const target = this.createTarget(directive, i);
            if (target) {
                targets.push(target);
            }
        }

        if (this.spawnHandler) {
            this.spawnHandler(targets, {
                directive,
                density,
                paused: this.isPaused,
                visualProgram: directive?.visualProgram,
                targetRules: directive?.targetRules,
                audioSnapshot: directive?.audioSnapshot,
                difficulty: directive?.difficulty,
            });
        }

        return targets;
    }

    createTarget(directive, index) {
        if (this.targetFactory) {
            return this.targetFactory({
                directive,
                index,
                visualProgram: directive?.visualProgram,
                targetRules: directive?.targetRules,
                audioSnapshot: directive?.audioSnapshot,
                difficulty: directive?.difficulty,
                density: directive?.density,
            });
        }

        return {
            id: `target-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            directive,
            index,
            createdAt: Date.now(),
            visualProgram: directive?.visualProgram,
            targetRules: directive?.targetRules,
            audioSnapshot: directive?.audioSnapshot,
            difficulty: directive?.difficulty,
        };
    }

    flush() {
        this.timeAccumulator = 0;
    }

    setSpawnHandler(handler) {
        this.spawnHandler = typeof handler === 'function' ? handler : null;
    }
}
