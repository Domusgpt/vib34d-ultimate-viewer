/**
 * ProductTelemetryHarness
 * ------------------------------------------------------------
 * Lightweight analytics and licensing scaffolding that can be wired into
 * external services (Segment, Amplitude, self-hosted) to monetize the adaptive
 * interface platform.
 */

export class ProductTelemetryHarness {
    constructor(options = {}) {
        this.enabled = options.enabled ?? true;
        this.licenseKey = options.licenseKey || null;
        this.endpoint = options.endpoint || null;
        this.buffer = [];
        this.flushInterval = options.flushInterval || 10000;
        this.flushHandle = null;
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

    track(event, payload = {}) {
        if (!this.enabled) return;
        const record = {
            event,
            payload,
            licenseKey: this.licenseKey,
            timestamp: new Date().toISOString()
        };
        this.buffer.push(record);
    }

    attachLicense(licenseKey) {
        this.licenseKey = licenseKey;
    }

    flush() {
        if (!this.enabled || this.buffer.length === 0) return;
        if (this.endpoint) {
            fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: this.buffer })
            }).catch(error => {
                console.warn('[ProductTelemetryHarness] Failed to flush telemetry', error);
            });
        } else {
            console.table(this.buffer);
        }
        this.buffer = [];
    }
}

