import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProductTelemetryHarness } from '../../src/product/ProductTelemetryHarness.js';

describe('ProductTelemetryHarness', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('buffers events and flushes payloads to the configured endpoint', async () => {
    const harness = new ProductTelemetryHarness({
      endpoint: 'https://telemetry.example/collect',
      licenseKey: 'test-license'
    });

    harness.track('layout-generated', { variant: 'core' });
    harness.track('pattern-triggered', { id: 'focus-coach' });

    expect(harness.buffer).toHaveLength(2);

    harness.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://telemetry.example/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('layout-generated')
    });
    expect(harness.buffer).toHaveLength(0);
  });

  it('honours disabled state by ignoring tracking and timers', () => {
    const harness = new ProductTelemetryHarness({ enabled: false, flushInterval: 2000 });
    const flushSpy = vi.spyOn(harness, 'flush');

    harness.track('ignored', {});
    harness.start();
    vi.advanceTimersByTime(6000);

    expect(harness.buffer).toHaveLength(0);
    expect(flushSpy).not.toHaveBeenCalled();
  });

  it('auto-flushes on the configured interval when started', () => {
    const harness = new ProductTelemetryHarness({
      endpoint: 'https://telemetry.example/collect',
      flushInterval: 5000
    });

    harness.track('layout-generated', { variant: 'adaptive' });
    harness.start();

    vi.advanceTimersByTime(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    harness.stop();
    vi.advanceTimersByTime(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
