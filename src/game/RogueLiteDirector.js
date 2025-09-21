import { createSeededRNG } from './utils/Random.js';

const DEFAULT_ROUTE = [
    {
        id: 'tetra-drift',
        label: 'Tetra Drift',
        system: 'faceted',
        geometryIndex: 0,
        variantIndex: 0,
        beats: 24,
        eventBias: ['quickdraw', 'microgame']
    },
    {
        id: 'hypercube-pressure',
        label: 'Hypercube Pressure',
        system: 'faceted',
        geometryIndex: 1,
        variantIndex: 5,
        beats: 28,
        eventBias: ['reverse', 'microgame']
    },
    {
        id: 'quantum-swell',
        label: 'Quantum Swell',
        system: 'quantum',
        geometryIndex: 2,
        variantIndex: 2,
        beats: 32,
        rhythm: 1.35,
        eventBias: ['glitch', 'microgame']
    },
    {
        id: 'wave-breach',
        label: 'Wave Breach',
        system: 'holographic',
        geometryIndex: 24,
        variantIndex: 24,
        beats: 32,
        rhythm: 0.8,
        eventBias: ['reverse', 'rhythmShift', 'microgame']
    },
    {
        id: 'crystal-echo',
        label: 'Crystal Echo',
        system: 'holographic',
        geometryIndex: 27,
        variantIndex: 27,
        beats: 36,
        eventBias: ['quickdraw', 'glitch', 'microgame']
    }
];

const DIFFICULTY_LABELS = [
    { threshold: 1.0, label: 'CALIBRATE' },
    { threshold: 1.6, label: 'SURGE' },
    { threshold: 2.1, label: 'ASCENT' },
    { threshold: 2.6, label: 'OVERDRIVE' },
    { threshold: Infinity, label: 'HYPERLATTICE' }
];

const SWIPE_DIRECTIONS = ['LEFT', 'RIGHT', 'UP', 'DOWN'];

