/**
 * HUDRenderer builds the heads-up display for the Lattice Pulse game. In addition
 * to the baseline status line it now provides a directive overlay that splashes
 * event prompts across the play field.
 */
export class HUDRenderer {
    constructor(rootElement = null, options = {}) {
        this.rootElement = rootElement || (typeof document !== 'undefined' ? document.body : null);
        this.options = {
            overlayId: 'directive-overlay',
            ...options,
        };

        this.overlayElements = null;
        this.countdownRaf = null;
        this.activeDirective = null;

        if (this.rootElement && typeof document !== 'undefined') {
            this.overlayElements = this.buildDirectiveOverlay();
        }
    }

    buildDirectiveOverlay() {
        if (typeof document === 'undefined') {
            return null;
        }

        const overlay = document.createElement('div');
        overlay.className = 'directive-overlay directive-overlay--generic';
        overlay.id = this.options.overlayId;
        overlay.setAttribute('aria-live', 'assertive');

        const panel = document.createElement('div');
        panel.className = 'directive-overlay__panel';

        const label = document.createElement('div');
        label.className = 'directive-overlay__label';
        panel.appendChild(label);

        const prompt = document.createElement('div');
        prompt.className = 'directive-overlay__prompt';
        panel.appendChild(prompt);

        const countdown = document.createElement('div');
        countdown.className = 'directive-overlay__countdown';

        const ring = document.createElement('div');
        ring.className = 'directive-overlay__countdown-ring';
        countdown.appendChild(ring);

        const number = document.createElement('span');
        number.className = 'directive-overlay__countdown-number';
        countdown.appendChild(number);

        const hint = document.createElement('span');
        hint.className = 'directive-overlay__countdown-hint';
        hint.textContent = 'SECONDS';
        countdown.appendChild(hint);

        panel.appendChild(countdown);

        const annotation = document.createElement('div');
        annotation.className = 'directive-overlay__annotation';
        panel.appendChild(annotation);

        const badges = document.createElement('div');
        badges.className = 'directive-overlay__badges';

        const patternBadge = document.createElement('span');
        patternBadge.className = 'directive-overlay__badge directive-overlay__badge--pattern';
        badges.appendChild(patternBadge);

        const difficultyBadge = document.createElement('span');
        difficultyBadge.className = 'directive-overlay__badge directive-overlay__badge--difficulty';
        badges.appendChild(difficultyBadge);

        panel.appendChild(badges);

        overlay.appendChild(panel);

        this.rootElement.appendChild(overlay);

        return {
            overlay,
            panel,
            label,
            prompt,
            countdown,
            ring,
            number,
            hint,
            annotation,
            badges,
            patternBadge,
            difficultyBadge,
        };
    }

    showDirectiveOverlay(directive = {}) {
        if (!this.overlayElements?.overlay) {
            return;
        }

        const {
            overlay,
            label,
            prompt,
            number,
            ring,
            annotation,
            badges,
            patternBadge,
            difficultyBadge,
        } = this.overlayElements;

        this.activeDirective = directive;

        overlay.classList.add('is-visible');
        overlay.dataset.type = directive.type || 'directive';
        overlay.dataset.pattern = directive.pattern?.type || '';
        overlay.dataset.difficulty = (directive.difficultyLabel || '').toLowerCase();

        overlay.classList.remove(
            'directive-overlay--gesture',
            'directive-overlay--quickDraw',
            'directive-overlay--generic',
        );
        overlay.classList.add(`directive-overlay--${directive.type || 'generic'}`);

        const accentColor = directive.color || directive.colorPalette?.primary;
        if (accentColor) {
            overlay.style.setProperty('--directive-accent', accentColor);
            overlay.style.setProperty('--directive-accent-glow', this.buildGlowColor(accentColor));
        } else {
            overlay.style.removeProperty('--directive-accent');
            overlay.style.removeProperty('--directive-accent-glow');
        }

        if (directive.colorPalette) {
            if (directive.colorPalette.secondary) {
                overlay.style.setProperty('--directive-secondary', directive.colorPalette.secondary);
            }
            if (directive.colorPalette.tertiary) {
                overlay.style.setProperty('--directive-tertiary', directive.colorPalette.tertiary);
            }
        } else {
            overlay.style.removeProperty('--directive-secondary');
            overlay.style.removeProperty('--directive-tertiary');
        }

        label.textContent = (directive.label || 'Directive').toUpperCase();
        prompt.textContent = directive.prompt || directive.description || '';
        annotation.textContent = directive.annotation || directive.subtitle || '';

        const patternLabel = this.formatPatternLabel(directive.pattern);
        const difficultyLabel = this.formatDifficultyLabel(directive);
        if (patternBadge) {
            patternBadge.textContent = patternLabel || '';
            patternBadge.classList.toggle('is-hidden', !patternLabel);
        }
        if (difficultyBadge) {
            difficultyBadge.textContent = difficultyLabel || '';
            difficultyBadge.classList.toggle('is-hidden', !difficultyLabel);
        }
        if (badges) {
            const hideBadges = !patternLabel && !difficultyLabel;
            badges.classList.toggle('is-hidden', hideBadges);
        }

        const duration = directive.duration
            ?? (directive.countdownSeconds ? directive.countdownSeconds * 1000 : null);
        const countdownSeconds = directive.countdownSeconds
            ?? (duration ? Math.ceil(duration / 1000) : null);

        number.textContent = countdownSeconds != null ? countdownSeconds : '';
        overlay.style.setProperty('--directive-duration', duration ? `${duration}ms` : '0ms');
        overlay.style.setProperty('--directive-progress', '1');
        if (directive.intensity != null) {
            overlay.style.setProperty('--directive-intensity', Number.parseFloat(directive.intensity).toFixed(3));
        } else if (directive.audioFrame?.energy != null) {
            overlay.style.setProperty('--directive-intensity', Number.parseFloat(directive.audioFrame.energy).toFixed(3));
        } else {
            overlay.style.removeProperty('--directive-intensity');
        }

        if (ring) {
            ring.classList.remove('is-animating');
            ring.style.animationDuration = duration ? `${duration}ms` : '';
            // Force reflow to restart the animation.
            void ring.offsetWidth; // eslint-disable-line no-void
            ring.classList.add('is-animating');
        }

        this.beginCountdown(duration, directive);
    }

