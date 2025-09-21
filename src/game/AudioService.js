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
        this.analysis = { energy: 0, bass: 0, mid: 0, high: 0, flux: 0, drop: false, lull: false, silence: false };
        this.energyAverage = 0;
        this.lastEnergy = 0;
        this.prevSpectrum = null;
        this.audioEvents = [];
        this.dropCooldownTimer = 0;
        this.lullCooldownTimer = 0;
        this.silenceCooldownTimer = 0;
        this.lullHold = 0;
        this.silenceHold = 0;
        this.bridgeHold = 0;
        this.vocalHold = 0;
        this.vocalAverage = 0;
        this.vocalCooldownTimer = 0;
        this.bridgeCooldownTimer = 0;
        this.rhythmShiftTimer = 0;
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
            this.prevSpectrum = new Float32Array(this.analyser.frequencyBinCount);
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

        this.dropCooldownTimer = Math.max(0, this.dropCooldownTimer - dt);
        this.lullCooldownTimer = Math.max(0, this.lullCooldownTimer - dt);
        this.silenceCooldownTimer = Math.max(0, this.silenceCooldownTimer - dt);
        this.vocalCooldownTimer = Math.max(0, this.vocalCooldownTimer - dt);
        this.bridgeCooldownTimer = Math.max(0, this.bridgeCooldownTimer - dt);
        this.rhythmShiftTimer = Math.max(0, this.rhythmShiftTimer - dt);

        if (this.analyser && this.frequencyBins) {
            this.analyser.getByteFrequencyData(this.frequencyBins);
            const bass = averageRange(this.frequencyBins, 0, 24);
            const mid = averageRange(this.frequencyBins, 24, 96);
            const high = averageRange(this.frequencyBins, 96, 256);
            const flux = spectralFlux(this.frequencyBins, this.prevSpectrum);
            const energy = bass * 0.6 + mid * 0.3 + high * 0.1;
            this.energyAverage = this.energyAverage ? this.energyAverage * 0.92 + energy * 0.08 : energy;
            const delta = energy - this.lastEnergy;
            this.lastEnergy = energy;

            const vocalScore = Math.max(0, mid * 0.7 + high * 0.5 - bass * 0.35);
            this.vocalAverage = this.vocalAverage ? this.vocalAverage * 0.93 + vocalScore * 0.07 : vocalScore;
            const vocalSpike = vocalScore > this.vocalAverage + 0.12 && flux > 0.015;

            const dropTriggered = energy > this.energyAverage * 1.35 && delta > 0.06 && this.dropCooldownTimer <= 0;
            if (dropTriggered) {
                this.audioEvents.push({ type: 'drop', time: this.audioContext?.currentTime || performance.now() / 1000 });
                this.dropCooldownTimer = 1.5;
            }

            if (energy < this.energyAverage * 0.7) {
                this.lullHold += dt;
            } else {
                this.lullHold = 0;
            }
            const lullTriggered = this.lullHold > 1.6 && this.lullCooldownTimer <= 0;
            if (lullTriggered) {
                this.audioEvents.push({ type: 'lull', time: this.audioContext?.currentTime || performance.now() / 1000 });
                this.lullCooldownTimer = 6;
            }

            if (energy < this.energyAverage * 0.82 && energy > 0.05) {
                this.bridgeHold += dt;
            } else {
                this.bridgeHold = 0;
            }
            const bridgeTriggered = this.bridgeHold > 1.4 && this.bridgeCooldownTimer <= 0;
            if (bridgeTriggered) {
                this.audioEvents.push({ type: 'bridge', time: this.audioContext?.currentTime || performance.now() / 1000 });
                this.bridgeCooldownTimer = 8;
            }

            if (energy < 0.04) {
                this.silenceHold += dt;
            } else {
                this.silenceHold = 0;
            }
            const silenceTriggered = this.silenceHold > 0.8 && this.silenceCooldownTimer <= 0;
            if (silenceTriggered) {
                this.audioEvents.push({ type: 'silence', time: this.audioContext?.currentTime || performance.now() / 1000 });
                this.silenceCooldownTimer = 8;
            }

            if (vocalSpike && this.vocalCooldownTimer <= 0) {
                this.audioEvents.push({ type: 'vocal', time: this.audioContext?.currentTime || performance.now() / 1000 });
                this.vocalHold = 0.6;
                this.vocalCooldownTimer = 4;
            } else {
                this.vocalHold = Math.max(0, this.vocalHold - dt);
            }

            const rhythmShift = flux > 0.05 && this.rhythmShiftTimer <= 0;
            if (rhythmShift) {
                this.audioEvents.push({ type: 'rhythm-shift', time: this.audioContext?.currentTime || performance.now() / 1000 });
                this.rhythmShiftTimer = 3.2;
            }

            this.analysis = {
                energy,
                average: this.energyAverage,
                delta,
                bass,
                mid,
                high,
                flux,
                drop: dropTriggered,
                lull: this.lullHold > 1.2,
                silence: this.silenceHold > 0.6,
                bridge: this.bridgeHold > 1.2,
                vocal: this.vocalHold > 0,
                rhythmShift
            };

            window.audioReactive = {
                bass,
                mid,
                high,
                energy,
                vocal: vocalScore
            };
        }
    }

    getAnalysis() {
        return { ...this.analysis };
    }

    consumeAudioEvents() {
        const queue = this.audioEvents.slice();
        this.audioEvents.length = 0;
        return queue;
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

function spectralFlux(currentBins, prevSpectrum) {
    if (!prevSpectrum) return 0;
    let flux = 0;
    const len = Math.min(currentBins.length, prevSpectrum.length);
    for (let i = 0; i < len; i++) {
        const current = currentBins[i] / 255;
        const diff = current - prevSpectrum[i];
        if (diff > 0) {
            flux += diff;
        }
        prevSpectrum[i] = current;
    }
    return flux / len;
}
