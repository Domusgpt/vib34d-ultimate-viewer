import { BaseWearableDeviceAdapter } from './BaseWearableDeviceAdapter.js';

const normalizeElectrode = value => {
    if (!Array.isArray(value)) return undefined;
    return value.map((entry, index) => {
        const numeric = Number(entry);
        if (!Number.isFinite(numeric)) {
            return index % 2 === 0 ? 0.48 : 0.52;
        }
        return numeric;
    });
};

export class NeuralBandWearableAdapter extends BaseWearableDeviceAdapter {
    constructor(options = {}) {
        super({
            schemaType: 'wearable.neural-band',
            requiredLicenseFeature: options.requiredLicenseFeature || 'wearables-neural-band',
            defaultConfidence: options.defaultConfidence ?? 0.7,
            ...options
        });
    }

    normalizeSample(raw = {}) {
        const channels = {};
        const metadata = {};

        const intent = raw.intent || raw.signal || raw.channels?.['neural-intent'] || null;
        if (intent) {
            channels['neural-intent'] = {
                confidence: intent.confidence ?? raw.signalQuality?.overall ?? raw.quality?.intent,
                payload: {
                    x: intent.x,
                    y: intent.y,
                    z: intent.z,
                    w: intent.w,
                    engagement: intent.engagement,
                    signalToNoise: intent.signalToNoise,
                    bandwidth: intent.bandwidth
                }
            };
        }

        const gesture = raw.gesture || raw.channels?.gesture || null;
        if (gesture) {
            channels.gesture = {
                confidence: gesture.confidence ?? raw.quality?.gesture,
                payload: {
                    intent: gesture.intent ?? null,
                    vector: gesture.vector || gesture.direction || { x: 0, y: 0, z: 0 }
                }
            };
        }

        if (raw.signalQuality) {
            metadata.signalQuality = {
                overall: raw.signalQuality.overall,
                contacts: raw.signalQuality.contacts
            };
        }

        if (raw.impedance || raw.metadata?.impedance) {
            const impedance = raw.impedance || raw.metadata?.impedance;
            metadata.impedance = {
                average: impedance.average,
                variance: impedance.variance
            };
        }

        if (raw.contactState !== undefined || raw.metadata?.contactState !== undefined) {
            metadata.contact = {
                state: raw.contactState ?? raw.metadata?.contactState,
                electrodes: normalizeElectrode(raw.electrodes || raw.metadata?.electrodes)
            };
        }

        if (raw.band || raw.metadata?.band) {
            metadata.band = {
                firmware: raw.band?.firmware ?? raw.metadata?.band?.firmware,
                hardwareRevision: raw.band?.hardwareRevision ?? raw.metadata?.band?.hardwareRevision
            };
        }

        if (raw.temperature !== undefined) {
            metadata.deviceTemperature = raw.temperature;
        }

        const firmwareVersion = raw.firmwareVersion ?? raw.metadata?.firmwareVersion;

        return {
            confidence: raw.confidence ?? raw.signalQuality?.overall ?? channels['neural-intent']?.confidence,
            payload: {
                deviceId: raw.deviceId,
                firmwareVersion,
                channels,
                metadata
            }
        };
    }
}

