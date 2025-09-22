/**
 * AudioReactivityEngine analyses audio input from either the microphone or
 * media elements and produces normalized feature frames that other systems can
 * consume to drive gameplay. The class wraps the Web Audio API but gracefully
 * degrades when running in non-browser environments.
 */
export class AudioReactivityEngine {
    constructor(options = {}) {
        const {
            audioContext = null,
            fftSize = 2048,
            smoothing = 0.75,
            minDecibels = -90,
            maxDecibels = -16,
            minBeatInterval = 0.32,
            beatSensitivity = 1.35,
            difficulty = {},
            fallbackGenerator = null,
        } = options;

        this.audioContext = audioContext || this.createContext();
        this.analyser = null;
        this.gainNode = null;
        this.sourceNode = null;

        this.fftSize = fftSize;
        this.smoothingTimeConstant = smoothing;
        this.minDecibels = minDecibels;
        this.maxDecibels = maxDecibels;
        this.minBeatInterval = Math.max(0.12, minBeatInterval);
        this.beatSensitivity = beatSensitivity;

        this.fallbackGenerator = typeof fallbackGenerator === 'function'
            ? fallbackGenerator
            : null;

        this.frequencyData = null;
        this.timeDomainData = null;

        this.energyHistory = [];
        this.beatHistory = [];
        this.lastBeatTime = 0;
        this.lastFrame = null;

        this.peakEnergy = 0.0001;
        this.smoothedEnergy = 0;

        this.difficultyConfig = {
            min: 0.85,
            max: 3.6,
            smoothing: 0.06,
            exponent: 0.65,
            baseline: 1.05,
            ...difficulty,
        };
        this.difficultyLevel = this.difficultyConfig.baseline;

        this.manualFrameGenerator = null;
    }

    createContext() {
        if (typeof window === 'undefined') {
            return null;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            return null;
        }

        try {
            return new AudioContextClass();
        } catch (error) {
            return null;
        }
    }

    getContext() {
        return this.audioContext;
    }

    ensureAnalyser(context = this.audioContext) {
        if (!context || typeof context.createAnalyser !== 'function') {
            return null;
        }

        if (!this.analyser) {
            this.analyser = context.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.minDecibels = this.minDecibels;
            this.analyser.maxDecibels = this.maxDecibels;
            this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeDomainData = new Uint8Array(this.analyser.fftSize);
        }

        return this.analyser;
    }

    connectSource(sourceNode) {
        if (!sourceNode) {
            return null;
        }

        const context = sourceNode.context || this.audioContext || this.createContext();
        if (!context) {
            return null;
        }

        this.audioContext = context;
        const analyser = this.ensureAnalyser(context);
        if (!analyser) {
            return null;
        }

        if (this.gainNode) {
            try {
                this.gainNode.disconnect();
            } catch (error) {
                // Ignore disconnect failures when the graph is already detached.
            }
        }

        if (typeof context.createGain === 'function') {
            this.gainNode = context.createGain();
            this.gainNode.gain.value = 1;
            sourceNode.connect(this.gainNode);
            this.gainNode.connect(analyser);
        } else {
            sourceNode.connect(analyser);
            this.gainNode = null;
        }

        this.sourceNode = sourceNode;
        return analyser;
    }

    connectToMediaElement(element) {
        if (!element) {
            return null;
        }

        const context = this.audioContext || this.createContext();
        if (!context || typeof context.createMediaElementSource !== 'function') {
            return null;
        }

        const sourceNode = context.createMediaElementSource(element);
        this.connectSource(sourceNode);
        return sourceNode;
    }

    connectToStream(stream) {
        if (!stream) {
            return null;
        }

        const context = this.audioContext || this.createContext();
        if (!context || typeof context.createMediaStreamSource !== 'function') {
            return null;
        }

        const sourceNode = context.createMediaStreamSource(stream);
        this.connectSource(sourceNode);
        return sourceNode;
    }

    async connectToMic(constraints = { audio: true }) {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            throw new Error('Microphone access is not available in this environment.');
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.connectToStream(stream);
        return stream;
    }

    setManualFrameGenerator(generator) {
        this.manualFrameGenerator = typeof generator === 'function' ? generator : null;
    }

    setFallbackGenerator(generator) {
        this.fallbackGenerator = typeof generator === 'function' ? generator : null;
    }

    resume() {
        if (!this.audioContext) {
            return Promise.resolve();
        }

        if (this.audioContext.state === 'suspended' && typeof this.audioContext.resume === 'function') {
            return this.audioContext.resume();
        }

        return Promise.resolve();
    }

    suspend() {
        if (!this.audioContext) {
            return Promise.resolve();
        }

        if (typeof this.audioContext.suspend === 'function') {
            return this.audioContext.suspend();
        }

        return Promise.resolve();
    }

