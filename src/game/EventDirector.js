/**
 * EventDirector coordinates narrative beats like gesture directives and quick draw
 * prompts. It exposes spawn directives that the SpawnSystem can consume to decide
 * how aggressively new targets should be introduced.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ensureArray = (value) => (Array.isArray(value) ? value : (value != null ? [value] : []));
const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const createDefaultAudioState = () => ({
    intensity: 0,
    volume: 0,
    beat: false,
    spectralCentroid: 0,
    dominantFrequency: 0,
    dominantBand: 'mid',
    bandEnergies: { low: 0, mid: 0, high: 0 },
    silence: true,
    timestamp: 0,
});

const mergeProgramDefinition = (base = {}, extension = {}) => {
    const result = { ...base };
    Object.entries(extension || {}).forEach(([key, value]) => {
        const baseValue = result[key];
        if (isPlainObject(baseValue) && isPlainObject(value)) {
            result[key] = mergeProgramDefinition(baseValue, value);
        } else if (Array.isArray(value)) {
            result[key] = value.slice();
        } else {
            result[key] = value;
        }
    });
    return result;
};

export class EventDirector {
    constructor(options = {}) {
        const {
            clock,
            config = {},
        } = options;

        this._clock = typeof clock === 'function'
            ? clock
            : (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));

        const defaultAudioReactive = {
            useAudioDensity: true,
            minDensityMultiplier: 0.22,
            maxDensityMultiplier: 3.1,
            beatDensityBoost: 0.9,
            silenceDensityMultiplier: 0.18,
            minDensity: 0,
            maxDensity: Infinity,
            baseDifficulty: 1,
            difficultyRange: [1, 6.5],
            beatDifficultyBoost: 0.42,
            calmDifficultyDrop: 0.28,
            difficultyInertia: 0.82,
            difficultyGain: 0.16,
            silenceThreshold: 0.05,
        };

        const directiveDurations = {
            gestureDirective: 4500,
            quickDraw: 3200,
            ...(config.directiveDurations || {}),
        };

        this.config = {
            baseDensity: 1,
            directiveDurations,
            blockingDirectives: ['gestureDirective', 'quickDraw'],
            ...config,
        };

        this.config.directiveDurations = directiveDurations;
        this.config.audioReactive = mergeProgramDefinition(defaultAudioReactive, config.audioReactive || {});
        this.config.visualPrograms = config.visualPrograms || {};

        this.activeDirectives = new Map();
        this.lastIssuedSpawnDirective = null;

        this.audioState = this.createAudioSnapshot({ timestamp: this.now() });
        this.difficulty = this.config.audioReactive.baseDifficulty ?? 1;
        this.difficultyTrend = 0;

        this.visualProgramLibrary = this.buildVisualProgramLibrary(this.config.visualPrograms);
        this.programMemory = new Map();
    }

    now() {
        return this._clock();
    }

    createAudioSnapshot(overrides = {}) {
        return {
            ...createDefaultAudioState(),
            ...overrides,
            bandEnergies: {
                ...createDefaultAudioState().bandEnergies,
                ...(overrides.bandEnergies || {}),
            },
        };
    }

    cloneAudioState(state = this.audioState) {
        if (!state) {
            return this.createAudioSnapshot({ timestamp: this.now() });
        }
        return this.createAudioSnapshot({ ...state });
    }

    buildVisualProgramLibrary(overrides = {}) {
        const defaults = {
            default: {
                accent: '#7f9cff',
                accentPalette: {
                    low: ['#2dd9ff', '#1ef2a4'],
                    mid: ['#7f9cff', '#a0b6ff'],
                    high: ['#ff6dd4', '#ff8ac8'],
                },
                palette: {
                    low: ['#2dd9ff', '#1ef2a4', '#04293a'],
                    mid: ['#7f9cff', '#586dff', '#081a42'],
                    high: ['#ff6dd4', '#ffc1ff', '#2d063a'],
                },
                geometryBands: {
                    low: ['basin-ridge', 'swell-columns', 'ground-lattice'],
                    mid: ['vector-ribbon', 'corner-wave', 'orbiting-prism'],
                    high: ['spire-cascade', 'aerial-shards', 'fractal-comet'],
                },
                shaderIntensity: [
                    { threshold: 0.82, id: 'chromatic-inversion', variant: 'surge' },
                    { threshold: 0.55, id: 'vector-electric', variant: 'aero' },
                    { threshold: 0.3, id: 'volumetric-bloom', variant: 'mist' },
                    { threshold: 0, id: 'soft-glow', variant: 'ambient' },
                ],
                beatPattern: ['percussive-corners', 'pulse-diagonals'],
                sustainPattern: ['flowing-strands', 'orbiting-arcs'],
                effects: {
                    beat: 'invert-glare',
                    sustain: 'lattice-breathe',
                    release: 'cooling-falloff',
                },
                callouts: {
                    low: 'ANCHOR THE BASS SURGES',
                    mid: 'TRACE THE MIDLANE ORBITS',
                    high: 'CHASE THE TREBLE SPARKS',
                },
                motion: {
                    baseSpeed: 0.9,
                    beatBoost: 0.5,
                    intensityBoost: 0.35,
                },
            },
            gestureDirective: {
                accent: '#45ffe7',
                accentPalette: {
                    low: ['#24ffc3', '#26f7ff'],
                    mid: ['#45ffe7', '#6effeb'],
                    high: ['#9dfff4', '#3ffff1'],
                },
                palette: {
                    low: ['#24ffc3', '#0f2f26', '#0b1b29'],
                    mid: ['#45ffe7', '#103842', '#0d2230'],
                    high: ['#9dfff4', '#154b50', '#11212e'],
                },
                geometryBands: {
                    low: ['arc-sling', 'kinetic-bridge'],
                    mid: ['vector-fan', 'spiral-gesture'],
                    high: ['flare-crown', 'gesture-spoke'],
                },
                shaderIntensity: [
                    { threshold: 0.85, id: 'neon-vector-invert', variant: 'strike' },
                    { threshold: 0.6, id: 'chromatic-burst', variant: 'flare' },
                    { threshold: 0.35, id: 'volumetric-pulse', variant: 'sweep' },
                    { threshold: 0, id: 'directive-glow', variant: 'ambient' },
                ],
                beatPattern: ['gesture-slash', 'fractal-crash'],
                sustainPattern: ['gesture-trace', 'hovering-ribbon'],
                effects: {
                    beat: 'corner-flare',
                    sustain: 'vector-stream',
                    release: 'particle-shed',
                },
                callouts: {
                    low: 'CARVE THE BASS ARC',
                    mid: 'TRACE THE MID VELOCITY',
                    high: 'SNAP THE TREBLE LINES',
                },
                motion: {
                    baseSpeed: 1.1,
                    beatBoost: 0.7,
                    intensityBoost: 0.45,
                },
                difficultyTiers: [
                    { min: 3, shader: 'chromatic-burst', pattern: 'gesture-crush', effect: 'lightning-fracture' },
                    {
                        min: 5,
                        geometry: 'gesture-spoke',
                        shader: 'neon-vector-invert',
                        effect: 'spectral-storm',
                        callout: 'COMMAND THE FRACTAL SURGE',
                    },
                ],
            },
            quickDraw: {
                accent: '#ff3a73',
                accentPalette: {
                    low: ['#ff784a', '#ff3a73'],
                    mid: ['#ff3a73', '#ff5da5'],
                    high: ['#ff9dce', '#ff5df6'],
                },
                palette: {
                    low: ['#ff784a', '#2c0700', '#3a0b12'],
                    mid: ['#ff3a73', '#3a0b1c', '#210710'],
                    high: ['#ff9dce', '#4b1132', '#2a061a'],
                },
                geometryBands: {
                    low: ['corner-sprint', 'dash-diagonal'],
                    mid: ['triad-pivot', 'snap-rhomboid'],
                    high: ['flare-burst', 'spark-constellation'],
                },
                shaderIntensity: [
                    { threshold: 0.88, id: 'strobe-inversion', variant: 'blade' },
                    { threshold: 0.65, id: 'vector-scanlines', variant: 'rapid' },
                    { threshold: 0.4, id: 'ember-bloom', variant: 'flare' },
                    { threshold: 0, id: 'glow-trail', variant: 'ambient' },
                ],
                beatPattern: ['quickdraw-stars', 'bolt-fan'],
                sustainPattern: ['drift-grid', 'slide-cascade'],
                effects: {
                    beat: 'flash-reversal',
                    sustain: 'ember-tail',
                    release: 'ember-falloff',
                },
                callouts: {
                    low: 'PUNCTURE THE LOW RUMBLE',
                    mid: 'SLICE THROUGH THE MIDS',
                    high: 'CHASE THE TREBLE SPARKS',
                },
                motion: {
                    baseSpeed: 1.25,
                    beatBoost: 0.85,
                    intensityBoost: 0.55,
                },
                difficultyTiers: [
                    { min: 2, geometry: 'triad-pivot', shader: 'vector-scanlines', pattern: 'quickdraw-stars' },
                    { min: 4, shader: 'strobe-inversion', effect: 'chromatic-whiplash', callout: 'STRIKE WITH TREBLE FURY' },
                ],
            },
            ambient: {
                accent: '#7f9cff',
            },
        };

        const library = {};
        Object.entries(defaults).forEach(([type, definition]) => {
            library[type] = mergeProgramDefinition({}, definition);
        });

        Object.entries(overrides || {}).forEach(([type, definition]) => {
            const base = library[type] || {};
            library[type] = mergeProgramDefinition(base, definition);
        });

        return library;
    }

    updateAudioState(audioState = null) {
        const normalized = audioState
            ? this.createAudioSnapshot(audioState)
            : this.createAudioSnapshot({ timestamp: this.now() });

        if (!normalized.dominantBand) {
            normalized.dominantBand = this.getDominantBand(normalized.bandEnergies);
        }
        normalized.intensity = clamp(Number.isFinite(normalized.intensity) ? normalized.intensity : 0, 0, 1);
        normalized.volume = clamp(Number.isFinite(normalized.volume) ? normalized.volume : normalized.intensity, 0, 1);
        normalized.silence = Boolean(
            audioState?.silence
            ?? normalized.intensity < (this.config.audioReactive.silenceThreshold ?? 0.05),
        );

        this.audioState = normalized;
        this.updateDifficultyFromAudio(normalized);
        return this.audioState;
    }

    getAudioState() {
        return this.cloneAudioState(this.audioState);
    }

    updateDifficultyFromAudio(audioState) {
        const cfg = this.config.audioReactive;
        const [minDifficulty, maxDifficulty] = cfg.difficultyRange || [1, 6];
        const base = cfg.baseDifficulty ?? 1;

        const intensity = clamp(audioState?.intensity ?? 0, 0, 1);
        const highEnergy = clamp(audioState?.bandEnergies?.high ?? 0, 0, 1);
        const beatBoost = audioState?.beat ? cfg.beatDifficultyBoost ?? 0.35 : 0;
        const calmDrop = audioState?.silence ? cfg.calmDifficultyDrop ?? 0.25 : 0;

        const trend = (highEnergy * 0.5) + (intensity * 0.5) + beatBoost - calmDrop;
        this.difficultyTrend = (this.difficultyTrend * (cfg.difficultyInertia ?? 0.82)) + trend;

        let nextDifficulty = (this.difficulty ?? base) + (this.difficultyTrend * (cfg.difficultyGain ?? 0.12));
        if (!Number.isFinite(nextDifficulty)) {
            nextDifficulty = base;
        }

        this.difficulty = clamp(nextDifficulty, minDifficulty, maxDifficulty);
        return this.difficulty;
    }

    activateDirective(type, payload = {}) {
        const startTime = this.now();
        const duration = payload.duration ?? this.config.directiveDurations[type] ?? 0;
        const endsAt = duration > 0 ? startTime + duration : null;
        const countdownSeconds = payload.countdownSeconds
            ?? payload.countdown
            ?? (duration ? Math.ceil(duration / 1000) : null);

        const audioSnapshot = this.cloneAudioState();
        const directiveDifficulty = payload.difficulty ?? this.difficulty;
        const visualProgram = this.deriveVisualProgram({
            type,
            audioState: audioSnapshot,
            difficulty: directiveDifficulty,
        });

        const color = payload.color
            ?? visualProgram?.accent
            ?? this.colorFromAudio(audioSnapshot, this.getDefaultColor(type));

        const annotation = payload.annotation
            ?? payload.subtitle
            ?? this.buildDirectiveCallout(visualProgram, audioSnapshot, type);

        const hint = payload.hint
            ?? this.buildDirectiveHint(visualProgram, audioSnapshot);

        const directive = {
            id: payload.id ?? `${type}-${startTime.toFixed(0)}`,
            type,
            label: payload.label ?? this.getDefaultLabel(type),
            prompt: payload.prompt ?? payload.message ?? '',
            description: payload.description ?? '',
            annotation,
            hint,
            startedAt: startTime,
            duration,
            endsAt,
            countdownSeconds,
            severity: payload.severity ?? 'standard',
            color,
            metadata: { ...payload.metadata },
            visualProgram,
            audioSnapshot,
            difficulty: directiveDifficulty,
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
        const resolvedState = {
            ...directive,
            completedAt: this.now(),
            result,
        };
        return resolvedState;
    }

    update(now = this.now()) {
        const expired = [];
        for (const [type, directive] of this.activeDirectives.entries()) {
            if (directive.endsAt != null && now >= directive.endsAt) {
                this.activeDirectives.delete(type);
                expired.push({
                    ...directive,
                    type,
                    expiredAt: now,
                    reason: 'timeout',
                    result: { success: false, reason: 'timeout' },
                });
            }
        }
        return expired;
    }

    isDirectiveActive(type) {
        if (type) {
            return this.activeDirectives.has(type);
        }
        return this.config.blockingDirectives.some((directiveType) => this.activeDirectives.has(directiveType));
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
        for (const type of this.config.blockingDirectives) {
            const state = this.getDirectiveState(type, now);
            if (state) {
                return state;
            }
        }
        return null;
    }

    computeAudioReactiveDensity(baseDensity = null) {
        const cfg = this.config.audioReactive;
        const base = Number.isFinite(baseDensity) ? baseDensity : this.config.baseDensity;
        if (!cfg.useAudioDensity) {
            return base;
        }

        const intensity = this.audioState?.intensity ?? 0;
        let density = base * (cfg.minDensityMultiplier
            + ((cfg.maxDensityMultiplier - cfg.minDensityMultiplier) * intensity));

        if (this.audioState?.beat) {
            density += cfg.beatDensityBoost ?? 0.5;
        }

        if (this.audioState?.silence) {
            density *= cfg.silenceDensityMultiplier ?? 0.2;
        }

        if (Number.isFinite(cfg.minDensity)) {
            density = Math.max(cfg.minDensity, density);
        }
        if (Number.isFinite(cfg.maxDensity)) {
            density = Math.min(cfg.maxDensity, density);
        }

        return Math.max(0, density);
    }

    getSpawnDirectives(baseDirective = {}) {
        const now = this.now();
        const blockingState = this.getPrimaryDirectiveState(now);
        const audioSnapshot = this.cloneAudioState();

        if (blockingState) {
            const pauseDirective = {
                paused: true,
                density: 0,
                reason: blockingState.type,
                directive: blockingState,
                visualProgram: blockingState.visualProgram,
                audioSnapshot,
            };
            this.lastIssuedSpawnDirective = pauseDirective;
            return pauseDirective;
        }

        const density = this.computeAudioReactiveDensity(baseDirective.density);
        const difficulty = baseDirective.difficulty ?? this.difficulty;
        const type = baseDirective.type || baseDirective.directiveType || 'ambient';
        const visualProgram = this.deriveVisualProgram({
            type,
            audioState: audioSnapshot,
            difficulty,
        });

        const normalDirective = {
            ...baseDirective,
            paused: false,
            density,
            difficulty,
            audioReactive: true,
            audioSnapshot,
            visualProgram,
            targetRules: this.composeTargetRules(visualProgram, audioSnapshot),
        };

        this.lastIssuedSpawnDirective = normalDirective;
        return normalDirective;
    }

    composeTargetRules(visualProgram, audioState) {
        if (!visualProgram) {
            return null;
        }

        return {
            geometry: visualProgram.geometry,
            shader: visualProgram.shader,
            pattern: visualProgram.pattern,
            accent: visualProgram.accent,
            effect: visualProgram.effect,
            palette: visualProgram.palette,
            motion: visualProgram.motion,
            difficulty: visualProgram.difficulty,
            audioBand: visualProgram.audioBand,
            beatReactive: Boolean(audioState?.beat),
        };
    }

    deriveVisualProgram({ type = 'ambient', audioState = null, difficulty = this.difficulty } = {}) {
        const library = this.visualProgramLibrary;
        const definition = mergeProgramDefinition(
            library.default || {},
            library[type] || {},
        );

        const resolvedAudio = audioState ? this.createAudioSnapshot(audioState) : this.cloneAudioState();
        const dominantBand = resolvedAudio.dominantBand || this.getDominantBand(resolvedAudio.bandEnergies);

        const geometryOptions = ensureArray(
            definition.geometryBands?.[dominantBand]
            ?? definition.geometry
            ?? library.default?.geometryBands?.[dominantBand]
            ?? library.default?.geometry,
        );
        const geometry = this.selectVariant(type, `geometry:${dominantBand}`, geometryOptions)
            ?? geometryOptions[0]
            ?? 'lattice-flow';

        const shaderCandidate = this.selectShaderVariant(definition, resolvedAudio.intensity, difficulty);
        const shader = shaderCandidate?.id ?? shaderCandidate ?? 'soft-glow';

        const accent = this.resolveAccentColor(type, definition, resolvedAudio, difficulty);

        const patternOptionsBeat = ensureArray(definition.beatPattern ?? definition.beatPatterns);
        const patternOptionsSustain = ensureArray(definition.sustainPattern ?? definition.sustainPatterns);
        const pattern = resolvedAudio.beat
            ? (this.selectVariant(type, 'pattern:beat', patternOptionsBeat) || patternOptionsBeat[0] || 'percussive-corners')
            : (this.selectVariant(type, 'pattern:sustain', patternOptionsSustain) || patternOptionsSustain[0] || 'flowing-strands');

        const effect = resolvedAudio.beat
            ? (definition.effects?.beat ?? definition.effects?.default)
            : (definition.effects?.sustain ?? definition.effects?.default);

        const callout = this.buildDirectiveCallout({
            callout: definition.callout,
            callouts: definition.callouts,
            effect,
            accent,
            geometry,
            pattern,
        }, resolvedAudio, type);

        const motion = definition.motion
            ? {
                baseSpeed: definition.motion.baseSpeed ?? 1,
                beatBoost: definition.motion.beatBoost ?? 0,
                intensityBoost: definition.motion.intensityBoost ?? 0,
            }
            : null;

        const program = {
            type,
            geometry,
            shader,
            shaderVariant: shaderCandidate?.variant,
            accent,
            pattern,
            effect,
            callout,
            palette: definition.palette?.[dominantBand] || definition.palette || null,
            motion,
            difficulty,
            audioBand: dominantBand,
            audioDriven: true,
        };

        const tierAdjusted = this.applyDifficultyTier(type, program, definition, difficulty);
        tierAdjusted.difficulty = difficulty;
        return tierAdjusted;
    }

    selectShaderVariant(definition, intensity, difficulty) {
        const candidates = ensureArray(definition.shaderIntensity);
        if (candidates.length === 0) {
            return null;
        }

        const sorted = candidates
            .map((entry) => (typeof entry === 'string' ? { id: entry, threshold: 0 } : entry))
            .sort((a, b) => (b.threshold ?? 0) - (a.threshold ?? 0));

        const match = sorted.find((entry) => intensity >= (entry.threshold ?? 0));
        return match || sorted[sorted.length - 1];
    }

    resolveAccentColor(type, definition, audioState, difficulty) {
        const band = audioState?.dominantBand || 'mid';
        const palette = definition.accentPalette?.[band];
        const paletteOptions = ensureArray(palette);
        const tierAccent = this.resolveTierOverride(definition, difficulty, 'accent');

        if (tierAccent) {
            return tierAccent;
        }

        if (paletteOptions.length > 0) {
            return this.selectVariant(type, `accent:${band}`, paletteOptions) || paletteOptions[0];
        }

        if (definition.colorize === 'audio-hue') {
            return this.colorFromAudio(audioState, definition.accent ?? this.getDefaultColor(type));
        }

        return definition.accent ?? this.getDefaultColor(type);
    }

    selectVariant(type, key, options) {
        if (!options || options.length === 0) {
            return null;
        }

        const variantKey = `${type}:${key}`;
        const lastEntry = this.programMemory.get(variantKey) || { index: -1, value: null };
        let nextIndex = (lastEntry.index + 1) % options.length;

        if (options.length > 1 && options[nextIndex] === lastEntry.value) {
            nextIndex = (nextIndex + 1) % options.length;
        }

        const value = options[nextIndex];
        this.programMemory.set(variantKey, { index: nextIndex, value });
        return value;
    }

    applyDifficultyTier(type, program, definition, difficulty) {
        if (!Array.isArray(definition.difficultyTiers) || definition.difficultyTiers.length === 0) {
            return program;
        }

        const eligible = definition.difficultyTiers
            .filter((tier) => difficulty >= (tier.min ?? 0))
            .sort((a, b) => (b.min ?? 0) - (a.min ?? 0));

        if (eligible.length === 0) {
            return program;
        }

        const active = eligible[0];
        const adjusted = { ...program };

        if (active.geometry) {
            adjusted.geometry = active.geometry;
        }
        if (active.shader) {
            adjusted.shader = active.shader;
        }
        if (active.pattern) {
            adjusted.pattern = active.pattern;
        }
        if (active.accent) {
            adjusted.accent = active.accent;
        }
        if (active.effect) {
            adjusted.effect = active.effect;
        }
        if (active.callout) {
            adjusted.callout = active.callout;
        }
        if (active.palette) {
            adjusted.palette = Array.isArray(active.palette) ? active.palette.slice() : active.palette;
        }
        if (active.motion) {
            adjusted.motion = {
                ...(adjusted.motion || {}),
                ...active.motion,
            };
        }
        if (active.signature) {
            adjusted.signature = active.signature;
        }

        return adjusted;
    }

    resolveTierOverride(definition, difficulty, key) {
        if (!Array.isArray(definition.difficultyTiers)) {
            return null;
        }

        const tier = definition.difficultyTiers
            .filter((entry) => difficulty >= (entry.min ?? 0) && entry[key] != null)
            .sort((a, b) => (b.min ?? 0) - (a.min ?? 0))[0];

        return tier ? tier[key] : null;
    }

    buildDirectiveCallout(programOrDefinition, audioState, type) {
        const { callout, callouts } = programOrDefinition || {};
        if (callout) {
            return callout;
        }

        if (callouts) {
            const band = audioState?.dominantBand || 'mid';
            return callouts[band] || callouts.default || callouts.mid || callouts.low || callouts.high;
        }

        const bandName = (audioState?.dominantBand || 'mid').toUpperCase();
        if (audioState?.beat) {
            return `HIT THE ${bandName} SURGE`;
        }
        return `FLOW WITH THE ${bandName} CURRENT`;
    }

    buildDirectiveHint(visualProgram, audioState) {
        if (visualProgram?.hint) {
            return visualProgram.hint;
        }
        if (audioState?.dominantBand) {
            return `${audioState.dominantBand.toUpperCase()} BAND`;
        }
        return 'SECONDS';
    }

    getDominantBand(bandEnergies = {}) {
        let dominant = 'mid';
        let maxValue = -Infinity;
        Object.entries(bandEnergies).forEach(([band, value]) => {
            if (value > maxValue) {
                dominant = band;
                maxValue = value;
            }
        });
        return dominant;
    }

    colorFromAudio(audioState, fallbackColor = '#7f9cff') {
        const centroid = audioState?.spectralCentroid;
        const intensity = audioState?.intensity ?? 0;

        if (!Number.isFinite(centroid) || centroid <= 0) {
            return fallbackColor;
        }

        const minFreq = 120;
        const maxFreq = 8000;
        const logCentroid = Math.log(Math.max(minFreq, centroid));
        const normalized = clamp(
            (logCentroid - Math.log(minFreq)) / (Math.log(maxFreq) - Math.log(minFreq)),
            0,
            1,
        );
        const hue = Math.round(normalized * 360);
        const saturation = Math.round(68 + (intensity * 24));
        const lightness = Math.round(48 + (intensity * 12));
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    clearDirective(type) {
        this.activeDirectives.delete(type);
    }

    clearAllDirectives() {
        this.activeDirectives.clear();
    }

    getDefaultLabel(type) {
        switch (type) {
        case 'gestureDirective':
            return 'Gesture Directive';
        case 'quickDraw':
            return 'Quick Draw';
        default:
            return type;
        }
    }

    getDefaultColor(type) {
        switch (type) {
        case 'gestureDirective':
            return '#45ffe7';
        case 'quickDraw':
            return '#ff3a73';
        default:
            return '#7f9cff';
        }
    }
}