    updateDirectiveCountdown(state) {
        if (!this.activeDirective || !this.overlayElements?.overlay) {
            return;
        }

        if (state.type !== this.activeDirective.type) {
            return;
        }

        const { overlay, number } = this.overlayElements;

        if (state.remaining != null && number) {
            const remainingSeconds = Math.max(0, Math.ceil(state.remaining / 1000));
            number.textContent = remainingSeconds.toString();

            if (state.duration) {
                const progress = 1 - (state.remaining / state.duration);
                overlay.style.setProperty('--directive-progress', Math.min(1, Math.max(0, progress)).toFixed(3));
            }
        }
    }

    hideDirectiveOverlay() {
        if (!this.overlayElements?.overlay) {
            return;
        }

        const { overlay } = this.overlayElements;
        overlay.classList.remove('is-visible');
        overlay.dataset.type = '';
        overlay.classList.remove(
            'directive-overlay--gesture',
            'directive-overlay--quickDraw',
            'directive-overlay--generic',
        );
        overlay.classList.add('directive-overlay--generic');
        overlay.dataset.pattern = '';
        overlay.dataset.difficulty = '';
        overlay.style.removeProperty('--directive-accent');
        overlay.style.removeProperty('--directive-accent-glow');
        overlay.style.removeProperty('--directive-secondary');
        overlay.style.removeProperty('--directive-tertiary');
        overlay.style.setProperty('--directive-progress', '1');
        overlay.style.removeProperty('--directive-intensity');

        this.cancelCountdown();
        this.activeDirective = null;
    }

    beginCountdown(duration, directive) {
        this.cancelCountdown();
        if (!duration || typeof requestAnimationFrame !== 'function') {
            return;
        }

        const start = this.timestamp();
        const tick = (now) => {
            const elapsed = now - start;
            const remaining = Math.max(0, duration - elapsed);
            const secondsDisplay = Math.ceil(remaining / 1000);

            if (this.overlayElements?.number) {
                this.overlayElements.number.textContent = secondsDisplay.toString();
            }

            if (this.overlayElements?.overlay) {
                const progress = remaining / duration;
                this.overlayElements.overlay.style.setProperty('--directive-progress', progress.toFixed(3));
            }

            if (remaining > 0 && this.activeDirective === directive) {
                this.countdownRaf = requestAnimationFrame(tick);
            }
        };

        this.countdownRaf = requestAnimationFrame(tick);
    }

    cancelCountdown() {
        if (typeof cancelAnimationFrame === 'function' && this.countdownRaf) {
            cancelAnimationFrame(this.countdownRaf);
        }
        this.countdownRaf = null;
    }

    timestamp() {
        return typeof performance !== 'undefined' ? performance.now() : Date.now();
    }

    buildGlowColor(hexColor) {
        if (typeof hexColor !== 'string' || !hexColor.startsWith('#')) {
            return 'rgba(255, 255, 255, 0.45)';
        }

        const raw = hexColor.slice(1);
        const isShort = raw.length === 3;
        const value = Number.parseInt(raw, 16);
        if (Number.isNaN(value)) {
            return 'rgba(255, 255, 255, 0.45)';
        }

        const r = isShort ? ((value >> 8) & 0xf) * 17 : (value >> 16) & 255;
        const g = isShort ? ((value >> 4) & 0xf) * 17 : (value >> 8) & 255;
        const b = isShort ? (value & 0xf) * 17 : value & 255;
        return `rgba(${r}, ${g}, ${b}, 0.45)`;
    }

    getActiveDirective() {
        return this.activeDirective;
    }

    formatPatternLabel(pattern) {
        if (!pattern) {
            return '';
        }
        if (pattern.displayName) {
            return pattern.displayName.toUpperCase();
        }
        if (pattern.type) {
            return pattern.type.replace(/[-_]/g, ' ').toUpperCase();
        }
        return '';
    }

    formatDifficultyLabel(directive) {
        if (!directive) {
            return '';
        }
        if (directive.difficultyLabel) {
            return directive.difficultyLabel.toUpperCase();
        }
        if (Number.isFinite(directive.difficulty)) {
            if (directive.difficulty >= 3) {
                return 'ZENITH';
            }
            if (directive.difficulty >= 2) {
                return 'SURGE';
            }
            if (directive.difficulty >= 1.2) {
                return 'PULSE';
            }
            return 'FLOW';
        }
        return '';
    }

    destroy() {
        this.cancelCountdown();
        if (this.overlayElements?.overlay?.parentNode) {
            this.overlayElements.overlay.parentNode.removeChild(this.overlayElements.overlay);
        }
        this.overlayElements = null;
        this.activeDirective = null;
    }
}
