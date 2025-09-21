/**
 * AudioReactiveAnalyzer samples audio input (microphone or injected analyser)
 * to derive intensity, beat, and spectral metrics that downstream systems can
 * use to drive spawn logic and shader programs.
 */
export class AudioReactiveAnalyzer {
    constructor(options = {}) {
        const {
            audioContext = null,
            analyser = null,
            useMicrophone = true,
            fftSize = 512,
            smoothingTimeConstant = 0.82,
            historySize = 48,
            beatSensitivity = 1.55,
            beatFloor = 0.04,
            beatMinimumInterval = 120,
            intensitySmoothing = 0.65,
            intensityDecay = 0.9,
            minSilenceLevel = 0.015,
            onStateChange = null,
            sampleRate = 44100,
        } = options;

        this.options = {
            useMicrophone,
            fftSize,
            smoothingTimeConstant,
            historySize,
            beatSensitivity,
            beatFloor,
            beatMinimumInterval,
            intensitySmoothing,
            intensityDecay,
            minSilenceLevel,
            onStateChange: typeof onStateChange === 'function' ? onStateChange : null,
            sampleRate,
        };

        this.audioContext = audioContext || null;
        this.analyser = analyser || null;

        if (this.analyser) {
            this.analyser.fftSize = fftSize;
            this.analyser.smoothingTimeConstant = smoothingTimeConstant;
        }

        this.frequencyData = this.analyser ? new Uint8Array(this.analyser.frequencyBinCount) : null;
        this.timeDomainData = this.analyser ? new Uint8Array(this.analyser.fftSize) : null;

        this.energyHistory = [];
        this.lastBeatTimestamp = 0;

        this.manualState = null;
        this.state = this.createEmptyState();
        this.enabled = Boolean(this.analyser);
    }

    async initialize() {
        if (this.enabled) {
            return true;
        }

        if (typeof window === 'undefined' || !this.options.useMicrophone) {
            return false;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            return false;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return false;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.audioContext = this.audioContext || new AudioContextClass();
            if (this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                } catch (resumeError) {
                    // Ignore resume errors; analyser will still attempt to operate.
                }
            }

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.options.fftSize;
            this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;

            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeDomainData = new Uint8Array(this.analyser.fftSize);

            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.analyser);

