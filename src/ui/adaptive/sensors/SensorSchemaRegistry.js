/**
 * SensorSchemaRegistry
 * ------------------------------------------------------------
 * Normalizes heterogeneous sensor payloads before they are applied to
 * higher-level adaptive behaviours. The registry ships with baseline schemas
 * for the core focus/intent/biometric channels and can be extended at runtime
 * with wearables-specific composite payloads.
 */

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

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getPath = (source, path) => {
    if (!path) return undefined;
    const parts = Array.isArray(path) ? path : String(path).split('.');
    let current = source;
    for (const part of parts) {
        if (!current || typeof current !== 'object') {
            return undefined;
        }
        current = current[part];
    }
    return current;
};

const firstPresent = values => {
    for (const value of values) {
        if (value !== undefined && value !== null) {
            return value;
        }
    }
    return undefined;
};

const compactObject = value => {
    if (!isPlainObject(value)) return undefined;
    const entries = Object.entries(value)
        .filter(([, entry]) => entry !== undefined && entry !== null);
    if (entries.length === 0) {
        return undefined;
    }
    return Object.fromEntries(entries);
};

const sanitizeNumberArray = (registry, source, field, options = {}) => {
    if (!Array.isArray(source) || source.length === 0) {
        return undefined;
    }
    const sanitized = source.map((entry, index) => registry.ensureNumber(entry, {
        ...options,
        field: `${field}.${index}`
    }));
    return sanitized.length ? sanitized : undefined;
};

