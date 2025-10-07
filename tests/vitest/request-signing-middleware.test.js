import { describe, it, expect } from 'vitest';
import { createRequestSigningMiddleware } from '../../src/product/telemetry/middleware/createRequestSigningMiddleware.js';

describe('createRequestSigningMiddleware', () => {
  it('throws when signer is missing', () => {
    expect(() => createRequestSigningMiddleware()).toThrow();
  });

  it('injects signature headers from string signer result', async () => {
    const middleware = createRequestSigningMiddleware({
      signer: () => 'signed-token',
      algorithm: 'HMAC-SHA256'
    });

    const result = await middleware({
      endpoint: 'https://telemetry.example/collect',
      options: { method: 'POST', body: JSON.stringify({ events: [] }), headers: {} },
      events: [],
      provider: { id: 'http' }
    });

    expect(result.options.headers['x-adaptive-signature']).toBe('signed-token');
    expect(result.options.headers['x-adaptive-signature-algorithm']).toBe('HMAC-SHA256');
    expect(result.metadata.signature).toBeTruthy();
  });

  it('merges custom metadata and headers from signer object result', async () => {
    const middleware = createRequestSigningMiddleware({
      signer: () => ({
        signature: 'custom',
        algorithm: 'RSA-SHA256',
        headers: { Authorization: 'Bearer token' },
        metadata: { keyId: 'kms-key-1' },
        timestamp: '2025-10-16T00:00:00.000Z'
      })
    });

    const result = await middleware({
      endpoint: 'https://telemetry.example/collect',
      options: { method: 'POST', headers: {} },
      events: [{ event: 'test' }],
      provider: { id: 'http' }
    });

    expect(result.options.headers['x-adaptive-signature']).toBe('custom');
    expect(result.options.headers.Authorization).toBe('Bearer token');
    expect(result.options.headers['x-adaptive-signature-algorithm']).toBe('RSA-SHA256');
    expect(result.metadata.signature.keyId).toBe('kms-key-1');
    expect(result.metadata.signature.issuedAt).toBe('2025-10-16T00:00:00.000Z');
  });
});
