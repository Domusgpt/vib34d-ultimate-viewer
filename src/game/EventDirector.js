const DEFAULT_DIRECTIVE_DURATIONS = {
    gestureDirective: 4500,
    quickDraw: 3200,
};

const DEFAULT_BLOCKING = ['gestureDirective', 'quickDraw'];

const DEFAULT_DENSITY_RANGE = { min: 0.35, max: 3 };

const clamp = (value, min, max) => {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(max, Math.max(min, value));
};

const lerp = (from, to, alpha) => from + (to - from) * alpha;

const now = (clock) => (typeof clock === 'function' ? clock() : (typeof performance !== 'undefined' ? performance.now() : Date.now()));

const cloneDirective = (directive, currentTime) => {
    if (!directive) {
        return null;
    }

    const remainingMs = directive.endsAt == null
        ? null
        : Math.max(0, directive.endsAt - currentTime);

    const countdownSeconds = remainingMs != null
        ? Math.max(0, Math.ceil(remainingMs / 1000))
        : directive.countdownSeconds ?? null;

    return {
        ...directive,
        remainingMs,
        countdownSeconds,
    };
};

export class EventDirector {
    constructor(options = {}) {
        const {
            clock,
            baseDensity = 1,
            directiveDurations = {},
            blockingDirectives = DEFAULT_BLOCKING,
            audioEngine = null,
            densityRange = DEFAULT_DENSITY_RANGE,
            densitySmoothing = 0.18,
            autoQuickDraw = true,
            quickDrawThreshold = 0.88,
            quickDrawCooldownMs = 3200,
            audioWeighting = {},
        } = options;

        this._clock = typeof clock === 'function' ? clock : null;
        this.baseDensity = Math.max(0.05, Number(baseDensity) || 1);
        this.directiveDurations = { ...DEFAULT_DIRECTIVE_DURATIONS, ...directiveDurations };
        this.blockingDirectives = new Set(blockingDirectives);
        this.audioEngine = audioEngine || null;

        const resolvedRange = Array.isArray(densityRange)
            ? { min: densityRange[0], max: densityRange[1] }
            : densityRange;
        const minRange = clamp(Number(resolvedRange?.min ?? DEFAULT_DENSITY_RANGE.min), 0.05, 10);
        const maxRange = clamp(Number(resolvedRange?.max ?? DEFAULT_DENSITY_RANGE.max), minRange, 16);
        this.densityRange = { min: minRange, max: maxRange };
        this.densitySmoothing = clamp(Number(densitySmoothing) || 0.18, 0.01, 1);
        this.audioWeighting = {
            low: Number.isFinite(audioWeighting.low) ? audioWeighting.low : 0.35,
            mid: Number.isFinite(audioWeighting.mid) ? audioWeighting.mid : 0.65,
            high: Number.isFinite(audioWeighting.high) ? audioWeighting.high : 1,
        };

        this.autoQuickDraw = Boolean(autoQuickDraw);
        this.quickDrawThreshold = clamp(Number(quickDrawThreshold) || 0.88, 0, 1);
        this.quickDrawCooldownMs = Math.max(600, Number(quickDrawCooldownMs) || 3200);

        this.activeDirectives = new Map();
        this.pendingDirectives = [];
        this.externalAudioFrame = null;
        this.lastSpawnDirective = {
            density: this.baseDensity,
            paused: false,
            directive: null,
            audioFrame: this.lastAudioFrame,
        };

        this.currentDensity = this.baseDensity;
        this.targetDensity = this.baseDensity;
        this.audioEnvelope = 0;
        this.lastAudioFrame = null;
        this.lastAudioFrameTime = 0;
        this.lastQuickDrawAt = -Infinity;
        this.directiveCounter = 0;
    }

    generateDirectiveId(type, startTime) {
        this.directiveCounter += 1;
        const base = Number.isFinite(startTime) ? Math.round(startTime) : Math.round(this.now());
        return `${type}-${base}-${this.directiveCounter}`;
    }

    submitAudioFrame(frame, currentTime = this.now()) {
        if (!frame) {
            return null;
        }
        this.externalAudioFrame = {
            frame: { ...frame },
            time: Number.isFinite(currentTime) ? currentTime : this.now(),
        };
        return this.externalAudioFrame;
    }

    queueDirective(type, payload = {}, options = {}) {
        if (!type) {
            return null;
        }
        const entry = {
            type,
            payload: { ...payload },
            startAt: Number.isFinite(options.startAt) ? options.startAt : null,
        };
        this.pendingDirectives.push(entry);
        return entry;
    }

    processPendingDirectives(currentTime) {
        if (!this.pendingDirectives.length) {
            return;
        }

        const remaining = [];
        for (const entry of this.pendingDirectives) {
            const active = this.activeDirectives.get(entry.type);
            if (entry.startAt != null && currentTime < entry.startAt) {
                remaining.push(entry);
                continue;
            }
            if (active) {
                remaining.push(entry);
                continue;
            }
            this.activateDirective(entry.type, entry.payload, entry.startAt ?? currentTime);
        }

        this.pendingDirectives = remaining;
    }

