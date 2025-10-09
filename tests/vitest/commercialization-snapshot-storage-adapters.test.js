import { describe, it, expect, vi } from 'vitest';
import {
  createCommercializationSnapshotRemoteStorage,
  createSignedS3CommercializationSnapshotStorage,
  createCommercializationSnapshotPayload
} from '../../src/product/licensing/storage/CommercializationSnapshotStorageAdapters.js';

const baseSnapshot = {
  id: 'snapshot-01',
  capturedAt: '2025-10-20T12:00:00.000Z',
  context: { trigger: 'test', licenseKey: 'secret-key' },
  kpis: { totalPacks: 2, totalAdoption: 5 },
  summary: { packs: [], profiles: [], segments: {}, regions: {}, sla: {} }
};

describe('CommercializationSnapshotStorageAdapters', () => {
  it('redacts context keys and omits summary when configured', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const adapter = { write };
    const storage = createCommercializationSnapshotRemoteStorage({
      adapter,
      includeSummary: false,
      redactContextKeys: ['licenseKey']
    });

    await storage.saveSnapshots([baseSnapshot]);

    expect(write).toHaveBeenCalledTimes(1);
    const payload = write.mock.calls[0][0];
    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0].context.licenseKey).toBeUndefined();
    expect(payload[0].summary).toBeUndefined();
    expect(payload[0].kpis.totalPacks).toBe(2);
  });

  it('wraps the signed S3 adapter and serializes payload metadata', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadUrl: 'https://example.com/upload', key: 'snapshots.json', headers: {} })
      })
      .mockResolvedValueOnce({ ok: true });

    const storage = createSignedS3CommercializationSnapshotStorage({
      signingEndpoint: 'https://example.com/sign',
      fetchImplementation: fetchMock
    });

    await storage.saveSnapshots([baseSnapshot]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const uploadCall = fetchMock.mock.calls[1];
    expect(uploadCall[0]).toBe('https://example.com/upload');
    const body = uploadCall[1]?.body;
    expect(typeof body).toBe('string');
    expect(body).toContain('"snapshotCount":1');

    const payload = createCommercializationSnapshotPayload([baseSnapshot], {
      retentionPolicy: { strategy: 'timeboxed', maxAgeMs: 86_400_000 }
    });
    expect(payload.snapshotCount).toBe(1);
    expect(payload.retentionPolicy).toEqual({ strategy: 'timeboxed', maxAgeMs: 86_400_000 });
  });
});
