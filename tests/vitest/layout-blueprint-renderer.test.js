import { describe, it, expect } from 'vitest';
import { buildLayoutBlueprint } from '../../src/ui/adaptive/renderers/LayoutBlueprintRenderer.js';

describe('buildLayoutBlueprint', () => {
    const baseLayout = {
        intensity: 0.72,
        motion: { velocity: 0.42, bias: { x: 0.3, y: -0.1, z: 0.05 }, easing: 'ease-out' },
        zones: [
            {
                id: 'primary',
                occupancy: 0.7,
                layeringDepth: 0.22,
                curvature: 0.14,
                visibility: 0.8,
                recommendedComponents: ['holographic-panel', 'adaptive-controls']
            },
            {
                id: 'peripheral',
                occupancy: 0.45,
                layeringDepth: 0.4,
                curvature: 0.35,
                visibility: 0.62,
                recommendedComponents: ['ambient-indicator']
            }
        ],
        annotations: [{ id: 'stress-alert', type: 'insight', message: 'Check biometrics' }]
    };

    const baseDesign = {
        pattern: { id: 'neuro-glance-feed', name: 'Neuro Glance Feed' },
        monetization: { tier: 'starter' },
        integration: { figmaPlugin: 'vib34d-neuro' }
    };

    const baseContext = {
        focusVector: { x: 0.58, y: 0.44, depth: 0.33 },
        engagementLevel: 0.61,
        biometricStress: 0.18
    };

    it('summarizes layout geometry and recommended components', () => {
        const blueprint = buildLayoutBlueprint(baseLayout, baseDesign, baseContext);

        expect(blueprint.intensity).toBeCloseTo(0.72, 2);
        expect(blueprint.motion.velocity).toBeCloseTo(0.42, 2);
        expect(blueprint.motion.bias).toEqual({ x: 0.3, y: -0.1, z: 0.05 });
        expect(blueprint.recommendedComponents).toEqual(expect.arrayContaining([
            'holographic-panel',
            'adaptive-controls',
            'ambient-indicator'
        ]));
        expect(blueprint.recommendedComponents).toHaveLength(3);
        const primaryZone = blueprint.zones.find(zone => zone.id === 'primary');
        expect(primaryZone).toBeDefined();
        expect(primaryZone).toMatchObject({
            components: ['holographic-panel', 'adaptive-controls']
        });
        expect(blueprint.annotations).toHaveLength(1);
        expect(blueprint.analytics).toMatchObject({
            zoneBalanceScore: expect.any(Number),
            focusReliability: expect.any(Number),
            stressRisk: expect.any(Number),
            motionStability: expect.any(Number),
            statusTags: expect.any(Array),
            recommendations: expect.any(Array)
        });
    });

    it('applies defaults when layout details are missing', () => {
        const blueprint = buildLayoutBlueprint({}, {}, {});
        expect(blueprint.intensity).toBeGreaterThan(0);
        expect(blueprint.motion.velocity).toBeGreaterThanOrEqual(0);
        expect(blueprint.focusVector).toEqual({ x: 0.5, y: 0.5, depth: 0.3 });
        expect(blueprint.zones).toEqual([]);
        expect(blueprint.recommendedComponents).toEqual([]);
        expect(blueprint.analytics).toMatchObject({
            zoneBalanceScore: expect.any(Number),
            statusTags: expect.any(Array),
            recommendations: expect.any(Array)
        });
    });

    it('normalizes metrics and clamps values', () => {
        const layout = {
            intensity: 2,
            motion: { velocity: -1.3, bias: { x: 5, y: -5, z: 2 }, easing: 'ease-in' },
            zones: [
                { id: 'primary', occupancy: 1.8, layeringDepth: -0.6, curvature: 2, visibility: 2 }
            ]
        };
        const context = { engagementLevel: 1.6, biometricStress: -0.2, focusVector: { x: 2, y: -1, depth: 5 } };
        const blueprint = buildLayoutBlueprint(layout, baseDesign, context);

        expect(blueprint.intensity).toBeLessThanOrEqual(1);
        expect(blueprint.motion.velocity).toBeGreaterThanOrEqual(0);
        expect(blueprint.motion.bias).toEqual({ x: 1, y: -1, z: 1 });
        expect(blueprint.zones[0]).toMatchObject({
            occupancy: 1,
            layeringDepth: 0,
            curvature: 1,
            visibility: 1
        });
        expect(blueprint.engagementLevel).toBeLessThanOrEqual(1);
        expect(blueprint.biometricStress).toBeGreaterThanOrEqual(0);
        expect(blueprint.focusVector).toEqual({ x: 1, y: 0, depth: 1 });
        expect(blueprint.analytics.zoneBalanceScore).toBeGreaterThanOrEqual(0);
        expect(blueprint.analytics.statusTags).toEqual(expect.any(Array));
    });

    it('derives insight tags and recommendations based on stress and imbalance', () => {
        const layout = {
            intensity: 0.9,
            motion: { velocity: 0.8, bias: { x: 0.6, y: 0.4, z: 0.1 } },
            zones: [
                { id: 'primary', occupancy: 0.9, layeringDepth: 0.1 },
                { id: 'peripheral', occupancy: 0.2, layeringDepth: 0.6 }
            ],
            annotations: [{ id: 'stress-alert', severity: 'critical', message: 'Stress at threshold' }]
        };
        const context = { engagementLevel: 0.4, biometricStress: 0.82, focusVector: { x: 0.5, y: 0.5, depth: 0.2 } };
        const blueprint = buildLayoutBlueprint(layout, baseDesign, context);

        expect(blueprint.analytics.statusTags.length).toBeGreaterThan(0);
        expect(blueprint.analytics.recommendations.length).toBeGreaterThan(0);
        expect(blueprint.analytics.stressRisk).toBeGreaterThan(0.5);
    });
});
