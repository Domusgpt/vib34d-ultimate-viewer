/**
 * EffectsManager provides a tiny hook surface so the rest of the app can react
 * to directive life-cycle events without knowing about the HUD implementation.
 */
export class EffectsManager {
    constructor(options = {}) {
        const {
            onDirectiveStart = null,
            onDirectiveComplete = null,
            onAmbientUpdate = null,
        } = options;

        this.onDirectiveStart = typeof onDirectiveStart === 'function' ? onDirectiveStart : null;
        this.onDirectiveComplete = typeof onDirectiveComplete === 'function' ? onDirectiveComplete : null;
        this.onAmbientUpdate = typeof onAmbientUpdate === 'function' ? onAmbientUpdate : null;
        this.activeDirective = null;
    }

    handleDirectiveStart(directive) {
        this.activeDirective = directive || null;
        if (this.onDirectiveStart) {
            this.onDirectiveStart(directive);
        }
    }

    handleDirectiveComplete(payload) {
        this.activeDirective = null;
        if (this.onDirectiveComplete) {
            this.onDirectiveComplete(payload);
        }
    }

    updateAmbientDirective(spawnDirective) {
        if (this.onAmbientUpdate) {
            this.onAmbientUpdate(spawnDirective);
        }
    }
}

export default EffectsManager;
