import {
    mergeThemePalettes,
    normalizeThemeState,
    normalizeThemeTransition,
    resolveThemeDetails,
    DEFAULT_THEME_TRANSITION,
    THEME_EASING_PRESETS
} from './PerformanceThemeUtils.js';

function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
}

export class PerformanceThemePanel {
    constructor({ container, config = {}, context = {}, onThemeChange } = {}) {
        this.container = container;
        this.config = config;
        this.context = context;
        this.onThemeChange = onThemeChange;

        this.palettes = this.composePalettes();
        this.transitionDefaults = normalizeThemeTransition(
            config?.transitionDefaults,
            DEFAULT_THEME_TRANSITION
        );
        this.easingOptions = Array.isArray(config?.easingPresets) && config.easingPresets.length
            ? config.easingPresets.map(option => ({
                id: option.id || option.value || option.label,
                label: option.label || option.id || option.value,
                value: option.value || option.id
            }))
            : THEME_EASING_PRESETS;
        this.state = normalizeThemeState(context.themeState || {}, { transitionDefaults: this.transitionDefaults });

        this.root = null;
        this.inputs = {};

        this.mount();
        this.bindEvents();
        this.render();
    }

    composePalettes() {
        const provided = Array.isArray(this.config?.palettes) ? this.config.palettes : [];
        return mergeThemePalettes(provided);
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
                <div class="performance-theme__transitions" data-role="transitions">
                    <label class="performance-theme__field performance-theme__field--inline">
                        <span>Transition Time</span>
                        <input type="range" min="0" max="4000" step="50" data-role="transition-duration" />
                        <span class="performance-theme__value" data-role="transition-duration-value"></span>
                    </label>
                    <label class="performance-theme__field performance-theme__field--inline">
                        <span>Transition Curve</span>
                        <select data-role="transition-easing"></select>
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
        this.inputs.transitions = this.root.querySelector('[data-role="transitions"]');
        this.inputs.transitionDuration = this.root.querySelector('[data-role="transition-duration"]');
        this.inputs.transitionDurationValue = this.root.querySelector('[data-role="transition-duration-value"]');
        this.inputs.transitionEasing = this.root.querySelector('[data-role="transition-easing"]');

        if (this.inputs.palette) {
            this.palettes.forEach(palette => {
                const option = document.createElement('option');
                option.value = palette.id;
                option.textContent = palette.label;
                this.inputs.palette.appendChild(option);
            });
        }

        if (this.inputs.transitionEasing) {
            this.populateTransitionEasingOptions();
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

        this.inputs.transitionDuration?.addEventListener('input', () => {
            const value = parseFloat(this.inputs.transitionDuration.value);
            this.updateTransition({ duration: value }, { notify: true });
        });

        this.inputs.transitionEasing?.addEventListener('change', () => {
            const value = this.inputs.transitionEasing.value;
            this.updateTransition({ easing: value }, { notify: true });
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
            const details = resolveThemeDetails(this.state, {
                palettes: this.palettes,
                baseTheme: this.context.baseTheme
            });
            this.inputs.description.textContent = details.description || palette?.description || '';
        }

        const showCustom = this.state.paletteId === 'custom';
        if (this.inputs.custom) {
            this.inputs.custom.style.display = showCustom ? 'grid' : 'none';
        }

        const details = resolveThemeDetails(this.state, {
            palettes: this.palettes,
            baseTheme: this.context.baseTheme
        });
        const accent = details.accent;
        const highlightAlpha = details.highlightAlpha;
        const glowStrength = details.glowStrength;

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

        const transition = normalizeThemeTransition(this.state.transition, this.transitionDefaults);
        if (this.inputs.transitionDuration) {
            this.inputs.transitionDuration.value = transition.duration.toString();
        }
        if (this.inputs.transitionDurationValue) {
            this.inputs.transitionDurationValue.textContent = this.formatDurationLabel(transition.duration);
        }
        if (this.inputs.transitionEasing) {
            this.ensureTransitionOption(transition.easing);
            this.inputs.transitionEasing.value = transition.easing;
        }
    }

    applyPalette(paletteId, { notify = false } = {}) {
        const palette = this.palettes.find(p => p.id === paletteId) || this.palettes[0];
        const nextState = { paletteId: palette.id, overrides: null, transition: this.state.transition };

        if (paletteId === 'custom') {
            const details = resolveThemeDetails(this.state, {
                palettes: this.palettes,
                baseTheme: this.context.baseTheme,
                transitionDefaults: this.transitionDefaults
            });
            nextState.overrides = {
                accent: details.accent,
                highlightAlpha: details.highlightAlpha,
                glowStrength: details.glowStrength
            };
        } else if (palette?.accent || typeof palette?.highlightAlpha === 'number' || typeof palette?.glowStrength === 'number') {
            nextState.overrides = {
                accent: palette.accent,
                highlightAlpha: palette.highlightAlpha,
                glowStrength: palette.glowStrength
            };
        }

        this.state = normalizeThemeState(nextState, { transitionDefaults: this.transitionDefaults });
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

        this.state = normalizeThemeState({
            paletteId: this.state.paletteId,
            overrides,
            transition: this.state.transition
        }, { transitionDefaults: this.transitionDefaults });
        this.render();
        if (notify) {
            this.emitChange();
        }
    }

    updateTransition(partial = {}, { notify = false } = {}) {
        const merged = {
            ...(this.state.transition || {})
        };
        if (Object.prototype.hasOwnProperty.call(partial, 'duration')) {
            merged.duration = partial.duration;
        }
        if (Object.prototype.hasOwnProperty.call(partial, 'easing')) {
            merged.easing = partial.easing;
        }

        const transition = normalizeThemeTransition(merged, this.transitionDefaults);
        this.state = normalizeThemeState({
            paletteId: this.state.paletteId,
            overrides: this.state.overrides,
            transition
        }, { transitionDefaults: this.transitionDefaults });
        this.render();
        if (notify) {
            this.emitChange();
        }
    }

    resetToSystem() {
        this.state = normalizeThemeState({
            paletteId: 'system',
            transition: this.transitionDefaults
        }, { transitionDefaults: this.transitionDefaults });
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
        this.state = normalizeThemeState(state || {}, { transitionDefaults: this.transitionDefaults });

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

    populateTransitionEasingOptions() {
        const select = this.inputs.transitionEasing;
        if (!select) return;
        select.innerHTML = '';
        this.easingOptions.forEach(option => {
            if (!option || !option.value) return;
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.label || option.value;
            select.appendChild(opt);
        });
    }

    ensureTransitionOption(value) {
        if (!this.inputs.transitionEasing || !value) {
            return;
        }
        const existing = Array.from(this.inputs.transitionEasing.options).some(option => option.value === value);
        if (!existing) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = `Custom (${value})`;
            option.dataset.dynamic = 'true';
            this.inputs.transitionEasing.appendChild(option);
        }
    }

    formatDurationLabel(durationMs) {
        const value = Number(durationMs);
        if (!Number.isFinite(value) || value <= 0) {
            return 'Instant';
        }
        if (value < 1000) {
            return `${Math.round(value)} ms`;
        }
        const seconds = value / 1000;
        return `${seconds % 1 === 0 ? seconds.toFixed(0) : seconds.toFixed(1)} s`;
    }

    destroy() {
        ['palette', 'accent', 'highlight', 'glow', 'reset', 'transitionDuration', 'transitionEasing'].forEach(key => {
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
