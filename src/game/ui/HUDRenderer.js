const DEFAULT_LABELS = {
    gestureDirective: 'Gesture Directive',
    quickDraw: 'Quick Draw',
};

/**
 * HUDRenderer manages the directive overlay displayed during gesture or quick
 * draw events. It intentionally avoids framework dependencies so the HUD can be
 * exercised from unit tests by stubbing the DOM API.
 */
export class HUDRenderer {
    constructor(rootElement = null, options = {}) {
        this.rootElement = rootElement || (typeof document !== 'undefined' ? document.body : null);
        this.options = {
            overlayId: 'directive-overlay',
            ...options,
        };

        this.elements = null;
        this.activeDirective = null;

        if (this.rootElement && typeof document !== 'undefined') {
            this.elements = this.buildOverlay();
        }
    }

    buildOverlay() {
        if (typeof document === 'undefined') {
            return null;
        }

        const overlay = document.createElement('div');
        overlay.id = this.options.overlayId;
        overlay.className = 'directive-overlay';
        overlay.setAttribute('aria-live', 'polite');

        const panel = document.createElement('div');
        panel.className = 'directive-overlay__panel';
        overlay.appendChild(panel);

        const label = document.createElement('div');
        label.className = 'directive-overlay__label';
        panel.appendChild(label);

        const prompt = document.createElement('div');
        prompt.className = 'directive-overlay__prompt';
        panel.appendChild(prompt);

        const countdown = document.createElement('div');
        countdown.className = 'directive-overlay__countdown';
        const number = document.createElement('span');
        number.className = 'directive-overlay__countdown-value';
        countdown.appendChild(number);
        panel.appendChild(countdown);

        const meta = document.createElement('div');
        meta.className = 'directive-overlay__meta';
        panel.appendChild(meta);

        this.rootElement.appendChild(overlay);

        return {
            overlay,
            panel,
            label,
            prompt,
            countdown,
            number,
            meta,
        };
    }

    getActiveDirective() {
        return this.activeDirective;
    }

    showDirectiveOverlay(directive = {}) {
        if (!this.elements?.overlay) {
            this.activeDirective = directive;
            return;
        }

        const { overlay, label, prompt, number, meta } = this.elements;
        this.activeDirective = directive;

        overlay.classList.add('directive-overlay--visible');
        overlay.dataset.type = directive.type || 'directive';

        const labelText = directive.label || DEFAULT_LABELS[directive.type] || 'Directive';
        label.textContent = labelText.toUpperCase();
        prompt.textContent = directive.prompt || directive.description || '';

        if (meta) {
            const pieces = [];
            if (directive.difficultyLabel) {
                pieces.push(directive.difficultyLabel.toUpperCase());
            }
            if (directive.annotation) {
                pieces.push(directive.annotation);
            }
            meta.textContent = pieces.join(' • ');
            meta.classList.toggle('is-hidden', meta.textContent.length === 0);
        }

        this.applyColors(directive);
        this.updateDirectiveCountdown(directive);
    }

    updateDirectiveCountdown(directive = {}) {
        if (!this.elements?.number) {
            return;
        }

        const { number } = this.elements;
        let displaySeconds = directive.countdownSeconds;

        if (displaySeconds == null && directive.remaining != null) {
            displaySeconds = Math.ceil(directive.remaining / 1000);
        }

        if (displaySeconds != null && Number.isFinite(displaySeconds)) {
            number.textContent = String(Math.max(0, displaySeconds));
            number.classList.remove('is-hidden');
        } else {
            number.textContent = '';
            number.classList.add('is-hidden');
        }
    }

    hideDirectiveOverlay() {
        if (!this.elements?.overlay) {
            this.activeDirective = null;
            return;
        }

        const { overlay, number, meta } = this.elements;
        overlay.classList.remove('directive-overlay--visible');
        overlay.style.removeProperty('--directive-accent');
        overlay.style.removeProperty('--directive-accent-glow');
        if (number) {
            number.textContent = '';
        }
        if (meta) {
            meta.textContent = '';
        }
        this.activeDirective = null;
    }

    applyColors(directive = {}) {
        if (!this.elements?.overlay) {
            return;
        }

        const { overlay } = this.elements;
        const accent = directive.color
            || directive.colorPalette?.primary
            || 'var(--directive-default-accent, #7f9cff)';

        overlay.style.setProperty('--directive-accent', accent);
        overlay.style.setProperty('--directive-accent-glow', this.buildGlowColor(accent));
    }

    buildGlowColor(hexColor) {
        if (typeof hexColor !== 'string') {
            return 'rgba(127, 156, 255, 0.55)';
        }

        const normalized = hexColor.trim();
        if (normalized.startsWith('rgb')) {
            return normalized.replace('rgb', 'rgba').replace(')', ', 0.6)');
        }

        if (!normalized.startsWith('#') || (normalized.length !== 7 && normalized.length !== 4)) {
            return 'rgba(127, 156, 255, 0.55)';
        }

        const hex = normalized.length === 4
            ? `#${[1, 2, 3].map((i) => normalized[i]).map((c) => `${c}${c}`).join('')}`
            : normalized;

        const value = Number.parseInt(hex.slice(1), 16);
        const r = (value >> 16) & 0xff;
        const g = (value >> 8) & 0xff;
        const b = value & 0xff;
        return `rgba(${r}, ${g}, ${b}, 0.6)`;
    }
}

export default HUDRenderer;
