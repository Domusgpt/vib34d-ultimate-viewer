/**
 * AudioGameplayDirector
 * Centralizes beat detection and audio-driven gameplay logic across all visualizer systems.
 * Ensures every geometry, variation, and event is spawned in relation to microphone or track audio input.
 */
export class AudioGameplayDirector {
    constructor(options = {}) {
        this.audioEngine = options.audioEngine || window.audioEngine || null;
        this.statusManager = options.statusManager || window.statusManager || null;
        this.reactivityManager = options.reactivityManager || window.reactivityManager || null;

        this.engines = {
            faceted: null,
            quantum: null,
            holographic: null,
            polychora: null
        };

        this.energyHistory = new Array(options.historySize || 96).fill(0);
        this.energyCursor = 0;
        this.energyTotal = 0;
        this.prevEnergy = 0;
        this.lastBeatTime = 0;
        this.currentBpm = 0;
        this.minBeatInterval = options.minBeatInterval || 180; // milliseconds
        this.beatSensitivity = options.beatSensitivity || 1.6;
        this.silenceCounter = 0;
        this.silenceThreshold = options.silenceFrames || 240;
        this.mode = this.audioEngine?.mode || 'idle';
        this.syntheticTempo = options.syntheticTempo || 110;
        this.nextSyntheticBeat = performance.now();
        this.running = false;
        this.manualTrackUrl = options.trackUrl || null;
        this.bootstrapped = false;
        this.modeSubscription = null;
        this.lastStatusMessage = null;

        this.lastGeometryChange = {
            faceted: 0,
            quantum: 0,
            holographic: 0,
            polychora: 0
        };

        this.geometryDirections = {
            faceted: 1,
            quantum: 1,
            polychora: 1
        };

        this.levelState = {
            faceted: 0.3,
            quantum: 0.4,
            holographic: 0.5,
            polychora: 0.4
        };

        this.fallbackProfiles = this.buildFallbackProfiles();
    }

    attachEngines({ engine, quantumEngine, holographicSystem, polychoraSystem }) {
        if (engine) this.engines.faceted = engine;
        if (quantumEngine) this.engines.quantum = quantumEngine;
        if (holographicSystem) this.engines.holographic = holographicSystem;
        if (polychoraSystem) this.engines.polychora = polychoraSystem;
    }

    start(options = {}) {
        if (this.running) return;
        if (options.audioEngine) {
            this.audioEngine = options.audioEngine;
        }
        if (options.trackUrl) {
            this.manualTrackUrl = options.trackUrl;
        }

        this.running = true;
        this.installModeSubscription();
        this.installInteractionBootstrap();
        this.loop();
    }

    stop() {
        this.running = false;
        if (this.modeSubscription) {
            this.modeSubscription();
            this.modeSubscription = null;
        }
    }

    installModeSubscription() {
        if (!this.audioEngine || typeof this.audioEngine.onModeChange !== 'function' || this.modeSubscription) {
            return;
        }

        this.modeSubscription = this.audioEngine.onModeChange((mode, reason) => {
            this.mode = mode;
            this.silenceCounter = 0;
            if (mode === 'microphone') {
                this.notifyStatus('Microphone audio linked. Reactive gameplay engaged.', 'success');
            } else if (mode === 'track') {
                this.notifyStatus('External track linked. Visualizers following track audio.', 'info');
            } else if (mode === 'fallback') {
                this.notifyStatus('Audio input unavailable – fallback metronome active.', 'warning');
            } else if (mode === 'idle') {
                this.notifyStatus('Audio reactivity paused.', 'info');
            }
        });
    }

    installInteractionBootstrap() {
        if (this.bootstrapped) return;

        const handler = async () => {
            await this.ensureAudioEngineActive();
        };

        window.addEventListener('pointerdown', handler, { once: true });
        window.addEventListener('keydown', handler, { once: true });
        this.bootstrapped = true;
    }

    async ensureAudioEngineActive() {
        if (!this.audioEngine) return;
        if (!this.audioEngine.isActive) {
            const options = this.manualTrackUrl ? { trackUrl: this.manualTrackUrl } : {};
            await this.audioEngine.init(options);
        }
    }

