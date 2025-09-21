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
import { RogueLiteDirector } from './RogueLiteDirector.js';

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
let rogueDirector;

window.audioReactive = { bass: 0, mid: 0, high: 0 };

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
    const levels = await levelManager.load();
    currentLevel = levels[0];

    await configureLevel(currentLevel);
    startScreen.querySelector('.lp-start-title').textContent = 'Lattice Pulse';
    startScreen.querySelector('.lp-start-subtitle').textContent = `Route loaded: ${currentLevel.id} • Double tap for Time Warp challenges.`;
    startButton.textContent = 'Start';

    setupInput();
    setupAudioCallbacks();

    const update = (dt) => {
        if (awaitingStart) return;
        audioService.update(dt);
        const dynamics = audioService.getDynamics();
        rogueDirector?.update(dt, dynamics);

        const simulationRate = gameState.getSimulationRate();
        const simDt = dt * simulationRate;

        gameState.update(simDt);
        gameState.settleParameters(simDt);

        const biasedParams = applyGeometryBias(gameState.getParameters(), geometryController.getParameterBias());
        const effectContext = { ...(rogueDirector?.getEffectContext?.() || {}), dynamics };
        const finalParams = clampParameters(effectsManager.update(simDt, biasedParams, gameState, effectContext));
        const aspect = canvasRoot.clientWidth / canvasRoot.clientHeight;
        spawnSystem.setDynamics?.(dynamics);
        const { expiredTargets } = spawnSystem.update(simDt, finalParams, aspect, { timeScale: simulationRate });
        collisionSystem.rebuild(spawnSystem.getActiveTargets());

        processPulses();
        handleExpired(expiredTargets);

        modeController.updateParameters(finalParams);
        hud.update(gameState, rogueDirector?.getHUDContext?.() || {});
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
        await audioService.start();
        hud.setStatus('Tap beats, swipe space, double tap when the drop hits.');
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
        const factor = 3.0;
        gameState.applyParameterDelta({
            rot4dXW: deltaY * factor,
            rot4dYW: deltaX * factor
        });
    });

    inputMapping.on('swipe', ({ direction, deltaX, deltaY, duration }) => {
        if (!direction) return;
        rogueDirector?.onSwipe?.({ direction, deltaX, deltaY, duration });
    });

    inputMapping.on('pinch', ({ scaleDelta }) => {
        gameState.applyParameterDelta({ dimension: scaleDelta * 1.2 });
    });

    inputMapping.on('pulse', () => {
        gameState.applyParameterDelta({ intensity: 0.05 });
    });

    inputMapping.on('longpressstart', () => {
        if (gameState.startPhase()) {
            effectsManager.trigger('shield');
            hud.flash('Phase Shift');
        }
        rogueDirector?.onLongPressStart?.();
    });

    inputMapping.on('longpressend', () => {
        gameState.stopPhase();
        rogueDirector?.onLongPressEnd?.();
    });

    inputMapping.on('specialtap', () => {
        rogueDirector?.handleSpecialTap();
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
        spawnSystem.handleBeat(beatInfo);
        gameState.registerBeat();
        rogueDirector?.onBeat(beatInfo, audioService.getDynamics());
    });
}

function processPulses() {
    const pulses = inputMapping.consumePulses();
    pulses.forEach((pulse) => {
        pulse.radius = 0.08 + gameState.pulseWindow * 0.6;
        const hits = collisionSystem.resolvePulse(pulse);
        if (hits.length) {
            hits.forEach(({ target, quality }) => {
                spawnSystem.removeTarget(target.id);
                gameState.registerHit(quality);
                effectsManager.trigger('score', { quality });
            });
            collisionSystem.rebuild(spawnSystem.getActiveTargets());
            rogueDirector?.onPulseResolved(hits);
            rogueDirector?.onPulseInput?.({ success: true, hits, pulse });
        } else {
            gameState.registerMiss();
            effectsManager.trigger('miss');
            hud.flash('Miss');
            rogueDirector?.onPulseMiss();
            rogueDirector?.onPulseInput?.({ success: false, hits: [], pulse });
        }
    });
}

function handleExpired(expiredTargets) {
    expiredTargets.forEach(() => {
        gameState.registerMiss();
        effectsManager.trigger('miss');
        rogueDirector?.onTargetExpired();
    });
}

async function configureLevel(level) {
    geometryController = new GeometryController(level.seed || Math.floor(Math.random() * 10000));
    geometryController.setMode(level.system);
    geometryController.setGeometry(level.geometryIndex || 0);
    spawnSystem = new SpawnSystem(geometryController);
    spawnSystem.setDifficulty(level.difficulty || {});
    gameState = new GameState(level);
    rogueDirector = new RogueLiteDirector({
        level,
        geometryController,
        spawnSystem,
        modeController,
        hud,
        effectsManager,
        audioService,
        gameState
    });
    hud.setLevel(level);

    await audioService.loadTrack({ url: level.track?.url || null, bpm: level.bpm });
    audioService.setBPM(level.bpm);
}

function checkLevelEnd() {
    if (gameState.isGameOver()) {
        awaitingStart = true;
        hud.setStatus('Try again. Tap to restart.', 'alert');
        audioService.stop();
        gameLoop.stop();
        startScreen.classList.remove('hidden');
        startScreen.querySelector('.lp-start-title').textContent = 'Try Again';
        startButton.textContent = 'Restart';
        startScreen.querySelector('.lp-start-subtitle').textContent = 'Resetting the lattice...';
        startButtonAction = async () => {
            startScreen.classList.add('hidden');
            awaitingStart = false;
            await configureLevel(currentLevel);
            await audioService.start();
            hud.setStatus('Stay in phase and watch for quick draws.');
            gameLoop.start();
        };
        return;
    }

    if (gameState.isLevelComplete()) {
        const isRecord = persistence.recordScore(currentLevel.id, gameState.score, gameState.maxCombo);
        if (isRecord) {
            hud.flash('New Record!');
            hud.setLevel(currentLevel);
        } else {
            hud.flash('Level Clear!');
        }
        const nextLevel = levelManager.nextLevel();
        currentLevel = nextLevel;
        awaitingStart = true;
        audioService.stop();
        gameLoop.stop();
        configureLevel(nextLevel).then(() => {
            startScreen.classList.remove('hidden');
            startScreen.querySelector('.lp-start-title').textContent = 'Next Level';
            startScreen.querySelector('.lp-start-subtitle').textContent = `Next route: ${nextLevel.id} • Expect rhythm flips.`;
            startButton.textContent = 'Launch';
            startButtonAction = async () => {
                awaitingStart = false;
                startScreen.classList.add('hidden');
                await audioService.start();
                hud.setStatus('Sync with the beat lattice. Drops trigger surprises.');
                gameLoop.start();
            };
        });
    }
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
