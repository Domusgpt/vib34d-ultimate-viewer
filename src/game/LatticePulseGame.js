import { GameLoop } from './GameLoop.js';
import { AudioService } from './audio/AudioService.js';
import { ModeController } from './modes/ModeController.js';
import { GeometryController } from './geometry/GeometryController.js';
import { SpawnSystem } from './spawn/SpawnSystem.js';
import { CollisionSystem } from './collision/CollisionSystem.js';
import { InputMapping } from './input/InputMapping.js';
import { EffectsManager } from './effects/EffectsManager.js';
import { PerformanceController } from './performance/PerformanceController.js';
import { LevelManager } from './state/LevelManager.js';
import { DEFAULT_LEVELS } from './state/defaultLevels.js';
import { HudController } from './ui/HudController.js';

export class LatticePulseGame {
    constructor({ container, hudElement }) {
        this.container = container;
        this.hud = new HudController(hudElement);
        this.audioService = new AudioService();
        this.geometryController = new GeometryController();
        this.modeController = new ModeController({ container, geometryController: this.geometryController });
        this.spawnSystem = new SpawnSystem({ geometryController: this.geometryController, audioService: this.audioService });
        this.collisionSystem = new CollisionSystem({ gridResolution: 48 });
        this.effectsManager = new EffectsManager({ modeController: this.modeController });
        this.performanceController = new PerformanceController({ modeController: this.modeController });
        this.levelManager = new LevelManager();
        this.levelManager.setLevels(DEFAULT_LEVELS);
        this.score = 0;
        this.combo = 0;
        this.health = 1.0;
        this.slowMoTimer = 0;
        this.timeScale = 1.0;
        this.currentLevel = null;
        this.lastPulseCaptureIds = new Set();
        this.inputMapping = new InputMapping({
            element: container,
            onParameterDelta: deltas => this.modeController.applyParameterDelta(deltas),
            onPulse: pulse => this.handlePulse(pulse),
            onLongPress: () => this.handleLongPress()
        });
        this.gameLoop = new GameLoop({
            update: dt => this.update(dt),
            render: () => this.render()
        });
        this.setupSpawnEvents();
        window.audioEnabled = true;
        window.interactivityEnabled = true;
        window.audioReactive = { bass: 0, mid: 0, high: 0, energy: 0 };
    }

    async start() {
        this.modeController.initialize();
        await this.audioService.init();
        this.spawnSystem.initialize();
        this.currentLevel = this.levelManager.getCurrentLevel();
        this.applyLevel(this.currentLevel);
        this.hud.setLevel(this.currentLevel?.name || '');
        this.hud.setMode(this.currentLevel?.system || 'faceted');
        this.hud.setGeometry(this.geometryController.getGeometryName());
        this.gameLoop.start();
    }

    nextLevel() {
        if (this.currentLevel) {
            this.levelManager.recordScore(this.currentLevel.id, this.score);
        }
        this.currentLevel = this.levelManager.advanceLevel();
        this.applyLevel(this.currentLevel);
        this.hud.setLevel(this.currentLevel?.name || '');
        this.hud.setMode(this.currentLevel?.system || 'faceted');
        this.hud.setGeometry(this.geometryController.getGeometryName());
    }

    applyLevel(level) {
        if (!level) return;
        this.geometryController.setSeed(level.seed || 1);
        this.spawnSystem.configure({ difficulty: level.difficulty?.speed || 1, spawn: level.spawn });
        this.levelManager.applyLevelSettings(level, {
            modeController: this.modeController,
            geometryController: this.geometryController,
            audioService: this.audioService
        });
        this.hud.setBpm(level.bpm || 120);
        this.hud.setMode(level.system || 'faceted');
        this.hud.setGeometry(this.geometryController.getGeometryName());
        this.hud.setLevel(level.name || '');
        this.resetRun();
    }

    setupSpawnEvents() {
        this.spawnSystem.on('resolve', target => {
            const gain = 120 + Math.round(target.age * 40);
            this.combo = Math.min(this.combo + 1, 99);
            const multiplier = 1 + this.combo * 0.1;
            const delta = Math.round(gain * multiplier);
            this.score += delta;
            this.effectsManager.trigger(this.combo > 5 ? 'combo' : 'pulse');
            if (target.type === 'orb') {
                this.effectsManager.trigger('perfect');
            }
            this.hud.setScore(this.score);
            this.hud.setCombo(this.combo);
        });

        this.spawnSystem.on('miss', () => {
            this.combo = 0;
            this.health = Math.max(0, this.health - 0.1);
            this.effectsManager.trigger('miss');
            this.hud.setCombo(this.combo);
            this.hud.setShieldMeter(this.health);
            if (this.health <= 0) {
                if (this.currentLevel) {
                    this.levelManager.recordScore(this.currentLevel.id, this.score);
                }
                this.hud.showToast('Grid Collapsed — Retry!');
                this.resetRun();
            }
        });
    }

    resetRun() {
        this.score = 0;
        this.combo = 0;
        this.health = 1.0;
        this.spawnSystem.activeTargets = [];
        this.lastPulseCaptureIds.clear();
        this.hud.setScore(this.score);
        this.hud.setCombo(this.combo);
        this.hud.setShieldMeter(this.health);
    }

    handlePulse(pulse) {
        this.lastPulseCaptureIds.clear();
        this.effectsManager.trigger('pulse');
        this.hud.setPulseMeter(1);
    }

    handleLongPress() {
        this.slowMoTimer = 1.5;
        this.timeScale = 0.75;
        this.hud.showToast('Phase Drift');
    }

    update(dt) {
        const scaledDt = dt * this.timeScale;
        this.audioService.update(scaledDt);
        const bands = this.audioService.getBandLevels();
        window.audioReactive = {
            bass: bands.bass,
            mid: bands.mid,
            high: bands.high,
            energy: bands.energy
        };

        this.spawnSystem.update(scaledDt);
        const targets = this.spawnSystem.getTargets();
        this.collisionSystem.rebuild(targets);
        this.resolveCollisions();

        this.effectsManager.update(scaledDt);
        this.inputMapping.update(scaledDt);
        this.performanceController.update();

        if (this.slowMoTimer > 0) {
            this.slowMoTimer -= dt;
            if (this.slowMoTimer <= 0) {
                this.timeScale = 1.0;
            }
        }

        const pulseState = this.inputMapping.getPulseState();
        if (pulseState.active) {
            this.hud.setPulseMeter(pulseState.radius);
        } else {
            this.hud.setPulseMeter(0);
        }

        this.hud.setFps(this.performanceController.getAverageFps());
    }

    resolveCollisions() {
        const pulseState = this.inputMapping.getPulseState();
        if (!pulseState.active) return;
        const hits = this.collisionSystem.queryCircle({
            x: pulseState.x,
            y: pulseState.y,
            radius: pulseState.radius
        });
        hits.forEach(target => {
            if (this.lastPulseCaptureIds.has(target.id)) return;
            const resolved = this.spawnSystem.resolveTarget(target.id);
            if (resolved) {
                this.lastPulseCaptureIds.add(target.id);
            }
        });
    }

    render() {
        this.modeController.render(this.inputMapping.getInteraction());
        this.performanceController.recordFrame();
    }
}
