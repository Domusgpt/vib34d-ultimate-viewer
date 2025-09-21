import { createSeededRNG } from './utils/Random.js';

const SWIPE_DIRECTIONS = ['left', 'right', 'up', 'down'];
const SWIPE_ANGLES = {
    right: 0,
    up: -Math.PI / 2,
    left: Math.PI,
    down: Math.PI / 2
};
const DEFAULT_PINCH_THRESHOLD = 0.18;

/**
 * Coordinates roguelite events (drops, quick draws, special gestures) based on audio dynamics.
 */
export class EventDirector {
    constructor(audioService, effectsManager, hud, { seed } = {}) {
        this.audio = audioService;
        this.effects = effectsManager;
        this.hud = hud;
        this.rng = createSeededRNG(seed || Math.floor(Math.random() * 100000));
        this.levelModifiers = {};
        this.dropCooldown = 0;
        this.bridgeCooldown = 0;
        this.quickDraw = null;
        this.beatBoost = 0;
        this.beatBoostTimer = 0;
        this.chaosBoost = 1;
        this.chaosBoostTimer = 0;
        this.silenceHold = 0;
        this.lastReactive = { energy: 0, delta: 0, trend: 0, silence: 0 };
        this.directiveCooldown = 0;
        this.gestureDirective = null;
        this.eventTargetId = null;
        this.spawner = null;
    }

    attachSpawner(spawnSystem) {
        this.spawner = spawnSystem;
    }

    setLevel(level = {}) {
        this.levelModifiers = level.modifiers || {};
        this.dropCooldown = 1.5;
        this.bridgeCooldown = 1.5;
        this.quickDraw = null;
        this.beatBoost = 0;
        this.beatBoostTimer = 0;
        this.chaosBoost = this.levelModifiers.glitchBoost || 1;
        this.chaosBoostTimer = 0;
        this.silenceHold = 0;
        this.directiveCooldown = 1.5;
        this.clearEventTarget();
        this.gestureDirective = null;
    }

    update(dt, gameState) {
        this.dropCooldown = Math.max(0, this.dropCooldown - dt);
        this.bridgeCooldown = Math.max(0, this.bridgeCooldown - dt);
        this.directiveCooldown = Math.max(0, this.directiveCooldown - dt);
        if (this.beatBoostTimer > 0) {
            this.beatBoostTimer = Math.max(0, this.beatBoostTimer - dt);
            if (this.beatBoostTimer === 0) {
                this.beatBoost = 0;
            }
        }
        if (this.chaosBoostTimer > 0) {
            this.chaosBoostTimer = Math.max(0, this.chaosBoostTimer - dt);
            if (this.chaosBoostTimer === 0) {
                this.chaosBoost = this.levelModifiers.glitchBoost || 1;
            }
        }

        const reactive = this.audio?.getReactiveState?.() || this.lastReactive;
        this.lastReactive = reactive;

        if (reactive.energy != null) {
            if (reactive.energy < 0.07) {
                this.silenceHold += dt;
            } else {
                this.silenceHold = Math.max(0, this.silenceHold - dt * 0.6);
            }
        }

        if (this.quickDraw) {
            this.quickDraw.timer -= dt;
            if (this.quickDraw.timer <= 0 && !this.quickDraw.resolved) {
                this.failQuickDraw(gameState);
            }
        }

        if (this.gestureDirective) {
            const directive = this.gestureDirective;
            if (directive.type === 'hold' && directive.holding && !directive.resolved) {
                directive.holdTimer += dt;
                if (directive.holdTimer >= directive.holdRequired) {
                    this.completeGesture(gameState, true);
                }
            }
            directive.timer -= dt;
            if (directive.timer <= 0 && !directive.resolved) {
                this.failGesture(gameState);
            }
        } else if (!this.quickDraw && this.directiveCooldown <= 0) {
            this.considerGesture(reactive);
        }

        const dropBias = this.levelModifiers.dropBias ?? 0.25;
        if (reactive.delta > 0.18 && reactive.energy > 0.3 && this.dropCooldown <= 0) {
            if (this.rng.nextFloat() < dropBias) {
                this.triggerDrop(gameState);
            }
        }

        const bridgeWindow = this.levelModifiers.bridgeWindow || 1.05;
        const quickDrawBias = this.levelModifiers.quickDrawBias ?? 0.2;
        if (this.silenceHold > bridgeWindow && this.bridgeCooldown <= 0) {
            if (this.rng.nextFloat() < quickDrawBias) {
                this.triggerQuickDraw(gameState, bridgeWindow);
            }
        }
    }

    handleBeat() {
        if (this.quickDraw && !this.quickDraw.announced) {
            this.hud.setStatus('Quick draw! Pulse on cue!', 'event');
            this.quickDraw.announced = true;
        }
    }

