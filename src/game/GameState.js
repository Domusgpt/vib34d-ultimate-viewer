/**
 * Core gameplay state: score, combo, timers, and parameter targets.
 */
export class GameState {
    constructor(levelConfig) {
        this.level = levelConfig;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.multiplier = 1;
        this.lives = 3;
        this.health = 1.0;
        this.beatIndex = 0;
        this.elapsedBeats = 0;
        this.remainingBeats = levelConfig.targetBeats || 64;
        this.pulseWindow = (levelConfig.windowMs || 150) / 1000;
        this.phaseEnergy = 1.0;
        this.phaseActive = false;
        this.phaseCooldown = 0;
        this.comboTimer = 0;
        this.comboTimeout = 4; // seconds to maintain combo
        this.stage = levelConfig.stage || 1;
        this.runId = levelConfig.runId || null;
        this.endless = Boolean(levelConfig.endless);
        this.runMultiplier = levelConfig.runMultiplier || 1;
        this.stageTargetBeats = this.remainingBeats;
        this.totalBeats = 0;
        this.specialCharges = Math.min(levelConfig.maxCharges || 3, Math.max(0, Math.round(levelConfig.specialCharges ?? 1)));
        this.maxCharges = levelConfig.maxCharges || 3;
        this.phaseRegenBonus = 0;
        this.timeWarp = 1;
        this.timeWarpTarget = 1;
        this.timeWarpTimer = 0;
        this.controlInversion = false;
        this.controlInversionTimer = 0;
        this.glitchLevel = 0;
        this.glitchTimer = 0;
        this.modifierFlags = new Set(levelConfig.modifiers || []);

        this.parameters = {
            geometry: levelConfig.geometryIndex ?? 0,
            variant: levelConfig.variantIndex ?? levelConfig.geometryIndex ?? 0,
            gridDensity: levelConfig.difficulty?.density ?? 18,
            morphFactor: levelConfig.difficulty?.morph ?? 1.0,
            chaos: levelConfig.difficulty?.chaos ?? 0.15,
            speed: levelConfig.difficulty?.speed ?? 1.0,
            hue: levelConfig.color?.hue ?? 200,
            intensity: levelConfig.color?.intensity ?? 0.55,
            saturation: levelConfig.color?.saturation ?? 0.85,
            dimension: levelConfig.difficulty?.dimension ?? 3.6,
            rot4dXW: 0,
            rot4dYW: 0,
            rot4dZW: 0
        };

        this.targetParameters = { ...this.parameters };
        this.activeDirective = null;
        this.directiveEvents = [];
    }

    /** Update timers each fixed tick */
    update(dt) {
        this.comboTimer += dt;
        if (this.comboTimer > this.comboTimeout) {
            this.resetCombo();
        }

        if (this.phaseActive) {
            this.phaseEnergy = Math.max(0, this.phaseEnergy - dt * 0.45);
            if (this.phaseEnergy <= 0) {
                this.stopPhase();
                this.phaseCooldown = 2.5; // seconds before next activation
            }
        } else if (this.phaseCooldown > 0) {
            this.phaseCooldown = Math.max(0, this.phaseCooldown - dt);
        } else {
            const regen = 0.25 + this.phaseRegenBonus;
            this.phaseEnergy = Math.min(1, this.phaseEnergy + dt * regen);
        }

        if (this.timeWarpTimer > 0) {
            this.timeWarpTimer = Math.max(0, this.timeWarpTimer - dt);
            if (this.timeWarpTimer === 0) {
                this.timeWarpTarget = 1;
            }
        }
        this.timeWarp += (this.timeWarpTarget - this.timeWarp) * Math.min(1, dt * 4);

        if (this.controlInversionTimer > 0) {
            this.controlInversionTimer = Math.max(0, this.controlInversionTimer - dt);
            if (this.controlInversionTimer === 0) {
                this.controlInversion = false;
            }
        }

        if (this.glitchTimer > 0) {
            this.glitchTimer = Math.max(0, this.glitchTimer - dt);
            if (this.glitchTimer === 0) {
                this.glitchLevel = 0;
            }
        }

        this.updateDirective(dt);
    }

    applyParameterDelta(delta) {
        Object.keys(delta).forEach((key) => {
            if (key in this.targetParameters) {
                this.targetParameters[key] += delta[key];
            }
        });
    }

    setTargetParameter(name, value) {
        if (name in this.targetParameters) {
            this.targetParameters[name] = value;
        }
    }

    getParameters() {
        return this.parameters;
    }

