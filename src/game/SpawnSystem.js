/**
 * SpawnSystem generates beat-driven targets while honouring pause directives
 * emitted by the EventDirector. The implementation is intentionally small so it
 * can be reused in tests and headless simulations.
 */
export class SpawnSystem {
    constructor(options = {}) {
        const {
            beatInterval = 0.5,
            baseDensity = 1,
            targetFactory = null,
            spawnHandler = null,
            onPause = null,
            onResume = null,
            random = Math.random,
        } = options;

        this.beatInterval = Math.max(0.05, beatInterval);
        this.baseDensity = baseDensity;
        this.targetFactory = typeof targetFactory === 'function' ? targetFactory : null;
        this.spawnHandler = typeof spawnHandler === 'function' ? spawnHandler : null;
        this.onPause = typeof onPause === 'function' ? onPause : null;
        this.onResume = typeof onResume === 'function' ? onResume : null;
        this.random = typeof random === 'function' ? random : Math.random;

        this._accumulator = 0;
        this._paused = false;
        this._lastDirective = null;
    }

    update(deltaSeconds, directive = null) {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
            deltaSeconds = 0;
        }

        if (directive?.paused) {
            if (!this._paused) {
                this._paused = true;
                if (this.onPause) {
                    this.onPause(directive);
                }
            }
            this._lastDirective = directive;
            return;
        }

        if (this._paused) {
            this._paused = false;
            if (this.onResume) {
                this.onResume(directive);
            }
        }

        this._lastDirective = directive;
        const interval = this.resolveInterval(directive);
        if (!Number.isFinite(interval) || interval <= 0) {
            return;
        }

        this._accumulator += deltaSeconds;
        while (this._accumulator >= interval) {
            this._accumulator -= interval;
            this.injectBeatTargets(directive);
        }
    }

    resolveInterval(directive) {
        const tempo = directive?.tempo;
        if (Number.isFinite(tempo) && tempo > 0) {
            return Math.max(0.05, 60 / tempo);
        }
        return this.beatInterval;
    }

    resolveDensity(directive) {
        if (typeof directive?.density === 'number' && !Number.isNaN(directive.density)) {
            return Math.max(0, directive.density);
        }
        return Math.max(0, this.baseDensity);
    }

    injectBeatTargets(directive) {
        const density = this.resolveDensity(directive);
        const whole = Math.floor(density);
        const fractional = density - whole;
        let spawnCount = whole;
        if (fractional > 0 && this.random() < fractional) {
            spawnCount += 1;
        }

        const targets = [];
        for (let index = 0; index < spawnCount; index += 1) {
            targets.push(this.createTarget(directive, index));
        }

        if (this.spawnHandler) {
            this.spawnHandler(targets, { directive, density, paused: this._paused });
        }

        return targets;
    }

    createTarget(directive, index) {
        if (this.targetFactory) {
            return this.targetFactory({ directive, index });
        }
        return {
            id: `target-${Date.now()}-${index}`,
            directive,
            index,
        };
    }

    flush() {
        this._accumulator = 0;
    }

    setSpawnHandler(handler) {
        this.spawnHandler = typeof handler === 'function' ? handler : null;
    }

    get lastDirective() {
        return this._lastDirective;
    }
}

export default SpawnSystem;
