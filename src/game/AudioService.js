const DEFAULT_GEOMETRY = 'TETRA';
const HISTORY_SIZE = 64;
const MIN_MIC_INTERVAL = 0.2;
const MAX_MIC_INTERVAL = 1.8;

const SYSTEM_FALLBACK_MODIFIERS = {
    faceted: { bass: 1, mid: 1, high: 1, bpmOffset: 0 },
    quantum: { bass: 0.85, mid: 1.1, high: 1.25, bpmOffset: 12 },
    holographic: { bass: 0.9, mid: 1.05, high: 1.4, bpmOffset: 6 }
};

const GEOMETRY_FALLBACKS = {
    TETRA: { bpm: 122, pattern: [
        { bass: 0.82, mid: 0.42, high: 0.28, energy: 0.68 },
        { bass: 0.38, mid: 0.32, high: 0.22, energy: 0.42 },
        { bass: 0.74, mid: 0.48, high: 0.36, energy: 0.64 },
        { bass: 0.46, mid: 0.54, high: 0.42, energy: 0.58 }
    ] },
    CUBE: { bpm: 108, pattern: [
        { bass: 0.66, mid: 0.58, high: 0.34, energy: 0.56 },
        { bass: 0.48, mid: 0.44, high: 0.28, energy: 0.44 },
        { bass: 0.7, mid: 0.62, high: 0.36, energy: 0.6 },
        { bass: 0.42, mid: 0.52, high: 0.26, energy: 0.46 }
    ] },
    SPHERE: { bpm: 116, pattern: [
        { bass: 0.58, mid: 0.46, high: 0.52, energy: 0.52 },
        { bass: 0.36, mid: 0.4, high: 0.34, energy: 0.38 },
        { bass: 0.64, mid: 0.54, high: 0.58, energy: 0.6 },
        { bass: 0.32, mid: 0.38, high: 0.4, energy: 0.38 }
    ] },
    TORUS: { bpm: 128, pattern: [
        { bass: 0.9, mid: 0.46, high: 0.38, energy: 0.66 },
        { bass: 0.5, mid: 0.44, high: 0.28, energy: 0.48 },
        { bass: 0.84, mid: 0.52, high: 0.34, energy: 0.64 },
        { bass: 0.46, mid: 0.4, high: 0.32, energy: 0.46 }
    ] },
    KLEIN: { bpm: 112, pattern: [
        { bass: 0.6, mid: 0.58, high: 0.48, energy: 0.56 },
        { bass: 0.32, mid: 0.5, high: 0.44, energy: 0.44 },
        { bass: 0.68, mid: 0.6, high: 0.56, energy: 0.6 },
        { bass: 0.38, mid: 0.46, high: 0.42, energy: 0.44 }
    ] },
    FRACTAL: { bpm: 132, pattern: [
        { bass: 0.72, mid: 0.64, high: 0.68, energy: 0.68 },
        { bass: 0.4, mid: 0.46, high: 0.52, energy: 0.46 },
        { bass: 0.76, mid: 0.68, high: 0.72, energy: 0.72 },
        { bass: 0.48, mid: 0.5, high: 0.56, energy: 0.5 }
    ] },
    WAVE: { bpm: 124, pattern: [
        { bass: 0.62, mid: 0.54, high: 0.72, energy: 0.64 },
        { bass: 0.36, mid: 0.44, high: 0.46, energy: 0.42 },
        { bass: 0.7, mid: 0.58, high: 0.78, energy: 0.68 },
        { bass: 0.34, mid: 0.46, high: 0.52, energy: 0.44 }
    ] },
    CRYSTAL: { bpm: 118, pattern: [
        { bass: 0.8, mid: 0.48, high: 0.62, energy: 0.66 },
        { bass: 0.42, mid: 0.38, high: 0.5, energy: 0.44 },
        { bass: 0.86, mid: 0.5, high: 0.7, energy: 0.72 },
        { bass: 0.36, mid: 0.34, high: 0.48, energy: 0.4 }
    ] }
};

/**
 * Audio playback + beat clock with analyser-driven reactivity.
 */
