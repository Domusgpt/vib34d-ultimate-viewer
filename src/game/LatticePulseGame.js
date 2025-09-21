import { GameLoop } from './GameLoop.js';
import { AudioService } from './AudioService.js';
import { ModeController } from './ModeController.js';
import { GeometryController } from './GeometryController.js';
import { SpawnSystem } from './SpawnSystem.js';
import { CollisionSystem } from './CollisionSystem.js';
import { InputMapping } from './InputMapping.js';
import { EffectsManager } from './EffectsManager.js';
import { PerformanceController } from './PerformanceController.js';
import { LevelManager } from './LevelManager.js';
import { GameState } from './GameState.js';
import { LocalPersistence } from './persistence/LocalPersistence.js';
import { HUDRenderer } from './ui/HUDRenderer.js';
import { EventDirector } from './EventDirector.js';

let canvasRoot;
let inputLayer;
let hudRoot;
let startScreen;
let startButton;
let modeController;
let audioService;
let geometryController;
let spawnSystem;
let collisionSystem;
let inputMapping;
let effectsManager;
let performanceController;
let levelManager;
let persistence;
let hud;
let gameState;
let currentLevel;
let gameLoop;
let awaitingStart = true;
let startButtonAction = null;
let eventDirector;
let stageTransitioning = false;

window.audioReactive = { bass: 0, mid: 0, high: 0, energy: 0 };

