const DEFAULT_DIRECTIVE_DURATIONS = {
    gestureDirective: 4500,
    quickDraw: 3200,
};

const DEFAULT_BLOCKING = ['gestureDirective', 'quickDraw'];

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
        } = options;

        this._clock = typeof clock === 'function' ? clock : null;
        this.baseDensity = Math.max(0, Number(baseDensity) || 1);
        this.directiveDurations = { ...DEFAULT_DIRECTIVE_DURATIONS, ...directiveDurations };
        this.blockingDirectives = new Set(blockingDirectives);
        this.audioEngine = audioEngine || null;

        this.activeDirectives = new Map();
        this.lastSpawnDirective = { density: this.baseDensity, paused: false, directive: null };
        this.lastAudioFrame = null;
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

    activateDirective(type, payload = {}) {
        if (!type) {
            return null;
        }

        const startTime = this.now();
        const duration = payload.duration ?? this.directiveDurations[type] ?? 0;
        const endsAt = duration > 0 ? startTime + duration : null;

        const directive = {
            id: payload.id || `${type}-${startTime.toFixed(0)}`,
            type,
            label: payload.label || this.getDefaultLabel(type),
            prompt: payload.prompt ?? payload.message ?? '',
            description: payload.description ?? '',
            startedAt: startTime,
            duration,
            endsAt,
            countdownSeconds: payload.countdownSeconds ?? (duration ? Math.ceil(duration / 1000) : null),
            pauseSpawns: payload.pauseSpawns ?? this.blockingDirectives.has(type),
            color: payload.color || null,
            colorPalette: payload.colorPalette ? { ...payload.colorPalette } : null,
            pattern: payload.pattern ? { ...payload.pattern } : null,
            metadata: payload.metadata ? { ...payload.metadata } : {},
            difficulty: payload.difficulty ?? null,
        };

        this.activeDirectives.set(type, directive);
        return cloneDirective(directive, startTime);
    }

    resolveDirective(type, result = {}) {
        const directive = this.activeDirectives.get(type);
        if (!directive) {
            return null;
        }

        this.activeDirectives.delete(type);
        return {
            ...directive,
            completedAt: this.now(),
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
        if (this.audioEngine?.sample) {
            this.lastAudioFrame = this.audioEngine.sample(currentTime);
        }

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

        return { expired };
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
                return this.lastSpawnDirective;
            }

            this.lastSpawnDirective = {
                paused: true,
                density: 0,
                directive: directiveState,
            };
            return this.lastSpawnDirective;
        }

        if (this.lastSpawnDirective.paused || this.lastSpawnDirective.directive || this.lastSpawnDirective.density !== this.baseDensity) {
            this.lastSpawnDirective = {
                paused: false,
                density: this.baseDensity,
                directive: null,
            };
            return this.lastSpawnDirective;
        }

        this.lastSpawnDirective.density = this.baseDensity;
        return this.lastSpawnDirective;
    }

    getLastAudioFrame() {
        return this.lastAudioFrame;
    }

    setDifficultyCurve({ baseDensity } = {}) {
        if (baseDensity != null) {
            this.baseDensity = Math.max(0, Number(baseDensity) || this.baseDensity);
        }
    }
}

export default EventDirector;
