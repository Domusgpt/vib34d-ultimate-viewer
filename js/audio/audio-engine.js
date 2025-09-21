/**
 * VIB34D Audio Engine Module
 * Mobile-safe audio reactivity system with global window integration
 * Extracted from monolithic index.html for clean architecture
 */

// Global audio state flags - CRITICAL for system integration
window.audioEnabled = false; // Global audio flag (will auto-enable on interaction)

/**
 * Simple Audio Engine - Mobile-safe and actually works
 * Provides real-time audio analysis for all visualization systems
 */
export class SimpleAudioEngine {
    constructor() {
        this.context = null;
        this.analyser = null;
        this.dataArray = null;
        this.isActive = false;
        this.mode = 'idle'; // 'idle' | 'microphone' | 'track' | 'fallback'
        this.sourceNode = null;
        this.currentStream = null;
        this.trackElement = null;
        this.trackUrl = null;
        this.processing = false;
        this.modeListeners = new Set();
        this.fallbackTempo = 110;
        this.fallbackPhase = 0;
        this.fallbackLastTime = performance.now();

        // Mobile-safe: Initialize with defaults
        window.audioReactive = {
            bass: 0,
            mid: 0,
            high: 0,
            energy: 0,
            mode: 'idle',
            bpm: 0
        };

        console.log('🎵 Audio Engine: Initialized with default values');
    }

    /**
     * Initialize the audio engine with microphone or optional track input
     */
    async init(options = {}) {
        const { trackUrl = null, fallbackTempo = null, autoplay = true } = options;

        // Resume context if already active
        await this.ensureContext();
        await this.setupAnalyser();

        if (this.isActive) {
            if (trackUrl && trackUrl !== this.trackUrl) {
                return this.useTrack(trackUrl, { autoplay });
            }
            if (!trackUrl && this.mode === 'track') {
                return this.useMicrophone();
            }
            return true;
        }

        try {
            if (trackUrl) {
                await this.connectTrack(trackUrl, { autoplay });
            } else {
                await this.connectMicrophone();
            }

            this.isActive = true;
            window.audioEnabled = true;
            this.startProcessing();
            return true;
        } catch (error) {
            console.warn('⚠️ Audio init failed, switching to fallback metronome:', error);
            await this.enableFallback(fallbackTempo || this.fallbackTempo);
            this.isActive = true;
            window.audioEnabled = true;
            this.startProcessing();
            return false;
        }
    }

