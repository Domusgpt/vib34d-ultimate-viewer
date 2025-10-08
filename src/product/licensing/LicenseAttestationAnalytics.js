const DEFAULT_HISTORY_LIMIT = 50;

function normalizeRatio(numerator, denominator) {
    if (!denominator) return null;
    const value = numerator / denominator;
    if (!Number.isFinite(value)) {
        return null;
    }
    return Math.round(value * 1000) / 1000;
}

function createCounters() {
    return {
        attestations: 0,
        validations: 0,
        revocations: 0,
        entitlements: 0,
        schedules: 0,
        errors: 0
    };
}

function cloneMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
        return metadata ?? null;
    }
    return { ...metadata };
}

function toSummaryTimestamp(value) {
    if (!value) return null;
    try {
        return new Date(value).toISOString();
    } catch (error) {
        return null;
    }
}

function summarizeAttestationPayload(event, payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    if (event === 'compliance.license.attestation' && payload.attestation) {
        const { attestation } = payload;
        return {
            status: attestation.valid === false ? 'invalid' : 'valid',
            reason: attestation.reason || null,
            attestedAt: attestation.attestedAt || null,
            nextCheckInMs: typeof attestation.nextCheckInMs === 'number' ? attestation.nextCheckInMs : null,
            nextCheckAt: attestation.nextCheckAt || null
        };
    }

    if (event === 'compliance.license.validation' && payload.result) {
        return {
            status: payload.result?.attestation?.valid === false ? 'invalid' : 'valid',
            reason: payload.result?.attestation?.reason || null,
            revocation: payload.result?.revocation?.revoked === true ? 'revoked' : 'active',
            entitlements: Array.isArray(payload.result?.entitlements?.entitlements)
                ? payload.result.entitlements.entitlements.length
                : 0
        };
    }

    if (event === 'compliance.license.revocation' && payload.revocation) {
        return {
            revoked: payload.revocation.revoked === true,
            reason: payload.revocation.reason || null,
            checkedAt: payload.revocation.checkedAt || null
        };
    }

    if (event === 'compliance.license.entitlements' && payload.entitlements) {
        return {
            count: Array.isArray(payload.entitlements.entitlements)
                ? payload.entitlements.entitlements.length
                : 0,
            updatedAt: payload.entitlements.updatedAt || null,
            ttlMs: typeof payload.entitlements.ttlMs === 'number' ? payload.entitlements.ttlMs : null
        };
    }

    if (event === 'compliance.license.attestor_error' && payload.error) {
        return {
            type: payload.type || null,
            message: payload.error?.message || payload.error || null
        };
    }

    if (event === 'system.license.attestation_scheduled') {
        return {
            delayMs: typeof payload.delayMs === 'number' ? payload.delayMs : null,
            trigger: payload.context?.trigger || null
        };
    }

    return null;
}

function calculateDerivedMetrics(counts = {}) {
    const attestations = counts.attestations || 0;
    const validations = counts.validations || 0;
    const revocations = counts.revocations || 0;
    const entitlements = counts.entitlements || 0;
    const errors = counts.errors || 0;
    const schedules = counts.schedules || 0;

    const attempts = validations + errors;
    const totalSignals = attestations + validations + revocations + entitlements + errors + schedules;

    return {
        successRate: normalizeRatio(validations, attempts) || 0,
        errorRate: normalizeRatio(errors, attempts) || 0,
        attestationCoverage: normalizeRatio(attestations, validations) || 0,
        revocationRate: normalizeRatio(revocations, validations) || 0,
        entitlementRefreshRate: normalizeRatio(entitlements, validations) || 0,
        scheduleRate: normalizeRatio(schedules, validations) || 0,
        totalSignals
    };
}

export class LicenseAttestationAnalytics {
    constructor(options = {}) {
        this.historyLimit = typeof options.historyLimit === 'number' ? options.historyLimit : DEFAULT_HISTORY_LIMIT;
        this.history = [];
        this.packs = new Map();
        this.profileSummaries = new Map();
        this.profileToPack = new Map();
        this.defaultProfileId = null;
        this.activeProfileId = null;
        this.activePackId = null;
        this.lastEventAt = null;
        this.overallCounters = createCounters();
    }

