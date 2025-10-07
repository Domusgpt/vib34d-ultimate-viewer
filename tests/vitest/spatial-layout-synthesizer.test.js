import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpatialLayoutSynthesizer } from '../../src/ui/adaptive/SpatialLayoutSynthesizer.js';
import { LayoutStrategy } from '../../src/ui/adaptive/strategies/LayoutStrategy.js';
import { LayoutAnnotation } from '../../src/ui/adaptive/annotations/LayoutAnnotation.js';

const baseContext = {
  focusVector: { x: 0.52, y: 0.47, depth: 0.28 },
  intentionVector: { x: 0.1, y: 0.2, z: 0.05, w: 0.08 },
  engagementLevel: 0.6,
  biometricStress: 0.2,
  gestureIntent: { intent: 'swipe', vector: { x: 0.3, y: 0.1, z: 0 } },
  environment: { luminance: 0.4, noiseLevel: 0.1, motion: 0.2 }
};

class VelocityBoostStrategy extends LayoutStrategy {
  constructor() {
    super({ id: 'velocity-boost', priority: 1 });
  }

  prepare({ layout }) {
    layout.intensity = 0.9;
  }

  compose({ layout }) {
    layout.motion = {
      velocity: 0.92,
      bias: { x: 0.4, y: 0.1, z: 0 },
      easing: 'ease-in'
    };
  }
}

class DebugAnnotation extends LayoutAnnotation {
  constructor() {
    super({ id: 'debug', priority: 1 });
  }

  shouldApply() {
    return true;
  }

  build({ layout }) {
    return { message: `intensity:${layout.intensity}` };
  }
}

describe('SpatialLayoutSynthesizer', () => {
  let synthesizer;

  beforeEach(() => {
    synthesizer = new SpatialLayoutSynthesizer();
  });

  it('generates layout with baseline zones and motion details', () => {
    const layout = synthesizer.generateLayout(baseContext);

    expect(layout.intensity).toBeGreaterThan(0);
    expect(layout.intensity).toBeLessThanOrEqual(1);
    expect(layout.zones).toHaveLength(3);
    expect(layout.motion.velocity).toBeGreaterThan(0);
    expect(['ease-in-out', 'ease-out']).toContain(layout.motion.easing);

    const primaryZone = layout.zones.find(zone => zone.id === 'primary');
    expect(primaryZone).toBeDefined();
    expect(primaryZone.recommendedComponents.length).toBeGreaterThan(0);
  });

  it('supports runtime strategy swapping without touching core class', () => {
    const customSynth = new SpatialLayoutSynthesizer({ useDefaultStrategies: false });
    customSynth.registerStrategy(new VelocityBoostStrategy());

    const layout = customSynth.generateLayout(baseContext);

    expect(layout.intensity).toBe(0.9);
    expect(layout.motion.velocity).toBeCloseTo(0.92);
    expect(layout.motion.easing).toBe('ease-in');
  });

  it('supports annotations and guards against annotation failures', () => {
    const annotation = new DebugAnnotation();
    synthesizer.registerAnnotation(annotation);

    const layout = synthesizer.generateLayout(baseContext);
    expect(layout.annotations).toContainEqual({ id: 'debug', message: expect.stringContaining('intensity:') });

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    synthesizer.registerAnnotation(
      new (class BrokenAnnotation extends LayoutAnnotation {
        constructor() {
          super({ id: 'broken' });
        }
        build() {
          throw new Error('fail');
        }
      })()
    );

    const layoutWithFailure = synthesizer.generateLayout(baseContext);
    expect(layoutWithFailure.annotations).toEqual(expect.arrayContaining([{ id: 'debug', message: expect.any(String) }]));
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Annotation broken failed'),
      expect.any(Error)
    );

    consoleWarn.mockRestore();
  });
});