    /** Ease parameters towards targets */
    settleParameters(dt) {
        const ease = 8;
        Object.keys(this.parameters).forEach((key) => {
            const current = this.parameters[key];
            const target = this.targetParameters[key];
            if (typeof current === 'number' && typeof target === 'number') {
                this.parameters[key] = current + (target - current) * Math.min(1, ease * dt);
            }
        });
    }

    registerBeat() {
        this.beatIndex += 1;
        this.elapsedBeats += 1;
        this.totalBeats += 1;
        const target = this.level.targetBeats || this.stageTargetBeats || 64;
        this.stageTargetBeats = target;
        this.remainingBeats = Math.max(0, target - this.elapsedBeats);
    }

    registerHit(quality = 'good') {
        this.comboTimer = 0;
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        const qualityMult = quality === 'perfect' ? 1.5 : quality === 'great' ? 1.2 : 1;
        this.multiplier = 1 + Math.floor(this.combo / 8) * 0.25;
        if (this.combo && this.combo % 12 === 0) {
            this.gainSpecialCharge(1);
        }
        const baseScore = 100 * (this.runMultiplier || 1);
        this.score += Math.floor(baseScore * qualityMult * this.multiplier);
    }

    registerMiss() {
        this.lives = Math.max(0, this.lives - 1);
        this.health = Math.max(0, this.health - 0.18);
        this.resetCombo();
    }

    resetCombo() {
        this.combo = 0;
        this.multiplier = 1;
        this.comboTimer = 0;
    }

    startPhase() {
        if (this.phaseCooldown > 0 || this.phaseEnergy <= 0.2) return false;
        this.phaseActive = true;
        return true;
    }

    stopPhase() {
        this.phaseActive = false;
    }

    isLevelComplete() {
        const target = this.level.targetBeats || this.stageTargetBeats || 64;
        return this.elapsedBeats >= target;
    }

    isGameOver() {
        return this.lives <= 0;
    }

    applyStage(levelConfig) {
        this.level = levelConfig;
        this.stage = levelConfig.stage || this.stage;
        this.stageTargetBeats = levelConfig.targetBeats || this.stageTargetBeats;
        this.elapsedBeats = 0;
        this.remainingBeats = this.stageTargetBeats;
        this.pulseWindow = (levelConfig.windowMs || 150) / 1000;
        if (levelConfig.runMultiplier) {
            this.runMultiplier = levelConfig.runMultiplier;
        }
        if (Array.isArray(levelConfig.modifiers)) {
            this.setModifierFlags(levelConfig.modifiers);
        }
        this.activeDirective = null;
        this.directiveEvents.length = 0;
        if (typeof levelConfig.specialCharges === 'number') {
            this.specialCharges = Math.min(this.maxCharges, Math.max(0, Math.round(levelConfig.specialCharges)));
        }
        this.targetParameters = {
            ...this.targetParameters,
            gridDensity: levelConfig.difficulty?.density ?? this.targetParameters.gridDensity,
            morphFactor: levelConfig.difficulty?.morph ?? this.targetParameters.morphFactor,
            chaos: levelConfig.difficulty?.chaos ?? this.targetParameters.chaos,
            speed: levelConfig.difficulty?.speed ?? this.targetParameters.speed
        };
    }

    setPhaseRegenBonus(value = 0) {
        this.phaseRegenBonus = Math.max(0, value);
    }

    activateSlowMo(duration = 3, factor = 0.6) {
        this.timeWarpTarget = Math.max(0.3, factor);
        this.timeWarpTimer = Math.max(this.timeWarpTimer, duration);
        this.timeWarp = this.timeWarpTarget;
    }

    getTimeWarp() {
        return this.timeWarp;
    }

    activateReverseControls(duration = 4) {
        this.controlInversion = true;
        this.controlInversionTimer = Math.max(this.controlInversionTimer, duration);
    }

    isControlInverted() {
        return this.controlInversion;
    }

    applyGlitch(level = 1, duration = 2) {
        this.glitchLevel = Math.max(this.glitchLevel, level);
        this.glitchTimer = Math.max(this.glitchTimer, duration);
    }

    getGlitchLevel() {
        return this.glitchLevel;
    }

    grantLife() {
        this.lives = Math.min(5, this.lives + 1);
        this.health = Math.min(1, this.health + 0.25);
    }

    gainSpecialCharge(amount = 1) {
        const delta = Math.max(0, Math.floor(amount));
        if (!delta) return;
        this.specialCharges = Math.min(this.maxCharges, this.specialCharges + delta);
    }

    consumeSpecialCharge() {
        return this.spendSpecialCharges(1);
    }

    getChargeState() {
        return { current: this.specialCharges, max: this.maxCharges };
    }

