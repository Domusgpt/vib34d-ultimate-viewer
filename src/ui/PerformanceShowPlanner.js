import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

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

export class PerformanceShowPlanner {
    constructor({ container = null, hub = null, presetManager = null, config = DEFAULT_PERFORMANCE_CONFIG.showPlanner } = {}) {
        this.container = container || this.ensureContainer();
        this.hub = hub;
        this.presetManager = presetManager;
        this.config = { ...DEFAULT_PERFORMANCE_CONFIG.showPlanner, ...(config || {}) };

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
                cues: Array.isArray(parsed?.cues) ? parsed.cues : []
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
        this.cueListEl = this.container.querySelector('[data-role="cue-list"]');

        this.startBtn.addEventListener('click', () => this.startRun());
        this.stopBtn.addEventListener('click', () => this.stopRun());
        this.prevBtn.addEventListener('click', () => this.previousCue());
        this.nextBtn.addEventListener('click', () => this.nextCue());
        this.tempoInput.addEventListener('change', () => this.updateTempo());
        this.beatsInput.addEventListener('change', () => this.updateBeatsPerBar());
        this.autoAdvanceToggle.addEventListener('change', () => this.toggleAutoAdvance());
        this.loopToggle.addEventListener('change', () => this.toggleLoop());
        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.addCue(new FormData(this.form));
        });
    }

    registerHubListeners() {
        if (!this.hub || typeof this.hub.on !== 'function') return;
        this.subscriptions.push(this.hub.on('preset:list-changed', () => this.syncPresetOptions()));
        this.subscriptions.push(this.hub.on('preset:saved', () => this.syncPresetOptions()));
        this.subscriptions.push(this.hub.on('preset:loaded', () => this.updateStatus()));
    }

    updateTempoInputs() {
        if (!this.tempoInput || !this.beatsInput || !this.autoAdvanceToggle || !this.loopToggle) return;
        this.tempoInput.value = this.state.tempo;
        this.beatsInput.value = this.state.beatsPerBar;
        this.autoAdvanceToggle.checked = Boolean(this.state.autoAdvance);
        this.loopToggle.checked = Boolean(this.state.loop);
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
    }

    addCue(formData) {
        const rawLabel = (formData.get('label') || '').toString().trim();
        const presetId = (formData.get('presetId') || '').toString();
        const duration = parseNumber(formData.get('duration'), 0);
        const notes = (formData.get('notes') || '').toString();
        const cueAutoAdvance = formData.get('cueAutoAdvance') === 'on';

        if (!presetId && !rawLabel && !notes) {
            return;
        }

        const preset = presetId ? this.presetManager?.getPresetById?.(presetId) : null;
        const label = rawLabel || preset?.name || `Cue ${this.state.cues.length + 1}`;

        const cue = {
            id: createId('cue'),
            label,
            presetId: presetId || null,
            duration: duration > 0 ? Math.round(duration) : 0,
            notes,
            autoAdvance: cueAutoAdvance
        };

        this.state.cues.push(cue);
        this.persistState();
        this.renderCueList();
        this.form.reset();
        this.syncPresetOptions();
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
            return;
        }

        const summaries = (this.presetManager?.getPresetSummaries?.() || []).reduce((map, summary) => {
            map[summary.id] = summary;
            return map;
        }, {});

        this.state.cues.forEach((cue, index) => {
            const item = document.createElement('li');
            item.className = 'show-planner__cue';
            if (index === this.activeIndex) {
                item.classList.add('show-planner__cue--active');
            }

            const preset = cue.presetId ? summaries[cue.presetId] : null;
            const presetName = preset?.name || (cue.presetId ? 'Missing preset' : 'Manual cue');

            item.innerHTML = `
                <div class="show-planner__cue-details">
                    <div class="show-planner__cue-title">
                        <strong>${cue.label}</strong>
                        <span>${presetName}</span>
                    </div>
                    ${cue.notes ? `<p>${cue.notes}</p>` : ''}
                    <footer>
                        ${cue.duration ? `<span>${cue.duration} beat${cue.duration === 1 ? '' : 's'}</span>` : '<span>Manual</span>'}
                        ${cue.autoAdvance ? '<span>Auto</span>' : ''}
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

            this.cueListEl.appendChild(item);
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
        this.state.tempo = Math.min(240, Math.max(40, parseNumber(this.tempoInput.value, this.defaults.tempo)));
        this.tempoInput.value = this.state.tempo;
        this.persistState();
        this.updateStatus();
    }

    updateBeatsPerBar() {
        this.state.beatsPerBar = Math.min(16, Math.max(1, parseNumber(this.beatsInput.value, this.defaults.beatsPerBar)));
        this.beatsInput.value = this.state.beatsPerBar;
        this.persistState();
        this.updateStatus();
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

        if (cue.presetId) {
            const loaded = this.presetManager?.loadPresetById?.(cue.presetId);
            if (!loaded) {
                console.warn('ShowPlanner cue preset missing', cue.presetId);
            }
        }

        this.hub?.emit?.('show:cue-trigger', { cue: clone(cue), index, manual, running: this.isRunning });
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
            cues: Array.isArray(state.cues) ? clone(state.cues) : []
        };
        this.persistState();
        this.updateTempoInputs();
        this.renderCueList();
        this.updateRunControls();
        this.updateStatus();
    }

    destroy() {
        this.clearNextCueTimer();
        this.subscriptions.forEach(unsubscribe => unsubscribe?.());
        this.subscriptions = [];
        this.container = null;
    }
}
