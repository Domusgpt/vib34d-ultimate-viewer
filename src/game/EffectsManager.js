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
        this.audioState = null;
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
            audioState: this.audioState,
        };

        this.applyShaderFlash(color, directive, this.audioState);
        this.pushVisualProgramToShader(directive, { color, audio: this.audioState });
        this.tintActiveTargets(color, directive, this.audioState);

        if (this.onStartCallback) {
            this.onStartCallback({ directive, color, audioState: this.audioState });
        }
    }

    handleDirectiveComplete(payload = {}) {
        const directive = payload.directive || this.activeEffect?.directive;
        const color = this.activeEffect?.color || this.getEffectColor('resolve');

        this.releaseShaderFlash(directive, payload);
        this.clearTargetTint({ ...payload, audioState: this.audioState });

        if (this.onCompleteCallback) {
            this.onCompleteCallback({ directive, color, payload, audioState: this.audioState });
        }

        this.activeEffect = null;
    }

    applyShaderFlash(color, directive, audioState) {
        if (!this.shaderController) {
            return;
        }

        if (typeof this.shaderController.triggerDirectiveStart === 'function') {
            this.shaderController.triggerDirectiveStart({ color, directive, audioState });
            return;
        }

        if (typeof this.shaderController.queueFlash === 'function') {
            this.shaderController.queueFlash({
                color,
                duration: this.pulseDuration,
                intensity: 1,
                source: 'directive',
                audioState,
            });
            return;
        }

        if (typeof this.shaderController.setUniform === 'function') {
            try {
                this.shaderController.setUniform('uDirectiveFlashColor', color);
                this.shaderController.setUniform('uDirectiveFlashStrength', 1.0);
                if (audioState) {
                    this.shaderController.setUniform('uDirectiveAudioLevel', audioState.intensity ?? 0);
                    this.shaderController.setUniform('uDirectiveAudioBeat', audioState.beat ? 1 : 0);
                }
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
            this.shaderController.triggerDirectiveResolve({ directive, payload, audioState: this.audioState });
            return;
        }

        if (typeof this.shaderController.queueFlash === 'function') {
            this.shaderController.queueFlash({
                color: this.getEffectColor('resolve'),
                duration: this.pulseDuration * 0.6,
                intensity: 0.6,
                source: 'directive-resolve',
                audioState: this.audioState,
            });
            return;
        }

        if (typeof this.shaderController.setUniform === 'function') {
            try {
                this.shaderController.setUniform('uDirectiveFlashStrength', 0.0);
                this.shaderController.setUniform('uDirectiveAudioBeat', 0.0);
            } catch (error) {
                // Ignore controllers that do not expose shader uniform setters.
            }
        }
    }

    tintActiveTargets(color, directive, audioState) {
        if (!this.targetCollection) {
            return;
        }

        if (typeof this.targetCollection.setDirectiveTint === 'function') {
            this.targetCollection.setDirectiveTint(color, directive, audioState);
            return;
        }

        if (Array.isArray(this.targetCollection)) {
            this.targetCollection.forEach((target) => {
                if (!target) {
                    return;
                }

                if (typeof target.setTint === 'function') {
                    target.setTint(color, this.pulseDuration, { directive, audioState });
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
                }
            });
        }
    }

    updateAudioState(audioState = null) {
        this.audioState = audioState
            ? {
                ...audioState,
                bandEnergies: { ...(audioState.bandEnergies || {}) },
            }
            : null;

        if (!this.shaderController) {
            return;
        }

        if (typeof this.shaderController.updateAudioState === 'function') {
            this.shaderController.updateAudioState(this.audioState);
            return;
        }

        if (this.audioState && typeof this.shaderController.setUniform === 'function') {
            try {
                this.shaderController.setUniform('uAudioLevel', this.audioState.intensity ?? 0);
                this.shaderController.setUniform('uAudioBeat', this.audioState.beat ? 1 : 0);
                this.shaderController.setUniform('uAudioBand', this.bandToUniform(this.audioState.dominantBand));
            } catch (error) {
                // Ignore controllers that do not expose shader uniform setters.
            }
        }
    }

    pushVisualProgramToShader(directive, context = {}) {
        if (!this.shaderController || !directive?.visualProgram) {
            return;
        }

        if (typeof this.shaderController.applyDirectiveProgram === 'function') {
            this.shaderController.applyDirectiveProgram({
                directive,
                visualProgram: directive.visualProgram,
                audioState: context.audio,
                color: context.color,
            });
            return;
        }

        if (typeof this.shaderController.setUniform === 'function') {
            try {
                this.shaderController.setUniform('uDirectivePattern', directive.visualProgram.pattern || '');
                this.shaderController.setUniform('uDirectiveDifficulty', directive.visualProgram.difficulty ?? 1);
                if (context.audio) {
                    this.shaderController.setUniform('uDirectiveAudioIntensity', context.audio.intensity ?? 0);
                }
            } catch (error) {
                // Ignore controllers without matching uniforms.
            }
        }
    }

    bandToUniform(band) {
        switch (band) {
        case 'low':
            return 0;
        case 'high':
            return 2;
        case 'mid':
        default:
            return 1;
        }
    }
}
