export const DEFAULT_PERFORMANCE_CONFIG = {
    touchPads: {
        pads: {
            defaultCount: 3,
            min: 1,
            max: 6
        },
        layout: {
            minWidth: 220,
            maxWidth: 420,
            gap: 16,
            maxGap: 48,
            aspectRatio: 1,
            minAspect: 0.6,
            maxAspect: 1.4,
            crosshairSize: 18,
            columns: 'auto'
        },
        layoutPresets: [
            {
                id: 'default-stage-balance',
                name: 'Default Stage Balance',
                description: 'Balanced spacing for three feature pads with adaptive columns.',
                layout: {
                    padCount: 3,
                    minWidth: 260,
                    gap: 18,
                    aspectRatio: 1,
                    columns: 'auto'
                }
            },
            {
                id: 'expanded-duo-wings',
                name: 'Expanded Duo Wings',
                description: 'Wider pads for duo performances with fixed two-column symmetry.',
                layout: {
                    padCount: 2,
                    minWidth: 320,
                    gap: 22,
                    aspectRatio: 1.15,
                    columns: 2
                }
            },
            {
                id: 'dense-club-grid',
                name: 'Dense Club Grid',
                description: 'Compact four-pad grid tuned for tight club booths and controllers.',
                layout: {
                    padCount: 4,
                    minWidth: 210,
                    gap: 12,
                    aspectRatio: 0.9,
                    columns: 4
                }
            }
        ],
        axis: {
            defaultModes: {
                x: 'absolute',
                y: 'absolute',
                gesture: 'bipolar'
            },
            modes: [
                { value: 'absolute', label: 'Absolute (min → max)' },
                { value: 'bipolar', label: 'Bipolar (center ±)' },
                { value: 'relative', label: 'Relative (offset)' }
            ],
            relativeStrength: 0.4,
            curves: [
                { value: 'linear', label: 'Linear' },
                { value: 'ease-in', label: 'Ease In' },
                { value: 'ease-out', label: 'Ease Out' },
                { value: 'ease-in-out', label: 'Ease In-Out' },
                { value: 'expo', label: 'Exponential' }
            ],
            smoothing: {
                default: 0.15,
                min: 0,
                max: 0.6,
                step: 0.05
            },
            defaults: {
                curve: {
                    x: 'linear',
                    y: 'linear',
                    gesture: 'ease-out'
                },
                invert: {
                    x: false,
                    y: false,
                    gesture: false
                },
                smoothing: {
                    x: 0.15,
                    y: 0.15,
                    gesture: 0.25
                }
            }
        },
        gesture: {
            minimumSpread: 0.05,
            maximumSpread: 0.65,
            velocityScale: 2.4,
            pressureFallback: 0.6,
            defaultMode: 'spread',
            modes: [
                { value: 'spread', label: 'Finger Spread' },
                { value: 'pressure', label: 'Pressure / Emphasis' },
                { value: 'velocity', label: 'Swipe Velocity' }
            ]
        },
        defaultMappings: [
            { x: 'rot4dXW', y: 'rot4dYW', gesture: 'rot4dZW' },
            { x: 'gridDensity', y: 'morphFactor', gesture: 'chaos' },
            { x: 'hue', y: 'intensity', gesture: 'speed' }
        ]
    },
    audio: {
        modes: [
            { value: 'absolute', label: 'Absolute' },
            { value: 'swing', label: 'Swing (±)' },
            { value: 'relative', label: 'Relative' }
        ],
        tempo: {
            defaultBpm: 120,
            defaultSubdivision: '1/4',
            subdivisions: [
                { value: '1/1', label: 'Whole' },
                { value: '1/2', label: 'Half' },
                { value: '1/4', label: 'Quarter' },
                { value: '1/8', label: 'Eighth' },
                { value: '1/16', label: 'Sixteenth' },
                { value: '1/8T', label: 'Eighth Triplet' }
            ]
        },
        routing: {
            toggles: [
                { key: 'sendToPads', label: 'Drive Touch Pads' },
                { key: 'sendToPresets', label: 'Influence Presets' },
                { key: 'broadcastMidiClock', label: 'Broadcast MIDI Clock' }
            ]
        },
        advanced: {
            defaults: {
                freezeOnSilence: false,
                accentuatePeaks: true,
                headroom: 0.2
            }
        }
    }
};

function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base, override) {
    if (!isPlainObject(override)) {
        return override;
    }

    const output = { ...base };
    Object.keys(override).forEach(key => {
        const baseValue = base[key];
        const overrideValue = override[key];

        if (Array.isArray(overrideValue)) {
            output[key] = overrideValue.slice();
        } else if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
            output[key] = deepMerge(baseValue, overrideValue);
        } else {
            output[key] = overrideValue;
        }
    });

    return output;
}

export function mergePerformanceConfig(overrides = {}) {
    if (!overrides || Object.keys(overrides).length === 0) {
        return JSON.parse(JSON.stringify(DEFAULT_PERFORMANCE_CONFIG));
    }

    const cloned = JSON.parse(JSON.stringify(DEFAULT_PERFORMANCE_CONFIG));

    const mergeRecursive = (target, source) => {
        Object.keys(source).forEach(key => {
            const targetValue = target[key];
            const sourceValue = source[key];

            if (Array.isArray(sourceValue)) {
                target[key] = sourceValue.slice();
            } else if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
                mergeRecursive(targetValue, sourceValue);
            } else if (isPlainObject(sourceValue)) {
                target[key] = deepMerge({}, sourceValue);
            } else {
                target[key] = sourceValue;
            }
        });
    };

    mergeRecursive(cloned, overrides);
    return cloned;
}
