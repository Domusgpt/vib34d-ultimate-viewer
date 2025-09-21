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
        this.slowmo = 0;
        this.eventSuccess = 0;
        this.eventFail = 0;
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
                this.glitch = Math.min(1, this.glitch + 0.7);
                break;
            case 'reverse':
                this.reverse = 1;
                break;
            case 'slowmo':
                this.slowmo = 1;
                break;
            case 'eventSuccess':
                this.eventSuccess = Math.min(1, this.eventSuccess + 0.6);
                break;
            case 'eventFail':
                this.eventFail = Math.min(1, this.eventFail + 0.6);
                break;
            default:
                break;
        }
    }

    update(dt, params, state) {
        const result = { ...params };
        this.scorePulse = Math.max(0, this.scorePulse - dt * 1.8);
        this.missPulse = Math.max(0, this.missPulse - dt * 2.2);
        this.comboShift = Math.max(0, this.comboShift - dt * 0.5);
        this.perfectSnap = Math.max(0, this.perfectSnap - dt * 3.5);
        this.shield = Math.max(0, this.shield - dt * 0.4);
        this.glitch = Math.max(0, this.glitch - dt * 0.6);
        this.reverse = Math.max(0, this.reverse - dt * 0.5);
        this.slowmo = Math.max(0, this.slowmo - dt * 0.5);
        this.eventSuccess = Math.max(0, this.eventSuccess - dt * 1.2);
        this.eventFail = Math.max(0, this.eventFail - dt * 1.2);

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

        const glitchLevel = Math.max(this.glitch, typeof state.getGlitchLevel === 'function' ? state.getGlitchLevel() : 0);
        if (glitchLevel > 0) {
            const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 140;
            result.hue = (result.hue + Math.sin(t) * glitchLevel * 90) % 360;
            result.chaos += glitchLevel * 0.5;
            result.intensity += glitchLevel * 0.3;
        }

        if (this.reverse > 0 || (typeof state.getReverseDirection === 'function' && state.getReverseDirection() === -1)) {
            result.rot4dXW = (result.rot4dXW || 0) * -1;
            result.rot4dYW = (result.rot4dYW || 0) * -1;
            result.rot4dZW = (result.rot4dZW || 0) * -1;
            result.speed *= 0.92;
        }

        if (this.slowmo > 0) {
            result.speed *= 0.8;
            result.intensity *= 0.95;
        }

        if (this.eventSuccess > 0) {
            result.intensity += this.eventSuccess * 0.2;
            result.saturation = Math.min(1, result.saturation + this.eventSuccess * 0.1);
        }

        if (this.eventFail > 0) {
            result.intensity *= 1 - this.eventFail * 0.3;
            result.saturation = Math.max(0, result.saturation - this.eventFail * 0.2);
        }

        return result;
    }
}
