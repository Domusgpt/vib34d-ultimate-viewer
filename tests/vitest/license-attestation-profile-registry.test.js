import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LicenseAttestationProfileRegistry } from '../../src/product/licensing/LicenseAttestationProfileRegistry.js';
import { RemoteLicenseAttestor } from '../../src/product/licensing/RemoteLicenseAttestor.js';

describe('LicenseAttestationProfileRegistry', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ valid: true });
      }
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers profiles and instantiates attestors with overrides', () => {
    const registry = new LicenseAttestationProfileRegistry();

    registry.registerProfile({
      id: 'enterprise-basic',
      name: 'Enterprise Basic',
      attestor: {
        attestationUrl: 'https://licensing.example/attest',
        fetch: fetchMock,
        pollIntervalMs: 900000
      },
      binding: {
        bindToLicenseManager: true,
        attestorOptions: { immediate: true }
      },
      sla: { failOpen: false, responseTargetMs: 5000 }
    });

    const { attestor, binding, profile } = registry.createAttestor('enterprise-basic', {
      attestorOptions: { pollIntervalMs: 600000 },
      binding: { attestorOptions: { immediate: false } },
      metadata: { region: 'na' }
    });

    expect(attestor).toBeInstanceOf(RemoteLicenseAttestor);
    expect(binding.attestorOptions).toEqual({ immediate: false });
    expect(profile.metadata).toEqual({ region: 'na' });
    expect(profile.sla?.responseTargetMs).toBe(5000);
  });

  it('uses the default profile when no id is provided', () => {
    const registry = new LicenseAttestationProfileRegistry({ defaultProfileId: 'wearables-pro' });

    registry.registerProfile('wearables-pro', {
      attestor: {
        attestationUrl: 'https://licensing.example/pro/attest',
        fetch: fetchMock
      }
    });

    const result = registry.createAttestor();
    expect(result.profile.id).toBe('wearables-pro');
    expect(registry.getDefaultProfileId()).toBe('wearables-pro');
  });

  it('allows clearing the default profile', () => {
    const registry = new LicenseAttestationProfileRegistry();

    registry.registerProfile({
      id: 'studio-default',
      attestor: {
        attestationUrl: 'https://licensing.example/studio/attest',
        fetch: fetchMock
      }
    });

    expect(registry.getDefaultProfileId()).toBe('studio-default');
    registry.clearDefaultProfile();
    expect(registry.getDefaultProfileId()).toBeNull();
  });
});
