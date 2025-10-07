import { ConsoleTelemetryProvider } from './telemetry/ConsoleTelemetryProvider.js';

const DEFAULT_CLASSIFICATION_RULES = [
    { prefix: 'adaptive.', classification: 'interaction' },
    { prefix: 'design.layout.', classification: 'analytics' },
    { prefix: 'design.spec.', classification: 'analytics' },
    { prefix: 'design.telemetry.', classification: 'system' },
    { prefix: 'sensors.adapter.', classification: 'system' },
    { prefix: 'sensors.schema', classification: 'compliance' },
    { prefix: 'compliance.', classification: 'compliance' },
    { prefix: 'privacy.', classification: 'compliance' },
    { prefix: 'biometric.', classification: 'biometric' }
];

export class ProductTelemetryHarness {
    constructor(options = {}) {
        this.enabled = options.enabled ?? true;
        this.licenseKey = options.licenseKey || null;
        this.flushInterval = options.flushInterval || 10000;
        this.flushHandle = null;
        this.buffer = [];

        this.dataMinimization = {
            omitLicense: options.dataMinimization?.omitLicense ?? false,
            allowedFields: options.dataMinimization?.allowedFields,
            anonymize: options.dataMinimization?.anonymize ?? false
        };

        this.defaultClassification = options.defaultClassification || 'analytics';
        this.classificationRules = (options.classificationRules || DEFAULT_CLASSIFICATION_RULES)
            .map(rule => this.createClassificationRule(rule))
            .filter(Boolean);

        const defaultConsent = {
            system: true,
            compliance: true,
            interaction: true,
            analytics: false,
            biometric: false,
            ...(options.defaultConsent || {})
        };

        this.consent = new Map(Object.entries(defaultConsent));
        this.auditLog = [];
        this.auditLogLimit = options.auditLogLimit || 200;
        this.onConsentDecision = typeof options.onConsentDecision === 'function' ? options.onConsentDecision : null;

        this.providers = new Map();
        if (options.useDefaultProvider !== false) {
            this.registerProvider(new ConsoleTelemetryProvider(options.consoleProvider || {}));
        }

        (options.providers || []).forEach(provider => this.registerProvider(provider));
    }

    createClassificationRule(rule) {
        if (!rule) return null;

        if (typeof rule === 'function') {
            return { test: rule, classification: this.defaultClassification };
        }

        if (rule instanceof RegExp) {
            return { test: event => rule.test(event), classification: this.defaultClassification };
        }

        if (typeof rule === 'object') {
            if (typeof rule.test === 'function') {
                return { test: rule.test, classification: rule.classification || this.defaultClassification };
            }

            if (typeof rule.prefix === 'string') {
                return { test: event => event.startsWith(rule.prefix), classification: rule.classification || this.defaultClassification };
            }

            if (rule.match instanceof RegExp) {
                return { test: event => rule.match.test(event), classification: rule.classification || this.defaultClassification };
            }
        }

        throw new Error('Invalid classification rule supplied to ProductTelemetryHarness');
    }

    registerProvider(provider) {
        this.providers.set(provider.id, provider);
    }

    removeProvider(id) {
        this.providers.delete(id);
    }

    registerClassificationRule(rule) {
        const normalized = this.createClassificationRule(rule);
        this.classificationRules.unshift(normalized);
    }

    identify(identity, traits = {}, options = {}) {
        if (!this.enabled) return;
        const classification = options.classification || 'system';
        if (!this.isConsentGranted(classification)) {
            this.recordAudit('privacy.identity.blocked', { identity, classification });
            return;
        }

        const sanitizedTraits = this.sanitizePayload(traits);
        for (const provider of this.providers.values()) {
            provider.identify?.(identity, sanitizedTraits, { classification });
        }
    }

