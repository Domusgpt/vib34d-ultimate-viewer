import { describe, expect, it } from 'vitest';
import { ProductTelemetryHarness } from '../../src/product/ProductTelemetryHarness.js';
import {
    DEFAULT_LICENSE_ATTESTATION_PROFILE_ID,
    DEFAULT_LICENSE_ATTESTATION_PROFILES,
    registerDefaultLicenseAttestationProfiles
} from '../../src/product/licensing/attestationProfiles/defaultProfiles.js';

function createHarness(options = {}) {
    return new ProductTelemetryHarness({
        enabled: false,
        ...options,
        providers: [],
        useDefaultLicenseAttestationProfiles: options.useDefaultLicenseAttestationProfiles,
        licenseAttestationProfiles: options.licenseAttestationProfiles
    });
}

describe('license attestation default profile pack', () => {
    it('registers the curated profile pack by default', () => {
        const harness = createHarness();
        const profiles = harness.getLicenseAttestationProfiles();
        const ids = profiles.map(profile => profile.id);

        expect(ids).toEqual(
            expect.arrayContaining(DEFAULT_LICENSE_ATTESTATION_PROFILES.map(profile => profile.id))
        );

        const defaultResult = harness.licenseAttestationProfiles.createAttestor();
        expect(defaultResult.profile.id).toBe(DEFAULT_LICENSE_ATTESTATION_PROFILE_ID);
        expect(defaultResult.attestor).toBeDefined();
    });

    it('can disable the curated pack when requested', () => {
        const harness = createHarness({ useDefaultLicenseAttestationProfiles: false });
        const profiles = harness.getLicenseAttestationProfiles();

        expect(profiles).toHaveLength(0);
    });

    it('supports overriding the default profile id with configuration', () => {
        const harness = createHarness({
            defaultLicenseAttestationProfileId: 'regulated-health-2025'
        });

        const attestor = harness.licenseAttestationProfiles.createAttestor();
        expect(attestor.profile.id).toBe('regulated-health-2025');
    });

    it('can seed a subset of profiles into an existing registry', () => {
        const registryHarness = createHarness({ useDefaultLicenseAttestationProfiles: false });
        const subset = registerDefaultLicenseAttestationProfiles(
            registryHarness.licenseAttestationProfiles,
            {
                profileIds: ['indie-creator-2025'],
                defaultProfileId: 'indie-creator-2025'
            }
        );

        expect(subset).toHaveLength(1);
        expect(subset[0].id).toBe('indie-creator-2025');
        expect(registryHarness.licenseAttestationProfiles.getDefaultProfileId()).toBe('indie-creator-2025');
    });
});