    loop() {
        if (!this.running) return;
        this.update();
        requestAnimationFrame(() => this.loop());
    }

    update() {
        const reactive = window.audioReactive || { bass: 0, mid: 0, high: 0, energy: 0 };
        const rawEnergy = typeof reactive.energy === 'number'
            ? reactive.energy
            : (this.clamp(reactive.bass) + this.clamp(reactive.mid) + this.clamp(reactive.high)) / 3;

        this.energyTotal -= this.energyHistory[this.energyCursor];
        this.energyHistory[this.energyCursor] = rawEnergy;
        this.energyTotal += rawEnergy;
        this.energyCursor = (this.energyCursor + 1) % this.energyHistory.length;

        const average = this.energyTotal / this.energyHistory.length;
        const threshold = Math.max(average * this.beatSensitivity, average + 0.05);
        const now = performance.now();

        const deltaEnergy = rawEnergy - this.prevEnergy;
        const mode = this.audioEngine?.mode || reactive.mode || 'idle';
        const audioEnabled = window.audioEnabled !== false;

        if (mode !== 'fallback' && audioEnabled && rawEnergy > threshold && deltaEnergy > 0.02 && (now - this.lastBeatTime) > this.minBeatInterval) {
            this.registerBeat('audio', {
                energy: this.clamp(rawEnergy),
                bass: this.clamp(reactive.bass),
                mid: this.clamp(reactive.mid),
                high: this.clamp(reactive.high)
            }, now);
            this.silenceCounter = 0;
        } else {
            if (rawEnergy < Math.max(average * 0.6, 0.02) || !audioEnabled) {
                this.silenceCounter += 1;
            } else {
                this.silenceCounter = Math.max(0, this.silenceCounter - 2);
            }
        }

        this.prevEnergy = rawEnergy;

        if (this.silenceCounter > this.silenceThreshold) {
            if (this.audioEngine && typeof this.audioEngine.enableFallback === 'function' && this.audioEngine.mode !== 'fallback') {
                this.audioEngine.enableFallback(this.syntheticTempo);
            }
            this.silenceCounter = this.silenceThreshold;
        }

        if (this.audioEngine?.mode === 'fallback' || mode === 'fallback') {
            const system = this.getCurrentSystem();
            const geometry = this.getActiveGeometryIndex(system);
            const profile = this.getFallbackProfile(system, geometry);
            const tempo = profile?.tempo || this.syntheticTempo;
            const period = 60000 / tempo;
            if (now >= this.nextSyntheticBeat) {
                const syntheticLevels = this.generateSyntheticLevels(profile);
                this.registerBeat('fallback', syntheticLevels, now, profile);
                this.nextSyntheticBeat = now + period;
            }
        } else if (this.currentBpm > 0) {
            this.syntheticTempo = this.currentBpm;
            this.nextSyntheticBeat = now + 60000 / this.syntheticTempo;
        }
    }

    registerBeat(source, levels, now, profile) {
        const delta = now - this.lastBeatTime;
        if (this.lastBeatTime > 0 && delta > 0) {
            const bpm = 60000 / delta;
            this.currentBpm = this.currentBpm ? (this.currentBpm * 0.75 + bpm * 0.25) : bpm;
        }
        this.lastBeatTime = now;

        if (window.audioReactive) {
            window.audioReactive.bpm = Math.round(this.currentBpm || 0);
        }

        const beatData = {
            timestamp: now,
            bpm: this.currentBpm,
            energy: this.clamp(levels.energy),
            bass: this.clamp(levels.bass),
            mid: this.clamp(levels.mid),
            high: this.clamp(levels.high),
            source,
            mode: this.audioEngine?.mode || source,
            profile: profile || null
        };

        this.handleBeat(beatData);
    }

