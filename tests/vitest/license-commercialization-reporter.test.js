import { describe, expect, it, vi } from 'vitest';
import { LicenseCommercializationReporter } from '../../src/product/licensing/LicenseCommercializationReporter.js';

const baseProfile = {
    id: 'enterprise/global',
    name: 'Enterprise Global',
    description: 'Global coverage',
    metadata: { segment: 'enterprise', region: 'global' },
    sla: { responseTargetMs: 900, availability: '99.9%', breachWindowMs: 300000 }
};

describe('LicenseCommercializationReporter', () => {
    it('aggregates packs, segments, and adoption metrics', () => {
        const updates = [];
        const reporter = new LicenseCommercializationReporter({
            onUpdate: summary => updates.push(summary)
        });

        reporter.recordProfileRegistration(baseProfile, { source: 'direct' });
        reporter.recordPackRegistration({
            id: 'enterprise-saas',
            name: 'Enterprise SaaS',
            description: 'Enterprise coverage',
            metadata: { segment: 'enterprise' },
            profiles: [baseProfile],
            defaultProfileId: baseProfile.id
        }, { registeredProfileIds: [baseProfile.id], defaultProfileId: baseProfile.id, appliedDefault: true });
        reporter.recordDefaultProfileChange(baseProfile.id, { packId: 'enterprise-saas' });
        reporter.recordProfileApplied(baseProfile, {});

        const summary = reporter.getSummary();
        expect(summary.packs).toHaveLength(1);
        expect(summary.packs[0].adoptionCount).toBe(1);
        expect(summary.segments.enterprise.profileCount).toBe(1);
        expect(summary.segments.enterprise.adoptionCount).toBe(1);
        expect(summary.regions.global.profileCount).toBe(1);
        expect(summary.sla.responseTargetMs).toEqual({ min: 900, max: 900, average: 900 });
        expect(summary.defaultProfileId).toBe(baseProfile.id);
        expect(updates.length).toBeGreaterThan(0);
    });

    it('handles packs without defaults and normalizes availability values', () => {
        const reporter = new LicenseCommercializationReporter();
        const profile = {
            id: 'studio/global',
            name: 'Studio Global',
            metadata: { segment: 'studio', region: 'latam' },
            sla: { responseTargetMs: 1500, availability: 99.5, breachWindowMs: 900000 }
        };

        reporter.recordPackRegistration({
            id: 'studio-collab',
            name: 'Studio Pack',
            description: 'Studio coverage',
            profiles: [profile],
            defaultProfileId: null
        }, { registeredProfileIds: [profile.id], defaultProfileId: null, appliedDefault: false });
        reporter.recordProfileRegistration(profile, { packId: 'studio-collab' });

        const summary = reporter.getSummary();
        expect(summary.packs[0].appliedDefault).toBe(false);
        expect(summary.segments.studio.profileCount).toBe(1);
        expect(summary.regions.latam.profileCount).toBe(1);
        expect(summary.sla.availabilityPercent).toEqual({ min: 99.5, max: 99.5, average: 99.5 });
    });

    it('supports multiple update listeners and removal', () => {
        const reporter = new LicenseCommercializationReporter();
        const listenerA = vi.fn();
        const listenerB = vi.fn();

        const unsubscribe = reporter.addUpdateListener(listenerA);
        reporter.addUpdateListener(listenerB);

        reporter.recordProfileRegistration(baseProfile);
        expect(listenerA).toHaveBeenCalled();
        expect(listenerB).toHaveBeenCalled();

        listenerA.mockClear();
        listenerB.mockClear();
        unsubscribe();

        reporter.recordProfileApplied(baseProfile);
        expect(listenerA).not.toHaveBeenCalled();
        expect(listenerB).toHaveBeenCalled();
    });
});