    track(event, payload = {}, options = {}) {
        if (!this.enabled) return;
        const sanitizedPayload = this.sanitizePayload(payload);
        const classification = options.classification || this.classifyEvent(event, sanitizedPayload);

        if (!this.isConsentGranted(classification)) {
            this.recordAudit('privacy.event.blocked', { event, classification });
            return;
        }

        const record = {
            event,
            payload: sanitizedPayload,
            classification,
            licenseKey: this.dataMinimization.omitLicense ? undefined : this.licenseKey,
            timestamp: new Date().toISOString()
        };

        this.buffer.push(record);
        for (const provider of this.providers.values()) {
            provider.track?.(event, record, { classification });
        }
    }

    sanitizePayload(payload) {
        if (!payload || typeof payload !== 'object') return payload;
        const clone = { ...payload };

        if (this.dataMinimization.allowedFields) {
            const filtered = {};
            for (const key of this.dataMinimization.allowedFields) {
                if (key in clone) {
                    filtered[key] = clone[key];
                }
            }
            return filtered;
        }

        if (this.dataMinimization.anonymize) {
            delete clone.userId;
            delete clone.identity;
            delete clone.email;
        }

        return clone;
    }

    classifyEvent(event, payload) {
        for (const rule of this.classificationRules) {
            try {
                if (rule.test(event, payload)) {
                    return rule.classification;
                }
            } catch (error) {
                this.recordAudit('privacy.classification.error', { event, error: error.message });
            }
        }
        return this.defaultClassification;
    }

    isConsentGranted(classification) {
        if (!classification) return true;
        if (!this.consent.has(classification)) {
            return false;
        }
        return Boolean(this.consent.get(classification));
    }

    updateConsent(consentUpdates = {}, metadata = {}) {
        const applied = {};
        for (const [classification, value] of Object.entries(consentUpdates)) {
            this.consent.set(classification, Boolean(value));
            applied[classification] = Boolean(value);
        }

        const snapshot = this.getConsentSnapshot();
        this.recordAudit('privacy.consent.updated', { applied, metadata, snapshot });
        this.onConsentDecision?.(snapshot, metadata);
    }

    getConsentSnapshot() {
        return Object.fromEntries(this.consent.entries());
    }

    pushAuditEntry(entry) {
        this.auditLog.push(entry);
        if (this.auditLog.length > this.auditLogLimit) {
            this.auditLog.shift();
        }
    }

    recordAudit(event, payload = {}, classification = 'compliance') {
        const entry = {
            event,
            payload,
            classification,
            timestamp: new Date().toISOString()
        };

        this.pushAuditEntry(entry);

        for (const provider of this.providers.values()) {
            if (typeof provider.recordAudit === 'function') {
                try {
                    provider.recordAudit(entry);
                } catch (error) {
                    this.pushAuditEntry({
                        event: 'privacy.audit.provider_error',
                        payload: {
                            provider: provider.id,
                            sourceEvent: event,
                            message: error?.message || 'Unknown error'
                        },
                        classification: 'system',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }

        return entry;
    }

    getAuditTrail() {
        return [...this.auditLog];
    }

    recordSchemaIssue({ type, issues, payload }) {
        this.recordAudit('compliance.schema.issue', { type, issues, payload });
        this.track('sensors.schema_issue', { type, issues, payload }, { classification: 'compliance' });
    }

    attachLicense(licenseKey) {
        this.licenseKey = licenseKey;
    }

    start() {
        if (!this.enabled || this.flushHandle) return;
        this.flushHandle = setInterval(() => this.flush(), this.flushInterval);
    }

    stop() {
        if (this.flushHandle) {
            clearInterval(this.flushHandle);
            this.flushHandle = null;
        }
    }

    async flush() {
        if (!this.enabled) return;
        const pending = [];
        for (const provider of this.providers.values()) {
            const result = provider.flush?.();
            if (result instanceof Promise) {
                pending.push(result);
            }
        }
        this.buffer = [];
        if (pending.length) {
            await Promise.allSettled(pending);
        }
    }
}
