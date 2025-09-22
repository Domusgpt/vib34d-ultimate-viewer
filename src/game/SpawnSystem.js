const DEFAULT_BEAT_INTERVAL = 0.6;

function clampDensity(value, fallback) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return fallback;
    }
    return Math.max(0, value);
}

export class SpawnSystem {
    constructor(options = {}) {
        const {
            beatInterval = DEFAULT_BEAT_INTERVAL,
            baseDensity = 1,
            spawnHandler = null,
            onPause = null,
            onResume = null,
            random = Math.random,
        } = options;

        this.beatInterval = beatInterval;
        this.baseDensity = baseDensity;
        this.spawnHandler = typeof spawnHandler === 'function' ? spawnHandler : null;
        this.onPause = typeof onPause === 'function' ? onPause : null;
        this.onResume = typeof onResume === 'function' ? onResume : null;
        this.random = typeof random === 'function' ? random : Math.random;

        this.timeAccumulator = 0;
        this.isPaused = false;
        this.lastDirective = null;
    }

    update(deltaSeconds, directive = {}) {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
            return;
        }

        this.lastDirective = directive || null;

        if (directive?.paused) {
            if (!this.isPaused) {
                this.isPaused = true;
                this.timeAccumulator = 0;
                if (this.onPause) {
                    this.onPause(directive);
                }
            }
            return;
        }

        if (this.isPaused) {
            this.isPaused = false;
            if (this.onResume) {
                this.onResume(directive);
            }
        }

        const interval = this.resolveBeatInterval(directive);
        if (!Number.isFinite(interval) || interval <= 0) {
            return;
        }

        this.timeAccumulator += deltaSeconds;
        while (this.timeAccumulator >= interval) {
            this.timeAccumulator -= interval;
            this.injectBeatTargets(directive);
        }
    }

    resolveBeatInterval(directive = {}) {
        const tempo = directive?.tempo;
        if (typeof tempo === 'number' && tempo > 0) {
            return 60 / tempo;
        }
        return this.beatInterval;
    }

    injectBeatTargets(directive = {}) {
        const density = clampDensity(directive?.density, this.baseDensity);
        let spawnCount = Math.floor(density);
        const fractional = density - spawnCount;
        if (fractional > 0 && this.random() < fractional) {
            spawnCount += 1;
        }

        const targets = [];
        for (let i = 0; i < spawnCount; i += 1) {
            const target = this.createTarget(directive, i);
            if (target) {
                targets.push(target);
            }
        }

        if (this.spawnHandler) {
            this.spawnHandler(targets, {
                directive,
                density,
                paused: false,
            });
        }

        return targets;
    }

    createTarget(directive, index) {
        return {
            id: `directive-target-${Date.now()}-${index}`,
            directive,
            index,
            color: directive?.color || directive?.colorPalette?.primary || '#ffffff',
            pattern: directive?.pattern || null,
        };
    }

    flush() {
        this.timeAccumulator = 0;
    }

    getLastDirective() {
        return this.lastDirective;
    }
}
