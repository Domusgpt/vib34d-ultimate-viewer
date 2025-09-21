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
                    <div class="hud-block hud-level">
                        <span class="hud-label">LEVEL</span>
                        <span class="hud-value" id="hud-level-id">--</span>
                    </div>
                    <div class="hud-block hud-stage">
                        <span class="hud-label">STAGE</span>
                        <span class="hud-value" id="hud-stage">--</span>
                        <span class="hud-subvalue" id="hud-stage-label"></span>
                    </div>
                    <div class="hud-block hud-score">
                        <span class="hud-label">SCORE</span>
                        <span class="hud-value" id="hud-score">0</span>
                    </div>
                    <div class="hud-block hud-combo">
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
                    <div class="hud-meta">
                        <div class="hud-block hud-flow">
                            <span class="hud-label">FLOW</span>
                            <span class="hud-value" id="hud-difficulty">--</span>
                        </div>
                        <div class="hud-special" id="hud-special">Double tap to charge Time Warp.</div>
                    </div>
                    <div class="hud-event" id="hud-event"></div>
                    <div class="hud-best" id="hud-best"></div>
                </div>
            </div>
        `;
        this.levelEl = this.root.querySelector('#hud-level-id');
        this.stageEl = this.root.querySelector('#hud-stage');
        this.stageLabelEl = this.root.querySelector('#hud-stage-label');
        this.scoreEl = this.root.querySelector('#hud-score');
        this.comboEl = this.root.querySelector('#hud-combo');
        this.healthFill = this.root.querySelector('#hud-health-fill');
        this.phaseFill = this.root.querySelector('#hud-phase-fill');
        this.statusEl = this.root.querySelector('#hud-status');
        this.bestEl = this.root.querySelector('#hud-best');
        this.difficultyEl = this.root.querySelector('#hud-difficulty');
        this.specialEl = this.root.querySelector('#hud-special');
        this.eventEl = this.root.querySelector('#hud-event');
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

    update(state, context = {}) {
        this.scoreEl.textContent = state.score.toLocaleString();
        this.comboEl.textContent = state.combo ? `x${state.combo}` : '0';
        this.healthFill.style.transform = `scaleX(${Math.max(0, state.health)})`;
        this.phaseFill.style.transform = `scaleX(${Math.max(0, state.phaseEnergy)})`;

        if (context.stage != null) {
            this.stageEl.textContent = `#${(context.stage + 1).toString()}`;
        }
        if (context.stageLabel) {
            this.stageLabelEl.textContent = context.stageLabel.toUpperCase();
        }
        if (context.difficultyValue != null) {
            const value = context.difficultyValue.toFixed(2);
            const label = context.difficultyLabel || 'FLOW';
            this.difficultyEl.textContent = `${label} • ${value}x`;
        }
        if (context.specialReady != null) {
            this.specialEl.classList.toggle('ready', context.specialReady);
            this.specialEl.textContent = context.specialReady
                ? 'Double tap: Time Warp READY'
                : 'Double tap twice to trigger Time Warp';
        }
        if (context.eventPrompt) {
            let prompt = context.eventPrompt;
            if (context.eventGoal && context.eventProgress != null) {
                prompt = `${prompt} ${formatEventProgress(context.eventProgress, context.eventGoal)}`;
            }
            this.eventEl.textContent = prompt;
            this.eventEl.classList.add('visible');
        } else {
            this.eventEl.textContent = '';
            this.eventEl.classList.remove('visible');
        }
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

function formatEventProgress(progress, goal) {
    if (Number.isInteger(progress) && Number.isInteger(goal)) {
        return `${progress}/${goal}`;
    }
    return `${progress.toFixed(1)}/${goal.toFixed(1)}s`;
}
