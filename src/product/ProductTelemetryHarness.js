import { ConsoleTelemetryProvider } from './telemetry/ConsoleTelemetryProvider.js';

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

        this.providers = new Map();
        if (options.useDefaultProvider !== false) {
            this.registerProvider(new ConsoleTelemetryProvider(options.consoleProvider || {}));
        }

        (options.providers || []).forEach(provider => this.registerProvider(provider));
    }

    registerProvider(provider) {
        this.providers.set(provider.id, provider);
    }

    removeProvider(id) {
        this.providers.delete(id);
    }

    identify(identity, traits = {}) {
        if (!this.enabled) return;
        const sanitizedTraits = this.sanitizePayload(traits);
        for (const provider of this.providers.values()) {
            provider.identify?.(identity, sanitizedTraits);
        }
    }

    track(event, payload = {}) {
        if (!this.enabled) return;
        const sanitizedPayload = this.sanitizePayload(payload);
        const record = {
            event,
            payload: sanitizedPayload,
            licenseKey: this.dataMinimization.omitLicense ? undefined : this.licenseKey,
            timestamp: new Date().toISOString()
        };
        this.buffer.push(record);
        for (const provider of this.providers.values()) {
            provider.track?.(event, record);
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
