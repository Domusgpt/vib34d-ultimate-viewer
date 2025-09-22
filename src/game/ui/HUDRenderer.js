function resolveRoot(rootElement) {
    if (rootElement) {
        return rootElement;
    }
    if (typeof document !== 'undefined') {
        return document.body;
    }
    return null;
}

function now() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
}

function formatCountdown(remainingMs) {
    if (remainingMs == null) {
        return '';
    }
    const seconds = Math.ceil(Math.max(remainingMs, 0) / 1000);
    return seconds > 0 ? String(seconds) : '0';
}

export class HUDRenderer {
    constructor(rootElement = null, options = {}) {
        this.rootElement = resolveRoot(rootElement);
        this.options = {
            overlayId: 'directive-overlay',
            ...options,
        };

        this.overlay = null;
        this.activeDirective = null;
        this.countdownEnd = null;
        this.countdownStartRemaining = null;
        this.countdownHandle = null;

        if (this.rootElement) {
            this.overlay = this.buildOverlay();
        }
    }

    buildOverlay() {
        if (typeof document === 'undefined') {
            return null;
        }

        const overlay = document.createElement('div');
        overlay.className = 'directive-overlay';
        overlay.id = this.options.overlayId;
        overlay.setAttribute('aria-live', 'assertive');

        const panel = document.createElement('div');
        panel.className = 'directive-overlay__panel';

        const label = document.createElement('div');
        label.className = 'directive-overlay__label';

        const prompt = document.createElement('div');
        prompt.className = 'directive-overlay__prompt';

        const annotation = document.createElement('div');
        annotation.className = 'directive-overlay__annotation';

        const countdown = document.createElement('div');
        countdown.className = 'directive-overlay__countdown';

        const countdownNumber = document.createElement('span');
        countdownNumber.className = 'directive-overlay__countdown-number';
        countdown.appendChild(countdownNumber);

        panel.appendChild(label);
        panel.appendChild(prompt);
        panel.appendChild(annotation);
        panel.appendChild(countdown);
        overlay.appendChild(panel);

        this.rootElement.appendChild(overlay);

        return {
            root: overlay,
            panel,
            label,
            prompt,
            annotation,
            countdown,
            countdownNumber,
        };
    }

    getActiveDirective() {
        return this.activeDirective;
    }

    showDirectiveOverlay(directive = {}) {
        if (!this.overlay?.root) {
            this.activeDirective = directive;
            return;
        }

        this.activeDirective = { ...directive };
        this.overlay.root.classList.add('is-visible');
        this.overlay.root.dataset.type = directive.type || '';

        this.overlay.label.textContent = (directive.label || 'Directive').toUpperCase();
        this.overlay.prompt.textContent = directive.prompt || directive.description || '';
        this.overlay.annotation.textContent = directive.annotation || directive.difficultyLabel || '';

        const accent = directive.color || directive.colorPalette?.primary;
        if (accent) {
            this.overlay.root.style.setProperty('--directive-accent', accent);
        } else {
            this.overlay.root.style.removeProperty('--directive-accent');
        }

        this.beginCountdown(directive);
    }

    updateDirectiveCountdown(directive = {}) {
        if (!this.overlay?.root || !this.activeDirective) {
            return;
        }

        this.activeDirective = { ...this.activeDirective, ...directive };
        this.beginCountdown(this.activeDirective, true);
    }

    hideDirectiveOverlay() {
        if (!this.overlay?.root) {
            this.activeDirective = null;
            return;
        }

        this.activeDirective = null;
        this.overlay.root.classList.remove('is-visible');
        this.overlay.root.style.removeProperty('--directive-accent');
        this.cancelCountdown();
        this.overlay.countdownNumber.textContent = '';
    }

    beginCountdown(directive, preserveStart = false) {
        this.cancelCountdown();

        const remaining = directive.remaining ?? (directive.countdownSeconds != null
            ? directive.countdownSeconds * 1000
            : null);

        if (remaining == null) {
            this.overlay.countdownNumber.textContent = '';
            this.countdownEnd = null;
            this.countdownStartRemaining = null;
            return;
        }

        const reference = preserveStart && this.countdownEnd
            ? this.countdownEnd - now()
            : remaining;

        this.countdownStartRemaining = reference;
        this.countdownEnd = now() + reference;
        this.overlay.countdownNumber.textContent = formatCountdown(reference);

        const tick = () => {
            const remainingMs = Math.max(0, this.countdownEnd - now());
            this.overlay.countdownNumber.textContent = formatCountdown(remainingMs);
            if (remainingMs > 0 && this.activeDirective) {
                this.countdownHandle = this.requestFrame(tick);
            }
        };

        this.countdownHandle = this.requestFrame(tick);
    }

    cancelCountdown() {
        if (this.countdownHandle != null) {
            if (typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(this.countdownHandle);
            } else {
                clearTimeout(this.countdownHandle);
            }
        }
        this.countdownHandle = null;
    }

    requestFrame(callback) {
        if (typeof requestAnimationFrame === 'function') {
            return requestAnimationFrame(callback);
        }
        return setTimeout(callback, 50);
    }
}
