import { BaseWearableDeviceAdapter } from './BaseWearableDeviceAdapter.js';

const vectorFromHeadset = (source = {}) => ({
    x: Number.isFinite(source.x) ? source.x : 0,
    y: Number.isFinite(source.y) ? source.y : 0,
    z: Number.isFinite(source.z) ? source.z : 0
});

const merge = (...sources) => {
    const output = {};
    for (const source of sources) {
        if (!source || typeof source !== 'object') continue;
        for (const [key, value] of Object.entries(source)) {
            if (value === undefined) continue;
            output[key] = value;
        }
    }
    return output;
};

export class ARVisorWearableAdapter extends BaseWearableDeviceAdapter {
    constructor(options = {}) {
        super({
            schemaType: 'wearable.ar-visor',
            requiredLicenseFeature: options.requiredLicenseFeature || 'wearables-ar-visor',
            defaultConfidence: options.defaultConfidence ?? 0.82,
            ...options
        });

        this.defaultFieldOfView = options.defaultFieldOfView || { horizontal: 96, vertical: 89 };
    }

    normalizeSample(raw = {}) {
        const channels = {};
        const metadata = {};

        const gaze = raw.gaze || raw.focus || raw.channels?.['eye-tracking'] || null;
        if (gaze) {
            channels['eye-tracking'] = {
                confidence: gaze.confidence ?? raw.focusConfidence ?? raw.quality?.focus,
                payload: {
                    x: gaze.x,
                    y: gaze.y,
                    depth: gaze.depth,
                    vergence: gaze.vergence,
                    stability: gaze.stability,
                    blinkRate: gaze.blinkRate,
                    fixation: gaze.fixation
                }
            };
        }

        const environment = raw.environment || raw.channels?.ambient || null;
        if (environment) {
            channels.ambient = {
                confidence: environment.confidence ?? raw.quality?.environment,
                payload: {
                    luminance: environment.luminance,
                    noiseLevel: environment.noiseLevel,
                    motion: environment.motion,
                    temperature: environment.temperature
                }
            };
        }

        const gesture = raw.gesture || raw.channels?.gesture || null;
        if (gesture) {
            const vector = gesture.vector || gesture.orientation || gesture.head || {};
            channels.gesture = {
                confidence: gesture.confidence ?? raw.quality?.gesture ?? raw.quality?.focus,
                payload: {
                    intent: gesture.intent ?? gesture.type ?? null,
                    vector: vectorFromHeadset(vector),
                    intentStrength: gesture.intentStrength
                }
            };
        }

        const pose = raw.pose || {};
        if (pose.orientation || pose.position) {
            metadata.pose = {
                orientation: merge({ x: 0, y: 0, z: 0, w: 1 }, pose.orientation),
                position: merge({ x: 0, y: 0, z: 0 }, pose.position)
            };
        }

        const fieldOfView = merge(this.defaultFieldOfView, raw.fieldOfView, raw.metadata?.fieldOfView);
        if (Object.keys(fieldOfView).length) {
            metadata.fieldOfView = fieldOfView;
        }

        if (raw.optics) {
            metadata.optics = { ...raw.optics };
        }

        const batteryLevel = raw.batteryLevel ?? raw.metadata?.batteryLevel;
        if (batteryLevel !== undefined) {
            metadata.batteryLevel = batteryLevel;
        }

        const deviceTemperature = raw.deviceTemperature ?? raw.metadata?.deviceTemperature ?? environment?.temperature;
        if (deviceTemperature !== undefined) {
            metadata.deviceTemperature = deviceTemperature;
        }

        const uptimeSeconds = raw.uptimeSeconds ?? raw.metadata?.uptimeSeconds;
        if (uptimeSeconds !== undefined) {
            metadata.uptimeSeconds = uptimeSeconds;
        }

        const firmwareVersion = raw.firmwareVersion ?? raw.metadata?.firmwareVersion;

        return {
            confidence: raw.confidence ?? raw.quality?.overall ?? channels['eye-tracking']?.confidence,
            payload: {
                deviceId: raw.deviceId,
                firmwareVersion,
                channels,
                metadata
            }
        };
    }
}

