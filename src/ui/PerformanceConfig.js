const TOUCHPAD_TEMPLATES = [
    {
        id: 'orbital-sculpt',
        label: 'Orbital Sculpt',
        description: 'Four-dimensional orbiting moves that carve light trails with expressive spin.',
        pads: [
            {
                id: 'pad-1',
                label: 'Orbital Sweep',
                xParam: 'rot4dXW',
                yParam: 'rot4dYW',
                spreadParam: 'speed',
                xCurve: 'ease-in-out',
                yCurve: 'ease-in-out',
                spreadCurve: 'ease-out',
                xSmoothing: 0.2,
                ySmoothing: 0.2,
                spreadSmoothing: 0.35
            },
            {
                id: 'pad-2',
                label: 'Dimensional Drift',
                xParam: 'dimension',
                yParam: 'gridDensity',
                spreadParam: 'chaos',
                xCurve: 'ease-in',
                yCurve: 'ease-out',
                spreadCurve: 'ease-in-out',
                xSmoothing: 0.25,
                ySmoothing: 0.22,
                spreadSmoothing: 0.3
            },
            {
                id: 'pad-3',
                label: 'Pulse Accent',
                xParam: 'intensity',
                yParam: 'hue',
                spreadParam: 'saturation',
                xCurve: 'ease-out',
                yCurve: 'ease-in-out',
                spreadCurve: 'ease-out',
                xSmoothing: 0.18,
                ySmoothing: 0.2,
                spreadSmoothing: 0.28
            }
        ]
    },
    {
        id: 'chromatic-wash',
        label: 'Chromatic Wash',
        description: 'Lush colour washes with tactile saturation and bloom control for dreamy transitions.',
        pads: [
            {
                id: 'pad-1',
                label: 'Hue Glide',
                xParam: 'hue',
                yParam: 'saturation',
                spreadParam: 'intensity',
                xCurve: 'ease-in-out',
                yCurve: 'ease-in',
                spreadCurve: 'ease-out',
                xSmoothing: 0.16,
                ySmoothing: 0.22,
                spreadSmoothing: 0.25
            },
            {
                id: 'pad-2',
                label: 'Bloom Envelope',
                xParam: 'intensity',
                yParam: 'morphFactor',
                spreadParam: 'speed',
                xCurve: 'ease-out',
                yCurve: 'ease-in',
                spreadCurve: 'ease-in-out',
                xSmoothing: 0.2,
                ySmoothing: 0.3,
                spreadSmoothing: 0.35
            },
            {
                id: 'pad-3',
                label: 'Spectral Ripple',
                xParam: 'gridDensity',
                yParam: 'chaos',
                spreadParam: 'dimension',
                xCurve: 'expo',
                yCurve: 'ease-in-out',
                spreadCurve: 'ease-in-out',
                xSmoothing: 0.24,
                ySmoothing: 0.28,
                spreadSmoothing: 0.32
            }
        ]
    },
    {
        id: 'geometry-chisel',
        label: 'Geometry Chisel',
        description: 'Hard-edged chisel moves that punch structures and rotations for high-energy drops.',
        pads: [
            {
                id: 'pad-1',
                label: 'Structure Tilt',
                xParam: 'gridDensity',
                yParam: 'morphFactor',
                spreadParam: 'dimension',
                xCurve: 'expo',
                yCurve: 'ease-in',
                spreadCurve: 'ease-out',
                xSmoothing: 0.22,
                ySmoothing: 0.26,
                spreadSmoothing: 0.38
            },
            {
                id: 'pad-2',
                label: 'Spin Burst',
                xParam: 'rot4dXW',
                yParam: 'rot4dZW',
                spreadParam: 'speed',
                xCurve: 'ease-in',
                yCurve: 'ease-out',
                spreadCurve: 'ease-in-out',
                xSmoothing: 0.18,
                ySmoothing: 0.2,
                spreadSmoothing: 0.28
            },
            {
                id: 'pad-3',
                label: 'Edge Flash',
                xParam: 'intensity',
                yParam: 'chaos',
                spreadParam: 'saturation',
                xCurve: 'ease-out',
                yCurve: 'ease-in',
                spreadCurve: 'ease-out',
                xSmoothing: 0.2,
                ySmoothing: 0.24,
                spreadSmoothing: 0.3
            }
        ]
    }
];

const LAYOUT_PRESETS = [
    {
        id: 'stage-wide',
        label: 'Stage Wide',
        description: 'Spacious pads for theatrical sweeps across large surfaces.',
        layout: {
            minWidth: 280,
            gap: 20,
            aspectRatio: 1.1
        }
    },
    {
        id: 'club-duo',
        label: 'Club Duo',
        description: 'Tighter grid for dual performers sharing pads side-by-side.',
        layout: {
            minWidth: 220,
            gap: 12,
            aspectRatio: 1
        }
    },
    {
        id: 'booth-stack',
        label: 'Booth Stack',
        description: 'Stacked vertical pads to fit cramped DJ booths or racks.',
        layout: {
            minWidth: 200,
            gap: 10,
            aspectRatio: 0.85
        }
    }
];

export const DEFAULT_PERFORMANCE_CONFIG = {
    touchPads: {
        padCount: 3,
        defaultTemplate: 'orbital-sculpt',
        templates: TOUCHPAD_TEMPLATES,
        defaultMappings: TOUCHPAD_TEMPLATES[0].pads,
        presetStorageKey: 'vib34d_touchpad_presets_v1',
        parameterTags: ['performance', 'rotation', 'structure', 'color', 'dynamics'],
        gestureTags: ['performance', 'audio', 'dynamics'],
        layoutPresets: LAYOUT_PRESETS,
        defaultLayoutPreset: 'club-duo',
        layout: LAYOUT_PRESETS[1].layout,
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
            templates: Array.isArray(overrides.touchPads?.templates)
                ? overrides.touchPads.templates
                : TOUCHPAD_TEMPLATES,
            layoutPresets: Array.isArray(overrides.touchPads?.layoutPresets)
                ? overrides.touchPads.layoutPresets
                : LAYOUT_PRESETS,
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
                }
            }
        },
        presets: {
            ...DEFAULT_PERFORMANCE_CONFIG.presets,
            ...(overrides.presets || {})
        }
    };
}
