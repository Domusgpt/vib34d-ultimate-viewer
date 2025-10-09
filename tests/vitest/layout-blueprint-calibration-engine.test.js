import { describe, expect, it, beforeEach } from 'vitest';
import { LayoutBlueprintCalibrationEngine } from '../../src/ui/adaptive/renderers/LayoutBlueprintCalibrationEngine.js';
import { LayoutBlueprintInsightEngine } from '../../src/ui/adaptive/renderers/LayoutBlueprintInsightEngine.js';
import { buildLayoutBlueprint } from '../../src/ui/adaptive/renderers/LayoutBlueprintRenderer.js';

function createChallengedBlueprint() {
    const layout = {
        intensity: 0.38,
        motion: {
            velocity: 0.68,
            bias: { x: 0.42, y: 0.28, z: 0.17 },
            easing: 'ease-in-out'
        },
        zones: [
            { id: 'primary', occupancy: 0.92, layeringDepth: 0.15 },
            { id: 'peripheral', occupancy: 0.27, layeringDepth: 0.45 },
            { id: 'ambient', occupancy: 0.18, layeringDepth: 0.62 }
        ]
    };
    const design = { pattern: 'spectrum', monetization: { tier: 'enterprise' } };
    const context = {
        focusVector: { x: 0.61, y: 0.36, depth: 0.88 },
        engagementLevel: 0.34,
        biometricStress: 0.78
    };

    return buildLayoutBlueprint(layout, design, context);
}

describe('LayoutBlueprintCalibrationEngine', () => {
    let blueprint;

    beforeEach(() => {
        blueprint = createChallengedBlueprint();
    });

    it('produces calibration recommendations for stressed blueprints', () => {
        const engine = new LayoutBlueprintCalibrationEngine();
        const result = engine.calibrate({ blueprint });

        expect(result).toBeTruthy();
        expect(result?.calibrations.length).toBeGreaterThan(0);
        const calibrationIds = result.calibrations.map(entry => entry.id);
        expect(calibrationIds).toContain('focus-stability-boost');
        expect(calibrationIds).toContain('stress-diffusion');
        expect(result.aggregate.calibrationCount).toBe(result.calibrations.length);
        expect(result.aggregate.adjustments.length).toBeGreaterThan(0);
        expect(result.aggregate.highestPriority === 'high' || result.aggregate.highestPriority === 'medium').toBe(true);
    });

    it('tracks calibration history and exposes immutable snapshots', () => {
        const engine = new LayoutBlueprintCalibrationEngine({ historyLimit: 2 });
        engine.calibrate({ blueprint, id: 'first' });
        engine.calibrate({ blueprint, id: 'second' });
        engine.calibrate({ blueprint, id: 'third' });

        const history = engine.getHistory();
        expect(history).toHaveLength(2);
        expect(history[0].id).toBe('second');
        expect(history[1].id).toBe('third');

        history[0].calibrations?.push?.({ id: 'mutate' });
        const afterMutation = engine.getHistory();
        expect(afterMutation[0].calibrations.some(entry => entry.id === 'mutate')).toBe(false);
    });

    it('supports custom calibrators and disables defaults', () => {
        const engine = new LayoutBlueprintCalibrationEngine({ defaults: false });
        engine.registerCalibrator({
            id: 'custom',
            title: 'Custom Calibrator',
            priority: 'high',
            evaluate() {
                return {
                    id: 'custom',
                    title: 'Custom Calibrator',
                    rationale: 'Manual override engaged.',
                    score: 0.95,
                    adjustments: [
                        {
                            type: 'layout',
                            target: 'experimentalWeight',
                            change: 0.2,
                            summary: 'Increase experimental weighting.'
                        }
                    ]
                };
            }
        });

        const result = engine.calibrate({ blueprint });
        expect(result?.calibrations).toHaveLength(1);
        expect(result?.calibrations[0].id).toBe('custom');
        expect(result?.aggregate.adjustments[0].target).toBe('experimentalWeight');
    });

    it('logs results through the connected insight engine', () => {
        const insights = new LayoutBlueprintInsightEngine({ calibrationHistoryLimit: 3 });
        const engine = new LayoutBlueprintCalibrationEngine({ insightEngine: insights });

        engine.calibrate({ blueprint, id: 'insight-sync' });
        const recorded = insights.getCalibrationHistory();

        expect(recorded).toHaveLength(1);
        expect(recorded[0].id).toBe('insight-sync');
        expect(recorded[0].calibrations.length).toBeGreaterThan(0);
    });
});