    handleBeat(beatData) {
        const system = this.getCurrentSystem();
        switch (system) {
            case 'quantum':
                this.handleQuantumBeat(beatData);
                break;
            case 'holographic':
                this.handleHolographicBeat(beatData);
                break;
            case 'polychora':
                this.handlePolychoraBeat(beatData);
                break;
            case 'faceted':
            default:
                this.handleFacetedBeat(beatData);
                break;
        }
    }

    handleFacetedBeat(beatData) {
        const geometry = this.getActiveGeometryIndex('faceted');
        const profile = beatData.profile || this.getFallbackProfile('faceted', geometry);
        const now = performance.now();

        const density = this.lerp(profile.densityRange[0], profile.densityRange[1], Math.min(1, beatData.energy + beatData.bass * 0.4));
        const morph = this.lerp(profile.morphRange[0], profile.morphRange[1], Math.min(1, beatData.mid + 0.2));
        const chaos = this.lerp(profile.chaosRange[0], profile.chaosRange[1], Math.min(1, beatData.energy + Math.random() * 0.3));
        const speed = this.lerp(profile.speedRange[0], profile.speedRange[1], Math.min(1, beatData.high + 0.2));
        const hue = this.wrapHue(this.lerp(profile.hueRange[0], profile.hueRange[1], Math.min(1, beatData.bass * 0.5 + beatData.high * 0.5)));
        const intensity = this.clamp(0.4 + beatData.energy * 0.5, 0.3, 1.0);

        this.applyParameter('gridDensity', density);
        this.applyParameter('morphFactor', morph);
        this.applyParameter('chaos', chaos);
        this.applyParameter('speed', speed);
        this.applyParameter('hue', hue);
        this.applyParameter('intensity', intensity);

        this.levelState.faceted = this.levelState.faceted * 0.7 + beatData.energy * 0.3;

        if ((beatData.bass > 0.65 || beatData.energy > 0.75) && (now - this.lastGeometryChange.faceted) > 600) {
            const nextGeometry = this.resolveGeometryFlow('faceted', geometry, profile.geometryFlow, 8);
            this.applyGeometry('faceted', nextGeometry);
            this.lastGeometryChange.faceted = now;
        }
    }

    handleQuantumBeat(beatData) {
        const geometry = this.getActiveGeometryIndex('quantum');
        const profile = beatData.profile || this.getFallbackProfile('quantum', geometry);
        const now = performance.now();

        const density = this.lerp(profile.densityRange[0], profile.densityRange[1], Math.min(1, beatData.energy + beatData.mid * 0.3));
        const morph = this.lerp(profile.morphRange[0], profile.morphRange[1], Math.min(1, beatData.mid + beatData.high * 0.2));
        const chaos = this.lerp(profile.chaosRange[0], profile.chaosRange[1], Math.min(1, beatData.energy + beatData.high));
        const speed = this.lerp(profile.speedRange[0], profile.speedRange[1], Math.min(1, beatData.high + 0.15));
        const hue = this.wrapHue(this.lerp(profile.hueRange[0], profile.hueRange[1], Math.min(1, beatData.bass * 0.4 + beatData.high * 0.6)));

        this.applyParameter('gridDensity', density);
        this.applyParameter('morphFactor', morph);
        this.applyParameter('chaos', chaos);
        this.applyParameter('speed', speed);
        this.applyParameter('hue', hue);

        this.levelState.quantum = this.levelState.quantum * 0.65 + beatData.energy * 0.35;

        if ((beatData.high > 0.6 || beatData.energy > 0.8) && (now - this.lastGeometryChange.quantum) > 800) {
            const nextGeometry = this.resolveGeometryFlow('quantum', geometry, profile.geometryFlow, 8);
            this.applyGeometry('quantum', nextGeometry);
            this.lastGeometryChange.quantum = now;
        }
    }

