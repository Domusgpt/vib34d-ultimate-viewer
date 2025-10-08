import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createConsentPanel } from '../../src/ui/components/ConsentPanel.js';

describe('createConsentPanel', () => {
  let container;
  let consent;
  let records;
  let audit;

  beforeEach(() => {
    document.body.innerHTML = '<section id="panel" class="panel"></section>';
    container = document.getElementById('panel');
    consent = { system: true, analytics: false };
    records = [
      {
        event: 'privacy.consent.updated',
        classification: 'compliance',
        timestamp: '2025-01-01T00:00:00.000Z',
        source: 'ui'
      }
    ];
    audit = [
      { event: 'privacy.consent.updated', classification: 'compliance', timestamp: '2025-01-01T00:00:00.000Z' }
    ];
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders consent controls and updates status on decisions', () => {
    const onConsentToggle = vi.fn((classification, enabled) => {
      consent[classification] = enabled;
    });

    const panel = createConsentPanel({
      container,
      consentOptions: [
        { classification: 'system', title: 'System Diagnostics', description: 'Required' },
        { classification: 'analytics', title: 'Analytics', description: 'Optional' }
      ],
      getTelemetryConsent: () => consent,
      getComplianceRecords: () => records,
      getTelemetryAuditTrail: () => audit,
      refreshInterval: 0,
      onConsentToggle,
      trackConsentToggle: vi.fn()
    });

    panel.mount();

    const inputs = container.querySelectorAll('.consent-toggle input');
    expect(inputs).toHaveLength(2);
    expect(inputs[0].checked).toBe(true);
    expect(inputs[1].checked).toBe(false);

    const status = container.querySelector('.consent-status').innerHTML;
    expect(status.toLowerCase()).toContain('audit entries');

    panel.handleConsentDecision({ system: false, analytics: true }, { source: 'test-suite' });
    const updatedStatus = container.querySelector('.consent-status').innerHTML;
    expect(updatedStatus).toContain('Last change via test-suite.');

    const logItems = container.querySelectorAll('.compliance-log li');
    expect(logItems).toHaveLength(1);
    expect(logItems[0].textContent).toContain('privacy.consent.updated');

    panel.destroy();
  });

  it('invokes callbacks when toggles change and triggers downloads', () => {
    const onConsentToggle = vi.fn((classification, enabled) => {
      consent[classification] = enabled;
    });
    const trackConsentToggle = vi.fn();
    const onDownload = vi.fn();
    const createObjectURL = vi.fn(() => 'blob://test');
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    const panel = createConsentPanel({
      container,
      consentOptions: [
        { classification: 'system', title: 'System Diagnostics', description: 'Required' },
        { classification: 'analytics', title: 'Analytics', description: 'Optional' }
      ],
      getTelemetryConsent: () => consent,
      getComplianceRecords: () => records,
      getTelemetryAuditTrail: () => audit,
      refreshInterval: 0,
      onConsentToggle,
      trackConsentToggle,
      downloadFileNamePrefix: 'test-log',
      onDownload
    });

    const api = panel.mount();

    try {
      const analyticsToggle = container.querySelector('input[data-consent="analytics"]');
      analyticsToggle.checked = true;
      analyticsToggle.dispatchEvent(new Event('change'));

      expect(onConsentToggle).toHaveBeenCalledWith('analytics', true);
      expect(trackConsentToggle).toHaveBeenCalledWith('analytics', true);

      const downloadButton = container.querySelector('button.secondary');
      downloadButton.click();
      expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ records }));
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(revokeObjectURL).not.toHaveBeenCalled();
    } finally {
      api.destroy();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});
