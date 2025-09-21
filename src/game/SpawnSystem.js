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
            random = Math.random,
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
        this.random = typeof random === 'function' ? random : Math.random;
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

        const interval = this.resolveBeatInterval(directive);

        this.timeAccumulator += Math.max(0, deltaSeconds);
        while (this.timeAccumulator >= interval) {
            this.timeAccumulator -= interval;
            this.injectBeatTargets(directive);
        }
    }

    injectBeatTargets(directive) {
        const density = typeof directive?.density === 'number'
            ? directive.density
            : this.baseDensity;

        const spawnBase = Math.max(0, density);
        let spawnCount = Math.floor(spawnBase);
        const fractional = spawnBase - spawnCount;
        if (fractional > 0 && this.random() < fractional) {
            spawnCount += 1;
        }

        if (spawnCount <= 0) {
            if (this.spawnHandler) {
                this.spawnHandler([], this.buildSpawnContext(directive, density));
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
            this.spawnHandler(targets, this.buildSpawnContext(directive, density));
        }

        return targets;
    }

    createTarget(directive, index) {
        const context = {
            directive,
            index,
            pattern: directive?.pattern,
            geometry: directive?.geometry,
            audioFrame: directive?.audioFrame,
        };

        if (this.targetFactory) {
            return this.targetFactory(context);
        }

        const geometry = this.resolveTargetGeometry(context);
        const color = this.resolveTargetColor(context);

        return {
            id: `target-${Date.now()}-${Math.floor(this.random() * 100000)}`,
            directive,
            index,
            geometry,
            color,
            shaderEffect: directive?.shaderEffect || null,
            difficulty: directive?.difficulty ?? null,
            intensity: directive?.audioFrame?.energy ?? directive?.intensity ?? null,
            createdAt: Date.now(),
        };
    }

    flush() {
        this.timeAccumulator = 0;
    }

    setSpawnHandler(handler) {
        this.spawnHandler = typeof handler === 'function' ? handler : null;
    }

    resolveBeatInterval(directive) {
        const tempo = directive?.tempo;
        if (Number.isFinite(tempo) && tempo > 0) {
            return Math.max(0.05, 60 / tempo);
        }
        return this.beatInterval;
    }

    buildSpawnContext(directive, density) {
        return {
            directive,
            density,
            paused: this.isPaused,
            pattern: directive?.pattern,
            geometry: directive?.geometry,
            shaderEffect: directive?.shaderEffect,
            difficulty: directive?.difficulty,
            audioFrame: directive?.audioFrame,
        };
    }

    resolveTargetGeometry({ directive, index, pattern }) {
        const patternType = pattern?.type || directive?.geometry?.type;
        switch (patternType) {
        case 'corner-sweep':
            return this.buildCornerGeometry(pattern, index);
        case 'vector-strike':
            return this.buildVectorGeometry(pattern, index);
        case 'cadence-weave':
            return this.buildWeaveGeometry(pattern, index);
        case 'orbital-ribbon':
            return this.buildOrbitalGeometry(pattern, index);
        default:
            return this.buildDefaultGeometry(pattern, index);
        }
    }

    resolveTargetColor({ directive, index }) {
        const palette = directive?.colorPalette;
        if (palette) {
            const colors = [
                palette.primary,
                palette.accent,
                palette.secondary,
                palette.tertiary,
            ].filter(Boolean);
            if (colors.length) {
                return colors[index % colors.length];
            }
        }
        return directive?.color || '#ffffff';
    }

    buildCornerGeometry(pattern = {}, index) {
        const corners = pattern.corners || ['north', 'east', 'south', 'west'];
        const corner = corners[index % corners.length];
        const geometry = pattern.geometry || {};
        return {
            type: 'arc',
            anchor: corner,
            radius: geometry.radius ?? 0.7,
            thickness: geometry.thickness ?? 0.2,
            direction: geometry.rotationDirection ?? 'clockwise',
            travelTime: geometry.travelTime ?? 820,
        };
    }

    buildVectorGeometry(pattern = {}, index) {
        const rays = pattern.rays || pattern.geometry?.rays
            || ['north', 'east', 'south', 'west'];
        const ray = rays[index % rays.length];
        const geometry = pattern.geometry || {};
        return {
            type: 'ray',
            origin: 'center',
            direction: ray,
            length: geometry.length ?? 1.1,
            width: geometry.width ?? 0.08,
            oscillation: geometry.oscillation ?? 0,
        };
    }

    buildWeaveGeometry(pattern = {}, index) {
        const geometry = pattern.geometry || {};
        const rows = Math.max(1, geometry.rows ?? 4);
        const columns = Math.max(1, geometry.columns ?? 4);
        const row = index % rows;
        const column = Math.floor(index / rows) % columns;
        return {
            type: 'grid-node',
            row,
            column,
            rows,
            columns,
            amplitude: geometry.amplitude ?? 0.18,
            frequency: geometry.frequency ?? 1.4,
            phase: geometry.phase ?? 'ascending',
            drift: geometry.drift ?? 0,
        };
    }

    buildOrbitalGeometry(pattern = {}, index) {
        const geometry = pattern.geometry || {};
        const rings = Math.max(1, Math.round(geometry.rings ?? 3));
        const ring = index % rings;
        const angle = (index / Math.max(1, rings)) * Math.PI * 2;
        return {
            type: 'orbital',
            ring,
            rings,
            angle,
            radius: geometry.radius ?? 0.65,
            angularVelocity: geometry.angularVelocity ?? 0.4,
            wobble: geometry.wobble ?? 0,
        };
    }

    buildDefaultGeometry(pattern = {}, index) {
        return {
            type: pattern?.type || 'point',
            index,
        };
    }
}