    handlePulse(pulse, gameState) {
        if (!this.quickDraw || this.quickDraw.resolved) {
            return false;
        }
        const elapsed = this.quickDraw.duration - this.quickDraw.timer;
        if (elapsed <= this.quickDraw.window) {
            this.quickDraw.resolved = true;
            this.quickDraw = null;
            this.effects.trigger('eventSuccess');
            this.hud.flash('Quick Draw!');
            gameState.addBonusScore(500);
            gameState.restoreHealth(0.08);
            this.bridgeCooldown = 7;
            this.clearEventTarget();
            this.directiveCooldown = Math.max(this.directiveCooldown, 4);
            return true;
        }
        return false;
    }

    handleSpecial(action, gameState) {
        switch (action) {
            case 'slowmo':
                if (gameState.triggerSlowMo(3, 0.5)) {
                    this.effects.trigger('slowmo');
                    this.hud.flash('Time Warp!');
                } else {
                    this.hud.setStatus('Time warp charging…', 'info');
                }
                break;
            case 'extra-life':
                if (gameState.grantExtraLife()) {
                    this.effects.trigger('eventSuccess');
                    this.hud.flash('Extra Life!');
                } else {
                    this.hud.setStatus('Life boost not ready.', 'alert');
                }
                break;
            default:
                break;
        }
    }

    getSpawnDirectives(gameState) {
        const base = gameState?.getDifficultyMultiplier?.() || 1;
        return {
            multiplier: base * (1 + this.beatBoost),
            chaosBoost: this.chaosBoost
        };
    }

    triggerDrop(gameState) {
        this.dropCooldown = 6;
        const glitchBoost = this.levelModifiers.glitchBoost || 1.15;
        this.effects.trigger('glitch');
        gameState.triggerGlitch(2.6);
        gameState.applyDifficultySurge(glitchBoost * 1.2, 6);
        this.beatBoost = Math.max(this.beatBoost, 0.35 * glitchBoost);
        this.beatBoostTimer = Math.max(this.beatBoostTimer, 6);
        this.chaosBoost = glitchBoost;
        this.chaosBoostTimer = Math.max(this.chaosBoostTimer, 4);
        const reverseChance = this.levelModifiers.reverseChance ?? 0.1;
        if (this.rng.nextFloat() < reverseChance) {
            gameState.triggerReverse(3);
            this.effects.trigger('reverse');
            this.hud.flash('Reverse Lattice!');
        } else {
            this.hud.flash('Drop Surge!');
        }
        this.directiveCooldown = Math.max(this.directiveCooldown, 4.5);
    }

    triggerQuickDraw(gameState, bridgeWindow) {
        const duration = Math.max(0.6, bridgeWindow);
        this.quickDraw = {
            timer: duration,
            duration,
            window: Math.min(0.45, duration * 0.5),
            resolved: false,
            announced: false
        };
        this.effects.trigger('slowmo');
        gameState.triggerSlowMo(1.5, 0.55);
        this.bridgeCooldown = 8;
        this.deployEventTarget({
            type: 'node',
            radius: 0.12,
            timeToImpact: duration * 0.5,
            lifespan: duration + 1.5,
            behavior: 'quickdraw',
            vec4: { x: 0, y: 0, z: 0, w: 0 }
        });
        this.hud.setStatus('Signal incoming… wait for the flash!', 'event');
        this.hud.flash('Quick Draw Prime!');
        this.directiveCooldown = Math.max(this.directiveCooldown, duration + 4);
    }

    failQuickDraw(gameState) {
        if (!this.quickDraw) return;
        this.quickDraw.resolved = true;
        this.effects.trigger('eventFail');
        this.hud.flash('Missed Signal');
        gameState.registerMiss();
        this.bridgeCooldown = 9;
        this.quickDraw = null;
        this.clearEventTarget();
        this.directiveCooldown = Math.max(this.directiveCooldown, 5);
    }

    considerGesture(reactive = {}) {
        if (this.gestureDirective) return;
        const energy = reactive.energy ?? 0.35;
        const trend = reactive.trend ?? 0;
        const silence = reactive.silence ?? 0;

        if (energy > 0.65 && trend > 0.08 && this.rng.nextFloat() < 0.28) {
            const direction = this.rng.choose(SWIPE_DIRECTIONS);
            this.startGestureDirective('swipe', {
                direction,
                duration: 2.8,
                instruction: `Swipe ${direction.toUpperCase()}!`,
                banner: 'Rhythm Flip!',
                successText: 'Beat Swiped!',
                failText: 'Late Swipe!',
                onSuccess: (state) => {
                    state.addBonusScore(400);
                    state.applyDifficultySurge(1.05, 4);
                },
                onFail: (state) => state.registerMiss(),
                postCooldown: 6
            });
            return;
        }

        if (energy > 0.35 && energy < 0.6 && Math.abs(trend) < 0.05 && this.rng.nextFloat() < 0.22) {
            const direction = this.rng.nextFloat() > 0.5 ? 'out' : 'in';
            this.startGestureDirective('pinch', {
                direction,
                duration: 3.2,
                instruction: direction === 'out' ? 'Pinch OUT!' : 'Pinch IN!',
                banner: 'Dimension Shift!',
                successText: 'Dimensional Sync!',
                failText: 'Rift Collapsed!',
                threshold: DEFAULT_PINCH_THRESHOLD,
                onSuccess: (state) => {
                    state.restoreHealth(0.06);
                    state.applyDifficultySurge(1.1, 5);
                },
                onFail: (state) => state.registerMiss(),
                postCooldown: 7
            });
            return;
        }

        if (silence > 0.55 && energy < 0.35 && this.rng.nextFloat() < 0.25) {
            this.startGestureDirective('hold', {
                duration: 4.2,
                instruction: 'Hold to stabilize!',
                banner: 'Bridge Directive!',
                successText: 'Shield Charged!',
                failText: 'Shield Flicker!',
                holdRequired: 1.6,
                onSuccess: (state) => {
                    state.restoreHealth(0.12);
                    this.effects.trigger('shield');
                },
                onFail: (state) => state.registerMiss(),
                postCooldown: 8
            });
        }
    }

