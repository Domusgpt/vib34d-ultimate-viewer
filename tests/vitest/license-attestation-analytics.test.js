import { describe, it, expect } from 'vitest';
import { LicenseAttestationAnalytics } from '../../src/product/licensing/LicenseAttestationAnalytics.js';

function createAuditEntry(event, payload = {}, timestamp = '2025-10-21T00:00:00.000Z') {
  return { event, payload, classification: 'compliance', timestamp };
}

describe('LicenseAttestationAnalytics', () => {
  it('registers packs and profiles with metadata', () => {
    const analytics = new LicenseAttestationAnalytics();
    analytics.registerPack({
      id: 'enterprise-saas',
      name: 'Enterprise SaaS',
      description: 'Enterprise endpoints',
      metadata: { region: 'global' },
      defaultProfileId: 'enterprise-saas/global'
    });

    analytics.registerProfile(
      {
        id: 'enterprise-saas/global',
        name: 'Global',
        description: 'Global attestation',
        sla: { availability: '99.9%' },
        metadata: { segment: 'enterprise' }
      },
      { packId: 'enterprise-saas', isDefault: true }
    );

    const summary = analytics.getSummary();
    expect(summary.totalPacks).toBe(1);
    expect(summary.totalProfiles).toBe(1);
    expect(summary.defaultProfileId).toBe('enterprise-saas/global');
    expect(summary.packs[0].profiles[0].metadata?.segment).toBe('enterprise');
  });

  it('increments counters and history from audit entries', () => {
    const analytics = new LicenseAttestationAnalytics();
    analytics.registerProfile({ id: 'studio/global', name: 'Studio Global' });

    analytics.recordAuditEntry(
      createAuditEntry('compliance.license.attestation', {
        profileId: 'studio/global',
        attestation: { valid: true, attestedAt: '2025-10-21T00:01:00Z' }
      })
    );
    analytics.recordAuditEntry(
      createAuditEntry('compliance.license.validation', {
        profileId: 'studio/global',
        result: { attestation: { valid: true }, entitlements: { entitlements: ['ui', 'telemetry'] } }
      }, '2025-10-21T00:02:00Z')
    );
    analytics.recordAuditEntry(
      createAuditEntry('system.license.attestation_scheduled', {
        profileId: 'studio/global',
        delayMs: 600000,
        context: { trigger: 'remote-attestor' }
      }, '2025-10-21T00:03:00Z')
    );

    const summary = analytics.getSummary();
    const profile = summary.standaloneProfiles[0];
    expect(profile.counts.attestations).toBe(1);
    expect(profile.counts.validations).toBe(1);
    expect(profile.counts.schedules).toBe(1);
    expect(summary.overall.attestations).toBe(1);
    expect(summary.recentHistory.length).toBe(3);
    expect(summary.recentHistory[0].event).toBe('compliance.license.attestation');
  });

  it('generates scoped reports with derived metrics and export helpers', () => {
    const analytics = new LicenseAttestationAnalytics({ historyLimit: 10 });
    analytics.registerPack({ id: 'enterprise', name: 'Enterprise Pack' });
    analytics.registerProfile(
      { id: 'enterprise/global', name: 'Enterprise Global' },
      { packId: 'enterprise', isDefault: true }
    );

    analytics.recordAuditEntry(
      createAuditEntry('compliance.license.validation', {
        profileId: 'enterprise/global',
        result: { attestation: { valid: true } }
      })
    );
    analytics.recordAuditEntry(
      createAuditEntry('compliance.license.attestor_error', {
        profileId: 'enterprise/global',
        error: new Error('network'),
        type: 'validation'
      })
    );

    const report = analytics.generateReport({ packId: 'enterprise' });
    expect(report.scope.packId).toBe('enterprise');
    expect(report.totals.validations).toBe(1);
    expect(report.history.length).toBe(2);
    expect(report.derivedMetrics.successRate).toBeCloseTo(0.5, 3);
    expect(report.derivedMetrics.errorRate).toBeCloseTo(0.5, 3);

    const json = analytics.exportReport({ packId: 'enterprise' });
    const parsed = JSON.parse(json);
    expect(parsed.scope.packId).toBe('enterprise');

    const objectReport = analytics.exportReport({
      packId: 'enterprise',
      format: 'object',
      includeHistory: false
    });
    expect(objectReport.history.length).toBe(0);
  });
});
