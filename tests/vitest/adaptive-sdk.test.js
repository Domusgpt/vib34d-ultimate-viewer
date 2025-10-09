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

  it('runs layout blueprint scenarios and exposes scenario history', () => {
    const sdk = createAdaptiveSDK({
      blueprintInsights: { historyLimit: 8, scenarioHistoryLimit: 3 },
      blueprintScenarios: { maxSteps: 4 }
    });

    const scenario = sdk.generateLayoutBlueprintScenario({
      layout: {
        intensity: 0.64,
        motion: { velocity: 0.38, bias: { x: 0.12, y: -0.08, z: 0.06 }, easing: 'ease-in-out' },
        zones: [
          { id: 'primary', occupancy: 0.7, layeringDepth: 0.2, visibility: 0.88 },
          { id: 'peripheral', occupancy: 0.42, layeringDepth: 0.48, visibility: 0.64 }
        ]
      },
      design: {
        pattern: { id: 'sdk-blueprint', name: 'SDK Blueprint' },
        monetization: { tier: 'studio' }
      },
      contextDefaults: {
        focusVector: { x: 0.5, y: 0.45, depth: 0.36 },
        engagementLevel: 0.6,
        biometricStress: 0.3
      },
      steps: [
        {
          id: 'baseline',
          context: { dwellMs: 1000, biometricStress: 0.28 }
        },
        {
          id: 'alert',
          context: { dwellMs: 1200, biometricStress: 0.72, focusVector: { x: 0.62, y: 0.38, depth: 0.2 } }
        }
      ]
    });

    expect(scenario.steps.length).toBeGreaterThan(0);
    expect(sdk.getLayoutBlueprintScenarioHistory().length).toBeGreaterThan(0);

    sdk.clearLayoutBlueprintScenarioHistory();
    expect(sdk.getLayoutBlueprintScenarioHistory()).toHaveLength(0);
  });

  it('calibrates layout blueprints and syncs calibration history', () => {
    const sdk = createAdaptiveSDK({
      blueprintInsights: { historyLimit: 5, calibrationHistoryLimit: 4 },
      blueprintCalibration: {}
    });

    const snapshot = sdk.generateLayoutBlueprintSnapshot({
      layout: {
        intensity: 0.4,
        motion: { velocity: 0.7, bias: { x: 0.38, y: 0.24, z: 0.12 } },
        zones: [
          { id: 'primary', occupancy: 0.9, layeringDepth: 0.2 },
          { id: 'peripheral', occupancy: 0.28, layeringDepth: 0.4 },
          { id: 'ambient', occupancy: 0.16, layeringDepth: 0.55 }
        ]
      },
      context: {
        focusVector: { x: 0.62, y: 0.42, depth: 0.87 },
        engagementLevel: 0.32,
        biometricStress: 0.76
      },
      design: { pattern: 'sdk-test-pattern' },
      storeHistory: false
    });

    const calibration = sdk.calibrateLayoutBlueprint({
      blueprint: snapshot.blueprint,
      insights: snapshot.insights?.analytics
    });

    expect(calibration?.calibrations.length).toBeGreaterThan(0);
    expect(sdk.getLayoutBlueprintCalibrationHistory().length).toBeGreaterThan(0);

    sdk.clearLayoutBlueprintCalibrationHistory();
    expect(sdk.getLayoutBlueprintCalibrationHistory()).toHaveLength(0);
  });

  it('runs blueprint evolution and exposes evolution history', () => {
    const sdk = createAdaptiveSDK({
      blueprintInsights: { historyLimit: 6, evolutionHistoryLimit: 3 },
      blueprintEvolution: {}
    });

    const snapshot = sdk.generateLayoutBlueprintSnapshot({
      layout: {
        intensity: 0.46,
        motion: { velocity: 0.68, bias: { x: 0.32, y: 0.18, z: 0.08 } },
        zones: [
          { id: 'primary', occupancy: 0.92, layeringDepth: 0.18 },
          { id: 'peripheral', occupancy: 0.24, layeringDepth: 0.46 },
          { id: 'ambient', occupancy: 0.16, layeringDepth: 0.58 }
        ]
      },
      context: {
        focusVector: { x: 0.58, y: 0.44, depth: 0.64 },
        engagementLevel: 0.36,
        biometricStress: 0.71
      },
      design: { pattern: 'sdk-evo-pattern' },
      storeHistory: false
    });

    const result = sdk.runLayoutBlueprintEvolution({ blueprint: snapshot.blueprint });
    expect(result?.variants.length).toBeGreaterThan(0);
    expect(sdk.getLayoutBlueprintEvolutionHistory().length).toBeGreaterThan(0);

    sdk.clearLayoutBlueprintEvolutionHistory();
    expect(sdk.getLayoutBlueprintEvolutionHistory()).toHaveLength(0);
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
});
