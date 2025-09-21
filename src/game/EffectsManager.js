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

        return result;
    }
}
