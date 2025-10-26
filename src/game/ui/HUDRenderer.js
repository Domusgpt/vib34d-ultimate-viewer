/**
 * Renders the mobile-friendly HUD overlay.
 */
export class HUDRenderer {
    constructor(root, persistence) {
        this.root = root;
        this.persistence = persistence;
        this.build();
    }

    build() {
        this.root.innerHTML = `
            <div class="hud-safe-area">
                <div class="hud-top">
                    <div class="hud-level">
                        <span class="hud-label">LEVEL</span>
                        <span class="hud-value" id="hud-level-id">--</span>
                    </div>
                    <div class="hud-score">
                        <span class="hud-label">SCORE</span>
                        <span class="hud-value" id="hud-score">0</span>
                    </div>
                    <div class="hud-combo">
                        <span class="hud-label">COMBO</span>
                        <span class="hud-value" id="hud-combo">0</span>
                    </div>
                </div>
                <div class="hud-bars">
                    <div class="hud-bar hud-health">
                        <div class="hud-bar-fill" id="hud-health-fill"></div>
                    </div>
                    <div class="hud-bar hud-phase">
                        <div class="hud-bar-fill" id="hud-phase-fill"></div>
                    </div>
                </div>
                <div class="hud-bottom">
                    <div class="hud-status" id="hud-status">Tap the beat to pulse.</div>
                    <div class="hud-best" id="hud-best"></div>
                </div>
            </div>
        `;
        this.levelEl = this.root.querySelector('#hud-level-id');
        this.scoreEl = this.root.querySelector('#hud-score');
        this.comboEl = this.root.querySelector('#hud-combo');
        this.healthFill = this.root.querySelector('#hud-health-fill');
        this.phaseFill = this.root.querySelector('#hud-phase-fill');
        this.statusEl = this.root.querySelector('#hud-status');
        this.bestEl = this.root.querySelector('#hud-best');
    }

    setLevel(level) {
        this.levelEl.textContent = level?.id?.toUpperCase() || '--';
        const best = this.persistence.getBestScore(level.id);
        if (best) {
            this.bestEl.textContent = `BEST ${best.score} • MAX COMBO ${best.combo}`;
        } else {
            this.bestEl.textContent = '';
        }
    }

    update(state) {
        this.scoreEl.textContent = state.score.toLocaleString();
        this.comboEl.textContent = state.combo ? `x${state.combo}` : '0';
        this.healthFill.style.transform = `scaleX(${Math.max(0, state.health)})`;
        this.phaseFill.style.transform = `scaleX(${Math.max(0, state.phaseEnergy)})`;
    }

    setStatus(text, variant = 'info') {
        this.statusEl.textContent = text;
        this.statusEl.dataset.variant = variant;
    }

    flash(text) {
        this.setStatus(text, 'pulse');
        this.statusEl.classList.add('flash');
        setTimeout(() => this.statusEl.classList.remove('flash'), 600);
    }
}