export class AudioService {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.analyser = null;
        this.source = null;
        this.trackBuffer = null;
        this.trackConfig = null;
        this.isPlaying = false;
        this.useMetronome = false;
        this.metronomeOscillator = null;
        this.useMicrophone = false;
        this.microphoneStream = null;
        this.microphoneSource = null;
        this.beatInterval = 0.5; // default 120 BPM
        this.beatAccumulator = 0;
        this.beatListeners = new Set();
        this.measureListeners = new Set();
        this.frequencyBins = null;
        this.timeDomainBuffer = null;
        this.measureBeats = 4;
        this.beatIndex = 0;
        this.startTime = 0;
        this.reactiveState = { bass: 0, mid: 0, high: 0, energy: 0, delta: 0, trend: 0, silence: 0, origin: 'idle' };
        this.prevEnergy = 0;
        this.energyTrend = 0;
        this.silenceTimer = 0;
        this.energyHistory = [];
        this.lastBeatTime = 0;
        this.fallbackActive = false;
        this.fallbackTimer = 0;
        this.fallbackPatternIndex = 0;
        this.geometryContext = { system: 'faceted', geometry: DEFAULT_GEOMETRY };
        this.geometryFallback = buildGeometryFallback(DEFAULT_GEOMETRY, 'faceted');
    }

    async init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 1;
            this.masterGain.connect(this.audioContext.destination);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.7;
            this.frequencyBins = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeDomainBuffer = new Float32Array(this.analyser.fftSize);
        }
        return this.audioContext;
    }

    async loadTrack(trackConfig = {}) {
        await this.init();
        this.trackConfig = trackConfig || {};
        const bpm = trackConfig?.bpm || 120;
        this.setBPM(bpm);
        this.trackBuffer = null;
        this.useMetronome = false;
        if (!trackConfig?.url) {
            return false;
        }

        try {
            const response = await fetch(trackConfig.url);
            const arrayBuffer = await response.arrayBuffer();
            this.trackBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.useMetronome = false;
            return true;
        } catch (err) {
            console.warn('AudioService: Failed to load track, will fall back to microphone', err);
            this.trackBuffer = null;
            return false;
        }
    }

    setGeometryContext(system, geometry) {
        const normalizedGeometry = geometry || DEFAULT_GEOMETRY;
        const normalizedSystem = system || 'faceted';
        this.geometryContext = { system: normalizedSystem, geometry: normalizedGeometry };
        this.geometryFallback = buildGeometryFallback(normalizedGeometry, normalizedSystem);
        if (!this.useMicrophone && !this.trackBuffer) {
            this.activateFallback(true);
        }
    }

    setBPM(bpm) {
        if (bpm) {
            this.beatInterval = 60 / bpm;
        }
    }

    async start() {
        await this.init();
        await this.audioContext.resume();
        this.stop();

        this.beatIndex = 0;
        this.beatAccumulator = 0;
        this.lastBeatTime = 0;
        this.energyHistory.length = 0;
        this.fallbackTimer = 0;
        this.fallbackPatternIndex = 0;
        this.fallbackActive = false;

        let started = false;
        if (this.trackBuffer) {
            this.startTrack();
            started = true;
        } else if (this.trackConfig?.mode === 'microphone' || !this.trackConfig?.url) {
            started = await this.startMicrophone();
            if (!started) {
                this.activateFallback(true);
            }
        } else if (this.useMetronome) {
            this.startMetronome();
            started = true;
        } else {
            this.activateFallback(true);
        }

        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime;
        window.audioEnabled = started || this.fallbackActive;
        return started || this.fallbackActive;
    }

    startTrack() {
        this.useMicrophone = false;
        this.masterGain.gain.value = this.trackConfig?.volume ?? 1;
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.trackBuffer;
        this.source.loop = true;
        this.source.connect(this.analyser);
        this.analyser.connect(this.masterGain);
        this.source.start();
    }

    async startMicrophone() {
        this.stopMicrophone();
        this.useMicrophone = true;
        if (!navigator?.mediaDevices?.getUserMedia) {
            console.warn('AudioService: mediaDevices.getUserMedia is not available.');
            this.useMicrophone = false;
            return false;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            this.microphoneStream = stream;
            this.microphoneSource = this.audioContext.createMediaStreamSource(stream);
            this.microphoneSource.connect(this.analyser);
            this.analyser.disconnect();
            this.masterGain.gain.value = 0;
            this.fallbackActive = false;
            this.energyHistory.length = 0;
            this.lastBeatTime = 0;
            this.analyser.connect(this.masterGain);
            return true;
        } catch (err) {
            console.warn('AudioService: Microphone access was denied.', err);
            this.useMicrophone = false;
            return false;
        }
    }

    activateFallback(resetPhase = false) {
        this.useMicrophone = false;
        this.useMetronome = false;
        if (resetPhase) {
            this.fallbackTimer = 0;
            this.fallbackPatternIndex = 0;
        }
        this.fallbackActive = true;
        this.masterGain.gain.value = 0;
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser.connect(this.masterGain);
        }
        this.reactiveState.origin = 'geometry-fallback';
    }

    startMetronome() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(this.analyser);
        this.analyser.connect(this.masterGain);
        osc.start();
        this.metronomeOscillator = { osc, gain };
        this.reactiveState.origin = 'metronome';
    }

    stopMicrophone() {
        if (this.microphoneSource) {
            try { this.microphoneSource.disconnect(); } catch (_) { /* ignore */ }
            this.microphoneSource = null;
        }
        if (this.microphoneStream) {
            this.microphoneStream.getAudioTracks().forEach((track) => track.stop());
            this.microphoneStream = null;
        }
    }

    stop() {
        if (this.source) {
            try { this.source.stop(); } catch (_) { /* ignore */ }
            try { this.source.disconnect(); } catch (_) { /* ignore */ }
            this.source = null;
        }
        if (this.metronomeOscillator) {
            try { this.metronomeOscillator.osc.stop(); } catch (_) {}
            try { this.metronomeOscillator.osc.disconnect(); } catch (_) {}
            try { this.metronomeOscillator.gain.disconnect(); } catch (_) {}
            this.metronomeOscillator = null;
        }
        this.stopMicrophone();
        this.isPlaying = false;
        window.audioEnabled = false;
    }

    onBeat(callback) {
        this.beatListeners.add(callback);
        return () => this.beatListeners.delete(callback);
    }

    onMeasure(callback) {
        this.measureListeners.add(callback);
        return () => this.measureListeners.delete(callback);
    }

    getReactiveState() {
        return this.reactiveState;
    }

    isMicrophoneActive() {
        return !!this.useMicrophone;
    }

    isFallbackActive() {
        return !!this.fallbackActive;
    }

    hasTrackLoaded() {
        return !!this.trackBuffer;
    }

    update(dt) {
        if (!this.isPlaying) return;

        this.sampleAnalyser(dt);

        if (this.useMicrophone) {
            this.processMicrophone(dt);
        } else if (this.fallbackActive) {
            this.processFallback(dt);
        } else {
            this.processTrack(dt);
        }
    }

    processTrack(dt) {
        this.beatAccumulator += dt * (this.trackConfig?.playbackRate || 1);
        while (this.beatAccumulator >= this.beatInterval) {
            this.beatAccumulator -= this.beatInterval;
            this.emitBeat(this.trackBuffer ? 'track' : 'metronome');
            if (this.metronomeOscillator) {
                this.metronomeOscillator.gain.gain.cancelScheduledValues(0);
                this.metronomeOscillator.gain.gain.setValueAtTime(0.25, this.audioContext.currentTime);
                this.metronomeOscillator.gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
            }
        }
    }

    processMicrophone(dt) {
        const energy = this.reactiveState.energy ?? 0;
        this.energyHistory.push(energy);
        if (this.energyHistory.length > HISTORY_SIZE) {
            this.energyHistory.shift();
        }

        const avg = average(this.energyHistory);
        const variance = average(this.energyHistory.map((value) => (value - avg) ** 2));
        const std = Math.sqrt(Math.max(variance, 0));
        const threshold = avg + std * 0.9 + 0.02;
        const now = this.audioContext?.currentTime || performance.now() / 1000;

        if (energy > threshold && now - this.lastBeatTime > MIN_MIC_INTERVAL) {
            const interval = this.lastBeatTime > 0 ? now - this.lastBeatTime : this.beatInterval;
            if (interval >= MIN_MIC_INTERVAL && interval <= MAX_MIC_INTERVAL) {
                this.beatInterval = this.beatInterval * 0.7 + interval * 0.3;
            }
            this.lastBeatTime = now;
            this.fallbackActive = false;
            this.emitBeat('microphone');
        } else if (this.silenceTimer > 1.2) {
            this.activateFallback(false);
            this.processFallback(dt);
        }
    }

    processFallback(dt) {
        const fallback = this.geometryFallback;
        if (!fallback || !fallback.pattern?.length) {
            this.processTrack(dt);
            return;
        }
        const bpm = fallback.bpm;
        const interval = 60 / bpm;
        this.beatInterval = interval;
        this.fallbackTimer += dt;
        const stepChanged = this.fallbackTimer >= interval;
        if (stepChanged) {
            this.fallbackTimer -= interval;
            this.fallbackPatternIndex = (this.fallbackPatternIndex + 1) % fallback.pattern.length;
            this.emitBeat('geometry-fallback');
        }
        const pattern = fallback.pattern[this.fallbackPatternIndex];
        if (pattern) {
            const scaled = scalePattern(pattern, this.geometryContext.system);
            const energy = scaled.energy;
            const delta = energy - this.prevEnergy;
            this.energyTrend = this.energyTrend * 0.75 + delta * 0.25;
            this.prevEnergy = energy;
            this.silenceTimer = 0;
            this.reactiveState = {
                bass: scaled.bass,
                mid: scaled.mid,
                high: scaled.high,
                energy,
                delta,
                trend: this.energyTrend,
                silence: 0,
                origin: 'geometry-fallback'
            };
            window.audioReactive = {
                bass: scaled.bass,
                mid: scaled.mid,
                high: scaled.high,
                energy
            };
        }
    }

    emitBeat(origin) {
        this.beatIndex += 1;
        const beatInfo = {
            time: this.audioContext?.currentTime || performance.now() / 1000,
            beat: this.beatIndex,
            interval: this.beatInterval,
            reactive: this.reactiveState,
            origin: origin || this.reactiveState.origin || 'track'
        };
        this.reactiveState.origin = beatInfo.origin;
        this.beatListeners.forEach((cb) => cb(beatInfo));
        if (this.beatIndex % this.measureBeats === 0) {
            this.measureListeners.forEach((cb) => cb({
                measure: this.beatIndex / this.measureBeats,
                beatInfo
            }));
        }
    }

    sampleAnalyser(dt) {
        if (!this.analyser || !this.frequencyBins) {
            return;
        }
        try {
            this.analyser.getByteFrequencyData(this.frequencyBins);
        } catch (err) {
            return;
        }
        const bass = averageRange(this.frequencyBins, 0, 24);
        const mid = averageRange(this.frequencyBins, 24, 96);
        const high = averageRange(this.frequencyBins, 96, 256);
        const energy = (bass + mid + high) / 3;
        const delta = energy - this.prevEnergy;
        this.energyTrend = this.energyTrend * 0.82 + delta * 0.18;
        this.prevEnergy = energy;
        if (energy < 0.05) {
            this.silenceTimer += dt;
        } else {
            this.silenceTimer = Math.max(0, this.silenceTimer - dt * 0.75);
        }
        this.reactiveState = {
            bass,
            mid,
            high,
            energy,
            delta,
            trend: this.energyTrend,
            silence: this.silenceTimer,
            origin: this.reactiveState.origin
        };
        window.audioReactive = {
            bass,
            mid,
            high,
            energy
        };
    }
}

