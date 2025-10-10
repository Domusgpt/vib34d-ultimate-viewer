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

        this.registerWearableDeviceDefaults();
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

    appendIssues(target, prefix, nestedIssues) {
        if (!Array.isArray(nestedIssues) || nestedIssues.length === 0) {
            return;
        }

        for (const issue of nestedIssues) {
            const field = issue.field && issue.field !== '*'
                ? `${prefix}.${issue.field}`
                : prefix;
            target.push({ ...issue, field });
        }
    }

    ensureBoolean(value, { field, defaultValue = false, issues }) {
        if (typeof value === 'boolean') {
            return value;
        }

        if (value == null) {
            issues?.push({ field, code: 'type', message: 'Expected boolean value.' });
            return defaultValue;
        }

        if (value === '1' || value === 1 || value === 'true') {
            issues?.push({ field, code: 'coerce', message: 'Coerced truthy value to boolean true.' });
            return true;
        }

        if (value === '0' || value === 0 || value === 'false') {
            issues?.push({ field, code: 'coerce', message: 'Coerced falsy value to boolean false.' });
            return false;
        }

        issues?.push({ field, code: 'coerce', message: 'Coerced value to boolean.' });
        return Boolean(value);
    }

    ensureQuaternion(value, { field, defaultValue = { x: 0, y: 0, z: 0, w: 1 }, issues }) {
        const base = value && typeof value === 'object' ? value : {};
        const defaults = defaultValue || {};
        return {
            x: this.ensureNumber(base.x, { field: `${field}.x`, min: -1, max: 1, defaultValue: defaults.x ?? 0, issues }),
            y: this.ensureNumber(base.y, { field: `${field}.y`, min: -1, max: 1, defaultValue: defaults.y ?? 0, issues }),
            z: this.ensureNumber(base.z, { field: `${field}.z`, min: -1, max: 1, defaultValue: defaults.z ?? 0, issues }),
            w: this.ensureNumber(base.w, { field: `${field}.w`, min: -1, max: 1, defaultValue: defaults.w ?? 1, issues })
        };
    }

    normalizeWearableChannel(channelType, raw, options = {}) {
        const {
            schemaType = channelType,
            defaultConfidence = 0.75,
            confidenceField,
            required = false,
            confidence,
            issues = [],
            missingConfidence = 0
        } = options;

        if (!raw && !required) {
            return null;
        }

        const payloadRaw = raw?.payload ?? raw ?? {};
        const result = this.validate(schemaType, payloadRaw);
        this.appendIssues(issues, `channels.${channelType}`, result.issues);

        const fallbackConfidence = raw ? defaultConfidence : missingConfidence;
        const normalizedConfidence = this.ensureNumber(
            raw?.confidence ?? confidence,
            {
                field: confidenceField || `channels.${channelType}.confidence`,
                min: 0,
                max: 1,
                defaultValue: fallbackConfidence,
                issues
            }
        );

        if (!raw && required) {
            issues.push({
                field: `channels.${channelType}`,
                code: 'missing',
                message: `${channelType} payload is required.`
            });
        }

        return {
            confidence: normalizedConfidence,
            payload: result.payload
        };
    }

    registerWearableDeviceDefaults() {
        this.register('wearable.ar-visor', {
            normalize: payload => {
                const issues = [];
                const safe = payload && typeof payload === 'object' ? payload : {};
                const metadataSource = safe.metadata && typeof safe.metadata === 'object' ? safe.metadata : {};
                const channelSource = safe.channels && typeof safe.channels === 'object' ? safe.channels : {};

                const eyeSource = channelSource['eye-tracking'] ?? safe.gaze ?? null;
                const ambientSource = channelSource.ambient ?? safe.environment ?? null;
                const gestureSource = channelSource.gesture ?? safe.gesture ?? null;

                const channels = {};

                const eyeChannel = this.normalizeWearableChannel('eye-tracking', eyeSource, {
                    schemaType: 'eye-tracking',
                    defaultConfidence: 0.82,
                    missingConfidence: 0,
                    confidence: safe.focusConfidence ?? safe.quality?.focus,
                    issues,
                    required: true,
                    confidenceField: 'channels.eye-tracking.confidence'
                });
                if (eyeChannel) {
                    if (eyeSource && typeof eyeSource === 'object') {
                        if ('vergence' in eyeSource) {
                            eyeChannel.payload.vergence = this.ensureNumber(eyeSource.vergence, {
                                field: 'channels.eye-tracking.vergence',
                                min: 0,
                                max: 5,
                                defaultValue: 0,
                                precision: 2,
                                issues
                            });
                        }
                        if ('stability' in eyeSource) {
                            eyeChannel.payload.stability = this.ensureNumber(eyeSource.stability, {
                                field: 'channels.eye-tracking.stability',
                                min: 0,
                                max: 1,
                                defaultValue: 0.5,
                                precision: 2,
                                issues
                            });
                        }
                        if ('blinkRate' in eyeSource) {
                            eyeChannel.payload.blinkRate = this.ensureNumber(eyeSource.blinkRate, {
                                field: 'channels.eye-tracking.blinkRate',
                                min: 0,
                                max: 2.5,
                                defaultValue: 0.2,
                                precision: 2,
                                issues
                            });
                        }
                    }
                    channels['eye-tracking'] = eyeChannel;
                }

                const ambientChannel = this.normalizeWearableChannel('ambient', ambientSource, {
                    schemaType: 'ambient',
                    defaultConfidence: 0.65,
                    confidence: safe.quality?.environment,
                    issues,
                    confidenceField: 'channels.ambient.confidence'
                });
                if (ambientChannel) {
                    if (ambientSource && typeof ambientSource === 'object' && 'temperature' in ambientSource) {
                        ambientChannel.payload.temperature = this.ensureNumber(ambientSource.temperature, {
                            field: 'channels.ambient.temperature',
                            min: -20,
                            max: 60,
                            defaultValue: 22,
                            precision: 1,
                            issues
                        });
                    }
                    channels.ambient = ambientChannel;
                }

                const gestureChannel = this.normalizeWearableChannel('gesture', gestureSource, {
                    schemaType: 'gesture',
                    defaultConfidence: 0.58,
                    confidence: safe.quality?.gesture ?? safe.quality?.focus,
                    issues,
                    confidenceField: 'channels.gesture.confidence'
                });
                if (gestureChannel) {
                    const vector = gestureChannel.payload.vector || {};
                    gestureChannel.payload.vector = {
                        x: this.ensureNumber(vector.x, { field: 'channels.gesture.vector.x', min: -1, max: 1, defaultValue: 0, issues }),
                        y: this.ensureNumber(vector.y, { field: 'channels.gesture.vector.y', min: -1, max: 1, defaultValue: 0, issues }),
                        z: this.ensureNumber(vector.z, { field: 'channels.gesture.vector.z', min: -1, max: 1, defaultValue: 0, issues })
                    };
                    if (gestureSource && typeof gestureSource === 'object' && 'intentStrength' in gestureSource) {
                        gestureChannel.payload.intentStrength = this.ensureNumber(gestureSource.intentStrength, {
                            field: 'channels.gesture.intentStrength',
                            min: 0,
                            max: 1,
                            defaultValue: 0,
                            precision: 2,
                            issues
                        });
                    }
                    channels.gesture = gestureChannel;
                }

                const metadata = {};
                const batterySource = safe.batteryLevel ?? metadataSource.batteryLevel;
                if (batterySource !== undefined) {
                    metadata.batteryLevel = this.ensureNumber(batterySource, {
                        field: 'metadata.batteryLevel',
                        min: 0,
                        max: 1,
                        defaultValue: 1,
                        precision: 2,
                        issues
                    });
                }

                const deviceTemperatureSource = safe.deviceTemperature
                    ?? safe.temperature
                    ?? metadataSource.deviceTemperature
                    ?? ambientSource?.temperature;
                if (deviceTemperatureSource !== undefined) {
                    metadata.deviceTemperature = this.ensureNumber(deviceTemperatureSource, {
                        field: 'metadata.deviceTemperature',
                        min: 10,
                        max: 65,
                        defaultValue: 32,
                        precision: 1,
                        issues
                    });
                }

                const uptimeSource = safe.uptimeSeconds ?? metadataSource.uptimeSeconds;
                if (uptimeSource !== undefined) {
                    metadata.uptimeSeconds = this.ensureNumber(uptimeSource, {
                        field: 'metadata.uptimeSeconds',
                        min: 0,
                        max: 604800,
                        defaultValue: 0,
                        issues
                    });
                }

                const poseSource = safe.pose && typeof safe.pose === 'object' ? safe.pose : metadataSource.pose;
                if (poseSource) {
                    metadata.pose = {
                        orientation: this.ensureQuaternion(poseSource.orientation, {
                            field: 'metadata.pose.orientation',
                            issues
                        }),
                        position: this.ensureVector(poseSource.position, {
                            field: 'metadata.pose.position',
                            min: -5,
                            max: 5,
                            defaultValue: 0,
                            issues
                        })
                    };
                }

                const fieldOfViewSource = safe.fieldOfView && typeof safe.fieldOfView === 'object'
                    ? safe.fieldOfView
                    : metadataSource.fieldOfView;
                if (fieldOfViewSource) {
                    metadata.fieldOfView = {
                        horizontal: this.ensureNumber(fieldOfViewSource.horizontal, {
                            field: 'metadata.fieldOfView.horizontal',
                            min: 40,
                            max: 140,
                            defaultValue: 96,
                            precision: 1,
                            issues
                        }),
                        vertical: this.ensureNumber(fieldOfViewSource.vertical, {
                            field: 'metadata.fieldOfView.vertical',
                            min: 35,
                            max: 120,
                            defaultValue: 89,
                            precision: 1,
                            issues
                        })
                    };

                    if (fieldOfViewSource.diagonal !== undefined) {
                        metadata.fieldOfView.diagonal = this.ensureNumber(fieldOfViewSource.diagonal, {
                            field: 'metadata.fieldOfView.diagonal',
                            min: 60,
                            max: 170,
                            defaultValue: 110,
                            precision: 1,
                            issues
                        });
                    }
                }

                if (safe.optics && typeof safe.optics === 'object') {
                    metadata.optics = {
                        ipd: this.ensureNumber(safe.optics.ipd, {
                            field: 'metadata.optics.ipd',
                            min: 50,
                            max: 80,
                            defaultValue: 63,
                            precision: 1,
                            issues
                        }),
                        calibrationState: this.ensureString(safe.optics.calibrationState, {
                            field: 'metadata.optics.calibrationState',
                            allowEmpty: false,
                            fallback: 'unknown',
                            issues
                        })
                    };
                }

                const metadataEntries = Object.entries(metadata)
                    .filter(([, value]) => value !== undefined && value !== null
                        && (!(typeof value === 'object') || Object.keys(value).length > 0));
                const normalizedMetadata = metadataEntries.length ? Object.fromEntries(metadataEntries) : {};

                const firmwareVersion = this.ensureString(safe.firmwareVersion ?? metadataSource.firmwareVersion, {
                    field: 'firmwareVersion',
                    allowEmpty: true,
                    fallback: null,
                    issues
                });

                const deviceId = this.ensureString(safe.deviceId ?? metadataSource.deviceId, {
                    field: 'deviceId',
                    allowEmpty: false,
                    fallback: 'wearable.ar-visor',
                    issues
                }) || 'wearable.ar-visor';

                const confidence = this.ensureNumber(
                    safe.confidence ?? safe.quality?.overall,
                    {
                        field: 'confidence',
                        min: 0,
                        max: 1,
                        defaultValue: eyeChannel?.confidence ?? 0.8,
                        issues
                    }
                );

                return {
                    payload: {
                        deviceId,
                        firmwareVersion,
                        channels,
                        metadata: normalizedMetadata
                    },
                    issues
                };
            },
            fallback: {
                deviceId: 'wearable.ar-visor',
                firmwareVersion: null,
                channels: {
                    'eye-tracking': { confidence: 0, payload: { x: 0.5, y: 0.5, depth: 0.3 } },
                    ambient: { confidence: 0, payload: { luminance: 0.5, noiseLevel: 0.2, motion: 0.1 } },
                    gesture: { confidence: 0, payload: { intent: null, vector: { x: 0, y: 0, z: 0 } } }
                },
                metadata: {}
            }
        });

        this.register('wearable.neural-band', {
            normalize: payload => {
                const issues = [];
                const safe = payload && typeof payload === 'object' ? payload : {};
                const metadataSource = safe.metadata && typeof safe.metadata === 'object' ? safe.metadata : {};
                const channelSource = safe.channels && typeof safe.channels === 'object' ? safe.channels : {};

                const intentSource = channelSource['neural-intent'] ?? safe.intent ?? safe.signal ?? null;
                const gestureSource = channelSource.gesture ?? safe.gesture ?? null;

                const channels = {};

                const intentChannel = this.normalizeWearableChannel('neural-intent', intentSource, {
                    schemaType: 'neural-intent',
                    defaultConfidence: 0.7,
                    missingConfidence: 0,
                    confidence: safe.quality?.intent ?? safe.signalQuality?.overall,
                    issues,
                    required: true,
                    confidenceField: 'channels.neural-intent.confidence'
                });
                if (intentChannel) {
                    if (intentSource && typeof intentSource === 'object') {
                        if ('signalToNoise' in intentSource) {
                            intentChannel.payload.signalToNoise = this.ensureNumber(intentSource.signalToNoise, {
                                field: 'channels.neural-intent.signalToNoise',
                                min: 0,
                                max: 40,
                                defaultValue: 12,
                                precision: 1,
                                issues
                            });
                        }
                        if ('bandwidth' in intentSource) {
                            intentChannel.payload.bandwidth = this.ensureNumber(intentSource.bandwidth, {
                                field: 'channels.neural-intent.bandwidth',
                                min: 0,
                                max: 100,
                                defaultValue: 24,
                                precision: 1,
                                issues
                            });
                        }
                    }
                    channels['neural-intent'] = intentChannel;
                }

                const gestureChannel = this.normalizeWearableChannel('gesture', gestureSource, {
                    schemaType: 'gesture',
                    defaultConfidence: 0.55,
                    confidence: safe.quality?.gesture,
                    issues,
                    confidenceField: 'channels.gesture.confidence'
                });
                if (gestureChannel) {
                    const vector = gestureChannel.payload.vector || {};
                    gestureChannel.payload.vector = {
                        x: this.ensureNumber(vector.x, { field: 'channels.gesture.vector.x', min: -1, max: 1, defaultValue: 0, issues }),
                        y: this.ensureNumber(vector.y, { field: 'channels.gesture.vector.y', min: -1, max: 1, defaultValue: 0, issues }),
                        z: this.ensureNumber(vector.z, { field: 'channels.gesture.vector.z', min: -1, max: 1, defaultValue: 0, issues })
                    };
                    channels.gesture = gestureChannel;
                }

                const metadata = {};
                if (safe.signalQuality && typeof safe.signalQuality === 'object') {
                    metadata.signalQuality = {
                        overall: this.ensureNumber(safe.signalQuality.overall, {
                            field: 'metadata.signalQuality.overall',
                            min: 0,
                            max: 1,
                            defaultValue: 0.6,
                            precision: 2,
                            issues
                        }),
                        contacts: this.ensureNumber(safe.signalQuality.contacts, {
                            field: 'metadata.signalQuality.contacts',
                            min: 0,
                            max: 1,
                            defaultValue: 0.5,
                            precision: 2,
                            issues
                        })
                    };
                }

                if (safe.impedance || metadataSource.impedance) {
                    const impedanceSource = safe.impedance ?? metadataSource.impedance;
                    metadata.impedance = {
                        average: this.ensureNumber(impedanceSource?.average, {
                            field: 'metadata.impedance.average',
                            min: 0,
                            max: 5000,
                            defaultValue: 1200,
                            issues
                        }),
                        variance: this.ensureNumber(impedanceSource?.variance, {
                            field: 'metadata.impedance.variance',
                            min: 0,
                            max: 5000,
                            defaultValue: 400,
                            issues
                        })
                    };
                }

                if (safe.contactState !== undefined || metadataSource.contactState !== undefined) {
                    const contactState = safe.contactState ?? metadataSource.contactState;
                    metadata.contact = {
                        state: this.ensureString(contactState, {
                            field: 'metadata.contact.state',
                            allowEmpty: false,
                            fallback: 'unknown',
                            issues
                        }),
                        electrodes: Array.isArray(safe.electrodes)
                            ? safe.electrodes.map((value, index) => this.ensureNumber(value, {
                                field: `metadata.contact.electrodes[${index}]`,
                                min: 0,
                                max: 1,
                                defaultValue: 0,
                                precision: 2,
                                issues
                            }))
                            : undefined
                    };
                }

                if (safe.band && typeof safe.band === 'object') {
                    metadata.band = {
                        firmware: this.ensureString(safe.band.firmware, {
                            field: 'metadata.band.firmware',
                            allowEmpty: true,
                            fallback: metadataSource.band?.firmware ?? null,
                            issues
                        }),
                        hardwareRevision: this.ensureString(safe.band.hardwareRevision, {
                            field: 'metadata.band.hardwareRevision',
                            allowEmpty: true,
                            fallback: metadataSource.band?.hardwareRevision ?? null,
                            issues
                        })
                    };
                }

                if (safe.temperature !== undefined) {
                    metadata.deviceTemperature = this.ensureNumber(safe.temperature, {
                        field: 'metadata.deviceTemperature',
                        min: 20,
                        max: 55,
                        defaultValue: 32,
                        precision: 1,
                        issues
                    });
                }

                const metadataEntries = Object.entries(metadata)
                    .filter(([, value]) => value !== undefined && value !== null
                        && (!(typeof value === 'object') || Object.keys(value).length > 0));
                const normalizedMetadata = metadataEntries.length ? Object.fromEntries(metadataEntries) : {};

                const firmwareVersion = this.ensureString(safe.firmwareVersion ?? metadataSource.firmwareVersion, {
                    field: 'firmwareVersion',
                    allowEmpty: true,
                    fallback: null,
                    issues
                });

                const deviceId = this.ensureString(safe.deviceId ?? metadataSource.deviceId, {
                    field: 'deviceId',
                    allowEmpty: false,
                    fallback: 'wearable.neural-band',
                    issues
                }) || 'wearable.neural-band';

                const confidence = this.ensureNumber(
                    safe.confidence ?? safe.signalQuality?.overall,
                    {
                        field: 'confidence',
                        min: 0,
                        max: 1,
                        defaultValue: intentChannel?.confidence ?? 0.7,
                        issues
                    }
                );

                return {
                    payload: {
                        deviceId,
                        firmwareVersion,
                        channels,
                        metadata: normalizedMetadata
                    },
                    issues
                };
            },
            fallback: {
                deviceId: 'wearable.neural-band',
                firmwareVersion: null,
                channels: {
                    'neural-intent': { confidence: 0, payload: { x: 0, y: 0, z: 0, w: 0, engagement: 0.4 } },
                    gesture: { confidence: 0, payload: { intent: null, vector: { x: 0, y: 0, z: 0 } } }
                },
                metadata: {}
            }
        });

        this.register('wearable.biometric-wrist', {
            normalize: payload => {
                const issues = [];
                const safe = payload && typeof payload === 'object' ? payload : {};
                const metadataSource = safe.metadata && typeof safe.metadata === 'object' ? safe.metadata : {};
                const channelSource = safe.channels && typeof safe.channels === 'object' ? safe.channels : {};

                const vitalsSource = channelSource.biometric ?? safe.vitals ?? safe.biometric ?? null;
                const ambientSource = channelSource.ambient ?? safe.environment ?? null;

                const channels = {};

                const vitalsChannel = this.normalizeWearableChannel('biometric', vitalsSource, {
                    schemaType: 'biometric',
                    defaultConfidence: 0.78,
                    missingConfidence: 0,
                    confidence: safe.quality?.vitals ?? safe.quality?.overall,
                    issues,
                    required: true,
                    confidenceField: 'channels.biometric.confidence'
                });
                if (vitalsChannel) {
                    if (vitalsSource && typeof vitalsSource === 'object') {
                        if ('oxygen' in vitalsSource) {
                            vitalsChannel.payload.oxygen = this.ensureNumber(vitalsSource.oxygen, {
                                field: 'channels.biometric.oxygen',
                                min: 0,
                                max: 1,
                                defaultValue: 0.97,
                                precision: 2,
                                issues
                            });
                        }
                        if ('hrv' in vitalsSource) {
                            vitalsChannel.payload.hrv = this.ensureNumber(vitalsSource.hrv, {
                                field: 'channels.biometric.hrv',
                                min: 0,
                                max: 250,
                                defaultValue: 42,
                                precision: 1,
                                issues
                            });
                        }
                    }
                    channels.biometric = vitalsChannel;
                }

                const ambientChannel = this.normalizeWearableChannel('ambient', ambientSource, {
                    schemaType: 'ambient',
                    defaultConfidence: 0.6,
                    confidence: safe.quality?.environment ?? safe.quality?.motion,
                    issues,
                    confidenceField: 'channels.ambient.confidence'
                });
                if (ambientChannel) {
                    if (ambientSource && typeof ambientSource === 'object') {
                        if ('humidity' in ambientSource) {
                            ambientChannel.payload.humidity = this.ensureNumber(ambientSource.humidity, {
                                field: 'channels.ambient.humidity',
                                min: 0,
                                max: 1,
                                defaultValue: 0.45,
                                precision: 2,
                                issues
                            });
                        }
                        if ('temperature' in ambientSource) {
                            ambientChannel.payload.temperature = this.ensureNumber(ambientSource.temperature, {
                                field: 'channels.ambient.temperature',
                                min: -10,
                                max: 50,
                                defaultValue: 22,
                                precision: 1,
                                issues
                            });
                        }
                    }
                    channels.ambient = ambientChannel;
                }

                const metadata = {};
                const batterySource = safe.batteryLevel ?? metadataSource.batteryLevel;
                if (batterySource !== undefined) {
                    metadata.batteryLevel = this.ensureNumber(batterySource, {
                        field: 'metadata.batteryLevel',
                        min: 0,
                        max: 1,
                        defaultValue: 1,
                        precision: 2,
                        issues
                    });
                }

                const contactSource = safe.skinContact ?? metadataSource.skinContact;
                if (contactSource !== undefined) {
                    metadata.skinContact = this.ensureBoolean(contactSource, {
                        field: 'metadata.skinContact',
                        defaultValue: true,
                        issues
                    });
                }

                const lastSyncSource = safe.lastSync ?? metadataSource.lastSync;
                if (lastSyncSource) {
                    const syncDate = new Date(lastSyncSource);
                    metadata.lastSync = Number.isNaN(syncDate.getTime()) ? null : syncDate.toISOString();
                    if (metadata.lastSync === null) {
                        issues.push({
                            field: 'metadata.lastSync',
                            code: 'invalid',
                            message: 'lastSync is not a valid timestamp.'
                        });
                    }
                }

                if (safe.motion && typeof safe.motion === 'object') {
                    metadata.motion = {
                        acceleration: {
                            x: this.ensureNumber(safe.motion.acceleration?.x, {
                                field: 'metadata.motion.acceleration.x',
                                min: -16,
                                max: 16,
                                defaultValue: 0,
                                precision: 2,
                                issues
                            }),
                            y: this.ensureNumber(safe.motion.acceleration?.y, {
                                field: 'metadata.motion.acceleration.y',
                                min: -16,
                                max: 16,
                                defaultValue: 0,
                                precision: 2,
                                issues
                            }),
                            z: this.ensureNumber(safe.motion.acceleration?.z, {
                                field: 'metadata.motion.acceleration.z',
                                min: -16,
                                max: 16,
                                defaultValue: 0,
                                precision: 2,
                                issues
                            })
                        }
                    };
                }

                if (safe.deviceTemperature !== undefined) {
                    metadata.deviceTemperature = this.ensureNumber(safe.deviceTemperature, {
                        field: 'metadata.deviceTemperature',
                        min: 20,
                        max: 50,
                        defaultValue: 32,
                        precision: 1,
                        issues
                    });
                }

                const metadataEntries = Object.entries(metadata)
                    .filter(([, value]) => value !== undefined && value !== null
                        && (!(typeof value === 'object') || Object.keys(value).length > 0));
                const normalizedMetadata = metadataEntries.length ? Object.fromEntries(metadataEntries) : {};

                const firmwareVersion = this.ensureString(safe.firmwareVersion ?? metadataSource.firmwareVersion, {
                    field: 'firmwareVersion',
                    allowEmpty: true,
                    fallback: null,
                    issues
                });

                const deviceId = this.ensureString(safe.deviceId ?? metadataSource.deviceId, {
                    field: 'deviceId',
                    allowEmpty: false,
                    fallback: 'wearable.biometric-wrist',
                    issues
                }) || 'wearable.biometric-wrist';

                const confidence = this.ensureNumber(
                    safe.confidence ?? safe.quality?.overall,
                    {
                        field: 'confidence',
                        min: 0,
                        max: 1,
                        defaultValue: vitalsChannel?.confidence ?? 0.78,
                        issues
                    }
                );

                return {
                    payload: {
                        deviceId,
                        firmwareVersion,
                        channels,
                        metadata: normalizedMetadata
                    },
                    issues
                };
            },
            fallback: {
                deviceId: 'wearable.biometric-wrist',
                firmwareVersion: null,
                channels: {
                    biometric: { confidence: 0, payload: { stress: 0.2, heartRate: 68, temperature: 36.4 } },
                    ambient: { confidence: 0, payload: { luminance: 0.5, noiseLevel: 0.2, motion: 0.1 } }
                },
                metadata: {}
            }
        });
    }
}
