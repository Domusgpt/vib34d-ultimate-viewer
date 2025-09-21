/**
 * EffectsManager coordinates high-impact visuals that accompany directive prompts.
 * It attempts to notify shader controllers or active targets when directives begin
 * or conclude so the player receives unmistakable feedback.
 */
export class EffectsManager {
    constructor(options = {}) {
        const {
            shaderController = null,
            targetCollection = null,
            onDirectiveStart = null,
            onDirectiveComplete = null,
            colors = {},
            pulseDuration = 1200,
        } = options;

        this.shaderController = shaderController;
        this.targetCollection = targetCollection;
        this.onStartCallback = typeof onDirectiveStart === 'function' ? onDirectiveStart : null;
        this.onCompleteCallback = typeof onDirectiveComplete === 'function' ? onDirectiveComplete : null;
        this.pulseDuration = pulseDuration;

        this.colors = {
            gestureDirective: '#3fffe4',
            quickDraw: '#ff2f6d',
            resolve: '#66a5ff',
            default: '#ffffff',
            ...colors,
        };

        this.activeEffect = null;
        this.ambientEffect = null;
    }

    getEffectColor(type) {
        return this.colors[type] || this.colors.default;
    }

    handleDirectiveStart(directive) {
        if (!directive) {
            return;
        }

        const color = this.getEffectColor(directive.type);
        this.activeEffect = {
            directive,
            color,
            startedAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
            shaderEffect: directive.shaderEffect || directive.metadata?.shaderEffect || null,
            pattern: directive.pattern || null,
        };

        this.applyShaderFlash(color, directive);
        this.tintActiveTargets(color, directive);
        this.applyAudioReactiveEffect(this.activeEffect.shaderEffect, directive);
        this.broadcastPatternToTargets(this.activeEffect.pattern, directive);

        if (this.onStartCallback) {
            this.onStartCallback({ directive, color });
        }
    }

    handleDirectiveComplete(payload = {}) {
        const directive = payload.directive || this.activeEffect?.directive;
        const color = this.activeEffect?.color || this.getEffectColor('resolve');

        this.releaseShaderFlash(directive, payload);
        this.clearTargetTint(payload);
        this.releaseAudioReactiveEffect(directive, payload);
        this.broadcastPatternToTargets(null, directive, true);

        if (this.onCompleteCallback) {
            this.onCompleteCallback({ directive, color, payload });
        }

        this.activeEffect = null;
    }

    applyShaderFlash(color, directive) {
        if (!this.shaderController) {
            return;
        }

        if (typeof this.shaderController.triggerDirectiveStart === 'function') {
            this.shaderController.triggerDirectiveStart({ color, directive });
            return;
        }

        if (typeof this.shaderController.queueFlash === 'function') {
            this.shaderController.queueFlash({
                color,
                duration: this.pulseDuration,
                intensity: 1,
                source: 'directive',
            });
            return;
        }

        if (typeof this.shaderController.setUniform === 'function') {
            try {
                this.shaderController.setUniform('uDirectiveFlashColor', color);
                this.shaderController.setUniform('uDirectiveFlashStrength', 1.0);
            } catch (error) {
                // Ignore controllers that do not expose shader uniform setters.
            }
        }
    }

    releaseShaderFlash(directive, payload) {
        if (!this.shaderController) {
            return;
        }

        if (typeof this.shaderController.triggerDirectiveResolve === 'function') {
            this.shaderController.triggerDirectiveResolve({ directive, payload });
            return;
        }

        if (typeof this.shaderController.queueFlash === 'function') {
            this.shaderController.queueFlash({
                color: this.getEffectColor('resolve'),
                duration: this.pulseDuration * 0.6,
                intensity: 0.6,
                source: 'directive-resolve',
            });
            return;
        }

        if (typeof this.shaderController.setUniform === 'function') {
            try {
                this.shaderController.setUniform('uDirectiveFlashStrength', 0.0);
            } catch (error) {
                // Ignore controllers that do not expose shader uniform setters.
            }
        }
    }

