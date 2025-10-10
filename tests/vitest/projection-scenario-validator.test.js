import { describe, it, expect } from 'vitest';
import { ProjectionScenarioParameterValidator } from '../../src/ui/adaptive/simulators/ProjectionScenarioValidator.js';

describe('ProjectionScenarioParameterValidator', () => {
    it('applies defaults when blueprint is missing', () => {
        const validator = new ProjectionScenarioParameterValidator();
        const { scenario, issues } = validator.validateScenario({ id: 'no-blueprint', cycleMs: 3200 });
        expect(scenario.blueprint).toBeTruthy();
        expect(scenario.blueprint.intensity).toBeGreaterThan(0);
        const codes = issues.map(issue => issue.code);
        expect(codes).toContain('missing-blueprint');
    });

    it('clamps extreme values into range and records issues', () => {
        const validator = new ProjectionScenarioParameterValidator();
        const { scenario, issues } = validator.validateScenario({
            id: 'extreme',
            cycleMs: 5000,
            blueprint: {
                intensity: 1.8,
                engagementLevel: -0.4,
                biometricStress: 2,
                focusVector: { x: -0.5, y: 1.4, depth: 1.7 },
                zones: [
                    { id: 'primary', occupancy: 1.6, visibility: -0.1, curvature: 1.3, layeringDepth: -0.8 }
                ]
            },
            context: {
                gazeVelocity: -0.4,
                neuralCoherence: 1.5,
                gestureIntent: { intensity: 2.4, vector: { x: 1.6, y: -0.3, z: 0.4 } }
            }
        });

        expect(scenario.blueprint.intensity).toBeLessThanOrEqual(1);
        expect(scenario.blueprint.engagementLevel).toBeGreaterThanOrEqual(0);
        expect(scenario.blueprint.focusVector.x).toBeGreaterThanOrEqual(0);
        expect(scenario.context.gazeVelocity).toBeGreaterThanOrEqual(0);
        expect(scenario.context.gestureIntent.intensity).toBeLessThanOrEqual(1);
        expect(issues.length).toBeGreaterThan(0);
        expect(issues.some(issue => issue.code === 'clamped-blueprint-value')).toBe(true);
    });
});
