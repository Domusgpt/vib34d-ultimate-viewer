const DEFAULT_PALETTES = [
    {
        id: 'system',
        label: 'System Accent',
        description: 'Follow the current engine\'s signature colors.'
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

function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
}

function normalizeState(state = {}) {
    const paletteId = state.paletteId || 'system';
    let overrides = null;

    if (state.overrides) {
        overrides = {
            accent: state.overrides.accent || undefined,
            highlightAlpha: typeof state.overrides.highlightAlpha === 'number'
                ? state.overrides.highlightAlpha
                : undefined,
            glowStrength: typeof state.overrides.glowStrength === 'number'
                ? state.overrides.glowStrength
                : undefined
        };
    }

    return { paletteId, overrides };
}

export class PerformanceThemePanel {
    constructor({ container, config = {}, context = {}, onThemeChange } = {}) {
        this.container = container;
        this.config = config;
        this.context = context;
        this.onThemeChange = onThemeChange;

        this.palettes = this.composePalettes();
        this.state = normalizeState(context.themeState || {});

        this.root = null;
        this.inputs = {};

        this.mount();
        this.bindEvents();
        this.render();
    }

    composePalettes() {
        const provided = Array.isArray(this.config?.palettes) ? this.config.palettes : [];
        const map = new Map();
        DEFAULT_PALETTES.forEach(palette => map.set(palette.id, palette));
        provided.forEach(palette => {
            if (palette?.id) {
                map.set(palette.id, { ...palette });
            }
        });
        return Array.from(map.values());
    }

    mount() {
        if (!this.container || typeof document === 'undefined') {
            return;
        }

        const template = `
            <header class="performance-theme__header">
                <div>
                    <h3>Color Atmosphere</h3>
                    <p>Curate the accent glow shared by every module.</p>
                </div>
                <button type="button" class="performance-theme__reset" data-role="reset">Reset</button>
            </header>
            <div class="performance-theme__body">
                <label class="performance-theme__field">
                    <span>Palette</span>
                    <select data-role="palette"></select>
                </label>
                <p class="performance-theme__description" data-role="description"></p>
                <div class="performance-theme__custom" data-role="custom">
                    <label class="performance-theme__field performance-theme__field--inline performance-theme__field--color">
                        <span>Accent Color</span>
                        <input type="color" data-role="accent" aria-label="Accent color" />
                    </label>
                    <label class="performance-theme__field performance-theme__field--inline">
                        <span>Highlight Bloom</span>
                        <input type="range" min="0.1" max="0.6" step="0.01" data-role="highlight" />
                        <span class="performance-theme__value" data-role="highlight-value"></span>
                    </label>
                    <label class="performance-theme__field performance-theme__field--inline">
                        <span>Glow Strength</span>
                        <input type="range" min="0.2" max="1" step="0.02" data-role="glow" />
                        <span class="performance-theme__value" data-role="glow-value"></span>
                    </label>
                </div>
            </div>
        `;

        if (this.container.dataset?.role === 'theme') {
            this.root = this.container;
            this.root.classList.add('performance-theme', 'performance-suite__stack');
            this.root.innerHTML = template;
        } else {
            this.root = document.createElement('div');
            this.root.className = 'performance-theme performance-suite__stack';
            this.root.innerHTML = template;
            this.container.prepend(this.root);
        }

        this.inputs.palette = this.root.querySelector('[data-role="palette"]');
        this.inputs.description = this.root.querySelector('[data-role="description"]');
        this.inputs.custom = this.root.querySelector('[data-role="custom"]');
        this.inputs.accent = this.root.querySelector('[data-role="accent"]');
        this.inputs.highlight = this.root.querySelector('[data-role="highlight"]');
        this.inputs.highlightValue = this.root.querySelector('[data-role="highlight-value"]');
        this.inputs.glow = this.root.querySelector('[data-role="glow"]');
        this.inputs.glowValue = this.root.querySelector('[data-role="glow-value"]');
        this.inputs.reset = this.root.querySelector('[data-role="reset"]');

        if (this.inputs.palette) {
            this.palettes.forEach(palette => {
                const option = document.createElement('option');
                option.value = palette.id;
                option.textContent = palette.label;
                this.inputs.palette.appendChild(option);
            });
        }
    }

    bindEvents() {
        if (!this.root) {
            return;
        }

        this.inputs.palette?.addEventListener('change', () => {
            const paletteId = this.inputs.palette.value;
            this.applyPalette(paletteId, { notify: true });
        });

        this.inputs.accent?.addEventListener('input', () => {
            this.updateOverrides({ accent: this.inputs.accent.value }, { notify: true });
        });

        this.inputs.highlight?.addEventListener('input', () => {
            const value = parseFloat(this.inputs.highlight.value);
            this.updateOverrides({ highlightAlpha: value }, { notify: true });
        });

        this.inputs.glow?.addEventListener('input', () => {
            const value = parseFloat(this.inputs.glow.value);
            this.updateOverrides({ glowStrength: value }, { notify: true });
        });

        this.inputs.reset?.addEventListener('click', () => {
            this.resetToSystem();
        });
    }

    render() {
        if (!this.root) {
            return;
        }

        const palette = this.palettes.find(p => p.id === this.state.paletteId) || this.palettes[0];
        if (this.inputs.palette) {
            this.inputs.palette.value = this.state.paletteId;
        }

        if (this.inputs.description) {
            this.inputs.description.textContent = palette?.description || '';
        }

        const showCustom = this.state.paletteId === 'custom';
        if (this.inputs.custom) {
            this.inputs.custom.style.display = showCustom ? 'grid' : 'none';
        }

        const baseAccent = this.context.baseTheme?.accent || '#53d7ff';
        const baseHighlight = this.context.baseTheme?.highlightAlpha ?? 0.22;
        const baseGlow = this.context.baseTheme?.glowStrength ?? 0.65;

        const overrides = this.state.overrides || {};
        const accent = overrides.accent || palette?.accent || baseAccent;
        const highlightAlpha = typeof overrides.highlightAlpha === 'number'
            ? overrides.highlightAlpha
            : palette?.highlightAlpha ?? baseHighlight;
        const glowStrength = typeof overrides.glowStrength === 'number'
            ? overrides.glowStrength
            : palette?.glowStrength ?? baseGlow;

        if (this.inputs.accent) {
            this.inputs.accent.value = accent;
        }

        if (this.inputs.highlight) {
            this.inputs.highlight.value = highlightAlpha.toFixed(2);
        }
        if (this.inputs.highlightValue) {
            this.inputs.highlightValue.textContent = (highlightAlpha * 100).toFixed(0) + '%';
        }

        if (this.inputs.glow) {
            this.inputs.glow.value = glowStrength.toFixed(2);
        }
        if (this.inputs.glowValue) {
            this.inputs.glowValue.textContent = glowStrength.toFixed(2);
        }
    }

    applyPalette(paletteId, { notify = false } = {}) {
        const palette = this.palettes.find(p => p.id === paletteId) || this.palettes[0];
        const nextState = { paletteId: palette.id, overrides: null };

        if (paletteId === 'custom') {
            const baseAccent = this.context.baseTheme?.accent || '#53d7ff';
            const baseHighlight = this.context.baseTheme?.highlightAlpha ?? 0.22;
            const baseGlow = this.context.baseTheme?.glowStrength ?? 0.65;
            nextState.overrides = {
                accent: baseAccent,
                highlightAlpha: baseHighlight,
                glowStrength: baseGlow
            };
        } else if (palette?.accent || typeof palette?.highlightAlpha === 'number' || typeof palette?.glowStrength === 'number') {
            nextState.overrides = {
                accent: palette.accent,
                highlightAlpha: palette.highlightAlpha,
                glowStrength: palette.glowStrength
            };
        }

        this.state = normalizeState(nextState);
        this.render();
        if (notify) {
            this.emitChange();
        }
    }

    updateOverrides(partial = {}, { notify = false } = {}) {
        const overrides = {
            ...(this.state.overrides || {})
        };

        Object.assign(overrides, partial);

        this.state = normalizeState({
            paletteId: this.state.paletteId,
            overrides
        });
        this.render();
        if (notify) {
            this.emitChange();
        }
    }

    resetToSystem() {
        this.state = normalizeState({ paletteId: 'system' });
        this.render();
        this.emitChange();
    }

    emitChange() {
        if (typeof this.onThemeChange === 'function') {
            this.onThemeChange(this.getState());
        }
    }

    getState() {
        return clone(this.state);
    }

    applyState(state, { notify = false } = {}) {
        this.state = normalizeState(state || {});

        if (this.state.paletteId !== 'custom') {
            const palette = this.palettes.find(p => p.id === this.state.paletteId);
            if (!palette) {
                this.state.paletteId = 'system';
                this.state.overrides = null;
            }
        }

        this.render();
        if (notify) {
            this.emitChange();
        }
    }

    destroy() {
        ['palette', 'accent', 'highlight', 'glow', 'reset'].forEach(key => {
            const input = this.inputs[key];
            if (input && input.parentNode) {
                input.replaceWith(input.cloneNode(true));
            }
        });
        if (this.root) {
            if (this.root === this.container) {
                this.root.innerHTML = '';
                this.root.classList.remove('performance-theme', 'performance-suite__stack');
            } else if (this.root.parentNode) {
                this.root.parentNode.removeChild(this.root);
            }
        }
        this.root = null;
        this.inputs = {};
    }
}
