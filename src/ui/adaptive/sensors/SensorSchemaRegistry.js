/**
 * @typedef {Object} SensorSchemaIssue
 * @property {string} field
 * @property {string} code
 * @property {string} [message]
 */

/**
 * @typedef {Object} SensorSchemaResult
 * @property {Record<string, any>} payload
 * @property {SensorSchemaIssue[]} issues
 */

/**
 * @typedef {{ normalize(payload: Record<string, any>, registry: SensorSchemaRegistry): SensorSchemaResult | Record<string, any>; fallback?: Record<string, any>; }} SensorSchemaDefinition
 */

const clamp = (value, min, max) => {
    if (typeof min === 'number' && value < min) {
        return min;
    }
    if (typeof max === 'number' && value > max) {
        return max;
    }
    return value;
};

export class SensorSchemaRegistry {
    constructor(options = {}) {
        const { registerDefaults = true, schemas } = options;
        this.schemas = new Map();

        if (registerDefaults) {
            this.registerDefaultSchemas();
        }

        if (schemas) {
            this.loadCustomSchemas(schemas);
        }
    }

    /**
     * @param {string} type
     * @param {SensorSchemaDefinition | ((payload: Record<string, any>) => SensorSchemaResult | Record<string, any>)} schema
     */
    register(type, schema) {
        if (!type || typeof type !== 'string') {
            throw new Error('SensorSchemaRegistry.register requires a sensor type string');
        }

        const normalizedSchema = typeof schema === 'function' ? { normalize: schema } : schema;
        if (!normalizedSchema || typeof normalizedSchema.normalize !== 'function') {
            throw new Error(`Sensor schema for ${type} must provide a normalize(payload) function`);
        }

        this.schemas.set(type, normalizedSchema);
    }

    /**
     * @param {string} type
     * @param {Record<string, any>} payload
     * @returns {SensorSchemaResult}
     */
    validate(type, payload) {
        const schema = this.schemas.get(type);
        if (!schema) {
            return { payload: payload ?? {}, issues: [] };
        }

        try {
            const result = schema.normalize(payload ?? {}, this);
            if (!result || typeof result !== 'object') {
                return { payload: {}, issues: [{ field: '*', code: 'schema-invalid-return', message: 'Schema normalize must return an object.' }] };
            }

            if ('payload' in result) {
                return {
                    payload: result.payload ?? {},
                    issues: Array.isArray(result.issues) ? result.issues : []
                };
            }

            return { payload: result, issues: [] };
        } catch (error) {
            return {
                payload: schema.fallback ?? {},
                issues: [{ field: '*', code: 'schema-error', message: error.message }]
            };
        }
    }

    registerDefaultSchemas() {
        this.register('eye-tracking', {
            normalize: payload => {
                const issues = [];
                const normalized = {
                    x: this.ensureNumber(payload.x, {
                        field: 'x',
                        min: 0,
                        max: 1,
                        defaultValue: 0.5,
                        issues
                    }),
                    y: this.ensureNumber(payload.y, {
                        field: 'y',
                        min: 0,
                        max: 1,
                        defaultValue: 0.5,
                        issues
                    }),
                    depth: this.ensureNumber(payload.depth, {
                        field: 'depth',
                        min: 0,
                        max: 1,
                        defaultValue: 0.3,
                        issues
                    })
                };
                return { payload: normalized, issues };
            },
            fallback: { x: 0.5, y: 0.5, depth: 0.3 }
        });

        this.register('neural-intent', {
            normalize: payload => {
                const issues = [];
                const normalized = {
                    x: this.ensureNumber(payload.x, { field: 'x', min: -1, max: 1, defaultValue: 0, issues }),
                    y: this.ensureNumber(payload.y, { field: 'y', min: -1, max: 1, defaultValue: 0, issues }),
                    z: this.ensureNumber(payload.z, { field: 'z', min: -1, max: 1, defaultValue: 0, issues }),
                    w: this.ensureNumber(payload.w, { field: 'w', min: -1, max: 1, defaultValue: 0, issues }),
                    engagement: this.ensureNumber(payload.engagement, {
                        field: 'engagement',
                        min: 0,
                        max: 1,
                        defaultValue: 0.4,
                        issues
                    })
                };
                return { payload: normalized, issues };
            },
            fallback: { x: 0, y: 0, z: 0, w: 0, engagement: 0.4 }
        });

        this.register('biometric', {
            normalize: payload => {
                const issues = [];
                const normalized = {
                    stress: this.ensureNumber(payload.stress, { field: 'stress', min: 0, max: 1, defaultValue: 0.2, issues }),
                    heartRate: this.ensureInteger(payload.heartRate, {
                        field: 'heartRate',
                        min: 30,
                        max: 220,
                        defaultValue: 68,
                        issues
                    }),
                    temperature: this.ensureNumber(payload.temperature, {
                        field: 'temperature',
                        min: 32,
                        max: 40,
                        defaultValue: 36.4,
                        precision: 1,
                        issues
                    })
                };
                return { payload: normalized, issues };
            },
            fallback: { stress: 0.2, heartRate: 68, temperature: 36.4 }
        });

        this.register('ambient', {
            normalize: payload => {
                const issues = [];
                const normalized = {
                    luminance: this.ensureNumber(payload.luminance, { field: 'luminance', min: 0, max: 1, defaultValue: 0.5, issues }),
                    noiseLevel: this.ensureNumber(payload.noiseLevel, { field: 'noiseLevel', min: 0, max: 1, defaultValue: 0.2, issues }),
                    motion: this.ensureNumber(payload.motion, { field: 'motion', min: 0, max: 1, defaultValue: 0.1, issues })
                };
                return { payload: normalized, issues };
            },
            fallback: { luminance: 0.5, noiseLevel: 0.2, motion: 0.1 }
        });

        this.register('gesture', {
            normalize: payload => {
                const issues = [];
                const normalized = {
                    intent: this.ensureString(payload.intent, { field: 'intent', allowEmpty: true, issues }),
                    vector: this.ensureVector(payload.vector, {
                        field: 'vector',
                        min: -1,
                        max: 1,
                        defaultValue: 0,
                        issues
                    })
                };
                return { payload: normalized, issues };
            },
            fallback: { intent: null, vector: { x: 0, y: 0, z: 0 } }
        });
    }

