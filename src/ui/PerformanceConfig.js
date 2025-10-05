import { DEFAULT_THEME_TRANSITION } from './PerformanceThemeUtils.js';

const DEFAULT_TOUCHPAD_MAPPINGS = [
    {
        id: 'pad-1',
        label: 'Orbit Sculpt',
        axes: {
            x: { parameter: 'rot4dXW', invert: false, smoothing: 0.2 },
            y: { parameter: 'rot4dYW', invert: false, smoothing: 0.2 },
            spread: { parameter: 'speed', invert: false, smoothing: 0.3 }
        }
    },
    {
        id: 'pad-2',
        label: 'Chromatic Wash',
        axes: {
            x: { parameter: 'hue', invert: false, smoothing: 0.15 },
            y: { parameter: 'intensity', invert: false, smoothing: 0.2 },
            spread: { parameter: 'saturation', invert: false, smoothing: 0.25 }
        }
    },
    {
        id: 'pad-3',
        label: 'Geometry Chisel',
        axes: {
            x: { parameter: 'gridDensity', invert: false, smoothing: 0.25 },
            y: { parameter: 'morphFactor', invert: false, smoothing: 0.25 },
            spread: { parameter: 'chaos', invert: false, smoothing: 0.35 }
        }
    }
];

const DEFAULT_AUDIO_SETTINGS = {
    enabled: true,
    beatSync: true,
    smoothing: 0.25,
    sensitivity: 0.75,
    bands: {
        bass: { enabled: true, weight: 0.9 },
        mid: { enabled: true, weight: 0.6 },
        treble: { enabled: true, weight: 0.5 },
        energy: { enabled: true, weight: 0.7 }
    },
    flourish: {
        enabled: true,
        parameter: 'intensity',
        threshold: 0.65,
        amount: 0.4
    }
};

const DEFAULT_PRESET_CONFIG = {
    storageKey: 'vib34d-performance-presets',
    playlistKey: 'vib34d-performance-playlist'
};

const DEFAULT_HARDWARE_CONFIG = {
    storageKey: 'vib34d-hardware-mappings',
    autoConnect: false,
    pickupThreshold: 0.04,
    smoothing: 0.18,
    channel: 'omni'
};

const DEFAULT_GESTURE_CONFIG = {
    storageKey: 'vib34d-performance-gestures',
    captureEvents: ['touchpad:update', 'hardware:midi-value'],
    maxDuration: 120000,
    maxEvents: 2200,
    autoNamePrefix: 'Take',
    quantizeBeats: false
};

const DEFAULT_TELEMETRY_CONFIG = {
    rotationParameters: ['rot4dXW', 'rot4dYW', 'rot4dZW'],
    dynamicsParameters: ['dimension', 'speed', 'chaos', 'intensity'],
    historySize: 180,
    pulseFadeMs: 2600
};

const DEFAULT_SHOW_PLANNER_CONFIG = {
    storageKey: 'vib34d-show-planner',
    defaults: {
        tempo: 120,
        beatsPerBar: 4,
        autoAdvance: false,
        loop: false
    }
};

const DEFAULT_THEME_CONFIG = {
    storageKey: 'vib34d-performance-theme',
    palettes: [
        { id: 'aurora', label: 'Aurora Bloom', accent: '#6df9ff', highlightAlpha: 0.28, glowStrength: 0.8 },
        { id: 'sunset', label: 'Crimson Sunset', accent: '#ff5e9f', highlightAlpha: 0.23, glowStrength: 0.55 },
        { id: 'atmos', label: 'Atmos Drift', accent: '#8f6dff', highlightAlpha: 0.3, glowStrength: 0.72 }
    ],
    transitionDefaults: DEFAULT_THEME_TRANSITION
};

const DEFAULT_TOUCHPAD_CONFIG = {
    padCount: 3,
    parameterTags: ['performance', 'rotation', 'structure', 'color', 'dynamics'],
    defaults: DEFAULT_TOUCHPAD_MAPPINGS,
    storageKey: 'vib34d-touchpads',
    surface: {
        minWidth: 220,
        aspectRatio: 1,
        gap: 16
    }
};

const DEFAULT_PERFORMANCE_CONFIG = {
    touchPads: DEFAULT_TOUCHPAD_CONFIG,
    audio: {
        defaults: DEFAULT_AUDIO_SETTINGS
    },
    presets: DEFAULT_PRESET_CONFIG,
    hardware: DEFAULT_HARDWARE_CONFIG,
    gestures: DEFAULT_GESTURE_CONFIG,
    telemetry: DEFAULT_TELEMETRY_CONFIG,
    showPlanner: DEFAULT_SHOW_PLANNER_CONFIG,
    theme: DEFAULT_THEME_CONFIG
};

function deepMerge(base, override) {
    if (!override) {
        return JSON.parse(JSON.stringify(base));
    }

    if (Array.isArray(base)) {
        return override.slice();
    }

    const result = { ...base };
    Object.keys(override).forEach(key => {
        const value = override[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = deepMerge(base[key] || {}, value);
        } else {
            result[key] = value;
        }
    });
    return result;
}

export function mergePerformanceConfig(overrides = {}) {
    return deepMerge(DEFAULT_PERFORMANCE_CONFIG, overrides);
}

export { DEFAULT_PERFORMANCE_CONFIG, DEFAULT_GESTURE_CONFIG };
