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
            this.phaseEnergy = Math.min(1, this.phaseEnergy + dt * 0.25);
        }
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
        this.remainingBeats = Math.max(0, (this.level.targetBeats || 64) - this.elapsedBeats);
    }

    registerHit(quality = 'good') {
        this.comboTimer = 0;
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        const qualityMult = quality === 'perfect' ? 1.5 : quality === 'great' ? 1.2 : 1;
        this.multiplier = 1 + Math.floor(this.combo / 8) * 0.25;
        const baseScore = 100;
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
        return this.elapsedBeats >= (this.level.targetBeats || 64);
    }

    isGameOver() {
        return this.lives <= 0;
    }
}