    tintActiveTargets(color, directive) {
        if (!this.targetCollection) {
            return;
        }

        if (typeof this.targetCollection.setDirectiveTint === 'function') {
            this.targetCollection.setDirectiveTint(color, directive);
            return;
        }

        if (Array.isArray(this.targetCollection)) {
            this.targetCollection.forEach((target) => {
                if (!target) {
                    return;
                }

                if (typeof target.setTint === 'function') {
                    target.setTint(color, this.pulseDuration);
                } else if (target.material && 'tint' in target.material) {
                    target.material.tint = color;
                } else if (target.style) {
                    target.style.setProperty('--directive-tint', color);
                }
            });
            return;
        }

        if (typeof this.targetCollection === 'object' && typeof this.targetCollection.applyTint === 'function') {
            this.targetCollection.applyTint(color, directive);
        }
    }

    clearTargetTint(payload) {
        if (!this.targetCollection) {
            return;
        }

        if (typeof this.targetCollection.clearDirectiveTint === 'function') {
            this.targetCollection.clearDirectiveTint(payload);
            return;
        }

        if (Array.isArray(this.targetCollection)) {
            this.targetCollection.forEach((target) => {
                if (!target) {
                    return;
                }

                if (typeof target.clearTint === 'function') {
                    target.clearTint(payload);
                } else if (target.material && 'tint' in target.material) {
                    target.material.tint = null;
                } else if (target.style) {
                    target.style.removeProperty('--directive-tint');
                    target.style.removeProperty('--directive-pattern-accent');
                }
            });
        }
    }

    applyAudioReactiveEffect(effect, directive) {
        const resolvedEffect = effect || directive?.shaderEffect || directive?.metadata?.shaderEffect;
        if (!resolvedEffect) {
            return;
        }

        if (this.shaderController) {
            if (typeof this.shaderController.applyReactiveEffect === 'function') {
                this.shaderController.applyReactiveEffect(resolvedEffect, directive);
            } else if (typeof this.shaderController.setUniform === 'function') {
                this.applyShaderEffectUniforms(resolvedEffect);
            }
        }

        if (this.targetCollection) {
            if (typeof this.targetCollection.applyShaderEffect === 'function') {
                this.targetCollection.applyShaderEffect(resolvedEffect, directive);
            } else if (Array.isArray(this.targetCollection)) {
                this.targetCollection.forEach((target) => {
                    if (target && typeof target.applyShaderEffect === 'function') {
                        target.applyShaderEffect(resolvedEffect, directive);
                    }
                });
            }
        }
    }

    releaseAudioReactiveEffect(directive, payload) {
        const effect = this.activeEffect?.shaderEffect || directive?.shaderEffect;
        if (!effect) {
            return;
        }

        if (this.shaderController) {
            if (typeof this.shaderController.clearReactiveEffect === 'function') {
                this.shaderController.clearReactiveEffect(effect, directive, payload);
            } else if (typeof this.shaderController.setUniform === 'function') {
                this.resetShaderEffectUniforms(effect);
            }
        }

        if (this.targetCollection) {
            if (typeof this.targetCollection.clearShaderEffect === 'function') {
                this.targetCollection.clearShaderEffect(effect, directive, payload);
            } else if (Array.isArray(this.targetCollection)) {
                this.targetCollection.forEach((target) => {
                    if (target && typeof target.clearShaderEffect === 'function') {
                        target.clearShaderEffect(effect, directive, payload);
                    }
                });
            }
        }
    }

    applyShaderEffectUniforms(effect) {
        try {
            switch (effect.type) {
            case 'color-invert':
                this.shaderController.setUniform('uDirectiveInvertStrength', effect.intensity ?? 0.6);
                break;
            case 'chromatic-aberration':
                this.shaderController.setUniform('uDirectiveChromatic', effect.intensity ?? 0.4);
                break;
            case 'bloom-pulse':
                this.shaderController.setUniform('uDirectiveBloom', effect.intensity ?? 0.5);
                break;
            case 'glow-pulse':
                this.shaderController.setUniform('uDirectiveGlow', effect.intensity ?? 0.6);
                break;
            default:
                this.shaderController.setUniform('uDirectiveEffectIntensity', effect.intensity ?? 0.5);
            }
        } catch (error) {
            // Ignore uniform application failures for controllers that do not expose setters.
        }
    }

