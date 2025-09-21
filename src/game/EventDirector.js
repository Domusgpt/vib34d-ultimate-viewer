/**
 * EventDirector coordinates narrative beats like gesture directives and quick draw
 * prompts. It exposes spawn directives that the SpawnSystem can consume to decide
 * how aggressively new targets should be introduced.
 */
export class EventDirector {
    constructor(options = {}) {
        const {
            clock,
            config = {},
            audioEngine = null,
            audioProfiles = {},
            difficultyCurve = {},
        } = options;

        this._clock = typeof clock === 'function'
            ? clock
            : (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));

        this.config = {
            baseDensity: 1,
            directiveDurations: {
                gestureDirective: 4500,
                quickDraw: 3200,
                ...(config.directiveDurations || {}),
            },
            blockingDirectives: ['gestureDirective', 'quickDraw'],
            audioSettings: {
                baseDensityMultiplier: 1.15,
                beatDensityBoost: 0.92,
                energyDensityBoost: 1.4,
                trendDensityBoost: 0.65,
                minDensity: 0.25,
                maxDensity: 6.5,
                palette: {
                    bass: {
                        primary: '#38ffe0',
                        secondary: '#0d2f38',
                        tertiary: '#041920',
                    },
                    mid: {
                        primary: '#ffb44a',
                        secondary: '#2c1603',
                        tertiary: '#180b03',
                    },
                    treble: {
                        primary: '#b18eff',
                        secondary: '#1a133d',
                        tertiary: '#09051c',
                    },
                    balanced: {
                        primary: '#7f9cff',
                        secondary: '#121b3a',
                        tertiary: '#050913',
                    },
                },
                ...(config.audioSettings || {}),
            },
            ...config,
        };

        this.audioEngine = audioEngine || null;

        const initialDifficulty = difficultyCurve.initial ?? 1;

        this.difficultyState = {
            value: initialDifficulty,
            smoothing: difficultyCurve.smoothing ?? 0.08,
            min: difficultyCurve.min ?? 0.85,
            max: difficultyCurve.max ?? 3.4,
            bias: difficultyCurve.bias ?? 1,
        };

        this.lastComputedDifficulty = initialDifficulty;

        this.audioProfiles = this.initializeAudioProfiles({
            ...(config.audioProfiles || {}),
            ...(audioProfiles || {}),
        });

        this.audioProfileState = new Map();
        this.activeDirectives = new Map();
        this.lastIssuedSpawnDirective = null;
        this.lastAudioFrame = null;
        this.lastAmbientPattern = null;

