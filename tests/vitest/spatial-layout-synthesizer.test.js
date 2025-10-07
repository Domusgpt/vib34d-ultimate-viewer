import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpatialLayoutSynthesizer } from '../../src/ui/adaptive/SpatialLayoutSynthesizer.js';

const baseContext = {
  focusVector: { x: 0.52, y: 0.47, depth: 0.28 },
  intentionVector: { x: 0.1, y: 0.2, z: 0.05, w: 0.08 },
  engagementLevel: 0.6,
  biometricStress: 0.2,
  gestureIntent: { intent: 'swipe', vector: { x: 0.3, y: 0.1, z: 0 } },
  environment: { luminance: 0.4, noiseLevel: 0.1, motion: 0.2 }
};

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
    expect(layout.motion.easing).toBe('ease-in-out');

    const primaryZone = layout.zones.find(zone => zone.id === 'primary');
    expect(primaryZone).toBeDefined();
    expect(primaryZone.recommendedComponents.length).toBeGreaterThan(0);
  });

  it('invokes registered patterns and records annotations', () => {
    const patternSpy = vi.fn().mockReturnValue({ severity: 'medium', message: 'Track focus bias' });
    synthesizer.registerPattern('focus-coach', patternSpy);

    const layout = synthesizer.generateLayout(baseContext);

    expect(patternSpy).toHaveBeenCalledTimes(1);
    expect(patternSpy).toHaveBeenCalledWith({ context: baseContext, layout: expect.any(Object) });
    expect(layout.annotations).toContainEqual({
      id: 'focus-coach',
      severity: 'medium',
      message: 'Track focus bias'
    });
  });

  it('guards against pattern failures without interrupting layout generation', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    synthesizer.registerPattern('unstable', () => {
      throw new Error('Pattern failure');
    });

    const layout = synthesizer.generateLayout(baseContext);

    expect(layout.annotations).toHaveLength(0);
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Pattern unstable failed'), expect.any(Error));

    consoleWarn.mockRestore();
  });
});
