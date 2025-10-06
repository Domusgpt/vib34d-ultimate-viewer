/**
 * Default modality profiles translating novel wearable inputs
 * into normalized engine parameter targets.
 */

export const MODALITY_PROFILES = {
    eyeFocus: {
        id: 'eyeFocus',
        label: 'Eye Focus Tracking',
        description: 'Maps gaze fixation depth and velocity to spatial layering parameters.',
        inputSchema: {
            fixationDepth: { min: 0, max: 1, defaultValue: 0.5 },
            saccadeVelocity: { min: 0, max: 1, defaultValue: 0.2 },
            dwellTimeMs: { min: 0, max: 2000, defaultValue: 600 }
        },
        parameterTargets: {
            gridDensity: value => 8 + value.fixationDepth * 24,
            morphFactor: value => 0.8 + value.saccadeVelocity * 0.6,
            intensity: value => Math.min(1, value.dwellTimeMs / 1200)
        }
    },
    neuralGesture: {
        id: 'neuralGesture',
        label: 'Neural Gesture Intent',
        description: 'Translates neural interface intents to reactive animation states.',
        inputSchema: {
            activation: { min: 0, max: 1, defaultValue: 0 },
            gestureType: { options: ['expand', 'contract', 'highlight'], defaultValue: 'expand' },
            confidence: { min: 0, max: 1, defaultValue: 0.5 }
        },
        parameterTargets: {
            morphFactor: value => value.gestureType === 'expand' ? 1.5 : value.gestureType === 'contract' ? 0.6 : 1.0,
            intensity: value => 0.3 + value.activation * value.confidence,
            hue: value => value.gestureType === 'highlight' ? 0.12 : 0.6
        }
    },
    ambientSignal: {
        id: 'ambientSignal',
        label: 'Ambient Environment',
        description: 'Balances light and proximity data to adjust accessibility-centric contrast.',
        inputSchema: {
            lightLevel: { min: 0, max: 1, defaultValue: 0.4 },
            proximity: { min: 0, max: 1, defaultValue: 0.5 }
        },
        parameterTargets: {
            contrast: value => 0.6 + (1 - value.lightLevel) * 0.4,
            opacity: value => 0.7 + value.proximity * 0.2
        }
    }
};

/**
 * Creates deep copies of the default modality profiles so consumers can mutate safely.
 */
export function createDefaultProfiles() {
    return Object.values(MODALITY_PROFILES).map(profile => ({
        ...profile,
        inputSchema: { ...profile.inputSchema },
        parameterTargets: { ...profile.parameterTargets }
    }));
}