    /**
     * Ensure audio context exists and is running
     */
    async ensureContext() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
        return this.context;
    }

    /**
     * Configure analyser node
     */
    async setupAnalyser() {
        if (!this.analyser && this.context) {
            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.75;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        }
    }

    /**
     * Disconnect any active audio sources
     */
    disconnectSources() {
        if (this.sourceNode) {
            try { this.sourceNode.disconnect(); } catch (e) { console.warn('Audio source disconnect issue:', e); }
            this.sourceNode = null;
        }
        if (this.currentStream) {
            try {
                this.currentStream.getTracks().forEach(track => track.stop());
            } catch (e) {
                console.warn('Audio stream stop issue:', e);
            }
            this.currentStream = null;
        }
        if (this.trackElement) {
            try {
                this.trackElement.pause();
            } catch (e) {
                console.warn('Audio track pause issue:', e);
            }
            this.trackElement.src = '';
            this.trackElement = null;
        }
        this.trackUrl = null;
    }

    /**
     * Connect microphone input
     */
    async connectMicrophone() {
        this.disconnectSources();
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Microphone access not supported');
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.currentStream = stream;
        this.sourceNode = this.context.createMediaStreamSource(stream);
        this.sourceNode.connect(this.analyser);
        this.setMode('microphone');
    }

    /**
     * Connect an audio track
     */
    async connectTrack(trackUrl, options = {}) {
        this.disconnectSources();
        const { autoplay = true, loop = true } = options;
        const audioElement = new Audio();
        audioElement.crossOrigin = 'anonymous';
        audioElement.src = trackUrl;
        audioElement.loop = loop;

        if (autoplay) {
            try {
                await audioElement.play();
            } catch (error) {
                console.warn('Auto-play blocked, waiting for user interaction:', error.message);
            }
        }

        this.trackElement = audioElement;
        this.sourceNode = this.context.createMediaElementSource(audioElement);
        this.sourceNode.connect(this.analyser);
        this.sourceNode.connect(this.context.destination);
        this.trackUrl = trackUrl;
        this.setMode('track');
    }

    /**
     * Public helper to switch back to microphone mode
     */
    async useMicrophone() {
        try {
            await this.connectMicrophone();
            this.isActive = true;
            this.startProcessing();
            return true;
        } catch (error) {
            console.warn('Microphone activation failed, keeping fallback:', error.message);
            await this.enableFallback(this.fallbackTempo);
            this.startProcessing();
            return false;
        }
    }

    /**
     * Public helper to switch to an external track
     */
    async useTrack(trackUrl, options = {}) {
        await this.ensureContext();
        await this.setupAnalyser();
        if (!trackUrl) {
            return this.useMicrophone();
        }
        try {
            await this.connectTrack(trackUrl, options);
            this.isActive = true;
            this.startProcessing();
            return true;
        } catch (error) {
            console.error('Failed to load external track:', error);
            return false;
        }
    }

    /**
     * Enable fallback metronome mode
     */
    async enableFallback(tempo = 110) {
        await this.ensureContext();
        this.disconnectSources();
        this.fallbackTempo = tempo;
        this.fallbackPhase = 0;
        this.fallbackLastTime = performance.now();
        this.setMode('fallback');
    }

    /**
     * Register a listener for mode changes
     */
    onModeChange(listener) {
        if (typeof listener === 'function') {
            this.modeListeners.add(listener);
            return () => this.modeListeners.delete(listener);
        }
        return () => {};
    }

    setMode(mode, reason = '') {
        if (this.mode === mode) return;
        this.mode = mode;
        window.audioReactive.mode = mode;
        this.modeListeners.forEach(listener => {
            try {
                listener(mode, reason);
            } catch (error) {
                console.warn('Audio mode listener error:', error);
            }
        });
    }

    /**
     * Start processing loop
     */
    startProcessing() {
        if (this.processing) return;
        this.processing = true;

        const process = () => {
            if (!this.processing) return;

            if (!this.isActive) {
                requestAnimationFrame(process);
                return;
            }

            if (this.mode === 'fallback') {
                this.updateFallbackReactive();
            } else if (this.analyser && this.dataArray) {
                this.analyser.getByteFrequencyData(this.dataArray);

                const len = this.dataArray.length;
                const bassRange = Math.max(1, Math.floor(len * 0.1));
                const midRange = Math.max(bassRange + 1, Math.floor(len * 0.35));

                let bass = 0, mid = 0, high = 0;

                for (let i = 0; i < bassRange; i++) bass += this.dataArray[i];
                for (let i = bassRange; i < midRange; i++) mid += this.dataArray[i];
                for (let i = midRange; i < len; i++) high += this.dataArray[i];

                bass = (bass / bassRange) / 255;
                mid = (mid / (midRange - bassRange)) / 255;
                high = (high / (len - midRange)) / 255;

                this.applySmoothing({ bass, mid, high }, 0.7);
            }

            requestAnimationFrame(process);
        };

        requestAnimationFrame(process);
    }

    /**
     * Apply smoothing to global audioReactive object
     */
    applySmoothing(levels, smoothing = 0.7) {
        const reactive = window.audioReactive || {};
        reactive.bass = levels.bass * smoothing + (reactive.bass || 0) * (1 - smoothing);
        reactive.mid = levels.mid * smoothing + (reactive.mid || 0) * (1 - smoothing);
        reactive.high = levels.high * smoothing + (reactive.high || 0) * (1 - smoothing);
        reactive.energy = (reactive.bass + reactive.mid + reactive.high) / 3;
        reactive.mode = this.mode;
        window.audioReactive = reactive;
    }

    /**
     * Generate synthetic audio levels when running without real audio
     */
    updateFallbackReactive() {
        const now = performance.now();
        const dt = (now - this.fallbackLastTime) / 1000;
        this.fallbackLastTime = now;

        const beatFrequency = (this.fallbackTempo || 110) / 60;
        this.fallbackPhase = (this.fallbackPhase + dt * beatFrequency) % 1;

        const bass = Math.max(0, Math.sin(this.fallbackPhase * Math.PI));
        const mid = Math.max(0, Math.sin(((this.fallbackPhase + 0.33) % 1) * Math.PI));
        const high = Math.max(0, Math.sin(((this.fallbackPhase + 0.66) % 1) * Math.PI));

        this.applySmoothing({
            bass: bass * 0.95 + Math.random() * 0.05,
            mid: mid * 0.9 + Math.random() * 0.04,
            high: high * 0.85 + Math.random() * 0.03
        }, 0.6);
    }

    /**
     * Check if audio processing is active
     */
    isAudioActive() {
        return this.isActive && this.mode !== 'idle';
    }

    /**
     * Stop audio processing and clean up resources
     */
    stop() {
        this.processing = false;
        this.isActive = false;
        window.audioEnabled = false;
        this.setMode('idle');

        if (this.context) {
            try {
                this.context.close();
            } catch (error) {
                console.warn('Audio context close issue:', error);
            }
            this.context = null;
        }

        this.disconnectSources();
        this.analyser = null;
        this.dataArray = null;

        window.audioReactive = {
            bass: 0,
            mid: 0,
            high: 0,
            energy: 0,
            mode: 'idle',
            bpm: 0
        };

        console.log('🎵 Audio Engine: Stopped');
    }
}

