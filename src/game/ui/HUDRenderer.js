const CLASS_VISIBLE = 'is-visible';
const CLASS_HIDDEN = 'is-hidden';

const createElement = (tag, className, text = '') => {
    if (typeof document === 'undefined') {
        return null;
    }
    const el = document.createElement(tag);
    if (className) {
        el.className = className;
    }
    if (text) {
        el.textContent = text;
    }
    return el;
};

const resolveRoot = (root) => {
    if (root) {
        return root;
    }
    if (typeof document === 'undefined') {
        return null;
    }
    return document.getElementById('hud-root')
        || document.querySelector('.hud-root')
        || document.body;
};

const formatCountdown = (directive) => {
    if (!directive) {
        return '';
    }
    if (directive.countdownSeconds != null) {
        return String(Math.max(0, Math.ceil(directive.countdownSeconds)));
    }
    if (directive.remainingMs != null) {
        return String(Math.max(0, Math.ceil(directive.remainingMs / 1000)));
    }
    return '';
};

export class HUDRenderer {
    constructor(root = null, options = {}) {
        this.root = resolveRoot(root);
        this.options = options;

        this.overlay = null;
        this.activeDirective = null;
        this.currentOverlayClass = null;
        this.lastCountdownId = null;

        if (this.root) {
            this.ensureOverlay();
        }
    }

    ensureOverlay() {
        if (this.overlay || !this.root) {
            return;
        }

        const overlay = createElement('div', 'directive-overlay');
        if (!overlay) {
            return;
        }

        const panel = createElement('div', 'directive-overlay__panel');
        const label = createElement('div', 'directive-overlay__label');
        const prompt = createElement('div', 'directive-overlay__prompt');
        const annotation = createElement('div', 'directive-overlay__annotation', 'Directive Active');

        const badges = createElement('div', 'directive-overlay__badges');
        const difficultyBadge = createElement('div', 'directive-overlay__badge');
        difficultyBadge.classList.add(CLASS_HIDDEN);
        badges.appendChild(difficultyBadge);

        const countdown = createElement('div', 'directive-overlay__countdown');
        const countdownRing = createElement('div', 'directive-overlay__countdown-ring');
        const countdownNumber = createElement('div', 'directive-overlay__countdown-number');
        const countdownHint = createElement('div', 'directive-overlay__countdown-hint', 'seconds');

        countdown.appendChild(countdownRing);
        countdown.appendChild(countdownNumber);
        countdown.appendChild(countdownHint);

        panel.appendChild(label);
        panel.appendChild(prompt);
        panel.appendChild(annotation);
        panel.appendChild(badges);
        panel.appendChild(countdown);
        overlay.appendChild(panel);

        this.root.appendChild(overlay);

        this.overlay = overlay;
        this.label = label;
        this.prompt = prompt;
        this.annotation = annotation;
        this.badges = badges;
        this.difficultyBadge = difficultyBadge;
        this.countdown = countdown;
        this.countdownRing = countdownRing;
        this.countdownNumber = countdownNumber;
    }

    getActiveDirective() {
        return this.activeDirective;
    }

    showDirectiveOverlay(directive) {
        if (!directive) {
            return;
        }
        this.ensureOverlay();
        if (!this.overlay) {
            this.activeDirective = directive;
            return;
        }

        this.activeDirective = directive;
        this.overlay.classList.add(CLASS_VISIBLE);
        this.overlay.dataset.type = directive.type || 'generic';
        if (directive.pattern?.id) {
            this.overlay.dataset.pattern = directive.pattern.id;
        } else {
            delete this.overlay.dataset.pattern;
        }
        if (directive.difficulty) {
            this.overlay.dataset.difficulty = String(directive.difficulty).toLowerCase();
        } else {
            delete this.overlay.dataset.difficulty;
        }

        const overlayClass = `directive-overlay--${directive.type || 'generic'}`;
        if (this.currentOverlayClass && this.currentOverlayClass !== overlayClass) {
            this.overlay.classList.remove(this.currentOverlayClass);
        }
        this.overlay.classList.add(overlayClass);
        this.currentOverlayClass = overlayClass;

        if (this.label) {
            this.label.textContent = directive.label || '';
        }

        if (this.prompt) {
            this.prompt.textContent = directive.prompt || directive.description || '';
        }

        if (this.annotation) {
            this.annotation.textContent = directive.metadata?.annotation || 'Directive Active';
        }

        if (this.difficultyBadge) {
            if (directive.difficulty) {
                this.difficultyBadge.textContent = String(directive.difficulty).toUpperCase();
                this.difficultyBadge.classList.remove(CLASS_HIDDEN);
            } else if (directive.metadata?.difficultyLabel) {
                this.difficultyBadge.textContent = directive.metadata.difficultyLabel;
                this.difficultyBadge.classList.remove(CLASS_HIDDEN);
            } else {
                this.difficultyBadge.classList.add(CLASS_HIDDEN);
            }
        }

        if (this.badges) {
            if (this.difficultyBadge && this.difficultyBadge.classList.contains(CLASS_HIDDEN)) {
                this.badges.classList.add(CLASS_HIDDEN);
            } else {
                this.badges.classList.remove(CLASS_HIDDEN);
            }
        }

        this.lastCountdownId = directive.id || null;
        this.updateDirectiveCountdown(directive);
    }

    updateDirectiveCountdown(directive = null) {
        if (!this.overlay || !this.countdownNumber) {
            return;
        }

        const target = directive || this.activeDirective;
        if (!target) {
            return;
        }

        const countdownValue = formatCountdown(target);
        this.countdownNumber.textContent = countdownValue;

        const duration = target.duration ?? target.remainingMs ?? 0;
        const remaining = target.remainingMs ?? (target.countdownSeconds != null ? target.countdownSeconds * 1000 : duration);

        if (this.countdownRing) {
            if (duration > 0 && remaining != null) {
                const progress = Math.max(0, Math.min(1, remaining / duration));
                const shouldRestart = target.id && this.lastCountdownId !== target.id;

                this.countdownRing.style.setProperty('--directive-progress', String(progress));
                this.countdownRing.style.setProperty('--directive-duration', `${duration}ms`);

                if (shouldRestart) {
                    this.countdownRing.classList.remove('is-animating');
                    void this.countdownRing.offsetWidth;
                    this.lastCountdownId = target.id;
                }

                this.countdownRing.classList.add('is-animating');
            } else {
                this.countdownRing.style.removeProperty('--directive-progress');
                this.countdownRing.classList.remove('is-animating');
            }
        }
    }

    hideDirectiveOverlay() {
        if (!this.overlay) {
            this.activeDirective = null;
            return;
        }
        this.overlay.classList.remove(CLASS_VISIBLE);
        this.overlay.dataset.type = '';
        delete this.overlay.dataset.pattern;
        delete this.overlay.dataset.difficulty;
        this.activeDirective = null;
        if (this.currentOverlayClass) {
            this.overlay.classList.remove(this.currentOverlayClass);
            this.currentOverlayClass = null;
        }
        this.lastCountdownId = null;
    }
}

export default HUDRenderer;