    resetShaderEffectUniforms(effect) {
        try {
            switch (effect.type) {
            case 'color-invert':
                this.shaderController.setUniform('uDirectiveInvertStrength', 0);
                break;
            case 'chromatic-aberration':
                this.shaderController.setUniform('uDirectiveChromatic', 0);
                break;
            case 'bloom-pulse':
                this.shaderController.setUniform('uDirectiveBloom', 0);
                break;
            case 'glow-pulse':
                this.shaderController.setUniform('uDirectiveGlow', 0);
                break;
            default:
                this.shaderController.setUniform('uDirectiveEffectIntensity', 0);
            }
        } catch (error) {
            // Ignore uniform resets when unsupported.
        }
    }

    broadcastPatternToTargets(pattern, directive, clear = false) {
        if (!this.targetCollection) {
            return;
        }

        if (typeof this.targetCollection.applyPattern === 'function') {
            if (clear && typeof this.targetCollection.clearPattern === 'function') {
                this.targetCollection.clearPattern(directive);
            } else {
                this.targetCollection.applyPattern(pattern, directive);
            }
            return;
        }

        if (Array.isArray(this.targetCollection)) {
            this.targetCollection.forEach((target) => {
                if (!target) {
                    return;
                }

                if (clear) {
                    if (typeof target.clearPattern === 'function') {
                        target.clearPattern(directive);
                    } else if (target.style) {
                        target.style.removeProperty('--directive-pattern-accent');
                    }
                    return;
                }

                if (typeof target.applyPattern === 'function') {
                    target.applyPattern(pattern, directive);
                } else if (target.style && pattern?.colorPalette?.accent) {
                    target.style.setProperty('--directive-pattern-accent', pattern.colorPalette.accent);
                }
            });
        }
    }

    updateAmbientDirective(spawnDirective = {}) {
        const effect = spawnDirective?.shaderEffect;
        if (!effect || spawnDirective.paused) {
            this.releaseAmbientEffect();
            return;
        }

        if (this.ambientEffect && this.compareEffects(effect, this.ambientEffect.effect)) {
            if (this.shaderController && typeof this.shaderController.updateAmbientEffect === 'function') {
                this.shaderController.updateAmbientEffect(effect, spawnDirective);
            }
            this.ambientEffect.directive = spawnDirective;
            return;
        }

        this.applyAmbientEffect(effect, spawnDirective);
    }

    applyAmbientEffect(effect, directive) {
        this.releaseAmbientEffect();
        this.ambientEffect = { effect: { ...effect }, directive };

        if (this.shaderController) {
            if (typeof this.shaderController.applyAmbientEffect === 'function') {
                this.shaderController.applyAmbientEffect(effect, directive);
            } else if (typeof this.shaderController.setUniform === 'function') {
                this.applyShaderEffectUniforms(effect);
            }
        }
    }

    releaseAmbientEffect() {
        if (!this.ambientEffect) {
            return;
        }

        if (this.shaderController) {
            if (typeof this.shaderController.clearAmbientEffect === 'function') {
                this.shaderController.clearAmbientEffect(this.ambientEffect.effect, this.ambientEffect.directive);
            } else if (typeof this.shaderController.setUniform === 'function') {
                this.resetShaderEffectUniforms(this.ambientEffect.effect);
            }
        }

        this.ambientEffect = null;
    }

    compareEffects(effectA, effectB) {
        if (!effectA || !effectB) {
            return false;
        }
        if (effectA.type !== effectB.type) {
            return false;
        }
        if (effectA.variant && effectB.variant && effectA.variant !== effectB.variant) {
            return false;
        }
        return true;
    }
}
