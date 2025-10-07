import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProductTelemetryHarness } from '../../src/product/ProductTelemetryHarness.js';
import { HttpTelemetryProvider } from '../../src/product/telemetry/HttpTelemetryProvider.js';

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

  it('routes events to registered providers and clears them on flush', async () => {
    const harness = new ProductTelemetryHarness({ consoleProvider: { log: false } });

    harness.updateConsent({ analytics: true });
    harness.track('layout-generated', { variant: 'core', userId: 'abc' });
    const consoleProvider = harness.providers.get('console');

    expect(consoleProvider.events).toHaveLength(1);
    expect(consoleProvider.events[0].event).toBe('layout-generated');

    await harness.flush();
    expect(consoleProvider.events).toHaveLength(0);
  });

  it('applies data minimization policies before dispatching payloads', () => {
    const harness = new ProductTelemetryHarness({
      consoleProvider: { log: false },
      dataMinimization: { anonymize: true, omitLicense: true }
    });

    harness.attachLicense('secret-license');
    harness.updateConsent({ analytics: true });
    harness.track('gesture', { identity: 'user-1', magnitude: 0.8, userId: '123' });

    const record = harness.buffer[0];
    expect(record.licenseKey).toBeUndefined();
    expect(record.payload.identity).toBeUndefined();
    expect(record.payload.userId).toBeUndefined();
    expect(record.payload.magnitude).toBe(0.8);
  });

  it('supports swappable HTTP providers with async flush', async () => {
    const httpProvider = new HttpTelemetryProvider({ endpoint: 'https://telemetry.example/collect' });
    const harness = new ProductTelemetryHarness({
      useDefaultProvider: false,
      providers: [httpProvider],
      flushInterval: 5000,
      licenseKey: 'test-license'
    });

    harness.updateConsent({ analytics: true });
    harness.track('pattern-triggered', { id: 'focus-coach' });
    expect(httpProvider.queue).toHaveLength(1);

    await harness.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://telemetry.example/collect', expect.objectContaining({ method: 'POST' }));
    expect(httpProvider.queue).toHaveLength(0);
  });

  it('respects disabled state by ignoring tracking and timers', () => {
    const harness = new ProductTelemetryHarness({ enabled: false, flushInterval: 2000 });
    const flushSpy = vi.spyOn(harness, 'flush');

    harness.track('ignored', {});
    harness.start();
    vi.advanceTimersByTime(6000);

    expect(harness.buffer).toHaveLength(0);
    expect(flushSpy).not.toHaveBeenCalled();
  });

  it('gates analytics events until consent is granted', () => {
    const harness = new ProductTelemetryHarness({ consoleProvider: { log: false } });

    harness.track('design.spec.activated', { variation: 'focus-a' });
    expect(harness.buffer).toHaveLength(0);

    harness.updateConsent({ analytics: true });
    harness.track('design.spec.activated', { variation: 'focus-b' });

    expect(harness.buffer).toHaveLength(1);
    expect(harness.buffer[0].classification).toBe('analytics');

    const audit = harness.getAuditTrail();
    expect(audit.find(entry => entry.event === 'privacy.consent.updated')).toBeTruthy();
    expect(audit.find(entry => entry.event === 'privacy.event.blocked')).toBeTruthy();
  });

  it('records schema issues for compliance review', () => {
    const harness = new ProductTelemetryHarness({ consoleProvider: { log: false } });

    harness.recordSchemaIssue({ type: 'eye-tracking', issues: [{ field: 'x', code: 'max' }], payload: { x: 1 } });

    expect(harness.buffer).toHaveLength(1);
    expect(harness.buffer[0].event).toBe('sensors.schema_issue');
    expect(harness.buffer[0].classification).toBe('compliance');

    const audit = harness.getAuditTrail();
    expect(audit.at(-1).event).toBe('compliance.schema.issue');
  });
});
