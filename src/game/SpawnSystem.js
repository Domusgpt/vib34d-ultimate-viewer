const DEFAULT_BEAT_INTERVAL = 0.6; // seconds

/**
 * SpawnSystem schedules beat-driven target creation. The implementation is
 * intentionally minimal – the caller provides the actual spawn callback.
 */
export class SpawnSystem {
    constructor(options = {}) {
        const {
            beatInterval = DEFAULT_BEAT_INTERVAL,
            onSpawn = null,
        } = options;

        this.beatInterval = Math.max(0.05, Number(beatInterval) || DEFAULT_BEAT_INTERVAL);
        this.onSpawn = typeof onSpawn === 'function' ? onSpawn : null;

        this.elapsed = 0;
        this.lastDirective = null;
        this.paused = false;
        this.onPause = null;
        this.onResume = null;
        this.totalSpawns = 0;
        this.beatCounter = 0;
    }

    setSpawnCallback(callback) {
        this.onSpawn = typeof callback === 'function' ? callback : null;
    }

    update(deltaSeconds, spawnDirective = null) {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
            return;
        }

        const directiveChanged = this.lastDirective !== spawnDirective;
        const paused = Boolean(spawnDirective?.paused);

        if (paused) {
            this.elapsed = 0;
            if (!this.paused || directiveChanged) {
                this.paused = true;
                this.lastDirective = spawnDirective;
                if (typeof this.onPause === 'function') {
                    this.onPause(spawnDirective);
                }
            }
            return;
        }

        if (this.paused && typeof this.onResume === 'function') {
            this.onResume(spawnDirective);
        }

        this.paused = false;
        this.lastDirective = spawnDirective;

        const density = Math.max(0, Number(spawnDirective?.density) || 1);
        const beatInterval = density > 0 ? this.beatInterval / density : this.beatInterval;

        this.elapsed += deltaSeconds;
        if (this.elapsed < beatInterval) {
            return;
        }

        const spawnCount = Math.floor(this.elapsed / beatInterval);
        this.elapsed -= spawnCount * beatInterval;

        if (!this.onSpawn) {
            return;
        }

        for (let i = 0; i < spawnCount; i += 1) {
            const timestamp = Date.now();
            const index = this.totalSpawns;
            this.totalSpawns += 1;
            this.beatCounter += 1;
            this.onSpawn({
                timestamp,
                directive: spawnDirective?.directive || null,
                density,
                beatInterval,
                index,
                beat: this.beatCounter,
                audioFrame: spawnDirective?.audioFrame || null,
            });
        }
    }

    reset() {
        this.elapsed = 0;
        this.lastDirective = null;
        this.totalSpawns = 0;
        this.beatCounter = 0;
        this.paused = false;
    }
}

export default SpawnSystem;
