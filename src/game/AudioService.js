const DEFAULT_SENSITIVITY = 1.35;
const DEFAULT_HISTORY = 43;
const DEFAULT_MIN_INTERVAL = 0.28; // seconds between beat detections
const DEFAULT_FLUX_HISTORY = 32;
const DEFAULT_FLUX_THRESHOLD_MULTIPLIER = 1.55;
const DEFAULT_FLUX_MIN_INTERVAL = 0.18;
const DEFAULT_SILENCE_THRESHOLD = 0.012;
const DEFAULT_SILENCE_HOLD_MS = 6500;
const DEFAULT_ANALYSIS_SMOOTHING = 0.82;

/**
 * Basic beat detector using running energy envelope and adaptive thresholding.
 * Keeps a rolling history of signal energy to estimate average energy and
 * variance, providing a confidence level for detected peaks. BPM is inferred
 * from inter-beat intervals and smoothed over time.
 */
class BeatDetector {
    constructor({
        historySize = DEFAULT_HISTORY,
        sensitivity = DEFAULT_SENSITIVITY,
        minBeatInterval = DEFAULT_MIN_INTERVAL
    } = {}) {
        this.historySize = historySize;
        this.sensitivity = sensitivity;
        this.minBeatInterval = minBeatInterval;

        this.energyHistory = [];
        this.lastBeatTime = 0;
        this.currentBpm = 0;
        this.lastEnergy = 0;
    }

    reset() {
        this.energyHistory.length = 0;
        this.lastBeatTime = 0;
        this.currentBpm = 0;
        this.lastEnergy = 0;
    }

    process(timeDomainData, sampleRate, timestamp = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
        const len = timeDomainData?.length || 0;
        if (!len) {
            return {
                energy: 0,
                isBeat: false,
                bpm: this.currentBpm,
                confidence: 0,
                threshold: 0
            };
        }

        let sumSquares = 0;
        for (let i = 0; i < len; i++) {
            const sample = timeDomainData[i] || 0;
            sumSquares += sample * sample;
        }

        const energy = Math.sqrt(sumSquares / len);
        this.energyHistory.push(energy);
        if (this.energyHistory.length > this.historySize) {
            this.energyHistory.shift();
        }

        const historyLength = this.energyHistory.length;
        const averageEnergy = this.energyHistory.reduce((acc, value) => acc + value, 0) / (historyLength || 1);
        let variance = 0;
        for (let i = 0; i < historyLength; i++) {
            const diff = this.energyHistory[i] - averageEnergy;
            variance += diff * diff;
        }
        variance = variance / (historyLength || 1);

        // Adaptive threshold factoring in variance. The variance multiplier keeps
        // the detector responsive when the audio becomes quieter.
        const adaptiveThreshold = averageEnergy + Math.sqrt(variance) * this.sensitivity;
        const elapsedSinceBeat = timestamp - this.lastBeatTime;
        const minIntervalMs = this.minBeatInterval * 1000;
        const isBeat = energy > adaptiveThreshold && elapsedSinceBeat > minIntervalMs;

        let bpm = this.currentBpm;
        let confidence = 0;

        if (isBeat) {
            if (this.lastBeatTime) {
                const seconds = elapsedSinceBeat / 1000;
                if (seconds > 0) {
                    const instantBpm = 60 / seconds;
                    if (this.currentBpm) {
                        // Smooth BPM estimation to avoid wild swings.
                        this.currentBpm = this.currentBpm * 0.82 + instantBpm * 0.18;
                    } else {
                        this.currentBpm = instantBpm;
                    }
                    bpm = this.currentBpm;
                }
            }

            confidence = adaptiveThreshold > 0 ? Math.min(1, (energy / adaptiveThreshold) - 1) : 0.5;
            this.lastBeatTime = timestamp;
        } else {
            // Light decay when no beat is detected so we don't cling to stale BPM.
            if (this.currentBpm) {
                this.currentBpm *= 0.999;
                if (this.currentBpm < 20) {
                    this.currentBpm = 0;
                }
            }
            confidence = adaptiveThreshold > 0 ? Math.max(0, (energy / adaptiveThreshold) - 0.75) : 0;
        }

        this.lastEnergy = energy;

        return {
            energy,
            isBeat,
            bpm,
            confidence: Math.max(0, Math.min(1, confidence)),
            threshold: adaptiveThreshold
        };
    }
}