    now() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    update(now = this.now()) {
        if (this.manualFrameGenerator) {
            const manualFrame = this.manualFrameGenerator(now);
            if (manualFrame) {
                this.lastFrame = this.normalizeFrame(manualFrame, now);
                return this.lastFrame;
            }
        }

        if (!this.analyser || !this.frequencyData || !this.timeDomainData) {
            if (this.fallbackGenerator) {
                const fallback = this.fallbackGenerator(now);
                if (fallback) {
                    this.lastFrame = this.normalizeFrame(fallback, now);
                    return this.lastFrame;
                }
            }
            return this.generateSilentFrame(now);
        }

        this.analyser.getByteFrequencyData(this.frequencyData);
        if (typeof this.analyser.getByteTimeDomainData === 'function') {
            this.analyser.getByteTimeDomainData(this.timeDomainData);
        } else if (typeof this.analyser.getFloatTimeDomainData === 'function') {
            const floatData = new Float32Array(this.analyser.fftSize);
            this.analyser.getFloatTimeDomainData(floatData);
            for (let i = 0; i < floatData.length; i += 1) {
                this.timeDomainData[i] = Math.round((floatData[i] + 1) * 127.5);
            }
        } else {
            // Fallback: approximate time domain data from frequency magnitudes.
            for (let i = 0; i < this.timeDomainData.length; i += 1) {
                this.timeDomainData[i] = 128 + (this.frequencyData[i % this.frequencyData.length] - 128);
            }
        }

        const frame = this.extractFeatures(now);
        this.lastFrame = frame;
        return frame;
    }

    extractFeatures(now) {
        const energy = this.computeRmsEnergy();
        this.peakEnergy = Math.max(energy, this.peakEnergy * 0.995);
        const normalizedEnergy = this.peakEnergy ? energy / this.peakEnergy : energy;

        this.energyHistory.push({ time: now, energy: normalizedEnergy });
        while (this.energyHistory.length > 0 && (now - this.energyHistory[0].time) > 4000) {
            this.energyHistory.shift();
        }

        const averages = this.computeEnergyAverages();
        const beatData = this.detectBeat(normalizedEnergy, now, averages.averageEnergy);

        const bands = this.computeBands();
        const centroid = this.computeSpectralCentroid();
        const zeroCrossingRate = this.computeZeroCrossingRate();

        const difficulty = this.deriveDifficultyLevel({
            energy: normalizedEnergy,
            beatStrength: beatData.beatStrength,
            centroid,
        });

        const trend = this.computeEnergyTrend(normalizedEnergy);

        return {
            time: now,
            rawEnergy: energy,
            energy: normalizedEnergy,
            energyAverages: averages,
            beat: beatData.isBeat,
            beatStrength: beatData.beatStrength,
            bpm: beatData.bpm,
            tempoConfidence: beatData.tempoConfidence,
            bass: bands.bass,
            mid: bands.mid,
            treble: bands.treble,
            spectralCentroid: centroid,
            zeroCrossingRate,
            difficulty,
            trend,
            silent: false,
        };
    }

    computeRmsEnergy() {
        if (!this.timeDomainData?.length) {
            return 0;
        }

        let sumSquares = 0;
        for (let i = 0; i < this.timeDomainData.length; i += 1) {
            const sample = (this.timeDomainData[i] - 128) / 128;
            sumSquares += sample * sample;
        }

        return Math.sqrt(sumSquares / this.timeDomainData.length);
    }

    computeEnergyAverages() {
        if (!this.energyHistory.length) {
            return {
                averageEnergy: 0,
                variance: 0,
            };
        }

        const count = this.energyHistory.length;
        let sum = 0;
        for (const entry of this.energyHistory) {
            sum += entry.energy;
        }
        const averageEnergy = sum / count;

        let varianceSum = 0;
        for (const entry of this.energyHistory) {
            const delta = entry.energy - averageEnergy;
            varianceSum += delta * delta;
        }

        return {
            averageEnergy,
            variance: varianceSum / count,
        };
    }

    detectBeat(energy, now, averageEnergy) {
        const epsilon = 0.00001;
        const thresholdBase = (averageEnergy || epsilon) * this.beatSensitivity;
        const dynamicThreshold = thresholdBase + 0.05;
        const isBeat = energy > dynamicThreshold && (now - this.lastBeatTime) > (this.minBeatInterval * 1000);

        let beatStrength = 0;
        if (averageEnergy > epsilon) {
            beatStrength = energy / averageEnergy;
        }

        let bpm = this.lastFrame?.bpm ?? 0;
        let tempoConfidence = this.lastFrame?.tempoConfidence ?? 0;

        if (isBeat) {
            this.lastBeatTime = now;
            this.beatHistory.push(now);
            while (this.beatHistory.length > 0 && (now - this.beatHistory[0]) > 12000) {
                this.beatHistory.shift();
            }

            if (this.beatHistory.length >= 2) {
                const intervals = [];
                for (let i = 1; i < this.beatHistory.length; i += 1) {
                    intervals.push(this.beatHistory[i] - this.beatHistory[i - 1]);
                }
                const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
                if (avgInterval > 0) {
                    bpm = 60000 / avgInterval;
                    tempoConfidence = Math.min(1, intervals.length / 12);
                }
            }
        }

        return { isBeat, beatStrength, bpm, tempoConfidence };
    }