            this.enabled = true;
            return true;
        } catch (error) {
            console.warn('AudioReactiveAnalyzer: failed to initialize microphone', error); // eslint-disable-line no-console
            this.enabled = false;
            return false;
        }
    }

    update(now = this.timestamp()) {
        if (this.manualState) {
            this.state = {
                ...this.createEmptyState(),
                ...this.manualState,
                timestamp: now,
            };
            return this.state;
        }

        if (!this.analyser || !this.enabled) {
            this.state = {
                ...this.state,
                intensity: this.state.intensity * this.options.intensityDecay,
                volume: this.state.volume * this.options.intensityDecay,
                beat: false,
                silence: true,
                timestamp: now,
            };
            return this.state;
        }

        if (!this.frequencyData || this.frequencyData.length !== this.analyser.frequencyBinCount) {
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        }

        if (!this.timeDomainData || this.timeDomainData.length !== this.analyser.fftSize) {
            this.timeDomainData = new Uint8Array(this.analyser.fftSize);
        }

        this.analyser.getByteFrequencyData(this.frequencyData);
        this.analyser.getByteTimeDomainData(this.timeDomainData);

        const intensity = this.computeIntensity(this.timeDomainData);
        const bandEnergies = this.computeBandEnergies(this.frequencyData);
        const spectralCentroid = this.computeSpectralCentroid(this.frequencyData);
        const dominantIndex = this.findDominantIndex(this.frequencyData);
        const dominantFrequency = this.computeFrequencyFromIndex(dominantIndex);
        const dominantBand = this.getDominantBand(bandEnergies);
        const beat = this.detectBeat(intensity, now);
        const silence = intensity < this.options.minSilenceLevel;

        this.state = {
            intensity,
            volume: intensity,
            beat,
            spectralCentroid,
            dominantFrequency,
            dominantBand,
            bandEnergies,
            silence,
            timestamp: now,
            raw: {
                dominantIndex,
            },
        };

        if (this.options.onStateChange) {
            this.options.onStateChange(this.state);
        }

        return this.state;
    }

    getState() {
        return {
            ...this.state,
            bandEnergies: { ...this.state.bandEnergies },
        };
    }

    setManualState(state = null) {
        if (state == null) {
            this.manualState = null;
            return;
        }

        this.manualState = {
            ...this.createEmptyState(),
            ...state,
        };
    }

    destroy() {
        this.manualState = null;
        this.enabled = false;
        if (this.audioContext && typeof this.audioContext.close === 'function') {
            try {
                this.audioContext.close();
            } catch (error) {
                // Ignore close errors.
            }
        }
        this.audioContext = null;
        this.analyser = null;
        this.frequencyData = null;
        this.timeDomainData = null;
    }

    createEmptyState() {
        return {
            intensity: 0,
            volume: 0,
            beat: false,
            spectralCentroid: 0,
            dominantFrequency: 0,
            dominantBand: 'mid',
            bandEnergies: { low: 0, mid: 0, high: 0 },
            silence: true,
            timestamp: this.timestamp(),
        };
    }

    computeIntensity(timeDomainData) {
        if (!timeDomainData || timeDomainData.length === 0) {
            return 0;
        }

        let sumSquares = 0;
        for (let i = 0; i < timeDomainData.length; i += 1) {
            const centered = (timeDomainData[i] - 128) / 128;
            sumSquares += centered * centered;
        }

        const rms = Math.sqrt(sumSquares / timeDomainData.length);
        const scaled = Math.min(1, rms * 1.35);
        const smoothed = (this.state.intensity * this.options.intensitySmoothing)
            + (scaled * (1 - this.options.intensitySmoothing));

        return Math.max(0, Math.min(1, smoothed));
    }

    computeBandEnergies(frequencyData) {
        if (!frequencyData || frequencyData.length === 0) {
            return { low: 0, mid: 0, high: 0 };
        }

        const analyserFft = this.analyser?.fftSize ?? this.options.fftSize;
        const sampleRate = this.audioContext?.sampleRate ?? this.options.sampleRate;
        const binFrequency = sampleRate / analyserFft;

        let lowTotal = 0;
        let midTotal = 0;
        let highTotal = 0;
        let lowCount = 0;
        let midCount = 0;
        let highCount = 0;

        for (let i = 0; i < frequencyData.length; i += 1) {
            const magnitude = frequencyData[i] / 255;
            const frequency = i * binFrequency;

            if (frequency < 220) {
                lowTotal += magnitude;
                lowCount += 1;
            } else if (frequency < 2000) {
                midTotal += magnitude;
                midCount += 1;
            } else {
                highTotal += magnitude;
                highCount += 1;
            }
        }

        return {
            low: lowCount ? lowTotal / lowCount : 0,
            mid: midCount ? midTotal / midCount : 0,
            high: highCount ? highTotal / highCount : 0,
        };
    }

    computeSpectralCentroid(frequencyData) {
        if (!frequencyData || frequencyData.length === 0) {
            return 0;
        }

        const analyserFft = this.analyser?.fftSize ?? this.options.fftSize;
        const sampleRate = this.audioContext?.sampleRate ?? this.options.sampleRate;
        const binFrequency = sampleRate / analyserFft;

        let numerator = 0;
        let denominator = 0;

        for (let i = 0; i < frequencyData.length; i += 1) {
            const magnitude = frequencyData[i];
            denominator += magnitude;
            numerator += magnitude * (i * binFrequency);
        }

        if (denominator <= 0) {
            return 0;
        }

        return numerator / denominator;
    }

    findDominantIndex(frequencyData) {
        if (!frequencyData || frequencyData.length === 0) {
            return 0;
        }

        let maxIndex = 0;
        let maxValue = -Infinity;

        for (let i = 0; i < frequencyData.length; i += 1) {
            if (frequencyData[i] > maxValue) {
                maxValue = frequencyData[i];
                maxIndex = i;
            }
        }

        return maxIndex;
    }

    computeFrequencyFromIndex(index) {
        if (!Number.isFinite(index)) {
            return 0;
        }

        const analyserFft = this.analyser?.fftSize ?? this.options.fftSize;
        const sampleRate = this.audioContext?.sampleRate ?? this.options.sampleRate;

        return (index * sampleRate) / analyserFft;
    }

    getDominantBand(bandEnergies) {
        if (!bandEnergies) {
            return 'mid';
        }

        const entries = Object.entries(bandEnergies);
        let dominant = 'mid';
        let maxValue = -Infinity;

        entries.forEach(([band, value]) => {
            if (value > maxValue) {
                dominant = band;
                maxValue = value;
            }
        });

        return dominant;
    }

    detectBeat(intensity, now) {
        if (!Number.isFinite(intensity)) {
            return false;
        }

        const history = this.energyHistory;
        history.push(intensity);
        if (history.length > this.options.historySize) {
            history.shift();
        }

        const average = history.reduce((acc, value) => acc + value, 0) / history.length || 0;
        const threshold = Math.max(
            average * this.options.beatSensitivity,
            average + this.options.beatFloor,
        );

        const sinceLastBeat = now - this.lastBeatTimestamp;
        const isBeat = intensity > threshold && sinceLastBeat > this.options.beatMinimumInterval;

        if (isBeat) {
            this.lastBeatTimestamp = now;
        }

        return isBeat;
    }

    timestamp() {
        return typeof performance !== 'undefined' ? performance.now() : Date.now();
    }
}