class SpectralFluxDetector {
    constructor({
        historySize = DEFAULT_FLUX_HISTORY,
        thresholdMultiplier = DEFAULT_FLUX_THRESHOLD_MULTIPLIER,
        minOnsetInterval = DEFAULT_FLUX_MIN_INTERVAL,
        smoothing = 0.6
    } = {}) {
        this.historySize = historySize;
        this.thresholdMultiplier = thresholdMultiplier;
        this.minOnsetInterval = minOnsetInterval;
        this.smoothing = smoothing;

        this.lastSpectrum = null;
        this.history = [];
        this.smoothedFlux = 0;
        this.lastOnsetTime = 0;
    }

    reset() {
        this.lastSpectrum = null;
        this.history.length = 0;
        this.smoothedFlux = 0;
        this.lastOnsetTime = 0;
    }

    process(spectrum, timestamp = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
        const length = spectrum?.length || 0;
        if (!length) {
            return {
                flux: 0,
                smoothedFlux: this.smoothedFlux,
                threshold: 0,
                isOnset: false,
                confidence: 0
            };
        }

        if (!this.lastSpectrum || this.lastSpectrum.length !== length) {
            this.lastSpectrum = new Float32Array(length);
            this.lastSpectrum.fill(0);
        }

        let flux = 0;
        for (let i = 0; i < length; i++) {
            const current = (spectrum[i] || 0) / 255;
            const previous = this.lastSpectrum[i] || 0;
            const delta = current - previous;
            if (delta > 0) {
                flux += delta;
            }
            this.lastSpectrum[i] = current;
        }
        flux = flux / length;

        this.history.push(flux);
        if (this.history.length > this.historySize) {
            this.history.shift();
        }

        const historyLength = this.history.length;
        const average = this.history.reduce((acc, value) => acc + value, 0) / (historyLength || 1);
        let variance = 0;
        for (let i = 0; i < historyLength; i++) {
            const diff = this.history[i] - average;
            variance += diff * diff;
        }
        variance = variance / (historyLength || 1);

        const threshold = average + Math.sqrt(variance) * this.thresholdMultiplier;
        this.smoothedFlux = this.smoothedFlux * this.smoothing + flux * (1 - this.smoothing);

        const elapsed = timestamp - this.lastOnsetTime;
        const onset = flux > threshold && elapsed > this.minOnsetInterval * 1000;
        let confidence = 0;

        if (onset) {
            this.lastOnsetTime = timestamp;
            const ratio = threshold > 0 ? flux / threshold : flux;
            confidence = Math.max(0, Math.min(1, 0.5 + (ratio - 1) * 0.65));
        } else {
            const ratio = threshold > 0 ? flux / threshold : flux;
            confidence = Math.max(0, Math.min(1, (ratio - 1) * 0.45));
        }

        return {
            flux,
            smoothedFlux: this.smoothedFlux,
            threshold,
            isOnset: onset,
            confidence
        };
    }
}

