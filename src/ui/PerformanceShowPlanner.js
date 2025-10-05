import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';
import {
    mergeThemePalettes,
    normalizeThemeState,
    normalizeThemeTransition,
    resolveThemeDetails,
    areThemesEqual,
    DEFAULT_THEME_TRANSITION,
    THEME_EASING_PRESETS
} from './PerformanceThemeUtils.js';

function createId(prefix = 'cue') {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function parseNumber(value, fallback = 0) {
    const number = parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
}

function formatTimecode(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return '0:00';
    }
    const totalSeconds = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remaining = totalSeconds - minutes * 60;
    const padded = remaining < 10 ? `0${remaining}` : `${remaining}`;
    return `${minutes}:${padded}`;
}

function formatRuntimeLabel(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return 'Manual';
    }
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.round(seconds - minutes * 60);
    if (minutes <= 0) {
        return `${remaining}s`;
    }
    const secondsPart = remaining > 0 ? `${remaining}s` : '';
    return `${minutes}m${secondsPart ? ` ${secondsPart}` : ''}`;
}

function formatBarsLabel(beats, beatsPerBar) {
    if (!Number.isFinite(beats) || beats <= 0 || !Number.isFinite(beatsPerBar) || beatsPerBar <= 0) {
        return null;
    }
    const bars = beats / beatsPerBar;
    if (!Number.isFinite(bars) || bars <= 0) {
        return null;
    }
    const precision = bars < 3 ? 2 : 1;
    const value = Number.isInteger(bars) ? bars : parseFloat(bars.toFixed(precision));
    return `${value} bar${value === 1 ? '' : 's'}`;
}

export class PerformanceShowPlanner {
    constructor({
        container = null,
        hub = null,
        presetManager = null,
        config = DEFAULT_PERFORMANCE_CONFIG.showPlanner,
        themeOptions = {},
        themeContext = {},
        applyThemeState = null
    } = {}) {
        this.container = container || this.ensureContainer();
        this.hub = hub;
        this.presetManager = presetManager;
        this.config = { ...DEFAULT_PERFORMANCE_CONFIG.showPlanner, ...(config || {}) };

        const tapTempoDefaults = this.config.tapTempo || {};
        this.tapTempoConfig = {
            resetMs: typeof tapTempoDefaults.resetMs === 'number' ? tapTempoDefaults.resetMs : 2400,
            historyLimit: typeof tapTempoDefaults.historyLimit === 'number' ? tapTempoDefaults.historyLimit : 8,
            minBpm: typeof tapTempoDefaults.minBpm === 'number' ? tapTempoDefaults.minBpm : 40,
            maxBpm: typeof tapTempoDefaults.maxBpm === 'number' ? tapTempoDefaults.maxBpm : 240,
            fineStep: typeof tapTempoDefaults.fineStep === 'number' ? tapTempoDefaults.fineStep : 1,
            coarseStep: typeof tapTempoDefaults.coarseStep === 'number' ? tapTempoDefaults.coarseStep : 5,
            indicatorHoldMs: typeof tapTempoDefaults.indicatorHoldMs === 'number' ? tapTempoDefaults.indicatorHoldMs : 2200
        };

        this.tapTempoHistory = [];
        this.tapTempoResetTimeout = null;
        this.tempoIndicatorTimeout = null;
        this.tapTempoPulseTimeout = null;
        this.tempoIndicatorDefault = 'Tap tempo to sync';

        this.themeOptions = themeOptions || {};
        this.themeContext = themeContext || {};
        this.themePalettes = mergeThemePalettes(this.themeOptions?.palettes || []);
        this.transitionDefaults = normalizeThemeTransition(
            this.themeOptions?.transitionDefaults,
            DEFAULT_THEME_TRANSITION
        );
        this.easingOptions = Array.isArray(this.themeOptions?.easingPresets) && this.themeOptions.easingPresets.length
            ? this.themeOptions.easingPresets.map(option => ({
                id: option.id || option.value || option.label,
                label: option.label || option.id || option.value,
                value: option.value || option.id
            }))
            : THEME_EASING_PRESETS;
        this.activeTheme = normalizeThemeState(this.themeContext?.themeState || null, {
            transitionDefaults: this.transitionDefaults
        });
        this.activeThemeDetails = resolveThemeDetails(this.activeTheme, {
            palettes: this.themePalettes,
            baseTheme: this.themeContext?.baseTheme,
            transitionDefaults: this.transitionDefaults
        });
        this.activeThemeAccent = this.activeThemeDetails.accent;

        this.applyThemeState = typeof applyThemeState === 'function' ? applyThemeState : null;

        this.storageKey = this.config.storageKey || 'vib34d-show-planner';
        this.defaults = {
            tempo: 120,
            beatsPerBar: 4,
            autoAdvance: false,
            loop: false,
            ...(this.config.defaults || {})
        };

        this.state = this.loadState();
        this.isRunning = false;
        this.activeIndex = -1;
        this.nextCueTimeout = null;
        this.subscriptions = [];

        this.render();
        this.populateThemeSelect();
        this.updateTempoInputs();
        this.renderCueList();
        this.syncPresetOptions();
        this.registerHubListeners();
        this.updateRunControls();
        this.updateStatus();
    }

    ensureContainer() {
        const existing = document.getElementById('performance-show-planner');
        if (existing) {
            existing.innerHTML = '';
            return existing;
        }
        const section = document.createElement('section');
        section.id = 'performance-show-planner';
        return section;
    }