function averageRange(array, start, end) {
    let sum = 0;
    let count = 0;
    const clampedEnd = Math.min(array.length, end);
    for (let i = start; i < clampedEnd; i++) {
        sum += array[i] / 255;
        count += 1;
    }
    return count ? sum / count : 0;
}

function average(values) {
    if (!values.length) return 0;
    const total = values.reduce((acc, value) => acc + value, 0);
    return total / values.length;
}

function buildGeometryFallback(geometry, system) {
    const base = GEOMETRY_FALLBACKS[geometry] || GEOMETRY_FALLBACKS[DEFAULT_GEOMETRY];
    if (!base) return null;
    const modifier = SYSTEM_FALLBACK_MODIFIERS[system] || SYSTEM_FALLBACK_MODIFIERS.faceted;
    return {
        bpm: Math.max(60, base.bpm + (modifier.bpmOffset || 0)),
        pattern: base.pattern.map((step) => scalePattern(step, system))
    };
}

function scalePattern(step, system) {
    const modifier = SYSTEM_FALLBACK_MODIFIERS[system] || SYSTEM_FALLBACK_MODIFIERS.faceted;
    return {
        bass: clamp01(step.bass * modifier.bass),
        mid: clamp01(step.mid * modifier.mid),
        high: clamp01(step.high * modifier.high),
        energy: clamp01(step.energy * (modifier.mid + modifier.high) / 2)
    };
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