    loadCustomSchemas(schemas) {
        if (Array.isArray(schemas)) {
            for (const entry of schemas) {
                if (entry && typeof entry === 'object' && entry.type) {
                    this.register(entry.type, entry.schema);
                }
            }
            return;
        }

        if (typeof schemas === 'object') {
            for (const [type, schema] of Object.entries(schemas)) {
                this.register(type, schema);
            }
        }
    }

    ensureNumber(value, { field, min, max, defaultValue = 0, precision, issues }) {
        let numberValue = Number(value);
        if (value === undefined || value === null || Number.isNaN(numberValue)) {
            issues?.push({ field, code: 'type', message: 'Expected numeric value.' });
            numberValue = defaultValue;
        }

        const clamped = clamp(numberValue, min, max);
        if (typeof min === 'number' && clamped === min && numberValue < min) {
            issues?.push({ field, code: 'min', message: `Value below minimum; clamped to ${min}.` });
        }
        if (typeof max === 'number' && clamped === max && numberValue > max) {
            issues?.push({ field, code: 'max', message: `Value above maximum; clamped to ${max}.` });
        }

        let finalValue = clamped;
        if (typeof precision === 'number') {
            const factor = 10 ** precision;
            finalValue = Math.round(finalValue * factor) / factor;
        }

        return finalValue;
    }

    ensureInteger(value, { field, min, max, defaultValue = 0, issues }) {
        const numberValue = this.ensureNumber(value, { field, min, max, defaultValue, issues });
        return Math.round(numberValue);
    }

    ensureString(value, { field, allowEmpty = false, fallback = null, issues }) {
        if (typeof value !== 'string') {
            if (value == null) {
                if (!allowEmpty) {
                    issues?.push({ field, code: 'type', message: 'Expected string value.' });
                }
                return fallback;
            }

            try {
                value = String(value);
            } catch (error) {
                issues?.push({ field, code: 'type', message: 'Value is not coercible to string.' });
                return fallback;
            }
        }

        const normalized = value.trim();
        if (!allowEmpty && normalized.length === 0) {
            issues?.push({ field, code: 'empty', message: 'String value cannot be empty.' });
            return fallback;
        }

        return normalized.length === 0 ? fallback : normalized;
    }

    ensureVector(value, { field, min, max, defaultValue = 0, issues }) {
        const base = value && typeof value === 'object' ? value : {};
        return {
            x: this.ensureNumber(base.x, { field: `${field}.x`, min, max, defaultValue, issues }),
            y: this.ensureNumber(base.y, { field: `${field}.y`, min, max, defaultValue, issues }),
            z: this.ensureNumber(base.z, { field: `${field}.z`, min, max, defaultValue, issues })
        };
    }
}
