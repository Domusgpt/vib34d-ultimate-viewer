export const DEFAULT_THEME_TRANSITION = {
    duration: 1200,
    easing: 'cubic-bezier(0.45, 0, 0.55, 1)'
};

export const THEME_EASING_PRESETS = [
    { id: 'smooth', label: 'Smooth Ease', value: 'cubic-bezier(0.45, 0, 0.55, 1)' },
    { id: 'ease', label: 'Gentle Ease', value: 'ease' },
    { id: 'ease-in', label: 'Rise In', value: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)' },
    { id: 'ease-out', label: 'Glide Out', value: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
    { id: 'linear', label: 'Linear', value: 'linear' }
];

export const PERFORMANCE_THEME_PALETTES = [
    {
        id: 'system',
        label: 'System Accent',
        description: "Follow the current engine's signature colors."
    },
    {
        id: 'aurora',
        label: 'Aurora Bloom',
        description: 'Glacial cyan core with wide luminous bloom.',
        accent: '#6df9ff',
        highlightAlpha: 0.28,
        glowStrength: 0.8
    },
    {
        id: 'sunset',
        label: 'Crimson Sunset',
        description: 'Fiery magenta gradients with tighter highlight.',
        accent: '#ff5e9f',
        highlightAlpha: 0.23,
        glowStrength: 0.55
    },
    {
        id: 'atmos',
        label: 'Atmos Drift',
        description: 'Deep violet core with atmospheric bloom.',
        accent: '#8f6dff',
        highlightAlpha: 0.3,
        glowStrength: 0.72
    },
    {
        id: 'custom',
        label: 'Custom Blend',
        description: 'Dial your own accent and bloom intensity.'
    }
];

function sanitizeDuration(value, fallback) {
    const number = typeof value === 'string' ? parseFloat(value) : Number(value);
    if (!Number.isFinite(number)) {
        return fallback;
    }
    return Math.max(0, Math.min(10000, Math.round(number)));
}

function normalizeEasing(easing, fallback) {
    if (typeof easing !== 'string' || !easing.trim()) {
        return fallback;
    }

    const trimmed = easing.trim();
    const preset = THEME_EASING_PRESETS.find(option => option.id === trimmed || option.value === trimmed);
    return preset ? preset.value : trimmed;
}

function normalizeTransitionDefaults(defaults = {}) {
    if (!defaults || typeof defaults !== 'object') {
        return { ...DEFAULT_THEME_TRANSITION };
    }

    return {
        duration: sanitizeDuration(defaults.duration, DEFAULT_THEME_TRANSITION.duration),
        easing: normalizeEasing(defaults.easing, DEFAULT_THEME_TRANSITION.easing)
    };
}

export function normalizeThemeTransition(transition, defaults = DEFAULT_THEME_TRANSITION) {
    const resolvedDefaults = normalizeTransitionDefaults(defaults);

    if (!transition || typeof transition !== 'object') {
        return { ...resolvedDefaults };
    }

    return {
        duration: sanitizeDuration(transition.duration, resolvedDefaults.duration),
        easing: normalizeEasing(transition.easing, resolvedDefaults.easing)
    };
}

export function mergeThemePalettes(customPalettes = []) {
    const map = new Map();
    PERFORMANCE_THEME_PALETTES.forEach(palette => {
        if (palette?.id) {
            map.set(palette.id, { ...palette });
        }
    });

    customPalettes.forEach(palette => {
        if (!palette || !palette.id) return;
        const existing = map.get(palette.id) || {};
        map.set(palette.id, { ...existing, ...palette });
    });

    return Array.from(map.values());
}

export function normalizeThemeState(state = null, { transitionDefaults = DEFAULT_THEME_TRANSITION } = {}) {
    const normalizedTransitionDefaults = normalizeTransitionDefaults(transitionDefaults);
    if (!state) {
        return { paletteId: 'system', overrides: null, transition: { ...normalizedTransitionDefaults } };
    }

    const paletteId = typeof state.paletteId === 'string' && state.paletteId.trim()
        ? state.paletteId
        : 'system';

    let overrides = null;
    if (state.overrides && typeof state.overrides === 'object') {
        overrides = {};
        if (typeof state.overrides.accent === 'string' && state.overrides.accent.trim()) {
            overrides.accent = state.overrides.accent;
        }
        if (typeof state.overrides.highlightAlpha === 'number' && Number.isFinite(state.overrides.highlightAlpha)) {
            overrides.highlightAlpha = state.overrides.highlightAlpha;
        }
        if (typeof state.overrides.glowStrength === 'number' && Number.isFinite(state.overrides.glowStrength)) {
            overrides.glowStrength = state.overrides.glowStrength;
        }
        if (!Object.keys(overrides).length) {
            overrides = null;
        }
    }

    const transition = normalizeThemeTransition(state.transition, normalizedTransitionDefaults);

    return { paletteId, overrides, transition };
}

export function resolveThemeDetails(
    themeState,
    { palettes = PERFORMANCE_THEME_PALETTES, baseTheme = {}, transitionDefaults = DEFAULT_THEME_TRANSITION } = {}
) {
    const normalized = normalizeThemeState(themeState, { transitionDefaults });
    const palette = palettes.find(p => p.id === normalized.paletteId)
        || palettes.find(p => p.id === 'system')
        || palettes[0]
        || { id: 'system', label: 'System Accent' };

    const accent = normalized.overrides?.accent
        || palette.accent
        || baseTheme.accent
        || '#53d7ff';

    const highlightAlpha = typeof normalized.overrides?.highlightAlpha === 'number'
        ? normalized.overrides.highlightAlpha
        : typeof palette.highlightAlpha === 'number'
            ? palette.highlightAlpha
            : typeof baseTheme.highlightAlpha === 'number'
                ? baseTheme.highlightAlpha
                : 0.22;

    const glowStrength = typeof normalized.overrides?.glowStrength === 'number'
        ? normalized.overrides.glowStrength
        : typeof palette.glowStrength === 'number'
            ? palette.glowStrength
            : typeof baseTheme.glowStrength === 'number'
                ? baseTheme.glowStrength
                : 0.65;

    const transition = normalizeThemeTransition(normalized.transition, transitionDefaults);

    return {
        state: normalized,
        palette,
        paletteId: normalized.paletteId,
        paletteLabel: palette.label || normalized.paletteId,
        accent,
        highlightAlpha,
        glowStrength,
        description: palette.description || '',
        transition
    };
}

function numbersEqual(a, b, tolerance = 0.0001) {
    if (typeof a !== 'number' && typeof b !== 'number') return true;
    if (typeof a !== 'number' || typeof b !== 'number') return false;
    return Math.abs(a - b) <= tolerance;
}

export function areThemesEqual(a, b) {
    const first = normalizeThemeState(a);
    const second = normalizeThemeState(b);

    if (first.paletteId !== second.paletteId) {
        return false;
    }

    const firstOverrides = first.overrides || {};
    const secondOverrides = second.overrides || {};

    if ((firstOverrides.accent || null) !== (secondOverrides.accent || null)) {
        return false;
    }

    if (!numbersEqual(firstOverrides.highlightAlpha, secondOverrides.highlightAlpha)) {
        return false;
    }

    if (!numbersEqual(firstOverrides.glowStrength, secondOverrides.glowStrength)) {
        return false;
    }

    return true;
}
