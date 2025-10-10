import { BaseWearableDeviceAdapter } from './BaseWearableDeviceAdapter.js';

const normalizeAcceleration = source => ({
    x: source?.x ?? 0,
    y: source?.y ?? 0,
    z: source?.z ?? 0
});

export class BiometricWristWearableAdapter extends BaseWearableDeviceAdapter {
    constructor(options = {}) {
        super({
            schemaType: 'wearable.biometric-wrist',
            requiredLicenseFeature: options.requiredLicenseFeature || 'wearables-biometric',
            defaultConfidence: options.defaultConfidence ?? 0.78,
            ...options
        });
    }

    normalizeSample(raw = {}) {
        const channels = {};
        const metadata = {};

        const vitals = raw.vitals || raw.biometric || raw.channels?.biometric || null;
        if (vitals) {
            channels.biometric = {
                confidence: vitals.confidence ?? raw.quality?.vitals ?? raw.quality?.overall,
                payload: {
                    stress: vitals.stress,
                    heartRate: vitals.heartRate,
                    temperature: vitals.temperature,
                    oxygen: vitals.oxygen,
                    hrv: vitals.hrv
                }
            };
        }

        const environment = raw.environment || raw.channels?.ambient || null;
        if (environment) {
            channels.ambient = {
                confidence: environment.confidence ?? raw.quality?.environment ?? raw.quality?.motion,
                payload: {
                    luminance: environment.luminance,
                    noiseLevel: environment.noiseLevel,
                    motion: environment.motion,
                    temperature: environment.temperature,
                    humidity: environment.humidity
                }
            };
        }

        const batteryLevel = raw.batteryLevel ?? raw.metadata?.batteryLevel;
        if (batteryLevel !== undefined) {
            metadata.batteryLevel = batteryLevel;
        }

        const skinContact = raw.skinContact ?? raw.metadata?.skinContact;
        if (skinContact !== undefined) {
            metadata.skinContact = skinContact;
        }

        const lastSync = raw.lastSync ?? raw.metadata?.lastSync;
        if (lastSync) {
            metadata.lastSync = lastSync;
        }

        if (raw.motion) {
            metadata.motion = {
                acceleration: normalizeAcceleration(raw.motion.acceleration || raw.motion)
            };
        }

        const deviceTemperature = raw.deviceTemperature ?? raw.metadata?.deviceTemperature;
        if (deviceTemperature !== undefined) {
            metadata.deviceTemperature = deviceTemperature;
        }

        if (raw.alerts) {
            metadata.alerts = Array.isArray(raw.alerts) ? [...raw.alerts] : [raw.alerts];
        }

        const firmwareVersion = raw.firmwareVersion ?? raw.metadata?.firmwareVersion;

        return {
            confidence: raw.confidence ?? raw.quality?.overall ?? channels.biometric?.confidence,
            payload: {
                deviceId: raw.deviceId,
                firmwareVersion,
                channels,
                metadata
            }
        };
    }
}