    loadState() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return clone(this.defaultsWithCues());
        }
        try {
            const raw = window.localStorage.getItem(this.storageKey);
            if (!raw) return clone(this.defaultsWithCues());
            const parsed = JSON.parse(raw);
            return {
                tempo: parsed?.tempo ?? this.defaults.tempo,
                beatsPerBar: parsed?.beatsPerBar ?? this.defaults.beatsPerBar,
                autoAdvance: parsed?.autoAdvance ?? this.defaults.autoAdvance,
                loop: parsed?.loop ?? this.defaults.loop,
                cues: Array.isArray(parsed?.cues) ? this.normalizeCues(parsed.cues) : []
            };
        } catch (error) {
            console.warn('ShowPlanner failed to load state', error);
            return clone(this.defaultsWithCues());
        }
    }

    defaultsWithCues() {
        return {
            tempo: this.defaults.tempo,
            beatsPerBar: this.defaults.beatsPerBar,
            autoAdvance: this.defaults.autoAdvance,
            loop: this.defaults.loop,
            cues: []
        };
    }

    persistState() {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            window.localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('ShowPlanner failed to persist state', error);
        }
    }

    render() {
        if (!this.container) return;

        this.container.classList.add('performance-block', 'show-planner');
        this.container.innerHTML = `
            <header class="performance-block__header">
                <div>
                    <h3 class="performance-block__title">Show Planner</h3>
                    <p class="performance-block__subtitle">Sequence presets, notes, and cue timings for live sets.</p>
                </div>
                <div class="show-planner__status" data-role="planner-status">Idle</div>
            </header>
            <div class="show-planner__run">
                <div class="show-planner__controls">
                    <button type="button" data-action="start">Start</button>
                    <button type="button" data-action="stop" disabled>Stop</button>
                    <button type="button" data-action="prev" disabled>Prev</button>
                    <button type="button" data-action="next" disabled>Next</button>
                </div>
                <div class="show-planner__tempo">
                    <label>
                        <span>Tempo (BPM)</span>
                        <input type="number" name="tempo" min="40" max="240" step="1" />
                    </label>
                    <label>
                        <span>Beats / bar</span>
                        <input type="number" name="beats" min="1" max="16" step="1" />
                    </label>
                    <label class="show-planner__toggle">
                        <input type="checkbox" name="autoAdvance" />
                        <span>Auto advance cues</span>
                    </label>
                    <label class="show-planner__toggle">
                        <input type="checkbox" name="loop" />
                        <span>Loop show</span>
                    </label>
                    <div class="show-planner__tempo-tools">
                        <div class="show-planner__tempo-nudges" data-role="tempo-nudges">
                            <button type="button" data-action="tempo-down" data-step="fine">-1</button>
                            <button type="button" data-action="tempo-up" data-step="fine">+1</button>
                        </div>
                        <div class="show-planner__tempo-nudges show-planner__tempo-nudges--coarse" data-role="tempo-nudges-coarse">
                            <button type="button" data-action="tempo-down-coarse" data-step="coarse">-5</button>
                            <button type="button" data-action="tempo-up-coarse" data-step="coarse">+5</button>
                        </div>
                        <button type="button" class="show-planner__tempo-tap" data-action="tempo-tap">Tap Tempo</button>
                        <span class="show-planner__tempo-indicator" data-role="tempo-indicator">${this.tempoIndicatorDefault}</span>
                    </div>
                </div>
            </div>
            <form class="show-planner__form">
                <label>
                    <span>Cue label</span>
                    <input type="text" name="label" placeholder="Verse build" />
                </label>
                <label>
                    <span>Preset</span>
                    <select name="presetId"></select>
                </label>
                <label>
                    <span>Theme</span>
                    <select name="themeMode" data-role="theme-mode"></select>
                </label>
                <div class="show-planner__theme-controls" data-role="theme-controls">
                    <label>
                        <span>Transition (ms)</span>
                        <input type="number" name="themeTransitionDuration" min="0" max="8000" step="50" />
                    </label>
                    <label>
                        <span>Transition Curve</span>
                        <select name="themeTransitionEasing"></select>
                    </label>
                </div>
                <label>
                    <span>Duration (beats)</span>
                    <input type="number" name="duration" min="0" step="1" placeholder="8" />
                </label>
                <label class="show-planner__toggle">
                    <input type="checkbox" name="cueAutoAdvance" />
                    <span>Auto advance after cue</span>
                </label>
                <label class="show-planner__notes">
                    <span>Notes</span>
                    <textarea name="notes" rows="2" placeholder="Lighting callouts or band cues"></textarea>
                </label>
                <button type="submit">Add cue</button>
            </form>
            <section class="show-planner__timeline" data-role="timeline">
                <header class="show-planner__timeline-header">
                    <h4>Timeline Overview</h4>
                    <div class="show-planner__timeline-summary">
                        <span data-role="timeline-total-beats">0 beats</span>
                        <span data-role="timeline-total-runtime">Manual</span>
                    </div>
                </header>
                <ol class="show-planner__timeline-cues" data-role="timeline-list"></ol>
            </section>
            <ol class="show-planner__cues" data-role="cue-list"></ol>
        `;

        this.statusEl = this.container.querySelector('[data-role="planner-status"]');
        this.startBtn = this.container.querySelector('[data-action="start"]');
        this.stopBtn = this.container.querySelector('[data-action="stop"]');
        this.prevBtn = this.container.querySelector('[data-action="prev"]');
        this.nextBtn = this.container.querySelector('[data-action="next"]');
        this.tempoInput = this.container.querySelector('input[name="tempo"]');
        this.beatsInput = this.container.querySelector('input[name="beats"]');
        this.autoAdvanceToggle = this.container.querySelector('input[name="autoAdvance"]');
        this.loopToggle = this.container.querySelector('input[name="loop"]');
        this.form = this.container.querySelector('.show-planner__form');
        this.presetSelect = this.form.querySelector('select[name="presetId"]');
        this.themeSelect = this.form.querySelector('select[name="themeMode"]');
        this.themeControls = this.form.querySelector('[data-role="theme-controls"]');
        this.transitionDurationInput = this.form.querySelector('input[name="themeTransitionDuration"]');
        this.transitionEasingSelect = this.form.querySelector('select[name="themeTransitionEasing"]');
        this.cueListEl = this.container.querySelector('[data-role="cue-list"]');
        this.timelineEl = this.container.querySelector('[data-role="timeline"]');
        this.timelineListEl = this.container.querySelector('[data-role="timeline-list"]');
        this.timelineTotalBeatsEl = this.container.querySelector('[data-role="timeline-total-beats"]');
        this.timelineRuntimeEl = this.container.querySelector('[data-role="timeline-total-runtime"]');
        this.tapTempoButton = this.container.querySelector('[data-action="tempo-tap"]');
        this.tempoDownBtn = this.container.querySelector('[data-action="tempo-down"]');
        this.tempoUpBtn = this.container.querySelector('[data-action="tempo-up"]');
        this.tempoDownCoarseBtn = this.container.querySelector('[data-action="tempo-down-coarse"]');
        this.tempoUpCoarseBtn = this.container.querySelector('[data-action="tempo-up-coarse"]');
        this.tempoIndicatorEl = this.container.querySelector('[data-role="tempo-indicator"]');
        this.tempoNudgesEl = this.container.querySelector('[data-role="tempo-nudges"]');
        this.tempoNudgesCoarseEl = this.container.querySelector('[data-role="tempo-nudges-coarse"]');

        this.startBtn.addEventListener('click', () => this.startRun());
        this.stopBtn.addEventListener('click', () => this.stopRun());
        this.prevBtn.addEventListener('click', () => this.previousCue());
        this.nextBtn.addEventListener('click', () => this.nextCue());
        this.tempoInput.addEventListener('change', () => this.updateTempo());
        this.beatsInput.addEventListener('change', () => this.updateBeatsPerBar());
        this.autoAdvanceToggle.addEventListener('change', () => this.toggleAutoAdvance());
        this.loopToggle.addEventListener('change', () => this.toggleLoop());
        if (this.tapTempoButton) {
            this.tapTempoButton.addEventListener('click', () => this.tapTempo());
        }
        if (this.tempoDownBtn) {
            this.tempoDownBtn.addEventListener('click', () => this.nudgeTempo(-this.tapTempoConfig.fineStep));
        }
        if (this.tempoUpBtn) {
            this.tempoUpBtn.addEventListener('click', () => this.nudgeTempo(this.tapTempoConfig.fineStep));
        }
        if (this.tempoDownCoarseBtn) {
            this.tempoDownCoarseBtn.addEventListener('click', () => this.nudgeTempo(-this.tapTempoConfig.coarseStep));
        }
        if (this.tempoUpCoarseBtn) {
            this.tempoUpCoarseBtn.addEventListener('click', () => this.nudgeTempo(this.tapTempoConfig.coarseStep));
        }
        if (this.presetSelect) {
            this.presetSelect.addEventListener('change', () => this.updateThemeSelectAvailability());
        }
        if (this.themeSelect) {
            this.themeSelect.addEventListener('change', () => {
                this.themeSelect.dataset.userSelected = 'true';
                this.updateThemeControlAvailability();
            });
        }
        if (this.transitionDurationInput) {
            this.transitionDurationInput.addEventListener('input', () => {
                this.markThemeControlsTouched();
            });
        }
        if (this.transitionEasingSelect) {
            this.transitionEasingSelect.addEventListener('change', () => {
                this.markThemeControlsTouched();
            });
        }
        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.addCue(new FormData(this.form));
        });

        this.updateTempoNudgeLabels();
        this.resetTempoIndicator();
    }

    registerHubListeners() {
        if (!this.hub || typeof this.hub.on !== 'function') return;
        this.subscriptions.push(this.hub.on('preset:list-changed', () => this.syncPresetOptions()));
        this.subscriptions.push(this.hub.on('preset:saved', () => this.syncPresetOptions()));
        this.subscriptions.push(this.hub.on('preset:loaded', () => this.updateStatus()));
    }

    updateActiveThemeDetails() {
        this.activeThemeDetails = resolveThemeDetails(this.activeTheme, {
            palettes: this.themePalettes,
            baseTheme: this.themeContext?.baseTheme,
            transitionDefaults: this.transitionDefaults
        });
        this.activeThemeAccent = this.activeThemeDetails.accent;
    }

    setActiveThemeState(themeState) {
        const normalized = normalizeThemeState(themeState, { transitionDefaults: this.transitionDefaults });
        if (areThemesEqual(this.activeTheme, normalized)) {
            return;
        }
        this.activeTheme = normalized;
        this.updateActiveThemeDetails();
        this.renderCueList();
    }

    updateTempoInputs() {
        if (!this.tempoInput || !this.beatsInput || !this.autoAdvanceToggle || !this.loopToggle) return;
        this.tempoInput.value = this.state.tempo;
        this.beatsInput.value = this.state.beatsPerBar;
        this.autoAdvanceToggle.checked = Boolean(this.state.autoAdvance);
        this.loopToggle.checked = Boolean(this.state.loop);
    }

    updateTempoNudgeLabels() {
        const fine = Math.max(1, Math.round(this.tapTempoConfig.fineStep || 1));
        const coarse = Math.max(1, Math.round(this.tapTempoConfig.coarseStep || 4));

        if (this.tempoDownBtn) {
            this.tempoDownBtn.textContent = `-${fine}`;
            this.tempoDownBtn.title = `Nudge tempo down ${fine} BPM`;
        }
        if (this.tempoUpBtn) {
            this.tempoUpBtn.textContent = `+${fine}`;
            this.tempoUpBtn.title = `Nudge tempo up ${fine} BPM`;
        }
        if (this.tempoDownCoarseBtn) {
            this.tempoDownCoarseBtn.textContent = `-${coarse}`;
            this.tempoDownCoarseBtn.title = `Nudge tempo down ${coarse} BPM`;
        }
        if (this.tempoUpCoarseBtn) {
            this.tempoUpCoarseBtn.textContent = `+${coarse}`;
            this.tempoUpCoarseBtn.title = `Nudge tempo up ${coarse} BPM`;
        }
        if (this.tempoNudgesEl) {
            this.tempoNudgesEl.dataset.step = `${fine}`;
        }
        if (this.tempoNudgesCoarseEl) {
            this.tempoNudgesCoarseEl.dataset.step = `${coarse}`;
        }
    }

    clearTempoIndicatorTimeout() {
        if (this.tempoIndicatorTimeout) {
            clearTimeout(this.tempoIndicatorTimeout);
            this.tempoIndicatorTimeout = null;
        }
    }

    pulseTapTempoButton() {
        if (!this.tapTempoButton) {
            return;
        }
        this.tapTempoButton.classList.add('show-planner__tempo-tap--active');
        if (this.tapTempoPulseTimeout) {
            clearTimeout(this.tapTempoPulseTimeout);
        }
        this.tapTempoPulseTimeout = setTimeout(() => {
            this.tapTempoPulseTimeout = null;
            if (this.tapTempoButton) {
                this.tapTempoButton.classList.remove('show-planner__tempo-tap--active');
            }
        }, 200);
    }

    resetTempoIndicator() {
        if (!this.tempoIndicatorEl) return;
        this.clearTempoIndicatorTimeout();
        this.tempoIndicatorEl.textContent = this.tempoIndicatorDefault;
        this.tempoIndicatorEl.dataset.state = 'idle';
    }

    updateTempoIndicator(message, state = 'info', holdMs = this.tapTempoConfig.indicatorHoldMs) {
        if (!this.tempoIndicatorEl) return;
        this.clearTempoIndicatorTimeout();
        this.tempoIndicatorEl.textContent = message;
        this.tempoIndicatorEl.dataset.state = state;
        if (holdMs && holdMs > 0) {
            this.tempoIndicatorTimeout = setTimeout(() => {
                this.tempoIndicatorTimeout = null;
                this.resetTempoIndicator();
            }, holdMs);
        }
    }

    clearTapTempoReset() {
        if (this.tapTempoResetTimeout) {
            clearTimeout(this.tapTempoResetTimeout);
            this.tapTempoResetTimeout = null;
        }
    }

    resetTapTempo({ keepIndicator = false } = {}) {
        this.tapTempoHistory = [];
        this.clearTapTempoReset();
        if (!keepIndicator) {
            this.resetTempoIndicator();
        }
    }

    tapTempo() {
        const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();

        if (!Array.isArray(this.tapTempoHistory)) {
            this.tapTempoHistory = [];
        }

        if (this.tapTempoHistory.length) {
            const sinceLast = now - this.tapTempoHistory[this.tapTempoHistory.length - 1];
            if (sinceLast > this.tapTempoConfig.resetMs) {
                this.tapTempoHistory = [];
            }
        }

        this.tapTempoHistory.push(now);
        this.pulseTapTempoButton();

        const maxLength = (this.tapTempoConfig.historyLimit || 8) + 1;
        if (this.tapTempoHistory.length > maxLength) {
            this.tapTempoHistory.splice(0, this.tapTempoHistory.length - maxLength);
        }

        const intervals = [];
        for (let i = 1; i < this.tapTempoHistory.length; i += 1) {
            intervals.push(this.tapTempoHistory[i] - this.tapTempoHistory[i - 1]);
        }

        if (intervals.length) {
            const averageMs = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
            const bpm = averageMs > 0 ? Math.round(60000 / averageMs) : 0;
            if (bpm >= this.tapTempoConfig.minBpm && bpm <= this.tapTempoConfig.maxBpm) {
                const previousTempo = this.state.tempo;
                this.state.tempo = bpm;
                this.tempoInput.value = bpm;
                this.persistState();
                this.updateStatus();
                this.renderTimeline();
                this.updateTempoIndicator(`${bpm} BPM • ${intervals.length + 1} taps`, 'captured');
                this.broadcastTempoUpdate('tap', {
                    taps: intervals.length + 1,
                    previousTempo
                });
            } else {
                this.updateTempoIndicator('Tap tempo out of range', 'warning', 1800);
            }
        } else {
            this.updateTempoIndicator('Keep tapping…', 'pending', 1200);
        }

        this.clearTapTempoReset();
        this.tapTempoResetTimeout = setTimeout(() => this.resetTapTempo(), this.tapTempoConfig.resetMs);
    }

    nudgeTempo(delta = 0) {
        if (!Number.isFinite(delta) || delta === 0) {
            return;
        }
        const previousTempo = this.state.tempo;
        const targetTempo = Math.round(previousTempo + delta);
        const min = this.tapTempoConfig.minBpm;
        const max = this.tapTempoConfig.maxBpm;
        const clamped = Math.min(max, Math.max(min, targetTempo));

        if (clamped === previousTempo) {
            this.updateTempoIndicator(`${clamped} BPM`, 'info', 1600);
            this.resetTapTempo({ keepIndicator: true });
            return;
        }

        this.state.tempo = clamped;
        this.tempoInput.value = clamped;
        this.persistState();
        this.updateStatus();
        this.renderTimeline();
        const direction = clamped > previousTempo ? 'up' : 'down';
        this.updateTempoIndicator(`Nudged ${direction} to ${clamped} BPM`, 'nudge');
        this.broadcastTempoUpdate('nudge', {
            delta: clamped - previousTempo,
            previousTempo
        });
        this.resetTapTempo({ keepIndicator: true });
    }

    broadcastTempoUpdate(source, extra = {}) {
        if (!this.hub || typeof this.hub.emit !== 'function') {
            return;
        }
        this.hub.emit('show:tempo-update', {
            tempo: this.state.tempo,
            beatsPerBar: this.state.beatsPerBar,
            source,
            ...extra
        });
    }

    normalizeCues(cues = []) {
        return cues
            .map(cue => this.normalizeCue(cue))
            .filter(Boolean);
    }

    normalizeCueTheme(theme) {
        if (!theme) {
            return null;
        }

        if (typeof theme === 'string') {
            if (theme === 'none' || theme === 'hold') {
                return { mode: 'none', transition: null };
            }
            const state = normalizeThemeState({ paletteId: theme }, { transitionDefaults: this.transitionDefaults });
            return { mode: 'palette', state, transition: state.transition };
        }

        const mode = typeof theme.mode === 'string' ? theme.mode : null;
        let transition = null;
        if (theme.transition) {
            transition = normalizeThemeTransition(theme.transition, this.transitionDefaults);
        } else if (theme.state?.transition) {
            transition = normalizeThemeTransition(theme.state.transition, this.transitionDefaults);
        }

        if (mode === 'none') {
            return transition ? { mode: 'none', transition } : { mode: 'none', transition: null };
        }

        if (mode === 'palette') {
            const baseState = theme.state || (theme.paletteId ? { paletteId: theme.paletteId } : null);
            if (!baseState) {
                return null;
            }
            let state = normalizeThemeState(baseState, { transitionDefaults: this.transitionDefaults });
            if (transition) {
                state = { ...state, transition };
            }
            return { mode: 'palette', state, transition: state.transition };
        }

        if (mode === 'preset') {
            return transition ? { mode: 'preset', transition } : { mode: 'preset', transition: null };
        }

        if (theme.paletteId) {
            let state = normalizeThemeState({
                paletteId: theme.paletteId,
                overrides: theme.overrides
            }, { transitionDefaults: this.transitionDefaults });
            if (transition) {
                state = { ...state, transition };
            }
            return { mode: 'palette', state, transition: state.transition };
        }

        return null;
    }

    normalizeCueTransition(transition) {
        if (!transition || typeof transition !== 'object') {
            return null;
        }

        const normalized = normalizeThemeTransition(transition, this.transitionDefaults);
        if (
            normalized.duration === this.transitionDefaults.duration
            && normalized.easing === this.transitionDefaults.easing
        ) {
            return null;
        }

        return normalized;
    }

    normalizeCue(record = {}) {
        if (!record || typeof record !== 'object') {
            return null;
        }

        const id = typeof record.id === 'string' && record.id.trim() ? record.id : createId('cue');
        const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim() : 'Cue';
        const presetId = typeof record.presetId === 'string' && record.presetId.trim() ? record.presetId : null;
        const duration = parseNumber(record.duration, 0);
        const normalizedDuration = duration > 0 ? Math.round(duration) : 0;
        const notes = typeof record.notes === 'string' ? record.notes : '';
        const autoAdvance = Boolean(record.autoAdvance);
        const theme = this.normalizeCueTheme(record.theme);

        return {
            id,
            label,
            presetId,
            duration: normalizedDuration,
            notes,
            autoAdvance,
            theme
        };
    }

    buildCueTheme({ themeMode, transition }) {
        const normalizedTransition = this.normalizeCueTransition(transition);

        if (!themeMode || themeMode === 'preset') {
            return normalizedTransition ? { mode: 'preset', transition: normalizedTransition } : null;
        }

        if (themeMode === 'none') {
            return normalizedTransition ? { mode: 'none', transition: normalizedTransition } : { mode: 'none' };
        }

        if (themeMode.startsWith('palette:')) {
            const paletteId = themeMode.slice('palette:'.length);
            if (!paletteId) {
                return null;
            }
            const state = normalizeThemeState({ paletteId }, { transitionDefaults: this.transitionDefaults });
            const stateWithTransition = normalizedTransition
                ? { ...state, transition: normalizedTransition }
                : state;
            return { mode: 'palette', state: stateWithTransition, transition: stateWithTransition.transition };
        }

        return null;
    }

    describeCueTheme(cue, presetSummary) {
        const baseTheme = this.themeContext?.baseTheme;
        const theme = cue?.theme ? this.normalizeCueTheme(cue.theme) : null;

        if (theme && theme.mode === 'none') {
            const accent = this.activeThemeAccent || baseTheme?.accent || '#53d7ff';
            return {
                mode: 'none',
                label: 'Hold current theme',
                accent,
                description: 'Cue keeps the active glow palette.',
                matchesActive: false,
                state: null,
                transition: theme.transition || null,
                transitionLabel: theme.transition ? this.describeTransition(theme.transition) : ''
            };
        }

        if (theme && theme.mode === 'palette') {
            const details = resolveThemeDetails(theme.state, {
                palettes: this.themePalettes,
                baseTheme,
                transitionDefaults: this.transitionDefaults
            });
            const transition = theme.transition || details.transition || null;
            return {
                mode: 'palette',
                label: details.paletteLabel,
                accent: details.accent,
                description: details.description || 'Cue applies a palette override.',
                matchesActive: this.activeTheme ? areThemesEqual(details.state, this.activeTheme) : false,
                state: details.state,
                transition,
                transitionLabel: transition ? this.describeTransition(transition) : ''
            };
        }

        const presetTheme = presetSummary?.theme || null;
        if (!presetTheme) {
            return null;
        }

        const state = presetTheme.state
            ? normalizeThemeState(presetTheme.state, { transitionDefaults: this.transitionDefaults })
            : normalizeThemeState(presetTheme, { transitionDefaults: this.transitionDefaults });
        const details = resolveThemeDetails(state, {
            palettes: this.themePalettes,
            baseTheme,
            transitionDefaults: this.transitionDefaults
        });
        const transition = (theme && theme.mode === 'preset' && theme.transition)
            ? theme.transition
            : details.transition;

        return {
            mode: 'preset',
            label: presetTheme.label || details.paletteLabel,
            accent: presetTheme.accent || details.accent,
            description: presetTheme.description || details.description,
            matchesActive: this.activeTheme ? areThemesEqual(state, this.activeTheme) : false,
            state,
            transition,
            transitionLabel: transition ? this.describeTransition(transition) : ''
        };
    }

    resolveCueThemeStrategy(cue, presetSummary) {
        const normalizedTheme = cue?.theme ? this.normalizeCueTheme(cue.theme) : null;
        if (normalizedTheme && normalizedTheme.mode === 'none') {
            return {
                mode: 'none',
                applyPresetTheme: false,
                state: null,
                transition: normalizedTheme.transition || null
            };
        }

        if (normalizedTheme && normalizedTheme.mode === 'palette') {
            let state = normalizeThemeState(normalizedTheme.state, { transitionDefaults: this.transitionDefaults });
            if (normalizedTheme.transition) {
                state = { ...state, transition: normalizedTheme.transition };
            }
            return {
                mode: 'palette',
                applyPresetTheme: false,
                state,
                transition: state.transition
            };
        }

        const presetTheme = presetSummary?.theme?.state || presetSummary?.theme || null;
        if (normalizedTheme && normalizedTheme.mode === 'preset') {
            if (presetTheme) {
                let state = normalizeThemeState(presetTheme, { transitionDefaults: this.transitionDefaults });
                if (normalizedTheme.transition) {
                    state = { ...state, transition: normalizedTheme.transition };
                    return {
                        mode: 'preset',
                        applyPresetTheme: false,
                        state,
                        transition: state.transition
                    };
                }
                return {
                    mode: 'preset',
                    applyPresetTheme: true,
                    state,
                    transition: state.transition
                };
            }
            return { mode: 'none', applyPresetTheme: false, state: null, transition: normalizedTheme.transition || null };
        }

        if (presetTheme) {
            const state = normalizeThemeState(presetTheme, { transitionDefaults: this.transitionDefaults });
            return { mode: 'preset', applyPresetTheme: true, state, transition: state.transition };
        }

        return { mode: 'none', applyPresetTheme: false, state: null, transition: null };
    }

    populateThemeSelect() {
        if (!this.themeSelect) return;
        this.themeSelect.innerHTML = '';
        delete this.themeSelect.dataset.userSelected;

        const presetOption = document.createElement('option');
        presetOption.value = 'preset';
        presetOption.textContent = 'Adopt preset theme';
        this.themeSelect.appendChild(presetOption);

        const holdOption = document.createElement('option');
        holdOption.value = 'none';
        holdOption.textContent = 'Hold current glow';
        this.themeSelect.appendChild(holdOption);

        if (this.themePalettes.length) {
            const paletteGroup = document.createElement('optgroup');
            paletteGroup.label = 'Cue palettes';
            this.themePalettes.forEach(palette => {
                if (!palette?.id) return;
                const option = document.createElement('option');
                option.value = `palette:${palette.id}`;
                option.textContent = palette.label || palette.id;
                paletteGroup.appendChild(option);
            });
            this.themeSelect.appendChild(paletteGroup);
        }

        this.themeSelect.value = this.presetSelect?.value ? 'preset' : 'none';
        this.updateThemeSelectAvailability();
        this.populateTransitionEasingSelect();
        this.resetThemeControlsToDefaults({ force: true });
    }

    updateThemeSelectAvailability() {
        if (!this.themeSelect) return;
        const presetSelected = Boolean(this.presetSelect?.value);
        const presetOption = this.themeSelect.querySelector('option[value="preset"]');
        if (presetOption) {
            presetOption.disabled = !presetSelected;
        }
        const userSelected = this.themeSelect.dataset.userSelected === 'true';
        if (!userSelected) {
            this.themeSelect.value = presetSelected ? 'preset' : 'none';
        }
        if (!presetSelected && this.themeSelect.value === 'preset') {
            this.themeSelect.value = 'none';
        }
        this.updateThemeControlAvailability();
    }

    populateTransitionEasingSelect() {
        if (!this.transitionEasingSelect) {
            return;
        }

        const currentValue = this.transitionEasingSelect.value || this.transitionDefaults.easing;
        this.transitionEasingSelect.innerHTML = '';

        this.easingOptions.forEach(option => {
            if (!option || !option.value) return;
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.label || option.value;
            this.transitionEasingSelect.appendChild(opt);
        });

        this.ensureTransitionOption(currentValue);
        this.transitionEasingSelect.value = currentValue;
    }

    ensureTransitionOption(value) {
        if (!this.transitionEasingSelect || !value) {
            return;
        }

        const hasOption = Array.from(this.transitionEasingSelect.options).some(option => option.value === value);
        if (!hasOption) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = `Custom (${value})`;
            option.dataset.dynamic = 'true';
            this.transitionEasingSelect.appendChild(option);
        }
    }

    resetThemeControlsToDefaults({ force = false } = {}) {
        const userSelected = this.themeControls?.dataset?.userSelected === 'true';
        if (!force && userSelected) {
            return;
        }
        if (this.transitionDurationInput) {
            this.transitionDurationInput.value = this.transitionDefaults.duration;
        }
        if (this.transitionEasingSelect) {
            this.ensureTransitionOption(this.transitionDefaults.easing);
            this.transitionEasingSelect.value = this.transitionDefaults.easing;
        }
        if (this.themeControls && this.themeControls.dataset) {
            delete this.themeControls.dataset.userSelected;
        }
        this.updateThemeControlAvailability();
    }

    markThemeControlsTouched() {
        if (this.themeControls) {
            this.themeControls.dataset.userSelected = 'true';
        }
    }

    updateThemeControlAvailability() {
        const mode = this.themeSelect?.value || 'none';
        const disabled = mode === 'none';

        if (this.transitionDurationInput) {
            this.transitionDurationInput.disabled = disabled;
        }
        if (this.transitionEasingSelect) {
            this.transitionEasingSelect.disabled = disabled;
        }
        if (this.themeControls) {
            this.themeControls.classList.toggle('show-planner__theme-controls--disabled', disabled);
        }
    }

    getEasingLabel(value) {
        if (!value) {
            return '';
        }
        const preset = this.easingOptions.find(option => option.value === value || option.id === value);
        return preset?.label || '';
    }

    describeTransition(transition) {
        if (!transition) {
            return '';
        }
        const normalized = normalizeThemeTransition(transition, this.transitionDefaults);
        if (normalized.duration <= 0) {
            return 'Instant';
        }
        const durationMs = normalized.duration;
        const durationLabel = durationMs < 1000
            ? `${Math.round(durationMs)} ms`
            : `${(durationMs / 1000) % 1 === 0 ? (durationMs / 1000).toFixed(0) : (durationMs / 1000).toFixed(1)} s`;
        const easingLabel = this.getEasingLabel(normalized.easing);
        return easingLabel ? `${durationLabel} ${easingLabel}` : durationLabel;
    }

    syncPresetOptions() {
        if (!this.presetSelect) return;
        const presets = this.presetManager?.getPresetSummaries?.() || [];
        this.presetSelect.innerHTML = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = presets.length ? 'Select preset' : 'Save a preset first';
        this.presetSelect.appendChild(placeholder);

        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.name;
            this.presetSelect.appendChild(option);
        });

        this.updateThemeSelectAvailability();
    }

    addCue(formData) {
        const rawLabel = (formData.get('label') || '').toString().trim();
        const presetId = (formData.get('presetId') || '').toString();
        const duration = parseNumber(formData.get('duration'), 0);
        const notes = (formData.get('notes') || '').toString();
        const cueAutoAdvance = formData.get('cueAutoAdvance') === 'on';
        const themeMode = (formData.get('themeMode') || '').toString();
        const transitionDuration = parseNumber(formData.get('themeTransitionDuration'), this.transitionDefaults.duration);
        const transitionEasing = (formData.get('themeTransitionEasing') || '').toString();

        if (!presetId && !rawLabel && !notes) {
            return;
        }

        const preset = presetId ? this.presetManager?.getPresetById?.(presetId) : null;
        const label = rawLabel || preset?.name || `Cue ${this.state.cues.length + 1}`;

        const cueTheme = this.buildCueTheme({
            themeMode,
            transition: { duration: transitionDuration, easing: transitionEasing }
        });

        const cue = this.normalizeCue({
            id: createId('cue'),
            label,
            presetId: presetId || null,
            duration: duration > 0 ? Math.round(duration) : 0,
            notes,
            autoAdvance: cueAutoAdvance,
            theme: cueTheme
        });

        this.state.cues.push(cue);
        this.persistState();
        this.renderCueList();
        this.form.reset();
        this.resetThemeControlsToDefaults({ force: false });
        this.syncPresetOptions();
        this.populateThemeSelect();
        this.updateStatus();
        this.updateRunControls();
    }

    renderCueList() {
        if (!this.cueListEl) return;
        this.cueListEl.innerHTML = '';

        if (!this.state.cues.length) {
            const empty = document.createElement('li');
            empty.className = 'show-planner__empty';
            empty.textContent = 'No cues yet. Add presets with notes and durations to build your run.';
            this.cueListEl.appendChild(empty);
            this.renderTimeline();
            return;
        }

        const summaries = (this.presetManager?.getPresetSummaries?.() || []).reduce((map, summary) => {
            map[summary.id] = summary;
            return map;
        }, {});

        const activeAccent = this.activeThemeAccent || this.themeContext?.baseTheme?.accent;

        this.state.cues.forEach((cue, index) => {
            const item = document.createElement('li');
            item.className = 'show-planner__cue';
            if (index === this.activeIndex) {
                item.classList.add('show-planner__cue--active');
            }

            const preset = cue.presetId ? summaries[cue.presetId] : null;
            const presetName = preset?.name || (cue.presetId ? 'Missing preset' : 'Manual cue');
            const themeInfo = this.describeCueTheme(cue, preset);
            const themeBadge = themeInfo
                ? `<span class="show-planner__cue-theme${themeInfo.matchesActive ? ' show-planner__cue-theme--active' : ''}"></span>`
                : '';
            const metaParts = [];
            if (cue.duration) {
                metaParts.push(`${cue.duration} beat${cue.duration === 1 ? '' : 's'}`);
            } else {
                metaParts.push('Manual');
            }
            if (cue.autoAdvance) {
                metaParts.push('Auto');
            }
            if (themeInfo?.transitionLabel) {
                metaParts.push(themeInfo.transitionLabel);
            }

            item.innerHTML = `
                <div class="show-planner__cue-details">
                    <div class="show-planner__cue-title">
                        <strong>${cue.label}</strong>
                        <span>${presetName}</span>
                        ${themeBadge}
                    </div>
                    ${cue.notes ? `<p>${cue.notes}</p>` : ''}
                    <footer>
                        ${metaParts.map(part => `<span>${part}</span>`).join('')}
                    </footer>
                </div>
                <div class="show-planner__cue-actions">
                    <button type="button" data-action="trigger">Trigger</button>
                    <button type="button" data-action="up">Up</button>
                    <button type="button" data-action="down">Down</button>
                    <button type="button" data-action="delete">Delete</button>
                </div>
            `;

            item.querySelector('[data-action="trigger"]').addEventListener('click', () => this.triggerCue(index, { manual: true }));
            item.querySelector('[data-action="up"]').addEventListener('click', () => this.moveCue(index, index - 1));
            item.querySelector('[data-action="down"]').addEventListener('click', () => this.moveCue(index, index + 1));
            item.querySelector('[data-action="delete"]').addEventListener('click', () => this.deleteCue(index));

            if (activeAccent) {
                item.style.setProperty('--active-theme-accent', activeAccent);
            }

            if (themeInfo) {
                if (themeInfo.accent) {
                    item.style.setProperty('--cue-theme-accent', themeInfo.accent);
                }
                if (themeInfo.matchesActive) {
                    item.classList.add('show-planner__cue--theme-match');
                }
                const badge = item.querySelector('.show-planner__cue-theme');
                if (badge) {
                    badge.textContent = themeInfo.label;
                    if (themeInfo.description) {
                        badge.title = themeInfo.description;
                    }
                    if (themeInfo.mode === 'none') {
                        badge.classList.add('show-planner__cue-theme--hold');
                    }
                }
            }

            this.cueListEl.appendChild(item);
        });

        this.renderTimeline();
    }

    calculateTimeline() {
        const tempo = parseNumber(this.state.tempo, this.defaults.tempo);
        const beatsPerBar = parseNumber(this.state.beatsPerBar, this.defaults.beatsPerBar);
        const secondsPerBeat = tempo > 0 ? 60 / tempo : 0;

        let cursorBeats = 0;
        const items = this.state.cues.map((cue, index) => {
            const beats = Math.max(0, parseNumber(cue.duration, 0));
            const startBeat = cursorBeats;
            const startSeconds = secondsPerBeat > 0 ? startBeat * secondsPerBeat : 0;
            const durationSeconds = secondsPerBeat > 0 ? beats * secondsPerBeat : 0;
            const endBeat = startBeat + beats;
            const endSeconds = startSeconds + durationSeconds;
            if (beats > 0) {
                cursorBeats = endBeat;
            }
            return {
                cue,
                index,
                beats,
                startBeat,
                endBeat,
                startSeconds,
                endSeconds,
                durationSeconds
            };
        });

        const totalBeats = cursorBeats;
        const totalSeconds = secondsPerBeat > 0 ? totalBeats * secondsPerBeat : 0;
        const manualCount = this.state.cues.filter(cue => !parseNumber(cue.duration, 0)).length;

        return {
            items,
            totalBeats,
            totalSeconds,
            tempo,
            beatsPerBar,
            manualCount
        };
    }

    renderTimeline() {
        if (!this.timelineListEl) return;

        const { items, totalBeats, totalSeconds, beatsPerBar, manualCount } = this.calculateTimeline();
        const activeAccent = this.activeThemeAccent || this.themeContext?.baseTheme?.accent || null;

        if (this.timelineEl && activeAccent) {
            this.timelineEl.style.setProperty('--timeline-accent', activeAccent);
        }

        if (this.timelineTotalBeatsEl) {
            const beatsLabel = totalBeats > 0 ? `${totalBeats} beat${totalBeats === 1 ? '' : 's'}` : '0 beats';
            const barsLabel = formatBarsLabel(totalBeats, beatsPerBar);
            this.timelineTotalBeatsEl.textContent = barsLabel ? `${beatsLabel} (${barsLabel})` : beatsLabel;
        }

        if (this.timelineRuntimeEl) {
            const runtimeLabel = formatRuntimeLabel(totalSeconds);
            if (manualCount > 0 && totalSeconds > 0) {
                const plural = manualCount === 1 ? 'manual cue' : 'manual cues';
                this.timelineRuntimeEl.textContent = `${runtimeLabel} + ${manualCount} ${plural}`;
            } else if (manualCount > 0 && totalSeconds <= 0) {
                const plural = manualCount === 1 ? 'cue' : 'cues';
                this.timelineRuntimeEl.textContent = `Manual (${manualCount} ${plural})`;
            } else {
                this.timelineRuntimeEl.textContent = runtimeLabel;
            }
        }

        this.timelineListEl.innerHTML = '';

        if (!items.length) {
            const empty = document.createElement('li');
            empty.className = 'show-planner__timeline-empty';
            empty.textContent = 'Timeline populates as you add cues.';
            this.timelineListEl.appendChild(empty);
            return;
        }

        const summaries = (this.presetManager?.getPresetSummaries?.() || []).reduce((map, summary) => {
            map[summary.id] = summary;
            return map;
        }, {});

        const widthBase = totalBeats > 0 ? totalBeats : items.length || 1;

        items.forEach(entry => {
            const li = document.createElement('li');
            li.className = 'show-planner__timeline-cue';
            if (entry.index === this.activeIndex) {
                li.classList.add('show-planner__timeline-cue--active');
            }

            const cue = entry.cue;
            const preset = cue.presetId ? summaries[cue.presetId] : null;
            const presetName = preset?.name || (cue.presetId ? 'Missing preset' : 'Manual cue');
            const beatsLabel = entry.beats > 0 ? `${entry.beats} beat${entry.beats === 1 ? '' : 's'}` : 'Manual';
            const barsLabel = formatBarsLabel(entry.beats, beatsPerBar);
            const timeLabel = entry.beats > 0 && entry.durationSeconds > 0
                ? `${formatTimecode(entry.startSeconds)} → ${formatTimecode(entry.endSeconds)}`
                : `${formatTimecode(entry.startSeconds)} • Manual`;
            const widthPercent = entry.beats > 0 && totalBeats > 0
                ? Math.max(4, (entry.beats / totalBeats) * 100)
                : Math.max(6, 100 / widthBase);

            li.innerHTML = `
                <div class="show-planner__timeline-bar">
                    <span class="show-planner__timeline-progress" style="width: ${widthPercent}%"></span>
                </div>
                <div class="show-planner__timeline-details">
                    <div class="show-planner__timeline-title">
                        <strong>${entry.index + 1}. ${cue.label}</strong>
                        <span>${timeLabel}</span>
                    </div>
                    <footer>
                        <span>${presetName}</span>
                        <span>${beatsLabel}${barsLabel ? ` • ${barsLabel}` : ''}</span>
                    </footer>
                </div>
            `;

            if (preset?.accent) {
                li.style.setProperty('--timeline-preset-accent', preset.accent);
            } else if (activeAccent) {
                li.style.setProperty('--timeline-preset-accent', activeAccent);
            }

            this.timelineListEl.appendChild(li);
        });
    }

    moveCue(fromIndex, toIndex) {
        if (toIndex < 0 || toIndex >= this.state.cues.length || fromIndex === toIndex) return;
        const activeId = this.activeIndex >= 0 ? this.state.cues[this.activeIndex]?.id : null;
        const [cue] = this.state.cues.splice(fromIndex, 1);
        this.state.cues.splice(toIndex, 0, cue);
        if (activeId) {
            this.activeIndex = this.state.cues.findIndex(item => item.id === activeId);
        }
        this.persistState();
        this.renderCueList();
        this.updateStatus();
        this.updateRunControls();
    }

    deleteCue(index) {
        if (index < 0 || index >= this.state.cues.length) return;
        const [removed] = this.state.cues.splice(index, 1);
        if (removed && this.activeIndex >= 0) {
            const activeId = this.state.cues[this.activeIndex]?.id;
            if (!activeId || removed.id === activeId) {
                this.stopRun();
            } else {
                this.activeIndex = this.state.cues.findIndex(item => item.id === activeId);
            }
        }
        if (!this.state.cues.length) {
            this.activeIndex = -1;
        }
        this.persistState();
        this.renderCueList();
        this.updateStatus();
        this.updateRunControls();
    }

    updateTempo() {
        const previousTempo = this.state.tempo;
        const min = this.tapTempoConfig.minBpm;
        const max = this.tapTempoConfig.maxBpm;
        const parsed = parseNumber(this.tempoInput.value, this.defaults.tempo);
        const clamped = Math.min(max, Math.max(min, Math.round(parsed)));
        this.state.tempo = clamped;
        this.tempoInput.value = clamped;
        this.persistState();
        this.updateStatus();
        this.renderTimeline();
        this.updateTempoIndicator(`${clamped} BPM`, clamped === previousTempo ? 'info' : 'set');
        this.broadcastTempoUpdate('input', { previousTempo });
        this.resetTapTempo({ keepIndicator: true });
    }

    updateBeatsPerBar() {
        const previousBeats = this.state.beatsPerBar;
        const parsed = parseNumber(this.beatsInput.value, this.defaults.beatsPerBar);
        this.state.beatsPerBar = Math.min(16, Math.max(1, Math.round(parsed)));
        this.beatsInput.value = this.state.beatsPerBar;
        this.persistState();
        this.updateStatus();
        this.renderTimeline();
        if (this.state.beatsPerBar !== previousBeats) {
            this.broadcastTempoUpdate('beats', { previousBeats });
        }
    }

    toggleAutoAdvance() {
        this.state.autoAdvance = Boolean(this.autoAdvanceToggle.checked);
        this.persistState();
        this.updateStatus();
    }

    toggleLoop() {
        this.state.loop = Boolean(this.loopToggle.checked);
        this.persistState();
        this.updateStatus();
    }

    startRun() {
        if (!this.state.cues.length) return;
        this.isRunning = true;
        this.activeIndex = 0;
        this.updateRunControls();
        this.triggerCue(0, { manual: false });
        this.hub?.emit?.('show:start', {
            cues: clone(this.state.cues),
            tempo: this.state.tempo,
            beatsPerBar: this.state.beatsPerBar,
            autoAdvance: this.state.autoAdvance,
            loop: this.state.loop
        });
    }

    stopRun() {
        const wasRunning = this.isRunning;
        if (this.isRunning) {
            this.isRunning = false;
            this.clearNextCueTimer();
        }
        this.activeIndex = -1;
        this.updateRunControls();
        this.updateStatus();
        this.renderCueList();
        if (wasRunning) {
            this.hub?.emit?.('show:stop');
        }
    }

    previousCue() {
        if (!this.isRunning) {
            this.startRun();
            return;
        }
        const nextIndex = Math.max(0, this.activeIndex - 1);
        this.triggerCue(nextIndex, { manual: false });
    }

    nextCue() {
        if (!this.state.cues.length) return;
        if (!this.isRunning) {
            this.startRun();
            return;
        }
        const nextIndex = this.activeIndex + 1;
        if (nextIndex >= this.state.cues.length) {
            if (this.state.loop) {
                this.triggerCue(0, { manual: false });
            } else {
                this.stopRun();
            }
        } else {
            this.triggerCue(nextIndex, { manual: false });
        }
    }

    triggerCue(index, { manual = false } = {}) {
        if (index < 0 || index >= this.state.cues.length) return;
        const cue = this.state.cues[index];
        this.clearNextCueTimer();
        this.activeIndex = index;
        this.updateRunControls();
        this.renderCueList();

        let presetSummary = null;
        if (cue.presetId && this.presetManager?.getPresetSummaries) {
            const summaries = this.presetManager.getPresetSummaries();
            if (Array.isArray(summaries)) {
                presetSummary = summaries.find(p => p.id === cue.presetId) || null;
            }
        }
        const themeStrategy = this.resolveCueThemeStrategy(cue, presetSummary);

        if (cue.presetId) {
            const loaded = this.presetManager?.loadPresetById?.(cue.presetId, { applyTheme: themeStrategy.applyPresetTheme });
            if (!loaded) {
                console.warn('ShowPlanner cue preset missing', cue.presetId);
            }
        }

        const transitionMeta = themeStrategy.transition || themeStrategy.state?.transition || null;

        if (themeStrategy.mode === 'palette' && themeStrategy.state) {
            this.applyThemeState?.(themeStrategy.state, { cueLabel: cue.label, mode: 'palette', transition: transitionMeta });
        } else if (themeStrategy.mode === 'preset' && themeStrategy.state && !themeStrategy.applyPresetTheme) {
            this.applyThemeState?.(themeStrategy.state, { cueLabel: cue.label, mode: 'preset', transition: transitionMeta });
        }

        this.hub?.emit?.('show:cue-trigger', {
            cue: clone(cue),
            index,
            manual,
            running: this.isRunning,
            themeMode: themeStrategy.mode,
            themeState: themeStrategy.state ? clone(themeStrategy.state) : null,
            themeTransition: transitionMeta ? clone(transitionMeta) : null
        });
        this.updateStatus();

        const shouldAutoAdvance = (this.state.autoAdvance || cue.autoAdvance) && cue.duration > 0 && this.state.tempo > 0;
        if (this.isRunning && shouldAutoAdvance) {
            const milliseconds = (60 / this.state.tempo) * cue.duration * 1000;
            this.nextCueTimeout = setTimeout(() => this.nextCue(), milliseconds);
        }
    }

    clearNextCueTimer() {
        if (this.nextCueTimeout) {
            clearTimeout(this.nextCueTimeout);
            this.nextCueTimeout = null;
        }
    }

    updateRunControls() {
        const hasCues = this.state.cues.length > 0;
        this.startBtn.disabled = this.isRunning || !hasCues;
        this.stopBtn.disabled = !this.isRunning;
        this.prevBtn.disabled = !this.isRunning || this.activeIndex <= 0;
        this.nextBtn.disabled = !this.isRunning || (this.activeIndex >= this.state.cues.length - 1 && !this.state.loop);
    }

    updateStatus() {
        if (!this.statusEl) return;
        if (this.isRunning && this.activeIndex >= 0 && this.state.cues[this.activeIndex]) {
            const cue = this.state.cues[this.activeIndex];
            this.statusEl.textContent = `Running: ${cue.label} (${this.activeIndex + 1}/${this.state.cues.length})`;
            this.statusEl.dataset.state = 'running';
        } else if (this.state.cues.length) {
            this.statusEl.textContent = `Ready with ${this.state.cues.length} cue${this.state.cues.length === 1 ? '' : 's'}`;
            this.statusEl.dataset.state = 'ready';
        } else {
            this.statusEl.textContent = 'Idle';
            this.statusEl.dataset.state = 'idle';
        }
    }

    getState() {
        return clone(this.state);
    }

    applyState(state = {}) {
        this.state = {
            tempo: state.tempo ?? this.defaults.tempo,
            beatsPerBar: state.beatsPerBar ?? this.defaults.beatsPerBar,
            autoAdvance: state.autoAdvance ?? this.defaults.autoAdvance,
            loop: state.loop ?? this.defaults.loop,
            cues: Array.isArray(state.cues) ? this.normalizeCues(state.cues) : []
        };
        this.persistState();
        this.updateTempoInputs();
        this.updateTempoNudgeLabels();
        this.resetTapTempo();
        this.renderCueList();
        this.populateThemeSelect();
        this.updateRunControls();
        this.updateStatus();
        this.broadcastTempoUpdate('state-apply', { restored: true });
    }

    destroy() {
        this.clearNextCueTimer();
        this.clearTapTempoReset();
        this.clearTempoIndicatorTimeout();
        if (this.tapTempoPulseTimeout) {
            clearTimeout(this.tapTempoPulseTimeout);
            this.tapTempoPulseTimeout = null;
        }
        this.tapTempoHistory = [];
        this.subscriptions.forEach(unsubscribe => unsubscribe?.());
        this.subscriptions = [];
        this.container = null;
    }
}
