import { describe, it, expect } from 'vitest';
import { ProjectionFieldComposer } from '../../src/ui/adaptive/ProjectionFieldComposer.js';

const layout = {
  zones: [
    { id: 'primary', occupancy: 0.54, layeringDepth: 0.2, biasX: 0.45, biasY: 0.52 },
    { id: 'peripheral', occupancy: 0.42, layeringDepth: 0.38, biasX: 0.7, biasY: 0.4 },
    { id: 'ambient', occupancy: 0.31, layeringDepth: 0.62, biasX: 0.2, biasY: 0.65 }
  ]
};

const design = {
  pattern: {
    id: 'neuro-glance-feed',
    name: 'Neuro Glance Feed',
    components: ['glanceable-card', 'pulse-strip', 'ambient-indicator']
  },
  monetization: { tier: 'pro' },
  integration: { designTokens: { color: 'glance', motion: 'command' } }
};

describe('ProjectionFieldComposer', () => {
  it('builds a projection blueprint with default channels', () => {
    const composer = new ProjectionFieldComposer();

    const blueprint = composer.composeBlueprint({
      context: {
        focusVector: { x: 0.6, y: 0.4, depth: 0.28 },
        intentionVector: { x: 0.1, y: -0.05, z: 0.12, w: 0.08 },
        engagementLevel: 0.57,
        biometricStress: 0.18,
        environment: { luminance: 0.48, motion: 0.22 }
      },
      layout,
      design
    });

    expect(blueprint).toBeTruthy();
    expect(blueprint.projectionChannels.length).toBeGreaterThan(0);
    expect(blueprint.projectionChannels[0].surfaces.length).toBeGreaterThan(0);
    expect(blueprint.design.patternId).toBe('neuro-glance-feed');
    expect(blueprint.modulation.calmIndex).toBeGreaterThan(0);
  });

  it('supports registering custom channels and produces timeline offsets', () => {
    const composer = new ProjectionFieldComposer({ useDefaultChannels: false });

    composer.registerChannel({
      id: 'glance-surround',
      surfaces: ['primary', 'peripheral'],
      depthRange: [0.2, 0.6],
      amplitude: 0.74,
      timeline: { segments: 5, durationMs: 3000, emphasis: [2, 3] },
      modulationWeights: { focus: 0.8, engagement: 0.6 }
    });

    const blueprint = composer.composeBlueprint({
      context: {
        focusVector: { x: 0.52, y: 0.47, depth: 0.32 },
        intentionVector: { x: -0.05, y: 0.14, z: 0.2, w: 0.12 },
        engagementLevel: 0.68,
        biometricStress: 0.12,
        environment: { luminance: 0.55, motion: 0.18 }
      },
      layout,
      design
    });

    expect(blueprint.projectionChannels).toHaveLength(1);
    const [channel] = blueprint.projectionChannels;
    expect(channel.id).toBe('glance-surround');
    expect(channel.timeline.segments).toHaveLength(5);
    expect(channel.timeline.dominantSegment).toBeGreaterThanOrEqual(0);
    expect(channel.surfaces[0].timelineOffsets.length).toBe(5);
    expect(channel.designGuidance.monetizationTier).toBe('pro');
    expect(channel.energyProfile.focus).toBeGreaterThan(0);
  });
});
