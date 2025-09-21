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
        this.resizeHandler = () => this.resize();

        Object.entries(MODE_CONFIG).forEach(([modeName, Visualizer]) => {
            this.createMode(modeName, Visualizer);
        });

        window.addEventListener('resize', this.resizeHandler, { passive: true });
        this.setActiveMode('faceted');
    }

    createMode(name, VisualizerClass) {
        const container = document.createElement('div');
        container.className = 'lp-mode-stage';
        container.dataset.mode = name;
        container.style.visibility = 'hidden';
        container.style.opacity = '0';
        this.root.appendChild(container);

        this.modes.set(name, {
            container,
            VisualizerClass,
            layers: [],
            params: null,
            variant: this.currentVariant,
            initialized: false
        });
    }

    setActiveMode(name) {
        if (!this.modes.has(name)) return;
        const targetMode = this.ensureModeInitialized(name);
        this.modes.forEach((mode, key) => {
            const isActive = key === name;
            mode.container.classList.toggle('active', isActive);
            mode.container.style.visibility = isActive ? 'visible' : 'hidden';
            mode.container.style.opacity = isActive ? '1' : '0';
        });
        this.activeMode = name;
        if (targetMode && this.lastParameters) {
            this.updateParameters(this.lastParameters);
        }
    }

    getActiveMode() {
        return this.activeMode;
    }

    setVariant(variant) {
        this.currentVariant = variant;
        this.modes.forEach((mode) => {
            mode.variant = variant;
            if (!mode.initialized) return;
            mode.layers.forEach(({ visualizer }) => {
                visualizer.variant = variant;
                if (typeof visualizer.generateVariantParams === 'function') {
                    visualizer.variantParams = visualizer.generateVariantParams(variant);
                    if (typeof visualizer.generateRoleParams === 'function') {
                        visualizer.roleParams = visualizer.generateRoleParams(visualizer.role);
                    }
                }
                if (typeof visualizer.updateParameters === 'function') {
                    visualizer.updateParameters({ geometry: variant % 8 });
                }
            });
        });
    }

    updateParameters(params) {
        this.lastParameters = params;
        const active = this.ensureModeInitialized(this.activeMode);
        if (!active) return;
        active.params = params;
        const adjusted = paramsWithLod(params, this.lodBias);
        active.layers.forEach(({ visualizer }) => {
            if (typeof visualizer.updateParameters === 'function') {
                visualizer.updateParameters(adjusted);
            }
        });
    }

    render() {
        const active = this.ensureModeInitialized(this.activeMode);
        if (!active) return;
        active.layers.forEach(({ visualizer }) => {
            if (typeof visualizer.render === 'function') {
                visualizer.render();
            }
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
            if (!mode.initialized) return;
            mode.layers.forEach(({ canvas, visualizer }) => {
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const width = canvas.clientWidth || mode.container.clientWidth || this.root.clientWidth || window.innerWidth;
                const height = canvas.clientHeight || mode.container.clientHeight || this.root.clientHeight || window.innerHeight;
                if (!width || !height) return;
                const bufferWidth = Math.floor(width * dpr);
                const bufferHeight = Math.floor(height * dpr);
                if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
                    canvas.width = bufferWidth;
                    canvas.height = bufferHeight;
                }
                if (visualizer && typeof visualizer.resize === 'function') {
                    visualizer.resize();
                } else if (visualizer?.gl) {
                    visualizer.gl.viewport(0, 0, canvas.width, canvas.height);
                }
            });
        });
    }

    ensureModeInitialized(name) {
        const mode = this.modes.get(name);
        if (!mode || mode.initialized) {
            return mode;
        }

        mode.layers = LAYERS.map((layer, index) => {
            const canvas = document.createElement('canvas');
            canvas.id = `lp-${name}-${index}`;
            canvas.className = 'lp-canvas-layer';
            mode.container.appendChild(canvas);
            const visualizer = new mode.VisualizerClass(canvas.id, layer.role, layer.reactivity, this.currentVariant);

            if (typeof visualizer.generateVariantParams === 'function') {
                visualizer.variantParams = visualizer.generateVariantParams(this.currentVariant);
                if (typeof visualizer.generateRoleParams === 'function') {
                    visualizer.roleParams = visualizer.generateRoleParams(visualizer.role);
                }
            }

            if (typeof visualizer.updateParameters === 'function') {
                visualizer.updateParameters({ geometry: this.currentVariant % 8 });
            }

            return { canvas, visualizer, layer };
        });

        mode.initialized = true;
        mode.variant = this.currentVariant;

        this.resizeMode(mode);

        if (this.lastParameters) {
            const adjusted = paramsWithLod(this.lastParameters, this.lodBias);
            mode.layers.forEach(({ visualizer }) => {
                if (typeof visualizer.updateParameters === 'function') {
                    visualizer.updateParameters(adjusted);
                }
            });
        }

        return mode;
    }

    resizeMode(mode) {
        if (!mode.initialized) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        mode.layers.forEach(({ canvas, visualizer }) => {
            const width = canvas.clientWidth || mode.container.clientWidth || this.root.clientWidth || window.innerWidth;
            const height = canvas.clientHeight || mode.container.clientHeight || this.root.clientHeight || window.innerHeight;
            if (!width || !height) return;
            const bufferWidth = Math.floor(width * dpr);
            const bufferHeight = Math.floor(height * dpr);
            if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
                canvas.width = bufferWidth;
                canvas.height = bufferHeight;
            }
            if (visualizer && typeof visualizer.resize === 'function') {
                visualizer.resize();
            } else if (visualizer?.gl) {
                visualizer.gl.viewport(0, 0, canvas.width, canvas.height);
            }
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
