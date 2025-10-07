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
});
