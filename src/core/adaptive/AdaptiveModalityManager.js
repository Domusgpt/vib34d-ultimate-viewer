/**
 * AdaptiveModalityManager orchestrates heterogeneous wearable inputs and
 * translates them into normalized parameter updates for the visualization engine.
 */

import { createDefaultProfiles } from './ModalityProfiles.js';

export class AdaptiveModalityManager {
    constructor({ parameterDefaults = {}, logger = console, profiles = null } = {}) {
        this.logger = logger;
        this.parameterDefaults = parameterDefaults;
        this.modalities = new Map();
        this.subscribers = new Set();

        const initialProfiles = profiles || createDefaultProfiles();
        initialProfiles.forEach(profile => this.registerModality(profile));
    }

    registerModality(profile) {
        if (!profile || !profile.id) {
            throw new Error('Modality profile must include an id');
        }

        const existing = this.modalities.get(profile.id) || {};

        this.modalities.set(profile.id, {
            ...existing,
            ...profile,
            lastInput: profile.inputSchema ? this.createDefaultInput(profile.inputSchema) : {},
            lastUpdate: null
        });

        this.logger.info?.(`🛰️ Registered modality: ${profile.label || profile.id}`);
        return this.modalities.get(profile.id);
    }

    deregisterModality(id) {
        if (this.modalities.has(id)) {
            this.modalities.delete(id);
            this.logger.info?.(`🧹 Deregistered modality: ${id}`);
        }
    }

    createDefaultInput(schema = {}) {
        return Object.entries(schema).reduce((acc, [key, descriptor]) => {
            if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'defaultValue')) {
                acc[key] = descriptor.defaultValue;
            } else if (descriptor?.min !== undefined && descriptor?.max !== undefined) {
                acc[key] = (descriptor.min + descriptor.max) / 2;
            } else {
                acc[key] = null;
            }
            return acc;
        }, {});
    }

    ingestSignal(id, payload = {}, context = {}) {
        const modality = this.modalities.get(id);
        if (!modality) {
            this.logger.warn?.(`⚠️ Unknown modality signal received: ${id}`);
            return;
        }

        const sanitized = this.sanitizeInput(payload, modality.inputSchema);
        modality.lastInput = { ...modality.lastInput, ...sanitized };
        modality.lastUpdate = { timestamp: performance.now?.() || Date.now(), context };

        const parameters = this.evaluateParameters();
        this.notifySubscribers(parameters, { modality: id, context });
        return parameters;
    }

    sanitizeInput(payload, schema = {}) {
        if (!schema) return payload;

        const sanitized = {};
        Object.entries(payload).forEach(([key, value]) => {
            const descriptor = schema[key];
            if (!descriptor) {
                sanitized[key] = value;
                return;
            }

            if (descriptor.options) {
                sanitized[key] = descriptor.options.includes(value) ? value : descriptor.defaultValue;
                return;
            }

            const min = descriptor.min ?? value;
            const max = descriptor.max ?? value;
            let numericValue = Number(value);
            if (Number.isNaN(numericValue)) {
                numericValue = descriptor.defaultValue ?? 0;
            }
            sanitized[key] = Math.min(max, Math.max(min, numericValue));
        });
        return sanitized;
    }

    evaluateParameters({ baseParameters = {} } = {}) {
        const aggregated = { ...this.parameterDefaults, ...baseParameters };

        this.modalities.forEach(modality => {
            if (!modality.parameterTargets) {
                return;
            }

            Object.entries(modality.parameterTargets).forEach(([paramKey, transform]) => {
                try {
                    const value = transform(modality.lastInput, aggregated);
                    if (value !== undefined) {
                        aggregated[paramKey] = value;
                    }
                } catch (error) {
                    this.logger.error?.(`❌ Failed to compute parameter '${paramKey}' from modality '${modality.id}':`, error);
                }
            });
        });

        return aggregated;
    }

    subscribe(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Subscriber must be a function');
        }
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notifySubscribers(parameters, meta = {}) {
        this.subscribers.forEach(callback => {
            try {
                callback(parameters, meta);
            } catch (error) {
                this.logger.error?.('❌ Adaptive modality subscriber failure:', error);
            }
        });
    }

    getStateSnapshot() {
        const snapshot = {};
        this.modalities.forEach((modality, id) => {
            snapshot[id] = {
                label: modality.label,
                lastInput: { ...modality.lastInput },
                lastUpdate: modality.lastUpdate
            };
        });
        return snapshot;
    }
}

export default AdaptiveModalityManager;
