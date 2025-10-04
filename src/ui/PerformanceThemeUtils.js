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

export function normalizeThemeState(state = null) {
    if (!state) {
        return { paletteId: 'system', overrides: null };
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

    return { paletteId, overrides };
}

export function resolveThemeDetails(themeState, { palettes = PERFORMANCE_THEME_PALETTES, baseTheme = {} } = {}) {
    const normalized = normalizeThemeState(themeState);
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

    return {
        state: normalized,
        palette,
        paletteId: normalized.paletteId,
        paletteLabel: palette.label || normalized.paletteId,
        accent,
        highlightAlpha,
        glowStrength,
        description: palette.description || ''
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
