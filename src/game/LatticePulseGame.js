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
import { RogueLiteManager } from './RogueLiteManager.js';

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
let rogueLite;
let activeSpawnContext = {};
let awaitingStart = true;
let startButtonAction = null;

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
    rogueLite = new RogueLiteManager({ audioService, hud, persistence });
    inputMapping = new InputMapping(inputLayer);

    levelManager = new LevelManager();
    const levels = await levelManager.load();
    rogueLite.setTemplates(levels);
    currentLevel = rogueLite.startRun(levels[0]);

    await configureLevel(currentLevel, { fresh: true });
    startScreen.querySelector('.lp-start-title').textContent = 'Lattice Pulse';
    startScreen.querySelector('.lp-start-subtitle').textContent = `Stage ${currentLevel.stage || 1} • ${currentLevel.id}`;
    startButton.textContent = 'Start';

    setupInput();
    setupAudioCallbacks();

        const update = (dt) => {
            if (awaitingStart) return;
            audioService.update(dt);
            const analysis = audioService.getAnalysis();
            const rogueUpdate = rogueLite.update(dt, analysis, gameState);
        activeSpawnContext = {
            ...(rogueUpdate.spawnModifiers || {}),
            tempoMultiplier: rogueUpdate.effects?.tempoMultiplier || rogueUpdate.spawnModifiers?.tempoMultiplier || 1,
            reverseControls: rogueUpdate.effects?.reverseControls || rogueUpdate.spawnModifiers?.reverseControls || false
        };
        spawnSystem.setSpawnContext(activeSpawnContext);
            processRogueEvents(rogueUpdate.events);

            gameState.update(dt);
            const directiveEvents = gameState.consumeDirectiveEvents?.() || [];
            processDirectiveEvents(directiveEvents);
            gameState.settleParameters(dt);
            const directiveState = gameState.getDirectiveState?.();

            const biasedParams = applyGeometryBias(gameState.getParameters(), geometryController.getParameterBias());
            const finalParams = clampParameters(effectsManager.update(dt, biasedParams, gameState, rogueUpdate.effects, analysis));
            const aspect = canvasRoot.clientWidth / canvasRoot.clientHeight;
            const scaledDt = dt * Math.max(0.25, gameState.getTimeWarp?.() || 1);
        const { expiredTargets } = spawnSystem.update(scaledDt, finalParams, aspect, activeSpawnContext);
        collisionSystem.rebuild(spawnSystem.getActiveTargets());

        processPulses();
        handleExpired(expiredTargets);

        modeController.updateParameters(finalParams);
            hud.update(gameState, {
                stage: rogueUpdate.stage,
                modifiers: rogueUpdate.persistentModifiers,
                effects: rogueUpdate.effects,
                analysis,
                charges: gameState.getChargeState(),
                runId: rogueUpdate.runId,
                directive: directiveState
            });
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
        hud.setStatus('Ride the lattice. Tap beats, swipe space.');
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
        if (!gameState) return;
        const invert = typeof gameState.isControlInverted === 'function' && gameState.isControlInverted() ? -1 : 1;
        const factor = 3.0 * invert;
        gameState.applyParameterDelta({
            rot4dXW: deltaY * factor,
            rot4dYW: deltaX * factor
        });
    });

    inputMapping.on('swipeend', ({ deltaX, deltaY, duration }) => {
        if (!gameState) return;
        const magnitude = Math.hypot(deltaX, deltaY);
        gameState.registerDirectiveAction?.('swipe', { magnitude, duration });
    });

    inputMapping.on('pinch', ({ scaleDelta }) => {
        gameState.applyParameterDelta({ dimension: scaleDelta * 1.2 });
    });

    inputMapping.on('pulse', () => {
        gameState.applyParameterDelta({ intensity: 0.05 });
    });

    inputMapping.on('special', () => {
        if (awaitingStart) return;
        const action = rogueLite?.handleSpecialTap(gameState);
        if (!action) return;
        if (action.type === 'slowmo') {
            gameState.activateSlowMo(action.duration, action.factor);
            effectsManager.trigger('slowmo');
            hud.flash('Slow Motion');
        } else if (action.type === 'extra-life') {
            gameState.grantLife();
            hud.flash('Extra Life');
        }
        gameState.registerDirectiveAction?.('special');
    });

    inputMapping.on('longpressstart', () => {
        if (gameState.startPhase()) {
            effectsManager.trigger('shield');
            hud.flash('Phase Shift');
        }
    });

    inputMapping.on('longpressend', () => {
        gameState.stopPhase();
        gameState.registerDirectiveAction?.('phase-end');
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
        const analysis = audioService.getAnalysis();
        spawnSystem.handleBeat(beatInfo, analysis, activeSpawnContext);
        gameState.registerBeat();
    });
}

function processPulses() {
    const pulses = inputMapping.consumePulses();
    pulses.forEach((pulse) => {
        pulse.radius = 0.08 + gameState.pulseWindow * 0.6;
        const hits = collisionSystem.resolvePulse(pulse);
        let bestQuality = 'miss';
        if (hits.length) {
            hits.forEach(({ target, quality }) => {
                if (qualityScore(quality) > qualityScore(bestQuality)) {
                    bestQuality = quality;
                }
                spawnSystem.removeTarget(target.id);
                gameState.registerHit(quality);
                effectsManager.trigger('score', { quality });
                if (target.event) {
                    rogueLite?.handleTargetResolved(target, quality);
                }
            });
            collisionSystem.rebuild(spawnSystem.getActiveTargets());
        } else {
            gameState.registerMiss();
            effectsManager.trigger('miss');
            hud.flash('Miss');
        }
        gameState.registerDirectiveAction?.('pulse', { success: hits.length > 0, quality: hits.length ? bestQuality : 'miss' });
    });
}

