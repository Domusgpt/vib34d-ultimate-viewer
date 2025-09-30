const DEFAULT_TOUCHPAD_MAPPINGS = [
    {
        id: 'pad-1',
        label: 'Orbit',
        xParam: 'rot4dXW',
        yParam: 'rot4dYW',
        spreadParam: 'speed',
        gestureMode: 'spread',
        gestureInvert: false,
        xCurve: 'ease-in-out',
        yCurve: 'ease-in-out',
        spreadCurve: 'ease-out',
        xSmoothing: 0.2,
        ySmoothing: 0.2,
        spreadSmoothing: 0.35
    },
    {
        id: 'pad-2',
        label: 'Color Wash',
        xParam: 'hue',
        yParam: 'intensity',
        spreadParam: 'saturation',
        gestureMode: 'radius',
        gestureInvert: false,
        xCurve: 'ease-out',
        yCurve: 'ease-in',
        spreadCurve: 'ease-in-out',
        xSmoothing: 0.15,
        ySmoothing: 0.25,
        spreadSmoothing: 0.3
    },
    {
        id: 'pad-3',
        label: 'Structure',
        xParam: 'gridDensity',
        yParam: 'morphFactor',
        spreadParam: 'chaos',
        gestureMode: 'rotation',
        gestureInvert: false,
        xCurve: 'expo',
        yCurve: 'ease-in-out',
        spreadCurve: 'ease-out',
        xSmoothing: 0.25,
        ySmoothing: 0.3,
        spreadSmoothing: 0.4
    }
];

export const DEFAULT_PERFORMANCE_CONFIG = {
    touchPads: {
        padCount: 3,
        defaultMappings: DEFAULT_TOUCHPAD_MAPPINGS,
        presetStorageKey: 'vib34d_touchpad_presets_v1',
        parameterTags: ['performance', 'rotation', 'structure', 'color', 'dynamics'],
        gestureTags: ['performance', 'audio', 'dynamics'],
        gestures: {
            defaultMode: 'spread',
            modes: [
                { id: 'spread', label: 'Spread (multi-touch distance)' },
                { id: 'radius', label: 'Radius from centre' },
                { id: 'rotation', label: 'Rotation angle' },
                { id: 'velocity', label: 'Swipe velocity' },
                { id: 'pressure', label: 'Average pressure' }
            ]
        },
        layout: {
            minWidth: 220,
            gap: 12,
            aspectRatio: 1
        },
        axisDefaults: {
            curve: 'ease-in-out',
            smoothing: 0.2,
            x: { curve: 'ease-in-out', smoothing: 0.2 },
            y: { curve: 'ease-in-out', smoothing: 0.2 },
            spread: { curve: 'ease-out', smoothing: 0.3 }
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
                parameter: 'intensity',
                mode: 'boost',
                cooldown: 900
            },
            advanced: {
                autoGain: true,
                dynamicSmoothing: true,
                tempoFollow: true,
                envelope: {
                    attack: 0.25,
                    release: 0.45
                }
            },
            bandMappings: {
                bass: { parameter: 'gridDensity', amount: 0.85 },
                mid: { parameter: 'hue', amount: 0.6 },
                treble: { parameter: 'intensity', amount: 0.7 },
                energy: { parameter: 'speed', amount: 1 }
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
            gestures: {
                ...DEFAULT_PERFORMANCE_CONFIG.touchPads.gestures,
                ...(overrides.touchPads?.gestures || {}),
                modes: Array.isArray(overrides.touchPads?.gestures?.modes)
                    ? overrides.touchPads.gestures.modes
                    : DEFAULT_PERFORMANCE_CONFIG.touchPads.gestures.modes
            },
            layout: {
                ...DEFAULT_PERFORMANCE_CONFIG.touchPads.layout,
                ...(overrides.touchPads?.layout || {})
            },
            axisDefaults: {
                ...DEFAULT_PERFORMANCE_CONFIG.touchPads.axisDefaults,
                ...(overrides.touchPads?.axisDefaults || {}),
                x: {
                    ...DEFAULT_PERFORMANCE_CONFIG.touchPads.axisDefaults.x,
                    ...(overrides.touchPads?.axisDefaults?.x || {})
                },
                y: {
                    ...DEFAULT_PERFORMANCE_CONFIG.touchPads.axisDefaults.y,
                    ...(overrides.touchPads?.axisDefaults?.y || {})
                },
                spread: {
                    ...DEFAULT_PERFORMANCE_CONFIG.touchPads.axisDefaults.spread,
                    ...(overrides.touchPads?.axisDefaults?.spread || {})
                }
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
                },
                advanced: {
                    ...DEFAULT_PERFORMANCE_CONFIG.audio.defaults.advanced,
                    ...(overrides.audio?.defaults?.advanced || {}),
                    envelope: {
                        ...DEFAULT_PERFORMANCE_CONFIG.audio.defaults.advanced.envelope,
                        ...(overrides.audio?.defaults?.advanced?.envelope || {})
                    }
                },
                bandMappings: {
                    ...DEFAULT_PERFORMANCE_CONFIG.audio.defaults.bandMappings,
                    ...(overrides.audio?.defaults?.bandMappings || {})
                }
            }
        },
        presets: {
            ...DEFAULT_PERFORMANCE_CONFIG.presets,
            ...(overrides.presets || {})
        }
    };
}
