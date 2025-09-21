/**
 * Maintains shader-facing parameter easings for score/miss/combo feedback.
 */
export class EffectsManager {
    constructor() {
        this.scorePulse = 0;
        this.missPulse = 0;
        this.comboShift = 0;
        this.perfectSnap = 0;
        this.shield = 0;
        this.glitchBoost = 0;
        this.glitchPhase = 0;
        this.reverseSweep = 0;
        this.tempoWave = 0;
        this.slowMoGlow = 0;
        this.directivePulse = 0;
        this.directiveAlert = 0;
    }

    trigger(event, detail = {}) {
        switch (event) {
            case 'score':
                this.scorePulse = Math.min(1, this.scorePulse + (detail.quality === 'perfect' ? 0.8 : 0.5));
                if (detail.quality === 'perfect') {
                    this.perfectSnap = 1;
                }
                break;
            case 'miss':
                this.missPulse = 1;
                break;
            case 'combo':
                this.comboShift = Math.min(1, this.comboShift + 0.15);
                break;
            case 'shield':
                this.shield = Math.min(1, this.shield + 0.4);
                break;
            case 'glitch':
                this.glitchBoost = Math.min(1, this.glitchBoost + 0.5);
                break;
            case 'reverse-start':
                this.reverseSweep = 1;
                break;
            case 'reverse-end':
                this.reverseSweep = 0;
                break;
            case 'tempo':
                this.tempoWave = 1;
                break;
            case 'slowmo':
                this.slowMoGlow = 1;
                break;
            case 'directive-start':
                this.directivePulse = Math.min(1, this.directivePulse + 0.6);
                break;
            case 'directive-success':
                this.directivePulse = 1.2;
                break;
            case 'directive-fail':
                this.directiveAlert = 1;
                break;
            default:
                break;
        }
    }

    update(dt, params, state, effectState = {}, analysis = {}) {
        const result = { ...params };
        this.scorePulse = Math.max(0, this.scorePulse - dt * 1.8);
        this.missPulse = Math.max(0, this.missPulse - dt * 2.2);
        this.comboShift = Math.max(0, this.comboShift - dt * 0.5);
        this.perfectSnap = Math.max(0, this.perfectSnap - dt * 3.5);
        this.shield = Math.max(0, this.shield - dt * 0.4);
        this.glitchBoost = Math.max(0, this.glitchBoost - dt * 0.8);
        this.reverseSweep = Math.max(0, this.reverseSweep - dt * 0.6);
        this.tempoWave = Math.max(0, this.tempoWave - dt * 0.7);
        this.slowMoGlow = Math.max(0, this.slowMoGlow - dt * 0.4);
        this.directivePulse = Math.max(0, this.directivePulse - dt * 1.5);
        this.directiveAlert = Math.max(0, this.directiveAlert - dt * 2.2);

        const glitchLevel = typeof state.getGlitchLevel === 'function' ? state.getGlitchLevel() : 0;
        if (glitchLevel > 0 || this.glitchBoost > 0) {
            this.glitchPhase += dt * (1 + glitchLevel);
        }

        result.intensity += this.scorePulse * 0.25;
        result.hue = (result.hue + this.comboShift * 40 + (state.combo % 8) * 2) % 360;
        result.chaos += (this.scorePulse * 0.1) - (this.missPulse * 0.25);
        result.saturation = Math.min(1, result.saturation + this.scorePulse * 0.15 - this.missPulse * 0.2);

        if (state.phaseActive) {
            result.speed *= 0.75;
            result.intensity *= 0.9;
        }

        if (this.missPulse) {
            result.intensity *= 0.7;
        }

        if (this.perfectSnap) {
            result.speed *= 1 + this.perfectSnap * 0.05;
        }

        if (this.shield > 0) {
            result.chaos *= 0.85;
        }

        if (glitchLevel > 0 || this.glitchBoost > 0) {
            const glitchStrength = glitchLevel * 0.3 + this.glitchBoost * 0.25;
            result.chaos += glitchStrength;
            result.hue = (result.hue + Math.sin(this.glitchPhase * 6) * 40 * glitchStrength) % 360;
            result.intensity += Math.sin(this.glitchPhase * 12) * 0.06 * glitchStrength;
        }

        if (this.reverseSweep > 0 || effectState?.reverseControls) {
            result.hue = (result.hue + 180 * this.reverseSweep) % 360;
            result.saturation = Math.max(0.4, result.saturation - 0.1 * this.reverseSweep);
        }

        if (this.tempoWave > 0 || (effectState?.tempoMultiplier && effectState.tempoMultiplier !== 1)) {
            const tempoBoost = (effectState?.tempoMultiplier || 1) - 1 + this.tempoWave * 0.2;
            result.speed *= 1 + tempoBoost * 0.4;
            result.gridDensity *= 1 + tempoBoost * 0.2;
        }

        if (this.slowMoGlow > 0 || (state.getTimeWarp && state.getTimeWarp() < 1)) {
            result.speed *= 0.92;
            result.intensity = Math.min(1.4, result.intensity + 0.08 * this.slowMoGlow);
        }

        if (analysis && typeof analysis.energy === 'number') {
            result.intensity += (analysis.energy - 0.5) * 0.1;
        }

        if (this.directivePulse > 0) {
            result.intensity += this.directivePulse * 0.12;
            result.hue = (result.hue + this.directivePulse * 22) % 360;
        }

        if (this.directiveAlert > 0) {
            result.chaos += this.directiveAlert * 0.35;
            result.intensity *= 1 - Math.min(0.3, this.directiveAlert * 0.2);
        }

        return result;
    }
}