    reset() {
        this.history = [];
        this.packs.clear();
        this.profileSummaries.clear();
        this.profileToPack.clear();
        this.defaultProfileId = null;
        this.activeProfileId = null;
        this.activePackId = null;
        this.lastEventAt = null;
        this.overallCounters = createCounters();
    }

    registerPack(pack) {
        if (!pack || typeof pack.id !== 'string') {
            return null;
        }

        const existing = this.packs.get(pack.id) || {
            id: pack.id,
            name: pack.name || pack.id,
            description: pack.description || '',
            metadata: cloneMetadata(pack.metadata) || null,
            totals: createCounters(),
            lastEventAt: null,
            profiles: new Map(),
            defaultProfileId: null
        };

        existing.name = pack.name || existing.name;
        existing.description = typeof pack.description === 'string' ? pack.description : existing.description;
        existing.metadata = pack.metadata ? cloneMetadata(pack.metadata) : existing.metadata;
        existing.defaultProfileId = pack.defaultProfileId || existing.defaultProfileId || null;

        this.packs.set(pack.id, existing);

        if (existing.defaultProfileId && !this.defaultProfileId) {
            this.defaultProfileId = existing.defaultProfileId;
        }

        return existing;
    }

    registerProfile(profile, context = {}) {
        if (!profile || typeof profile.id !== 'string') {
            return null;
        }

        const summary = this.ensureProfileSummary(profile.id);
        summary.profile = {
            id: profile.id,
            name: profile.name || profile.id,
            description: profile.description || '',
            sla: profile.sla ? { ...profile.sla } : null,
            metadata: cloneMetadata(profile.metadata)
        };

        const packId = context.packId || profile.metadata?.packId || this.profileToPack.get(profile.id) || null;
        if (packId) {
            const pack = this.registerPack({
                id: packId,
                name: context.packName,
                description: context.packDescription,
                metadata: context.packMetadata,
                defaultProfileId: context.isDefault ? profile.id : undefined
            });
            summary.packId = pack.id;
            this.profileToPack.set(profile.id, pack.id);
            pack.profiles.set(profile.id, summary);
        } else {
            summary.packId = null;
            this.profileToPack.delete(profile.id);
        }

        return summary;
    }

    setPackDefault(packId, profileId) {
        if (!packId) return;
        const pack = this.packs.get(packId);
        if (pack) {
            pack.defaultProfileId = profileId || null;
        }
        if (profileId) {
            this.defaultProfileId = profileId;
        }
    }

    setDefaultProfile(profileId) {
        this.defaultProfileId = profileId || null;
        if (profileId) {
            const packId = this.profileToPack.get(profileId);
            if (packId) {
                this.setPackDefault(packId, profileId);
            }
        }
    }

    setActiveProfile(profileId) {
        this.activeProfileId = profileId || null;
        this.activePackId = profileId ? (this.profileToPack.get(profileId) || null) : null;
    }

    getPackIdForProfile(profileId) {
        if (!profileId) return null;
        return this.profileToPack.get(profileId) || null;
    }

    getPack(packId) {
        if (!packId) return null;
        return this.packs.get(packId) || null;
    }

    getProfileSummary(profileId) {
        if (!profileId) return null;
        return this.profileSummaries.get(profileId) || null;
    }

