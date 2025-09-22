const DEFAULT_DIRECTIVE_DURATIONS = {
    gestureDirective: 4500,
    quickDraw: 3200,
};

const DEFAULT_LABELS = {
    gestureDirective: 'Gesture Directive',
    quickDraw: 'Quick Draw',
};

/**
 * EventDirector keeps track of high level prompts ("directives") that temporarily
 * alter the game flow. While a blocking directive is active the spawn system must
 * pause beat-driven injections. The implementation focuses on predictability and
 * a small surface area that can be exercised by tests.
 */
export class EventDirector {
    constructor(options = {}) {
        const {
            clock,
            directiveDurations = {},
            blockingTypes,
        } = options;

        this._clock = typeof clock === 'function'
            ? clock
            : () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

        this.directiveDurations = {
            ...DEFAULT_DIRECTIVE_DURATIONS,
            ...directiveDurations,
        };

        const fallbackBlocking = Object.keys(DEFAULT_DIRECTIVE_DURATIONS);
        this.blockingTypes = Array.isArray(blockingTypes) && blockingTypes.length
            ? [...blockingTypes]
            : [...fallbackBlocking];

        this.activeDirectives = new Map();
    }

    now() {
        return this._clock();
    }

    activateDirective(type, config = {}) {
        if (!type) {
            throw new Error('Directive type is required.');
        }

        const startedAt = this.now();
        const duration = Number.isFinite(config.duration)
            ? Math.max(0, config.duration)
            : this.directiveDurations[type] ?? 0;
        const endsAt = duration > 0 ? startedAt + duration : null;
        const countdownSeconds = config.countdownSeconds
            ?? (duration ? Math.ceil(duration / 1000) : null);

        const directive = {
            id: config.id || `${type}-${Math.round(startedAt)}`,
            type,
            label: config.label || DEFAULT_LABELS[type] || type,
            prompt: config.prompt || config.message || '',
            description: config.description || '',
            startedAt,
            duration,
            endsAt,
            countdownSeconds,
            pauseSpawns: config.pauseSpawns ?? this.blockingTypes.includes(type),
            color: config.color || null,
            colorPalette: config.colorPalette ? { ...config.colorPalette } : null,
            metadata: config.metadata ? { ...config.metadata } : {},
            difficultyLabel: config.difficultyLabel || null,
        };

        this.activeDirectives.set(type, directive);
        return this.getDirectiveState(type);
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
            result: { ...result },
        };
    }

    clearDirective(type) {
        this.activeDirectives.delete(type);
    }

    clearAllDirectives() {
        this.activeDirectives.clear();
    }

    update(now = this.now()) {
        const expired = [];
        for (const [type, directive] of this.activeDirectives.entries()) {
            if (directive.endsAt != null && now >= directive.endsAt) {
                this.activeDirectives.delete(type);
                expired.push({
                    ...directive,
                    expiredAt: now,
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

    getDirectiveState(type, now = this.now()) {
        const directive = this.activeDirectives.get(type);
        if (!directive) {
            return null;
        }

        const remaining = directive.endsAt != null
            ? Math.max(0, directive.endsAt - now)
            : null;
        const progress = directive.duration
            ? Math.min(1, Math.max(0, (directive.duration - remaining) / directive.duration))
            : null;

        return {
            ...directive,
            remaining,
            progress,
        };
    }

    getPrimaryDirectiveState(now = this.now()) {
        for (const type of this.blockingTypes) {
            const state = this.getDirectiveState(type, now);
            if (state && this.shouldDirectiveBlockSpawns(state)) {
                return state;
            }
        }

        for (const [type] of this.activeDirectives) {
            const state = this.getDirectiveState(type, now);
            if (state && this.shouldDirectiveBlockSpawns(state)) {
                return state;
            }
        }

        return null;
    }

    getSpawnDirectives(baseDirective = {}) {
        const now = this.now();
        const blocking = this.getPrimaryDirectiveState(now);
        if (blocking) {
            return {
                ...baseDirective,
                paused: true,
                density: 0,
                reason: blocking.type,
                directive: blocking,
            };
        }

        const density = Number.isFinite(baseDirective.density)
            ? Math.max(0, baseDirective.density)
            : 1;

        return {
            ...baseDirective,
            paused: false,
            density,
            directive: null,
        };
    }

    shouldDirectiveBlockSpawns(directive) {
        if (!directive) {
            return false;
        }
        if (directive.pauseSpawns === false) {
            return false;
        }
        if (directive.pauseSpawns === true) {
            return true;
        }
        return this.blockingTypes.includes(directive.type);
    }
}

export default EventDirector;