    ingestAudioFrame(frame, currentTime) {
        if (!frame) {
            this.audioEnvelope *= 0.96;
            this.targetDensity = lerp(this.targetDensity, this.baseDensity, 0.08);
            return null;
        }

        const timestamp = Number.isFinite(frame.timestamp) ? frame.timestamp : currentTime;
        const level = clamp(frame.level ?? frame.rms ?? 0, 0, 1);
        const bands = frame.bands || {};
        const weightTotal = this.audioWeighting.low + this.audioWeighting.mid + this.audioWeighting.high;
        const normalizedWeights = weightTotal <= 0 ? 1 : weightTotal;
        const bandEnergy = (
            (bands.low ?? 0) * this.audioWeighting.low
            + (bands.mid ?? 0) * this.audioWeighting.mid
            + (bands.high ?? 0) * this.audioWeighting.high
        ) / normalizedWeights;

        const energy = clamp(Math.max(level, bandEnergy), 0, 1);
        this.audioEnvelope = lerp(this.audioEnvelope, energy, 0.35);
        const densityMultiplier = 1 + (this.audioEnvelope * 1.9);
        const target = clamp(this.baseDensity * densityMultiplier, this.densityRange.min, this.densityRange.max);
        this.targetDensity = target;
        this.lastAudioFrame = { ...frame, level, timestamp };
        this.lastAudioFrameTime = timestamp;
        this.maybeTriggerAudioDirective(currentTime, this.lastAudioFrame);
        return this.lastAudioFrame;
    }

    maybeTriggerAudioDirective(currentTime, frame) {
        if (!this.autoQuickDraw || !frame) {
            return;
        }
        if (this.activeDirectives.has('quickDraw')) {
            return;
        }
        const peak = clamp(frame.peak ?? frame.level ?? 0, 0, 1);
        if (peak < this.quickDrawThreshold) {
            return;
        }
        if (currentTime - this.lastQuickDrawAt < this.quickDrawCooldownMs) {
            return;
        }

        this.lastQuickDrawAt = currentTime;
        this.queueDirective('quickDraw', {
            metadata: {
                annotation: 'Audio peak detected',
                hint: 'Tap to pulse the lattice',
                countdownHint: 'seconds',
            },
        });
    }

    getActiveDirectives() {
        const currentTime = this.now();
        return Array.from(this.activeDirectives.values()).map((directive) => cloneDirective(directive, currentTime));
    }

    getCurrentDensity() {
        return this.currentDensity;
    }

    setAutoQuickDraw(enabled) {
        this.autoQuickDraw = Boolean(enabled);
    }

    setDensityRange(range) {
        if (!range) {
            return;
        }
        const resolved = Array.isArray(range) ? { min: range[0], max: range[1] } : range;
        const min = clamp(Number(resolved?.min ?? this.densityRange.min), 0.05, 10);
        const max = clamp(Number(resolved?.max ?? this.densityRange.max), min, 16);
        this.densityRange = { min, max };
        this.targetDensity = clamp(this.targetDensity, min, max);
        this.currentDensity = clamp(this.currentDensity, min, max);
    }

    reset() {
        this.activeDirectives.clear();
        this.pendingDirectives.length = 0;
        this.externalAudioFrame = null;
        this.audioEnvelope = 0;
        this.currentDensity = this.baseDensity;
        this.targetDensity = this.baseDensity;
        this.lastAudioFrame = null;
        this.lastAudioFrameTime = 0;
        this.lastSpawnDirective = {
            density: this.baseDensity,
            paused: false,
            directive: null,
            audioFrame: this.lastAudioFrame,
        };
    }

    now() {
        return now(this._clock);
    }

    getDefaultLabel(type) {
        switch (type) {
            case 'gestureDirective':
                return 'Gesture Incoming';
            case 'quickDraw':
                return 'Quick Draw';
            default:
                return type;
        }
    }

    activateDirective(type, payload = {}, startTime = this.now()) {
        if (!type) {
            return null;
        }

        const resolvedStart = Number.isFinite(startTime) ? startTime : this.now();
        const duration = payload.duration ?? this.directiveDurations[type] ?? 0;
        const endsAt = duration > 0 ? resolvedStart + duration : null;
        const metadata = payload.metadata ? { ...payload.metadata } : {};

        const existing = this.activeDirectives.get(type);
        if (existing) {
            this.activeDirectives.delete(type);
        }

        const directive = {
            id: payload.id || this.generateDirectiveId(type, resolvedStart),
            type,
            label: payload.label || this.getDefaultLabel(type),
            prompt: payload.prompt ?? payload.message ?? '',
            description: payload.description ?? '',
            startedAt: resolvedStart,
            duration,
            endsAt,
            countdownSeconds: payload.countdownSeconds ?? (duration ? Math.ceil(duration / 1000) : null),
            pauseSpawns: payload.pauseSpawns ?? this.blockingDirectives.has(type),
            color: payload.color || null,
            colorPalette: payload.colorPalette ? { ...payload.colorPalette } : null,
            pattern: payload.pattern ? { ...payload.pattern } : null,
            metadata,
            difficulty: payload.difficulty ?? null,
        };

        this.activeDirectives.set(type, directive);
        return cloneDirective(directive, resolvedStart);
    }

