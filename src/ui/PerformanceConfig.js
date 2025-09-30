const DEFAULT_TOUCHPAD_MAPPINGS = [
    { id: 'pad-1', label: 'Orbit', xParam: 'rot4dXW', yParam: 'rot4dYW', spreadParam: 'speed' },
    { id: 'pad-2', label: 'Color Wash', xParam: 'hue', yParam: 'intensity', spreadParam: 'saturation' },
    { id: 'pad-3', label: 'Structure', xParam: 'gridDensity', yParam: 'morphFactor', spreadParam: 'chaos' }
];

export const DEFAULT_PERFORMANCE_CONFIG = {
    touchPads: {
        padCount: 3,
        defaultMappings: DEFAULT_TOUCHPAD_MAPPINGS,
        presetStorageKey: 'vib34d_touchpad_presets_v1',
        parameterTags: ['performance', 'rotation', 'structure', 'color', 'dynamics'],
        gestureTags: ['performance', 'audio', 'dynamics'],
        layout: {
            columns: 1,
            minWidth: 220,
            gap: 12
        }
    },
    audio: {
        defaults: {
            enabled: true,
            sensitivity: 0.75,
            smoothing: 0.35,
            beatSync: true,
            bands: {
                bass: true,
                mid: true,
                treble: false,
                energy: true
            },
            flourish: {
                enabled: true,
                threshold: 0.65,
                amount: 0.4,
                parameter: 'intensity'
            }
        },
        storageKey: 'vib34d_audio_settings_v1'
    },
    presets: {
        storageKey: 'vib34d_performance_presets_v1'
    }
};

export function mergePerformanceConfig(overrides = {}) {
    return {
        touchPads: {
            ...DEFAULT_PERFORMANCE_CONFIG.touchPads,
            ...(overrides.touchPads || {}),
            layout: {
                ...DEFAULT_PERFORMANCE_CONFIG.touchPads.layout,
                ...(overrides.touchPads?.layout || {})
            }
        },
        audio: {
            ...DEFAULT_PERFORMANCE_CONFIG.audio,
            defaults: {
                ...DEFAULT_PERFORMANCE_CONFIG.audio.defaults,
                ...(overrides.audio?.defaults || {}),
                bands: {
                    ...DEFAULT_PERFORMANCE_CONFIG.audio.defaults.bands,
                    ...(overrides.audio?.defaults?.bands || {})
                },
                flourish: {
                    ...DEFAULT_PERFORMANCE_CONFIG.audio.defaults.flourish,
                    ...(overrides.audio?.defaults?.flourish || {})
                }
            }
        },
        presets: {
            ...DEFAULT_PERFORMANCE_CONFIG.presets,
            ...(overrides.presets || {})
        }
    };
}