function buildDefaultMetronomeSignatures() {
    return [
        {
            id: 'tetra-resonance',
            label: 'Tetrahedron Resonance',
            bpm: 98,
            geometryHint: 0,
            bandLevels: { bass: 0.34, mid: 0.52, treble: 0.72 },
            energyCurve: [0.32, 0.42, 0.5, 0.64],
            defaultLevels: [0, 1, 2, 3],
            paletteHue: 28,
            mood: 'geometric cascade'
        },
        {
            id: 'hypercube-velocity',
            label: 'Hypercube Velocity',
            bpm: 124,
            geometryHint: 1,
            bandLevels: { bass: 0.28, mid: 0.68, treble: 0.46 },
            energyCurve: [0.26, 0.4, 0.58, 0.52],
            defaultLevels: [0, 2, 1, 3],
            paletteHue: 212,
            mood: 'vector bloom'
        },
        {
            id: 'sphere-lumina',
            label: 'Sphere Lumina',
            bpm: 112,
            geometryHint: 2,
            bandLevels: { bass: 0.22, mid: 0.46, treble: 0.74 },
            energyCurve: [0.3, 0.36, 0.48, 0.6],
            defaultLevels: [1, 0, 2, 3],
            paletteHue: 180,
            mood: 'harmonic bloom'
        },
        {
            id: 'torus-orbit',
            label: 'Torus Orbit',
            bpm: 132,
            geometryHint: 3,
            bandLevels: { bass: 0.6, mid: 0.44, treble: 0.36 },
            energyCurve: [0.34, 0.5, 0.66, 0.54],
            defaultLevels: [1, 3, 2, 0],
            paletteHue: 52,
            mood: 'subspace orbit'
        },
        {
            id: 'klein-paradox',
            label: 'Klein Paradox',
            bpm: 106,
            geometryHint: 4,
            bandLevels: { bass: 0.31, mid: 0.6, treble: 0.58 },
            energyCurve: [0.26, 0.38, 0.46, 0.58],
            defaultLevels: [0, 2, 3, 1],
            paletteHue: 320,
            mood: 'topological drift'
        },
        {
            id: 'fractal-flare',
            label: 'Fractal Flare',
            bpm: 140,
            geometryHint: 5,
            bandLevels: { bass: 0.58, mid: 0.38, treble: 0.66 },
            energyCurve: [0.4, 0.55, 0.68, 0.74],
            defaultLevels: [0, 2, 1],
            paletteHue: 14,
            mood: 'chaotic bloom'
        },
        {
            id: 'wave-resurgence',
            label: 'Wave Resurgence',
            bpm: 118,
            geometryHint: 6,
            bandLevels: { bass: 0.46, mid: 0.56, treble: 0.64 },
            energyCurve: [0.28, 0.44, 0.52, 0.62],
            defaultLevels: [0, 2, 1],
            paletteHue: 196,
            mood: 'fluid resonance'
        },
        {
            id: 'crystal-ascension',
            label: 'Crystal Ascension',
            bpm: 128,
            geometryHint: 7,
            bandLevels: { bass: 0.27, mid: 0.48, treble: 0.78 },
            energyCurve: [0.33, 0.47, 0.62, 0.72],
            defaultLevels: [1, 3, 2, 0],
            paletteHue: 260,
            mood: 'specular bloom'
        }
    ];
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Central audio service powering the Lattice Pulse game. Provides:
 *  - Microphone analysis with beat detection
 *  - Linked audio element support
 *  - Fallback metronome signatures when no external audio is available
 *  - Real-time energy & band information for visualizers
 */
export class AudioService {
    constructor(options = {}) {
        this.options = {
            metronomeBpm: options.metronomeBpm ?? 120,
            smoothing: options.smoothing ?? 0.78,
            historySize: options.historySize ?? DEFAULT_HISTORY,
            sensitivity: options.sensitivity ?? DEFAULT_SENSITIVITY,
            minBeatInterval: options.minBeatInterval ?? DEFAULT_MIN_INTERVAL,
            metronomeSignatures: options.metronomeSignatures || buildDefaultMetronomeSignatures(),
            fluxHistorySize: options.fluxHistorySize ?? DEFAULT_FLUX_HISTORY,
            fluxThresholdMultiplier: options.fluxThresholdMultiplier ?? DEFAULT_FLUX_THRESHOLD_MULTIPLIER,
            fluxMinInterval: options.fluxMinInterval ?? DEFAULT_FLUX_MIN_INTERVAL,
            autoSilenceFallback: options.autoSilenceFallback ?? true,
            silenceThreshold: options.silenceThreshold ?? DEFAULT_SILENCE_THRESHOLD,
            silenceHoldMs: options.silenceHoldMs ?? DEFAULT_SILENCE_HOLD_MS,
            analysisSmoothing: options.analysisSmoothing ?? DEFAULT_ANALYSIS_SMOOTHING
        };

        this.context = null;
        this.analyser = null;
        this.sourceNode = null;
        this.mediaStream = null;
        this.audioElement = null;
        this.timeDomainBuffer = null;
        this.frequencyBuffer = null;

        this.beatDetector = new BeatDetector({
            historySize: this.options.historySize,
            sensitivity: this.options.sensitivity,
            minBeatInterval: this.options.minBeatInterval
        });

        this.spectralFluxDetector = new SpectralFluxDetector({
            historySize: this.options.fluxHistorySize,
            thresholdMultiplier: this.options.fluxThresholdMultiplier,
            minOnsetInterval: this.options.fluxMinInterval
        });

        this.bandLevels = { bass: 0, mid: 0, treble: 0 };
        this.energy = 0;
        this.currentBpm = this.options.metronomeBpm;
        this.state = 'idle';
        this.lastError = null;
        this.analysisQuality = 0;
        this.lastSpectralFlux = 0;
        this.lastFluxThreshold = 0;
        this.lastFluxConfidence = 0;
        this.lastFluxOnset = false;

        this.beatCallbacks = new Set();
        this.energyCallbacks = new Set();
        this.stateCallbacks = new Set();
        this.errorCallbacks = new Set();

        this.metronome = {
            active: false,
            nextBeatTime: 0,
            signatureIndex: 0,
            beatIndex: 0,
            signatures: this.options.metronomeSignatures.slice(),
            reason: null,
            overlay: false
        };

        this.silence = {
            lastActive: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
            engaged: false
        };

        this.stateBeforeMetronome = null;
        this.lastActiveSource = 'idle';
        this.lastEnergyPayload = null;
    }

    async ensureContext() {
        if (this.context) {
            if (this.context.state === 'suspended') {
                await this.context.resume();
            }
            return this.context;
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
            const error = new Error('Web Audio API is not supported in this browser.');
            this.handleError('Audio context unavailable', error);
            throw error;
        }

        this.context = new AudioCtx();
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
        return this.context;
    }

    async useMicrophone() {
        try {
            await this.ensureContext();
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw Object.assign(new Error('Microphone access is not supported on this device.'), { code: 'unsupported' });
            }

            this.cleanupSource();

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaStream = stream;
            const source = this.context.createMediaStreamSource(stream);
            this.attachSourceNode(source, { connectToDestination: false, state: 'microphone' });
            this.emitStateChange({ state: 'microphone' });
            return true;
        } catch (error) {
            const reason = this.mapMicrophoneError(error);
            this.handleError('Microphone access failed', error);
            this.enableMetronome(reason);
            return false;
        }
    }

    async useTrack(url, options = {}) {
        if (!url) {
            this.handleError('No track URL provided', new Error('Track URL is required.'));
            return false;
        }

        try {
            await this.ensureContext();
            this.cleanupSource();

            const audio = new Audio();
            audio.crossOrigin = options.crossOrigin || 'anonymous';
            audio.src = url;
            audio.loop = options.loop ?? true;
            audio.preload = 'auto';
            if (typeof options.volume === 'number') {
                audio.volume = clamp(options.volume, 0, 1);
            }

            await new Promise((resolve, reject) => {
                const onCanPlay = () => {
                    cleanup();
                    resolve();
                };
                const onError = (event) => {
                    cleanup();
                    reject(event?.error || new Error('Unable to load audio source.'));
                };
                const cleanup = () => {
                    audio.removeEventListener('canplay', onCanPlay);
                    audio.removeEventListener('error', onError);
                };

                audio.addEventListener('canplay', onCanPlay, { once: true });
                audio.addEventListener('error', onError, { once: true });
            });

            await audio.play();

            this.audioElement = audio;
            const source = this.context.createMediaElementSource(audio);
            this.attachSourceNode(source, { connectToDestination: true, state: 'track' });
            this.emitStateChange({ state: 'track' });
            return true;
        } catch (error) {
            this.handleError('Unable to play linked track', error);
            this.enableMetronome('track-failed');
            return false;
        }
    }

    attachSourceNode(sourceNode, { connectToDestination = false, state = 'track' } = {}) {
        this.cleanupAnalyser();

        this.sourceNode = sourceNode;
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = this.options.smoothing;

        this.timeDomainBuffer = new Float32Array(this.analyser.fftSize);
        this.frequencyBuffer = new Uint8Array(this.analyser.frequencyBinCount);

        sourceNode.connect(this.analyser);
        if (connectToDestination) {
            this.analyser.connect(this.context.destination);
        }

        this.beatDetector.reset();
        this.spectralFluxDetector.reset();
        this.disableMetronome();

        this.analysisQuality = 0;
        this.lastSpectralFlux = 0;
        this.lastFluxThreshold = 0;
        this.lastFluxConfidence = 0;
        this.lastFluxOnset = false;
        this.silence.lastActive = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        this.silence.engaged = false;

        this.state = state;
        this.lastActiveSource = state;
        this.currentBpm = this.options.metronomeBpm;
    }

    cleanupAnalyser() {
        if (this.sourceNode) {
            try { this.sourceNode.disconnect(); } catch (err) { /* ignore */ }
            this.sourceNode = null;
        }
        if (this.analyser) {
            try { this.analyser.disconnect(); } catch (err) { /* ignore */ }
            this.analyser = null;
        }
        this.timeDomainBuffer = null;
        this.frequencyBuffer = null;
        this.spectralFluxDetector.reset();
        this.lastSpectralFlux = 0;
        this.lastFluxThreshold = 0;
        this.lastFluxConfidence = 0;
        this.lastFluxOnset = false;
    }

    cleanupSource() {
        this.cleanupAnalyser();

        if (this.mediaStream) {
            try {
                this.mediaStream.getTracks().forEach(track => track.stop());
            } catch (err) {
                // ignore cleanup errors
            }
            this.mediaStream = null;
        }

        if (this.audioElement) {
            try {
                this.audioElement.pause();
                this.audioElement.removeAttribute('src');
                this.audioElement.load();
            } catch (err) {
                // ignore cleanup errors
            }
            this.audioElement = null;
        }
    }

    disableMetronome() {
        this.metronome.active = false;
        this.metronome.reason = null;
        this.metronome.overlay = false;
        this.silence.engaged = false;
        const previous = this.stateBeforeMetronome;
        this.stateBeforeMetronome = null;
        return previous;
    }

    enableMetronome(reason = 'manual', options = {}) {
        const { preserveAnalyser = false } = options || {};
        if (!this.metronome.active) {
            this.stateBeforeMetronome = this.state !== 'metronome' ? (this.state || this.lastActiveSource || 'idle') : this.stateBeforeMetronome;
        }
        if (!preserveAnalyser) {
            this.cleanupAnalyser();
        } else {
            this.metronome.overlay = true;
        }
        if (!preserveAnalyser) {
            this.metronome.overlay = false;
        }
        this.state = 'metronome';
        this.metronome.active = true;
        this.metronome.reason = reason;
        const signatures = this.metronome.signatures;
        if (signatures.length === 0) {
            signatures.push(...buildDefaultMetronomeSignatures());
        }

        this.metronome.signatureIndex = Math.floor(Math.random() * signatures.length);
        this.metronome.beatIndex = 0;
        const signature = signatures[this.metronome.signatureIndex];
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        this.metronome.nextBeatTime = now + 60000 / signature.bpm;
        this.currentBpm = signature.bpm;
        this.bandLevels = { ...signature.bandLevels };
        this.energy = signature.energyCurve[0] ?? 0.4;
        if (reason === 'silence') {
            this.silence.engaged = true;
        }
        this.emitStateChange({ state: 'metronome', reason, previousState: this.stateBeforeMetronome, overlay: preserveAnalyser });
        this.emitEnergy();
        return true;
    }

    update(_deltaSeconds = 0, timestamp = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
        let beat = null;
        if (this.analyser) {
            beat = this.processAnalyser(timestamp);
            if (beat) {
                return beat;
            }
        }
        if (this.metronome.active) {
            return this.processMetronome(timestamp);
        }
        return beat;
    }

    processAnalyser(timestamp) {
        if (!this.analyser) return null;

        if (!this.timeDomainBuffer || this.timeDomainBuffer.length !== this.analyser.fftSize) {
            this.timeDomainBuffer = new Float32Array(this.analyser.fftSize);
        }
        if (!this.frequencyBuffer || this.frequencyBuffer.length !== this.analyser.frequencyBinCount) {
            this.frequencyBuffer = new Uint8Array(this.analyser.frequencyBinCount);
        }

        this.analyser.getFloatTimeDomainData(this.timeDomainBuffer);
        const detection = this.beatDetector.process(this.timeDomainBuffer, this.context?.sampleRate, timestamp);
        this.energy = detection.energy;
        if (detection.bpm) {
            this.currentBpm = detection.bpm;
        }

        this.analyser.getByteFrequencyData(this.frequencyBuffer);
        const fluxDetection = this.spectralFluxDetector.process(this.frequencyBuffer, timestamp);
        this.lastSpectralFlux = fluxDetection.flux;
        this.lastFluxThreshold = fluxDetection.threshold;
        this.lastFluxConfidence = fluxDetection.confidence;
        this.lastFluxOnset = fluxDetection.isOnset;

        this.updateBandLevelsFromFrequency();

        const hasSignal = (
            detection.energy > this.options.silenceThreshold * 1.35 ||
            fluxDetection.isOnset ||
            (fluxDetection.threshold > 0 && fluxDetection.flux > fluxDetection.threshold * 1.1)
        );

        if (hasSignal) {
            this.silence.lastActive = timestamp;
            if (this.metronome.active && this.metronome.reason === 'silence' && this.options.autoSilenceFallback) {
                const previousState = this.disableMetronome();
                const targetState = previousState || this.lastActiveSource || 'microphone';
                this.state = targetState;
                this.emitStateChange({ state: targetState, reason: 'signal-resumed', previousState });
            }
        } else if (this.options.autoSilenceFallback) {
            if (timestamp - this.silence.lastActive > this.options.silenceHoldMs) {
                if (!this.metronome.active || this.metronome.reason !== 'silence') {
                    this.enableMetronome('silence', { preserveAnalyser: true });
                }
            }
        }

        const energyThreshold = detection.threshold || 0;
        const normalizedEnergy = energyThreshold > 0
            ? clamp((detection.energy - energyThreshold * 0.6) / Math.max(energyThreshold, 1e-6), 0, 1)
            : clamp(detection.energy * 1.6, 0, 1);
        const fluxRatio = fluxDetection.threshold > 0 ? fluxDetection.flux / fluxDetection.threshold : fluxDetection.flux * 2;
        const fluxComponent = clamp((fluxRatio - 0.7) / 1.2, 0, 1);
        let qualityCandidate = Math.max(
            normalizedEnergy * 0.6 + fluxComponent * 0.4,
            detection.confidence || 0,
            fluxDetection.confidence || 0
        );
        if (!hasSignal) {
            qualityCandidate *= 0.6;
        }
        if (detection.isBeat || fluxDetection.isOnset) {
            qualityCandidate = Math.max(
                qualityCandidate,
                0.65 + Math.max(detection.confidence || 0, fluxDetection.confidence || 0) * 0.35
            );
        }

        const smoothing = clamp(this.options.analysisSmoothing ?? DEFAULT_ANALYSIS_SMOOTHING, 0, 0.99);
        this.analysisQuality = clamp(
            this.analysisQuality * smoothing + qualityCandidate * (1 - smoothing),
            0,
            1
        );

        this.emitEnergy();

        let shouldEmitBeat = detection.isBeat;
        let confidence = detection.confidence;

        if (!shouldEmitBeat && fluxDetection.isOnset) {
            shouldEmitBeat = true;
            confidence = Math.max(confidence || 0, 0.55 + fluxDetection.confidence * 0.4);
        } else if (shouldEmitBeat) {
            confidence = Math.max(confidence || 0, fluxDetection.confidence);
        }

        if (shouldEmitBeat) {
            return this.emitBeat({
                energy: detection.energy,
                bpm: detection.bpm || this.currentBpm,
                confidence,
                source: this.state,
                timestamp,
                spectralFlux: fluxDetection.flux,
                fluxThreshold: fluxDetection.threshold,
                fluxOnset: fluxDetection.isOnset,
                fluxConfidence: fluxDetection.confidence,
                analysisQuality: this.analysisQuality
            });
        }

        return null;
    }

    updateBandLevelsFromFrequency() {
        const data = this.frequencyBuffer;
        const len = data?.length || 0;
        if (!len) return;

        const bassEnd = Math.max(1, Math.floor(len * 0.1));
        const midEnd = Math.max(bassEnd + 1, Math.floor(len * 0.35));

        const sumRange = (start, end) => {
            const span = Math.max(1, end - start);
            let sum = 0;
            for (let i = start; i < end; i++) {
                sum += (data[i] || 0) / 255;
            }
            return sum / span;
        };

        const target = {
            bass: sumRange(0, bassEnd),
            mid: sumRange(bassEnd, midEnd),
            treble: sumRange(midEnd, len)
        };

        const smooth = 0.7;
        this.bandLevels.bass = lerp(target.bass, this.bandLevels.bass, smooth);
        this.bandLevels.mid = lerp(target.mid, this.bandLevels.mid, smooth);
        this.bandLevels.treble = lerp(target.treble, this.bandLevels.treble, smooth);
    }

    processMetronome(timestamp) {
        if (!this.metronome.active) return null;

        const signatures = this.metronome.signatures;
        if (!signatures.length) return null;

        let beatPayload = null;
        const now = timestamp;
        while (now >= this.metronome.nextBeatTime) {
            const signature = signatures[this.metronome.signatureIndex % signatures.length];
            const curve = signature.energyCurve || [0.4, 0.5, 0.6, 0.7];
            const level = curve[this.metronome.beatIndex % curve.length];
            const jitter = (Math.sin((this.metronome.beatIndex + now / 1000) * 0.25) + 1) * 0.02;
            const energy = clamp(level + jitter, 0, 1);

            const wobble = 0.12;
            this.bandLevels = {
                bass: clamp(signature.bandLevels.bass + Math.sin(this.metronome.beatIndex * 0.5) * wobble, 0, 1),
                mid: clamp(signature.bandLevels.mid + Math.sin(this.metronome.beatIndex * 0.37 + 1.2) * wobble, 0, 1),
                treble: clamp(signature.bandLevels.treble + Math.sin(this.metronome.beatIndex * 0.42 + 2.1) * wobble, 0, 1)
            };

            this.energy = energy;
            this.currentBpm = signature.bpm;

            this.analysisQuality = clamp(this.analysisQuality * 0.85 + 0.6 * 0.15, 0, 1);
            this.lastSpectralFlux = energy * 0.65;
            this.lastFluxThreshold = 0.4;
            this.lastFluxConfidence = 0.78;
            this.lastFluxOnset = true;

            beatPayload = this.emitBeat({
                energy,
                bpm: signature.bpm,
                confidence: 0.95,
                source: 'metronome',
                signature,
                timestamp: this.metronome.nextBeatTime,
                reason: this.metronome.reason,
                spectralFlux: this.lastSpectralFlux,
                fluxThreshold: this.lastFluxThreshold,
                fluxOnset: true,
                fluxConfidence: this.lastFluxConfidence,
                analysisQuality: this.analysisQuality,
                overlay: this.metronome.overlay
            });

            this.metronome.beatIndex += 1;
            if (this.metronome.beatIndex >= (signature.patternLength || curve.length)) {
                this.metronome.beatIndex = 0;
                this.metronome.signatureIndex = (this.metronome.signatureIndex + 1) % signatures.length;
            }

            const intervalMs = 60000 / signature.bpm;
            this.metronome.nextBeatTime += intervalMs;
        }

        if (beatPayload) {
            this.emitEnergy();
        }

        return beatPayload;
    }

    emitBeat(basePayload) {
        const payload = {
            bandLevels: { ...this.bandLevels },
            analysisQuality: this.analysisQuality,
            spectralFlux: this.lastSpectralFlux,
            fluxThreshold: this.lastFluxThreshold,
            fluxConfidence: this.lastFluxConfidence,
            fluxOnset: this.lastFluxOnset,
            ...basePayload
        };
        this.beatCallbacks.forEach(callback => {
            try {
                callback(payload);
            } catch (error) {
                console.error('[AudioService] Beat callback error', error);
            }
        });
        return payload;
    }

    emitEnergy() {
        const payload = {
            energy: this.energy,
            bandLevels: { ...this.bandLevels },
            bpm: this.currentBpm,
            state: this.state,
            analysisQuality: this.analysisQuality,
            spectralFlux: this.lastSpectralFlux,
            fluxThreshold: this.lastFluxThreshold,
            fluxConfidence: this.lastFluxConfidence,
            fluxOnset: this.lastFluxOnset,
            metronomeReason: this.metronome.reason,
            metronomeOverlay: this.metronome.overlay
        };

        this.lastEnergyPayload = payload;
        this.energyCallbacks.forEach(callback => {
            try {
                callback(payload);
            } catch (error) {
                console.error('[AudioService] Energy callback error', error);
            }
        });
        return payload;
    }

    emitStateChange(detail = {}) {
        const payload = { state: this.state, ...detail };
        this.stateCallbacks.forEach(callback => {
            try {
                callback(this.state, payload);
            } catch (error) {
                console.error('[AudioService] State callback error', error);
            }
        });
    }

    mapMicrophoneError(error) {
        if (!error) return 'microphone-error';
        if (error.code === 'unsupported') return 'unsupported';
        switch (error.name) {
            case 'NotAllowedError':
            case 'SecurityError':
                return 'permission-denied';
            case 'NotFoundError':
            case 'DevicesNotFoundError':
                return 'no-devices';
            case 'NotReadableError':
                return 'hardware-busy';
            default:
                return 'microphone-error';
        }
    }

    onBeat(callback) {
        if (typeof callback === 'function') {
            this.beatCallbacks.add(callback);
            return () => this.beatCallbacks.delete(callback);
        }
        return () => {};
    }

    onEnergy(callback) {
        if (typeof callback === 'function') {
            this.energyCallbacks.add(callback);
            return () => this.energyCallbacks.delete(callback);
        }
        return () => {};
    }

    onStateChange(callback) {
        if (typeof callback === 'function') {
            this.stateCallbacks.add(callback);
            return () => this.stateCallbacks.delete(callback);
        }
        return () => {};
    }

    onError(callback) {
        if (typeof callback === 'function') {
            this.errorCallbacks.add(callback);
            return () => this.errorCallbacks.delete(callback);
        }
        return () => {};
    }

    handleError(message, error) {
        const detail = { message, error };
        this.lastError = detail;
        console.error(`[AudioService] ${message}`, error);
        this.errorCallbacks.forEach(callback => {
            try {
                callback(detail);
            } catch (err) {
                console.error('[AudioService] Error callback failure', err);
            }
        });
    }

    getBandLevels() {
        return { ...this.bandLevels };
    }

    getEnergy() {
        return this.energy;
    }

    getAnalysisQuality() {
        return this.analysisQuality;
    }

    getCurrentBpm() {
        return this.currentBpm;
    }

    getState() {
        return this.state;
    }

    getMetronomeReason() {
        return this.metronome.reason;
    }

    getLastError() {
        return this.lastError;
    }

    getLastEnergyPayload() {
        return this.lastEnergyPayload;
    }

    destroy() {
        this.cleanupSource();
        this.analysisQuality = 0;
        this.lastSpectralFlux = 0;
        this.lastFluxThreshold = 0;
        this.lastFluxConfidence = 0;
        this.lastFluxOnset = false;
        this.silence.engaged = false;
        this.silence.lastActive = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        this.lastActiveSource = 'idle';
        if (this.context) {
            try {
                this.context.close();
            } catch (error) {
                // ignore close errors
            }
            this.context = null;
        }
        this.disableMetronome();
        this.beatCallbacks.clear();
        this.energyCallbacks.clear();
        this.stateCallbacks.clear();
        this.errorCallbacks.clear();
    }
}

export default AudioService;
