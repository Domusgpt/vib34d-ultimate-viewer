const DEFAULT_BPM = 120;

export class AudioService {
    constructor() {
        this.context = null;
        this.analyser = null;
        this.source = null;
        this.trackBuffer = null;
        this.isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.fftSize = 2048;
        this.frequencyData = null;
        this.timeDomainData = null;
        this.listeners = { beat: new Set(), analyser: new Set() };
        this.lastBeatTime = 0;
        this.bpm = DEFAULT_BPM;
        this.metronomePhase = 0;
        this.beatThreshold = 1.4;
        this.energyHistory = [];
        this.historySize = 43; // ~0.7 seconds at 60fps
        this.metronomeEnabled = true;
    }

    async init() {
        if (this.context) return;
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = 0.8;
        this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
        this.timeDomainData = new Float32Array(this.analyser.fftSize);
        this.gainNode = this.context.createGain();
        this.gainNode.gain.value = 0.8;
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.context.destination);
    }

    async loadTrack(url) {
        await this.init();
        this.stop();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        this.trackBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.resetState();
    }

    useBuffer(buffer) {
        this.trackBuffer = buffer;
        this.resetState();
    }

    resetState() {
        this.isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.metronomePhase = 0;
        this.lastBeatTime = 0;
        this.energyHistory = [];
    }

    play() {
        if (!this.trackBuffer || !this.context) {
            return;
        }

        if (this.isPlaying) return;

        this.source = this.context.createBufferSource();
        this.source.buffer = this.trackBuffer;
        this.source.connect(this.analyser);
        const offset = this.pauseTime || 0;
        this.source.start(0, offset);
        this.startTime = this.context.currentTime - offset;
        this.isPlaying = true;
        this.source.onended = () => {
            this.isPlaying = false;
            this.pauseTime = 0;
        };
    }

    pause() {
        if (!this.isPlaying) return;
        this.pauseTime = this.context.currentTime - this.startTime;
        this.stopSource();
    }

    stop() {
        if (!this.context) return;
        this.pauseTime = 0;
        this.stopSource();
        this.isPlaying = false;
    }

    stopSource() {
        if (this.source) {
            try {
                this.source.stop(0);
            } catch (e) {
                console.warn('Audio stop error:', e);
            }
            this.source.disconnect();
            this.source = null;
        }
    }

    setVolume(value) {
        if (this.gainNode) {
            this.gainNode.gain.value = value;
        }
    }

    setBpm(bpm) {
        this.bpm = bpm || DEFAULT_BPM;
    }

    enableMetronome(enabled) {
        this.metronomeEnabled = enabled;
    }

    onBeat(callback) {
        this.listeners.beat.add(callback);
        return () => this.listeners.beat.delete(callback);
    }

    onAnalyser(callback) {
        this.listeners.analyser.add(callback);
        return () => this.listeners.analyser.delete(callback);
    }

    update(dt) {
        if (!this.analyser) return;

        this.analyser.getFloatFrequencyData(this.frequencyData);
        this.analyser.getFloatTimeDomainData(this.timeDomainData);

        const energy = this.computeEnergy(this.frequencyData);
        this.energyHistory.push(energy);
        if (this.energyHistory.length > this.historySize) {
            this.energyHistory.shift();
        }

        const meanEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / (this.energyHistory.length || 1);
        const threshold = meanEnergy * this.beatThreshold;

        const currentTime = this.context ? this.context.currentTime : 0;
        const timeSinceLastBeat = currentTime - this.lastBeatTime;
        const beatInterval = 60 / this.bpm;

        const beatDetected = energy > threshold && timeSinceLastBeat > beatInterval * 0.5;

        if (beatDetected) {
            this.lastBeatTime = currentTime;
            this.emitBeat({ energy, time: currentTime, source: 'audio' });
        } else if (this.metronomeEnabled && timeSinceLastBeat > beatInterval) {
            this.lastBeatTime = currentTime;
            this.emitBeat({ energy: meanEnergy, time: currentTime, source: 'metronome' });
        }

        this.listeners.analyser.forEach(cb => cb({
            frequencyData: this.frequencyData,
            timeDomainData: this.timeDomainData,
            energy,
            meanEnergy
        }));
    }

    computeEnergy(frequencyData) {
        let sum = 0;
        const len = frequencyData.length;
        for (let i = 0; i < len; i++) {
            const value = frequencyData[i];
            if (value !== -Infinity) {
                sum += Math.pow(10, value / 20);
            }
        }
        return sum / len;
    }

    emitBeat(event) {
        this.listeners.beat.forEach(cb => cb(event));
    }

    getBandLevels() {
        if (!this.frequencyData) {
            return { bass: 0, mid: 0, high: 0, energy: 0 };
        }

        const bassEnd = Math.floor(this.frequencyData.length * 0.08);
        const midEnd = Math.floor(this.frequencyData.length * 0.4);

        let bass = 0;
        let mid = 0;
        let high = 0;

        for (let i = 0; i < this.frequencyData.length; i++) {
            const value = this.frequencyData[i];
            if (value === -Infinity) continue;
            const amplitude = Math.pow(10, value / 20);
            if (i < bassEnd) {
                bass += amplitude;
            } else if (i < midEnd) {
                mid += amplitude;
            } else {
                high += amplitude;
            }
        }

        return {
            bass: bass / bassEnd || 0,
            mid: mid / (midEnd - bassEnd || 1),
            high: high / (this.frequencyData.length - midEnd || 1),
            energy: this.energyHistory.length
                ? this.energyHistory[this.energyHistory.length - 1]
                : 0
        };
    }
}
