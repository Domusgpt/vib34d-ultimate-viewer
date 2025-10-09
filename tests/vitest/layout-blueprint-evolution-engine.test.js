import { beforeEach, describe, expect, it } from 'vitest';
import { LayoutBlueprintEvolutionEngine } from '../../src/ui/adaptive/renderers/LayoutBlueprintEvolutionEngine.js';
import { LayoutBlueprintInsightEngine } from '../../src/ui/adaptive/renderers/LayoutBlueprintInsightEngine.js';
import { buildLayoutBlueprint } from '../../src/ui/adaptive/renderers/LayoutBlueprintRenderer.js';

function createBaseBlueprint(overrides = {}) {
    const layout = {
        intensity: 0.42,
        motion: {
            velocity: 0.78,
            bias: { x: 0.32, y: 0.28, z: 0.12 },
            easing: 'ease-in-out'
        },
        zones: [
            { id: 'primary', occupancy: 0.94, layeringDepth: 0.18, recommendedComponents: ['command-center'] },
            { id: 'peripheral', occupancy: 0.21, layeringDepth: 0.44, recommendedComponents: ['timeline'] },
            { id: 'ambient', occupancy: 0.14, layeringDepth: 0.58, recommendedComponents: ['heartbeat'] }
        ],
        annotations: []
    };

    const design = {
        pattern: 'spectrum',
        monetization: { tier: 'enterprise' },
        integration: { platform: 'wearable-lens' }
    };

    const context = {
        focusVector: { x: 0.54, y: 0.47, depth: 0.61 },
        engagementLevel: 0.38,
        biometricStress: 0.72
    };

    return buildLayoutBlueprint({ ...layout, ...(overrides.layout || {}) }, { ...design, ...(overrides.design || {}) }, {
        ...context,
        ...(overrides.context || {})
    });
}

describe('LayoutBlueprintEvolutionEngine', () => {
    let blueprint;

    beforeEach(() => {
        blueprint = createBaseBlueprint();
    });

    it('generates evolution variants and aggregates metrics', () => {
        const engine = new LayoutBlueprintEvolutionEngine();
        const result = engine.evolve({ blueprint });

        expect(result).toBeTruthy();
        expect(result?.variants.length).toBeGreaterThan(0);
        expect(result?.aggregate.variantCount).toBe(result?.variants.length);
        expect(result?.aggregate.recommendedVariantId).toBeTruthy();
        const recommended = result?.variants.find(variant => variant.id === result?.aggregate.recommendedVariantId);
        expect(recommended?.analytics).toBeTruthy();
        expect(typeof recommended?.score).toBe('number');
        expect(recommended?.analyticsDelta).toHaveProperty('zoneBalanceScore');
    });

    it('supports custom strategies when defaults are disabled', () => {
        const engine = new LayoutBlueprintEvolutionEngine({ defaults: false });
        engine.registerStrategy({
            id: 'custom-evo',
            title: 'Custom Evolution',
            generate({ blueprint: current }) {
                return {
                    id: 'custom-evo',
                    title: 'Custom Evolution',
                    layout: {
                        intensity: current.intensity + 0.05,
                        motion: current.motion,
                        zones: current.zones,
                        annotations: current.annotations
                    },
                    recommendations: ['Apply custom evolution variant.'],
                    tags: ['experiment']
                };
            }
        });

        const result = engine.evolve({ blueprint });
        expect(result?.variants).toHaveLength(1);
        expect(result?.variants[0].id).toBe('custom-evo');
        expect(result?.variants[0].tags).toContain('experiment');
    });

    it('limits history length and protects stored entries from mutation', () => {
        const engine = new LayoutBlueprintEvolutionEngine({ historyLimit: 2 });
        engine.evolve({ blueprint, id: 'first' });
        engine.evolve({ blueprint, id: 'second' });
        engine.evolve({ blueprint, id: 'third' });

        const history = engine.getHistory();
        expect(history).toHaveLength(2);
        expect(history[0].id).toBe('second');
        expect(history[1].id).toBe('third');

        history[0].variants[0].tags.push('mutated');
        const afterMutation = engine.getHistory();
        expect(afterMutation[0].variants[0].tags.includes('mutated')).toBe(false);
    });

    it('records evolution runs through the connected insight engine', () => {
        const insights = new LayoutBlueprintInsightEngine({ evolutionHistoryLimit: 5 });
        const engine = new LayoutBlueprintEvolutionEngine({ insightEngine: insights });

        engine.evolve({ blueprint, id: 'insight-run' });
        const recorded = insights.getEvolutionHistory();

        expect(recorded).toHaveLength(1);
        expect(recorded[0].id).toBe('insight-run');
        expect(recorded[0].variants.length).toBeGreaterThan(0);
    });
});
