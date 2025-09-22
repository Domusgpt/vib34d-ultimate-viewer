const DEFAULT_COLORS = {
    gestureDirective: '#45ffe7',
    quickDraw: '#ff3a73',
    fallback: '#7f9cff',
};

const getAccentColor = (directive) => {
    if (!directive) {
        return DEFAULT_COLORS.fallback;
    }
    if (directive.colorPalette?.accent) {
        return directive.colorPalette.accent;
    }
    if (directive.color) {
        return directive.color;
    }
    return DEFAULT_COLORS[directive.type] || DEFAULT_COLORS.fallback;
};

const ensureRootElement = (root) => {
    if (root) {
        return root;
    }
    if (typeof document === 'undefined') {
        return null;
    }
    return document.documentElement;
};

export class EffectsManager {
    constructor(options = {}) {
        this.options = { ...options };
        this.rootElement = ensureRootElement(this.options.rootElement);
        this.activeDirectiveId = null;
    }

    dispatchEvent(name, detail) {
        if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
            return;
        }
        try {
            let event;
            if (typeof CustomEvent === 'function') {
                event = new CustomEvent(name, { detail });
            } else if (typeof document !== 'undefined' && document.createEvent) {
                event = document.createEvent('CustomEvent');
                event.initCustomEvent(name, false, false, detail);
            }

            if (event) {
                window.dispatchEvent(event);
            }
        } catch (error) {
            // Ignore dispatch errors in non-browser environments.
        }
    }

    applyDirectiveTheme(directive) {
        if (!this.rootElement) {
            return;
        }

        const accent = getAccentColor(directive);
        this.rootElement.classList.add('lp-directive-active');
        this.rootElement.style.setProperty('--lp-directive-accent', accent);

        if (directive?.colorPalette?.background) {
            this.rootElement.style.setProperty('--lp-directive-overlay', directive.colorPalette.background);
        }

        if (typeof this.options.onDirectiveAccent === 'function') {
            this.options.onDirectiveAccent({ accent, directive });
        }
    }

    clearDirectiveTheme() {
        if (!this.rootElement) {
            return;
        }
        this.rootElement.classList.remove('lp-directive-active');
        this.rootElement.classList.remove('lp-spawn-paused');
        this.rootElement.style.removeProperty('--lp-directive-accent');
        this.rootElement.style.removeProperty('--lp-directive-overlay');
    }

    handleDirectiveStart(directive) {
        this.activeDirectiveId = directive?.id || null;
        this.applyDirectiveTheme(directive);
        if (typeof this.options.onDirectiveStart === 'function') {
            this.options.onDirectiveStart(directive);
        }
        this.dispatchEvent('lattice:directive-start', { directive });
    }

    handleDirectiveComplete(event = {}) {
        const { directive } = event;
        if (!directive || directive.id === this.activeDirectiveId) {
            this.activeDirectiveId = null;
            this.clearDirectiveTheme();
        }

        if (typeof this.options.onDirectiveComplete === 'function') {
            this.options.onDirectiveComplete(event);
        }
        this.dispatchEvent('lattice:directive-complete', event);
    }

    updateAmbientDirective(spawnDirective) {
        if (!this.rootElement) {
            if (typeof this.options.onSpawnState === 'function') {
                this.options.onSpawnState(spawnDirective);
            }
            return;
        }

        if (spawnDirective?.paused) {
            this.rootElement.classList.add('lp-spawn-paused');
        } else {
            this.rootElement.classList.remove('lp-spawn-paused');
        }

        if (typeof this.options.onSpawnState === 'function') {
            this.options.onSpawnState(spawnDirective);
        }
    }
}

export default EffectsManager;
