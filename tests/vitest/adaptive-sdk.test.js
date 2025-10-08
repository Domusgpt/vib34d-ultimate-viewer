import { describe, it, expect, vi } from 'vitest';
import { createAdaptiveSDK } from '../../src/core/AdaptiveSDK.js';

describe('createAdaptiveSDK', () => {
  it('creates a consent panel using default consent options', () => {
    const container = document.createElement('div');
    const sdk = createAdaptiveSDK({
      consentOptions: [
        { classification: 'analytics', title: 'Analytics', description: 'Allow aggregated analytics' }
      ]
    });

    const onConsentToggle = vi.fn();

    const panel = sdk.createConsentPanel({
      container,
      getTelemetryConsent: () => ({ analytics: false }),
      onConsentToggle,
      getComplianceRecords: () => [],
      getTelemetryAuditTrail: () => []
    });

    panel.mount();

    const toggles = container.querySelectorAll('.consent-toggle');
    expect(toggles.length).toBe(1);
    expect(toggles[0].querySelector('span')?.textContent).toBe('Analytics');

    const input = toggles[0].querySelector('input');
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onConsentToggle).toHaveBeenCalledWith('analytics', true);

    panel.destroy();
  });

  it('forwards request middleware registration to telemetry providers', () => {
    const provider = {
      id: 'stub-provider',
      registerRequestMiddleware: vi.fn()
    };

    const sdk = createAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [provider]
    });

    const middleware = () => {};
    sdk.registerTelemetryRequestMiddleware(middleware);

    expect(provider.registerRequestMiddleware).toHaveBeenCalledWith(middleware);
  });

  it('configures remote license attestation helpers', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.includes('attest')) {
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({ valid: true });
          }
        };
      }
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ revoked: false, entitlements: [] });
        }
      };
    });

    const sdk = createAdaptiveSDK({
      license: {
        key: 'remote-license',
        expiresAt: '2025-12-31T00:00:00Z',
        autoValidate: false,
        attestor: {
          attestationUrl: 'https://licensing.example/attest',
          revocationUrl: 'https://licensing.example/revoke',
          entitlementsUrl: 'https://licensing.example/entitlements',
          fetch: fetchMock,
          pollIntervalMs: 1000,
          minimumPollIntervalMs: 50
        },
        attestorBinding: {
          bindToLicenseManager: true,
          attestorOptions: { immediate: false }
        }
      }
    });

    const status = await sdk.requestLicenseAttestation();

    expect(status.state).toBe('valid');
    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(sdk.getLicenseAttestationHistory())).toBe(true);
  });

  it('registers and applies license attestation profiles during bootstrap', () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ valid: true });
      }
    }));

    const sdk = createAdaptiveSDK({
      licenseAttestationProfiles: [
        {
          id: 'profile-default',
          attestor: {
            attestationUrl: 'https://licensing.example/profile/attest',
            fetch: fetchMock
          },
          binding: { attestorOptions: { immediate: true } },
          sla: { failOpen: true }
        }
      ],
      defaultLicenseAttestationProfileId: 'profile-default',
      license: {
        key: 'profile-license',
        attestorProfileId: 'profile-default',
        autoValidate: false
      }
    });

    const profiles = sdk.getLicenseAttestationProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.id).toBe('profile-default');

    const applied = sdk.setLicenseAttestorFromProfile('profile-default', {
      binding: { attestorOptions: { immediate: false } }
    });

    expect(applied.binding.attestorOptions).toEqual({ immediate: false });
    expect(sdk.licenseAttestor).toBe(applied.attestor);
  });

  it('bootstraps license attestation profile packs via config', () => {
    const sdk = createAdaptiveSDK({
      licenseAttestationProfilePackId: 'enterprise-saas',
      licenseAttestationProfilePackOptions: {
        regions: ['global', 'emea'],
        baseUrl: 'https://licensing.partner.example.com'
      }
    });

    const profiles = sdk.getLicenseAttestationProfiles();
    const ids = profiles.map(profile => profile.id);

    expect(ids).toContain('enterprise-saas/global');
    expect(ids).toContain('enterprise-saas/emea');
    expect(sdk.telemetry.getAuditTrail().some(entry => entry.event === 'system.license.attestation_profile_pack_registered')).toBe(true);
  });

  it('exposes projection blueprint helpers through the SDK', () => {
    const sdk = createAdaptiveSDK({
      projection: { useDefaultChannels: false },
      projectionChannels: [
        {
          id: 'sdk-test-channel',
          surfaces: ['primary', 'peripheral'],
          depthRange: [0.2, 0.6],
          timeline: { segments: 3, durationMs: 1800 }
        }
      ],
      replaceDefaultProviders: true,
      telemetryProviders: []
    });

    sdk.engine.sensoryBridge.ingest('eye-tracking', { x: 0.72, y: 0.28, depth: 0.36 }, 0.92);
    sdk.engine.sensoryBridge.ingest('neural-intent', { x: 0.1, y: -0.14, z: 0.22, w: 0.12, engagement: 0.68 }, 0.84);

    sdk.engine.updateVisualizers();

    const blueprint = sdk.getProjectionBlueprint();
    expect(blueprint).toBeTruthy();
    expect(blueprint?.projectionChannels.some(channel => channel.id === 'sdk-test-channel')).toBe(true);
    expect(blueprint?.projectionChannels[0].surfaces.length).toBeGreaterThan(0);
  });

  it('simulates projection scenarios and returns metrics', () => {
    const sdk = createAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: []
    });

    sdk.engine.sensoryBridge.ingest('eye-tracking', { x: 0.42, y: 0.58, depth: 0.28 }, 0.9);
    sdk.engine.sensoryBridge.ingest('neural-intent', { x: 0.08, y: -0.06, z: 0.16, w: 0.48, engagement: 0.74 }, 0.82);
    sdk.engine.sensoryBridge.ingest('ambient', { luminance: 0.64, motion: 0.22 }, 0.6);
    sdk.engine.updateVisualizers();

    const scenarios = sdk.listProjectionScenarios();
    expect(Array.isArray(scenarios)).toBe(true);
    expect(scenarios.length).toBeGreaterThan(0);

    const result = sdk.simulateProjectionScenario(scenarios[0].id);
    expect(result.blueprint.projectionChannels.length).toBeGreaterThan(0);
    expect(result.metrics.channelCount).toBe(result.blueprint.projectionChannels.length);
    expect(result.metrics.coherence).toBeGreaterThan(0);
  });
});
