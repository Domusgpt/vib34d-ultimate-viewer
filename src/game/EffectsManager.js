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
        this.glitch = 0;
        this.reverse = 0;
        this.rhythm = 0;
        this.slowmo = 0;
        this.woah = 0;
        this.glitchPhase = 0;
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
                this.glitch = Math.min(2, this.glitch + (detail.intensity || 0.8));
                break;
            case 'reverse':
                this.reverse = Math.min(1.2, this.reverse + 0.8);
                break;
            case 'slowmo':
                this.slowmo = Math.min(1, this.slowmo + 0.6);
                break;
            case 'rhythm':
                this.rhythm = Math.min(1.2, this.rhythm + 0.9);
                break;
            case 'woah':
                this.woah = 1;
                break;
            default:
                break;
        }
    }

    update(dt, params, state, context = {}) {
        const result = { ...params };
        this.scorePulse = Math.max(0, this.scorePulse - dt * 1.8);
        this.missPulse = Math.max(0, this.missPulse - dt * 2.2);
        this.comboShift = Math.max(0, this.comboShift - dt * 0.5);
        this.perfectSnap = Math.max(0, this.perfectSnap - dt * 3.5);
        this.shield = Math.max(0, this.shield - dt * 0.4);
        this.glitch = Math.max(0, this.glitch - dt * 0.4);
        this.reverse = Math.max(0, this.reverse - dt * 0.3);
        this.rhythm = Math.max(0, this.rhythm - dt * 0.45);
        this.slowmo = Math.max(0, this.slowmo - dt * 0.5);
        this.woah = Math.max(0, this.woah - dt * 2.4);
        this.glitchPhase = (this.glitchPhase + dt * (3 + this.glitch * 6)) % 1;

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

        const glitchAmount = this.glitch + (state.glitchActive ? 0.6 : 0);
        if (glitchAmount > 0) {
            const wave = Math.sin(this.glitchPhase * Math.PI * 2) + Math.cos(this.glitchPhase * 6);
            result.hue = (result.hue + wave * 30 * glitchAmount) % 360;
            result.chaos += glitchAmount * 0.35;
            result.intensity += glitchAmount * 0.12;
        }

        if (this.reverse > 0 || state.reverseActive) {
            const reverseStrength = Math.max(this.reverse, state.reverseActive ? 0.6 : 0);
            result.speed *= 0.85;
            result.hue = (result.hue + 180 * reverseStrength) % 360;
        }

        if (this.slowmo > 0) {
            result.speed *= 0.7;
            result.intensity *= 1.1;
        }

        if (this.rhythm > 0) {
            const rhythmMod = context?.rhythmModifier || 1;
            result.gridDensity *= 1 + this.rhythm * 0.2;
            result.speed *= 1 + this.rhythm * 0.25 * (rhythmMod >= 1 ? 1 : 0.5);
        }

        if (this.woah > 0) {
            result.saturation = Math.min(1, result.saturation + this.woah * 0.22);
            result.intensity += this.woah * 0.1;
        }

        if (context?.event === 'quickdraw' && context.eventWindow) {
            const pulse = Math.max(0, 1 - context.eventTimer / context.eventWindow);
            result.intensity += pulse * 0.2;
            result.speed *= 1 + pulse * 0.05;
        }

        return result;
    }
}
