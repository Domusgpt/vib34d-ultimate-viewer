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

  it('supports retention policies and encryption metadata for signed S3 uploads', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createFetchResponse({
        json: async () => ({
          uploadUrl: 'https://example.com/upload',
          key: 'vault.json',
          headers: {}
        })
      }))
      .mockResolvedValueOnce(createFetchResponse());

    const encryptPayload = vi.fn(async (body) => ({
      body: `encrypted:${body}`,
      contentType: 'application/x-adaptive-encrypted',
      headers: { 'x-amz-server-side-encryption': 'aws:kms' },
      metadata: { keyId: 'kms-key-id' }
    }));

    const onUploadComplete = vi.fn();

    const adapter = createSignedS3StorageAdapter({
      signingEndpoint: 'https://example.com/sign',
      fetchImplementation: fetchMock,
      retentionPolicy: { strategy: 'timeboxed', maxAgeMs: 86_400_000 },
      encryptPayload,
      onUploadComplete
    });

    await adapter.write([
      { event: 'privacy.consent.updated', classification: 'compliance', timestamp: '2025-01-01T00:00:00.000Z' }
    ]);

    expect(encryptPayload).toHaveBeenCalledOnce();

    const signingCall = fetchMock.mock.calls[0];
    const signingBody = JSON.parse(signingCall[1].body);
    expect(signingBody.retentionPolicy).toEqual({ strategy: 'timeboxed', maxAgeMs: 86_400_000 });
    expect(signingBody.encryption).toEqual({ keyId: 'kms-key-id' });

    const uploadCall = fetchMock.mock.calls[1];
    const uploadHeaders = uploadCall[1].headers;
    expect(uploadHeaders['x-amz-meta-retention']).toBe(JSON.stringify({ strategy: 'timeboxed', maxAgeMs: 86_400_000 }));
    expect(uploadHeaders['x-amz-meta-encryption']).toBe(JSON.stringify({ keyId: 'kms-key-id' }));
    expect(uploadHeaders['x-amz-server-side-encryption']).toBe('aws:kms');
    expect(uploadHeaders['content-type']).toBe('application/x-adaptive-encrypted');
    expect(uploadCall[1].body).toMatch(/^encrypted:\{"exportedAt":/);

    expect(onUploadComplete).toHaveBeenCalledWith(expect.objectContaining({
      recordCount: 1,
      retentionPolicy: { strategy: 'timeboxed', maxAgeMs: 86_400_000 },
      encryptionMetadata: { keyId: 'kms-key-id' }
    }));
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

  it('applies retention headers and encryption metadata for log brokers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse());
    const encryptPayload = vi.fn(async (body) => `enc::${body}`);

    const adapter = createLogBrokerStorageAdapter({
      endpoint: 'https://broker.example.com/ingest',
      fetchImplementation: fetchMock,
      retentionPolicy: 3_600_000,
      encryptPayload,
      encryptionContentType: 'application/vnd.adaptive-log'
    });

    await adapter.write([
      { event: 'privacy.consent.updated', classification: 'compliance', timestamp: '2025-01-01T00:00:00.000Z' }
    ]);

    expect(encryptPayload).toHaveBeenCalledOnce();

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['x-retention-policy']).toBe(JSON.stringify({ strategy: 'timeboxed', maxAgeMs: 3_600_000 }));
    expect(options.headers['content-type']).toBe('application/vnd.adaptive-log');
    expect(options.body).toMatch(/^enc::\{"exportedAt":/);
  });
});
