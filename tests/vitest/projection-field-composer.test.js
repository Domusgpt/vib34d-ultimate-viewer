import { describe, it, expect } from 'vitest';
import { composeProjectionField, ProjectionFieldComposer } from '../../src/ui/adaptive/renderers/ProjectionFieldComposer.js';

describe('ProjectionFieldComposer', () => {
    const blueprint = {
        intensity: 0.62,
        engagementLevel: 0.58,
        biometricStress: 0.18,
        focusVector: { x: 0.48, y: 0.41, depth: 0.32 },
        zones: [
            { id: 'primary', occupancy: 0.54, visibility: 0.82, layeringDepth: 0.24 },
            { id: 'peripheral', occupancy: 0.32, visibility: 0.74, layeringDepth: 0.36 }
        ],
        annotations: [{ id: 'stress', type: 'alert', priority: 4 }]
    };

    const context = {
        gazeVelocity: 0.44,
        neuralCoherence: 0.52,
        hapticFeedback: 0.31,
        ambientVariance: 0.22,
        gestureIntent: {
            intensity: 0.48,
            vector: { x: 0.46, y: 0.52, z: 0.38 }
        }
    };

    it('composes projection field metrics from blueprint and context', () => {
        const composition = composeProjectionField(blueprint, context, { resolution: 12, depthBands: 4 });
        expect(composition).toBeTruthy();
        expect(composition.focusHalo.radius).toBeGreaterThan(0);
        expect(composition.depthBands).toHaveLength(4);
        expect(composition.activationMatrix.length).toBe(12);
        expect(composition.activationMatrix[0]).toHaveLength(12);
        expect(composition.annotations[0]).toEqual({ id: 'stress', type: 'alert', priority: 4 });
    });

    it('renders via ProjectionFieldComposer without throwing', () => {
        const composer = new ProjectionFieldComposer({ observe: false, resolution: 10 });
        const composition = composer.render(blueprint, context, { resolution: 10 });
        expect(composition.activationMatrix.length).toBe(10);
        expect(composer.compose(blueprint, context).focusHalo.radius).toBeLessThan(1);
    });
});