const SWIPE_PROMPTS = {
    LEFT: 'SWIPE LEFT!',
    RIGHT: 'SWIPE RIGHT!',
    UP: 'SWIPE UP!',
    DOWN: 'SWIPE DOWN!'
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function formatDifficulty(value) {
    for (const entry of DIFFICULTY_LABELS) {
        if (value < entry.threshold) {
            return entry.label;
        }
    }
    return DIFFICULTY_LABELS[DIFFICULTY_LABELS.length - 1].label;
}

export class RogueLiteDirector {
    constructor({
        level,
        geometryController,
        spawnSystem,
        modeController,
        hud,
        effectsManager,
        audioService,
        gameState
    }) {
        this.level = level;
        this.geometryController = geometryController;
        this.spawnSystem = spawnSystem;
        this.modeController = modeController;
        this.hud = hud;
        this.effectsManager = effectsManager;
        this.audioService = audioService;
        this.gameState = gameState;
        this.route = Array.isArray(level?.route) && level.route.length ? level.route : DEFAULT_ROUTE;
        this.stage = 0;
        this.stageDef = null;
        this.eventBias = [];
        this.activeEvent = null;
        this.eventCooldown = 0;
        this.specialCooldown = 0;
        this.rhythmModifier = 1;
        this.currentDifficulty = { ...level?.difficulty };
        this.baseDifficulty = {
            density: level?.difficulty?.density ?? 1,
            speed: level?.difficulty?.speed ?? 1,
            chaos: level?.difficulty?.chaos ?? 0.2
        };
        this.difficultyRating = 1;
        this.effectContext = {
            event: null,
            difficulty: 1,
            dynamics: null,
            rhythmModifier: 1
        };
        this.lastDynamics = { energy: 0.5, bass: 0.4, mid: 0.4, high: 0.4 };
        this.rng = createSeededRNG(level?.seed || Date.now());
        this.start();
    }

    start() {
        this.stage = 0;
        const firstStage = this.route[0];
        this.applyStageDefinition(firstStage, { immediate: true });
        this.syncDifficulty(this.lastDynamics);
        this.hud.setStatus('Endless run: sync with the beat lattice.', 'info');
    }

    update(dt, dynamics = {}) {
        if (dynamics && Object.keys(dynamics).length) {
            this.lastDynamics = dynamics;
        }
        this.specialCooldown = Math.max(0, this.specialCooldown - dt);
        this.eventCooldown = Math.max(0, this.eventCooldown - dt);

        if (this.activeEvent) {
            this.updateEvent(dt, this.lastDynamics);
        } else if (this.eventCooldown <= 0) {
            this.maybeTriggerEvent(this.lastDynamics);
        }

        if (this.gameState.beatsPerStage && this.gameState.stageBeats >= this.gameState.beatsPerStage) {
            this.advanceStage();
        }

        this.syncDifficulty(this.lastDynamics);
    }

    onBeat(beatInfo, dynamics) {
        if (dynamics) {
            this.lastDynamics = dynamics;
        }
        if (!this.activeEvent && beatInfo.beat % 16 === 0) {
            this.maybeTriggerEvent(this.lastDynamics);
        }
    }

    onPulseResolved(hits) {
        if (!hits?.length) return;
        if (this.activeEvent?.type === 'glitch') {
            // Chew through glitch storms faster when the player lands pulses.
            this.activeEvent.timer += Math.min(1, hits.length * 0.15);
        }
    }

    onPulseMiss() {
        if (this.activeEvent?.type === 'quickdraw' && !this.activeEvent.resolved) {
            this.failEvent('quickdraw');
        }
    }

    onTargetExpired() {
        if (this.activeEvent?.type === 'quickdraw' && !this.activeEvent.resolved) {
            this.failEvent('quickdraw');
        }
    }

    handleSpecialTap() {
        if (this.activeEvent?.type === 'quickdraw') {
            this.resolveQuickdraw();
            return;
        }

        if (this.specialCooldown > 0) {
            this.hud.flash('Ability Cooling');
            return;
        }

        if (this.gameState.lives < 3 && this.gameState.combo >= 12) {
            this.gameState.grantLife();
            this.effectsManager.trigger('shield');
            this.hud.flash('Extra Life Online');
            this.hud.setStatus('Combo converted into a spare lattice.', 'success');
            this.specialCooldown = 14;
            return;
        }

        this.gameState.activateSlowmo(3.5, 0.6);
        this.effectsManager.trigger('slowmo');
        this.hud.flash('Time Warp');
        this.hud.setStatus('Everything slows. Chain perfect pulses!', 'info');
        this.specialCooldown = 9;
    }

    onSwipe(detail) {
        if (!detail || !detail.direction) return;
        if (!this.activeEvent || this.activeEvent.type !== 'microgame') return;
        if (this.activeEvent.mode !== 'swipe' || this.activeEvent.resolved) return;
        if (detail.direction === this.activeEvent.direction) {
            this.completeMicrogame('swipe');
        } else {
            this.failEvent('microgame');
        }
    }

    onLongPressStart() {
        if (!this.activeEvent || this.activeEvent.type !== 'microgame') return;
        if (this.activeEvent.mode !== 'phaseHold') return;
        this.activeEvent.holding = true;
        this.activeEvent.holdProgress = 0;
        this.hud.setStatus('Hold steady. Do not release!', 'alert');
    }

    onLongPressEnd() {
        if (!this.activeEvent || this.activeEvent.type !== 'microgame') return;
        if (this.activeEvent.mode !== 'phaseHold') return;
        if (!this.activeEvent.completed && (this.activeEvent.holdProgress || 0) < this.activeEvent.holdRequired) {
            this.failEvent('microgame');
        }
        this.activeEvent.holding = false;
    }

    onPulseInput({ success, hits }) {
        if (!this.activeEvent || this.activeEvent.type !== 'microgame') return;
        if (this.activeEvent.mode !== 'pulseBurst') return;
        const gained = success ? Math.max(1, hits?.length || 1) : 0;
        const penalty = success ? 0 : 1;
        const updated = Math.max(0, (this.activeEvent.progress || 0) + gained - penalty);
        this.activeEvent.progress = Math.min(this.activeEvent.required, updated);
        if (this.activeEvent.progress >= this.activeEvent.required) {
            this.completeMicrogame('pulseBurst');
        } else if (!success) {
            this.hud.flash('Missed Pulse');
        } else {
            this.hud.setStatus('Keep the burst going!', 'success');
        }
        this.activeEvent.prompt = `TRIPLE TAP! ${this.activeEvent.progress}/${this.activeEvent.required}`;
    }

    getHUDContext() {
        const event = this.activeEvent;
        let eventProgress = null;
        let eventGoal = null;
        if (event) {
            if (event.type === 'microgame' && event.mode === 'phaseHold') {
                const progress = Math.min(event.holdRequired || 0, event.holdProgress || 0);
                eventProgress = Number(progress.toFixed(1));
                eventGoal = Number((event.holdRequired || 0).toFixed(1));
            } else if (typeof event.progress === 'number' && typeof event.required === 'number') {
                eventProgress = event.progress;
                eventGoal = event.required;
            }
        }
        return {
            stage: this.stage,
            stageLabel: this.stageDef?.label,
            difficultyLabel: formatDifficulty(this.difficultyRating),
            difficultyValue: this.difficultyRating,
            eventPrompt: this.activeEvent?.prompt || '',
            eventType: this.activeEvent?.type || null,
            eventProgress,
            eventGoal,
            rhythmModifier: this.rhythmModifier,
            rhythmLabel: this.rhythmModifier === 1
                ? 'SYNC'
                : this.rhythmModifier > 1
                    ? `${this.rhythmModifier.toFixed(2)}x`
                    : `HALF ${ (1 / this.rhythmModifier).toFixed(2) }x`,
            specialReady: this.specialCooldown <= 0
        };
    }

    getEffectContext() {
        return {
            event: this.activeEvent?.type || null,
            eventTimer: this.activeEvent?.timer || 0,
            eventWindow: this.activeEvent?.window || this.activeEvent?.duration || 0,
            rhythmModifier: this.rhythmModifier,
            dynamics: this.lastDynamics,
            difficulty: this.difficultyRating
        };
    }

    getRhythmModifier() {
        return this.rhythmModifier;
    }

    applyStageDefinition(stageDef, { immediate = false } = {}) {
        if (!stageDef) return;
        this.stageDef = stageDef;
        this.eventBias = Array.isArray(stageDef.eventBias) ? stageDef.eventBias : [];
        this.rhythmModifier = stageDef.rhythm || 1;

        this.geometryController.setMode(stageDef.system || this.level.system);
        this.geometryController.setGeometry(stageDef.geometryIndex ?? 0);
        this.spawnSystem.setStageContext({
            stage: this.stage,
            id: stageDef.id,
            label: stageDef.label
        });
        this.spawnSystem.setRhythmModifier(this.rhythmModifier);
        this.spawnSystem.reset();
        this.modeController.setActiveMode(stageDef.system || this.level.system);
        this.modeController.setVariant(stageDef.variantIndex ?? stageDef.geometryIndex ?? 0);
        this.modeController.resize();
        this.gameState.setStage(this.stage, { label: stageDef.label, beats: stageDef.beats });

        if (immediate) {
            this.hud.setStatus(`Stage 1 • ${stageDef.label}`, 'info');
        } else {
            this.hud.flash(`Stage ${this.stage + 1}: ${stageDef.label.toUpperCase()}`);
            this.hud.setStatus('New geometry unlocked. Keep the flow!', 'success');
        }

        this.eventCooldown = 2.5;
    }

    advanceStage() {
        this.stage += 1;
        const next = this.route[this.stage % this.route.length];
        this.gameState.addScore(600 * (1 + this.stage * 0.2));
        this.gameState.registerStageAdvance();
        this.effectsManager.trigger('combo');
        this.applyStageDefinition(next);
    }

    syncDifficulty(dynamics) {
        const energy = dynamics?.energy ?? 0.5;
        const bass = dynamics?.bass ?? 0.4;
        const mid = dynamics?.mid ?? 0.4;
        const high = dynamics?.high ?? 0.4;
        const stageScalar = 1 + this.stage * 0.18;
        const dropBoost = dynamics?.drop ? 1.2 : 1;
        const silenceBrake = dynamics?.silence ? 0.85 : 1;
        const glitchBoost = this.activeEvent?.type === 'glitch' ? 1.4 : 1;
        const reverseBrake = this.gameState.reverseActive ? 0.82 : 1;

        const density = clamp(
            this.baseDifficulty.density * (0.7 + energy * 1.25 + bass * 0.6) * stageScalar * dropBoost,
            0.4,
            4.2
        );
        const speed = clamp(
            this.baseDifficulty.speed * (0.85 + mid * 1.1 + energy * 0.35) * stageScalar * reverseBrake * this.rhythmModifier * silenceBrake,
            0.35,
            4.8
        );
        const chaos = clamp(
            this.baseDifficulty.chaos * (0.6 + high * 1.35 + (dynamics?.glitch ? 0.5 : 0)) * stageScalar * glitchBoost,
            0.08,
            3.2
        );

        this.spawnSystem.setDifficulty({ density, speed, chaos });
        this.spawnSystem.setDynamics({ ...dynamics, stage: this.stage, event: this.activeEvent?.type || null });
        this.spawnSystem.setRhythmModifier(this.rhythmModifier);

        this.currentDifficulty = { density, speed, chaos };
        this.difficultyRating = (density + speed + chaos) / 3;
        this.effectContext = {
            event: this.activeEvent?.type || null,
            eventTimer: this.activeEvent?.timer || 0,
            eventWindow: this.activeEvent?.window || this.activeEvent?.duration || 0,
            rhythmModifier: this.rhythmModifier,
            dynamics,
            difficulty: this.difficultyRating
        };
    }

    maybeTriggerEvent(dynamics) {
        const candidates = new Set();
        if (dynamics?.drop) candidates.add('quickdraw');
        if (dynamics?.glitch) candidates.add('glitch');
        if (dynamics?.silence) candidates.add('reverse');
        if (dynamics?.bridge) candidates.add('rhythmShift');
        if (dynamics?.vocal) candidates.add('microgame');
        if (this.eventBias.includes('microgame')) candidates.add('microgame');
        if (!candidates.size && dynamics?.energy > 0.82) candidates.add('rhythmShift');
        if (!candidates.size && dynamics?.high > 0.7) candidates.add('glitch');
        if (!candidates.size) candidates.add('microgame');

        const candidateList = Array.from(candidates);
        if (!candidateList.length) return;

        let selected = candidateList[0];
        if (this.eventBias.length) {
            const preferred = this.eventBias.find((bias) => candidateList.includes(bias));
            if (preferred) {
                selected = preferred;
            }
        }
        if (candidateList.length > 1 && selected === candidateList[0]) {
            selected = candidateList[this.rng.nextInt(0, candidateList.length - 1)];
        }

        this.triggerEvent(selected, dynamics);
    }

    triggerEvent(type, dynamics) {
        switch (type) {
            case 'quickdraw':
                this.startQuickdraw();
                break;
            case 'glitch':
                this.startGlitchStorm();
                break;
            case 'reverse':
                this.startReverseField();
                break;
            case 'rhythmShift':
                this.startRhythmShift(dynamics);
                break;
            case 'microgame':
                this.startMicrogame(dynamics);
                break;
            default:
                break;
        }
    }

    startQuickdraw() {
        const window = clamp(0.75 - this.stage * 0.03, 0.35, 0.75);
        this.activeEvent = {
            type: 'quickdraw',
            timer: 0,
            window,
            prompt: 'QUICK DRAW! DOUBLE TAP NOW!',
            resolved: false
        };
        this.effectsManager.trigger('woah');
        this.hud.flash('DROP INCOMING');
        this.hud.setStatus('Double tap the moment the beat hits!', 'alert');
    }

    startGlitchStorm() {
        const duration = 4 + Math.min(2.5, this.stage * 0.4);
        this.gameState.activateGlitch(duration);
        this.effectsManager.trigger('glitch', { intensity: 1 });
        this.activeEvent = {
            type: 'glitch',
            timer: 0,
            duration,
            prompt: 'GLITCH CASCADE! TAP THROUGH THE STATIC!'
        };
        this.hud.flash('GLITCH CASCADE');
        this.hud.setStatus('The lattice is glitching. Keep pulsing!', 'alert');
    }

    startReverseField() {
        const duration = 5 + Math.min(2, this.stage * 0.25);
        this.gameState.activateReverse(duration);
        this.effectsManager.trigger('reverse');
        this.activeEvent = {
            type: 'reverse',
            timer: 0,
            duration,
            prompt: 'REVERSE POLARITY! SWIPES ARE INVERTED!'
        };
        this.hud.flash('POLARITY FLIP');
        this.hud.setStatus('Control inversion! Adjust quickly.', 'alert');
    }

    startRhythmShift(dynamics) {
        const duration = 8;
        const mode = dynamics?.energy > 0.6 ? 'surge' : 'drift';
        this.rhythmModifier = mode === 'surge' ? 1.5 : 0.75;
        this.effectsManager.trigger('rhythm');
        this.activeEvent = {
            type: 'rhythmShift',
            timer: 0,
            duration,
            prompt: mode === 'surge' ? 'TEMPO SURGE! DOUBLE SPEED!' : 'TEMPO DRIFT! HALF SPEED!'
        };
        this.hud.flash(mode === 'surge' ? 'TEMPO SURGE' : 'TEMPO DRIFT');
        this.hud.setStatus(mode === 'surge' ? 'Beats accelerate! Keep up!' : 'Beats stretch. Ride the groove.', 'alert');
    }

    startMicrogame(dynamics = {}) {
        const weights = [];
        if (dynamics?.drop) weights.push('pulseBurst', 'pulseBurst');
        if (dynamics?.bridge || dynamics?.vocal) weights.push('swipe', 'swipe');
        if (dynamics?.silence) weights.push('phaseHold', 'phaseHold');
        const options = weights.length ? weights : ['pulseBurst', 'swipe', 'phaseHold'];
        const mode = options[this.rng.nextInt(0, options.length - 1)];
        const stageBoost = 1 + this.stage * 0.12;
        const event = {
            type: 'microgame',
            mode,
            timer: 0,
            duration: 3,
            prompt: '',
            progress: 0,
            required: 0,
            resolved: false
        };

        switch (mode) {
            case 'pulseBurst': {
                const hits = Math.min(5, 3 + Math.floor(this.stage / 2));
                event.required = hits;
                event.duration = clamp(3.2 / stageBoost, 1.6, 3.4);
                event.prompt = 'TRIPLE TAP! LAND THE BEATS!';
                break;
            }
            case 'swipe': {
                const direction = SWIPE_DIRECTIONS[this.rng.nextInt(0, SWIPE_DIRECTIONS.length - 1)];
                event.direction = direction;
                event.required = 1;
                event.duration = clamp(2.4 / stageBoost, 1, 2.6);
                event.prompt = SWIPE_PROMPTS[direction];
                break;
            }
            case 'phaseHold':
            default: {
                const holdTime = clamp(1.15 + this.stage * 0.08, 1.1, 2.6);
                event.mode = 'phaseHold';
                event.holdRequired = holdTime;
                event.holdProgress = 0;
                event.holding = false;
                event.duration = holdTime + 1.2;
                event.prompt = `HOLD PHASE ${holdTime.toFixed(1)}S!`;
                break;
            }
        }

        this.activeEvent = event;
        this.effectsManager.trigger('woah');
        this.hud.flash('WOAH EVENT');
        this.hud.setStatus('Follow the command perfectly!', 'alert');
    }

    completeMicrogame(mode) {
        if (!this.activeEvent || this.activeEvent.type !== 'microgame') return;
        this.activeEvent.resolved = true;
        this.effectsManager.trigger('woah');
        this.effectsManager.trigger('score', { quality: 'perfect' });
        this.gameState.registerQuickSuccess();
        this.gameState.addScore(420 * (1 + this.stage * 0.3));
        if (mode === 'phaseHold') {
            this.gameState.grantLife();
            this.hud.flash('EXTRA LIFE!');
        } else {
            this.hud.flash('COMMAND COMPLETE');
        }
        this.hud.setStatus('Micro challenge cleared! Keep the groove.', 'success');
        this.eventCooldown = 6.5;
        this.specialCooldown = Math.max(this.specialCooldown, 4.5);
        this.activeEvent = null;
    }

    resolveQuickdraw() {
        if (!this.activeEvent || this.activeEvent.type !== 'quickdraw') return;
        this.activeEvent.resolved = true;
        this.gameState.registerQuickSuccess();
        this.effectsManager.trigger('score', { quality: 'perfect' });
        this.hud.flash('QUICK DRAW!!');
        this.hud.setStatus('Perfect reaction! Bonus awarded.', 'success');
        this.eventCooldown = 5.5;
        this.specialCooldown = Math.max(this.specialCooldown, 4);
        this.activeEvent = null;
    }

    failEvent(type) {
        switch (type) {
            case 'quickdraw':
                this.gameState.registerMiss();
                this.effectsManager.trigger('miss');
                this.hud.flash('Too Slow!');
                this.hud.setStatus('Quick Draw failed. Stay sharp!', 'alert');
                this.eventCooldown = 6;
                this.activeEvent = null;
                break;
            case 'microgame':
                this.gameState.registerMiss();
                this.effectsManager.trigger('miss');
                this.hud.flash('Command Failed');
                this.hud.setStatus('Micro challenge missed. The beat retaliates!', 'alert');
                this.eventCooldown = 7;
                this.activeEvent = null;
                break;
            default:
                this.endEvent();
        }
    }

    endEvent() {
        if (!this.activeEvent) return;
        if (this.activeEvent.type === 'reverse') {
            this.gameState.clearReverse();
        }
        if (this.activeEvent.type === 'glitch') {
            this.gameState.clearGlitch();
        }
        if (this.activeEvent.type === 'rhythmShift') {
            this.rhythmModifier = 1;
        }
        this.activeEvent = null;
        this.eventCooldown = 4.5;
        this.hud.setStatus('Flow stabilized. Keep pulsing.', 'info');
    }

    updateEvent(dt) {
        if (!this.activeEvent) return;
        this.activeEvent.timer += dt;
        switch (this.activeEvent.type) {
            case 'quickdraw':
                if (!this.activeEvent.resolved && this.activeEvent.timer >= this.activeEvent.window) {
                    this.failEvent('quickdraw');
                }
                break;
            case 'glitch':
            case 'reverse':
            case 'rhythmShift':
                if (this.activeEvent.timer >= this.activeEvent.duration) {
                    this.endEvent();
                }
                break;
            case 'microgame':
                if (this.activeEvent.mode === 'phaseHold' && this.activeEvent.holding) {
                    this.activeEvent.holdProgress = (this.activeEvent.holdProgress || 0) + dt;
                    if (this.activeEvent.holdProgress >= this.activeEvent.holdRequired) {
                        this.completeMicrogame('phaseHold');
                        return;
                    }
                }
                if (this.activeEvent && this.activeEvent.mode === 'phaseHold') {
                    const remaining = Math.max(0, (this.activeEvent.holdRequired || 0) - (this.activeEvent.holdProgress || 0));
                    this.activeEvent.prompt = remaining > 0.05
                        ? `HOLD PHASE ${remaining.toFixed(1)}S!`
                        : 'HOLD PHASE!';
                }
                if (!this.activeEvent.resolved && this.activeEvent.timer >= this.activeEvent.duration) {
                    this.failEvent('microgame');
                }
                break;
            default:
                break;
        }
    }
}
