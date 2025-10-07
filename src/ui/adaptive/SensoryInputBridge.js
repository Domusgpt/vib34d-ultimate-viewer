/**
 * SensoryInputBridge
 * ------------------------------------------------------------
 * Normalizes heterogeneous sensor and intent signals (eye tracking, neural
 * gestures, biometrics, ambient context) into a common semantic layer that the
 * adaptive interface engine can consume. Designed to be extended with
 * wearables-specific adapters and remote data streams.
 */

import { SensorSchemaRegistry } from './sensors/SensorSchemaRegistry.js';

export class SensoryInputBridge {
    constructor(options = {}) {
        const {
            pollingInterval = 16,
            decayHalfLife = 2800,
            confidenceThreshold = 0.35,
            schemaRegistry,
            schemas
        } = options;

        this.pollingInterval = pollingInterval;
        this.decayHalfLife = decayHalfLife;
        this.confidenceThreshold = confidenceThreshold;

        if (schemaRegistry instanceof SensorSchemaRegistry) {
            this.schemaRegistry = schemaRegistry;
        } else {
            this.schemaRegistry = new SensorSchemaRegistry({ schemas });
        }

        this.channels = new Map();
        this.subscribers = new Map();
        this.adapters = new Map();
        this.decayTimers = new Map();

        this.state = {
            focusVector: { x: 0.5, y: 0.5, depth: 0.3 },
            intentionVector: { x: 0, y: 0, z: 0, w: 0 },
            engagementLevel: 0.4,
            biometricStress: 0.2,
            gestureIntent: null,
            environment: {
                luminance: 0.5,
                noiseLevel: 0.2,
                motion: 0.1
            },
            updatedAt: performance.now()
        };

        this.loopHandle = null;
    }

    /**
     * Registers a new sensor adapter. Adapters must implement a `read()` method
     * that resolves with `{ confidence, payload }`.
     */
    registerAdapter(type, adapter) {
        this.adapters.set(type, adapter);
        if (!this.channels.has(type)) {
            this.channels.set(type, []);
        }
    }

    /**
     * Subscribe to semantic updates.
     */
    subscribe(channel, callback) {
        if (!this.subscribers.has(channel)) {
            this.subscribers.set(channel, new Set());
        }
        this.subscribers.get(channel).add(callback);
        return () => this.unsubscribe(channel, callback);
    }

    unsubscribe(channel, callback) {
        const set = this.subscribers.get(channel);
        if (!set) return;
        set.delete(callback);
    }

    /**
     * Manual ingestion hook for environments that push data instead of polling.
     */
    ingest(type, payload, confidence = 1) {
        this.processSample(type, { confidence, payload });
    }

    /**
     * Begin continuous polling of registered adapters.
     */
    start() {
        if (this.loopHandle) return;
        const loop = async () => {
            for (const [type, adapter] of this.adapters) {
                try {
                    const sample = await adapter.read();
                    if (sample) {
                        this.processSample(type, sample);
                    }
                } catch (error) {
                    console.warn(`[SensoryInputBridge] Adapter read failed for ${type}`, error);
                }
            }
            this.loopHandle = setTimeout(loop, this.pollingInterval);
        };
        loop();
    }

    stop() {
        if (this.loopHandle) {
            clearTimeout(this.loopHandle);
            this.loopHandle = null;
        }
    }

    processSample(type, sample) {
        if (!sample || typeof sample.confidence !== 'number') return;
        if (sample.confidence < this.confidenceThreshold) return;

        const now = performance.now();
        const { payload: sanitizedPayload, issues } = this.schemaRegistry.validate(type, sample.payload);

        if (issues.length > 0) {
            console.warn(`[SensoryInputBridge] Schema validation issues for ${type}`, issues);
        }

        this.channels.get(type)?.push({ ...sample, payload: sanitizedPayload, issues, receivedAt: now });
        this.applySemanticMapping(type, sanitizedPayload, sample.confidence, now);
    }

