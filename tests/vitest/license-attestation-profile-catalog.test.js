import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LICENSE_ATTESTATION_PROFILE_PACKS,
  resolveLicenseAttestationProfilePack,
  instantiateLicenseAttestationProfilePack
} from '../../src/product/licensing/LicenseAttestationProfileCatalog.js';

describe('LicenseAttestationProfileCatalog', () => {
  it('exposes default pack descriptors', () => {
    expect(Array.isArray(DEFAULT_LICENSE_ATTESTATION_PROFILE_PACKS)).toBe(true);
    expect(DEFAULT_LICENSE_ATTESTATION_PROFILE_PACKS.some(pack => pack.id === 'enterprise-saas')).toBe(true);
  });

  it('resolves default pack identifiers with overrides', () => {
    const pack = resolveLicenseAttestationProfilePack('enterprise-saas', {
      regions: ['global', 'apac'],
      baseUrl: 'https://licensing.example.com'
    });

    expect(pack.id).toBe('enterprise-saas');
    expect(pack.profiles).toHaveLength(2);
    expect(pack.profiles[0].attestor.attestationUrl).toContain('https://licensing.example.com');
    expect(pack.defaultProfileId).toBe('enterprise-saas/global');
  });

  it('instantiates custom pack descriptors', () => {
    const descriptor = {
      id: 'custom-pack',
      name: 'Custom Pack',
      description: 'Custom description',
      profiles: [
        {
          id: 'custom/profile',
          attestor: { attestationUrl: 'https://custom.example/attest' },
          metadata: { segment: 'custom' }
        }
      ]
    };

    const pack = instantiateLicenseAttestationProfilePack(descriptor);
    expect(pack.id).toBe('custom-pack');
    expect(pack.profiles).toHaveLength(1);
    expect(pack.profiles[0].metadata.segment).toBe('custom');
  });
});
