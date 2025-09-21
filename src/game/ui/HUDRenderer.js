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
                    <div class="hud-stage">
                        <span class="hud-label">STAGE</span>
                        <span class="hud-value" id="hud-stage">1</span>
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
                    <div class="hud-charges" id="hud-charges"></div>
                </div>
                <div class="hud-bottom">
                    <div class="hud-status" id="hud-status">Tap the beat to pulse.</div>
                    <div class="hud-modifiers" id="hud-modifiers"></div>
                    <div class="hud-best" id="hud-best"></div>
                </div>
            </div>
            <div class="hud-overlay-callout" id="hud-callout-overlay"></div>
            <div class="hud-directive" id="hud-directive" data-state="idle">
                <div class="hud-directive-text">
                    <span class="hud-directive-label" id="hud-directive-label"></span>
                    <span class="hud-directive-count" id="hud-directive-count"></span>
                </div>
                <div class="hud-directive-timer">
                    <div class="hud-directive-timer-fill" id="hud-directive-timer"></div>
                </div>
            </div>
        `;
        this.levelEl = this.root.querySelector('#hud-level-id');
        this.stageEl = this.root.querySelector('#hud-stage');
        this.scoreEl = this.root.querySelector('#hud-score');
        this.comboEl = this.root.querySelector('#hud-combo');
        this.healthFill = this.root.querySelector('#hud-health-fill');
        this.phaseFill = this.root.querySelector('#hud-phase-fill');
        this.statusEl = this.root.querySelector('#hud-status');
        this.bestEl = this.root.querySelector('#hud-best');
        this.chargesEl = this.root.querySelector('#hud-charges');
        this.modifiersEl = this.root.querySelector('#hud-modifiers');
        this.calloutEl = this.root.querySelector('#hud-callout-overlay');
        this.directiveEl = this.root.querySelector('#hud-directive');
        this.directiveLabelEl = this.root.querySelector('#hud-directive-label');
        this.directiveCountEl = this.root.querySelector('#hud-directive-count');
        this.directiveTimerEl = this.root.querySelector('#hud-directive-timer');
        this.currentDirective = null;
    }

    setLevel(level, meta = {}) {
        this.levelEl.textContent = level?.id?.toUpperCase() || '--';
        const best = this.persistence.getBestScore(level.id);
        const runRecord = this.persistence.getRunRecord(level.baseId || level.id);
        if (best) {
            this.bestEl.textContent = `BEST ${best.score} • MAX COMBO ${best.combo}`;
        }
        if (runRecord) {
            this.bestEl.textContent = `RUN ${runRecord.stage} • ${runRecord.score} pts • x${runRecord.combo}`;
        }
        if (!best && !runRecord) {
            this.bestEl.textContent = '';
        }
        if (meta.stage) {
            this.stageEl.textContent = meta.stage;
        }
        if (meta.modifiers?.length) {
            this.modifiersEl.textContent = meta.modifiers.map((mod) => mod.label || mod.id).join(' • ');
        } else {
            this.modifiersEl.textContent = '';
        }
    }

    update(state, meta = {}) {
        this.scoreEl.textContent = state.score.toLocaleString();
        this.comboEl.textContent = state.combo ? `x${state.combo}` : '0';
        this.healthFill.style.transform = `scaleX(${Math.max(0, state.health)})`;
        this.phaseFill.style.transform = `scaleX(${Math.max(0, state.phaseEnergy)})`;
        if (meta.stage) {
            this.stageEl.textContent = meta.stage;
        } else if (state.stage) {
            this.stageEl.textContent = state.stage;
        }
        const charges = meta.charges || state.getChargeState?.() || { current: 0, max: 0 };
        if (this.chargesEl) {
            const filled = '●'.repeat(Math.max(0, charges.current || 0));
            const empty = '○'.repeat(Math.max(0, (charges.max || 0) - (charges.current || 0)));
            this.chargesEl.textContent = charges.max ? `SLOW • ${filled}${empty}` : '';
        }
        if (meta.modifiers) {
            this.modifiersEl.textContent = meta.modifiers.length ? meta.modifiers.map((mod) => mod.label || mod.id).join(' • ') : '';
        }
        this.setDirectiveState(meta.directive);
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

    showCallout(text, variant = 'info', duration = 1.6) {
        if (!this.calloutEl) return;
        this.calloutEl.textContent = text;
        this.calloutEl.dataset.variant = variant;
        this.calloutEl.classList.add('show');
        if (this.calloutTimeout) {
            clearTimeout(this.calloutTimeout);
        }
        this.calloutTimeout = setTimeout(() => {
            this.calloutEl.classList.remove('show');
        }, duration * 1000);
    }

    showRunSummary(summary, improved) {
        if (!summary) return;
        const text = `STAGE ${summary.stage} • ${summary.score.toLocaleString()} pts • x${summary.maxCombo}`;
        this.bestEl.textContent = improved ? `NEW BEST • ${text}` : `LAST RUN • ${text}`;
    }

    announceDirective(directive) {
        if (!directive) return;
        this.setDirectiveState(directive);
        this.flash(directive.label || 'Directive!');
    }

    finishDirective(status, event) {
        if (status === 'success') {
            this.flash(event?.label ? `${event.label} Clear!` : 'Directive Clear!');
        } else {
            this.setStatus(event?.label ? `${event.label} Failed` : 'Directive Failed', 'alert');
        }
        this.setDirectiveState(null);
    }

    setDirectiveState(state) {
        if (!this.directiveEl) return;
        if (!state) {
            this.directiveEl.dataset.state = 'idle';
            this.directiveEl.dataset.variant = '';
            if (this.directiveLabelEl) this.directiveLabelEl.textContent = '';
            if (this.directiveCountEl) this.directiveCountEl.textContent = '';
            if (this.directiveTimerEl) this.directiveTimerEl.style.transform = 'scaleX(0)';
            this.currentDirective = null;
            return;
        }
        this.currentDirective = state;
        this.directiveEl.dataset.state = 'active';
        this.directiveEl.dataset.variant = state.variant || 'info';
        if (this.directiveLabelEl) {
            this.directiveLabelEl.textContent = state.label || state.id || 'Directive';
        }
        if (this.directiveCountEl) {
            if (state.requirement === 'phase-hold') {
                const remaining = Math.max(0, (state.goal || 0) - (state.progress || 0));
                this.directiveCountEl.textContent = `${remaining.toFixed(1)}s`;
            } else if (state.requirement === 'no-pulse') {
                this.directiveCountEl.textContent = 'HOLD';
            } else if (typeof state.goal === 'number') {
                this.directiveCountEl.textContent = `${Math.floor(state.progress || 0)}/${state.goal}`;
            } else {
                this.directiveCountEl.textContent = '';
            }
        }
        if (this.directiveTimerEl) {
            const duration = state.duration || 1;
            const remaining = Math.max(0, state.remaining ?? duration);
            const ratio = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
            this.directiveTimerEl.style.transform = `scaleX(${ratio})`;
        }
    }
}
