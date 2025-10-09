import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectionScenarioSimulator } from '../../src/ui/adaptive/simulators/ProjectionScenarioSimulator.js';

const baseBlueprint = {
    intensity: 0.5,
    engagementLevel: 0.45,
    biometricStress: 0.2,
    focusVector: { x: 0.5, y: 0.5, depth: 0.3 },
    zones: [
        { id: 'primary', occupancy: 0.5, visibility: 0.8, layeringDepth: 0.2 },
        { id: 'peripheral', occupancy: 0.4, visibility: 0.6, layeringDepth: 0.3 }
    ]
};

const baseContext = {
    gazeVelocity: 0.4,
    neuralCoherence: 0.5,
    hapticFeedback: 0.3,
    ambientVariance: 0.25,
    gestureIntent: {
        intensity: 0.35,
        vector: { x: 0.48, y: 0.52, z: 0.38 }
    }
};

describe('ProjectionScenarioSimulator', () => {
    let simulator;

    beforeEach(() => {
        simulator = new ProjectionScenarioSimulator({ autoStart: true });
        simulator.observeAdaptiveState({ blueprint: baseBlueprint, context: baseContext });
    });

    it('registers scenarios and emits frames', () => {
        const listener = vi.fn();
        simulator.on('scenario:frame', listener);
        simulator.registerScenario({
            id: 'scenario-a',
            name: 'Scenario A',
            cycleMs: 8000,
            modulation: {
                blueprint: {
                    intensity: { start: 0.4, end: 0.7 },
                    focusX: { start: 0.5, end: 0.65 },
                    zoneOccupancy: [{ id: 'primary', start: 0.5, end: 0.35 }]
                },
                context: {
                    gestureIntensity: { start: 0.3, end: 0.6 },
                    neuralCoherence: { start: 0.5, end: 0.7 }
                }
            }
        });

        const frame = simulator.step({ timestamp: 1234 });
        expect(frame).toBeTruthy();
        expect(frame?.composition.focusHalo.radius).toBeGreaterThan(0);
        expect(frame?.composition.depthBands.length).toBeGreaterThan(0);
        expect(listener).toHaveBeenCalled();
    });

    it('supports switching scenarios', () => {
        simulator.registerScenario({ id: 'scenario-a', modulation: {} });
        simulator.registerScenario({ id: 'scenario-b', modulation: { blueprint: { intensity: { start: 0.5, end: 0.8 } } } });
        simulator.setActiveScenario('scenario-b');
        const frame = simulator.step({ timestamp: 4321 });
        expect(frame?.id).toBe('scenario-b');
    });

    it('returns realtime frame when no scenario stepped', () => {
        const realtime = simulator.getLastResult();
        expect(realtime).toBeNull();
    });
});
