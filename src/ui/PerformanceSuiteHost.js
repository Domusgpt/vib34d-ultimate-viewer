import { PerformanceSuite } from './PerformanceSuite.js';
import { normalizeThemeState } from './PerformanceThemeUtils.js';

const SYSTEM_THEMES = {
    faceted: {
        accent: '#53d7ff',
        surface: 'rgba(17, 20, 35, 0.94)',
        background: '#050a16',
        highlightAlpha: 0.22,
        glowStrength: 0.65
    },
    quantum: {
        accent: '#ff6dff',
        surface: 'rgba(33, 12, 40, 0.94)',
        background: '#090212',
        highlightAlpha: 0.26,
        glowStrength: 0.7
    },
    holographic: {
        accent: '#ffc853',
        surface: 'rgba(36, 24, 8, 0.94)',
        background: '#0d0802',
        highlightAlpha: 0.24,
        glowStrength: 0.6
    },
    polychora: {
        accent: '#9bff85',
        surface: 'rgba(10, 26, 24, 0.94)',
        background: '#02140f',
        highlightAlpha: 0.22,
        glowStrength: 0.68
    }
};

function hexToRgba(hex, alpha) {
    if (!hex) {
        return `rgba(255, 255, 255, ${alpha ?? 1})`;
    }

    const normalized = hex.replace('#', '');
    const values = normalized.length === 3
        ? normalized.split('').map(ch => parseInt(ch + ch, 16))
        : [
            parseInt(normalized.slice(0, 2), 16),
            parseInt(normalized.slice(2, 4), 16),
            parseInt(normalized.slice(4, 6), 16)
        ];

    const [r = 255, g = 255, b = 255] = values;
    const resolvedAlpha = typeof alpha === 'number' ? alpha : 1;
    return `rgba(${r}, ${g}, ${b}, ${resolvedAlpha})`;
}

function buildTheme(systemName, themeState = null) {
    const base = SYSTEM_THEMES[systemName] || SYSTEM_THEMES.faceted;
    const overrides = themeState?.overrides || {};

    const accent = overrides.accent || base.accent;
    const highlightAlpha = typeof overrides.highlightAlpha === 'number'
        ? overrides.highlightAlpha
        : base.highlightAlpha;
    const glowStrength = typeof overrides.glowStrength === 'number'
        ? overrides.glowStrength
        : base.glowStrength;

    return {
        accent,
        surface: base.surface,
        background: base.background,
        highlight: hexToRgba(accent, highlightAlpha),
        glowStrength
    };
}

function applyThemeVariables(systemName, themeState = null) {
    if (typeof document === 'undefined') {
        return;
    }

    const theme = buildTheme(systemName, themeState);
    const root = document.documentElement;

    root.style.setProperty('--performance-accent', theme.accent);
    root.style.setProperty('--performance-highlight', theme.highlight);
    root.style.setProperty('--performance-surface', theme.surface);
    root.style.setProperty('--performance-bg', theme.background);
    root.style.setProperty('--performance-glow-strength', String(theme.glowStrength));
}

function getBaseTheme(systemName) {
    const base = SYSTEM_THEMES[systemName] || SYSTEM_THEMES.faceted;
    return {
        accent: base.accent,
        highlightAlpha: base.highlightAlpha,
        glowStrength: base.glowStrength
    };
}

function resolveParameterManager(engine, explicitManager) {
    if (explicitManager) return explicitManager;
    if (!engine) return null;

    if (engine.parameterManager) return engine.parameterManager;
    if (engine.parameters) return engine.parameters;
    if (typeof engine.getParameterManager === 'function') {
        try {
            return engine.getParameterManager();
        } catch (error) {
            console.warn('PerformanceSuiteHost failed to resolve parameter manager via getter', error);
        }
    }
    return null;
}

class PerformanceSuiteHost {
    constructor() {
        this.suite = null;
        this.cachedState = null;
        this.activeEngine = null;
        this.activeSystem = 'faceted';
        this.themeState = { paletteId: 'system', overrides: null };
    }

    prepareForEngineSwitch(engine) {
        if (!engine || this.activeEngine !== engine || !this.suite) {
            return;
        }

        try {
            this.cachedState = this.suite.getState();
        } catch (error) {
            console.warn('PerformanceSuiteHost failed to capture state before switch', error);
        }

        this.suite.destroy();
        this.suite = null;
        this.activeEngine = null;
    }

    activateEngine(engine, { systemName = 'faceted', parameterManager } = {}) {
        if (!engine) {
            return null;
        }

        if (this.activeEngine === engine && this.suite) {
            this.activeSystem = systemName;
            applyThemeVariables(systemName, this.themeState);
            return this.suite;
        }

        const resolvedManager = resolveParameterManager(engine, parameterManager);
        const cachedThemeState = normalizeThemeState(this.cachedState?.theme);
        const activeThemeState = cachedThemeState || this.themeState || { paletteId: 'system', overrides: null };
        this.themeState = normalizeThemeState(activeThemeState);
        applyThemeVariables(systemName, this.themeState);

        if (!this.cachedState && this.suite) {
            try {
                this.cachedState = this.suite.getState();
            } catch (error) {
                console.warn('PerformanceSuiteHost failed to snapshot existing state', error);
            }
        }

        if (this.suite) {
            this.suite.destroy();
        }

        try {
            this.suite = new PerformanceSuite({
                engine,
                parameterManager: resolvedManager || undefined,
                themeContext: {
                    systemName,
                    baseTheme: getBaseTheme(systemName),
                    themeState: this.themeState,
                    onThemeChange: (state) => this.setThemeState(state, systemName)
                }
            });
        } catch (error) {
            console.warn('PerformanceSuiteHost failed to initialize suite', error);
            this.suite = null;
            return null;
        }

        if (this.suite?.applyThemeState) {
            try {
                this.suite.applyThemeState(this.themeState, { notify: true, silentStatus: true });
            } catch (error) {
                console.warn('PerformanceSuiteHost failed to apply theme state to suite', error);
            }
        }

        if (this.cachedState && this.suite?.applyState) {
            try {
                this.suite.applyState(this.cachedState);
            } catch (error) {
                console.warn('PerformanceSuiteHost failed to restore cached state', error);
            }
        }

        this.activeEngine = engine;
        this.activeSystem = systemName;

        return this.suite;
    }

    detachEngine(engine) {
        if (!engine || this.activeEngine !== engine) {
            return;
        }

        if (this.suite) {
            try {
                this.cachedState = this.suite.getState();
            } catch (error) {
                console.warn('PerformanceSuiteHost failed to snapshot state on detach', error);
            }

            this.suite.destroy();
            this.suite = null;
        }

        this.activeEngine = null;
    }

    setThemeState(themeState, systemName = this.activeSystem) {
        this.themeState = normalizeThemeState(themeState);
        applyThemeVariables(systemName, this.themeState);

        if (this.cachedState) {
            this.cachedState.theme = this.themeState;
        }
    }
}

let singleton = null;

export function getPerformanceSuiteHost() {
    if (singleton) {
        return singleton;
    }

    singleton = new PerformanceSuiteHost();

    if (typeof window !== 'undefined') {
        window.performanceSuiteHost = singleton;
    }

    return singleton;
}

export function getPerformanceTheme(systemName, themeState = null) {
    return buildTheme(systemName, normalizeThemeState(themeState));
}
