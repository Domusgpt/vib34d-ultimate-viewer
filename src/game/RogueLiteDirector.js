/**
 * Drives rogue-lite pacing, dynamic difficulty, and scripted audio-reactive events.
 */
export class RogueLiteDirector {
    constructor() {
        this.templates = [];
        this.stage = null;
        this.analysis = null;
        this.activeEvent = null;
        this.timeSinceEvent = 0;
        this.nextEventAt = 8;
        this.lastBeat = 0;
        this.refs = {
            geometryController: null,
            spawnSystem: null,
            gameState: null,
            hud: null,
            effectsManager: null
        };
    }

    setTemplates(templates) {
        this.templates = templates;
    }

    bind(refs = {}) {
        this.refs = { ...this.refs, ...refs };
    }

    onStageStart(stage, refs = {}) {
        this.stage = stage;
        this.bind(refs);
        this.analysis = null;
        this.activeEvent = null;
        this.timeSinceEvent = 0;
        this.nextEventAt = this.computeNextEventDelay();
        this.lastBeat = 0;
        const { hud, gameState } = this.refs;
        if (hud?.setRunMeta && gameState) {
            hud.setRunMeta({
                depth: gameState.getRunDepth ? gameState.getRunDepth() : stage.runDepth || 1,
                loop: gameState.getRunLoop ? gameState.getRunLoop() : stage.runLoop || 0,
                flow: stage.difficultyScale || 1,
                tempo: stage.difficulty?.speed || 1,
                charges: gameState.getSlowMoCharges ? gameState.getSlowMoCharges() : 0
            });
        }
        hud?.clearEventPrompt?.();
    }

    computeNextEventDelay() {
        const rng = this.refs.geometryController?.random?.bind(this.refs.geometryController);
        const random = rng ? rng() : Math.random();
        const base = 6 + random * 4;
        const depthFactor = Math.max(0.5, 1 - (this.stage?.runDepth || 1) * 0.02);
        return base * depthFactor;
    }

    update(dt, analysis, refs = {}) {
        this.bind(refs);
        if (analysis) {
            this.analysis = analysis;
        }
        const { spawnSystem, gameState, hud, effectsManager } = this.refs;
        if (!spawnSystem || !gameState) return;

        const stageDiff = this.stage?.difficulty || {};
        const baseScale = this.stage?.difficultyScale || 1;
        const audio = this.analysis || {};
        const tempoModifier = gameState.getTempoModifier ? gameState.getTempoModifier() : 1;
        const glitchLevel = gameState.getGlitchLevel ? gameState.getGlitchLevel() : 0;

        const densityBase = stageDiff.density ?? 1;
        const speedBase = stageDiff.speed ?? 1;
        const chaosBase = stageDiff.chaos ?? 0.2;

        const density = clamp(
            densityBase * baseScale * (1 + (audio.energy ?? 0) * 0.2 + (audio.surge ? 0.15 : 0) - (audio.silence ? 0.12 : 0)),
            0.45,
            5
        );
        const speed = clamp(
            speedBase * tempoModifier * (1 + (audio.trend ?? 0) * 0.4) * (audio.drop ? 0.92 : 1),
            0.45,
            4.2
        );
        const chaos = clamp(
            chaosBase * (1 + glitchLevel * 0.4 + (audio.high ?? 0) * 0.4),
            0.05,
            2.5
        );

        spawnSystem.setDifficulty({ density, speed, chaos });
        const tempoScale = clamp(tempoModifier * (this.activeEvent?.tempoScale ?? 1) * (audio.silence ? 0.9 : 1), 0.35, 2);
        spawnSystem.setTempoScale(tempoScale);

        gameState.setFlow((density + speed) * 0.5);
        if (hud?.setRunMeta) {
            hud.setRunMeta({
                depth: gameState.getRunDepth ? gameState.getRunDepth() : this.stage?.runDepth || 1,
                loop: gameState.getRunLoop ? gameState.getRunLoop() : this.stage?.runLoop || 0,
                flow: gameState.getFlow ? gameState.getFlow() : (density + speed) * 0.5,
                tempo: tempoScale,
                charges: gameState.getSlowMoCharges ? gameState.getSlowMoCharges() : 0
            });
        }

        if (this.activeEvent) {
            this.activeEvent.timer += dt;
            if (this.activeEvent.type === 'glitch-rush' && gameState.combo < this.activeEvent.comboBaseline) {
                this.completeEvent(false);
            } else if (this.activeEvent.timer >= this.activeEvent.timeout) {
                const success = this.activeEvent.autoResolve ? (this.activeEvent.completed !== false) : this.activeEvent.completed === true;
                this.completeEvent(success);
            }
        } else {
            this.timeSinceEvent += dt;
            if (this.timeSinceEvent >= this.nextEventAt) {
                const type = this.pickEventType(audio);
                this.beginEvent(type);
            }
        }
    }

    handleBeat(beatInfo) {
        this.lastBeat = beatInfo.beat;
    }

