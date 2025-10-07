import { describe, it, expect, vi } from 'vitest';
import { ComplianceVaultTelemetryProvider } from '../../src/product/telemetry/ComplianceVaultTelemetryProvider.js';

describe('ComplianceVaultTelemetryProvider', () => {
  it('captures compliance events and persists them through the storage adapter', () => {
    const write = vi.fn();
    const clear = vi.fn();
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

    expect(write).toHaveBeenCalledTimes(1);
    expect(provider.getRecords()).toHaveLength(2);

    provider.recordAudit({
      event: 'compliance.manual',
      classification: 'compliance',
      payload: { note: 'reviewed' },
      timestamp: '2025-01-01T00:00:02.000Z'
    });

    const records = provider.getRecords();
    expect(records).toHaveLength(2);
    expect(records[0].event).toBe('compliance.alert');
    expect(records[1].source).toBe('audit-log');
    expect(write).toHaveBeenCalledTimes(2);

    provider.clear();
    expect(provider.getRecords()).toHaveLength(0);
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
