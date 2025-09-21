/**
 * Core gameplay state: score, combo, timers, and parameter targets.
 */
export class GameState {
    constructor(levelConfig) {
        this.resetRunState();
        this.transitionToLevel(levelConfig, { resetRun: true });
    }

    resetRunState() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.multiplier = 1;
        this.lives = 3;
        this.maxLives = 5;
        this.health = 1.0;
        this.totalBeats = 0;
        this.totalStagesCleared = 0;
        this.phaseEnergy = 1.0;
        this.phaseActive = false;
        this.phaseCooldown = 0;
        this.comboTimer = 0;
        this.comboTimeout = 4;
        this.slowMoTimer = 0;
        this.slowMoFactor = 0.6;
        this.slowMoCooldown = 0;
        this.extraLifeCooldown = 0;
        this.reverseTimer = 0;
        this.reverseDuration = 0;
        this.glitchTimer = 0;
        this.glitchDuration = 1;
        this.difficultyScale = 1;
        this.difficultySurgeMultiplier = 1;
        this.difficultySurgeTimer = 0;
        this.timeScale = 1;
    }

    transitionToLevel(levelConfig, { resetRun = false } = {}) {
        this.level = levelConfig;
        this.stage = levelConfig?.stage || this.stage || 1;
        this.beatIndex = 0;
        this.elapsedBeats = 0;
        this.remainingBeats = levelConfig?.targetBeats || 64;
        this.pulseWindow = (levelConfig?.windowMs || 150) / 1000;
        this.comboTimer = 0;
        this.stageStartScore = resetRun ? 0 : this.score;
        this.difficultyScale = levelConfig?.difficultyScale || this.difficultyScale || 1;
        this.parameters = this.buildParameters(levelConfig);
        this.targetParameters = { ...this.parameters };
    }

    buildParameters(levelConfig) {
        return {
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
                this.phaseCooldown = 2.5;
            }
        } else if (this.phaseCooldown > 0) {
            this.phaseCooldown = Math.max(0, this.phaseCooldown - dt);
        } else {
            this.phaseEnergy = Math.min(1, this.phaseEnergy + dt * 0.25);
        }

        if (this.slowMoTimer > 0) {
            this.slowMoTimer = Math.max(0, this.slowMoTimer - dt);
        }
        if (this.slowMoCooldown > 0) {
            this.slowMoCooldown = Math.max(0, this.slowMoCooldown - dt);
        }
        if (this.extraLifeCooldown > 0) {
            this.extraLifeCooldown = Math.max(0, this.extraLifeCooldown - dt);
        }
        if (this.reverseTimer > 0) {
            this.reverseTimer = Math.max(0, this.reverseTimer - dt);
        }
        if (this.glitchTimer > 0) {
            this.glitchTimer = Math.max(0, this.glitchTimer - dt);
        }
        if (this.difficultySurgeTimer > 0) {
            this.difficultySurgeTimer = Math.max(0, this.difficultySurgeTimer - dt);
            if (this.difficultySurgeTimer <= 0) {
                this.difficultySurgeMultiplier = 1;
            }
        }

        const phaseScale = this.phaseActive ? 0.85 : 1;
        this.timeScale = (this.slowMoTimer > 0 ? this.slowMoFactor : 1) * phaseScale;
    }

    applyParameterDelta(delta) {
        Object.keys(delta).forEach((key) => {
            if (!(key in this.targetParameters)) return;
            let value = delta[key];
            if (this.reverseTimer > 0 && key.startsWith('rot4d')) {
                value = -value;
            }
            this.targetParameters[key] += value;
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
        this.remainingBeats = Math.max(0, (this.level?.targetBeats || 64) - this.elapsedBeats);
    }

    registerHit(quality = 'good') {
        this.comboTimer = 0;
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        const qualityMult = quality === 'perfect' ? 1.5 : quality === 'great' ? 1.2 : 1;
        this.multiplier = 1 + Math.floor(this.combo / 8) * 0.25;
        const baseScore = 100 * this.getDifficultyMultiplier();
        this.score += Math.floor(baseScore * qualityMult * this.multiplier);
    }

    registerMiss() {
        this.lives = Math.max(0, this.lives - 1);
        const severity = Math.min(1.5, 0.9 + (this.getDifficultyMultiplier() - 1) * 0.4);
        this.health = Math.max(0, this.health - 0.18 * severity);
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

    triggerSlowMo(duration = 2.8, factor = 0.55) {
        if (this.slowMoCooldown > 0) return false;
        this.slowMoTimer = duration;
        this.slowMoFactor = factor;
        this.slowMoCooldown = 8;
        return true;
    }

    grantExtraLife() {
        if (this.extraLifeCooldown > 0) return false;
        if (this.lives >= this.maxLives) return false;
        this.lives += 1;
        this.restoreHealth(0.35);
        this.extraLifeCooldown = 25;
        return true;
    }

    restoreHealth(amount) {
        this.health = Math.min(1, this.health + amount);
    }

    triggerReverse(duration = 2.6) {
        this.reverseTimer = duration;
        this.reverseDuration = duration;
    }

    triggerGlitch(duration = 1.5) {
        this.glitchTimer = duration;
        this.glitchDuration = duration;
    }

    applyDifficultySurge(multiplier = 1.2, duration = 4) {
        this.difficultySurgeMultiplier = Math.max(this.difficultySurgeMultiplier, multiplier);
        this.difficultySurgeTimer = Math.max(this.difficultySurgeTimer, duration);
    }

    addBonusScore(amount) {
        this.score += Math.round(amount * this.getDifficultyMultiplier());
    }

    markStageComplete() {
        this.totalStagesCleared = Math.max(this.totalStagesCleared, this.stage || 1);
    }

    getDifficultyMultiplier() {
        return (this.difficultyScale || 1) * (this.difficultySurgeMultiplier || 1);
    }

    getTimeScale() {
        return this.timeScale;
    }

    getReverseDirection() {
        return this.reverseTimer > 0 ? -1 : 1;
    }

    getGlitchLevel() {
        if (this.glitchTimer <= 0) return 0;
        return Math.min(1, this.glitchTimer / (this.glitchDuration || 1));
    }

    getStageSummary() {
        return {
            stage: this.stage,
            totalScore: this.score,
            stageScore: this.score - (this.stageStartScore || 0),
            combo: this.maxCombo,
            lives: this.lives,
            health: this.health,
            difficulty: this.getDifficultyMultiplier()
        };
    }

    isLevelComplete() {
        return this.elapsedBeats >= (this.level?.targetBeats || 64);
    }

    isGameOver() {
        return this.lives <= 0;
    }
}