    spendSpecialCharges(count = 1) {
        const needed = Math.max(0, Math.floor(count));
        if (needed <= 0) return true;
        if (this.specialCharges < needed) {
            return false;
        }
        this.specialCharges = Math.max(0, this.specialCharges - needed);
        return true;
    }

    setModifierFlags(flags = []) {
        this.modifierFlags = new Set(flags);
    }

    hasModifier(id) {
        return this.modifierFlags.has(id);
    }

    startDirective(definition = {}) {
        if (!definition) return;
        if (this.activeDirective) {
            this.completeDirective(false, 'replaced');
        }
        const duration = Math.max(1, definition.duration ?? 3);
        this.activeDirective = {
            id: definition.id || `directive-${Date.now()}`,
            label: definition.label || 'Directive',
            requirement: definition.requirement || 'pulse-count',
            goal: Math.max(1, definition.goal ?? 1),
            progress: 0,
            remaining: duration,
            duration,
            threshold: definition.threshold ?? 0.15,
            reward: definition.reward || {},
            penalty: definition.penalty || {},
            variant: definition.variant || 'info',
            accumulated: 0
        };
        this.directiveEvents.push({ type: 'directive-start', directive: this.getDirectiveState() });
    }

    updateDirective(dt) {
        if (!this.activeDirective) return;
        const directive = this.activeDirective;
        directive.remaining = Math.max(0, directive.remaining - dt);
        if (directive.requirement === 'phase-hold') {
            if (this.phaseActive) {
                directive.accumulated += dt;
                directive.progress = directive.accumulated;
                if (directive.progress >= directive.goal) {
                    this.completeDirective(true, 'phase-hold');
                    return;
                }
            }
        }
        if (directive.remaining <= 0) {
            if (directive.requirement === 'no-pulse') {
                this.completeDirective(true, 'timed');
            } else if (directive.requirement === 'phase-hold') {
                this.completeDirective(false, 'timeout');
            } else if (directive.progress < directive.goal) {
                this.completeDirective(false, 'timeout');
            }
        }
    }

    registerDirectiveAction(action, detail = {}) {
        if (!this.activeDirective) return false;
        const directive = this.activeDirective;
        switch (directive.requirement) {
            case 'pulse-count':
                if (action === 'pulse' && detail.success !== false) {
                    directive.progress += 1;
                }
                break;
            case 'pulse-precision':
                if (action === 'pulse' && (detail.quality === 'perfect' || detail.quality === 'great')) {
                    directive.progress += 1;
                }
                break;
            case 'swipe':
                if (action === 'swipe' && (detail.magnitude || 0) >= (directive.threshold || 0.15)) {
                    directive.progress += 1;
                }
                break;
            case 'phase-hold':
                if (action === 'phase-end' && (directive.progress || directive.accumulated || 0) < directive.goal) {
                    this.completeDirective(false, 'phase-drop');
                    return true;
                }
                break;
            case 'no-pulse':
                if (action === 'pulse') {
                    this.completeDirective(false, 'pulse');
                    return true;
                }
                break;
            case 'special':
                if (action === 'special') {
                    directive.progress += 1;
                }
                break;
            default:
                break;
        }
        if (directive.requirement !== 'phase-hold' && directive.requirement !== 'no-pulse' && directive.progress >= directive.goal) {
            this.completeDirective(true, 'progress');
            return true;
        }
        return false;
    }

    completeDirective(success, reason = '') {
        if (!this.activeDirective) return;
        const directive = this.activeDirective;
        const payload = {
            type: success ? 'directive-complete' : 'directive-fail',
            status: success ? 'success' : 'fail',
            id: directive.id,
            label: directive.label,
            reward: success ? directive.reward : null,
            penalty: success ? null : directive.penalty,
            reason
        };
        this.directiveEvents.push(payload);
        this.activeDirective = null;
    }

    consumeDirectiveEvents() {
        if (!this.directiveEvents.length) return [];
        const events = this.directiveEvents.slice();
        this.directiveEvents.length = 0;
        return events;
    }

    getDirectiveState() {
        if (!this.activeDirective) return null;
        const directive = this.activeDirective;
        const progress = directive.requirement === 'phase-hold'
            ? Math.min(directive.accumulated || directive.progress || 0, directive.goal)
            : Math.min(directive.progress, directive.goal);
        return {
            id: directive.id,
            label: directive.label,
            requirement: directive.requirement,
            goal: directive.goal,
            progress,
            remaining: directive.remaining,
            duration: directive.duration,
            variant: directive.variant
        };
    }

    hasActiveDirective() {
        return Boolean(this.activeDirective);
    }
}
