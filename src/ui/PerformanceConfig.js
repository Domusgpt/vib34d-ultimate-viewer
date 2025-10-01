const DEFAULT_TOUCHPAD_MAPPINGS = [
    {
        id: 'pad-1',
        label: 'Orbit',
        templateId: 'orbital-sculpt',
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
        label: 'Color Wash',
        templateId: 'chromatic-wash',
        xParam: 'hue',
        yParam: 'intensity',
        spreadParam: 'saturation',
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
        templateId: 'geometry-chisel',
        xParam: 'gridDensity',
        yParam: 'morphFactor',
        spreadParam: 'chaos',
        xCurve: 'expo',
        yCurve: 'ease-in-out',
        spreadCurve: 'ease-out',
        xSmoothing: 0.25,
        ySmoothing: 0.3,
        spreadSmoothing: 0.4
    }
];

function mergeById(defaultList = [], overrideList = []) {
    const map = new Map();
    defaultList.forEach(item => {
        if (!item || !item.id) return;
        map.set(item.id, JSON.parse(JSON.stringify(item)));
    });
    overrideList.forEach(item => {
        if (!item || !item.id) return;
        const existing = map.get(item.id) || {};
        map.set(item.id, { ...existing, ...JSON.parse(JSON.stringify(item)) });
    });
    return Array.from(map.values());
}

export const DEFAULT_PERFORMANCE_CONFIG = {
    touchPads: {
        padCount: 3,
        maxPadCount: 6,
        defaultMappings: DEFAULT_TOUCHPAD_MAPPINGS,
        presetStorageKey: 'vib34d_touchpad_presets_v1',
        parameterTags: ['performance', 'rotation', 'structure', 'color', 'dynamics'],
        gestureTags: ['performance', 'audio', 'dynamics'],
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
        },
        templates: [
            {
                id: 'orbital-sculpt',
                label: 'Orbital Sculpt',
                description: 'Orbit structural rotation while spreading to push speed for dramatic lifts.',
                mapping: {
                    xParam: 'rot4dXW',
                    yParam: 'rot4dYW',
                    spreadParam: 'speed',
                    invertX: false,
                    invertY: false,
                    xCurve: 'ease-in-out',
                    yCurve: 'ease-in-out',
                    spreadCurve: 'ease-out',
                    xSmoothing: 0.2,
                    ySmoothing: 0.25,
                    spreadSmoothing: 0.35
                }
            },
            {
                id: 'chromatic-wash',
                label: 'Chromatic Wash',
                description: 'Blend hue, intensity and saturation washes that react smoothly with audio cues.',
                mapping: {
                    xParam: 'hue',
                    yParam: 'intensity',
                    spreadParam: 'saturation',
                    invertX: false,
                    invertY: false,
                    xCurve: 'ease-out',
                    yCurve: 'ease-in',
                    spreadCurve: 'ease-in-out',
                    xSmoothing: 0.15,
                    ySmoothing: 0.2,
                    spreadSmoothing: 0.3
                }
            },
            {
                id: 'geometry-chisel',
                label: 'Geometry Chisel',
                description: 'Carve morphing geometry with a spread gesture that unlocks controlled chaos.',
                mapping: {
                    xParam: 'gridDensity',
                    yParam: 'morphFactor',
                    spreadParam: 'chaos',
                    invertX: false,
                    invertY: false,
                    xCurve: 'expo',
                    yCurve: 'ease-in-out',
                    spreadCurve: 'ease-out',
                    xSmoothing: 0.25,
                    ySmoothing: 0.3,
                    spreadSmoothing: 0.4
                }
            }
        ],
        layoutPresets: [
            {
                id: 'club-trio',
                label: 'Club Trio',
                description: 'Tight clustered pads tuned for cramped DJ booths and compact rigs.',
                settings: {
                    minWidth: 210,
                    gap: 10,
                    aspectRatio: 1
                }
            },
            {
                id: 'stage-spread',
                label: 'Stage Spread',
                description: 'Wide spacing for dual performers sharing pads across a large desk.',
                settings: {
                    minWidth: 260,
                    gap: 18,
                    aspectRatio: 1.1
                }
            },
            {
                id: 'immersive-stack',
                label: 'Immersive Stack',
                description: 'Stacked portrait pads ideal for vertical touchscreens or tablets.',
                settings: {
                    minWidth: 200,
                    gap: 14,
                    aspectRatio: 1.35
                }
            }
        ]
    },
    audio: {
        defaults: {
            enabled: true,
            sensitivity: 0.75,
            smoothing: 0.35,
            beatSync: true,
            bands: {
                bass: { enabled: true, weight: 1.1 },
                mid: { enabled: true, weight: 0.9 },
                treble: { enabled: false, weight: 0.7 },
                energy: { enabled: true, weight: 1.0 }
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
    const overrideTouchPads = overrides.touchPads || {};
    const rawPadCount = Number(overrideTouchPads.padCount);
    const sanitizedPadCount = Number.isFinite(rawPadCount)
        ? Math.max(1, Math.round(rawPadCount))
        : DEFAULT_PERFORMANCE_CONFIG.touchPads.padCount;
    const rawMaxPadCount = Number(overrideTouchPads.maxPadCount);
    const sanitizedMaxPadCount = Number.isFinite(rawMaxPadCount)
        ? Math.max(1, Math.round(rawMaxPadCount))
        : DEFAULT_PERFORMANCE_CONFIG.touchPads.maxPadCount;
    const effectiveMaxPadCount = Math.max(
        sanitizedMaxPadCount,
        sanitizedPadCount,
        DEFAULT_PERFORMANCE_CONFIG.touchPads.padCount
    );

    return {
        touchPads: {
            ...DEFAULT_PERFORMANCE_CONFIG.touchPads,
            ...overrideTouchPads,
            padCount: Math.min(sanitizedPadCount, effectiveMaxPadCount),
            maxPadCount: effectiveMaxPadCount,
            layout: {
                ...DEFAULT_PERFORMANCE_CONFIG.touchPads.layout,
                ...(overrideTouchPads.layout || {})
            },
            axisDefaults: {
                ...DEFAULT_PERFORMANCE_CONFIG.touchPads.axisDefaults,
                ...(overrideTouchPads.axisDefaults || {}),
                x: {
                    ...DEFAULT_PERFORMANCE_CONFIG.touchPads.axisDefaults.x,
                    ...(overrideTouchPads.axisDefaults?.x || {})
                },
                y: {
                    ...DEFAULT_PERFORMANCE_CONFIG.touchPads.axisDefaults.y,
                    ...(overrideTouchPads.axisDefaults?.y || {})
                },
                spread: {
                    ...DEFAULT_PERFORMANCE_CONFIG.touchPads.axisDefaults.spread,
                    ...(overrideTouchPads.axisDefaults?.spread || {})
                }
            },
            templates: mergeById(
                DEFAULT_PERFORMANCE_CONFIG.touchPads.templates,
                overrideTouchPads.templates || []
            ),
            layoutPresets: mergeById(
                DEFAULT_PERFORMANCE_CONFIG.touchPads.layoutPresets,
                overrideTouchPads.layoutPresets || []
            )
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