    handleAudioEvent(event) {
        if (this.activeEvent) return;
        switch (event.type) {
            case 'drop':
                this.beginEvent('quick-draw');
                break;
            case 'surge':
                this.beginEvent('glitch-rush');
                break;
            case 'silence':
                this.beginEvent('tempo-flip');
                break;
            case 'vocal':
                this.beginEvent('extra-life');
                break;
            default:
                break;
        }
    }

    pickEventType(audio) {
        if (audio?.drop) return 'quick-draw';
        if (audio?.surge) return 'glitch-rush';
        if (audio?.silence) return 'tempo-flip';
        if (audio?.vocal) return 'slowmo-charge';
        const rng = this.refs.geometryController?.random?.bind(this.refs.geometryController);
        const random = rng ? rng() : Math.random();
        if (random < 0.25) return 'quick-draw';
        if (random < 0.5) return 'reverse-flick';
        if (random < 0.7) return 'slowmo-charge';
        if (random < 0.85) return 'extra-life';
        return 'glitch-rush';
    }

    beginEvent(type) {
        if (!type || this.activeEvent) return;
        const { geometryController, spawnSystem, hud, effectsManager, gameState } = this.refs;
        if (!spawnSystem || !gameState) return;
        const baseBeat = this.lastBeat || gameState.beatIndex || 0;
        const idSuffix = geometryController?.rng?.nextInt ? geometryController.rng.nextInt(0, 999999) : Math.floor(Math.random() * 999999);
        const eventId = `${type}-${idSuffix}`;
        const event = {
            id: eventId,
            type,
            timer: 0,
            timeout: 2.6,
            completed: false,
            autoResolve: false,
            tempoScale: 1,
            cleanup: null
        };

        switch (type) {
            case 'quick-draw': {
                const target = geometryController?.createEventTarget('quick-draw', baseBeat + 0.4, { urgency: 0.55 }) || null;
                if (target) {
                    target.eventTag = eventId;
                    spawnSystem.injectEventTarget(target);
                }
                event.timeout = 1.4;
                event.requiresTarget = true;
                event.targetTag = eventId;
                event.onSuccess = () => {
                    gameState.registerEventSuccess('quick-draw');
                    effectsManager?.trigger('eventSuccess');
                    hud?.flash('Quick Draw!');
                };
                event.onFail = () => {
                    gameState.registerEventFailure('quick-draw');
                    effectsManager?.trigger('eventFail');
                    hud?.flash('Too Slow');
                };
                hud?.showEventPrompt('QUICK DRAW! TAP THE FLASH!', 'alert');
                effectsManager?.trigger('glitch', { intensity: 0.5 });
                break;
            }
            case 'reverse-flick': {
                const direction = (geometryController?.random?.() ?? Math.random()) > 0.5 ? 'left' : 'right';
                const target = geometryController?.createEventTarget('reverse-flick', baseBeat + 0.6, { urgency: 0.7 });
                if (target) {
                    target.eventTag = eventId;
                    spawnSystem.injectEventTarget(target);
                }
                spawnSystem.triggerReverse(1.6);
                spawnSystem.setGlitch(0.4, 1.4);
                event.timeout = 2.1;
                event.requiresInput = 'flick';
                event.direction = direction;
                event.cleanup = () => spawnSystem.setGlitch(0);
                event.onSuccess = () => {
                    gameState.registerEventSuccess('reverse-flick');
                    effectsManager?.trigger('reverse');
                    hud?.flash(`Reverse ${direction === 'left' ? 'Left' : 'Right'}!`);
                };
                event.onFail = () => {
                    gameState.registerEventFailure('reverse-flick');
                    effectsManager?.trigger('eventFail');
                    hud?.flash('Glitch Slam!');
                };
                hud?.showEventPrompt(`FLICK ${direction.toUpperCase()} NOW!`, 'alert');
                break;
            }
            case 'slowmo-charge': {
                event.timeout = 2.4;
                event.requiresInput = 'doubletap';
                event.onSuccess = () => {
                    gameState.gainSlowMoCharge(1);
                    effectsManager?.trigger('slowmo');
                    hud?.flash('Slow-Mo Ready');
                };
                event.onFail = () => {
                    hud?.showEventPrompt('Missed the charge.', 'info');
                };
                hud?.showEventPrompt('DOUBLE TAP FOR SLOW-MO CHARGE', 'focus');
                break;
            }
            case 'extra-life': {
                event.timeout = 3.2;
                event.requiresInput = 'longpress';
                event.holding = false;
                event.onSuccess = () => {
                    gameState.gainLife(1);
                    effectsManager?.trigger('eventSuccess');
                    hud?.flash('Extra Life!');
                };
                event.onFail = () => {
                    gameState.registerEventFailure('extra-life');
                    effectsManager?.trigger('eventFail');
                    hud?.flash('Stability Lost');
                };
                hud?.showEventPrompt('LONG PRESS TO STABILIZE', 'focus');
                break;
            }
            case 'tempo-flip': {
                event.timeout = 3.8;
                event.requiresInput = 'doubletap';
                event.tempoScale = 0.7;
                event.onSuccess = () => {
                    gameState.registerEventSuccess('tempo-flip');
                    effectsManager?.trigger('tempoShift', { direction: 'down' });
                    hud?.flash('Tempo Locked');
                };
                event.onFail = () => {
                    gameState.registerEventFailure('tempo-flip');
                    effectsManager?.trigger('eventFail');
                    hud?.flash('Tempo Crash');
                };
                gameState.applyTempoModifier(0.7, event.timeout);
                spawnSystem.setTempoScale(0.7);
                event.cleanup = () => {
                    spawnSystem.setTempoScale(gameState.getTempoModifier ? gameState.getTempoModifier() : 1);
                };
                hud?.showEventPrompt('TEMPO FLIP! DOUBLE TAP TO LOCK IN', 'glitch');
                break;
            }
            case 'glitch-rush': {
                event.timeout = 4.5;
                event.autoResolve = true;
                event.comboBaseline = gameState.combo;
                event.tempoScale = 1.2;
                spawnSystem.setTempoScale(1.2);
                spawnSystem.setGlitch(1, event.timeout);
                gameState.boostGlitch(0.7, event.timeout);
                event.cleanup = () => {
                    spawnSystem.setGlitch(0);
                    spawnSystem.setTempoScale(gameState.getTempoModifier ? gameState.getTempoModifier() : 1);
                };
                event.onSuccess = () => {
                    gameState.registerEventSuccess('glitch-rush');
                    effectsManager?.trigger('glitch', { intensity: 1 });
                    hud?.flash('Glitch Ride!');
                };
                event.onFail = () => {
                    gameState.registerEventFailure('glitch-rush');
                    effectsManager?.trigger('eventFail');
                    hud?.flash('Glitch Crash');
                };
                hud?.showEventPrompt('GLITCH RUSH! KEEP YOUR COMBO!', 'glitch');
                break;
            }
            default:
                break;
        }

        this.activeEvent = event;
        this.timeSinceEvent = 0;
        this.nextEventAt = this.computeNextEventDelay();
    }