    handleHolographicBeat(beatData) {
        const geometry = this.getActiveGeometryIndex('holographic');
        const profile = beatData.profile || this.getFallbackProfile('holographic', geometry);
        const now = performance.now();

        const baseVariant = geometry * profile.variantSpread;
        const variantOffset = Math.floor(this.clamp(beatData.bass * 0.6 + beatData.mid * 0.6, 0, 1) * profile.variantSpread) % profile.variantSpread;
        const variant = this.clamp(baseVariant + variantOffset, 0, this.getHolographicVariantCount() - 1);

        this.setHolographicVariant(variant);

        const intensity = this.lerp(profile.intensityRange[0], profile.intensityRange[1], Math.min(1, beatData.energy + beatData.bass * 0.3));
        const saturation = this.lerp(profile.saturationRange[0], profile.saturationRange[1], Math.min(1, beatData.mid + 0.1));
        const chaos = this.lerp(profile.chaosRange[0], profile.chaosRange[1], Math.min(1, beatData.energy + beatData.high * 0.4));
        const speed = this.lerp(profile.speedRange[0], profile.speedRange[1], Math.min(1, beatData.high + 0.15));
        const hue = this.wrapHue(this.lerp(profile.colorShift[0], profile.colorShift[1], Math.min(1, beatData.bass * 0.5 + beatData.high * 0.5)));

        this.applyParameter('intensity', intensity);
        this.applyParameter('saturation', saturation);
        this.applyParameter('chaos', chaos);
        this.applyParameter('speed', speed);
        this.applyParameter('hue', hue);

        this.levelState.holographic = this.levelState.holographic * 0.7 + beatData.energy * 0.3;

        if ((beatData.energy > 0.82 || beatData.high > 0.7) && (now - this.lastGeometryChange.holographic) > 900) {
            const randomVariant = this.clamp(baseVariant + Math.floor(Math.random() * profile.variantSpread), 0, this.getHolographicVariantCount() - 1);
            this.setHolographicVariant(randomVariant);
            this.lastGeometryChange.holographic = now;
        }
    }

    handlePolychoraBeat(beatData) {
        const geometry = this.getActiveGeometryIndex('polychora');
        const profile = beatData.profile || this.getFallbackProfile('polychora', geometry);
        const now = performance.now();

        const rotation = this.lerp(profile.rotationRange[0], profile.rotationRange[1], Math.min(1, beatData.bass + beatData.mid * 0.5));
        const morph = this.lerp(profile.morphRange[0], profile.morphRange[1], Math.min(1, beatData.mid + 0.2));
        const dimension = this.lerp(profile.dimensionRange[0], profile.dimensionRange[1], Math.min(1, beatData.energy + 0.2));
        const hue = this.wrapHue(this.lerp(profile.hueRange[0], profile.hueRange[1], Math.min(1, beatData.high + beatData.mid * 0.3)));

        this.applyParameter('rot4dXW', rotation);
        this.applyParameter('rot4dYW', rotation * 0.85);
        this.applyParameter('rot4dZW', rotation * 0.7);
        this.applyParameter('morphFactor', morph);
        this.applyParameter('dimension', dimension);
        this.applyParameter('hue', hue);

        this.levelState.polychora = this.levelState.polychora * 0.65 + beatData.energy * 0.35;

        if ((beatData.energy > 0.75 || beatData.bass > 0.7) && (now - this.lastGeometryChange.polychora) > 1200) {
            const nextGeometry = this.resolveGeometryFlow('polychora', geometry, profile.geometryFlow, 6);
            this.applyGeometry('polychora', nextGeometry);
            this.lastGeometryChange.polychora = now;
        }
    }

    async useTrack(trackUrl, options = {}) {
        this.manualTrackUrl = trackUrl;
        if (this.audioEngine && typeof this.audioEngine.useTrack === 'function') {
            return this.audioEngine.useTrack(trackUrl, options);
        }
        return false;
    }

    applyParameter(param, value) {
        const numericValue = typeof value === 'number' ? value : parseFloat(value);
        if (typeof window.updateParameter === 'function') {
            window.updateParameter(param, numericValue);
            return;
        }

        const system = this.getCurrentSystem();
        const engine = this.engines[system];
        if (engine?.updateParameter) {
            engine.updateParameter(param, numericValue);
        } else if (engine?.parameters?.setParameter) {
            engine.parameters.setParameter(param, numericValue);
        }
    }

