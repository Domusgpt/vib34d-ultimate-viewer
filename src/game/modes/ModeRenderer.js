import { IntegratedHolographicVisualizer } from '../../core/Visualizer.js';
import { QuantumHolographicVisualizer } from '../../quantum/QuantumVisualizer.js';
import { HolographicVisualizer } from '../../holograms/HolographicVisualizer.js';

const LAYERS = [
    { key: 'background', role: 'background', reactivity: 0.5 },
    { key: 'shadow', role: 'shadow', reactivity: 0.7 },
    { key: 'content', role: 'content', reactivity: 0.9 },
    { key: 'highlight', role: 'highlight', reactivity: 1.1 },
    { key: 'accent', role: 'accent', reactivity: 1.4 }
];

const VISUALIZER_MAP = {
    faceted: IntegratedHolographicVisualizer,
    quantum: QuantumHolographicVisualizer,
    holographic: HolographicVisualizer
};

export class ModeRenderer {
    constructor({ name, container, parameterManager, variantResolver }) {
        this.name = name;
        this.container = container;
        this.parameterManager = parameterManager;
        this.variantResolver = variantResolver;
        this.canvasElements = new Map();
        this.visualizers = [];
        this.active = false;
        this.createCanvasStack();
        this.initVisualizers();
    }

    createCanvasStack() {
        const modeContainer = document.createElement('div');
        modeContainer.className = 'mode-layer';
        modeContainer.dataset.mode = this.name;
        this.container.appendChild(modeContainer);
        this.modeContainer = modeContainer;

        LAYERS.forEach(layer => {
            const canvas = document.createElement('canvas');
            canvas.id = `${this.name}-${layer.key}-canvas`;
            canvas.className = 'visual-canvas';
            canvas.setAttribute('data-role', layer.role);
            modeContainer.appendChild(canvas);
            this.canvasElements.set(layer.key, canvas);
        });
    }

    initVisualizers() {
        const VisualizerClass = VISUALIZER_MAP[this.name];
        const variant = this.variantResolver?.(0) ?? 0;

        this.visualizers = LAYERS.map(layer =>
            new VisualizerClass(`${this.name}-${layer.key}-canvas`, layer.role, layer.reactivity, variant)
        );
    }

    setActive(active) {
        this.active = active;
        if (!this.modeContainer) return;
        this.modeContainer.style.display = active ? 'block' : 'none';
        this.visualizers.forEach(v => (v.isActive = active));
    }

    updateParameters(params) {
        this.visualizers.forEach(visualizer => {
            if (visualizer?.updateParameters) {
                visualizer.updateParameters(params);
            }
        });
    }

    updateInteraction(interaction) {
        if (!interaction) return;
        this.visualizers.forEach(visualizer => {
            if (visualizer?.updateInteraction) {
                visualizer.updateInteraction(
                    interaction.x,
                    interaction.y,
                    interaction.intensity
                );
            }
        });
    }

    render() {
        if (!this.active) return;
        this.visualizers.forEach(visualizer => {
            if (visualizer?.render) {
                visualizer.render();
            }
        });
    }

    setVariant(variant) {
        this.visualizers.forEach(visualizer => {
            visualizer.variant = variant;
            if (visualizer.variantParams && visualizer.generateVariantParams) {
                visualizer.variantParams = visualizer.generateVariantParams(variant);
            }
        });
    }
}
