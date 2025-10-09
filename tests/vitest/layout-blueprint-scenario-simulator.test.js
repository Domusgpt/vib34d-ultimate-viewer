import { describe, it, expect } from 'vitest';
import { LayoutBlueprintScenarioSimulator } from '../../src/ui/adaptive/renderers/LayoutBlueprintScenarioSimulator.js';
import { LayoutBlueprintInsightEngine } from '../../src/ui/adaptive/renderers/LayoutBlueprintInsightEngine.js';

const baseLayout = {
    intensity: 0.66,
    motion: { velocity: 0.35, bias: { x: 0.1, y: -0.05, z: 0.04 }, easing: 'ease-in-out' },
    zones: [
        {
            id: 'primary',
            occupancy: 0.72,
            layeringDepth: 0.24,
            curvature: 0.18,
            visibility: 0.86,
            recommendedComponents: ['vision-dashboard', 'pulse-indicator']
        },
        {
            id: 'peripheral',
            occupancy: 0.32,
            layeringDepth: 0.55,
            curvature: 0.22,
            visibility: 0.68,
            recommendedComponents: ['navigation-ribbon']
        }
    ]
};

const baseDesign = {
    pattern: { id: 'vib-thread', name: 'VIB Thread' },
    monetization: { tier: 'enterprise' },
    integration: { figmaPlugin: 'vib-thread' }
};

describe('LayoutBlueprintScenarioSimulator', () => {
    it('evaluates scenarios, aggregates analytics, and records insight history', () => {
        const insightEngine = new LayoutBlueprintInsightEngine({ historyLimit: 10, scenarioHistoryLimit: 5 });
        const simulator = new LayoutBlueprintScenarioSimulator({ insightEngine, maxSteps: 5, defaultStepWeight: 2 });

        const scenario = simulator.runScenario({
            id: 'wearable-focus-shift',
            layout: baseLayout,
            design: baseDesign,
            contextDefaults: {
                focusVector: { x: 0.45, y: 0.55, depth: 0.42 },
                engagementLevel: 0.58,
                biometricStress: 0.28
            },
            steps: [
                {
                    context: {
                        dwellMs: 1400,
                        focusVector: { x: 0.4, y: 0.6, depth: 0.5 },
                        engagementLevel: 0.62,
                        biometricStress: 0.32
                    },
                    notes: 'Baseline monitoring interval'
                },
                {
                    context: {
                        dwellMs: 900,
                        focusVector: { x: 0.62, y: 0.4, depth: 0.18 },
                        engagementLevel: 0.41,
                        biometricStress: 0.81
                    },
                    layout: {
                        ...baseLayout,
                        zones: [
                            { id: 'primary', occupancy: 0.92, layeringDepth: 0.12, curvature: 0.25, visibility: 0.92 },
                            { id: 'ambient', occupancy: 0.18, layeringDepth: 0.65, curvature: 0.33, visibility: 0.54 }
                        ]
                    },
                    notes: 'Stress spike with narrow focus band'
                }
            ]
        });

        expect(scenario.steps).toHaveLength(2);
        expect(typeof scenario.aggregate.averageZoneBalance).toBe('number');
        expect(scenario.aggregate.peakStressRisk).toBeGreaterThan(0);
        expect(scenario.recommendations.length).toBeGreaterThan(0);
        expect(scenario.statusTags.length).toBeGreaterThan(0);
        expect(scenario.anomalies.some(anomaly => anomaly.type === 'stress')).toBe(true);
        expect(scenario.aggregate.scenarioConfidence).toBeGreaterThanOrEqual(0);
        expect(scenario.aggregate.scenarioConfidence).toBeLessThanOrEqual(1);

        const history = insightEngine.getScenarioHistory();
        expect(history).toHaveLength(1);
        expect(history[0]?.steps[0]?.analytics.zoneBalanceScore).toBeTypeOf('number');
        expect(history[0]?.aggregate.anomalyCount).toBeGreaterThanOrEqual(0);

        insightEngine.clearScenarioHistory();
        expect(insightEngine.getScenarioHistory()).toHaveLength(0);
    });
});