    applyGeometry(system, index) {
        const clampedIndex = system === 'polychora'
            ? Math.max(0, Math.min(5, Math.round(index)))
            : Math.max(0, Math.min(7, Math.round(index)));

        if (system === 'faceted') {
            if (typeof window.selectGeometry === 'function') {
                window.selectGeometry(clampedIndex);
            } else {
                this.applyParameter('geometry', clampedIndex);
            }
        } else if (system === 'quantum') {
            this.applyParameter('geometry', clampedIndex);
        } else if (system === 'polychora') {
            this.applyParameter('geometry', clampedIndex);
        }
    }

    setHolographicVariant(variant) {
        const system = this.engines.holographic;
        if (!system) return;
        if (typeof system.updateVariant === 'function') {
            system.updateVariant(variant);
        } else if (typeof system.setVariant === 'function') {
            system.setVariant(variant);
        }
    }

    getCurrentSystem() {
        return window.currentSystem || 'faceted';
    }

    getActiveGeometryIndex(system) {
        if (system === 'holographic') {
            const holo = this.engines.holographic;
            if (holo?.currentVariant !== undefined) {
                return Math.floor(holo.currentVariant / 4);
            }
            return 0;
        }

        if (system === 'polychora') {
            const poly = this.engines.polychora;
            if (poly?.parameters?.getParameter) {
                return Math.round(poly.parameters.getParameter('geometry') || 0);
            }
            return Math.round(window.userParameterState?.geometry || 0);
        }

        if (system === 'quantum') {
            const quantum = this.engines.quantum;
            if (quantum?.parameters?.getParameter) {
                return Math.round(quantum.parameters.getParameter('geometry') || 0);
            }
        }

        const stored = window.userParameterState?.geometry;
        if (typeof stored === 'number') {
            return Math.round(stored);
        }

        const engine = this.engines[system];
        if (engine?.parameterManager?.getParameter) {
            return Math.round(engine.parameterManager.getParameter('geometry') || 0);
        }

        return 0;
    }

    getFallbackProfile(system, geometryIndex = 0) {
        const profiles = this.fallbackProfiles[system];
        if (!profiles || profiles.length === 0) return null;
        const index = Math.max(0, Math.min(profiles.length - 1, Math.round(geometryIndex)));
        return profiles[index];
    }

    getHolographicVariantCount() {
        return this.engines.holographic?.totalVariants || 30;
    }

    resolveGeometryFlow(system, current, mode, total) {
        const geometryCount = total || 8;
        const normalized = Math.max(0, Math.min(geometryCount - 1, Math.round(current)));
        const flow = mode || 'forward';

        if (flow === 'shuffle') {
            let next = normalized;
            while (next === normalized) {
                next = Math.floor(Math.random() * geometryCount);
            }
            return next;
        }

        if (flow === 'pendulum') {
            const direction = this.geometryDirections[system] || 1;
            let next = normalized + direction;
            if (next >= geometryCount || next < 0) {
                this.geometryDirections[system] = -direction;
                next = normalized - direction;
            }
            return Math.max(0, Math.min(geometryCount - 1, next));
        }

        if (flow === 'burst') {
            const jump = Math.max(1, Math.floor(Math.random() * 3));
            return (normalized + jump) % geometryCount;
        }

        // forward/default
        return (normalized + 1) % geometryCount;
    }

