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
        this.beatInterval = 0.5; // default 120 BPM
        this.beatAccumulator = 0;
        this.beatListeners = new Set();
        this.measureListeners = new Set();
        this.frequencyBins = null;
        this.phase = 0;
        this.measureBeats = 4;
        this.beatIndex = 0;
        this.startTime = 0;
    }

    async init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.7;
            this.frequencyBins = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.connect(this.masterGain);
        }
        return this.audioContext;
    }

    async loadTrack(trackConfig) {
        await this.init();
        this.trackConfig = trackConfig;
        const bpm = trackConfig?.bpm || 120;
        this.setBPM(bpm);

        if (!trackConfig?.url) {
            console.warn('AudioService: No track URL, using metronome fallback');
            this.useMetronome = true;
            return false;
        }

        try {
            const response = await fetch(trackConfig.url);
            const arrayBuffer = await response.arrayBuffer();
            this.trackBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.useMetronome = false;
            console.log('AudioService: Track loaded');
            return true;
        } catch (err) {
            console.warn('AudioService: Failed to load track, falling back to metronome', err);
            this.trackBuffer = null;
            this.useMetronome = true;
            return false;
        }
    }

    setBPM(bpm) {
        this.beatInterval = 60 / (bpm || 120);
    }

    async start() {
        await this.init();
        await this.audioContext.resume();
        this.stop();

        if (this.useMetronome || !this.trackBuffer) {
            this.startMetronome();
        } else {
            this.startTrack();
        }

        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime;
        window.audioEnabled = true;
    }

    startTrack() {
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.trackBuffer;
        this.source.loop = true;
        this.source.connect(this.analyser);
        this.source.start();
    }

    startMetronome() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(this.analyser);
        osc.start();
        this.metronomeOscillator = { osc, gain };
    }

    stop() {
        if (this.source) {
            try { this.source.stop(); } catch (_) { /* ignore */ }
            this.source.disconnect();
            this.source = null;
        }
        if (this.metronomeOscillator) {
            try { this.metronomeOscillator.osc.stop(); } catch (_) {}
            this.metronomeOscillator.osc.disconnect();
            this.metronomeOscillator.gain.disconnect();
            this.metronomeOscillator = null;
        }
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

    update(dt) {
        if (!this.isPlaying) return;

        this.beatAccumulator += dt * (this.trackConfig?.playbackRate || 1);
        if (this.beatAccumulator >= this.beatInterval) {
            this.beatAccumulator -= this.beatInterval;
            this.beatIndex += 1;
            const beatInfo = {
                time: this.audioContext?.currentTime || performance.now() / 1000,
                beat: this.beatIndex,
                interval: this.beatInterval
            };
            this.beatListeners.forEach((cb) => cb(beatInfo));
            if (this.beatIndex % this.measureBeats === 0) {
                this.measureListeners.forEach((cb) => cb({
                    measure: this.beatIndex / this.measureBeats,
                    beatInfo
                }));
            }
            if (this.metronomeOscillator) {
                this.metronomeOscillator.gain.gain.cancelScheduledValues(0);
                this.metronomeOscillator.gain.gain.setValueAtTime(0.25, this.audioContext.currentTime);
                this.metronomeOscillator.gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
            }
        }

        if (this.analyser && this.frequencyBins) {
            this.analyser.getByteFrequencyData(this.frequencyBins);
            const bass = averageRange(this.frequencyBins, 0, 24);
            const mid = averageRange(this.frequencyBins, 24, 96);
            const high = averageRange(this.frequencyBins, 96, 256);
            window.audioReactive = {
                bass,
                mid,
                high
            };
        }
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
