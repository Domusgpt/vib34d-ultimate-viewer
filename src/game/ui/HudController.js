export class HudController {
    constructor(root) {
        this.root = root;
        this.elements = {
            score: root.querySelector('[data-hud="score"]'),
            combo: root.querySelector('[data-hud="combo"]'),
            mode: root.querySelector('[data-hud="mode"]'),
            geometry: root.querySelector('[data-hud="geometry"]'),
            level: root.querySelector('[data-hud="level"]'),
            bpm: root.querySelector('[data-hud="bpm"]'),
            fps: root.querySelector('[data-hud="fps"]'),
            pulse: root.querySelector('[data-hud="pulse"]'),
            shield: root.querySelector('[data-hud="shield"]'),
            toast: root.querySelector('[data-hud="toast"]')
        };
    }

    setScore(score) {
        if (this.elements.score) {
            this.elements.score.textContent = score.toLocaleString();
        }
    }

    setCombo(combo) {
        if (this.elements.combo) {
            this.elements.combo.textContent = combo > 1 ? `${combo}x` : '—';
        }
    }

    setMode(mode) {
        if (this.elements.mode) {
            this.elements.mode.textContent = mode.toUpperCase();
        }
    }

    setGeometry(name) {
        if (this.elements.geometry) {
            this.elements.geometry.textContent = name;
        }
    }

    setLevel(label) {
        if (this.elements.level) {
            this.elements.level.textContent = label;
        }
    }

    setBpm(bpm) {
        if (this.elements.bpm) {
            this.elements.bpm.textContent = `${Math.round(bpm)} BPM`;
        }
    }

    setFps(fps) {
        if (this.elements.fps) {
            this.elements.fps.textContent = `${Math.round(fps)} FPS`;
        }
    }

    setPulseMeter(value) {
        if (this.elements.pulse) {
            const scaled = Math.min(1, value / 0.2);
            this.elements.pulse.style.setProperty('--pulse-level', scaled);
        }
    }

    setShieldMeter(value) {
        if (this.elements.shield) {
            this.elements.shield.style.setProperty('--shield-level', Math.min(1, value));
        }
    }

    showToast(message, duration = 1200) {
        if (!this.elements.toast) return;
        this.elements.toast.textContent = message;
        this.elements.toast.classList.add('visible');
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            this.elements.toast.classList.remove('visible');
        }, duration);
    }
}
