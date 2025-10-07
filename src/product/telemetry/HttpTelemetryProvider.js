import { TelemetryProvider } from './TelemetryProvider.js';

export class HttpTelemetryProvider extends TelemetryProvider {
    constructor(options = {}) {
        super({ id: 'http', metadata: { storage: 'remote', ...options.metadata } });
        this.endpoint = options.endpoint;
        this.headers = options.headers || { 'Content-Type': 'application/json' };
        this.queue = [];
    }

    identify(identity, traits = {}) {
        this.queue.push({ type: 'identify', identity, traits, timestamp: Date.now() });
    }

    track(event, payload) {
        this.queue.push({ type: 'track', event, payload, timestamp: Date.now() });
    }

    async flush() {
        if (!this.endpoint || this.queue.length === 0) {
            this.queue = [];
            return;
        }

        const payload = { events: this.queue };
        this.queue = [];
        try {
            await fetch(this.endpoint, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.warn('[HttpTelemetryProvider] Failed to deliver telemetry', error);
        }
    }
}