        this.refreshBlockingDirectives();
    }

    now() {
        return this._clock();
    }

    activateDirective(type, payload = {}) {
        const startTime = this.now();
        const duration = payload.duration ?? this.config.directiveDurations[type] ?? 0;
        const endsAt = duration > 0 ? startTime + duration : null;
        const countdownSeconds = payload.countdownSeconds
            ?? payload.countdown
            ?? (duration ? Math.ceil(duration / 1000) : null);

        const difficultyLevel = this.getDifficultyLevel();
        const difficultyLabel = payload.difficultyLabel
            ?? payload.difficultyTier
            ?? this.describeDifficultyTier(payload.difficulty ?? difficultyLevel).label;
        const palette = payload.colorPalette ? { ...payload.colorPalette } : null;
        const pattern = payload.pattern ? { ...payload.pattern } : null;
        if (pattern && palette && !pattern.colorPalette) {
            pattern.colorPalette = palette;
        }

        const directive = {
            id: payload.id ?? `${type}-${startTime.toFixed(0)}`,
            type,
            label: payload.label ?? this.getDefaultLabel(type),
            prompt: payload.prompt ?? payload.message ?? '',
            description: payload.description ?? '',
            startedAt: startTime,
            duration,
            endsAt,
            countdownSeconds,
            severity: payload.severity ?? 'standard',
            color: payload.color,
            metadata: { ...payload.metadata },
            pauseSpawns: payload.pauseSpawns ?? true,
            pattern,
            geometry: payload.geometry ? { ...payload.geometry } : pattern?.geometry ?? null,
            shaderEffect: payload.shaderEffect ? { ...payload.shaderEffect } : null,
            colorPalette: palette,
            difficulty: payload.difficulty ?? difficultyLevel,
            difficultyLabel,
            difficultyTier: difficultyLabel,
            intensity: payload.intensity ?? null,
            tempo: payload.tempo ?? null,
            audioFrame: payload.audioFrame ? { ...payload.audioFrame } : this.lastAudioFrame,
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
        const activated = this.updateAudioState(now);
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
        return { expired, activated };
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
        for (const type of this.config.blockingDirectives) {
            const state = this.getDirectiveState(type, now);
            if (state && this.shouldDirectiveBlockSpawns(state, type)) {
                return state;
            }
        }

        for (const [type] of this.activeDirectives.entries()) {
            const state = this.getDirectiveState(type, now);
            if (state && this.shouldDirectiveBlockSpawns(state, type)) {
                return state;
            }
        }

        return null;
    }

    getSpawnDirectives(baseDirective = {}) {
        const now = this.now();
        const blockingState = this.getPrimaryDirectiveState(now);
        if (blockingState) {
            const pauseDirective = {
                paused: true,
                density: 0,
                reason: blockingState.type,
                directive: blockingState,
                pattern: blockingState.pattern,
                geometry: blockingState.geometry,
                shaderEffect: blockingState.shaderEffect,
                difficulty: blockingState.difficulty,
                color: blockingState.color,
                colorPalette: blockingState.colorPalette,
            };
            this.lastIssuedSpawnDirective = pauseDirective;
            return pauseDirective;
        }

        const adaptiveDirective = this.buildAudioDrivenSpawnDirective(baseDirective);
        this.lastIssuedSpawnDirective = adaptiveDirective;
        return adaptiveDirective;
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
        case 'cadenceFlux':
            return 'Cadence Flux';
        default:
            return type;
        }
    }

    refreshBlockingDirectives() {
        const blocking = new Set(this.config.blockingDirectives || []);
        for (const [type, profile] of Object.entries(this.audioProfiles || {})) {
            if (!profile) {
                continue;
            }
            if (profile.pauseSpawns !== false) {
                blocking.add(type);
            }
        }
        this.config.blockingDirectives = Array.from(blocking);
    }

    shouldDirectiveBlockSpawns(directive, typeOverride) {
        if (!directive) {
            return false;
        }

        if (directive.pauseSpawns === false) {
            return false;
        }

        const type = typeOverride || directive.type;
        if (directive.pauseSpawns === true) {
            return true;
        }

        return this.config.blockingDirectives.includes(type);
    }

    initializeAudioProfiles(userProfiles = {}) {
        const defaults = {
            gestureDirective: {
                label: 'Gesture Directive',
                prompt: (frame, pattern, difficulty) => (difficulty.label === 'Zenith'
                    ? 'TRACE THE STORM ARC'
                    : 'TRACE THE RESONANCE'),
                annotation: (frame, pattern, difficulty) => `${pattern.displayName} • ${difficulty.label}`,
                color: (frame, pattern, difficulty, palette) => palette.primary,
                duration: this.config.directiveDurations.gestureDirective,
                cooldown: 3600,
                pauseSpawns: true,
                pattern: (frame, context) => this.buildCornerSweepPattern(frame, context.difficulty),
                shaderEffect: (frame, pattern, difficulty) => ({
                    type: 'lattice-warp',
                    intensity: 0.45 + Math.min(0.45, (pattern.intensity ?? 0) * 0.65),
                    duration: 2000 + (difficulty.normalized * 900),
                    color: pattern.colorPalette?.primary,
                }),
                trigger: (frame, context) => {
                    const { state, now } = context;
                    const lastTrigger = state.lastTrigger ?? 0;
                    if (this.activeDirectives.has('gestureDirective') && context.profile?.allowRetriggerWhileActive !== true) {
                        return false;
                    }
                    if (frame.bass > 0.52 && frame.beatStrength > 1.05) {
                        if ((now - lastTrigger) > 900 && (frame.beat || frame.energy > 0.75)) {
                            return true;
                        }
                    }
                    return false;
                },
            },
            quickDraw: {
                label: 'Quick Draw',
                prompt: () => 'STRIKE THE VECTOR',
                annotation: (frame, pattern, difficulty) => `${pattern.displayName} • ${difficulty.label}`,
                color: (frame, pattern, difficulty, palette) => palette.primary,
                duration: this.config.directiveDurations.quickDraw,
                cooldown: 2800,
                pauseSpawns: true,
                pattern: (frame, context) => this.buildVectorStrikePattern(frame, context.difficulty),
                shaderEffect: (frame, pattern, difficulty) => ({
                    type: 'color-invert',
                    intensity: 0.35 + Math.min(0.65, frame.treble * 0.8 + difficulty.normalized * 0.4),
                    duration: 1600 + Math.round(frame.treble * 700),
                    flicker: frame.zeroCrossingRate,
                }),
                trigger: (frame, context) => {
                    const { now, state } = context;
                    const lastTrigger = state.lastTrigger ?? 0;
                    if (this.activeDirectives.has('quickDraw') && context.profile?.allowRetriggerWhileActive !== true) {
                        return false;
                    }
                    if ((frame.treble > 0.58 && frame.beatStrength > 1.15) || frame.treble > 0.75) {
                        if ((now - lastTrigger) > 1100) {
                            return frame.beat || frame.energy > 0.82;
                        }
                    }
                    return false;
                },
            },
            cadenceFlux: {
                label: 'Cadence Flux',
                prompt: () => 'WEAVE THE HARMONICS',
                annotation: (frame, pattern, difficulty) => `${pattern.displayName} • ${difficulty.label}`,
                color: (frame, pattern, difficulty, palette) => palette.primary,
                duration: 5200,
                cooldown: 6200,
                pauseSpawns: false,
                pattern: (frame, context) => this.buildCadenceWeavePattern(frame, context.difficulty),
                shaderEffect: (frame, pattern, difficulty) => ({
                    type: 'chromatic-aberration',
                    intensity: 0.25 + Math.min(0.5, (pattern.intensity ?? 0.2) * 0.6 + difficulty.normalized * 0.3),
                    duration: 2400 + (difficulty.normalized * 1200),
                    orientation: pattern.orientation,
                }),
                trigger: (frame, context) => {
                    const { state, now } = context;
                    const lastTrigger = state.lastTrigger ?? 0;
                    if (frame.mid > 0.55 && frame.energy > 0.45) {
                        if (!state.sustainStart) {
                            state.sustainStart = now;
                        } else if ((now - state.sustainStart) > 1100 && (now - lastTrigger) > 2500) {
                            return true;
                        }
                    } else {
                        state.sustainStart = null;
                    }
                    return false;
                },
            },
        };

        const merged = {};
        for (const [type, profile] of Object.entries(defaults)) {
            merged[type] = {
                ...profile,
                ...(userProfiles[type] || {}),
            };
        }

        for (const [type, profile] of Object.entries(userProfiles)) {
            if (!merged[type]) {
                merged[type] = { ...profile };
            }
        }

        return merged;
    }

    updateAudioState(now) {
        if (!this.audioEngine || typeof this.audioEngine.update !== 'function') {
            return [];
        }

        const frame = this.audioEngine.update(now);
        if (!frame) {
            return [];
        }

        this.lastAudioFrame = frame;
        this.lastComputedDifficulty = this.updateDifficultyFromFrame(frame);
        return this.evaluateAudioTriggers(frame, now);
    }

    evaluateAudioTriggers(frame, now) {
        if (!this.audioProfiles) {
            return [];
        }

        const activations = [];
        const difficultyInfo = this.describeDifficultyTier(this.getDifficultyLevel());

        for (const [type, profile] of Object.entries(this.audioProfiles)) {
            if (!profile) {
                continue;
            }

            const state = this.audioProfileState.get(type) || {};
            const cooldownUntil = state.cooldownUntil ?? 0;
            if (now < cooldownUntil) {
                this.audioProfileState.set(type, state);
                continue;
            }

            if (this.activeDirectives.has(type) && profile.allowRetriggerWhileActive !== true) {
                this.audioProfileState.set(type, state);
                continue;
            }

            const context = {
                director: this,
                frame,
                now,
                difficulty: difficultyInfo,
                state,
                profile,
                lastDirective: this.activeDirectives.get(type),
            };

            const shouldTrigger = this.shouldTriggerProfile(profile, frame, context);
            this.audioProfileState.set(type, state);

            if (!shouldTrigger) {
                continue;
            }

            const directiveConfig = this.buildProfileDirective(type, profile, frame, now, difficultyInfo);
            const directive = this.activateDirective(type, directiveConfig);
            if (directive) {
                activations.push(directive);
                state.lastTrigger = now;
                const cooldown = profile.cooldown ?? directive.duration ?? 0;
                state.cooldownUntil = now + Math.max(600, cooldown);
                if (typeof profile.onTrigger === 'function') {
                    try {
                        profile.onTrigger({ directive, frame, context });
                    } catch (error) {
                        // Swallow profile callback failures to avoid breaking the director loop.
                    }
                }
            }
        }

        return activations;
    }

    shouldTriggerProfile(profile, frame, context) {
        if (typeof profile.trigger === 'function') {
            return Boolean(profile.trigger(frame, context));
        }

        if (!frame) {
            return false;
        }

        if (frame.beat && frame.energy > 0.65) {
            const dominantBand = this.getDominantBand(frame);
            if (profile === this.audioProfiles.gestureDirective && dominantBand === 'bass') {
                return true;
            }
            if (profile === this.audioProfiles.quickDraw && dominantBand === 'treble') {
                return true;
            }
        }

        return false;
    }

    buildProfileDirective(type, profile, frame, now, difficultyInfo) {
        const difficulty = difficultyInfo || this.describeDifficultyTier(this.getDifficultyLevel());
        const pattern = this.resolveProfilePattern(profile, frame, difficulty);
        const palette = pattern?.colorPalette
            || this.buildColorPaletteForBand(pattern?.band ?? this.getDominantBand(frame), frame, pattern);

        if (pattern && !pattern.colorPalette) {
            pattern.colorPalette = palette;
        }

        const annotation = typeof profile.annotation === 'function'
            ? profile.annotation(frame, pattern, difficulty)
            : profile.annotation ?? `${pattern?.displayName || this.getDefaultLabel(type)} • ${difficulty.label}`;
        const prompt = typeof profile.prompt === 'function'
            ? profile.prompt(frame, pattern, difficulty)
            : profile.prompt ?? '';
        const color = typeof profile.color === 'function'
            ? profile.color(frame, pattern, difficulty, palette)
            : profile.color || palette.primary;
        const shaderEffect = this.resolveProfileShader(profile, frame, pattern, difficulty, palette);

        const directive = {
            label: profile.label ?? this.getDefaultLabel(type),
            prompt,
            annotation,
            description: profile.description ?? '',
            duration: profile.duration ?? this.config.directiveDurations[type] ?? 0,
            color,
            shaderEffect,
            pattern,
            geometry: pattern?.geometry,
            colorPalette: palette,
            pauseSpawns: profile.pauseSpawns ?? true,
            difficulty: difficulty.level,
            difficultyLabel: difficulty.label,
            intensity: pattern?.intensity ?? frame.energy ?? 0,
            tempo: frame.bpm ?? null,
            audioFrame: frame,
            metadata: {
                ...(profile.metadata || {}),
                difficulty,
                audioFrame: frame,
                pattern,
            },
        };

        if (profile.countdownSeconds != null) {
            directive.countdownSeconds = profile.countdownSeconds;
        }

        if (profile.annotation == null && pattern?.displayName) {
            directive.annotation = `${pattern.displayName} • ${difficulty.label}`;
        }

        return directive;
    }

    resolveProfilePattern(profile, frame, difficulty) {
        if (typeof profile.pattern === 'function') {
            return profile.pattern(frame, {
                director: this,
                difficulty,
                lastPattern: this.lastAmbientPattern,
                frame,
            });
        }

        if (profile.pattern) {
            return { ...profile.pattern };
        }

        const dominantBand = this.getDominantBand(frame);
        switch (dominantBand) {
        case 'bass':
            return this.buildCornerSweepPattern(frame, difficulty);
        case 'treble':
            return this.buildVectorStrikePattern(frame, difficulty);
        case 'mid':
            return this.buildCadenceWeavePattern(frame, difficulty);
        default:
            return this.buildOrbitRibbonPattern(frame, difficulty);
        }
    }

    resolveProfileShader(profile, frame, pattern, difficulty, palette) {
        if (typeof profile.shaderEffect === 'function') {
            const effect = profile.shaderEffect(frame, pattern, difficulty, palette);
            return effect ? { ...effect } : null;
        }
        if (profile.shaderEffect) {
            return { ...profile.shaderEffect };
        }
        return this.buildAmbientShaderEffect(pattern, frame, difficulty.level);
    }

    buildAudioDrivenSpawnDirective(baseDirective = {}) {
        const frame = this.lastAudioFrame;
        if (!frame) {
            const density = baseDirective.density ?? this.config.baseDensity;
            return {
                ...baseDirective,
                paused: false,
                density,
                difficulty: this.getDifficultyLevel(),
                difficultyLabel: this.describeDifficultyTier(this.getDifficultyLevel()).label,
            };
        }

        const difficultyLevel = this.lastComputedDifficulty ?? this.getDifficultyLevel();
        const normalizedDifficulty = this.normalizeDifficultyValue(difficultyLevel);
        const settings = this.config.audioSettings || {};
        const baseDensity = baseDirective.density ?? this.config.baseDensity;

        let density = baseDensity * (settings.baseDensityMultiplier ?? 1);
        density += (settings.energyDensityBoost ?? 0) * frame.energy;
        if (frame.beat) {
            density += (settings.beatDensityBoost ?? 0) * Math.max(0, frame.beatStrength - 1);
        }
        if (frame.trend > 0) {
            density += (settings.trendDensityBoost ?? 0) * frame.trend;
        }

        density *= 0.72 + (normalizedDifficulty * 0.9);
        density = this.clampDensity(density);

        const pattern = this.buildAmbientPattern(frame, difficultyLevel);
        const palette = pattern?.colorPalette
            || this.buildColorPaletteForBand(pattern?.band ?? this.getDominantBand(frame), frame, pattern);
        if (pattern && !pattern.colorPalette) {
            pattern.colorPalette = palette;
        }

        const shaderEffect = this.buildAmbientShaderEffect(pattern, frame, difficultyLevel);

        return {
            ...baseDirective,
            paused: false,
            density,
            difficulty: difficultyLevel,
            difficultyLabel: this.describeDifficultyTier(difficultyLevel).label,
            pattern,
            geometry: pattern?.geometry,
            shaderEffect,
            color: palette.primary,
            colorPalette: palette,
            audioFrame: frame,
            tempo: frame.bpm,
            beatStrength: frame.beatStrength,
        };
    }

    buildAmbientPattern(frame, difficultyLevel) {
        const difficulty = this.describeDifficultyTier(difficultyLevel);
        const band = this.getDominantBand(frame);
        let pattern;
        switch (band) {
        case 'bass':
            pattern = this.buildCornerSweepPattern(frame, difficulty);
            break;
        case 'treble':
            pattern = this.buildVectorStrikePattern(frame, difficulty);
            break;
        case 'mid':
            pattern = this.buildCadenceWeavePattern(frame, difficulty);
            break;
        default:
            pattern = this.buildOrbitRibbonPattern(frame, difficulty);
            break;
        }

        pattern.origin = 'ambient';
        pattern.colorPalette = pattern.colorPalette
            || this.buildColorPaletteForBand(pattern.band ?? band, frame, pattern);
        this.lastAmbientPattern = pattern;
        return pattern;
    }

    buildCornerSweepPattern(frame, difficulty) {
        const variant = frame.spectralCentroid < 0.38 ? 'cardinal' : 'diagonal';
        const corners = variant === 'cardinal'
            ? ['north', 'east', 'south', 'west']
            : ['north-east', 'south-west', 'north-west', 'south-east'];
        const intensity = Math.min(1, frame.bass * (0.72 + (difficulty.normalized * 0.6)));
        const geometry = {
            type: 'arc',
            path: 'sweep',
            corners,
            radius: 0.74 - (intensity * 0.22),
            thickness: 0.18 + (difficulty.normalized * 0.08),
            rotationDirection: frame.trend >= 0 ? 'clockwise' : 'counterclockwise',
            travelTime: 820 - Math.min(420, frame.beatStrength * 220),
        };

        return {
            type: 'corner-sweep',
            displayName: variant === 'cardinal' ? 'Cardinal Sweep' : 'Diagonal Sweep',
            band: 'bass',
            variant,
            corners,
            intensity,
            tempo: frame.bpm,
            geometry,
            shaderFlavor: 'warp',
        };
    }

    buildVectorStrikePattern(frame, difficulty) {
        const orientation = frame.treble > frame.mid ? 'diagonal' : 'orthogonal';
        const baseRays = orientation === 'diagonal'
            ? ['north-east', 'south-west', 'north-west', 'south-east']
            : ['north', 'east', 'south', 'west'];
        const intensity = Math.min(1, frame.treble * (0.76 + (difficulty.normalized * 0.55)));
        const activeRays = Math.max(2, Math.round(baseRays.length * (0.5 + (intensity * 0.45))));
        const geometry = {
            type: 'rayburst',
            orientation,
            origin: 'center',
            rays: baseRays.slice(0, activeRays),
            length: 0.9 + (intensity * 0.35),
            width: 0.06 + (intensity * 0.08),
            oscillation: 0.15 + (frame.zeroCrossingRate * 0.4),
        };

        return {
            type: 'vector-strike',
            displayName: 'Vector Strike',
            band: 'treble',
            orientation,
            intensity,
            rays: geometry.rays,
            tempo: frame.bpm,
            geometry,
            shaderFlavor: 'invert',
        };
    }

    buildCadenceWeavePattern(frame, difficulty) {
        const orientation = frame.trend >= 0 ? 'ascending' : 'descending';
        const intensity = Math.min(1, frame.mid * (0.68 + (difficulty.normalized * 0.5)));
        const geometry = {
            type: 'weave',
            rows: 3 + Math.round(difficulty.level * 0.6),
            columns: 3 + Math.round(intensity * 4),
            amplitude: 0.12 + (intensity * 0.2),
            frequency: 1.2 + (intensity * 1.6),
            phase: orientation,
            drift: frame.zeroCrossingRate * 0.3,
        };

        return {
            type: 'cadence-weave',
            displayName: 'Harmonic Weave',
            band: 'mid',
            orientation,
            intensity,
            geometry,
            shaderFlavor: 'chromatic',
        };
    }

    buildOrbitRibbonPattern(frame, difficulty) {
        const intensity = Math.min(1, frame.energy * (0.7 + (difficulty.normalized * 0.45)));
        const geometry = {
            type: 'orbital',
            rings: 2 + Math.round(difficulty.normalized * 2.5),
            radius: 0.55 + (intensity * 0.25),
            angularVelocity: 0.35 + (frame.beatStrength * 0.2),
            wobble: frame.mid * 0.3,
            anchor: 'center',
        };

        return {
            type: 'orbital-ribbon',
            displayName: 'Orbital Ribbon',
            band: 'balanced',
            intensity,
            geometry,
            shaderFlavor: 'bloom',
        };
    }

    buildAmbientShaderEffect(pattern, frame, difficultyLevel) {
        if (!pattern) {
            return null;
        }

        const intensity = Math.min(1, pattern.intensity ?? frame.energy ?? 0.4);
        const normalizedDifficulty = this.normalizeDifficultyValue(difficultyLevel);

        switch (pattern.type) {
        case 'corner-sweep':
            return {
                type: 'glow-pulse',
                intensity: 0.4 + (intensity * 0.45) + (normalizedDifficulty * 0.15),
                duration: 1400 + (difficultyLevel * 180),
                color: pattern.colorPalette?.primary,
            };
        case 'vector-strike':
            return {
                type: 'color-invert',
                intensity: 0.3 + Math.min(0.5, (frame.treble * 0.7) + (normalizedDifficulty * 0.2)),
                duration: 900 + (intensity * 700),
                stutter: frame.zeroCrossingRate,
            };
        case 'cadence-weave':
            return {
                type: 'chromatic-aberration',
                intensity: 0.28 + (intensity * 0.4) + (normalizedDifficulty * 0.2),
                duration: 1600 + (difficultyLevel * 220),
                orientation: pattern.orientation,
            };
        default:
            return {
                type: 'bloom-pulse',
                intensity: 0.32 + (intensity * 0.45) + (normalizedDifficulty * 0.18),
                duration: 1300 + (difficultyLevel * 160),
            };
        }
    }

    buildColorPaletteForBand(band, frame, pattern = {}) {
        const paletteConfig = this.config.audioSettings?.palette || {};
        const base = paletteConfig[band] || paletteConfig.balanced || {
            primary: '#7f9cff',
            secondary: '#121b3a',
            tertiary: '#050913',
        };
        const intensity = Math.min(1, pattern.intensity ?? frame.energy ?? 0);
        const primary = this.tintColor(base.primary, Math.min(0.45, intensity * 0.4), true);
        const secondary = this.tintColor(base.secondary, Math.min(0.4, intensity * 0.3), false);
        const tertiary = this.tintColor(base.tertiary, Math.min(0.35, intensity * 0.25), false);

        return {
            primary,
            secondary,
            tertiary,
            accent: primary,
        };
    }

    tintColor(hexColor, factor, lighten = true) {
        if (typeof hexColor !== 'string' || !hexColor.startsWith('#')) {
            return hexColor;
        }

        const raw = hexColor.slice(1);
        const isShort = raw.length === 3;
        const value = Number.parseInt(raw, 16);
        if (Number.isNaN(value)) {
            return hexColor;
        }

        const component = (shift, length) => {
            if (isShort) {
                const nibble = (value >> shift) & 0xf;
                return nibble * 17;
            }
            return (value >> shift) & length;
        };

        const r = component(isShort ? 8 : 16, 255);
        const g = component(isShort ? 4 : 8, 255);
        const b = component(isShort ? 0 : 0, 255);

        const mix = lighten ? 255 : 0;
        const blend = (channel) => Math.round(channel + ((mix - channel) * factor));

        const blended = [blend(r), blend(g), blend(b)];
        return `#${blended.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    }

    getDominantBand(frame = {}) {
        const bands = [
            ['bass', frame.bass ?? 0],
            ['mid', frame.mid ?? 0],
            ['treble', frame.treble ?? 0],
        ];
        bands.sort((a, b) => b[1] - a[1]);
        const [topBand, topValue] = bands[0];
        const secondValue = bands[1][1];
        if (topValue - secondValue < 0.08) {
            return 'balanced';
        }
        return topBand;
    }

    updateDifficultyFromFrame(frame) {
        if (!frame) {
            return this.getDifficultyLevel();
        }

        const audioDifficulty = typeof frame.difficulty === 'object'
            ? frame.difficulty.level
            : frame.difficulty;
        let target = Number.isFinite(audioDifficulty)
            ? audioDifficulty
            : null;

        if (!Number.isFinite(target) && Number.isFinite(frame.energy)) {
            const { min, max } = this.difficultyState;
            target = min + (frame.energy * (max - min));
        }

        if (!Number.isFinite(target)) {
            return this.getDifficultyLevel();
        }

        const { smoothing, min, max } = this.difficultyState;
        const clamped = Math.max(min, Math.min(max, target));
        this.difficultyState.value = (this.difficultyState.value * (1 - smoothing)) + (clamped * smoothing);
        return this.getDifficultyLevel();
    }

    normalizeDifficultyValue(level) {
        const { min, max } = this.difficultyState;
        const range = Math.max(0.0001, max - min);
        return Math.min(1, Math.max(0, (level - min) / range));
    }

    describeDifficultyTier(level) {
        const normalized = this.normalizeDifficultyValue(level);
        let label = 'Flow';
        if (normalized >= 0.82) {
            label = 'Zenith';
        } else if (normalized >= 0.58) {
            label = 'Surge';
        } else if (normalized >= 0.32) {
            label = 'Pulse';
        }
        return { level, normalized, label };
    }

    getDifficultyLevel() {
        const biased = this.difficultyState.value * (this.difficultyState.bias ?? 1);
        return Math.max(
            this.difficultyState.min,
            Math.min(this.difficultyState.max, biased),
        );
    }

    setDifficulty(level) {
        if (!Number.isFinite(level)) {
            return;
        }
        const clamped = Math.max(this.difficultyState.min, Math.min(this.difficultyState.max, level));
        this.difficultyState.value = clamped;
        this.lastComputedDifficulty = clamped;
    }

    getLastAudioFrame() {
        return this.lastAudioFrame;
    }

    clampDensity(value) {
        const min = this.config.audioSettings?.minDensity ?? 0.1;
        const max = this.config.audioSettings?.maxDensity ?? 8;
        return Math.max(min, Math.min(max, value));
    }
}
