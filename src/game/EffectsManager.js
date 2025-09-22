const DEFAULT_COLORS = {
    gestureDirective: '#45ffe7',
    quickDraw: '#ff3a73',
    resolve: '#6ea8ff',
    default: '#ffffff',
};

export class EffectsManager {
    constructor(options = {}) {
        const {
            shaderHooks = null,
            targetHighlighter = null,
            colors = {},
        } = options;

        this.shaderHooks = shaderHooks;
        this.targetHighlighter = targetHighlighter;
        this.colors = { ...DEFAULT_COLORS, ...colors };
    }

    handleDirectiveStart(directive) {
        if (!directive) {
            return;
        }
        const color = this.resolveColor(directive.type);
        this.applyShaderEvent('directive-start', directive, color);
        this.applyTargetTint(color, directive);
    }

    handleDirectiveComplete(payload = {}) {
        const directive = payload.directive;
        const color = this.colors.resolve;
        this.applyShaderEvent('directive-complete', directive, color);
        this.clearTargetTint(payload);
    }

    resolveColor(type) {
        return this.colors[type] || this.colors.default;
    }

    applyShaderEvent(eventName, directive, color) {
        if (!this.shaderHooks) {
            return;
        }

        if (typeof this.shaderHooks.onDirectiveEvent === 'function') {
            this.shaderHooks.onDirectiveEvent(eventName, { directive, color });
            return;
        }

        if (eventName === 'directive-start') {
            if (typeof this.shaderHooks.flash === 'function') {
                this.shaderHooks.flash({ color, duration: 0.4 });
            } else if (typeof this.shaderHooks.setUniform === 'function') {
                try {
                    this.shaderHooks.setUniform('uDirectiveFlashColor', color);
                    this.shaderHooks.setUniform('uDirectiveFlashStrength', 1);
                } catch (error) {
                    // Ignore controllers without uniform setters.
                }
            }
            return;
        }

        if (eventName === 'directive-complete') {
            if (typeof this.shaderHooks.flash === 'function') {
                this.shaderHooks.flash({ color, duration: 0.25 });
            } else if (typeof this.shaderHooks.setUniform === 'function') {
                try {
                    this.shaderHooks.setUniform('uDirectiveFlashStrength', 0);
                } catch (error) {
                    // Ignore controllers without uniform setters.
                }
            }
        }
    }

    applyTargetTint(color, directive) {
        if (!this.targetHighlighter) {
            return;
        }

        if (typeof this.targetHighlighter.setDirectiveTint === 'function') {
            this.targetHighlighter.setDirectiveTint(color, directive);
            return;
        }

        if (typeof this.targetHighlighter === 'function') {
            this.targetHighlighter(color, directive);
        }
    }

    clearTargetTint(payload = {}) {
        if (!this.targetHighlighter) {
            return;
        }

        if (typeof this.targetHighlighter.clearDirectiveTint === 'function') {
            this.targetHighlighter.clearDirectiveTint(payload);
            return;
        }

        if (typeof this.targetHighlighter === 'function') {
            this.targetHighlighter(null, payload.directive);
        }
    }
}