/**
 * Audio Toggle Function - Global function for UI integration
 * Toggles audio reactivity and updates UI state
 */
export function setupAudioToggle() {
    window.toggleAudio = async function() {
        const audioBtn = document.querySelector('[onclick="toggleAudio()"]');

        if (!window.audioEngine.isActive) {
            const success = await window.audioEngine.init();
            if (success) {
                window.audioEnabled = true;
                if (audioBtn) {
                    audioBtn.style.background = 'linear-gradient(45deg, rgba(0, 255, 0, 0.3), rgba(0, 255, 0, 0.6))';
                    audioBtn.style.borderColor = '#00ff00';
                    audioBtn.title = 'Audio Reactivity: ON';
                }
                console.log('🎵 Audio Reactivity: ON');
            } else {
                console.log('⚠️ Audio permission denied or not available - fallback metronome active');
                if (audioBtn) {
                    audioBtn.style.background = 'linear-gradient(45deg, rgba(255, 140, 0, 0.2), rgba(255, 99, 71, 0.4))';
                    audioBtn.style.borderColor = '#ff8c00';
                    audioBtn.title = 'Audio Reactivity: Fallback';
                }
            }
        } else {
            const audioEnabled = !window.audioEnabled;
            window.audioEnabled = audioEnabled;

            if (!audioEnabled) {
                window.audioEngine.stop();
            } else {
                await window.audioEngine.init();
            }

            if (audioBtn) {
                audioBtn.style.background = audioEnabled
                    ? 'linear-gradient(45deg, rgba(0, 255, 0, 0.3), rgba(0, 255, 0, 0.6))'
                    : 'linear-gradient(45deg, rgba(255, 0, 255, 0.1), rgba(255, 0, 255, 0.3))';
                audioBtn.style.borderColor = audioEnabled ? '#00ff00' : 'rgba(255, 0, 255, 0.3)';
                audioBtn.title = `Audio Reactivity: ${audioEnabled ? 'ON' : 'OFF'}`;
            }

            console.log(`🎵 Audio Reactivity: ${audioEnabled ? 'ON' : 'OFF'}`);
        }
    };
}

// Create and initialize the global audio engine instance
const audioEngine = new SimpleAudioEngine();
window.audioEngine = audioEngine;

// Set up global audio toggle function
setupAudioToggle();

console.log('🎵 Audio Engine Module: Loaded');
