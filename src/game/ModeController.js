import { IntegratedHolographicVisualizer } from '../core/Visualizer.js';
import { QuantumHolographicVisualizer } from '../quantum/QuantumVisualizer.js';
import { HolographicVisualizer } from '../holograms/HolographicVisualizer.js';

const LAYERS = [
    { role: 'background', reactivity: 0.5 },
    { role: 'shadow', reactivity: 0.7 },
    { role: 'content', reactivity: 0.9 },
    { role: 'highlight', reactivity: 1.1 },
    { role: 'accent', reactivity: 1.45 }
];

const MODE_CONFIG = {
    faceted: IntegratedHolographicVisualizer,
    quantum: QuantumHolographicVisualizer,
    holographic: HolographicVisualizer
};

/**
 * Instantiates and coordinates the visualizer stack per mode.
 */
export class ModeController {
    constructor(rootElement) {
        this.root = rootElement;
        this.modes = new Map();
        this.activeMode = null;
        this.currentVariant = 0;
        this.lodBias = 0;
        this.lastParameters = null;

        Object.entries(MODE_CONFIG).forEach(([modeName, Visualizer]) => {
            this.createMode(modeName, Visualizer);
        });

        this.setActiveMode('faceted');
    }

    createMode(name, VisualizerClass) {
        const container = document.createElement('div');
        container.className = 'lp-mode-stage';
        container.dataset.mode = name;
        this.root.appendChild(container);

        const layers = LAYERS.map((layer, index) => {
            const canvas = document.createElement('canvas');
            canvas.id = `lp-${name}-${index}`;
            canvas.className = 'lp-canvas-layer';
            container.appendChild(canvas);
            const visualizer = new VisualizerClass(canvas.id, layer.role, layer.reactivity, 0);
            return { canvas, visualizer, layer };
        });

        this.modes.set(name, {
            container,
            layers,
            params: null,
            variant: 0
        });
    }

    setActiveMode(name) {
        if (!this.modes.has(name)) return;
        this.modes.forEach((mode, key) => {
            mode.container.classList.toggle('active', key === name);
            mode.container.style.visibility = key === name ? 'visible' : 'hidden';
            mode.container.style.opacity = key === name ? '1' : '0';
        });
        this.activeMode = name;
    }

    getActiveMode() {
        return this.activeMode;
    }

    setVariant(variant) {
        this.currentVariant = variant;
        this.modes.forEach((mode) => {
            mode.variant = variant;
            mode.layers.forEach(({ visualizer }) => {
                visualizer.variant = variant;
                if (typeof visualizer.generateVariantParams === 'function') {
                    visualizer.variantParams = visualizer.generateVariantParams(variant);
                    if (typeof visualizer.generateRoleParams === 'function') {
                        visualizer.roleParams = visualizer.generateRoleParams(visualizer.role);
                    }
                }
                if (visualizer.updateParameters) {
                    visualizer.updateParameters({ geometry: variant % 8 });
                }
            });
        });
    }

    updateParameters(params) {
        this.lastParameters = params;
        const active = this.modes.get(this.activeMode);
        if (!active) return;
        active.params = params;
        active.layers.forEach(({ visualizer }) => {
            visualizer.updateParameters(paramsWithLod(params, this.lodBias));
        });
    }

    render() {
        const active = this.modes.get(this.activeMode);
        if (!active) return;
        active.layers.forEach(({ visualizer }) => {
            visualizer.render();
        });
    }

    applyLOD(level) {
        this.lodBias = level;
        if (this.lastParameters) {
            this.updateParameters(this.lastParameters);
        }
    }

    resize() {
        this.modes.forEach((mode) => {
            mode.layers.forEach(({ canvas }) => {
                canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
                canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
            });
        });
    }
}

function paramsWithLod(params, lodBias) {
    if (!lodBias) return params;
    const factor = Math.max(0.4, 1 - 0.25 * lodBias);
    return {
        ...params,
        gridDensity: params.gridDensity * factor,
        chaos: params.chaos * factor,
        intensity: params.intensity * (1 - 0.1 * lodBias)
    };
}
