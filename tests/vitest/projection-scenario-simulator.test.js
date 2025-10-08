import { describe, expect, it } from 'vitest';
import { ProjectionFieldComposer } from '../../src/ui/adaptive/ProjectionFieldComposer.js';
import { ProjectionScenarioSimulator } from '../../src/ui/adaptive/ProjectionScenarioSimulator.js';

const baseLayout = {
  zones: [
    { id: 'primary', occupancy: 0.44, layeringDepth: 0.22, biasX: 0.48, biasY: 0.5 },
    { id: 'peripheral', occupancy: 0.36, layeringDepth: 0.38, biasX: 0.18, biasY: 0.72 },
    { id: 'ambient', occupancy: 0.32, layeringDepth: 0.62, biasX: 0.72, biasY: 0.28 }
  ],
  motion: { velocity: 0.24, bias: { x: 0, y: 0, z: 0 } },
  colorAdaptation: { hueShift: 180, saturation: 60, lightness: 48 }
};

const baseDesign = {
  pattern: { id: 'test-pattern', name: 'Test Pattern', components: ['primary-card', 'peripheral-strip', 'ambient-field'] },
  integration: { designTokens: { color: 'glance', motion: 'flow' } },
  monetization: { tier: 'starter' }
};

describe('ProjectionScenarioSimulator', () => {
  it('registers default scenarios and lists them', () => {
    const composer = new ProjectionFieldComposer();
    const simulator = new ProjectionScenarioSimulator({ composer });

    const scenarios = simulator.listScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(3);
    expect(scenarios.some(item => item.id === 'gesture-intensive')).toBe(true);
  });

  it('simulates low light focus scenario and clamps luminance', () => {
    const composer = new ProjectionFieldComposer();
    const simulator = new ProjectionScenarioSimulator({ composer });

    const result = simulator.simulateScenario('low-light-focus', {
      context: { environment: { luminance: 0.7 } },
      layout: baseLayout,
      design: baseDesign
    });

    expect(result.metrics.channelCount).toBeGreaterThan(0);
    expect(result.blueprint.modulation.luminance).toBeLessThan(0.4);
    expect(result.metrics.dominantChannel).not.toBeNull();
  });

  it('allows registering custom scenarios and clearing the catalog', () => {
    const composer = new ProjectionFieldComposer({ useDefaultChannels: false });
    composer.registerChannel({ id: 'custom', surfaces: ['primary'], depthRange: [0.2, 0.4] });
    const simulator = new ProjectionScenarioSimulator({ composer, useDefaultScenarios: false });

    simulator.registerScenario({ id: 'custom-scenario', context: { engagementLevel: 0.9 } });
    const result = simulator.simulateScenario('custom-scenario', {
      layout: baseLayout,
      design: baseDesign
    });

    expect(result.metrics.channelCount).toBe(1);
    expect(result.blueprint.modulation.engagement).toBeCloseTo(0.9, 1);

    simulator.clearScenarios();
    expect(simulator.listScenarios()).toHaveLength(0);
  });
});
