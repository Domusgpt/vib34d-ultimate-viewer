import { describe, it, expect, vi } from 'vitest';
import { createAdaptiveSDK } from '../../src/core/AdaptiveSDK.js';

function createHeadlessAdaptiveSDK(config = {}) {
  const { environment, ...rest } = config;
  return createAdaptiveSDK({
    ...rest,
    environment: {
      mode: 'headless',
      ...(environment || {})
    }
  });
}

describe('createAdaptiveSDK', () => {
  it('creates a consent panel using default consent options', () => {
    const container = document.createElement('div');
    const sdk = createHeadlessAdaptiveSDK({
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

    const sdk = createHeadlessAdaptiveSDK({
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

    const sdk = createHeadlessAdaptiveSDK({
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

    const sdk = createHeadlessAdaptiveSDK({
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
    const sdk = createHeadlessAdaptiveSDK({
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

  it('bootstraps without browser DOM when using headless mode', () => {
    const sdk = createHeadlessAdaptiveSDK();

    expect(sdk.engine.environment.mode).toBe('headless');
    expect(() => sdk.updateTelemetryConsent({ analytics: true })).not.toThrow();
    expect(Array.isArray(sdk.telemetry.getAuditTrail())).toBe(true);
  });

  it('supports telemetry provider factories and readiness tracking', async () => {
    const factoryProvider = {
      id: 'factory-provider',
      registerRequestMiddleware: vi.fn()
    };
    const asyncProvider = {
      id: 'async-provider',
      registerRequestMiddleware: vi.fn()
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [
        () => factoryProvider,
        {
          factory: async () => {
            await Promise.resolve();
            return asyncProvider;
          }
        }
      ]
    });

    await sdk.whenTelemetryProvidersReady();

    const middleware = () => {};
    sdk.registerTelemetryRequestMiddleware(middleware);

    expect(factoryProvider.registerRequestMiddleware).toHaveBeenCalledWith(middleware);
    expect(asyncProvider.registerRequestMiddleware).toHaveBeenCalledWith(middleware);
  });

  it('gates telemetry provider descriptors and broadcasts registration events', async () => {
    const eagerProvider = {
      id: 'eager-provider',
      registerRequestMiddleware: vi.fn()
    };
    const skippedProvider = {
      id: 'skipped-provider',
      registerRequestMiddleware: vi.fn()
    };
    const lateProvider = {
      id: 'late-provider',
      registerRequestMiddleware: vi.fn()
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [
        {
          guard: () => false,
          factory: () => skippedProvider
        },
        {
          when: () => Promise.resolve(true),
          resolve: async () => {
            await Promise.resolve();
            return eagerProvider;
          }
        }
      ]
    });

    await sdk.whenTelemetryProvidersReady();

    expect(sdk.telemetry.providers.has('eager-provider')).toBe(true);
    expect(sdk.telemetry.providers.has('skipped-provider')).toBe(false);

    const events = [];
    const unsubscribe = sdk.onTelemetryProviderRegistered(event => {
      events.push({ id: event.provider.id, source: event.source });
    });

    expect(events.some(event => event.id === 'eager-provider' && event.source === 'existing')).toBe(true);

    await sdk.registerTelemetryProviders(
      {
        when: () => new Promise(resolve => setTimeout(() => resolve(true), 0)),
        module: async () => ({ default: lateProvider }),
        timeoutMs: 50
      },
      { source: 'runtime' }
    );

    await sdk.whenTelemetryProvidersReady();

    expect(sdk.telemetry.providers.has('late-provider')).toBe(true);
    expect(events.some(event => event.id === 'late-provider' && event.source === 'runtime')).toBe(true);

    const middleware = () => {};
    sdk.registerTelemetryRequestMiddleware(middleware);

    expect(eagerProvider.registerRequestMiddleware).toHaveBeenCalledWith(middleware);
    expect(lateProvider.registerRequestMiddleware).toHaveBeenCalledWith(middleware);

    unsubscribe();
  });
});