    computeBands() {
        if (!this.frequencyData?.length || !this.analyser) {
            return { bass: 0, mid: 0, treble: 0 };
        }

        const nyquist = (this.audioContext?.sampleRate || 44100) / 2;
        const band = (minFreq, maxFreq) => {
            const start = Math.max(0, Math.floor((minFreq / nyquist) * this.frequencyData.length));
            const end = Math.min(this.frequencyData.length - 1, Math.ceil((maxFreq / nyquist) * this.frequencyData.length));
            if (end <= start) {
                return 0;
            }

            let sum = 0;
            for (let i = start; i <= end; i += 1) {
                sum += this.frequencyData[i];
            }
            const average = sum / (end - start + 1);
            return Math.min(1, average / 255);
        };

        return {
            bass: band(20, 160),
            mid: band(160, 2000),
            treble: band(2000, 8000),
        };
    }

    computeSpectralCentroid() {
        if (!this.frequencyData?.length || !this.analyser) {
            return 0;
        }

        const sampleRate = this.audioContext?.sampleRate || 44100;
        const nyquist = sampleRate / 2;
        let weightedSum = 0;
        let total = 0;
        for (let i = 0; i < this.frequencyData.length; i += 1) {
            const magnitude = this.frequencyData[i];
            total += magnitude;
            const frequency = (i / this.frequencyData.length) * nyquist;
            weightedSum += frequency * magnitude;
        }

        if (total <= 0) {
            return 0;
        }

        return weightedSum / total / nyquist;
    }

    computeZeroCrossingRate() {
        if (!this.timeDomainData?.length) {
            return 0;
        }

        let crossings = 0;
        for (let i = 1; i < this.timeDomainData.length; i += 1) {
            const prev = this.timeDomainData[i - 1] - 128;
            const curr = this.timeDomainData[i] - 128;
            if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
                crossings += 1;
            }
        }

        return crossings / this.timeDomainData.length;
    }

    deriveDifficultyLevel(features) {
        const { min, max, smoothing, exponent, baseline } = this.difficultyConfig;
        const energy = Math.max(0, Math.min(1, features.energy ?? 0));
        const beatStrength = Math.max(0, Math.min(2.5, features.beatStrength ?? 0));
        const centroid = Math.max(0, Math.min(1, features.centroid ?? 0));

        const combined = (energy ** exponent) * 0.6
            + Math.min(1, beatStrength / 1.8) * 0.25
            + centroid * 0.15;
        const target = min + combined * (max - min);

        this.difficultyLevel = (this.difficultyLevel * (1 - smoothing)) + (target * smoothing);
        return {
            level: this.difficultyLevel,
            normalized: (this.difficultyLevel - min) / Math.max(0.001, max - min),
            baseline,
        };
    }

    computeEnergyTrend(currentEnergy) {
        const smoothing = 0.12;
        this.smoothedEnergy = (this.smoothedEnergy * (1 - smoothing)) + (currentEnergy * smoothing);
        if (!this.lastFrame) {
            return 0;
        }

        return currentEnergy - (this.lastFrame.energy ?? currentEnergy);
    }

    normalizeFrame(frame, now) {
        return {
            time: frame.time ?? now,
            rawEnergy: frame.rawEnergy ?? frame.energy ?? 0,
            energy: Math.max(0, Math.min(1, frame.energy ?? 0)),
            energyAverages: frame.energyAverages || { averageEnergy: frame.energy ?? 0, variance: 0 },
            beat: Boolean(frame.beat),
            beatStrength: frame.beatStrength ?? 0,
            bpm: frame.bpm ?? 0,
            tempoConfidence: frame.tempoConfidence ?? 0,
            bass: Math.max(0, Math.min(1, frame.bass ?? frame.low ?? 0)),
            mid: Math.max(0, Math.min(1, frame.mid ?? frame.midrange ?? 0)),
            treble: Math.max(0, Math.min(1, frame.treble ?? frame.high ?? 0)),
            spectralCentroid: Math.max(0, Math.min(1, frame.spectralCentroid ?? 0)),
            zeroCrossingRate: Math.max(0, frame.zeroCrossingRate ?? 0),
            difficulty: frame.difficulty || this.deriveDifficultyLevel({
                energy: frame.energy ?? 0,
                beatStrength: frame.beatStrength ?? 0,
                centroid: frame.spectralCentroid ?? 0,
            }),
            trend: frame.trend ?? 0,
            silent: Boolean(frame.silent),
        };
    }

    generateSilentFrame(now) {
        const difficulty = this.deriveDifficultyLevel({ energy: 0, beatStrength: 0, centroid: 0 });
        return {
            time: now,
            rawEnergy: 0,
            energy: 0,
            energyAverages: { averageEnergy: 0, variance: 0 },
            beat: false,
            beatStrength: 0,
            bpm: this.lastFrame?.bpm ?? 0,
            tempoConfidence: 0,
            bass: 0,
            mid: 0,
            treble: 0,
            spectralCentroid: 0,
            zeroCrossingRate: 0,
            difficulty,
            trend: -this.smoothedEnergy,
            silent: true,
        };
    }
}
