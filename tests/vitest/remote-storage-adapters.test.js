import { describe, it, expect, vi } from 'vitest';
import { createSignedS3StorageAdapter, createLogBrokerStorageAdapter } from '../../src/product/telemetry/storage/RemoteStorageAdapters.js';

function createFetchResponse({ ok = true, status = 200, json } = {}) {
  return {
    ok,
    status,
    json: json || (async () => ({}))
  };
}

describe('RemoteStorageAdapters', () => {
  it('uploads compliance records via signed S3 adapter', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createFetchResponse({
        json: async () => ({ uploadUrl: 'https://example.com/upload', key: 'vault.json', headers: { 'x-amz-meta-test': '1' } })
      }))
      .mockResolvedValueOnce(createFetchResponse());

    const onUploadComplete = vi.fn();

    const adapter = createSignedS3StorageAdapter({
      signingEndpoint: 'https://example.com/sign',
      fetchImplementation: fetchMock,
      onUploadComplete
    });

    await adapter.write([
      { event: 'privacy.consent.updated', classification: 'compliance', timestamp: '2025-01-01T00:00:00.000Z' }
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/sign');
    expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/upload');
    expect(onUploadComplete).toHaveBeenCalledWith(expect.objectContaining({ key: 'vault.json', recordCount: 1 }));
  });

  it('delivers payloads to a log broker endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse());
    const adapter = createLogBrokerStorageAdapter({
      endpoint: 'https://broker.example.com/ingest',
      fetchImplementation: fetchMock
    });

    await adapter.write([
      { event: 'privacy.consent.updated', classification: 'compliance', timestamp: '2025-01-01T00:00:00.000Z' },
      { event: 'sensors.schema_issue', classification: 'compliance', timestamp: '2025-01-01T00:01:00.000Z' }
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.records).toHaveLength(2);
  });
});