    applySemanticMapping(type, payload, confidence, timestamp) {
        switch (type) {
            case 'eye-tracking':
                this.updateFocus(payload, confidence, timestamp);
                break;
            case 'neural-intent':
                this.updateIntention(payload, confidence, timestamp);
                break;
            case 'biometric':
                this.updateBiometrics(payload, confidence, timestamp);
                break;
            case 'ambient':
                this.updateEnvironment(payload, confidence, timestamp);
                break;
            case 'gesture':
                this.updateGestures(payload, confidence, timestamp);
                break;
            default:
                // Allow custom adapters to emit semantic channel names directly
                this.emit(type, { payload, confidence, timestamp });
                break;
        }
    }

    updateFocus(payload, confidence, timestamp) {
        const { x = 0.5, y = 0.5, depth = 0.3 } = payload || {};
        this.state.focusVector = {
            x: this.lerp(this.state.focusVector.x, x, confidence),
            y: this.lerp(this.state.focusVector.y, y, confidence),
            depth: this.lerp(this.state.focusVector.depth, depth, confidence)
        };
        this.state.updatedAt = timestamp;
        this.emit('focus', this.state.focusVector);
        this.scheduleDecay('focus');
    }

    updateIntention(payload, confidence, timestamp) {
        const { x = 0, y = 0, z = 0, w = 0, engagement = 0.4 } = payload || {};
        this.state.intentionVector = {
            x: this.lerp(this.state.intentionVector.x, x, confidence),
            y: this.lerp(this.state.intentionVector.y, y, confidence),
            z: this.lerp(this.state.intentionVector.z, z, confidence),
            w: this.lerp(this.state.intentionVector.w, w, confidence)
        };
        this.state.engagementLevel = this.lerp(this.state.engagementLevel, engagement, confidence);
        this.state.updatedAt = timestamp;
        this.emit('intention', this.state.intentionVector);
        this.emit('engagement', this.state.engagementLevel);
        this.scheduleDecay('intention');
        this.scheduleDecay('engagement');
    }

    updateBiometrics(payload, confidence, timestamp) {
        const { stress = 0.2, heartRate = 68, temperature = 36.4 } = payload || {};
        this.state.biometricStress = this.lerp(this.state.biometricStress, stress, confidence);
        this.state.updatedAt = timestamp;
        this.emit('biometrics', { stress: this.state.biometricStress, heartRate, temperature });
        this.scheduleDecay('biometrics');
    }

    updateEnvironment(payload, confidence, timestamp) {
        const { luminance = 0.5, noiseLevel = 0.2, motion = 0.1 } = payload || {};
        this.state.environment = {
            luminance: this.lerp(this.state.environment.luminance, luminance, confidence),
            noiseLevel: this.lerp(this.state.environment.noiseLevel, noiseLevel, confidence),
            motion: this.lerp(this.state.environment.motion, motion, confidence)
        };
        this.state.updatedAt = timestamp;
        this.emit('environment', this.state.environment);
        this.scheduleDecay('environment');
    }

    updateGestures(payload, confidence, timestamp) {
        const { intent = null, vector = { x: 0, y: 0, z: 0 } } = payload || {};
        this.state.gestureIntent = intent;
        this.state.updatedAt = timestamp;
        this.emit('gesture', { intent, vector, confidence });
        this.scheduleDecay('gesture');
    }

    scheduleDecay(channel) {
        if (this.decayTimers.has(channel)) {
            clearTimeout(this.decayTimers.get(channel));
        }
        const timeout = setTimeout(() => {
            this.emit(`${channel}:decay`, { channel, timestamp: performance.now() });
        }, this.decayHalfLife);
        this.decayTimers.set(channel, timeout);
    }

    emit(channel, payload) {
        const listeners = this.subscribers.get(channel);
        if (!listeners) return;
        for (const callback of listeners) {
            try {
                callback(payload);
            } catch (error) {
                console.error(`[SensoryInputBridge] subscriber error on ${channel}`, error);
            }
        }
    }

    lerp(start, end, alpha) {
        return start + (end - start) * alpha;
    }

    getSnapshot() {
        return { ...this.state };
    }

    registerSchema(type, schema) {
        this.schemaRegistry.register(type, schema);
    }

    getSchemaRegistry() {
        return this.schemaRegistry;
    }
}