function ready(fn) {
    if (document.readyState !== 'loading') {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}

ready(async () => {
    canvasRoot = document.getElementById('lp-canvas-root');
    inputLayer = document.getElementById('lp-input-layer');
    hudRoot = document.getElementById('lp-hud');
    startScreen = document.getElementById('lp-start-screen');
    startButton = document.getElementById('lp-start-button');
    startButton.addEventListener('click', handleStartButton);

    persistence = new LocalPersistence();
    modeController = new ModeController(canvasRoot);
    audioService = new AudioService();
    collisionSystem = new CollisionSystem();
    effectsManager = new EffectsManager();
    performanceController = new PerformanceController((lod) => modeController.applyLOD(lod));
    hud = new HUDRenderer(hudRoot, persistence);
    inputMapping = new InputMapping(inputLayer);

    levelManager = new LevelManager();
    await levelManager.load();
    currentLevel = levelManager.startRun();
    eventDirector = new EventDirector(audioService, effectsManager, hud, { seed: currentLevel?.seed || Date.now() });

    await configureLevel(currentLevel, { resetRun: true });
    startScreen.querySelector('.lp-start-title').textContent = 'Lattice Pulse';
    startScreen.querySelector('.lp-start-subtitle').textContent = `Depth ${currentLevel.stage} • ${currentLevel.system.toUpperCase()}`;
    startButton.textContent = 'Start';

    setupInput();
    setupAudioCallbacks();

    const update = (dt) => {
        audioService.update(dt);
        if (awaitingStart) return;
        gameState.update(dt);
        eventDirector?.update(dt, gameState);
        gameState.settleParameters(dt);

        const biasedParams = applyGeometryBias(gameState.getParameters(), geometryController.getParameterBias());
        const finalParams = clampParameters(effectsManager.update(dt, biasedParams, gameState));
        const aspect = canvasRoot.clientWidth / canvasRoot.clientHeight;
        const timeScale = Math.max(0.25, Math.min(1.5, gameState.getTimeScale?.() ?? 1));
        const { expiredTargets } = spawnSystem.update(dt * timeScale, finalParams, aspect);
        collisionSystem.rebuild(spawnSystem.getActiveTargets());

        processPulses();
        handleExpired(expiredTargets);

        modeController.updateParameters(finalParams);
        hud.update(gameState);
        checkLevelEnd();
    };

    const render = () => {
        performanceController.beginFrame();
        modeController.render();
        performanceController.endFrame();
    };

    gameLoop = new GameLoop(update, render);

    startButtonAction = async () => {
        if (!awaitingStart) return;
        awaitingStart = false;
        startScreen.classList.add('hidden');
        const audioReady = await audioService.start();
        let status = 'Tap beats, swipe space, double-tap to slow.';
        let variant = 'info';
        if (audioService.isMicrophoneActive()) {
            status = 'Mic reactive: play your music and ride the lattice!';
            variant = 'event';
        } else if (audioService.hasTrackLoaded()) {
            status = 'Track synced. Tap beats, swipe space, double-tap to slow.';
            variant = 'info';
        } else if (audioService.isFallbackActive()) {
            status = 'Geometry groove engaged—allow mic for live-reactive chaos.';
            variant = 'alert';
        } else if (!audioReady) {
            status = 'Audio unavailable. Enable microphone or drop a track.';
            variant = 'alert';
        }
        hud.setStatus(status, variant);
        gameLoop.start();
    };
});

async function handleStartButton() {
    if (typeof startButtonAction === 'function') {
        await startButtonAction();
    }
}

function setupInput() {
    inputMapping.on('rotate', ({ deltaX, deltaY }) => {
        eventDirector?.handleRotate({ deltaX, deltaY }, gameState);
        const factor = 3.0;
        gameState.applyParameterDelta({
            rot4dXW: deltaY * factor,
            rot4dYW: deltaX * factor
        });
    });

    inputMapping.on('pinch', ({ scaleDelta }) => {
        eventDirector?.handlePinch({ scaleDelta }, gameState);
        gameState.applyParameterDelta({ dimension: scaleDelta * 1.2 });
    });

    inputMapping.on('pulse', () => {
        gameState.applyParameterDelta({ intensity: 0.05 });
    });

    inputMapping.on('special', ({ action }) => {
        eventDirector?.handleSpecial(action, gameState);
    });

    inputMapping.on('longpressstart', () => {
        eventDirector?.handleLongPressStart(gameState);
        if (gameState.startPhase()) {
            effectsManager.trigger('shield');
            hud.flash('Phase Shift');
        }
    });

    inputMapping.on('longpressend', () => {
        eventDirector?.handleLongPressEnd(gameState);
        gameState.stopPhase();
    });

    inputMapping.on('tilt', ({ beta, gamma }) => {
        const tiltX = gamma / 180;
        const tiltY = beta / 180;
        gameState.applyParameterDelta({ rot4dXW: tiltY * 0.02, rot4dYW: tiltX * 0.02 });
    });
}

function setupAudioCallbacks() {
    audioService.onBeat((beatInfo) => {
        if (awaitingStart) return;
        eventDirector?.handleBeat(beatInfo, gameState, spawnSystem);
        const directives = eventDirector?.getSpawnDirectives(gameState) || {
            multiplier: gameState?.getDifficultyMultiplier?.() || 1,
            chaosBoost: 1
        };
        spawnSystem.handleBeat(beatInfo, directives);
        gameState.registerBeat();
    });
}

function processPulses() {
    const pulses = inputMapping.consumePulses();
    pulses.forEach((pulse) => {
        pulse.radius = 0.08 + gameState.pulseWindow * 0.6;
        const handledByEvent = eventDirector?.handlePulse(pulse, gameState) || false;
        const hits = collisionSystem.resolvePulse(pulse);
        if (hits.length) {
            hits.forEach(({ target, quality }) => {
                spawnSystem.removeTarget(target.id);
                gameState.registerHit(quality);
                effectsManager.trigger('score', { quality });
            });
            collisionSystem.rebuild(spawnSystem.getActiveTargets());
        } else if (!handledByEvent) {
            gameState.registerMiss();
            effectsManager.trigger('miss');
            hud.flash('Miss');
        }
    });
}

function handleExpired(expiredTargets) {
    expiredTargets.forEach(() => {
        gameState.registerMiss();
        effectsManager.trigger('miss');
    });
}

async function configureLevel(level, { resetRun = false, preserveAudio = false } = {}) {
    geometryController = new GeometryController(level.seed || Math.floor(Math.random() * 10000));
    geometryController.setMode(level.system);
    geometryController.setGeometry(level.geometryIndex || 0);
    spawnSystem = new SpawnSystem(geometryController);
    spawnSystem.setDifficulty(level.difficulty || {});
    eventDirector?.attachSpawner(spawnSystem);
    if (!gameState || resetRun) {
        gameState = new GameState(level);
    } else {
        gameState.transitionToLevel(level);
    }
    modeController.setActiveMode(level.system);
    modeController.setVariant(level.variantIndex ?? level.geometryIndex ?? 0);
    modeController.resize();
    hud.setLevel(level);
    collisionSystem.rebuild([]);
    eventDirector?.setLevel(level);
    const geometryId = geometryController.getGeometryId();
    audioService.setGeometryContext(level.system, geometryId);
    eventDirector?.setGeometryContext({ system: level.system, geometry: geometryId });

    if (!preserveAudio) {
        const trackConfig = level.track || {};
        await audioService.loadTrack({
            url: trackConfig.url || null,
            bpm: level.bpm,
            mode: trackConfig.mode || (trackConfig.url ? 'track' : 'microphone')
        });
    }
    audioService.setBPM(level.bpm);
}

function checkLevelEnd() {
    if (gameState.isGameOver()) {
        awaitingStart = true;
        hud.setStatus('Run over. Tap to restart.', 'alert');
        audioService.stop();
        gameLoop.stop();
        const summary = gameState.getStageSummary();
        persistence.recordScore('rogue-lite-run', gameState.score, gameState.maxCombo, {
            depth: summary.stage,
            combo: summary.combo
        });
        startScreen.classList.remove('hidden');
        startScreen.querySelector('.lp-start-title').textContent = 'Run Over';
        startButton.textContent = 'Restart Run';
        startScreen.querySelector('.lp-start-subtitle').textContent = 'Ready for a fresh depth climb?';
        startButtonAction = async () => {
            startScreen.classList.add('hidden');
            await startNewRun(Date.now());
            awaitingStart = false;
            await audioService.start();
            hud.setStatus('New run. Tap beats, react fast.');
            gameLoop.start();
        };
        return;
    }

    if (gameState.isLevelComplete() && !stageTransitioning) {
        stageTransitioning = true;
        gameState.markStageComplete();
        const summary = gameState.getStageSummary();
        persistence.recordScore('rogue-lite-run', gameState.score, gameState.maxCombo, {
            depth: summary.stage,
            combo: summary.combo
        });
        const nextLevel = levelManager.nextStage(summary);
        currentLevel = nextLevel;
        awaitingStart = true;
        hud.flash(`Depth ${summary.stage} Clear!`);
        hud.setStatus('Recalibrating lattice…', 'event');
        configureLevel(nextLevel, { preserveAudio: true }).then(() => {
            awaitingStart = false;
            hud.setLevel(nextLevel);
            hud.setStatus(`Depth ${nextLevel.stage} • Keep riding`, 'event');
            stageTransitioning = false;
        });
    }
}

async function startNewRun(seed) {
    currentLevel = levelManager.startRun({ seed });
    await configureLevel(currentLevel, { resetRun: true });
    stageTransitioning = false;
}

function applyGeometryBias(params, bias) {
    const result = { ...params };
    if (!bias) return result;
    result.hue = (result.hue + bias.hueShift) % 360;
    result.chaos *= bias.chaos;
    result.speed *= bias.speed;
    return result;
}

function clampParameters(params) {
    return {
        ...params,
        gridDensity: clamp(params.gridDensity, 5, 90),
        morphFactor: clamp(params.morphFactor, 0, 2),
        chaos: clamp(params.chaos, 0, 1.5),
        speed: clamp(params.speed, 0.3, 3.2),
        hue: ((params.hue % 360) + 360) % 360,
        intensity: clamp(params.intensity, 0.1, 1.2),
        saturation: clamp(params.saturation, 0, 1),
        dimension: clamp(params.dimension, 3.0, 4.5),
        rot4dXW: clamp(params.rot4dXW, -2.5, 2.5),
        rot4dYW: clamp(params.rot4dYW, -2.5, 2.5),
        rot4dZW: clamp(params.rot4dZW, -2.5, 2.5)
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