    startGestureDirective(type, options = {}) {
        this.clearEventTarget();
        const {
            direction,
            duration = 3,
            instruction = 'React now!',
            banner = 'Directive!',
            successText = 'Nice!',
            failText = 'Missed!',
            threshold = DEFAULT_PINCH_THRESHOLD,
            holdRequired = 1.4,
            onSuccess,
            onFail,
            postCooldown = 5
        } = options;

        this.gestureDirective = {
            type,
            direction,
            timer: duration,
            instruction,
            banner,
            successText,
            failText,
            threshold,
            holdRequired,
            onSuccess,
            onFail,
            postCooldown,
            resolved: false,
            progress: 0,
            holding: false,
            holdTimer: 0
        };

        if (options.target) {
            this.deployEventTarget(options.target);
        }

        this.effects.trigger('glitch');
        this.hud.flash(banner);
        this.hud.setStatus(instruction, 'event');
        this.directiveCooldown = Math.max(this.directiveCooldown, 0.5);
    }

    completeGesture(gameState, success) {
        const directive = this.gestureDirective;
        if (!directive || directive.resolved) return;
        directive.resolved = true;
        this.clearEventTarget();
        if (success) {
            this.effects.trigger('eventSuccess');
            this.hud.flash(directive.successText);
            directive.onSuccess?.(gameState);
            this.hud.setStatus('Back to the groove.', 'info');
        } else {
            this.effects.trigger('eventFail');
            this.hud.flash(directive.failText);
            if (directive.onFail) {
                directive.onFail(gameState);
            } else {
                gameState.registerMiss();
            }
            this.hud.setStatus('Recover your flow.', 'alert');
        }
        this.directiveCooldown = Math.max(this.directiveCooldown, directive.postCooldown || 5);
        this.gestureDirective = null;
    }

    failGesture(gameState) {
        this.completeGesture(gameState, false);
    }

    handleRotate({ deltaX, deltaY } = {}, gameState) {
        const directive = this.gestureDirective;
        if (!directive || directive.type !== 'swipe' || directive.resolved) return;
        const magnitude = Math.hypot(deltaX || 0, deltaY || 0);
        if (magnitude < 0.12) return;
        const angle = Math.atan2(deltaY || 0, deltaX || 0);
        const targetAngle = SWIPE_ANGLES[directive.direction] ?? 0;
        const diff = Math.abs(normalizeAngleDelta(angle - targetAngle));
        if (diff < Math.PI / 5) {
            this.completeGesture(gameState, true);
        }
    }

    handlePinch({ scaleDelta } = {}, gameState) {
        const directive = this.gestureDirective;
        if (!directive || directive.type !== 'pinch' || directive.resolved) return;
        const delta = scaleDelta || 0;
        if (directive.direction === 'out') {
            directive.progress += delta;
        } else {
            directive.progress -= delta;
        }
        if (directive.progress >= directive.threshold) {
            this.completeGesture(gameState, true);
        }
    }

    handleLongPressStart(gameState) {
        const directive = this.gestureDirective;
        if (!directive || directive.type !== 'hold' || directive.resolved) return;
        directive.holding = true;
        directive.holdTimer = 0;
        this.hud.setStatus('Hold steady…', 'event');
        this.effects.trigger('shield');
    }

    handleLongPressEnd(gameState) {
        const directive = this.gestureDirective;
        if (!directive || directive.type !== 'hold' || directive.resolved) return;
        if (directive.holdTimer >= directive.holdRequired) {
            this.completeGesture(gameState, true);
        } else {
            this.failGesture(gameState);
        }
    }

    deployEventTarget(target = {}) {
        if (!this.spawner) return;
        const id = this.spawner.injectEventTarget({
            id: target.id,
            type: target.type || 'node',
            vec4: target.vec4 || { x: 0, y: 0, z: 0, w: 0 },
            vec4b: target.vec4b,
            radius: target.radius || 0.1,
            timeToImpact: target.timeToImpact ?? 0.2,
            lifespan: target.lifespan ?? 2.5,
            behavior: target.behavior || 'event',
            children: target.children || null
        });
        this.eventTargetId = id;
    }

    clearEventTarget() {
        if (!this.eventTargetId || !this.spawner) return;
        this.spawner.removeTarget(this.eventTargetId);
        this.eventTargetId = null;
    }
}

function normalizeAngleDelta(angle) {
    let diff = angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
}
