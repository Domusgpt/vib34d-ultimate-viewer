const DEFAULT_SAMPLE_INTERVAL = 0.06;
const DEFAULT_OPTIONS = {
    fftSize: 1024,
    smoothing: 0.7,
    minDecibels: -90,
    maxDecibels: -10,
    sampleInterval: DEFAULT_SAMPLE_INTERVAL,
    monitorOutput: true,
    audioContextOptions: undefined,
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Lightweight audio analyser used to derive energy information for gameplay systems.
 * The implementation intentionally keeps the public API small: call `sample()` every
 * frame and consume the returned frame object.
 */
export class AudioReactivityEngine {
    constructor(options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };

        this.context = null;
        this.analyser = null;
        this.sourceNode = null;
        this.mediaElement = null;
        this.monitorNode = null;
        this.stream = null;

        this.timeDomainData = null;
        this.frequencyData = null;

        this.lastSampleTime = 0;
        this.sampleInterval = Math.max(0.01, Number(this.options.sampleInterval) || DEFAULT_SAMPLE_INTERVAL);

        this.frame = this._createEmptyFrame();
    }

    _createEmptyFrame() {
        return {
            timestamp: now(),
            level: 0,
            rms: 0,
            peak: 0,
            bands: { low: 0, mid: 0, high: 0 },
        };
    }

    _ensureContext() {
        if (this.context) {
            return this.context;
        }

        if (typeof window === 'undefined') {
            return null;
        }

        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) {
            return null;
        }

        this.context = new AudioContextCtor(this.options.audioContextOptions);
        return this.context;
    }

    _ensureAnalyser() {
        if (!this.context) {
            return null;
        }
        if (this.analyser) {
            return this.analyser;
        }

        const analyser = this.context.createAnalyser();
        analyser.fftSize = this.options.fftSize;
        analyser.smoothingTimeConstant = this.options.smoothing;
        analyser.minDecibels = this.options.minDecibels;
        analyser.maxDecibels = this.options.maxDecibels;

        this.analyser = analyser;
        this.timeDomainData = new Float32Array(analyser.fftSize);
        this.frequencyData = new Uint8Array(analyser.frequencyBinCount);
        return analyser;
    }

    _connectSource(sourceNode) {
        this._disconnectSource();
        const analyser = this._ensureAnalyser();
        if (!analyser) {
            return null;
        }

        this.sourceNode = sourceNode;
        sourceNode.connect(analyser);

        if (this.options.monitorOutput) {
            this.monitorNode = analyser;
            analyser.connect(this.context.destination);
        }

        return analyser;
    }

    _disconnectSource() {
        if (this.monitorNode) {
            try { this.monitorNode.disconnect(); } catch (error) { /* noop */ }
            this.monitorNode = null;
        }

        if (this.sourceNode) {
            try { this.sourceNode.disconnect(); } catch (error) { /* noop */ }
            this.sourceNode = null;
        }

        this.mediaElement = null;

        if (this.analyser) {
            try { this.analyser.disconnect(); } catch (error) { /* noop */ }
            this.analyser = null;
        }

        this.timeDomainData = null;
        this.frequencyData = null;
    }

    async connectToMic(constraints = { audio: true }) {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            throw new Error('Microphone capture is not available in this environment.');
        }

        const context = this._ensureContext();
        if (!context) {
            throw new Error('Web Audio API is not supported in this environment.');
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const source = context.createMediaStreamSource(stream);
        this.stream = stream;
        this._connectSource(source);
        return stream;
    }

    connectToMediaElement(element) {
        if (!element || typeof element !== 'object') {
            return null;
        }

        const context = this._ensureContext();
        if (!context) {
            return null;
        }

        if (this.mediaElement === element && this.sourceNode) {
            return this.frame;
        }

        if (this.mediaElement && this.mediaElement !== element) {
            this._disconnectSource();
        }

        const source = context.createMediaElementSource(element);
        this._connectSource(source);
        this.mediaElement = element;
        return this.frame;
    }

    async resume() {
        if (!this.context) {
            return undefined;
        }
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
        return undefined;
    }

    async suspend() {
        if (!this.context) {
            return undefined;
        }
        if (this.context.state === 'running') {
            await this.context.suspend();
        }
        return undefined;
    }

    dispose() {
        this._disconnectSource();
        if (this.stream) {
            try {
                this.stream.getTracks().forEach((track) => track.stop());
            } catch (error) {
                // ignore track errors
            }
            this.stream = null;
        }
        if (this.context) {
            try { this.context.close(); } catch (error) { /* noop */ }
            this.context = null;
        }
    }

    _calculateBands() {
        if (!this.frequencyData) {
            return { low: 0, mid: 0, high: 0 };
        }

        const third = Math.max(1, Math.floor(this.frequencyData.length / 3));
        let low = 0;
        let mid = 0;
        let high = 0;

        for (let i = 0; i < this.frequencyData.length; i += 1) {
            const value = this.frequencyData[i] / 255;
            if (i < third) {
                low += value;
            } else if (i < third * 2) {
                mid += value;
            } else {
                high += value;
            }
        }

        const normalize = (total) => total / third;
        return {
            low: normalize(low),
            mid: normalize(mid),
            high: normalize(high),
        };
    }

    sample(currentTime = now()) {
        if (!this.analyser || !this.timeDomainData) {
            return this.frame;
        }

        if (currentTime - this.lastSampleTime < this.sampleInterval * 1000) {
            return this.frame;
        }

        this.lastSampleTime = currentTime;

        this.analyser.getFloatTimeDomainData(this.timeDomainData);
        this.analyser.getByteFrequencyData(this.frequencyData);

        let peak = 0;
        let sumSquares = 0;
        for (let i = 0; i < this.timeDomainData.length; i += 1) {
            const value = this.timeDomainData[i];
            peak = Math.max(peak, Math.abs(value));
            sumSquares += value * value;
        }

        const rms = Math.sqrt(sumSquares / this.timeDomainData.length);
        const level = Math.min(1, Math.max(0, rms * 2));

        this.frame = {
            timestamp: currentTime,
            level,
            rms,
            peak,
            bands: this._calculateBands(),
        };

        return this.frame;
    }
}

export default AudioReactivityEngine;
