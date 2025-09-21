import { ParameterManager } from '../../core/Parameters.js';
import { ModeRenderer } from './ModeRenderer.js';

const MODE_NAMES = ['faceted', 'quantum', 'holographic'];

export class ModeController {
    constructor({ container, geometryController }) {
        this.container = container;
        this.geometryController = geometryController;
        this.parameterManager = new ParameterManager();
        this.modeRenderers = new Map();
        this.activeMode = 'faceted';
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;

        MODE_NAMES.forEach(modeName => {
            const renderer = new ModeRenderer({
                name: modeName,
                container: this.container,
                parameterManager: this.parameterManager,
                variantResolver: variantLevel =>
                    this.geometryController.getVariantForMode(modeName, this.geometryController.geometryIndex, variantLevel)
            });

            renderer.setActive(modeName === this.activeMode);
            this.modeRenderers.set(modeName, renderer);
        });

        this.initialized = true;
    }

    setMode(modeName) {
        if (!MODE_NAMES.includes(modeName) || modeName === this.activeMode) return;

        const previousRenderer = this.modeRenderers.get(this.activeMode);
        if (previousRenderer) previousRenderer.setActive(false);

        this.activeMode = modeName;
        this.geometryController.setMode(modeName);

        const renderer = this.modeRenderers.get(modeName);
        if (renderer) {
            renderer.setActive(true);
            renderer.updateParameters(this.parameterManager.getAllParameters());
        }
    }

    cycleMode(direction = 1) {
        const index = MODE_NAMES.indexOf(this.activeMode);
        const nextIndex = (index + direction + MODE_NAMES.length) % MODE_NAMES.length;
        this.setMode(MODE_NAMES[nextIndex]);
    }

    setGeometry(index) {
        this.geometryController.setGeometry(index);
        this.updateVariant();
    }

    updateVariant(level = 0) {
        const renderer = this.modeRenderers.get(this.activeMode);
        if (renderer) {
            const variant = this.geometryController.getVariantForMode(
                this.activeMode,
                this.geometryController.geometryIndex,
                level
            );
            renderer.setVariant(variant);
        }
    }

    updateParameters(params) {
        this.parameterManager.setParameters(params);
        const renderer = this.modeRenderers.get(this.activeMode);
        if (renderer) {
            renderer.updateParameters(this.parameterManager.getAllParameters());
        }
    }

    applyParameterDelta(deltas) {
        const current = this.parameterManager.getAllParameters();
        const next = { ...current };
        Object.entries(deltas).forEach(([key, delta]) => {
            if (typeof current[key] === 'number' && !Number.isNaN(delta)) {
                next[key] = current[key] + delta;
            }
        });
        this.parameterManager.setParameters(next);
        const renderer = this.modeRenderers.get(this.activeMode);
        if (renderer) {
            renderer.updateParameters(this.parameterManager.getAllParameters());
        }
    }

    getParameters() {
        return this.parameterManager.getAllParameters();
    }

    render(interaction) {
        const renderer = this.modeRenderers.get(this.activeMode);
        if (!renderer) return;
        if (interaction) {
            renderer.updateInteraction(interaction);
        }
        renderer.render();
    }
}