function handleExpired(expiredTargets) {
    expiredTargets.forEach((target) => {
        gameState.registerMiss();
        effectsManager.trigger('miss');
        if (target) {
            rogueLite?.handleTargetExpired(target);
        }
    });
}

function processRogueEvents(events = []) {
    events.forEach((event) => {
        if (!event) return;
        switch (event.type) {
            case 'callout':
                hud.showCallout(event.text, event.variant, event.duration);
                break;
            case 'effect-start':
                if (event.id === 'glitch') {
                    gameState.applyGlitch(event.data?.glitchLevel ?? 1, event.duration || 4);
                    effectsManager.trigger('glitch');
                } else if (event.id === 'reverse') {
                    gameState.activateReverseControls(event.duration || 4);
                    effectsManager.trigger('reverse-start');
                    hud.flash('Reverse Flow');
                } else if (event.id === 'tempo-shift') {
                    effectsManager.trigger('tempo');
                    hud.flash('Tempo Warp');
                }
                break;
            case 'effect-end':
                if (event.id === 'reverse') {
                    effectsManager.trigger('reverse-end');
                    hud.setStatus('Flow restored');
                }
                break;
            case 'spawn-event':
                spawnSystem.injectEventTargets(event.event);
                break;
            case 'directive':
                if (event.directiveId) {
                    const def = rogueLite.getDirectiveDefinition?.(event.directiveId);
                    if (def) {
                        gameState.startDirective(def);
                    }
                }
                break;
            default:
                break;
        }
    });
}

function processDirectiveEvents(events = []) {
    events.forEach((event) => {
        if (!event) return;
        switch (event.type) {
            case 'directive-start':
                if (event.directive) {
                    hud.announceDirective(event.directive);
                }
                effectsManager.trigger('directive-start');
                break;
            case 'directive-complete':
                effectsManager.trigger('directive-success');
                rogueLite?.handleDirectiveOutcome(event, gameState);
                hud.finishDirective('success', event);
                break;
            case 'directive-fail':
                effectsManager.trigger('directive-fail');
                rogueLite?.handleDirectiveOutcome(event, gameState);
                hud.finishDirective('fail', event);
                break;
            default:
                break;
        }
    });
}

async function configureLevel(level, { fresh = false } = {}) {
    if (!geometryController || fresh) {
        geometryController = new GeometryController(level.seed || Math.floor(Math.random() * 10000));
        geometryController.setMode(level.system);
        geometryController.setGeometry(level.geometryIndex || 0);
        spawnSystem = new SpawnSystem(geometryController);
    } else {
        geometryController.setMode(level.system);
        geometryController.setGeometry(level.geometryIndex ?? geometryController.geometryIndex);
    }
    spawnSystem.setDifficulty(level.difficulty || {});
    spawnSystem.reset();
    activeSpawnContext = {};

    if (!gameState || fresh) {
        gameState = new GameState(level);
    } else {
        gameState.applyStage(level);
    }
    if (Array.isArray(level.modifiers)) {
        gameState.setModifierFlags(level.modifiers);
    }

    modeController.setActiveMode(level.system);
    modeController.setVariant(level.variantIndex ?? level.geometryIndex ?? 0);
    modeController.resize();
    hud.setLevel(level, {
        stage: level.stage || rogueLite?.getStage?.() || 1,
        modifiers: rogueLite?.getPersistentModifiers?.() || []
    });

    if (fresh) {
        await audioService.loadTrack({ url: level.track?.url || null, bpm: level.bpm });
    }
    audioService.setBPM(level.bpm);
}

function checkLevelEnd() {
    if (gameState.isGameOver()) {
        awaitingStart = true;
        const summary = rogueLite?.completeRun(gameState);
        const improved = summary ? persistence.recordRunResult(summary.baseId, summary) : false;
        hud.setStatus('Run over. Tap to launch again.', 'alert');
        if (summary) {
            hud.showRunSummary(summary, improved);
        }
        audioService.stop();
        gameLoop.stop();
        startScreen.classList.remove('hidden');
        startScreen.querySelector('.lp-start-title').textContent = 'Run Over';
        startButton.textContent = 'New Run';
        startScreen.querySelector('.lp-start-subtitle').textContent = 'Ready for another climb?';
        startButtonAction = async () => {
            startScreen.classList.add('hidden');
            awaitingStart = false;
            currentLevel = rogueLite.startRun();
            await configureLevel(currentLevel, { fresh: true });
            await audioService.start();
            hud.setStatus('Stay in phase.');
            gameLoop.start();
        };
        return;
    }

    if (gameState.isLevelComplete()) {
        const nextStage = rogueLite?.advanceStage(gameState);
        if (nextStage) {
            currentLevel = nextStage;
            configureLevel(nextStage);
            hud.flash(`Stage ${nextStage.stage} Clear!`);
            hud.setStatus('Stage up! Stay sharp.');
        }
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

function qualityScore(quality) {
    switch (quality) {
        case 'perfect':
            return 3;
        case 'great':
            return 2;
        case 'good':
            return 1;
        default:
            return 0;
    }
}