    completeEvent(success) {
        if (!this.activeEvent) return;
        const { hud, spawnSystem } = this.refs;
        const event = this.activeEvent;
        if (success) {
            event.completed = true;
            event.onSuccess?.();
        } else {
            event.completed = false;
            event.onFail?.();
        }
        if (event.cleanup) {
            event.cleanup();
        }
        hud?.clearEventPrompt(success ? 800 : 1200);
        if (!event.cleanup && event.tempoScale !== 1) {
            const baseTempo = this.refs.gameState?.getTempoModifier ? this.refs.gameState.getTempoModifier() : 1;
            spawnSystem?.setTempoScale(baseTempo);
        }
        this.activeEvent = null;
        this.timeSinceEvent = 0;
        this.nextEventAt = this.computeNextEventDelay();
    }

    handleInput(action, detail = {}, refs = {}) {
        this.bind(refs);
        const { gameState, spawnSystem, hud, effectsManager } = this.refs;
        if (!gameState) return false;

        if (this.activeEvent) {
            const event = this.activeEvent;
            switch (event.requiresInput) {
                case 'doubletap':
                    if (action === 'doubletap') {
                        event.completed = true;
                        this.completeEvent(true);
                        return true;
                    }
                    break;
                case 'longpress':
                    if (action === 'longpressstart') {
                        event.holding = true;
                        hud?.showEventPrompt('Hold steady...', 'focus');
                        return true;
                    }
                    if (action === 'longpressend') {
                        if (event.holding) {
                            event.completed = true;
                            this.completeEvent(true);
                        } else {
                            this.completeEvent(false);
                        }
                        return true;
                    }
                    break;
                case 'flick':
                    if (action === 'flick') {
                        const matches = event.direction === detail.direction;
                        this.completeEvent(matches);
                        return true;
                    }
                    break;
                default:
                    break;
            }
        } else {
            if (action === 'doubletap') {
                if (gameState.useSlowMoCharge()) {
                    gameState.applyTempoModifier(0.65, 2.6);
                    spawnSystem?.setTempoScale(gameState.getTempoModifier ? gameState.getTempoModifier() : 0.65);
                    effectsManager?.trigger('slowmo');
                    hud?.flash('Slow Motion!');
                    return true;
                }
            }
            if (action === 'longpressend') {
                if (gameState.convertComboToLife()) {
                    effectsManager?.trigger('eventSuccess');
                    hud?.flash('Converted Combo → Life');
                    return true;
                }
            }
        }

        return false;
    }

    handleTargetHit(target) {
        if (!this.activeEvent || !target?.eventTag) return;
        if (this.activeEvent.requiresTarget && target.eventTag === this.activeEvent.targetTag) {
            this.activeEvent.completed = true;
            this.completeEvent(true);
        }
    }

    handleTargetExpired(target) {
        if (!this.activeEvent || !target?.eventTag) return;
        if (this.activeEvent.requiresTarget && target.eventTag === this.activeEvent.targetTag) {
            this.completeEvent(false);
        }
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
