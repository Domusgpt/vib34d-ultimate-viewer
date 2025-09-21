import { GeometryLibrary } from '../geometry/GeometryLibrary.js';
import { AudioService } from './AudioService.js';

const GEOMETRY_BASE_INDEX = {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 23,
    7: 26
};

const GEOMETRY_LEVEL_CAP = {
    0: 4,
    1: 4,
    2: 4,
    3: 4,
    4: 4,
    5: 3,
    6: 3,
    7: 4
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toLabel = (value) => {
    if (!value) return '';
    return value
        .toString()
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b([a-z])/gi, (match, chr) => chr.toUpperCase());
};

/**
 * Lattice Pulse orchestrates the emergent gameplay loop: every geometry swap,
 * variation, and visual event flows from the detected audio energy. The game
 * exposes a start overlay so players can opt into microphone tracking, link an
 * external track, or fall back to signature metronome rhythms when no audio is
 * available.
 */
export class LatticePulseGame {
    constructor(engine, options = {}) {
        if (!engine) {
            throw new Error('LatticePulseGame requires a rendering engine instance.');
        }

        this.engine = engine;
        this.options = options;
        this.container = options.container || (typeof document !== 'undefined' ? document.body : null);
        this.audioService = options.audioService || new AudioService(options.audioOptions || {});

        this.loop = this.loop.bind(this);
        this.handleBeat = this.handleBeat.bind(this);
        this.pendingObjectUrl = null;

        this.state = 'init';
        this.mode = 'idle';
        this.active = false;
        this.initialized = false;
        this.lastFrameTime = 0;
        this.rafId = null;
        this.beatCounter = 0;
        this.lastBeat = null;
        this.displayEnergy = 0;
        this.energySmoothing = options.energySmoothing ?? 0.82;
        this.lastBandLevels = { bass: 0, mid: 0, treble: 0 };
        this.currentGeometry = null;
        this.currentLevel = null;
        this.currentModeName = null;
        this.currentDominantBand = null;
        this.failureState = null;
        this.lastSignalQuality = 0;
        this.currentHue = 200;
        this.startControls = null;
        this.linkedTrackLabel = null;

        this.geometryDefaults = this.createGeometryDefaults();
        this.visualizerRules = this.createVisualizerRules();

        this.startScreen = null;
        this.startMessage = null;
        this.trackInput = null;
        this.fileInput = null;
        this.hudElements = null;

        this.beatUnsubscribe = this.audioService.onBeat(this.handleBeat);
        this.energyUnsubscribe = this.audioService.onEnergy(payload => this.handleEnergy(payload));
        this.stateUnsubscribe = this.audioService.onStateChange((state, detail) => this.handleAudioStateChange(state, detail));
        this.errorUnsubscribe = this.audioService.onError(error => this.handleAudioError(error));
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        if (!this.container) {
            console.warn('[LatticePulseGame] No DOM container supplied; UI will not be rendered.');
        } else {
            this.injectStyles();
            this.createStartScreen();
            this.createHud();
            this.setHudStatus('Awaiting audio source…', 'info');
        }

        this.state = 'start-screen';
    }

    injectStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('lattice-pulse-styles')) return;

        const style = document.createElement('style');
        style.id = 'lattice-pulse-styles';
        style.textContent = `
            :root {
                --lp-font: 'Inter', 'Segoe UI', sans-serif;
            }
            .lp-hidden { display: none !important; }
            .lp-start {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: radial-gradient(circle at 20% 20%, rgba(64, 88, 255, 0.18), transparent 55%), rgba(6, 8, 18, 0.92);
                backdrop-filter: blur(22px) saturate(120%);
                z-index: 9999;
                padding: 2rem;
                color: #f4f6ff;
                font-family: var(--lp-font);
            }
            .lp-start::before {
                content: '';
                position: absolute;
                inset: 0;
                background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.02) 0, rgba(255, 255, 255, 0.02) 1px, transparent 1px, transparent 4px);
                opacity: 0.35;
                pointer-events: none;
            }
            .lp-start::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(135deg, rgba(255, 0, 153, 0.12), rgba(0, 200, 255, 0.08));
                mix-blend-mode: screen;
                opacity: 0.5;
                pointer-events: none;
                animation: lpStartPulse 12s ease-in-out infinite alternate;
            }
            .lp-start-panel {
                position: relative;
                width: min(520px, 94vw);
                background: linear-gradient(145deg, rgba(14, 18, 36, 0.96), rgba(24, 26, 48, 0.92));
                border: 1px solid rgba(150, 170, 255, 0.4);
                border-radius: 22px;
                box-shadow: 0 40px 80px rgba(0, 0, 0, 0.55);
                padding: 2.25rem;
                display: flex;
                flex-direction: column;
                gap: 1.25rem;
                overflow: hidden;
            }
            .lp-start-panel::before {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(120deg, rgba(255, 88, 196, 0.18), rgba(90, 220, 255, 0.12));
                opacity: 0.6;
                mix-blend-mode: screen;
                pointer-events: none;
            }
            .lp-start-panel::after {
                content: '';
                position: absolute;
                inset: 0;
                background: radial-gradient(circle at 15% 0%, rgba(255, 255, 255, 0.24), transparent 50%);
                opacity: 0.35;
                pointer-events: none;
                filter: blur(40px);
            }
            .lp-title {
                position: relative;
                margin: 0;
                font-size: 1.9rem;
                letter-spacing: 0.16em;
                text-transform: uppercase;
                line-height: 1.1;
                text-shadow: 0 0 18px rgba(120, 150, 255, 0.45);
            }
            .lp-title span:last-child {
                position: absolute;
                inset: 0;
                color: rgba(255, 255, 255, 0.45);
                pointer-events: none;
                clip-path: polygon(0 15%, 100% 0, 100% 85%, 0 100%);
                mix-blend-mode: screen;
                animation: lpGlitch 2.8s steps(2) infinite;
            }
            .lp-tagline {
                margin: -0.4rem 0 0;
                font-size: 0.85rem;
                letter-spacing: 0.28em;
                text-transform: uppercase;
                color: rgba(220, 226, 255, 0.6);
            }
            .lp-start-panel p {
                margin: 0;
                font-size: 0.98rem;
                color: rgba(220, 226, 255, 0.78);
            }
            .lp-spectrum {
                display: flex;
                align-items: flex-end;
                gap: 0.35rem;
                height: 54px;
                padding: 0.1rem 0;
                overflow: hidden;
            }
            .lp-spectrum span {
                flex: 1 1 auto;
                display: block;
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(120, 150, 255, 0.35), rgba(255, 96, 200, 0.45));
                border-radius: 999px;
                opacity: 0.85;
                transform-origin: bottom;
                animation: lpSpectrumWave 2.2s ease-in-out infinite;
                animation-delay: calc(var(--i) * 0.12s);
                box-shadow: 0 12px 24px rgba(110, 140, 255, 0.35);
            }
            .lp-btn {
                position: relative;
                padding: 0.9rem 1.25rem;
                border-radius: 14px;
                border: 1px solid rgba(150, 170, 255, 0.35);
                background: linear-gradient(135deg, rgba(88, 120, 255, 0.75), rgba(160, 90, 255, 0.75));
                color: #ffffff;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.25s ease;
            }
            .lp-btn::after {
                content: '';
                position: absolute;
                inset: 1px;
                border-radius: inherit;
                border: 1px solid rgba(255, 255, 255, 0.18);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }
            .lp-btn:hover:not(:disabled) {
                transform: translateY(-2px) scale(1.01);
                box-shadow: 0 16px 38px rgba(92, 120, 255, 0.45);
            }
            .lp-btn:hover:not(:disabled)::after {
                opacity: 1;
            }
            .lp-btn:disabled {
                cursor: not-allowed;
                opacity: 0.45;
                filter: saturate(0.3);
            }
            .lp-btn.secondary {
                background: linear-gradient(135deg, rgba(90, 200, 255, 0.24), rgba(140, 160, 255, 0.3));
                color: rgba(230, 236, 255, 0.95);
            }
            .lp-btn.ghost {
                background: rgba(22, 26, 46, 0.7);
                color: rgba(230, 236, 255, 0.88);
            }
            .lp-track-row {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            .lp-track-row input[type="text"] {
                flex: 1 1 240px;
                padding: 0.78rem 1rem;
                border-radius: 12px;
                border: 1px solid rgba(150, 170, 255, 0.32);
                background: rgba(10, 14, 28, 0.78);
                color: #f0f4ff;
                transition: border-color 0.2s ease, box-shadow 0.2s ease;
            }
            .lp-track-row input[type="text"]:focus-visible {
                outline: none;
                border-color: rgba(160, 200, 255, 0.65);
                box-shadow: 0 0 0 3px rgba(160, 200, 255, 0.15);
            }
            .lp-track-row input[data-loading="true"] {
                cursor: progress;
                opacity: 0.7;
            }
            .lp-file-input {
                font-size: 0.85rem;
                color: rgba(220, 226, 255, 0.75);
            }
            .lp-start-message {
                padding: 0.85rem 1.1rem;
                border-radius: 12px;
                border: 1px solid rgba(120, 140, 220, 0.35);
                background: rgba(18, 22, 40, 0.82);
                color: rgba(220, 226, 255, 0.85);
                min-height: 2.5rem;
                display: flex;
                align-items: center;
                font-size: 0.9rem;
                letter-spacing: 0.03em;
            }
            .lp-message-info { border-color: rgba(120, 140, 220, 0.45); }
            .lp-message-success { border-color: rgba(90, 220, 170, 0.45); color: rgba(210, 255, 240, 0.92); }
            .lp-message-warning { border-color: rgba(255, 200, 120, 0.45); color: rgba(255, 230, 190, 0.94); }
            .lp-message-error { border-color: rgba(255, 120, 120, 0.55); color: rgba(255, 210, 210, 0.95); }
            .lp-hud {
                position: fixed;
                top: 1.5rem;
                right: 1.5rem;
                width: min(380px, 94vw);
                padding: 1.2rem 1.35rem;
                border-radius: 22px;
                background: linear-gradient(145deg, rgba(8, 12, 26, 0.88), rgba(16, 20, 36, 0.86));
                color: #f4f8ff;
                border: 1px solid rgba(120, 150, 255, 0.32);
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
                backdrop-filter: blur(18px) saturate(125%);
                z-index: 9980;
                font-family: var(--lp-font);
                transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;
            }
            .lp-hud::before {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: inherit;
                border: 1px solid rgba(255, 255, 255, 0.08);
                opacity: 0.65;
                pointer-events: none;
            }
            .lp-hud::after {
                content: '';
                position: absolute;
                inset: 15% 10%;
                border-radius: inherit;
                background: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.18), transparent 70%);
                opacity: 0.35;
                pointer-events: none;
                filter: blur(24px);
            }
            .lp-hud[data-intensity="eruption"] {
                transform: translateY(-4px);
            }
            .lp-hud-title {
                font-size: 1.08rem;
                font-weight: 700;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                margin-bottom: 0.5rem;
                color: rgba(198, 210, 255, 0.95);
            }
            .lp-hud-status {
                padding: 0.55rem 0.85rem;
                border-radius: 12px;
                font-size: 0.88rem;
                border: 1px solid transparent;
                margin-bottom: 0.95rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                display: inline-flex;
                align-items: center;
                gap: 0.35rem;
            }
            .lp-status-info { background: rgba(100, 130, 255, 0.14); border-color: rgba(120, 150, 255, 0.4); color: rgba(200, 214, 255, 0.9); }
            .lp-status-success { background: rgba(90, 220, 170, 0.18); border-color: rgba(110, 240, 190, 0.45); color: rgba(220, 255, 245, 0.93); }
            .lp-status-warning { background: rgba(255, 190, 120, 0.2); border-color: rgba(255, 210, 140, 0.48); color: rgba(255, 232, 210, 0.95); }
            .lp-status-error { background: rgba(255, 120, 120, 0.2); border-color: rgba(255, 140, 140, 0.55); color: rgba(255, 220, 220, 0.96); }
            .lp-hud-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 0.65rem 1rem;
                margin: 0;
            }
            .lp-hud-grid div {
                display: flex;
                flex-direction: column;
                gap: 0.16rem;
            }
            .lp-hud-grid dt {
                font-size: 0.68rem;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                color: rgba(200, 210, 255, 0.62);
                margin: 0;
            }
            .lp-hud-grid dd {
                margin: 0;
                font-size: 0.98rem;
                font-weight: 600;
                color: rgba(245, 248, 255, 0.96);
                word-break: break-word;
            }
            .lp-pulse-meter {
                margin-top: 0.9rem;
                height: 10px;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.16);
                background: rgba(255, 255, 255, 0.08);
                overflow: hidden;
                position: relative;
            }
            .lp-pulse-meter span {
                display: block;
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, rgba(255, 110, 220, 0.7), rgba(110, 170, 255, 0.85));
                box-shadow: 0 0 18px rgba(120, 150, 255, 0.55);
                transition: width 0.18s ease, filter 0.28s ease;
            }
            .lp-hud-warning {
                margin-top: 0.85rem;
                font-size: 0.85rem;
                min-height: 1.2rem;
                color: rgba(255, 200, 200, 0.92);
            }
            .lp-hud[data-band="bass"] { border-color: rgba(255, 150, 170, 0.38); }
            .lp-hud[data-band="mid"] { border-color: rgba(140, 200, 255, 0.38); }
            .lp-hud[data-band="treble"] { border-color: rgba(170, 140, 255, 0.4); }
            .lp-hud[data-state="metronome"] .lp-hud-status { animation: lpStatusPulse 2.8s ease-in-out infinite; }
            @keyframes lpStartPulse {
                0% { opacity: 0.4; }
                50% { opacity: 0.7; }
                100% { opacity: 0.4; }
            }
            @keyframes lpSpectrumWave {
                0%, 100% { transform: scaleY(0.2); opacity: 0.6; }
                50% { transform: scaleY(1); opacity: 1; }
            }
            @keyframes lpGlitch {
                0%, 100% { transform: translate(0); opacity: 0.4; }
                33% { transform: translate(-2px, 1px); opacity: 0.8; }
                66% { transform: translate(2px, -2px); opacity: 0.5; }
            }
            @keyframes lpStatusPulse {
                0%, 100% { filter: drop-shadow(0 0 0 rgba(255, 255, 255, 0)); }
                50% { filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.35)); }
            }
            @media (max-width: 640px) {
                .lp-start { padding: 1.3rem; }
                .lp-start-panel { padding: 1.75rem; gap: 1rem; }
                .lp-hud { left: 0.75rem; right: 0.75rem; top: auto; bottom: 0.85rem; width: auto; }
                .lp-hud::after { inset: 18% 18%; }
            }
        `
        document.head.appendChild(style);
    }

    createStartScreen() {
        if (!this.container || typeof document === 'undefined') return;

        const overlay = document.createElement('div');
        overlay.className = 'lp-start';

        const panel = document.createElement('div');
        panel.className = 'lp-start-panel';

        const title = document.createElement('h2');
        title.className = 'lp-title';
        title.innerHTML = '<span>Lattice Pulse</span><span aria-hidden="true">Lattice Pulse</span>';

        const tagline = document.createElement('p');
        tagline.className = 'lp-tagline';
        tagline.textContent = 'Vaporwave glitch sequencer for living geometry.';

        const description = document.createElement('p');
        description.textContent = 'Tune in a live source or drop a track – every lattice event bends to the beat.';

        const spectrum = document.createElement('div');
        spectrum.className = 'lp-spectrum';
        for (let i = 0; i < 12; i += 1) {
            const bar = document.createElement('span');
            bar.style.setProperty('--i', String(i));
            spectrum.appendChild(bar);
        }

        const micButton = document.createElement('button');
        micButton.className = 'lp-btn';
        micButton.textContent = 'Use Microphone Tempo';
        micButton.addEventListener('click', () => this.startWithMicrophone());

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            micButton.disabled = true;
            micButton.title = 'Microphone access is not supported on this device.';
            micButton.dataset.permanentDisable = 'true';
        }

        const trackRow = document.createElement('div');
        trackRow.className = 'lp-track-row';

        const trackInput = document.createElement('input');
        trackInput.type = 'text';
        trackInput.placeholder = 'Paste audio stream URL (mp3/ogg)';
        trackInput.spellcheck = false;
        trackRow.appendChild(trackInput);
        this.trackInput = trackInput;

        const trackButton = document.createElement('button');
        trackButton.className = 'lp-btn secondary';
        trackButton.textContent = 'Link Audio';
        trackButton.addEventListener('click', () => this.startWithTrack(trackInput.value));
        trackRow.appendChild(trackButton);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.className = 'lp-file-input';
        fileInput.addEventListener('change', (event) => {
            const file = event.target?.files?.[0];
            if (!file) return;
            const objectUrl = URL.createObjectURL(file);
            this.startWithTrack(objectUrl, { revokeUrl: true, sourceLabel: file.name });
        });
        this.fileInput = fileInput;

        const fallbackButton = document.createElement('button');
        fallbackButton.className = 'lp-btn ghost';
        fallbackButton.textContent = 'Signature Metronome Mode';
        fallbackButton.addEventListener('click', () => this.startWithMetronome('manual'));

        const message = document.createElement('div');
        message.className = 'lp-start-message lp-message-info';
        message.textContent = 'Microphone mode provides the richest experience.';
        message.setAttribute('role', 'status');
        message.setAttribute('aria-live', 'polite');
        this.startMessage = message;

        panel.append(title, tagline, description, spectrum, micButton, trackRow, fileInput, fallbackButton, message);
        overlay.appendChild(panel);
        this.container.appendChild(overlay);
        this.startScreen = overlay;
        this.startControls = { mic: micButton, track: trackButton, fallback: fallbackButton };
    }

    createHud() {
        if (!this.container || typeof document === 'undefined') return;

        const hud = document.createElement('div');
        hud.className = 'lp-hud lp-hidden';
        hud.dataset.state = 'idle';

        const title = document.createElement('div');
        title.className = 'lp-hud-title';
        title.textContent = 'Lattice Pulse HUD';

        const status = document.createElement('div');
        status.className = 'lp-hud-status lp-status-info';
        status.textContent = 'Awaiting audio source…';

        const grid = document.createElement('div');
        grid.className = 'lp-hud-grid';

        const createRow = (label, className) => {
            const wrapper = document.createElement('div');
            const dt = document.createElement('dt');
            dt.textContent = label;
            const dd = document.createElement('dd');
            dd.className = className;
            dd.textContent = '—';
            wrapper.appendChild(dt);
            wrapper.appendChild(dd);
            grid.appendChild(wrapper);
            return dd;
        };

        const source = createRow('Source', 'lp-hud-source');
        const bpm = createRow('Tempo', 'lp-hud-bpm');
        const energy = createRow('Energy', 'lp-hud-energy');
        const signal = createRow('Signal Lock', 'lp-hud-signal');
        const dominant = createRow('Dominant', 'lp-hud-dominant');
        const geometry = createRow('Geometry', 'lp-hud-geometry');
        const mode = createRow('Mode', 'lp-hud-mode');

        const failure = document.createElement('div');
        failure.className = 'lp-hud-warning';
        failure.textContent = '';

        const pulseMeter = document.createElement('div');
        pulseMeter.className = 'lp-pulse-meter';
        const pulseBar = document.createElement('span');
        pulseMeter.appendChild(pulseBar);

        hud.append(title, status, grid, pulseMeter, failure);
        this.container.appendChild(hud);

        this.hudElements = {
            root: hud,
            status,
            source,
            bpm,
            energy,
            signal,
            dominant,
            geometry,
            mode,
            failure,
            meter: pulseBar
        };
    }

    createGeometryDefaults() {
        return [
            { geometry: 0, name: 'Tetra Cascade', levels: [0, 1, 2, 3], hueShift: 24, step: 0 },
            { geometry: 1, name: 'Hypercube Surge', levels: [0, 2, 1, 3], hueShift: 212, step: 0 },
            { geometry: 2, name: 'Sphere Bloom', levels: [1, 3, 2, 0], hueShift: 180, step: 0 },
            { geometry: 3, name: 'Torus Orbit', levels: [1, 3, 2, 0], hueShift: 48, step: 0 },
            { geometry: 4, name: 'Klein Drift', levels: [0, 3, 1, 2], hueShift: 302, step: 0 },
            { geometry: 5, name: 'Fractal Ember', levels: [0, 2, 1], hueShift: 16, step: 0 },
            { geometry: 6, name: 'Wave Surge', levels: [0, 2, 1], hueShift: 198, step: 0 },
            { geometry: 7, name: 'Crystal Prism', levels: [1, 3, 2, 0], hueShift: 258, step: 0 }
        ];
    }

    createVisualizerRules() {
        return [
            {
                id: 'bass-resonance',
                band: 'bass',
                label: 'Graviton Pulse',
                geometryChoices: [3, 5, 0],
                morphBoost: 0.22,
                chaosBoost: 0.18,
                saturationBoost: 0.08
            },
            {
                id: 'mid-vector',
                band: 'mid',
                label: 'Vector Bloom',
                geometryChoices: [1, 6, 4],
                morphBoost: 0.16,
                chaosBoost: 0.24,
                saturationBoost: 0.12
            },
            {
                id: 'treble-diffraction',
                band: 'treble',
                label: 'Photon Cascade',
                geometryChoices: [2, 7, 3],
                morphBoost: 0.3,
                chaosBoost: 0.14,
                saturationBoost: 0.22
            }
        ];
    }

    setStartMessage(message, type = 'info') {
        if (!this.startMessage) return;
        this.startMessage.textContent = message;
        this.startMessage.className = `lp-start-message lp-message-${type}`;
    }

    setStartControlsDisabled(disabled) {
        if (!this.startControls) return;
        Object.values(this.startControls).forEach(control => {
            if (!control) return;
            if (disabled) {
                if (!control.disabled) {
                    control.dataset.lpTempDisabled = 'true';
                    control.disabled = true;
                }
            } else if (control.dataset.lpTempDisabled) {
                delete control.dataset.lpTempDisabled;
                if (control.dataset.permanentDisable === 'true') {
                    control.disabled = true;
                } else {
                    control.disabled = false;
                }
            }
        });
    }

    setHudStatus(message, type = 'info') {
        if (!this.hudElements?.status) return;
        const statusEl = this.hudElements.status;
        statusEl.textContent = message;
        statusEl.className = `lp-hud-status lp-status-${type}`;
        statusEl.dataset.variant = type;
    }

    async startWithMicrophone() {
        this.setStartMessage('Requesting microphone access…', 'info');
        this.setStartControlsDisabled(true);
        try {
            const granted = await this.audioService.useMicrophone();
            if (granted) {
                this.mode = 'microphone';
                this.linkedTrackLabel = 'Live microphone';
                this.setStartMessage('Microphone linked. Listening for live tempo…', 'success');
                this.beginGame(false);
            } else {
                const reason = this.describeMetronomeReason(this.audioService.getMetronomeReason());
                this.mode = 'metronome';
                this.linkedTrackLabel = null;
                this.setStartMessage(`Microphone unavailable${reason ? ` (${reason})` : ''}. Using signature rhythms instead.`, 'error');
                this.beginGame(true);
            }
        } finally {
            this.setStartControlsDisabled(false);
        }
    }

    async startWithTrack(url, extraOptions = {}) {
        const trimmed = (url || '').trim();
        if (!trimmed) {
            this.setStartMessage('Enter a direct audio URL or select a file.', 'warning');
            return;
        }
        this.setStartMessage('Linking audio stream…', 'info');
        this.setStartControlsDisabled(true);
        if (this.trackInput) {
            this.trackInput.setAttribute('data-loading', 'true');
            this.trackInput.disabled = true;
        }
        let success = false;
        try {
            success = await this.audioService.useTrack(trimmed, extraOptions.trackOptions || {});
        } finally {
            if (this.trackInput) {
                this.trackInput.removeAttribute('data-loading');
                this.trackInput.disabled = false;
            }
            this.setStartControlsDisabled(false);
        }

        if (extraOptions.revokeUrl) {
            if (this.pendingObjectUrl && this.pendingObjectUrl !== trimmed) {
                URL.revokeObjectURL(this.pendingObjectUrl);
            }
            this.pendingObjectUrl = trimmed;
        }

        if (success) {
            this.mode = 'track';
            this.linkedTrackLabel = extraOptions.sourceLabel || this.formatSourceLabel(trimmed);
            this.setStartMessage('Audio stream connected. Detecting beat phase…', 'success');
            this.beginGame(false);
        } else {
            this.mode = 'metronome';
            this.linkedTrackLabel = null;
            this.setStartMessage('Failed to play the audio stream. Engaging signature fallback.', 'error');
            this.beginGame(true);
        }
    }

    startWithMetronome(reason = 'manual') {
        this.audioService.enableMetronome(reason);
        this.mode = 'metronome';
        this.linkedTrackLabel = null;
        this.setStartMessage('Signature rhythm activated. Visuals will use emergent defaults.', 'warning');
        this.beginGame(true);
    }

    beginGame(isFallback = false) {
        if (this.startScreen) {
            this.startScreen.classList.add('lp-hidden');
        }
        if (this.hudElements?.root) {
            this.hudElements.root.classList.remove('lp-hidden');
        }

        this.state = 'running';
        this.active = true;
        this.beatCounter = 0;
        this.geometryDefaults.forEach(mode => { mode.step = 0; });
        this.currentModeName = null;
        this.currentDominantBand = null;
        this.failureState = null;
        this.lastBeat = null;
        this.displayEnergy = 0;
        this.lastSignalQuality = 0;
        this.currentHue = 200;
        this.lastFrameTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        this.rafId = requestAnimationFrame(this.loop);

        if (isFallback) {
            this.setHudStatus('Fallback signature rhythm active.', 'warning');
        } else if (this.mode === 'microphone') {
            this.setHudStatus('Microphone tempo tracking active.', 'success');
        } else {
            this.setHudStatus('Linked audio stream active.', 'success');
        }

        if (this.hudElements?.root) {
            this.hudElements.root.dataset.state = this.mode;
        }
    }
    loop(timestamp) {
        if (!this.active) return;

        if (!this.lastFrameTime) {
            this.lastFrameTime = timestamp;
        }
        const delta = (timestamp - this.lastFrameTime) / 1000;
        this.lastFrameTime = timestamp;

        this.audioService.update(delta, timestamp);

        const currentEnergy = this.audioService.getEnergy();
        this.displayEnergy = this.displayEnergy * this.energySmoothing + currentEnergy * (1 - this.energySmoothing);
        this.refreshHud();

        this.rafId = requestAnimationFrame(this.loop);
    }

    handleBeat(beat) {
        this.beatCounter += 1;
        this.lastBeat = beat;
        if (beat?.bandLevels) {
            this.lastBandLevels = beat.bandLevels;
        }
        this.displayEnergy = beat?.energy ?? this.displayEnergy;
        if (typeof beat?.analysisQuality === 'number') {
            this.lastSignalQuality = beat.analysisQuality;
        }

        let event;
        if (beat?.source === 'metronome' && beat.signature) {
            event = this.buildFallbackEvent(beat);
        } else {
            event = this.buildAudioDrivenEvent(beat);
        }

        if (event) {
            this.applyGeometryEvent(event, beat);
        }

        this.refreshHud(beat, event);
        return event;
    }

    handleEnergy(payload) {
        if (!payload) return;
        this.lastBandLevels = payload.bandLevels || this.lastBandLevels;
        const smoothing = this.energySmoothing;
        this.displayEnergy = this.displayEnergy * smoothing + payload.energy * (1 - smoothing);
        if (typeof payload.analysisQuality === 'number') {
            this.lastSignalQuality = payload.analysisQuality;
        }
        this.refreshHud();
    }

    handleAudioStateChange(state, detail) {
        this.mode = state;
        if (state === 'metronome' && detail?.reason) {
            this.failureState = this.describeMetronomeReason(detail.reason);
            if (detail.reason === 'silence') {
                this.setHudStatus('Live input silent – signature rescue engaged.', 'warning');
            } else {
                this.setHudStatus(`Fallback mode: ${this.failureState || 'signature sequence'}`, 'warning');
            }
        } else if (state === 'microphone') {
            this.failureState = null;
            if (detail?.reason === 'signal-resumed') {
                this.setHudStatus('Live signal reacquired.', 'success');
            } else {
                this.setHudStatus('Microphone tempo tracking active.', 'success');
            }
        } else if (state === 'track') {
            this.failureState = null;
            if (detail?.reason === 'signal-resumed') {
                this.setHudStatus('Linked audio stream re-synced.', 'success');
            } else {
                this.setHudStatus('Linked audio stream active.', 'success');
            }
        }
        if (this.hudElements?.root) {
            this.hudElements.root.dataset.state = state;
        }
        this.refreshHud();
    }

    handleAudioError(error) {
        const message = error?.message || 'Unexpected audio error';
        this.failureState = message;
        if (this.state === 'start-screen') {
            this.setStartMessage(message, 'error');
        } else {
            this.setHudStatus(message, 'error');
            this.updateFailureHud();
        }
    }

    describeMetronomeReason(reason) {
        if (!reason) return '';
        switch (reason) {
            case 'permission-denied':
                return 'microphone permission denied';
            case 'no-devices':
                return 'no input devices found';
            case 'track-failed':
                return 'linked track unavailable';
            case 'unsupported':
                return 'microphone unsupported';
            case 'hardware-busy':
                return 'input device busy';
            case 'silence':
                return 'live input silent';
            case 'manual':
                return 'manual selection';
            default:
                return toLabel(reason);
        }
    }

    formatSourceLabel(value) {
        if (!value) return '';
        try {
            const base = (typeof window !== 'undefined' && window.location?.href) ? window.location.href : 'http://localhost';
            const url = new URL(value, base);
            const host = (url.hostname || '').replace(/^www\./, '');
            const segments = url.pathname.split('/').filter(Boolean);
            const last = segments.pop();
            if (host && last) {
                const label = decodeURIComponent(last).replace(/\.[^/.]+$/, '');
                const composed = `${host} • ${label}`;
                return composed.length > 64 ? `${composed.slice(0, 61)}…` : composed;
            }
            const fallback = host || decodeURIComponent(last || value);
            return fallback.length > 64 ? `${fallback.slice(0, 61)}…` : fallback;
        } catch (error) {
            const sanitized = value.replace(/^https?:\/\//, '');
            return sanitized.length > 64 ? `${sanitized.slice(0, 61)}…` : sanitized;
        }
    }

    describeSource() {
        const state = this.audioService.getState();
        if (state === 'microphone') {
            return this.linkedTrackLabel || 'Microphone (live tempo)';
        }
        if (state === 'track') {
            const label = this.linkedTrackLabel ? ` – ${this.linkedTrackLabel}` : '';
            return `Linked audio stream${label}`;
        }
        if (state === 'metronome') {
            const reason = this.describeMetronomeReason(this.audioService.getMetronomeReason());
            return `Signature metronome${reason ? ` – ${reason}` : ''}`;
        }
        return 'Inactive';
    }

    describeGeometry() {
        if (this.currentGeometry === null) return '—';
        const name = GeometryLibrary.getGeometryName(this.currentGeometry) || 'UNKNOWN';
        const level = (this.currentLevel ?? 0) + 1;
        return `${name} · Lv.${level}`;
    }

    refreshHud(beat = null, event = null) {
        if (!this.hudElements) return;

        if (this.hudElements.source) {
            this.hudElements.source.textContent = this.describeSource();
        }
        if (this.hudElements.bpm) {
            const bpmValue = beat?.bpm || this.audioService.getCurrentBpm() || 0;
            this.hudElements.bpm.textContent = bpmValue ? `${Math.round(bpmValue)} BPM` : '—';
        }
        if (this.hudElements.energy) {
            this.hudElements.energy.textContent = `${Math.round(clamp(this.displayEnergy, 0, 1) * 100)}%`;
        }
        if (this.hudElements.signal) {
            const signalValue = clamp(this.lastSignalQuality ?? this.audioService.getAnalysisQuality(), 0, 1);
            this.hudElements.signal.textContent = signalValue ? `${Math.round(signalValue * 100)}%` : '—';
        }
        if (this.hudElements.dominant) {
            const dominant = event?.dominantBand || this.getDominantBand(this.lastBandLevels);
            this.hudElements.dominant.textContent = dominant ? dominant.toUpperCase() : '—';
            this.currentDominantBand = dominant;
        }
        if (this.hudElements.geometry) {
            this.hudElements.geometry.textContent = this.describeGeometry();
        }
        if (this.hudElements.mode) {
            const modeName = event?.modeName || this.currentModeName || 'Waiting for beat…';
            this.hudElements.mode.textContent = modeName;
            this.currentModeName = modeName;
        }

        if (this.hudElements.root) {
            this.hudElements.root.dataset.state = this.mode;
        }

        this.updateHudTheme(event);

        this.updateFailureHud();
    }

    updateFailureHud() {
        if (!this.hudElements?.failure) return;
        this.hudElements.failure.textContent = this.failureState ? this.failureState : '';
    }

    updateHudTheme(event = null) {
        if (!this.hudElements?.root) return;
        const root = this.hudElements.root;
        const energyValue = clamp(this.displayEnergy, 0, 1);
        const signalValue = clamp(this.lastSignalQuality ?? this.audioService.getAnalysisQuality(), 0, 1);
        const dominant = event?.dominantBand || this.currentDominantBand || 'none';
        root.dataset.band = dominant;
        const tempoClass = event?.tempoClass || this.classifyTempo(this.audioService.getCurrentBpm());
        root.dataset.tempo = tempoClass;
        const intensityClass = event?.intensityClass || this.classifyIntensity(this.displayEnergy);
        root.dataset.intensity = intensityClass;

        const hue = this.currentHue ?? (this.engine?.parameterManager?.getParameter?.('hue') ?? 200);
        const accentBase = `hsl(${Math.round(hue)}, 90%, 65%)`;
        const accentGlow = `hsla(${Math.round(hue)}, 95%, 68%, ${0.25 + energyValue * 0.35})`;

        root.style.setProperty('--lp-energy', energyValue.toFixed(3));
        root.style.setProperty('--lp-signal', signalValue.toFixed(3));
        root.style.setProperty('--lp-accent', accentBase);
        root.style.boxShadow = `0 24px 60px rgba(0, 0, 0, 0.45), 0 0 ${Math.round(24 + energyValue * 80)}px ${accentGlow}`;
        root.style.borderColor = `hsla(${Math.round(hue)}, 85%, 68%, ${0.3 + signalValue * 0.3})`;

        if (this.hudElements.meter) {
            this.hudElements.meter.style.width = `${Math.round(energyValue * 100)}%`;
        }
    }
    computeAudioRandom(...values) {
        let seed = 0;
        for (let i = 0; i < values.length; i++) {
            seed += (values[i] || 0) * (i + 1) * 9973.217;
        }
        seed += this.beatCounter * 17.318;
        const x = Math.sin(seed * 12.9898) * 43758.5453;
        return x - Math.floor(x);
    }

    getDominantBand(bandLevels = {}) {
        const entries = [
            ['bass', bandLevels.bass ?? 0],
            ['mid', bandLevels.mid ?? 0],
            ['treble', bandLevels.treble ?? 0]
        ];
        entries.sort((a, b) => b[1] - a[1]);
        return entries[0][1] > 0 ? entries[0][0] : null;
    }

    classifyTempo(bpm) {
        if (!bpm) return 'unknown';
        if (bpm < 95) return 'slow';
        if (bpm < 128) return 'moderate';
        return 'fast';
    }

    classifyIntensity(energy) {
        const value = clamp(energy ?? 0, 0, 1);
        if (value < 0.25) return 'ambient';
        if (value < 0.55) return 'groove';
        if (value < 0.8) return 'surge';
        return 'eruption';
    }

    deriveLevelFromAudio(energy, tempoClass, geometry, randomValue) {
        const maxLevel = (GEOMETRY_LEVEL_CAP[geometry] || 4) - 1;
        let level = Math.round(clamp(energy * 4, 0, maxLevel));

        if (tempoClass === 'fast') {
            level = clamp(level + 1, 0, maxLevel);
        } else if (tempoClass === 'slow') {
            level = clamp(level - 1, 0, maxLevel);
        }

        if (randomValue > 0.75) {
            level = clamp(level + 1, 0, maxLevel);
        } else if (randomValue < 0.18) {
            level = clamp(level - 1, 0, maxLevel);
        }

        return level;
    }

    getVariationIndex(geometry, level) {
        const base = GEOMETRY_BASE_INDEX[geometry];
        if (base === undefined) return 0;
        return base + level;
    }

    normalizeLevel(geometry, level) {
        const max = (GEOMETRY_LEVEL_CAP[geometry] || 4) - 1;
        return clamp(Math.round(level), 0, max);
    }

    buildAudioDrivenEvent(beat) {
        const bandLevels = beat?.bandLevels || this.lastBandLevels || this.audioService.getBandLevels();
        const dominant = this.getDominantBand(bandLevels) || 'mid';
        const rule = this.visualizerRules.find(r => r.band === dominant) || this.visualizerRules[0];
        const random = this.computeAudioRandom(beat?.energy ?? 0.5, bandLevels[dominant] ?? 0, this.beatCounter);
        const tempoClass = this.classifyTempo(beat?.bpm || this.audioService.getCurrentBpm());
        const intensityClass = this.classifyIntensity(beat?.energy ?? this.audioService.getEnergy());

        const choices = rule.geometryChoices || [0];
        const choiceIndex = Math.floor(random * choices.length) % choices.length;
        const geometry = choices[choiceIndex];
        const level = this.deriveLevelFromAudio(beat?.energy ?? 0.5, tempoClass, geometry, random);

        const modeName = `${rule.label} ✶ ${tempoClass.toUpperCase()} // ${intensityClass.toUpperCase()}`;

        return {
            geometry,
            level,
            dominantBand: dominant,
            modeName,
            tempoClass,
            intensityClass,
            morphBoost: rule.morphBoost ?? 0,
            chaosBoost: rule.chaosBoost ?? 0,
            saturationBoost: rule.saturationBoost ?? 0,
            paletteHue: undefined,
            random
        };
    }

    buildFallbackEvent(beat) {
        const signature = beat.signature;
        const defaultMode = this.geometryDefaults.find(mode => mode.geometry === signature.geometryHint) || this.geometryDefaults[0];
        const levels = defaultMode.levels || [0, 1, 2, 3];
        const level = levels[defaultMode.step % levels.length];
        defaultMode.step += 1;

        const modeName = `${defaultMode.name} ✶ ${signature.label}`;

        return {
            geometry: defaultMode.geometry,
            level,
            dominantBand: this.getDominantBand(beat.bandLevels) || 'bass',
            modeName,
            tempoClass: this.classifyTempo(beat?.bpm || signature.bpm),
            intensityClass: this.classifyIntensity(beat?.energy ?? signature.energyCurve?.[0] ?? 0.5),
            morphBoost: 0.24,
            chaosBoost: 0.12,
            saturationBoost: 0.1,
            paletteHue: defaultMode.hueShift ?? signature.paletteHue
        };
    }

    applyGeometryEvent(event, beat) {
        if (!event) return;

        const geometry = event.geometry;
        const normalizedLevel = this.normalizeLevel(geometry, event.level);
        const variationIndex = this.getVariationIndex(geometry, normalizedLevel);
        const baseParams = GeometryLibrary.getVariationParameters(geometry, normalizedLevel) || {};

        const bandLevels = beat?.bandLevels || this.lastBandLevels || { bass: 0, mid: 0, treble: 0 };
        const energy = clamp(beat?.energy ?? this.audioService.getEnergy(), 0, 1);
        const bpm = beat?.bpm || this.audioService.getCurrentBpm() || 120;
        const tempoFactor = clamp(bpm / 120, 0.5, 2.2);
        const lastEnergyPayload = this.audioService.getLastEnergyPayload?.();
        const fluxSource = beat?.spectralFlux ?? lastEnergyPayload?.spectralFlux ?? 0;
        const fluxFactor = clamp(fluxSource * 4, 0, 1);
        const signalQuality = clamp(beat?.analysisQuality ?? this.lastSignalQuality ?? this.audioService.getAnalysisQuality(), 0, 1);

        const previous = this.engine?.parameterManager?.getAllParameters?.() || {};

        const newParams = {
            ...previous,
            ...baseParams,
            geometry,
            variation: variationIndex,
            chaos: clamp((baseParams.chaos ?? 0.2) * (0.7 + bandLevels.treble * 0.85 + fluxFactor * 0.2) + event.chaosBoost * energy, 0, 1),
            speed: clamp((baseParams.speed ?? 1) * (0.65 + tempoFactor * 0.5 + bandLevels.bass * 0.4 + signalQuality * 0.3), 0.1, 3),
            morphFactor: clamp((baseParams.morphFactor ?? 1) * (0.8 + bandLevels.mid * 0.55 + event.morphBoost * energy + signalQuality * 0.25), 0, 2),
            gridDensity: clamp((baseParams.gridDensity ?? 12) * (0.75 + bandLevels.treble * 0.6 + energy * 0.35 + fluxFactor * 0.3), 4, 100),
            intensity: clamp(0.28 + energy * 0.6 + signalQuality * 0.25, 0, 1),
            saturation: clamp(0.45 + bandLevels.mid * 0.35 + event.saturationBoost * 0.5 + fluxFactor * 0.18, 0, 1),
            dimension: clamp((previous.dimension ?? 3.5) + (signalQuality - 0.5) * 0.18 + (bandLevels.mid - 0.5) * 0.1, 3, 4.5),
            hue: this.computeHue(baseParams.hue ?? previous.hue ?? 200, event, beat),
            rot4dXW: clamp((previous.rot4dXW ?? 0) + (bandLevels.mid - 0.5) * 0.12 + (fluxFactor - 0.3) * 0.05, -2, 2),
            rot4dYW: clamp((previous.rot4dYW ?? 0) + (bandLevels.treble - 0.5) * 0.14 + (signalQuality - 0.5) * 0.04, -2, 2),
            rot4dZW: clamp((previous.rot4dZW ?? 0) + (bandLevels.bass - 0.5) * 0.1 + (fluxFactor - 0.3) * 0.04, -2, 2)
        };

        if (this.engine?.parameterManager?.setParameters) {
            this.engine.parameterManager.setParameters(newParams);
        }
        if (typeof this.engine.updateVisualizers === 'function') {
            this.engine.updateVisualizers();
        }
        if (typeof this.engine.updateDisplayValues === 'function') {
            this.engine.updateDisplayValues();
        }
        if (typeof this.engine.currentVariation === 'number') {
            this.engine.currentVariation = variationIndex;
        }

        this.currentGeometry = geometry;
        this.currentLevel = normalizedLevel;
        this.currentModeName = event.modeName;
        this.currentHue = newParams.hue;
    }

    computeHue(baseHue, event, beat) {
        const dominant = event?.dominantBand || this.getDominantBand(beat?.bandLevels || this.lastBandLevels) || 'mid';
        let offset = 0;
        if (dominant === 'bass') offset = 28;
        else if (dominant === 'mid') offset = 96;
        else if (dominant === 'treble') offset = 148;

        const tempoShift = (beat?.bpm || this.audioService.getCurrentBpm() || 120) * 0.18;
        const energyShift = (beat?.energy ?? this.audioService.getEnergy()) * 120;
        const signalShift = clamp(beat?.analysisQuality ?? this.audioService.getAnalysisQuality(), 0, 1) * 24;
        const fluxShift = clamp((beat?.spectralFlux ?? this.audioService.getLastEnergyPayload?.()?.spectralFlux ?? 0) * 12, 0, 1) * 18;
        const paletteHue = event?.paletteHue ?? baseHue;

        return Math.round((paletteHue + offset + tempoShift + energyShift + signalShift + fluxShift) % 360);
    }

    stop() {
        this.active = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.state = 'stopped';
        if (this.hudElements?.root) {
            this.hudElements.root.classList.add('lp-hidden');
        }
    }

    destroy() {
        this.stop();
        this.beatUnsubscribe?.();
        this.energyUnsubscribe?.();
        this.stateUnsubscribe?.();
        this.errorUnsubscribe?.();

        if (this.pendingObjectUrl) {
            URL.revokeObjectURL(this.pendingObjectUrl);
            this.pendingObjectUrl = null;
        }

        if (this.startScreen?.parentNode) {
            this.startScreen.parentNode.removeChild(this.startScreen);
        }
        if (this.hudElements?.root?.parentNode) {
            this.hudElements.root.parentNode.removeChild(this.hudElements.root);
        }
        this.startControls = null;
    }
}

export default LatticePulseGame;