    buildFallbackProfiles() {
        return {
            faceted: [
                { tempo: 92, densityRange: [12, 24], morphRange: [0.25, 0.6], chaosRange: [0.05, 0.22], speedRange: [0.9, 1.4], hueRange: [180, 240], geometryFlow: 'forward' },
                { tempo: 128, densityRange: [16, 34], morphRange: [0.1, 0.45], chaosRange: [0.1, 0.28], speedRange: [1.1, 1.8], hueRange: [220, 280], geometryFlow: 'shuffle' },
                { tempo: 78, densityRange: [10, 20], morphRange: [0.4, 0.85], chaosRange: [0.05, 0.18], speedRange: [0.8, 1.2], hueRange: [150, 210], geometryFlow: 'pendulum' },
                { tempo: 140, densityRange: [18, 36], morphRange: [0.2, 0.55], chaosRange: [0.1, 0.3], speedRange: [1.2, 2.1], hueRange: [260, 320], geometryFlow: 'burst' },
                { tempo: 118, densityRange: [14, 30], morphRange: [0.3, 0.7], chaosRange: [0.08, 0.26], speedRange: [1.0, 1.6], hueRange: [190, 260], geometryFlow: 'forward' },
                { tempo: 104, densityRange: [12, 28], morphRange: [0.35, 0.75], chaosRange: [0.12, 0.32], speedRange: [0.9, 1.5], hueRange: [170, 230], geometryFlow: 'shuffle' },
                { tempo: 132, densityRange: [20, 42], morphRange: [0.25, 0.6], chaosRange: [0.15, 0.38], speedRange: [1.3, 2.4], hueRange: [200, 300], geometryFlow: 'forward' },
                { tempo: 86, densityRange: [10, 22], morphRange: [0.45, 0.9], chaosRange: [0.05, 0.2], speedRange: [0.7, 1.2], hueRange: [140, 200], geometryFlow: 'pendulum' }
            ],
            quantum: [
                { tempo: 110, densityRange: [18, 30], morphRange: [0.9, 1.4], chaosRange: [0.18, 0.35], speedRange: [0.9, 1.6], hueRange: [240, 320], geometryFlow: 'forward' },
                { tempo: 136, densityRange: [22, 36], morphRange: [0.8, 1.3], chaosRange: [0.22, 0.4], speedRange: [1.2, 2.0], hueRange: [200, 280], geometryFlow: 'shuffle' },
                { tempo: 96, densityRange: [16, 28], morphRange: [1.0, 1.6], chaosRange: [0.16, 0.32], speedRange: [0.8, 1.4], hueRange: [220, 300], geometryFlow: 'pendulum' },
                { tempo: 148, densityRange: [24, 42], morphRange: [0.7, 1.2], chaosRange: [0.28, 0.45], speedRange: [1.4, 2.3], hueRange: [260, 340], geometryFlow: 'burst' },
                { tempo: 124, densityRange: [20, 34], morphRange: [0.95, 1.5], chaosRange: [0.2, 0.36], speedRange: [1.0, 1.8], hueRange: [210, 290], geometryFlow: 'forward' },
                { tempo: 102, densityRange: [18, 30], morphRange: [1.1, 1.7], chaosRange: [0.18, 0.34], speedRange: [0.85, 1.5], hueRange: [230, 310], geometryFlow: 'shuffle' },
                { tempo: 140, densityRange: [26, 44], morphRange: [0.9, 1.4], chaosRange: [0.26, 0.48], speedRange: [1.3, 2.4], hueRange: [250, 330], geometryFlow: 'forward' },
                { tempo: 90, densityRange: [16, 26], morphRange: [1.2, 1.8], chaosRange: [0.14, 0.3], speedRange: [0.7, 1.3], hueRange: [200, 280], geometryFlow: 'pendulum' }
            ],
            holographic: [
                { tempo: 96, variantSpread: 4, intensityRange: [0.45, 0.8], saturationRange: [0.6, 0.95], chaosRange: [0.1, 0.25], speedRange: [0.9, 1.4], colorShift: [180, 240], geometryFlow: 'forward' },
                { tempo: 128, variantSpread: 4, intensityRange: [0.5, 0.85], saturationRange: [0.7, 0.98], chaosRange: [0.12, 0.3], speedRange: [1.0, 1.6], colorShift: [220, 280], geometryFlow: 'shuffle' },
                { tempo: 88, variantSpread: 4, intensityRange: [0.55, 0.9], saturationRange: [0.65, 1.0], chaosRange: [0.1, 0.28], speedRange: [0.8, 1.3], colorShift: [160, 220], geometryFlow: 'pendulum' },
                { tempo: 144, variantSpread: 4, intensityRange: [0.5, 0.88], saturationRange: [0.7, 1.0], chaosRange: [0.18, 0.36], speedRange: [1.2, 2.0], colorShift: [240, 320], geometryFlow: 'burst' },
                { tempo: 118, variantSpread: 4, intensityRange: [0.48, 0.86], saturationRange: [0.68, 0.96], chaosRange: [0.15, 0.32], speedRange: [0.95, 1.6], colorShift: [200, 280], geometryFlow: 'forward' },
                { tempo: 106, variantSpread: 3, intensityRange: [0.52, 0.88], saturationRange: [0.7, 1.0], chaosRange: [0.12, 0.3], speedRange: [0.85, 1.5], colorShift: [190, 270], geometryFlow: 'shuffle' },
                { tempo: 134, variantSpread: 3, intensityRange: [0.55, 0.9], saturationRange: [0.72, 1.0], chaosRange: [0.18, 0.34], speedRange: [1.1, 1.9], colorShift: [220, 300], geometryFlow: 'forward' },
                { tempo: 92, variantSpread: 3, intensityRange: [0.5, 0.85], saturationRange: [0.65, 0.96], chaosRange: [0.1, 0.26], speedRange: [0.8, 1.35], colorShift: [170, 250], geometryFlow: 'pendulum' }
            ],
            polychora: [
                { tempo: 88, rotationRange: [0.4, 0.9], morphRange: [0.3, 0.6], dimensionRange: [3.2, 3.8], hueRange: [260, 320], geometryFlow: 'forward' },
                { tempo: 120, rotationRange: [0.5, 1.1], morphRange: [0.25, 0.55], dimensionRange: [3.1, 3.9], hueRange: [240, 300], geometryFlow: 'shuffle' },
                { tempo: 102, rotationRange: [0.45, 0.95], morphRange: [0.35, 0.65], dimensionRange: [3.3, 3.95], hueRange: [250, 310], geometryFlow: 'pendulum' },
                { tempo: 138, rotationRange: [0.55, 1.2], morphRange: [0.3, 0.6], dimensionRange: [3.4, 4.0], hueRange: [270, 330], geometryFlow: 'burst' },
                { tempo: 112, rotationRange: [0.5, 1.05], morphRange: [0.32, 0.62], dimensionRange: [3.25, 3.9], hueRange: [255, 315], geometryFlow: 'forward' },
                { tempo: 98, rotationRange: [0.42, 0.9], morphRange: [0.28, 0.58], dimensionRange: [3.2, 3.85], hueRange: [245, 305], geometryFlow: 'pendulum' }
            ]
        };
    }

