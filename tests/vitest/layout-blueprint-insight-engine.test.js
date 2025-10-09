import { describe, it, expect } from 'vitest';
import { LayoutBlueprintInsightEngine } from '../../src/ui/adaptive/renderers/LayoutBlueprintInsightEngine.js';
import { buildLayoutBlueprint } from '../../src/ui/adaptive/renderers/LayoutBlueprintRenderer.js';

const baseDesign = {
    pattern: { id: 'vision-thread', name: 'Vision Thread' },
    monetization: { tier: 'studio' },
    integration: { figmaPlugin: 'vision-thread' }
};

describe('LayoutBlueprintInsightEngine', () => {
    it('tracks blueprint history and computes trends', () => {
        const engine = new LayoutBlueprintInsightEngine({ historyLimit: 3 });

        const firstBlueprint = buildLayoutBlueprint({
            intensity: 0.4,
            motion: { velocity: 0.2, bias: { x: 0.1, y: 0.05 } },
            zones: [{ id: 'primary', occupancy: 0.5, layeringDepth: 0.2 }]
        }, baseDesign, { engagementLevel: 0.5, biometricStress: 0.2, focusVector: { x: 0.4, y: 0.6, depth: 0.3 } });

        const first = engine.analyze(firstBlueprint, { id: 'first' });
        expect(first).not.toBeNull();
        expect(first?.history.length).toBe(1);
        expect(typeof first?.analytics.zoneBalanceScore).toBe('number');

        const secondBlueprint = buildLayoutBlueprint({
            intensity: 0.82,
            motion: { velocity: 0.6, bias: { x: 0.3, y: 0.2 } },
            zones: [
                { id: 'primary', occupancy: 0.8, layeringDepth: 0.15 },
                { id: 'peripheral', occupancy: 0.25, layeringDepth: 0.6 }
            ],
            annotations: [{ id: 'stress-alert', severity: 'critical' }]
        }, baseDesign, { engagementLevel: 0.62, biometricStress: 0.72, focusVector: { x: 0.55, y: 0.45, depth: 0.4 } });

        const second = engine.analyze(secondBlueprint, { id: 'second' });
        expect(second?.history.length).toBe(2);
        expect(second?.trend.deltas).toMatchObject({
            zoneBalanceScore: expect.any(Number),
            stressRisk: expect.any(Number)
        });
        expect(['improving', 'declining', 'mixed', 'stable']).toContain(second?.trend.direction);
    });

    it('builds blueprints from layouts when provided', () => {
        const engine = new LayoutBlueprintInsightEngine({ historyLimit: 2 });
        const layout = {
            intensity: 0.55,
            motion: { velocity: 0.3, bias: { x: 0.2, y: -0.1 } },
            zones: [{ id: 'primary', occupancy: 0.6, layeringDepth: 0.2 }]
        };
        const result = engine.analyze(layout, {
            design: baseDesign,
            context: { engagementLevel: 0.48, biometricStress: 0.32, focusVector: { x: 0.6, y: 0.35, depth: 0.28 } }
        });

        expect(result).not.toBeNull();
        expect(result?.blueprint.intensity).toBeCloseTo(0.55, 2);
        expect(result?.history.length).toBe(1);
    });

    it('records scenario history entries with aggregates', () => {
        const engine = new LayoutBlueprintInsightEngine({ scenarioHistoryLimit: 2 });

        const entry = engine.recordScenarioResult({
            id: 'scenario-check',
            startedAt: Date.now() - 50,
            completedAt: Date.now(),
            aggregate: {
                averageZoneBalance: 0.52,
                averageFocusReliability: 0.61,
                averageStressRisk: 0.42,
                averageMotionStability: 0.74,
                peakStressRisk: 0.58,
                lowestMotionStability: 0.71,
                scenarioConfidence: 0.66,
                anomalyCount: 1,
                dwellDurationMs: 2500
            },
            statusTags: ['calibrate focus cues'],
            recommendations: ['Extend calming overlays during stress spikes.'],
            anomalies: [{ type: 'stress', severity: 'medium', message: 'Stress rising.' }],
            steps: [
                {
                    id: 'step-one',
                    analytics: {
                        zoneBalanceScore: 0.52,
                        focusReliability: 0.61,
                        stressRisk: 0.42,
                        motionStability: 0.74,
                        statusTags: ['calibrate focus cues'],
                        recommendations: ['Extend calming overlays during stress spikes.']
                    },
                    statusTags: ['calibrate focus cues'],
                    recommendations: ['Extend calming overlays during stress spikes.']
                }
            ]
        });

        expect(entry?.aggregate.scenarioConfidence).toBeCloseTo(0.66, 2);
        expect(engine.getScenarioHistory()).toHaveLength(1);
        engine.clearScenarioHistory();
        expect(engine.getScenarioHistory()).toHaveLength(0);
    });

    it('records calibration history entries when requested', () => {
        const engine = new LayoutBlueprintInsightEngine({ calibrationHistoryLimit: 2 });
        const blueprint = buildLayoutBlueprint({
            intensity: 0.33,
            motion: { velocity: 0.72, bias: { x: 0.4, y: 0.22 } },
            zones: [
                { id: 'primary', occupancy: 0.94, layeringDepth: 0.2 },
                { id: 'peripheral', occupancy: 0.21, layeringDepth: 0.54 }
            ]
        }, baseDesign, { engagementLevel: 0.3, biometricStress: 0.74, focusVector: { x: 0.58, y: 0.34, depth: 0.86 } });

        engine.recordCalibrationResult({
            id: 'calibration-1',
            generatedAt: Date.now(),
            blueprint: {
                analytics: blueprint.analytics,
                summary: { zoneCount: blueprint.zones.length, engagementLevel: blueprint.engagementLevel }
            },
            calibrations: [
                {
                    id: 'focus',
                    title: 'Focus Boost',
                    rationale: 'Increase focus weighting.',
                    score: 0.82,
                    priority: 'high',
                    tags: ['focus'],
                    adjustments: [{ type: 'layout', target: 'focusWeight', change: 0.2 }]
                }
            ],
            aggregate: {
                calibrationCount: 1,
                averageScore: 0.82,
                highestPriority: 'high',
                adjustments: [
                    {
                        type: 'layout',
                        target: 'focusWeight',
                        recommendations: 1,
                        aggregateChange: 0.2,
                        summaries: ['Increase focus weighting.'],
                        tags: ['focus']
                    }
                ],
                tags: ['focus'],
                nextActions: [{ id: 'focus', title: 'Focus Boost', priority: 'high', summary: 'Increase focus weighting.' }]
            }
        });

        expect(engine.getCalibrationHistory()).toHaveLength(1);
        engine.clearCalibrationHistory();
        expect(engine.getCalibrationHistory()).toHaveLength(0);
    });

    it('records evolution history entries with variant analytics', () => {
        const engine = new LayoutBlueprintInsightEngine({ evolutionHistoryLimit: 2 });
        const blueprint = buildLayoutBlueprint({
            intensity: 0.48,
            motion: { velocity: 0.68, bias: { x: 0.32, y: 0.18 } },
            zones: [
                { id: 'primary', occupancy: 0.9, layeringDepth: 0.18 },
                { id: 'peripheral', occupancy: 0.26, layeringDepth: 0.44 }
            ]
        }, baseDesign, { engagementLevel: 0.34, biometricStress: 0.7, focusVector: { x: 0.55, y: 0.4, depth: 0.62 } });

        engine.recordEvolutionResult({
            id: 'evolution-1',
            generatedAt: new Date().toISOString(),
            baseAnalytics: blueprint.analytics,
            aggregate: {
                variantCount: 1,
                baseScore: 0.5,
                recommendedVariantId: 'variant-1',
                averageScoreDelta: 0.12,
                tags: ['focus'],
                recommendations: ['Adopt focus cohesion'],
                recommendedScore: 0.62,
                weightedScore: 0.62
            },
            variants: [
                {
                    id: 'variant-1',
                    title: 'Focus Cohesion',
                    strategyId: 'focus-cohesion',
                    score: 0.62,
                    scoreDelta: 0.12,
                    analytics: blueprint.analytics,
                    analyticsDelta: {
                        zoneBalanceScore: 0.04,
                        focusReliability: 0.08,
                        stressRisk: -0.06,
                        motionStability: 0.02
                    },
                    tags: ['focus'],
                    recommendations: ['Adopt focus cohesion'],
                    adjustments: []
                }
            ]
        });

        const history = engine.getEvolutionHistory();
        expect(history).toHaveLength(1);
        expect(history[0].variants[0].scoreDelta).toBeCloseTo(0.12, 2);
        engine.clearEvolutionHistory();
        expect(engine.getEvolutionHistory()).toHaveLength(0);
    });
});
