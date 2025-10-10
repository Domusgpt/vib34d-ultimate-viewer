import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LicenseManager } from '../../src/product/licensing/LicenseManager.js';
import { RemoteLicenseAttestor } from '../../src/product/licensing/RemoteLicenseAttestor.js';

function createResponse(data, ok = true, status = 200) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(data);
    }
  };
}

describe('RemoteLicenseAttestor', () => {
  let clockDate;

  beforeEach(() => {
    clockDate = new Date('2025-06-01T00:00:00Z');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates remotely and merges entitlements into the license manager', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.includes('attest')) {
        return createResponse({
          valid: true,
          nextCheckInMs: 2000,
          metadata: { region: 'NA' }
        });
      }
      if (url.includes('revoke')) {
        return createResponse({ revoked: false });
      }
      if (url.includes('entitlements')) {
        return createResponse({ entitlements: ['vision-kit'], ttlMs: 5000 });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    const manager = new LicenseManager({ clock: () => clockDate });
    const attestor = new RemoteLicenseAttestor({
      attestationUrl: 'https://licensing.example/attest',
      revocationUrl: 'https://licensing.example/revoke',
      entitlementsUrl: 'https://licensing.example/entitlements',
      fetch: fetchMock,
      pollIntervalMs: 8000,
      minimumPollIntervalMs: 1000,
      clock: () => clockDate
    });

    attestor.bindToLicenseManager(manager, { immediate: false });
    manager.setLicense({ key: 'tenant-license', expiresAt: '2025-12-31T00:00:00Z', features: ['core'] });

    const status = await manager.validate({ environment: 'staging' });

    expect(status.state).toBe('valid');
    expect(status.metadata.remote.attestation.valid).toBe(true);
    expect(status.metadata.entitlements).toEqual(['vision-kit']);
    expect(manager.getLicense().features).toContain('vision-kit');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(attestor.getHistory()).toHaveLength(1);
  });

  it('fails closed when remote attestation errors', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.includes('attest')) {
        throw new Error('network down');
      }
      return createResponse({});
    });

    const manager = new LicenseManager({ clock: () => clockDate });
    const attestor = new RemoteLicenseAttestor({
      attestationUrl: 'https://licensing.example/attest',
      fetch: fetchMock,
      clock: () => clockDate
    });

    attestor.bindToLicenseManager(manager, { immediate: false });
    manager.setLicense({ key: 'tenant-license', expiresAt: '2025-12-31T00:00:00Z' });

    const status = await manager.validate();

    expect(status.state).toBe('invalid');
    expect(status.reason).toBe('REMOTE_ATTESTATION_ERROR');
  });

  it('supports fail-open mode while surfacing error metadata', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('timeout');
    });

    const manager = new LicenseManager({ clock: () => clockDate });
    const attestor = new RemoteLicenseAttestor({
      attestationUrl: 'https://licensing.example/attest',
      fetch: fetchMock,
      failOpen: true,
      clock: () => clockDate
    });

    attestor.bindToLicenseManager(manager, { immediate: false });
    manager.setLicense({ key: 'tenant-license', expiresAt: '2025-12-31T00:00:00Z' });

    const status = await manager.validate();

    expect(status.state).toBe('valid');
    expect(status.metadata.remote.error).toMatch(/timeout/);
    expect(status.metadata.remote.failOpen).toBe(true);
  });

  it('schedules follow-up validations using remote guidance', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(async (url) => {
      if (url.includes('attest')) {
        return createResponse({ valid: true, nextCheckInMs: 500 });
      }
      if (url.includes('revoke')) {
        return createResponse({ revoked: false });
      }
      if (url.includes('entitlements')) {
        return createResponse({ entitlements: [], ttlMs: 1000 });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    const manager = new LicenseManager({ clock: () => clockDate });
    const attestor = new RemoteLicenseAttestor({
      attestationUrl: 'https://licensing.example/attest',
      revocationUrl: 'https://licensing.example/revoke',
      entitlementsUrl: 'https://licensing.example/entitlements',
      fetch: fetchMock,
      pollIntervalMs: 2000,
      minimumPollIntervalMs: 100,
      clock: () => clockDate
    });

    const validationListener = vi.fn();
    attestor.on('validation', validationListener);

    attestor.bindToLicenseManager(manager, { immediate: false });
    manager.setLicense({ key: 'tenant-license', expiresAt: '2025-12-31T00:00:00Z' });

    try {
      await manager.validate();
      fetchMock.mockClear();
      validationListener.mockClear();

      await vi.advanceTimersByTimeAsync(600);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(validationListener).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
