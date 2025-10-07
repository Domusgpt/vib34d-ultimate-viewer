import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SensoryInputBridge } from '../../src/ui/adaptive/SensoryInputBridge.js';
import { SensorSchemaRegistry } from '../../src/ui/adaptive/sensors/SensorSchemaRegistry.js';

describe('SensoryInputBridge schema validation', () => {
  let bridge;

  beforeEach(() => {
    bridge = new SensoryInputBridge({ confidenceThreshold: 0 });
  });

  it('clamps invalid focus payloads and emits sanitized values', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const focusUpdates = [];

    bridge.subscribe('focus', payload => focusUpdates.push(payload));
    bridge.ingest('eye-tracking', { x: 2.6, y: -0.4, depth: 'bad' }, 1);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Schema validation issues for eye-tracking'),
      expect.any(Array)
    );

    const snapshot = bridge.getSnapshot();
    expect(snapshot.focusVector.x).toBe(1);
    expect(snapshot.focusVector.y).toBe(0);
    expect(snapshot.focusVector.depth).toBeCloseTo(0.3);

    expect(focusUpdates.at(-1)).toEqual({ x: 1, y: 0, depth: 0.3 });

    warnSpy.mockRestore();
  });

  it('normalizes neural intent engagement and maintains engagement state', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    bridge.subscribe('engagement', () => {});
    bridge.ingest('neural-intent', { x: '0.5', engagement: 1.7 }, 1);

    expect(warnSpy).toHaveBeenCalled();

    const snapshot = bridge.getSnapshot();
    expect(snapshot.intentionVector.x).toBeCloseTo(0.5);
    expect(snapshot.engagementLevel).toBeCloseTo(1);

    warnSpy.mockRestore();
  });

  it('supports runtime schema registration via registerSchema', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new SensorSchemaRegistry({ registerDefaults: false });
    const customBridge = new SensoryInputBridge({ schemaRegistry: registry, confidenceThreshold: 0 });

    let emitted;
    customBridge.subscribe('custom', payload => {
      emitted = payload;
    });

    customBridge.registerSchema('custom', {
      normalize: payload => {
        const issues = [];
        const numericValue = typeof payload.value === 'number' ? payload.value : 42;
        if (typeof payload.value !== 'number') {
          issues.push({ field: 'value', code: 'type' });
        }
        return { payload: { value: numericValue }, issues };
      },
      fallback: { value: 0 }
    });

    customBridge.ingest('custom', { value: 'abc' }, 1);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Schema validation issues for custom'),
      expect.any(Array)
    );
    expect(emitted).toMatchObject({ payload: { value: 42 }, confidence: 1 });

    warnSpy.mockRestore();
  });
});
