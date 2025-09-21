export class EffectsManager {
    constructor({ modeController }) {
        this.modeController = modeController;
        this.levels = {
            intensity: 0,
            hue: 0,
            saturation: 0
        };
        this.decayRates = {
            intensity: 1.4,
            hue: 60,
            saturation: 1.0
        };
    }

    trigger(event) {
        switch (event) {
            case 'pulse':
                this.levels.intensity += 0.25;
                this.modeController.applyParameterDelta({ intensity: 0.2 });
                break;
            case 'combo':
                this.levels.hue += 15;
                this.modeController.applyParameterDelta({ hue: 15 });
                break;
            case 'perfect':
                this.levels.intensity += 0.35;
                this.levels.saturation += 0.2;
                this.modeController.applyParameterDelta({ intensity: 0.25, saturation: 0.1 });
                break;
            case 'miss':
                this.modeController.applyParameterDelta({ saturation: -0.2, intensity: -0.15 });
                break;
            default:
                break;
        }
    }

    update(dt) {
        const decayAdjustments = {};
        Object.entries(this.levels).forEach(([key, value]) => {
            if (value <= 0) return;
            const decay = Math.min(value, this.decayRates[key] * dt);
            this.levels[key] = Math.max(0, value - decay);
            if (decay > 0) {
                if (key === 'hue') {
                    decayAdjustments.hue = (decayAdjustments.hue || 0) - decay;
                } else {
                    decayAdjustments[key] = (decayAdjustments[key] || 0) - decay;
                }
            }
        });

        if (Object.keys(decayAdjustments).length) {
            this.modeController.applyParameterDelta(decayAdjustments);
        }
    }
}
