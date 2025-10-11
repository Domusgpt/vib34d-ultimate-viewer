import { BaseWearableDeviceAdapter } from './BaseWearableDeviceAdapter.js';

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getPath = (source, path) => {
    if (!path) return undefined;
    const parts = String(path).split('.');
    let current = source;
    for (const part of parts) {
        if (!current || typeof current !== 'object') {
            return undefined;
        }
        current = current[part];
    }
    return current;
};

const pickFirst = (source, paths) => {
    for (const path of paths) {
        const value = getPath(source, path);
        if (value !== undefined && value !== null) {
            return value;
        }
    }
    return undefined;
};

const cloneChannelPayload = value => {
    if (!isPlainObject(value)) {
        return {};
    }
    if (isPlainObject(value.payload)) {
        return { ...value.payload };
    }
    const { confidence, ...rest } = value;
    return { ...rest };
};

const firstNumber = (...candidates) => {
    for (const candidate of candidates) {
        const numeric = Number(candidate);
        if (Number.isFinite(numeric)) {
            return numeric;
        }
    }
    return undefined;
};

const assignIfDefined = (target, key, value, clone = false) => {
    if (value === undefined || value === null) {
        return;
    }
    if (clone && isPlainObject(value)) {
        target[key] = { ...value };
        return;
    }
    target[key] = value;
};

const ensureConfidence = (value, fallback) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        return numeric;
    }
    return fallback;
};

export class ARVisorWearableAdapter extends BaseWearableDeviceAdapter {
    constructor(options = {}) {
        super({
            schemaType: 'wearable.ar-visor',
            requiredLicenseFeature: options.requiredLicenseFeature || 'wearables-ar-visor',
            defaultConfidence: options.defaultConfidence ?? 0.82,
            ...options
        });

        this.defaultFieldOfView = {
            horizontal: 96,
            vertical: 89,
            diagonal: 110,
            ...(options.defaultFieldOfView || {})
        };
    }

    normalizeSample(raw = {}) {
        const safe = isPlainObject(raw) ? raw : {};
        const composite = {
            deviceId: safe.deviceId ?? this.deviceId,
            firmwareVersion: pickFirst(safe, ['firmwareVersion', 'metadata.firmwareVersion']) ?? this.firmwareVersion ?? null,
            channels: {},
            metadata: {}
        };

        const gazeSource = pickFirst(safe, ['channels.eye-tracking', 'gaze', 'focus']);
        if (gazeSource) {
            const payload = cloneChannelPayload(gazeSource);
            const confidence = firstNumber(
                gazeSource.confidence,
                safe.focusConfidence,
                getPath(safe, 'quality.focus')
            );
            composite.channels['eye-tracking'] = {
                payload,
                confidence: ensureConfidence(confidence, this.defaultConfidence)
            };
        }

        const ambientSource = pickFirst(safe, ['channels.ambient', 'environment']);
        if (ambientSource) {
            const payload = cloneChannelPayload(ambientSource);
            const confidence = firstNumber(
                ambientSource.confidence,
                getPath(safe, 'quality.environment')
            );
            composite.channels.ambient = {
                payload,
                confidence: ensureConfidence(confidence, this.defaultConfidence * 0.8)
            };
        }

        const gestureSource = pickFirst(safe, ['channels.gesture', 'gesture']);
        if (gestureSource) {
            const payload = cloneChannelPayload(gestureSource);
            const confidence = firstNumber(
                gestureSource.confidence,
                getPath(safe, 'quality.gesture'),
                getPath(safe, 'quality.focus')
            );
            composite.channels.gesture = {
                payload,
                confidence: ensureConfidence(confidence, this.defaultConfidence * 0.75)
            };
        }

        const fieldOfView = {
            ...this.defaultFieldOfView,
            ...(pickFirst(safe, ['metadata.fieldOfView', 'fieldOfView']) || {})
        };
        if (Object.keys(fieldOfView).length) {
            composite.metadata.fieldOfView = fieldOfView;
        }

        const pose = pickFirst(safe, ['metadata.pose', 'pose']);
        if (isPlainObject(pose)) {
            const normalizedPose = {};
            if (isPlainObject(pose.orientation)) {
                normalizedPose.orientation = { ...pose.orientation };
            }
            if (isPlainObject(pose.position)) {
                normalizedPose.position = { ...pose.position };
            }
            if (Object.keys(normalizedPose).length) {
                composite.metadata.pose = normalizedPose;
            }
        }

        assignIfDefined(
            composite.metadata,
            'batteryLevel',
            firstNumber(safe.batteryLevel, getPath(safe, 'metadata.batteryLevel'))
        );
        assignIfDefined(
            composite.metadata,
            'deviceTemperature',
            firstNumber(
                safe.deviceTemperature,
                getPath(safe, 'metadata.deviceTemperature'),
                getPath(safe, 'environment.temperature')
            )
        );
        assignIfDefined(
            composite.metadata,
            'uptimeSeconds',
            firstNumber(safe.uptimeSeconds, getPath(safe, 'metadata.uptimeSeconds'))
        );
        assignIfDefined(composite.metadata, 'optics', pickFirst(safe, ['metadata.optics', 'optics']), true);

        if (Object.keys(composite.metadata).length === 0) {
            delete composite.metadata;
        }

        for (const channel of Object.values(composite.channels)) {
            if (channel.confidence === undefined) {
                channel.confidence = this.defaultConfidence;
            }
        }

        const confidence = ensureConfidence(
            firstNumber(
                safe.confidence,
                getPath(safe, 'quality.overall'),
                composite.channels['eye-tracking']?.confidence
            ),
            this.defaultConfidence
        );

        return {
            confidence,
            payload: composite
        };
    }
}

