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
                    <div class="hud-metric hud-level">
                        <span class="hud-label">LEVEL</span>
                        <span class="hud-value" id="hud-level-id">--</span>
                    </div>
                    <div class="hud-metric hud-depth">
                        <span class="hud-label">DEPTH</span>
                        <span class="hud-value" id="hud-depth">D1</span>
                    </div>
                    <div class="hud-metric hud-score">
                        <span class="hud-label">SCORE</span>
                        <span class="hud-value" id="hud-score">0</span>
                    </div>
                    <div class="hud-metric hud-combo">
                        <span class="hud-label">COMBO</span>
                        <span class="hud-value" id="hud-combo">0</span>
                    </div>
                    <div class="hud-metric hud-intensity">
                        <span class="hud-label">INTENSITY</span>
                        <span class="hud-value" id="hud-intensity">1.00×</span>
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
        this.depthEl = this.root.querySelector('#hud-depth');
        this.scoreEl = this.root.querySelector('#hud-score');
        this.comboEl = this.root.querySelector('#hud-combo');
        this.intensityEl = this.root.querySelector('#hud-intensity');
        this.healthFill = this.root.querySelector('#hud-health-fill');
        this.phaseFill = this.root.querySelector('#hud-phase-fill');
        this.statusEl = this.root.querySelector('#hud-status');
        this.bestEl = this.root.querySelector('#hud-best');
    }

    setLevel(level) {
        const labelId = level?.id ? level.id.toUpperCase() : '--';
        const geometryLabel = level?.geometryIndex != null ? `G${level.geometryIndex + 1}` : '';
        this.levelEl.textContent = geometryLabel ? `${labelId} • ${geometryLabel}` : labelId;
        this.depthEl.textContent = `D${level?.stage || 1}`;
        this.intensityEl.textContent = `${(level?.difficultyScale || 1).toFixed(2)}×`;
        const best = this.persistence.getBestScore('rogue-lite-run');
        if (best) {
            const bestDepth = best.depth ?? best.stage;
            const comboText = best.combo ? ` • COMBO ${best.combo}` : '';
            const depthText = bestDepth ? ` • DEPTH ${bestDepth}` : '';
            this.bestEl.textContent = `BEST ${best.score.toLocaleString()}${depthText}${comboText}`;
        } else {
            this.bestEl.textContent = '';
        }
    }

    update(state) {
        this.scoreEl.textContent = state.score.toLocaleString();
        this.comboEl.textContent = state.combo ? `x${state.combo}` : '0';
        this.depthEl.textContent = `D${state.stage || 1}`;
        if (typeof state.getDifficultyMultiplier === 'function') {
            this.intensityEl.textContent = `${state.getDifficultyMultiplier().toFixed(2)}×`;
        }
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