    recordAuditEntry(entry) {
        if (!entry || typeof entry.event !== 'string') {
            return;
        }

        const payload = entry.payload || {};
        const event = entry.event;

        if (event === 'system.license.attestation_profile_pack_registered') {
            if (payload.packId) {
                this.registerPack({
                    id: payload.packId,
                    metadata: payload.metadata,
                    defaultProfileId: payload.defaultProfileId
                });
            }
            return;
        }

        if (event === 'system.license.attestation_profile_registered') {
            if (payload.profileId) {
                const summary = this.ensureProfileSummary(payload.profileId);
                if (payload.sla) {
                    summary.profile.sla = { ...payload.sla };
                }
            }
            return;
        }

        if (event === 'system.license.attestation_profile_default') {
            this.setDefaultProfile(payload.profileId || null);
            return;
        }

        if (event === 'system.license.attestation_profile_applied') {
            const profileId = payload.profileId || null;
            if (profileId) {
                this.setActiveProfile(profileId);
            } else {
                this.setActiveProfile(null);
            }
            return;
        }

        const isLicenseEvent = event.startsWith('compliance.license.') || event === 'system.license.attestation_scheduled';
        if (!isLicenseEvent) {
            return;
        }

        const profileId = payload.profileId || payload.profile?.id || this.activeProfileId || null;
        const summary = profileId ? this.ensureProfileSummary(profileId) : null;
        const timestamp = entry.timestamp || new Date().toISOString();

        if (summary && payload.packId && !summary.packId) {
            this.registerProfile({ id: profileId, ...summary.profile }, { packId: payload.packId });
        }

        switch (event) {
            case 'compliance.license.attestation':
                this.incrementCounters('attestations', summary, timestamp, event, payload);
                break;
            case 'compliance.license.validation':
                this.incrementCounters('validations', summary, timestamp, event, payload);
                break;
            case 'compliance.license.revocation':
                this.incrementCounters('revocations', summary, timestamp, event, payload);
                break;
            case 'compliance.license.entitlements':
                this.incrementCounters('entitlements', summary, timestamp, event, payload);
                break;
            case 'compliance.license.attestor_error':
                this.incrementCounters('errors', summary, timestamp, event, payload);
                break;
            case 'system.license.attestation_scheduled':
                this.incrementCounters('schedules', summary, timestamp, event, payload);
                break;
            default:
                break;
        }

        this.pushHistory({
            event,
            timestamp: toSummaryTimestamp(timestamp),
            profileId: summary ? summary.profile.id : null,
            packId: summary ? summary.packId : null,
            details: summarizeAttestationPayload(event, payload)
        });

        this.lastEventAt = toSummaryTimestamp(timestamp) || this.lastEventAt;
    }

    incrementCounters(counterKey, summary, timestamp, event, payload) {
        if (!this.overallCounters[counterKey]) {
            this.overallCounters[counterKey] = 0;
        }
        this.overallCounters[counterKey] += 1;

        if (summary) {
            if (!summary.counts[counterKey]) {
                summary.counts[counterKey] = 0;
            }
            summary.counts[counterKey] += 1;
            summary.lastEvents[counterKey] = {
                timestamp: toSummaryTimestamp(timestamp),
                details: summarizeAttestationPayload(event, payload)
            };
            summary.lastEventAt = toSummaryTimestamp(timestamp) || summary.lastEventAt;

            if (summary.packId && this.packs.has(summary.packId)) {
                const pack = this.packs.get(summary.packId);
                if (!pack.totals[counterKey]) {
                    pack.totals[counterKey] = 0;
                }
                pack.totals[counterKey] += 1;
                pack.lastEventAt = toSummaryTimestamp(timestamp) || pack.lastEventAt;
            }
        }
    }

    pushHistory(entry) {
        if (!entry) return;
        this.history.push(entry);
        if (this.history.length > this.historyLimit) {
            this.history.shift();
        }
    }

    ensureProfileSummary(profileId) {
        if (!this.profileSummaries.has(profileId)) {
            this.profileSummaries.set(profileId, {
                profile: {
                    id: profileId,
                    name: profileId,
                    description: '',
                    sla: null,
                    metadata: null
                },
                packId: this.profileToPack.get(profileId) || null,
                counts: createCounters(),
                lastEvents: {},
                lastEventAt: null
            });
        }
        return this.profileSummaries.get(profileId);
    }

