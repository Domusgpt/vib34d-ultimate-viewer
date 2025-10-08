import { RemoteLicenseAttestor } from '../RemoteLicenseAttestor.js';

const HOURS = 60 * 60 * 1000;
const MINUTES = 60 * 1000;

export const DEFAULT_LICENSE_ATTESTATION_PROFILE_ID = 'enterprise-edge-2025';

export const DEFAULT_LICENSE_ATTESTATION_PROFILES = [
    {
        id: 'enterprise-edge-2025',
        name: 'Enterprise Edge Wearables',
        description: 'Enterprise-grade wearable deployments with strict compliance requirements and hourly attestations.',
        attestor: {
            attestationUrl: 'https://licenses.vib34d.com/enterprise/attest',
            revocationUrl: 'https://licenses.vib34d.com/enterprise/revocation',
            entitlementsUrl: 'https://licenses.vib34d.com/enterprise/entitlements',
            headers: {
                'x-license-segment': 'enterprise-edge',
                'x-license-sla': 'gold'
            },
            pollIntervalMs: 1 * HOURS,
            minimumPollIntervalMs: 15 * MINUTES,
            failOpen: false,
            historyLimit: 100
        },
        binding: {
            attestorOptions: {
                pollIntervalMs: 45 * MINUTES,
                minimumPollIntervalMs: 10 * MINUTES
            }
        },
        sla: {
            failOpen: false,
            responseTargetMs: 1800,
            retryPolicy: '3 attempts with exponential backoff (5s, 15s, 45s)',
            availability: '99.9%',
            notes: 'Designed for regulated enterprise fleets with regional edge clusters.'
        },
        metadata: {
            segment: 'enterprise',
            compliance: ['gdpr', 'hipaa', 'iso-27001'],
            supportTier: 'gold'
        }
    },
    {
        id: 'regulated-health-2025',
        name: 'Regulated Health Devices',
        description: 'Healthcare-focused deployments requiring rapid revocation handling and regional residency guarantees.',
        attestor: ({ attestorOptions } = {}) => new RemoteLicenseAttestor({
            attestationUrl: 'https://licenses.vib34d.com/health/attest',
            revocationUrl: 'https://licenses.vib34d.com/health/revocation',
            entitlementsUrl: 'https://licenses.vib34d.com/health/entitlements',
            headers: {
                'x-license-segment': 'regulated-health',
                'x-license-sla': 'platinum'
            },
            pollIntervalMs: 30 * MINUTES,
            minimumPollIntervalMs: 5 * MINUTES,
            failOpen: false,
            transformRequest: ({ payload }) => ({
                headers: {
                    'x-data-residency': 'eu'
                },
                payload: {
                    ...payload,
                    context: {
                        ...payload.context,
                        region: 'eu-central'
                    }
                }
            }),
            ...attestorOptions
        }),
        createAttestor({ attestorOptions, overrides }) {
            const options = {
                ...(attestorOptions || {}),
                ...(overrides?.attestorOptions || {})
            };
            return this.attestor({ attestorOptions: options });
        },
        binding: {
            bindToLicenseManager: true,
            attestorOptions: {
                pollIntervalMs: 20 * MINUTES
            }
        },
        sla: {
            failOpen: false,
            responseTargetMs: 1200,
            retryPolicy: 'Immediate retry twice, then escalate to manual review',
            availability: '99.95%',
            notes: 'Meets EU MDR and FDA Class II auditability thresholds.'
        },
        metadata: {
            segment: 'healthcare',
            residency: 'eu',
            compliance: ['gdpr', 'mdd', 'fda-820'],
            supportTier: 'platinum'
        }
    },
    {
        id: 'indie-creator-2025',
        name: 'Independent Creator Program',
        description: 'Flexible attestation with generous fail-open behaviour for early-stage wearable creators.',
        attestor: {
            attestationUrl: 'https://licenses.vib34d.com/creators/attest',
            revocationUrl: 'https://licenses.vib34d.com/creators/revocation',
            entitlementsUrl: 'https://licenses.vib34d.com/creators/entitlements',
            headers: {
                'x-license-segment': 'indie-creator',
                'x-license-sla': 'silver'
            },
            pollIntervalMs: 6 * HOURS,
            minimumPollIntervalMs: 60 * MINUTES,
            failOpen: true,
            historyLimit: 50
        },
        binding: {
            attestorOptions: {
                pollIntervalMs: 3 * HOURS,
                failOpen: true
            }
        },
        sla: {
            failOpen: true,
            responseTargetMs: 5000,
            retryPolicy: 'Queued retry every 15 minutes up to 4 hours',
            availability: '99.0%',
            notes: 'Optimised for experimentation with relaxed revocation enforcement.'
        },
        metadata: {
            segment: 'creator',
            compliance: ['gdpr'],
            supportTier: 'silver'
        }
    }
];

export function resolveDefaultProfiles(profileIds) {
    if (Array.isArray(profileIds) && profileIds.length > 0) {
        const set = new Set(profileIds);
        return DEFAULT_LICENSE_ATTESTATION_PROFILES.filter(profile => set.has(profile.id));
    }
    return DEFAULT_LICENSE_ATTESTATION_PROFILES;
}

export function registerDefaultLicenseAttestationProfiles(
    registry,
    { profileIds, setDefault = true, defaultProfileId = DEFAULT_LICENSE_ATTESTATION_PROFILE_ID, overrideExisting = true } = {}
) {
    if (!registry || typeof registry.registerProfile !== 'function') {
        throw new Error('registerDefaultLicenseAttestationProfiles requires a LicenseAttestationProfileRegistry instance.');
    }

    const results = [];
    const profiles = resolveDefaultProfiles(profileIds);
    for (const profile of profiles) {
        if (overrideExisting === false && typeof registry.hasProfile === 'function' && registry.hasProfile(profile.id)) {
            continue;
        }
        results.push(registry.registerProfile(profile));
    }

    const hasProfile =
        typeof registry.hasProfile === 'function'
            ? id => registry.hasProfile(id)
            : id => Boolean(registry.getProfile?.(id));

    if (setDefault && typeof registry.getDefaultProfileId === 'function' && !registry.getDefaultProfileId()) {
        if (hasProfile(defaultProfileId)) {
            registry.setDefaultProfile(defaultProfileId);
        }
    }

    return results;
}