const createWearableCompositeSchema = config => ({
    normalize(payload = {}, registry) {
        const issues = [];
        const safe = isPlainObject(payload) ? payload : {};

        const deviceId = registry.ensureString(
            firstPresent([
                safe.deviceId,
                config.defaultDeviceId
            ]),
            {
                field: 'deviceId',
                allowEmpty: false,
                defaultValue: config.defaultDeviceId || 'wearable-device',
                issues
            }
        );

        const firmwareVersion = registry.ensureOptionalString(
            firstPresent([
                safe.firmwareVersion,
                getPath(safe, 'metadata.firmwareVersion')
            ]),
            {
                field: 'firmwareVersion',
                defaultValue: null,
                issues
            }
        );

        const channels = {};
        for (const channelConfig of config.channels || []) {
            const rawSource = channelConfig.fromRaw
                ? channelConfig.fromRaw(safe)
                : firstPresent((channelConfig.sources || []).map(source => getPath(safe, source)));

            if (!rawSource) {
                if (channelConfig.required) {
                    issues.push({
                        field: `channels.${channelConfig.channel}`,
                        code: 'missing',
                        message: `${channelConfig.channel} channel is required.`
                    });
                }
                continue;
            }

            const sourcePayload = isPlainObject(rawSource.payload)
                ? rawSource.payload
                : (isPlainObject(rawSource) ? rawSource : {});

            const { payload: channelPayload, issues: channelIssues } = registry.validate(
                channelConfig.schema,
                sourcePayload
            );

            if (Array.isArray(channelIssues) && channelIssues.length) {
                for (const issue of channelIssues) {
                    issues.push({
                        field: issue.field && issue.field !== '*'
                            ? `channels.${channelConfig.channel}.${issue.field}`
                            : `channels.${channelConfig.channel}`,
                        code: issue.code,
                        message: issue.message
                    });
                }
            }

            if (typeof channelConfig.extend === 'function') {
                channelConfig.extend(channelPayload, rawSource, { registry, issues });
            }

            const confidenceCandidates = [];
            if (Array.isArray(channelConfig.confidencePaths)) {
                for (const path of channelConfig.confidencePaths) {
                    confidenceCandidates.push(getPath({ source: rawSource, root: safe }, path));
                }
            } else if (typeof channelConfig.confidence === 'function') {
                confidenceCandidates.push(channelConfig.confidence(rawSource, safe));
            } else if (channelConfig.confidence !== undefined) {
                confidenceCandidates.push(channelConfig.confidence);
            } else {
                confidenceCandidates.push(rawSource.confidence);
            }

            const confidence = registry.ensureNumber(
                firstPresent(confidenceCandidates),
                {
                    field: `channels.${channelConfig.channel}.confidence`,
                    min: 0,
                    max: 1,
                    defaultValue: channelConfig.defaultConfidence ?? 1,
                    issues
                }
            );

            channels[channelConfig.channel] = {
                payload: channelPayload,
                confidence
            };
        }

        let metadata;
        if (typeof config.metadata === 'function') {
            metadata = compactObject(config.metadata(safe, { registry, issues }, config));
        }

        const normalized = {
            deviceId,
            firmwareVersion,
            channels
        };

        if (metadata && Object.keys(metadata).length) {
            normalized.metadata = metadata;
        }

        return { payload: normalized, issues };
    }
});

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

    loadCustomSchemas(schemas) {
        if (Array.isArray(schemas)) {
            for (const entry of schemas) {
                if (!entry) continue;
                if (Array.isArray(entry) && entry.length === 2) {
                    this.register(entry[0], entry[1]);
                } else if (typeof entry === 'object' && entry.type && entry.schema) {
                    this.register(entry.type, entry.schema);
                }
            }
            return;
        }

        if (isPlainObject(schemas)) {
            for (const [type, schema] of Object.entries(schemas)) {
                this.register(type, schema);
            }
        }
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
                return {
                    payload: {},
                    issues: [{ field: '*', code: 'schema-invalid-return', message: 'Schema normalize must return an object.' }]
                };
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
                issues: [{ field: '*', code: 'schema-error', message: error?.message || 'Schema normalization failed.' }]
            };
        }
    }

    registerDefaultSchemas() {
        this.register('eye-tracking', {
            normalize: payload => {
                const issues = [];
                const safe = isPlainObject(payload) ? payload : {};
                const normalized = {
                    x: this.ensureNumber(safe.x, { field: 'x', min: 0, max: 1, defaultValue: 0.5, precision: 3, issues }),
                    y: this.ensureNumber(safe.y, { field: 'y', min: 0, max: 1, defaultValue: 0.5, precision: 3, issues }),
                    depth: this.ensureNumber(safe.depth, { field: 'depth', min: 0, max: 1, defaultValue: 0.3, precision: 3, issues })
                };

                if (safe.vergence !== undefined) {
                    normalized.vergence = this.ensureNumber(safe.vergence, { field: 'vergence', min: 0, max: 5, defaultValue: 0, precision: 2, issues });
                }
                if (safe.stability !== undefined) {
                    normalized.stability = this.ensureNumber(safe.stability, { field: 'stability', min: 0, max: 1, defaultValue: 0.5, precision: 2, issues });
                }
                if (safe.blinkRate !== undefined) {
                    normalized.blinkRate = this.ensureNumber(safe.blinkRate, { field: 'blinkRate', min: 0, max: 2.5, defaultValue: 0.2, precision: 2, issues });
                }
                if (safe.fixation !== undefined) {
                    normalized.fixation = this.ensureNumber(safe.fixation, { field: 'fixation', min: 0, max: 1, defaultValue: 0, precision: 3, issues });
                }

                return { payload: normalized, issues };
            },
            fallback: { x: 0.5, y: 0.5, depth: 0.3 }
        });

        this.register('neural-intent', {
            normalize: payload => {
                const issues = [];
                const safe = isPlainObject(payload) ? payload : {};
                const normalized = {
                    x: this.ensureNumber(safe.x, { field: 'x', min: -1, max: 1, defaultValue: 0, precision: 3, issues }),
                    y: this.ensureNumber(safe.y, { field: 'y', min: -1, max: 1, defaultValue: 0, precision: 3, issues }),
                    z: this.ensureNumber(safe.z, { field: 'z', min: -1, max: 1, defaultValue: 0, precision: 3, issues }),
                    w: this.ensureNumber(safe.w, { field: 'w', min: -1, max: 1, defaultValue: 0, precision: 3, issues }),
                    engagement: this.ensureNumber(safe.engagement, { field: 'engagement', min: 0, max: 1, defaultValue: 0.4, precision: 3, issues })
                };

                if (safe.signalToNoise !== undefined) {
                    normalized.signalToNoise = this.ensureNumber(safe.signalToNoise, { field: 'signalToNoise', min: 0, max: 60, defaultValue: 0, precision: 2, issues });
                }
                if (safe.bandwidth !== undefined) {
                    normalized.bandwidth = this.ensureNumber(safe.bandwidth, { field: 'bandwidth', min: 0, max: 200, defaultValue: 0, precision: 2, issues });
                }

                return { payload: normalized, issues };
            },
            fallback: { x: 0, y: 0, z: 0, w: 0, engagement: 0.4 }
        });

        this.register('biometric', {
            normalize: payload => {
                const issues = [];
                const safe = isPlainObject(payload) ? payload : {};
                const normalized = {
                    stress: this.ensureNumber(safe.stress, { field: 'stress', min: 0, max: 1, defaultValue: 0.2, precision: 3, issues }),
                    heartRate: this.ensureInteger(safe.heartRate, { field: 'heartRate', min: 30, max: 220, defaultValue: 68, issues }),
                    temperature: this.ensureNumber(safe.temperature, { field: 'temperature', min: 32, max: 40, defaultValue: 36.4, precision: 1, issues })
                };

                if (safe.oxygen !== undefined) {
                    normalized.oxygen = this.ensureNumber(safe.oxygen, { field: 'oxygen', min: 0, max: 1, defaultValue: 0.95, precision: 3, issues });
                }
                if (safe.hrv !== undefined) {
                    normalized.hrv = this.ensureInteger(safe.hrv, { field: 'hrv', min: 10, max: 200, defaultValue: 52, issues });
                }

                return { payload: normalized, issues };
            },
            fallback: { stress: 0.2, heartRate: 68, temperature: 36.4 }
        });

        this.register('ambient', {
            normalize: payload => {
                const issues = [];
                const safe = isPlainObject(payload) ? payload : {};
                const normalized = {
                    luminance: this.ensureNumber(safe.luminance, { field: 'luminance', min: 0, max: 1, defaultValue: 0.5, precision: 3, issues }),
                    noiseLevel: this.ensureNumber(safe.noiseLevel, { field: 'noiseLevel', min: 0, max: 1, defaultValue: 0.2, precision: 3, issues }),
                    motion: this.ensureNumber(safe.motion, { field: 'motion', min: 0, max: 1, defaultValue: 0.1, precision: 3, issues })
                };

                if (safe.temperature !== undefined) {
                    normalized.temperature = this.ensureNumber(safe.temperature, { field: 'temperature', min: -20, max: 60, defaultValue: 22, precision: 1, issues });
                }
                if (safe.humidity !== undefined) {
                    normalized.humidity = this.ensureNumber(safe.humidity, { field: 'humidity', min: 0, max: 1, defaultValue: 0.5, precision: 3, issues });
                }

                return { payload: normalized, issues };
            },
            fallback: { luminance: 0.5, noiseLevel: 0.2, motion: 0.1 }
        });

        this.register('gesture', {
            normalize: payload => {
                const issues = [];
                const safe = isPlainObject(payload) ? payload : {};
                const normalized = {
                    intent: this.ensureString(safe.intent, { field: 'intent', allowEmpty: true, defaultValue: null, issues }),
                    vector: this.ensureVector(safe.vector, { field: 'vector', min: -1, max: 1, defaultValue: 0, issues })
                };

                if (safe.intentStrength !== undefined) {
                    normalized.intentStrength = this.ensureNumber(safe.intentStrength, { field: 'intentStrength', min: 0, max: 1, defaultValue: 0, precision: 2, issues });
                }

                return { payload: normalized, issues };
            },
            fallback: { intent: null, vector: { x: 0, y: 0, z: 0 } }
        });

        this.registerWearableSchemas();
    }

    registerWearableSchemas() {
        this.register('wearable.ar-visor', createWearableCompositeSchema({
            defaultDeviceId: 'wearable.ar-visor',
            fieldOfViewDefaults: { horizontal: 110, vertical: 90, diagonal: 120 },
            channels: [
                {
                    channel: 'eye-tracking',
                    schema: 'eye-tracking',
                    sources: ['channels.eye-tracking', 'gaze', 'focus'],
                    required: true,
                    defaultConfidence: 0.82,
                    confidencePaths: ['source.confidence', 'root.focusConfidence', 'root.quality.focus'],
                    extend: (payload, source, { registry, issues }) => {
                        if (source && source.vergence !== undefined) {
                            payload.vergence = registry.ensureNumber(source.vergence, { field: 'channels.eye-tracking.vergence', min: 0, max: 5, defaultValue: 0, precision: 2, issues });
                        }
                        if (source && source.stability !== undefined) {
                            payload.stability = registry.ensureNumber(source.stability, { field: 'channels.eye-tracking.stability', min: 0, max: 1, defaultValue: 0.5, precision: 2, issues });
                        }
                        if (source && source.blinkRate !== undefined) {
                            payload.blinkRate = registry.ensureNumber(source.blinkRate, { field: 'channels.eye-tracking.blinkRate', min: 0, max: 2.5, defaultValue: 0.2, precision: 2, issues });
                        }
                    }
                },
                {
                    channel: 'ambient',
                    schema: 'ambient',
                    sources: ['channels.ambient', 'environment'],
                    defaultConfidence: 0.65,
                    confidencePaths: ['source.confidence', 'root.quality.environment'],
                    extend: (payload, source, { registry, issues }) => {
                        if (source && source.temperature !== undefined) {
                            payload.temperature = registry.ensureNumber(source.temperature, { field: 'channels.ambient.temperature', min: -20, max: 60, defaultValue: 22, precision: 1, issues });
                        }
                    }
                },
                {
                    channel: 'gesture',
                    schema: 'gesture',
                    sources: ['channels.gesture', 'gesture'],
                    defaultConfidence: 0.6,
                    confidencePaths: ['source.confidence', 'root.quality.gesture', 'root.quality.focus']
                }
            ],
            metadata: (root, { registry, issues }, schemaConfig) => {
                const metadata = {};
                const fieldOfViewSource = firstPresent([
                    getPath(root, 'metadata.fieldOfView'),
                    root.fieldOfView
                ]);
                if (isPlainObject(fieldOfViewSource) || schemaConfig.fieldOfViewDefaults) {
                    const defaults = schemaConfig.fieldOfViewDefaults || {};
                    const fieldOfView = {
                        horizontal: registry.ensureNumber(fieldOfViewSource?.horizontal ?? defaults.horizontal ?? 110, { field: 'metadata.fieldOfView.horizontal', min: 40, max: 160, defaultValue: 110, issues }),
                        vertical: registry.ensureNumber(fieldOfViewSource?.vertical ?? defaults.vertical ?? 90, { field: 'metadata.fieldOfView.vertical', min: 30, max: 140, defaultValue: 90, issues })
                    };
                    if (fieldOfViewSource?.diagonal !== undefined || defaults.diagonal !== undefined) {
                        fieldOfView.diagonal = registry.ensureNumber(fieldOfViewSource?.diagonal ?? defaults.diagonal ?? 120, { field: 'metadata.fieldOfView.diagonal', min: 40, max: 180, defaultValue: 120, issues });
                    }
                    metadata.fieldOfView = fieldOfView;
                }

                const poseSource = firstPresent([
                    getPath(root, 'metadata.pose'),
                    root.pose
                ]);
                if (isPlainObject(poseSource)) {
                    const pose = {};
                    if (poseSource.orientation) {
                        pose.orientation = registry.ensureQuaternion(poseSource.orientation, { field: 'metadata.pose.orientation' });
                    }
                    if (poseSource.position) {
                        pose.position = registry.ensureVector(poseSource.position, { field: 'metadata.pose.position', defaultValue: 0 });
                    }
                    if (Object.keys(pose).length) {
                        metadata.pose = pose;
                    }
                }

                const batteryLevel = firstPresent([root.batteryLevel, getPath(root, 'metadata.batteryLevel')]);
                if (batteryLevel !== undefined) {
                    metadata.batteryLevel = registry.ensureNumber(batteryLevel, { field: 'metadata.batteryLevel', min: 0, max: 1, defaultValue: 1, issues });
                }

                const deviceTemperature = firstPresent([
                    root.deviceTemperature,
                    getPath(root, 'metadata.deviceTemperature'),
                    getPath(root, 'environment.temperature')
                ]);
                if (deviceTemperature !== undefined) {
                    metadata.deviceTemperature = registry.ensureNumber(deviceTemperature, { field: 'metadata.deviceTemperature', min: -20, max: 90, defaultValue: 35, precision: 1, issues });
                }

                const uptimeSeconds = firstPresent([root.uptimeSeconds, getPath(root, 'metadata.uptimeSeconds')]);
                if (uptimeSeconds !== undefined) {
                    metadata.uptimeSeconds = registry.ensureNumber(uptimeSeconds, { field: 'metadata.uptimeSeconds', min: 0, max: 604800, defaultValue: 0, issues });
                }

                const optics = firstPresent([getPath(root, 'metadata.optics'), root.optics]);
                if (isPlainObject(optics)) {
                    metadata.optics = { ...optics };
                }

                return metadata;
            }
        }));

        this.register('wearable.neural-band', createWearableCompositeSchema({
            defaultDeviceId: 'wearable.neural-band',
            channels: [
                {
                    channel: 'neural-intent',
                    schema: 'neural-intent',
                    sources: ['channels.neural-intent', 'intent', 'signal'],
                    required: true,
                    defaultConfidence: 0.7,
                    confidencePaths: ['source.confidence', 'root.signalQuality.overall', 'root.quality.intent']
                },
                {
                    channel: 'gesture',
                    schema: 'gesture',
                    sources: ['channels.gesture', 'gesture'],
                    defaultConfidence: 0.6,
                    confidencePaths: ['source.confidence', 'root.quality.gesture']
                }
            ],
            metadata: (root, { registry, issues }) => {
                const metadata = {};

                const signalQualitySource = firstPresent([
                    getPath(root, 'metadata.signalQuality'),
                    root.signalQuality
                ]);
                if (isPlainObject(signalQualitySource)) {
                    const quality = {};
                    if (signalQualitySource.overall !== undefined) {
                        quality.overall = registry.ensureNumber(signalQualitySource.overall, { field: 'metadata.signalQuality.overall', min: 0, max: 1, defaultValue: 0.5 });
                    }
                    if (signalQualitySource.contacts) {
                        quality.contacts = sanitizeNumberArray(registry, signalQualitySource.contacts, 'metadata.signalQuality.contacts', { min: 0, max: 1, defaultValue: 0.5, issues });
                    }
                    if (Object.keys(quality).length) {
                        metadata.signalQuality = quality;
                    }
                }

                const impedanceSource = firstPresent([
                    getPath(root, 'metadata.impedance'),
                    root.impedance
                ]);
                if (isPlainObject(impedanceSource)) {
                    metadata.impedance = {
                        average: registry.ensureNumber(impedanceSource.average, { field: 'metadata.impedance.average', min: 0, max: 500, defaultValue: 0 }),
                        variance: registry.ensureNumber(impedanceSource.variance, { field: 'metadata.impedance.variance', min: 0, max: 500, defaultValue: 0 })
                    };
                }

                const contactState = firstPresent([
                    getPath(root, 'metadata.contact.state'),
                    root.contactState
                ]);
                const electrodes = firstPresent([
                    getPath(root, 'metadata.contact.electrodes'),
                    root.electrodes
                ]);
                if (contactState !== undefined || electrodes !== undefined) {
                    const contact = {};
                    if (contactState !== undefined) {
                        contact.state = registry.ensureString(contactState, { field: 'metadata.contact.state', allowEmpty: true, defaultValue: null, issues });
                    }
                    const sanitizedElectrodes = sanitizeNumberArray(registry, electrodes, 'metadata.contact.electrodes', { min: 0, max: 1, defaultValue: 0.5, issues });
                    if (sanitizedElectrodes) {
                        contact.electrodes = sanitizedElectrodes;
                    }
                    if (Object.keys(contact).length) {
                        metadata.contact = contact;
                    }
                }

                const bandSource = firstPresent([
                    getPath(root, 'metadata.band'),
                    root.band
                ]);
                if (isPlainObject(bandSource)) {
                    const band = {};
                    if (bandSource.firmware !== undefined) {
                        band.firmware = registry.ensureOptionalString(bandSource.firmware, { field: 'metadata.band.firmware', defaultValue: null });
                    }
                    if (bandSource.hardwareRevision !== undefined) {
                        band.hardwareRevision = registry.ensureOptionalString(bandSource.hardwareRevision, { field: 'metadata.band.hardwareRevision', defaultValue: null });
                    }
                    if (Object.keys(band).length) {
                        metadata.band = band;
                    }
                }

                const deviceTemperature = firstPresent([root.temperature, getPath(root, 'metadata.deviceTemperature')]);
                if (deviceTemperature !== undefined) {
                    metadata.deviceTemperature = registry.ensureNumber(deviceTemperature, { field: 'metadata.deviceTemperature', min: 0, max: 60, defaultValue: 33, precision: 1 });
                }

                return metadata;
            }
        }));

        this.register('wearable.biometric-wrist', createWearableCompositeSchema({
            defaultDeviceId: 'wearable.biometric-wrist',
            channels: [
                {
                    channel: 'biometric',
                    schema: 'biometric',
                    sources: ['channels.biometric', 'vitals', 'biometric'],
                    required: true,
                    defaultConfidence: 0.75,
                    confidencePaths: ['source.confidence', 'root.quality.vitals', 'root.quality.overall']
                },
                {
                    channel: 'ambient',
                    schema: 'ambient',
                    sources: ['channels.ambient', 'environment'],
                    defaultConfidence: 0.6,
                    confidencePaths: ['source.confidence', 'root.quality.environment', 'root.quality.motion']
                }
            ],
            metadata: (root, { registry, issues }) => {
                const metadata = {};

                const batteryLevel = firstPresent([root.batteryLevel, getPath(root, 'metadata.batteryLevel')]);
                if (batteryLevel !== undefined) {
                    metadata.batteryLevel = registry.ensureNumber(batteryLevel, { field: 'metadata.batteryLevel', min: 0, max: 1, defaultValue: 1 });
                }

                const skinContact = firstPresent([root.skinContact, getPath(root, 'metadata.skinContact')]);
                if (skinContact !== undefined) {
                    metadata.skinContact = registry.ensureBoolean(skinContact, { field: 'metadata.skinContact', defaultValue: false, issues });
                }

                const lastSync = firstPresent([root.lastSync, getPath(root, 'metadata.lastSync')]);
                if (lastSync !== undefined) {
                    metadata.lastSync = registry.ensureOptionalString(lastSync, { field: 'metadata.lastSync', defaultValue: null });
                }

                const motionSource = firstPresent([
                    getPath(root, 'metadata.motion'),
                    root.motion
                ]);
                if (isPlainObject(motionSource)) {
                    const motion = {};
                    if (motionSource.acceleration) {
                        motion.acceleration = registry.ensureVector(motionSource.acceleration, { field: 'metadata.motion.acceleration', defaultValue: 0 });
                    }
                    if (Object.keys(motion).length) {
                        metadata.motion = motion;
                    }
                }

                const deviceTemperature = firstPresent([root.deviceTemperature, getPath(root, 'metadata.deviceTemperature')]);
                if (deviceTemperature !== undefined) {
                    metadata.deviceTemperature = registry.ensureNumber(deviceTemperature, { field: 'metadata.deviceTemperature', min: 0, max: 60, defaultValue: 33, precision: 1 });
                }

                const alerts = firstPresent([root.alerts, getPath(root, 'metadata.alerts')]);
                if (Array.isArray(alerts)) {
                    const sanitizedAlerts = alerts
                        .map((entry, index) => {
                            if (typeof entry === 'string') {
                                const trimmed = entry.trim();
                                if (trimmed) return trimmed;
                            }
                            issues.push({ field: `metadata.alerts.${index}`, code: 'type', message: 'Alert entries must be non-empty strings.' });
                            return null;
                        })
                        .filter(Boolean);
                    if (sanitizedAlerts.length) {
                        metadata.alerts = sanitizedAlerts;
                    }
                }

                return metadata;
            }
        }));
    }

    ensureNumber(value, { field, min = -Infinity, max = Infinity, defaultValue = 0, precision, issues } = {}) {
        let numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            numeric = defaultValue;
            issues?.push({ field, code: 'type', message: `${field} must be a finite number.` });
        }

        if (typeof min === 'number' && numeric < min) {
            issues?.push({ field, code: 'min', message: `${field} must be ≥ ${min}.` });
            numeric = min;
        }
        if (typeof max === 'number' && numeric > max) {
            issues?.push({ field, code: 'max', message: `${field} must be ≤ ${max}.` });
            numeric = max;
        }

        if (typeof precision === 'number' && Number.isFinite(precision) && precision >= 0) {
            const factor = 10 ** precision;
            numeric = Math.round(numeric * factor) / factor;
        }

        return numeric;
    }

    ensureOptionalNumber(value, options = {}) {
        if (value === undefined || value === null || value === '') {
            return options.defaultValue;
        }
        return this.ensureNumber(value, options);
    }

    ensureInteger(value, options = {}) {
        const numeric = this.ensureNumber(value, options);
        return Math.round(numeric);
    }

    ensureOptionalInteger(value, options = {}) {
        if (value === undefined || value === null || value === '') {
            return options.defaultValue;
        }
        return this.ensureInteger(value, options);
    }

    ensureBoolean(value, { field, defaultValue = false, issues } = {}) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (value === 'true' || value === 'false') {
            return value === 'true';
        }
        if (Number.isFinite(Number(value))) {
            return Boolean(Number(value));
        }
        issues?.push({ field, code: 'type', message: `${field} must be a boolean.` });
        return defaultValue;
    }

    ensureString(value, { field, allowEmpty = false, defaultValue = '', issues } = {}) {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!allowEmpty && trimmed === '') {
                issues?.push({ field, code: 'empty', message: `${field} must not be empty.` });
                return defaultValue;
            }
            return trimmed;
        }

        if (value === undefined || value === null) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            issues?.push({ field, code: 'missing', message: `${field} is required.` });
            return '';
        }

        if (typeof value.toString === 'function') {
            return this.ensureString(value.toString(), { field, allowEmpty, defaultValue, issues });
        }

        issues?.push({ field, code: 'type', message: `${field} must be a string.` });
        return defaultValue;
    }

    ensureOptionalString(value, options = {}) {
        if (value === undefined || value === null || value === '') {
            return options.defaultValue ?? null;
        }
        return this.ensureString(value, { ...options, allowEmpty: true });
    }

    ensureVector(value, { field, min = -Infinity, max = Infinity, defaultValue = 0, issues } = {}) {
        const safe = isPlainObject(value) ? value : {};
        return {
            x: this.ensureNumber(safe.x, { field: `${field}.x`, min, max, defaultValue, issues }),
            y: this.ensureNumber(safe.y, { field: `${field}.y`, min, max, defaultValue, issues }),
            z: this.ensureNumber(safe.z, { field: `${field}.z`, min, max, defaultValue, issues })
        };
    }

    ensureQuaternion(value, { field, issues } = {}) {
        const safe = isPlainObject(value) ? value : {};
        return {
            x: this.ensureNumber(safe.x, { field: `${field}.x`, min: -1, max: 1, defaultValue: 0, issues }),
            y: this.ensureNumber(safe.y, { field: `${field}.y`, min: -1, max: 1, defaultValue: 0, issues }),
            z: this.ensureNumber(safe.z, { field: `${field}.z`, min: -1, max: 1, defaultValue: 0, issues }),
            w: this.ensureNumber(safe.w, { field: `${field}.w`, min: -1, max: 1, defaultValue: 1, issues })
        };
    }
}