    serializeProfileSummary(summary) {
        if (!summary) return null;
        return {
            id: summary.profile.id,
            name: summary.profile.name,
            description: summary.profile.description,
            metadata: summary.profile.metadata || null,
            sla: summary.profile.sla || null,
            packId: summary.packId || null,
            counts: { ...summary.counts },
            lastEvents: Object.fromEntries(Object.entries(summary.lastEvents).map(([key, value]) => [key, {
                timestamp: value?.timestamp || null,
                details: value?.details || null
            }])),
            lastEventAt: summary.lastEventAt || null
        };
    }

    serializePack(pack) {
        if (!pack) return null;
        return {
            id: pack.id,
            name: pack.name,
            description: pack.description,
            metadata: pack.metadata || null,
            totals: { ...pack.totals },
            lastEventAt: pack.lastEventAt || null,
            defaultProfileId: pack.defaultProfileId || null,
            profiles: Array.from(pack.profiles.values()).map(summary => this.serializeProfileSummary(summary))
        };
    }

    getSummary() {
        const packs = Array.from(this.packs.values()).map(pack => this.serializePack(pack));
        const standaloneProfiles = Array.from(this.profileSummaries.values())
            .filter(summary => !summary.packId)
            .map(summary => this.serializeProfileSummary(summary));

        return {
            totalPacks: this.packs.size,
            totalProfiles: this.profileSummaries.size,
            defaultProfileId: this.defaultProfileId,
            activeProfileId: this.activeProfileId,
            activePackId: this.activePackId,
            lastEventAt: this.lastEventAt,
            overall: { ...this.overallCounters },
            packs,
            standaloneProfiles,
            recentHistory: [...this.history]
        };
    }

    generateReport(options = {}) {
        const summary = this.getSummary();
        const { packId: requestedPackId, profileId: requestedProfileId, includeHistory = true, historyLimit } = options;

        let packId = requestedPackId || null;
        let profileId = requestedProfileId || null;

        let packSummary = null;
        let profileSummary = null;

        if (profileId) {
            profileSummary = this.serializeProfileSummary(this.profileSummaries.get(profileId));
            if (profileSummary?.packId && !packId) {
                packId = profileSummary.packId;
            }
        }

        if (packId) {
            const pack = this.packs.get(packId);
            packSummary = this.serializePack(pack);
            if (!profileSummary && profileId && packSummary) {
                profileSummary = packSummary.profiles?.find(entry => entry.id === profileId) || null;
            }
        }

        if (profileId && !profileSummary) {
            profileSummary = this.serializeProfileSummary(this.profileSummaries.get(profileId));
        }

        const focusCounts = profileSummary?.counts
            || packSummary?.totals
            || summary.overall
            || createCounters();

        const derivedMetrics = calculateDerivedMetrics(focusCounts);

        let scopedHistory = [];
        if (includeHistory) {
            scopedHistory = summary.recentHistory.filter(entry => {
                if (packId && entry.packId !== packId) return false;
                if (profileId && entry.profileId !== profileId) return false;
                return true;
            });
            if (typeof historyLimit === 'number' && historyLimit > 0) {
                scopedHistory = scopedHistory.slice(-historyLimit);
            }
        }

        return {
            generatedAt: new Date().toISOString(),
            scope: {
                packId: packSummary?.id || null,
                packName: packSummary?.name || null,
                profileId: profileSummary?.id || null,
                profileName: profileSummary?.name || null
            },
            summary: {
                totalPacks: summary.totalPacks,
                totalProfiles: summary.totalProfiles,
                defaultProfileId: summary.defaultProfileId,
                activeProfileId: summary.activeProfileId,
                activePackId: summary.activePackId,
                lastEventAt: summary.lastEventAt
            },
            totals: { ...focusCounts },
            derivedMetrics,
            pack: packSummary,
            profile: profileSummary,
            history: scopedHistory,
            overall: summary.overall
        };
    }

    exportReport(options = {}) {
        const report = this.generateReport(options);
        const format = options.format || 'json';
        if (format === 'json') {
            const space = options.pretty === false ? 0 : 2;
            return JSON.stringify(report, null, space);
        }
        if (format === 'object') {
            return report;
        }
        throw new Error(`Unsupported license analytics export format: ${format}`);
    }
}