    generateSyntheticLevels(profile) {
        const tempo = profile?.tempo || this.syntheticTempo;
        const t = (performance.now() / 1000) * tempo / 60;
        const phase = t % 1;
        const bass = Math.max(0, Math.sin(Math.PI * phase));
        const mid = Math.max(0, Math.sin(Math.PI * ((phase + 0.35) % 1)));
        const high = Math.max(0, Math.sin(Math.PI * ((phase + 0.67) % 1)));
        const energy = (bass + mid + high) / 3;

        return {
            bass: this.clamp(bass + Math.random() * 0.1),
            mid: this.clamp(mid + Math.random() * 0.08),
            high: this.clamp(high + Math.random() * 0.05),
            energy: this.clamp(energy + Math.random() * 0.05)
        };
    }

    notifyStatus(message, level = 'info') {
        if (!this.statusManager || !message || this.lastStatusMessage === message) return;
        try {
            this.statusManager.setStatus(message, level);
            this.lastStatusMessage = message;
        } catch (error) {
            console.warn('Status update failed:', error);
        }
    }

    lerp(a, b, t) {
        return a + (b - a) * this.clamp(t, 0, 1);
    }

    clamp(value, min = 0, max = 1) {
        if (Number.isNaN(value)) return min;
        return Math.min(max, Math.max(min, value));
    }

    wrapHue(value) {
        if (Number.isNaN(value)) return 0;
        let hue = value % 360;
        if (hue < 0) hue += 360;
        return hue;
    }
}

export default AudioGameplayDirector;
