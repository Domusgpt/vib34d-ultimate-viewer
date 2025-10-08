import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProductTelemetryHarness } from '../../src/product/ProductTelemetryHarness.js';
import { HttpTelemetryProvider } from '../../src/product/telemetry/HttpTelemetryProvider.js';
import { LicenseManager } from '../../src/product/licensing/LicenseManager.js';

describe('ProductTelemetryHarness', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('routes events to registered providers and clears them on flush', async () => {
    const harness = new ProductTelemetryHarness({ consoleProvider: { log: false } });

    harness.updateConsent({ analytics: true });
    harness.track('layout-generated', { variant: 'core', userId: 'abc' });
    const consoleProvider = harness.providers.get('console');

    expect(consoleProvider.events).toHaveLength(1);
    expect(consoleProvider.events[0].event).toBe('layout-generated');

    await harness.flush();
    expect(consoleProvider.events).toHaveLength(0);
  });

  it('applies data minimization policies before dispatching payloads', () => {
    const harness = new ProductTelemetryHarness({
      consoleProvider: { log: false },
      dataMinimization: { anonymize: true, omitLicense: true }
    });

    harness.attachLicense('secret-license');
    harness.updateConsent({ analytics: true });
    harness.track('gesture', { identity: 'user-1', magnitude: 0.8, userId: '123' });

    const record = harness.buffer[0];
    expect(record.licenseKey).toBeUndefined();
    expect(record.payload.identity).toBeUndefined();
    expect(record.payload.userId).toBeUndefined();
    expect(record.payload.magnitude).toBe(0.8);
  });

  it('supports swappable HTTP providers with async flush', async () => {
    const httpProvider = new HttpTelemetryProvider({ endpoint: 'https://telemetry.example/collect' });
    const harness = new ProductTelemetryHarness({
      useDefaultProvider: false,
      providers: [httpProvider],
      flushInterval: 5000,
      licenseKey: 'test-license'
    });

    harness.updateConsent({ analytics: true });
    harness.track('pattern-triggered', { id: 'focus-coach' });
    expect(httpProvider.queue).toHaveLength(1);

    await harness.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://telemetry.example/collect', expect.objectContaining({ method: 'POST' }));
    expect(httpProvider.queue).toHaveLength(0);
  });

  it('applies registered request middleware before provider flush', async () => {
    const httpProvider = new HttpTelemetryProvider({ endpoint: 'https://telemetry.example/collect' });
    const harness = new ProductTelemetryHarness({
      useDefaultProvider: false,
      providers: [httpProvider],
      flushInterval: 5000
    });

    const middleware = vi.fn(async (context) => ({
      options: {
        headers: {
          'x-signature': 'signed-value'
        }
      },
      metadata: {
        signature: {
          algorithm: 'HMAC-SHA256'
        }
      }
    }));

    harness.registerRequestMiddleware(middleware);

    harness.updateConsent({ analytics: true });
    harness.track('pattern-triggered', { id: 'focus-coach' });

    await harness.flush();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://telemetry.example/collect',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-signature': 'signed-value' })
      })
    );
    expect(middleware).toHaveBeenCalled();
  });

  it('respects disabled state by ignoring tracking and timers', () => {
    const harness = new ProductTelemetryHarness({ enabled: false, flushInterval: 2000 });
    const flushSpy = vi.spyOn(harness, 'flush');

    harness.track('ignored', {});
    harness.start();
    vi.advanceTimersByTime(6000);

    expect(harness.buffer).toHaveLength(0);
    expect(flushSpy).not.toHaveBeenCalled();
  });

  it('gates analytics events until consent is granted', () => {
    const harness = new ProductTelemetryHarness({ consoleProvider: { log: false } });

    harness.track('design.spec.activated', { variation: 'focus-a' });
    expect(harness.buffer).toHaveLength(0);

    harness.updateConsent({ analytics: true });
    harness.track('design.spec.activated', { variation: 'focus-b' });

    expect(harness.buffer).toHaveLength(1);
    expect(harness.buffer[0].classification).toBe('analytics');

    const audit = harness.getAuditTrail();
    expect(audit.find(entry => entry.event === 'privacy.consent.updated')).toBeTruthy();
    expect(audit.find(entry => entry.event === 'privacy.event.blocked')).toBeTruthy();
  });

  it('records schema issues for compliance review', () => {
    const harness = new ProductTelemetryHarness({ consoleProvider: { log: false } });

    harness.recordSchemaIssue({ type: 'eye-tracking', issues: [{ field: 'x', code: 'max' }], payload: { x: 1 } });

    expect(harness.buffer).toHaveLength(1);
    expect(harness.buffer[0].event).toBe('sensors.schema_issue');
    expect(harness.buffer[0].classification).toBe('compliance');

    const audit = harness.getAuditTrail();
    expect(audit.at(-1).event).toBe('compliance.schema.issue');
  });

  it('notifies telemetry providers when audit events are recorded', () => {
    const auditProvider = { id: 'audit-sink', recordAudit: vi.fn() };
    const harness = new ProductTelemetryHarness({
      useDefaultProvider: false,
      providers: [auditProvider]
    });

    harness.recordAudit('privacy.event.blocked', { reason: 'test' });

    expect(auditProvider.recordAudit).toHaveBeenCalledTimes(1);
    expect(auditProvider.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'privacy.event.blocked', classification: 'compliance' })
    );
  });

  it('blocks telemetry when the license is inactive', async () => {
    const licenseManager = new LicenseManager({ clock: () => new Date('2025-02-01T00:00:00Z') });
    const harness = new ProductTelemetryHarness({ licenseManager, consoleProvider: { log: false } });

    licenseManager.setLicense({ key: 'expired-license', expiresAt: '2025-01-01T00:00:00Z' });
    await licenseManager.validate();

    harness.updateConsent({ analytics: true });
    harness.track('design.spec.activated', { variation: 'focus-a' });

    expect(harness.buffer).toHaveLength(0);
    expect(harness.getAuditTrail().some(entry => entry.event === 'compliance.license.blocked')).toBe(true);
  });

  it('allows telemetry after the license validates successfully', async () => {
    const validator = vi.fn().mockResolvedValue({ valid: true });
    const licenseManager = new LicenseManager({
      validators: [validator],
      clock: () => new Date('2025-01-01T00:00:00Z')
    });
    const harness = new ProductTelemetryHarness({ licenseManager, consoleProvider: { log: false } });

    licenseManager.setLicense({ key: 'valid-license', expiresAt: '2025-12-31T00:00:00Z' });
    await licenseManager.validate();

    harness.updateConsent({ analytics: true });
    harness.track('design.spec.activated', { variation: 'focus-b' });

    expect(harness.buffer).toHaveLength(1);
    expect(validator).toHaveBeenCalled();
  });

  it('records audit events from license attestors', () => {
    const events = [];
    const attestor = {
      on: vi.fn((event, handler) => {
        events.push(event);
        if (event === 'attestation') {
          handler({ event: 'attestation', status: 'ok' });
        }
        if (event === 'error') {
          handler({ error: new Error('failure') });
        }
        return () => {};
      })
    };

    const harness = new ProductTelemetryHarness({ consoleProvider: { log: false } });
    harness.setLicenseAttestor(attestor);

    const auditEvents = harness.getAuditTrail().map(entry => entry.event);
    expect(events).toContain('attestation');
    expect(auditEvents).toContain('compliance.license.attestation');
    expect(auditEvents).toContain('compliance.license.attestor_error');
  });

  it('registers license attestation profile packs during bootstrap', () => {
    const harness = new ProductTelemetryHarness({
      consoleProvider: { log: false },
      licenseAttestationProfilePackId: 'enterprise-saas',
      licenseAttestationProfilePackOptions: {
        regions: ['global', 'apac'],
        baseUrl: 'https://attest.example.com/licenses'
      }
    });

    const profiles = harness.getLicenseAttestationProfiles();
    const profileIds = profiles.map(profile => profile.id);

    expect(profileIds).toContain('enterprise-saas/global');
    expect(profileIds).toContain('enterprise-saas/apac');
    expect(harness.getLicenseAttestationProfile('enterprise-saas/global')).toBeTruthy();

    const auditEvents = harness.getAuditTrail().map(entry => entry.event);
    expect(auditEvents).toContain('system.license.attestation_profile_pack_registered');
    expect(harness.licenseAttestationProfiles.getDefaultProfileId()).toBe('enterprise-saas/global');
  });

  it('supports manual registration of profile packs with opt-out defaulting', () => {
    const harness = new ProductTelemetryHarness({ consoleProvider: { log: false } });

    const result = harness.registerLicenseAttestationProfilePack('studio-collab', {
      collaborationId: 'aurora',
      applyDefault: false,
      regions: ['global']
    });

    expect(result.profileIds).toHaveLength(1);
    expect(result.profileIds[0]).toContain('studio-collab/aurora');
    expect(harness.licenseAttestationProfiles.getDefaultProfileId()).toBeNull();
  });

  it('applies license attestation profiles and records audit events', () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ valid: true });
      }
    }));

    const harness = new ProductTelemetryHarness({
      consoleProvider: { log: false },
      licenseAttestationProfiles: [
        {
          id: 'wearables-enterprise',
          attestor: {
            attestationUrl: 'https://licensing.example/attest',
            fetch: fetchMock,
            pollIntervalMs: 120000
          },
          binding: {
            attestorOptions: { immediate: true }
          },
          sla: { failOpen: true, responseTargetMs: 8000 }
        }
      ],
      defaultLicenseAttestationProfileId: 'wearables-enterprise'
    });

    const profileResult = harness.setLicenseAttestorFromProfile('wearables-enterprise', {
      attestorOptions: { pollIntervalMs: 60000 },
      binding: { attestorOptions: { immediate: false } },
      metadata: { market: 'apac' }
    });

    expect(profileResult.binding.attestorOptions).toEqual({ immediate: false });
    expect(profileResult.profile.metadata).toEqual({ market: 'apac' });
    expect(harness.licenseAttestor).toBe(profileResult.attestor);

    const auditEvents = harness.getAuditTrail().map(entry => entry.event);
    expect(auditEvents).toContain('system.license.attestation_profile_registered');
    expect(auditEvents).toContain('system.license.attestation_profile_applied');
  });

  it('provides license attestation analytics summaries', () => {
    const harness = new ProductTelemetryHarness({ consoleProvider: { log: false } });
    const result = harness.registerLicenseAttestationProfilePack('enterprise-saas', {
      regions: ['global'],
      applyDefault: true
    });

    harness.recordAudit('compliance.license.attestation', {
      profileId: result.defaultProfileId,
      attestation: { valid: true }
    });

    const summary = harness.getLicenseAttestationAnalyticsSummary();
    expect(summary.totalPacks).toBe(1);
    expect(summary.overall.attestations).toBe(1);
    expect(summary.packs[0].profiles[0].counts.attestations).toBe(1);
  });

  it('exports scoped license analytics reports', () => {
    const harness = new ProductTelemetryHarness({ consoleProvider: { log: false } });
    const pack = harness.registerLicenseAttestationProfilePack('studio-collab', {
      regions: ['global'],
      applyDefault: true
    });

    harness.recordAudit('compliance.license.validation', {
      profileId: pack.defaultProfileId,
      result: { attestation: { valid: true } }
    });
    harness.recordAudit('compliance.license.attestor_error', {
      profileId: pack.defaultProfileId,
      error: new Error('timeout'),
      type: 'validation'
    });

    const report = harness.getLicenseAttestationAnalyticsReport({ packId: pack.id });
    expect(report.scope.packId).toBe(pack.id);
    expect(report.totals.validations).toBe(1);
    expect(report.history.length).toBe(2);

    const json = harness.exportLicenseAttestationAnalyticsReport({ packId: pack.id });
    const parsed = JSON.parse(json);
    expect(parsed.totals.errors).toBe(1);

    const objectReport = harness.exportLicenseAttestationAnalyticsReport({
      packId: pack.id,
      format: 'object',
      includeHistory: false
    });
    expect(objectReport.history.length).toBe(0);
  });

  it('enriches attestor events with active profile context', () => {
    const attestor = {
      on: vi.fn((event, handler) => {
        if (event === 'attestation') {
          handler({ attestation: { valid: true } });
        }
        return () => {};
      })
    };

    const harness = new ProductTelemetryHarness({ consoleProvider: { log: false } });
    harness.registerLicenseAttestationProfile({
      id: 'demo-profile',
      name: 'Demo Profile',
      createAttestor: () => attestor,
      binding: { bindToLicenseManager: false }
    });

    harness.setLicenseAttestorFromProfile('demo-profile');

    const attestationEntry = harness.getAuditTrail().find(
      entry => entry.event === 'compliance.license.attestation'
    );
    expect(attestationEntry?.payload?.profileId).toBe('demo-profile');
    expect(attestationEntry?.payload?.profileName).toBe('Demo Profile');
  });
});