    resolveDirective(type, result = {}, completedAt = this.now()) {
        const directive = this.activeDirectives.get(type);
        if (!directive) {
            return null;
        }

        this.activeDirectives.delete(type);
        return {
            ...directive,
            completedAt,
            result,
        };
    }

    shouldDirectiveBlockSpawns(directive) {
        if (!directive) {
            return false;
        }
        return Boolean(directive.pauseSpawns);
    }

    update(currentTime = this.now()) {
        let sampledFrame = null;
        if (this.audioEngine?.sample) {
            const frame = this.audioEngine.sample(currentTime);
            if (frame) {
                sampledFrame = frame;
            }
        }

        if (this.externalAudioFrame) {
            const { frame, time } = this.externalAudioFrame;
            sampledFrame = {
                ...frame,
                timestamp: Number.isFinite(time) ? time : currentTime,
            };
            this.externalAudioFrame = null;
        }

        this.ingestAudioFrame(sampledFrame, currentTime);

        const expired = [];
        for (const [type, directive] of this.activeDirectives.entries()) {
            if (directive.endsAt != null && currentTime >= directive.endsAt) {
                this.activeDirectives.delete(type);
                expired.push({
                    ...directive,
                    expiredAt: currentTime,
                    result: { success: false, reason: 'timeout' },
                });
            }
        }

        this.processPendingDirectives(currentTime);

        this.currentDensity = clamp(
            lerp(this.currentDensity, this.targetDensity, this.densitySmoothing),
            this.densityRange.min,
            this.densityRange.max,
        );

        return { expired, audioFrame: this.lastAudioFrame };
    }

    isDirectiveActive(type) {
        if (type) {
            return this.activeDirectives.has(type);
        }

        for (const directive of this.activeDirectives.values()) {
            if (this.shouldDirectiveBlockSpawns(directive)) {
                return true;
            }
        }
        return false;
    }

    getDirectiveState(type, currentTime = this.now()) {
        const directive = this.activeDirectives.get(type);
        if (!directive) {
            return null;
        }
        return cloneDirective(directive, currentTime);
    }

    getPrimaryDirectiveState(currentTime = this.now()) {
        let candidate = null;
        for (const directive of this.activeDirectives.values()) {
            if (!candidate) {
                candidate = directive;
                continue;
            }
            if (candidate.endsAt == null) {
                continue;
            }
            if (directive.endsAt == null || directive.endsAt < candidate.endsAt) {
                candidate = directive;
            }
        }
        return cloneDirective(candidate, currentTime);
    }

    getSpawnDirectives(currentTime = this.now()) {
        let blockingDirective = null;
        for (const directive of this.activeDirectives.values()) {
            if (this.shouldDirectiveBlockSpawns(directive)) {
                blockingDirective = directive;
                break;
            }
        }

        if (!this.lastSpawnDirective) {
            this.lastSpawnDirective = { paused: false, density: this.baseDensity, directive: null };
        }

        if (blockingDirective) {
            const directiveState = cloneDirective(blockingDirective, currentTime);
            if (this.lastSpawnDirective.paused && this.lastSpawnDirective.directive?.id === directiveState.id) {
                this.lastSpawnDirective.directive = directiveState;
                this.lastSpawnDirective.density = 0;
                this.lastSpawnDirective.audioFrame = this.lastAudioFrame;
                return this.lastSpawnDirective;
            }

            this.lastSpawnDirective = {
                paused: true,
                density: 0,
                directive: directiveState,
                audioFrame: this.lastAudioFrame,
            };
            return this.lastSpawnDirective;
        }

        const density = clamp(this.currentDensity, this.densityRange.min, this.densityRange.max);
        const changed = this.lastSpawnDirective.paused
            || this.lastSpawnDirective.directive
            || Math.abs((this.lastSpawnDirective.density ?? 0) - density) > 0.001;

        if (changed) {
            this.lastSpawnDirective = {
                paused: false,
                density,
                directive: null,
                audioFrame: this.lastAudioFrame,
            };
            return this.lastSpawnDirective;
        }

        this.lastSpawnDirective.density = density;
        this.lastSpawnDirective.audioFrame = this.lastAudioFrame;
        return this.lastSpawnDirective;
    }

    getLastAudioFrame() {
        return this.lastAudioFrame;
    }

    setDifficultyCurve({ baseDensity } = {}) {
        if (baseDensity != null) {
            this.baseDensity = Math.max(0.05, Number(baseDensity) || this.baseDensity);
            this.targetDensity = clamp(this.baseDensity, this.densityRange.min, this.densityRange.max);
            this.currentDensity = clamp(this.currentDensity, this.densityRange.min, this.densityRange.max);
        }
    }
}

export default EventDirector;
