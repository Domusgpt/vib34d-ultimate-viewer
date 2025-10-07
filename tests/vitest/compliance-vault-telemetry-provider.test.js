import { describe, it, expect, vi } from 'vitest';
import { ComplianceVaultTelemetryProvider } from '../../src/product/telemetry/ComplianceVaultTelemetryProvider.js';

describe('ComplianceVaultTelemetryProvider', () => {
  it('captures compliance events and persists them through the storage adapter', async () => {
    const write = vi.fn(() => Promise.resolve());
    const clear = vi.fn(() => Promise.resolve());
    const provider = new ComplianceVaultTelemetryProvider({
      storageAdapter: {
        read: () => [{
          event: 'seed',
          classification: 'compliance',
          timestamp: '2025-01-01T00:00:00.000Z',
          payload: null
        }],
        write,
        clear
      },
      maxRecords: 2
    });

    await provider.whenReady();
    expect(provider.getRecords()).toHaveLength(1);

    provider.track(
      'compliance.alert',
      {
        payload: { issue: 'schema' },
        classification: 'compliance',
        timestamp: '2025-01-01T00:00:01.000Z'
      },
      { classification: 'compliance' }
    );

    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    expect(provider.getRecords()).toHaveLength(2);

    provider.recordAudit({
      event: 'compliance.manual',
      classification: 'compliance',
      payload: { note: 'reviewed' },
      timestamp: '2025-01-01T00:00:02.000Z'
    });

    await Promise.resolve();
    const records = provider.getRecords();
    expect(records).toHaveLength(2);
    expect(records[0].event).toBe('compliance.alert');
    expect(records[1].source).toBe('audit-log');
    expect(write).toHaveBeenCalledTimes(2);

    await provider.clear();
    expect(provider.getRecords()).toHaveLength(0);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('supports async storage initialization and surfaces errors', async () => {
    const write = vi.fn(() => Promise.resolve());
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new ComplianceVaultTelemetryProvider({
      storageAdapter: {
        read: () => Promise.resolve([
          {
            event: 'existing',
            classification: 'compliance',
            timestamp: '2025-01-01T00:00:00.000Z'
          }
        ]),
        write
      }
    });

    await provider.whenReady();
    expect(provider.getRecords()).toHaveLength(1);

    const erroringAdapter = new ComplianceVaultTelemetryProvider({
      storageAdapter: {
        write: () => Promise.reject(new Error('boom'))
      }
    });

    erroringAdapter.track('compliance.issue', { classification: 'compliance' }, { classification: 'compliance' });
    await Promise.resolve();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
