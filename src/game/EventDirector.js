const DEFAULT_DIRECTIVE_DURATIONS = {
    gestureDirective: 4500,
    quickDraw: 2500,
};

const PRIORITY_ORDER = ['gestureDirective', 'quickDraw'];

function createClock(clock) {
    if (typeof clock === 'function') {
        return clock;
    }
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return () => performance.now();
    }
    return () => Date.now();
}

function cloneDirective(directive) {
    return directive ? { ...directive } : null;
}

export class EventDirector {
    constructor(options = {}) {
        const {
            clock,
            directiveDurations = {},
        } = options;

        this._clock = createClock(clock);
        this.directiveDurations = {
            ...DEFAULT_DIRECTIVE_DURATIONS,
            ...directiveDurations,
        };

        this.activeDirectives = new Map();
        this.lastSpawnDirective = { density: 1, paused: false };
    }

    now() {
        return this._clock();
    }

    activateDirective(type, config = {}) {
        if (!type) {
            return null;
        }

        const startedAt = this.now();
        const duration = config.duration ?? this.directiveDurations[type] ?? null;
        const countdownSeconds = config.countdownSeconds
            ?? (typeof duration === 'number' ? Math.ceil(duration / 1000) : null);
        const endsAt = duration != null ? startedAt + duration : null;

        const directive = {
            id: config.id ?? `${type}-${Math.round(startedAt)}`,
            type,
            label: config.label ?? this.defaultLabel(type),
            prompt: config.prompt ?? config.message ?? '',
            description: config.description ?? '',
            annotation: config.annotation ?? '',
            startedAt,
            duration,
            endsAt,
            countdownSeconds,
            pauseSpawns: config.pauseSpawns ?? true,
            color: config.color ?? null,
            colorPalette: config.colorPalette ?? null,
            pattern: config.pattern ?? null,
            difficultyLabel: config.difficultyLabel ?? null,
            metadata: { ...config.metadata },
        };

        this.activeDirectives.set(type, directive);
        return cloneDirective(directive);
    }

    resolveDirective(type, result = {}) {
        if (!type || !this.activeDirectives.has(type)) {
            return null;
        }

        const directive = this.activeDirectives.get(type);
        this.activeDirectives.delete(type);

        return {
            ...directive,
            completedAt: this.now(),
            result,
        };
    }

    clearDirective(type) {
        if (type) {
            this.activeDirectives.delete(type);
        }
    }

    clearAllDirectives() {
        this.activeDirectives.clear();
    }

    isDirectiveActive(type) {
        if (!type) {
            return this.activeDirectives.size > 0;
        }
        return this.activeDirectives.has(type);
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
        return { activated: [], expired };
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
            ? Math.min(1, Math.max(0, 1 - (remaining ?? 0) / directive.duration))
            : null;

        return {
            ...directive,
            remaining,
            progress,
        };
    }

    getPrimaryDirective(now = this.now()) {
        for (const type of PRIORITY_ORDER) {
            const state = this.getDirectiveState(type, now);
            if (state && this.shouldPauseSpawns(state)) {
                return state;
            }
        }

        for (const [type] of this.activeDirectives.entries()) {
            if (PRIORITY_ORDER.includes(type)) {
                continue;
            }
            const state = this.getDirectiveState(type, now);
            if (state && this.shouldPauseSpawns(state)) {
                return state;
            }
        }

        return null;
    }

    shouldPauseSpawns(directive) {
        if (!directive) {
            return false;
        }
        return directive.pauseSpawns !== false;
    }

    getSpawnDirectives(baseDirective = {}) {
        const blocking = this.getPrimaryDirective();
        if (blocking) {
            const pausedDirective = {
                ...baseDirective,
                paused: true,
                density: 0,
                directive: blocking,
                reason: blocking.type,
            };
            this.lastSpawnDirective = pausedDirective;
            return pausedDirective;
        }

        const density = typeof baseDirective.density === 'number'
            ? baseDirective.density
            : 1;
        const directive = {
            ...baseDirective,
            paused: false,
            density,
        };
        this.lastSpawnDirective = directive;
        return directive;
    }

    getLastSpawnDirective() {
        return cloneDirective(this.lastSpawnDirective);
    }

    describeActiveDirectives(now = this.now()) {
        return Array.from(this.activeDirectives.keys()).map(
            (type) => this.getDirectiveState(type, now),
        ).filter(Boolean);
    }

    defaultLabel(type) {
        switch (type) {
        case 'gestureDirective':
            return 'Gesture Directive';
        case 'quickDraw':
            return 'Quick Draw';
        default:
            return String(type).replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
        }
    }
}
