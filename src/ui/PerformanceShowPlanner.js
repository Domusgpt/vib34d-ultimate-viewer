import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

const STORAGE_AVAILABLE = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const MIN_TEMPO = 40;
const MAX_TEMPO = 220;
const MIN_BEATS_PER_BAR = 1;
const MAX_BEATS_PER_BAR = 12;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createElement(tag, className, html) {
    const el = document.createElement(tag);
    if (className) {
        el.className = className;
    }
    if (html !== undefined) {
        el.innerHTML = html;
    }
    return el;
}

function sanitizeCue(raw) {
    if (!raw || !raw.id || !raw.presetId) {
        return null;
    }
    const cue = {
        id: raw.id,
        presetId: raw.presetId,
        presetName: raw.presetName || raw.presetId,
        label: (raw.label || '').trim() || raw.presetName || raw.presetId,
        notes: typeof raw.notes === 'string' ? raw.notes : ''
    };
    const timing = Number(raw.timing);
    cue.timing = Number.isFinite(timing) && timing >= 0 ? Math.round(timing * 2) / 2 : null;
    return cue;
}

function toBoolean(value, fallback = false) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return fallback;
        }
        if (['true', '1', 'yes', 'on'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'no', 'off'].includes(normalized)) {
            return false;
        }
        return fallback;
    }
    if (value === null || value === undefined) {
        return fallback;
    }
    return Boolean(value);
}

export class PerformanceShowPlanner {
    constructor({
        presetManager = null,
        container = null,
        hub = null,
        config = DEFAULT_PERFORMANCE_CONFIG.presets.showPlanner
    } = {}) {
        this.presetManager = presetManager;
        this.hub = hub;
        this.config = {
            ...DEFAULT_PERFORMANCE_CONFIG.presets.showPlanner,
            ...(config || {})
        };

        this.container = container || this.ensureContainer();
        const stored = this.loadCuesFromStorage();
        this.cues = stored.cues;
        this.activeCueId = stored.activeCueId || null;
        this.runState = this.createRunState(stored.run);
        this.unsubscribe = [];
        this.keydownHandler = null;
        this.timerEl = null;
        this.runControls = {};
        this.persistDebounce = null;

        this.syncActiveIndex();

        this.render();
        this.renderCueList();
        this.attachHubListeners();
        this.attachKeyboardShortcuts();
    }

    ensureContainer() {
        const column = document.getElementById('performance-presets');
        if (column) {
            return column;
        }
        const section = document.createElement('section');
        section.id = 'performance-presets';
        return section;
    }

    loadCuesFromStorage() {
        const empty = { cues: [], run: {}, activeCueId: null };
        if (!STORAGE_AVAILABLE || !this.config?.storageKey) {
            return empty;
        }
        try {
            const raw = window.localStorage.getItem(this.config.storageKey);
            if (!raw) return empty;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return { cues: parsed.map(sanitizeCue).filter(Boolean), run: {}, activeCueId: null };
            }
            if (!parsed || typeof parsed !== 'object') {
                return empty;
            }
            const cues = Array.isArray(parsed.cues)
                ? parsed.cues.map(sanitizeCue).filter(Boolean)
                : [];
            const run = parsed.run && typeof parsed.run === 'object' ? { ...parsed.run } : {};
            const activeCueId = typeof parsed.activeCueId === 'string' ? parsed.activeCueId : null;
            return { cues, run, activeCueId };
        } catch (error) {
            console.warn('PerformanceShowPlanner: failed to load cues', error);
            return empty;
        }
    }

    persist() {
        if (!STORAGE_AVAILABLE || !this.config?.storageKey) {
            return;
        }
        if (this.persistDebounce) {
            clearTimeout(this.persistDebounce);
            this.persistDebounce = null;
        }
        try {
            const payload = {
                cues: this.cues.map(cue => ({ ...cue })),
                run: {
                    tempo: this.runState.tempo,
                    beatsPerBar: this.runState.beatsPerBar,
                    autoAdvance: this.runState.autoAdvance
                },
                activeCueId: this.activeCueId
            };
            window.localStorage.setItem(this.config.storageKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('PerformanceShowPlanner: failed to persist cues', error);
        }
    }

    persistSoon() {
        if (!STORAGE_AVAILABLE || !this.config?.storageKey) {
            return;
        }
        if (this.persistDebounce) {
            clearTimeout(this.persistDebounce);
        }
        this.persistDebounce = setTimeout(() => {
            this.persistDebounce = null;
            this.persist();
        }, 100);
    }

    createRunState(overrides = {}) {
        const baseTempo = overrides?.tempo ?? this.config?.tempo ?? 120;
        const baseBeats = overrides?.beatsPerBar ?? this.config?.beatsPerBar ?? 4;
        const autoAdvance = toBoolean(overrides?.autoAdvance, toBoolean(this.config?.autoAdvance, true));

        return {
            isRunning: false,
            activeIndex: -1,
            startedAt: 0,
            cueStartedAt: 0,
            elapsed: 0,
            tempo: this.clampTempo(baseTempo),
            beatsPerBar: this.clampBeatsPerBar(baseBeats),
            autoAdvance,
            frameHandle: null,
            frameType: null
        };
    }

    clampTempo(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return this.config?.tempo || 120;
        }
        return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(numeric)));
    }

    clampBeatsPerBar(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return this.config?.beatsPerBar || 4;
        }
        return Math.min(MAX_BEATS_PER_BAR, Math.max(MIN_BEATS_PER_BAR, Math.round(numeric)));
    }

    attachKeyboardShortcuts() {
        if (typeof window === 'undefined') {
            return;
        }
        this.detachKeyboardShortcuts();
        this.keydownHandler = (event) => this.handleKeyDown(event);
        window.addEventListener('keydown', this.keydownHandler);
    }

    detachKeyboardShortcuts() {
        if (typeof window === 'undefined' || !this.keydownHandler) {
            return;
        }
        window.removeEventListener('keydown', this.keydownHandler);
        this.keydownHandler = null;
    }

    isEditableTarget(target) {
        if (!target) return false;
        if (target.isContentEditable) return true;
        const tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON';
    }

    handleKeyDown(event) {
        if (!this.runState?.isRunning) {
            return;
        }
        if (this.isEditableTarget(event.target)) {
            return;
        }
        if (event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            this.advanceCue(1);
        } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
            event.preventDefault();
            this.advanceCue(1);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            this.advanceCue(-1);
        } else if (event.key === 'Escape') {
            this.stopRun();
        }
    }

    getNow() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    scheduleTick() {
        this.cancelTick();
        if (!this.runState.isRunning) {
            return;
        }
        const step = () => {
            if (!this.runState.isRunning) {
                return;
            }
            const now = this.getNow();
            if (this.runState.cueStartedAt) {
                this.runState.elapsed = now - this.runState.cueStartedAt;
            } else {
                this.runState.elapsed = 0;
            }
            this.updateTimerDisplay();
            this.checkAutoAdvance(now);
            if (this.runState.frameType === 'raf' && typeof requestAnimationFrame === 'function') {
                this.runState.frameHandle = requestAnimationFrame(step);
            } else if (this.runState.frameType === 'timeout') {
                this.runState.frameHandle = setTimeout(step, 250);
            }
        };

        if (typeof requestAnimationFrame === 'function') {
            this.runState.frameHandle = requestAnimationFrame(step);
            this.runState.frameType = 'raf';
        } else {
            this.runState.frameHandle = setTimeout(step, 250);
            this.runState.frameType = 'timeout';
        }
    }

    cancelTick() {
        if (!this.runState.frameHandle) {
            return;
        }
        if (this.runState.frameType === 'raf' && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this.runState.frameHandle);
        } else {
            clearTimeout(this.runState.frameHandle);
        }
        this.runState.frameHandle = null;
        this.runState.frameType = null;
    }

    updateTimerDisplay() {
        if (!this.timerEl) {
            return;
        }
        if (!this.runState.isRunning) {
            this.timerEl.textContent = '00:00';
            this.timerEl.classList.remove('show-planner__timer--warning');
            return;
        }
        const ms = Math.max(0, this.runState.elapsed || 0);
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        this.timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        const cue = this.cues[this.runState.activeIndex];
        const duration = this.calculateCueDurationMs(cue);
        if (duration && this.runState.autoAdvance) {
            const remaining = duration - ms;
            if (remaining <= 2000) {
                this.timerEl.classList.add('show-planner__timer--warning');
            } else {
                this.timerEl.classList.remove('show-planner__timer--warning');
            }
        } else {
            this.timerEl.classList.remove('show-planner__timer--warning');
        }
    }

    calculateCueDurationMs(cue) {
        if (!cue || !Number.isFinite(cue.timing) || cue.timing <= 0) {
            return null;
        }
        const beats = cue.timing * this.runState.beatsPerBar;
        if (!Number.isFinite(beats) || beats <= 0) {
            return null;
        }
        const secondsPerBeat = 60 / this.runState.tempo;
        return beats * secondsPerBeat * 1000;
    }

    checkAutoAdvance(now) {
        if (!this.runState.isRunning || !this.runState.autoAdvance) {
            return;
        }
        const cue = this.cues[this.runState.activeIndex];
        const duration = this.calculateCueDurationMs(cue);
        if (!duration || !this.runState.cueStartedAt) {
            return;
        }
        if (now - this.runState.cueStartedAt >= duration) {
            this.advanceCue(1);
        }
    }

    syncActiveIndex() {
        if (!this.activeCueId) {
            this.runState.activeIndex = -1;
            return;
        }
        const index = this.cues.findIndex(cue => cue.id === this.activeCueId);
        this.runState.activeIndex = index;
    }

    updateRunControlsUI() {
        if (!this.runControls) {
            return;
        }
        const { start, stop, next, prev, autoAdvance, tempo, beatsPerBar } = this.runControls;
        const hasCues = this.cues.length > 0;
        const running = this.runState.isRunning;
        if (start) {
            start.disabled = !hasCues || running;
            const hasActiveCue = this.runState.activeIndex >= 0 && this.cues[this.runState.activeIndex];
            start.textContent = running ? 'Running…' : hasActiveCue ? 'Resume run' : 'Start run';
        }
        if (stop) {
            stop.disabled = !running;
        }
        if (next) {
            const canAdvance = running && this.runState.activeIndex < this.cues.length - 1;
            next.disabled = !canAdvance;
        }
        if (prev) {
            const canRewind = running && this.runState.activeIndex > 0;
            prev.disabled = !canRewind;
        }
        if (autoAdvance) {
            autoAdvance.checked = this.runState.autoAdvance;
        }
        if (tempo) {
            tempo.value = this.runState.tempo;
        }
        if (beatsPerBar) {
            beatsPerBar.value = this.runState.beatsPerBar;
        }
    }

    updateTempo(value, { silent = false } = {}) {
        const tempo = this.clampTempo(value);
        if (tempo === this.runState.tempo) {
            return;
        }
        this.runState.tempo = tempo;
        this.updateRunControlsUI();
        if (this.runState.isRunning) {
            this.runState.cueStartedAt = this.getNow();
            this.runState.elapsed = 0;
        }
        this.updateTimerDisplay();
        if (!silent) {
            this.persistSoon();
        }
    }

    updateBeatsPerBar(value, { silent = false } = {}) {
        const beats = this.clampBeatsPerBar(value);
        if (beats === this.runState.beatsPerBar) {
            return;
        }
        this.runState.beatsPerBar = beats;
        this.updateRunControlsUI();
        this.updateTimerDisplay();
        if (!silent) {
            this.persistSoon();
        }
    }

    updateAutoAdvance(enabled) {
        const value = toBoolean(enabled, this.runState.autoAdvance);
        if (value === this.runState.autoAdvance) {
            return;
        }
        this.runState.autoAdvance = value;
        this.updateRunControlsUI();
        this.updateTimerDisplay();
        this.persistSoon();
    }

    startRun() {
        if (!this.cues.length) {
            return;
        }
        this.syncActiveIndex();
        let startIndex = this.runState.activeIndex;
        if (startIndex < 0 || startIndex >= this.cues.length) {
            startIndex = 0;
        }
        const cue = this.cues[startIndex];
        if (!cue) {
            return;
        }
        const now = this.getNow();
        this.runState.isRunning = true;
        this.runState.startedAt = now;
        this.runState.cueStartedAt = now;
        this.runState.elapsed = 0;
        this.triggerCue(cue, { fromRun: true });
        this.updateRunControlsUI();
        this.persistSoon();
        if (this.hub) {
            this.hub.emit('showplanner-run-started', { cue: clone(cue), index: this.runState.activeIndex });
        }
    }

    stopRun({ clearActive = false, silent = false } = {}) {
        const wasRunning = this.runState.isRunning;
        this.runState.isRunning = false;
        this.cancelTick();
        this.runState.elapsed = 0;
        this.runState.cueStartedAt = 0;
        if (clearActive) {
            this.activeCueId = null;
            this.runState.activeIndex = -1;
        } else {
            this.syncActiveIndex();
        }
        this.updateRunControlsUI();
        this.updateTimerDisplay();
        if (wasRunning) {
            this.renderCueList();
            if (!silent && this.hub) {
                this.hub.emit('showplanner-run-stopped', {});
            }
            this.persistSoon();
        }
    }

    advanceCue(step = 1) {
        if (!this.cues.length) {
            return;
        }
        this.syncActiveIndex();
        const current = this.runState.activeIndex >= 0 ? this.runState.activeIndex : 0;
        let nextIndex = current + step;
        if (nextIndex < 0) {
            nextIndex = 0;
        }
        if (nextIndex >= this.cues.length) {
            this.stopRun();
            return;
        }
        if (nextIndex === current) {
            return;
        }
        const cue = this.cues[nextIndex];
        if (!cue) {
            this.stopRun();
            return;
        }
        if (this.runState.isRunning) {
            this.triggerCue(cue, { fromRun: true });
        } else {
            this.triggerCue(cue);
        }
    }

    attachHubListeners() {
        if (!this.hub) return;
        this.unsubscribe.push(this.hub.on('preset-saved', ({ preset }) => {
            if (!preset) return;
            this.refreshPresetOptions();
            this.markActiveCueByPreset(preset.id);
        }));
        this.unsubscribe.push(this.hub.on('preset-deleted', ({ id }) => {
            this.handlePresetRemoval(id);
            this.refreshPresetOptions();
        }));
        this.unsubscribe.push(this.hub.on('preset-applied', ({ preset }) => {
            if (!preset) return;
            this.markActiveCueByPreset(preset.id);
        }));
    }

    render() {
        if (!this.container) return;
        this.wrapper = createElement('article', 'performance-block show-planner');
        this.container.appendChild(this.wrapper);

        const header = createElement('header', 'performance-block__header');
        header.innerHTML = `
            <div>
                <h3 class="performance-block__title">Show Planner</h3>
                <p class="performance-block__subtitle">Build cue stacks from saved presets with notes and timing guidance for the booth.</p>
            </div>
        `;
        this.wrapper.appendChild(header);

        const runControls = this.renderRunControls();
        if (runControls) {
            this.wrapper.appendChild(runControls);
        }

        const form = createElement('form', 'show-planner__form');
        form.innerHTML = `
            <label class="show-planner__field">
                <span>Preset</span>
                <select name="preset"></select>
            </label>
            <label class="show-planner__field">
                <span>Cue label</span>
                <input type="text" name="label" placeholder="Drop name or section cue">
            </label>
            <label class="show-planner__field">
                <span>Timing (bars)</span>
                <input type="number" name="timing" min="0" step="0.5" placeholder="e.g. 16">
            </label>
            <label class="show-planner__field show-planner__field--notes">
                <span>Notes</span>
                <textarea name="notes" rows="2" placeholder="Dynamics, lighting cues, collaborator prompts..."></textarea>
            </label>
            <div class="show-planner__actions">
                <button type="submit">Add cue</button>
                <button type="button" data-action="clear">Clear all</button>
            </div>
        `;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleAddCue(new FormData(form));
        });
        form.querySelector('[data-action="clear"]').addEventListener('click', () => this.clearAllCues());

        this.wrapper.appendChild(form);
        this.form = form;

        const listHeader = createElement('div', 'show-planner__list-header');
        listHeader.innerHTML = `
            <h4>Show cues</h4>
            <span class="show-planner__list-count"></span>
        `;
        this.wrapper.appendChild(listHeader);
        this.listCountEl = listHeader.querySelector('.show-planner__list-count');

        const list = createElement('ul', 'show-planner__list');
        this.wrapper.appendChild(list);
        this.listEl = list;

        this.refreshPresetOptions();
    }

    renderRunControls() {
        const section = createElement('section', 'show-planner__run');
        section.setAttribute('aria-label', 'Show run controls');

        const buttonRow = createElement('div', 'show-planner__run-controls');
        const startButton = createElement('button', 'show-planner__run-button', 'Start run');
        startButton.type = 'button';
        startButton.addEventListener('click', () => this.startRun());

        const prevButton = createElement('button', 'show-planner__run-button', 'Prev');
        prevButton.type = 'button';
        prevButton.addEventListener('click', () => this.advanceCue(-1));

        const nextButton = createElement('button', 'show-planner__run-button', 'Next');
        nextButton.type = 'button';
        nextButton.addEventListener('click', () => this.advanceCue(1));

        const stopButton = createElement('button', 'show-planner__run-button show-planner__run-button--stop', 'Stop');
        stopButton.type = 'button';
        stopButton.addEventListener('click', () => this.stopRun());

        buttonRow.appendChild(startButton);
        buttonRow.appendChild(prevButton);
        buttonRow.appendChild(nextButton);
        buttonRow.appendChild(stopButton);

        const timer = createElement('span', 'show-planner__timer', '00:00');
        timer.setAttribute('aria-live', 'polite');
        timer.setAttribute('role', 'status');
        buttonRow.appendChild(timer);

        section.appendChild(buttonRow);

        const settingsRow = createElement('div', 'show-planner__run-settings');

        const tempoLabel = createElement('label', 'show-planner__run-setting');
        tempoLabel.innerHTML = '<span>Tempo (BPM)</span>';
        const tempoInput = document.createElement('input');
        tempoInput.type = 'number';
        tempoInput.min = MIN_TEMPO;
        tempoInput.max = MAX_TEMPO;
        tempoInput.step = 1;
        tempoInput.addEventListener('change', (event) => this.updateTempo(event.target.value));
        tempoInput.addEventListener('input', (event) => this.updateTempo(event.target.value, { silent: true }));
        settingsRow.appendChild(tempoLabel);
        tempoLabel.appendChild(tempoInput);

        const beatsLabel = createElement('label', 'show-planner__run-setting');
        beatsLabel.innerHTML = '<span>Beats per bar</span>';
        const beatsInput = document.createElement('input');
        beatsInput.type = 'number';
        beatsInput.min = MIN_BEATS_PER_BAR;
        beatsInput.max = MAX_BEATS_PER_BAR;
        beatsInput.step = 1;
        beatsInput.addEventListener('change', (event) => this.updateBeatsPerBar(event.target.value));
        beatsInput.addEventListener('input', (event) => this.updateBeatsPerBar(event.target.value, { silent: true }));
        settingsRow.appendChild(beatsLabel);
        beatsLabel.appendChild(beatsInput);

        const autoLabel = createElement('label', 'toggle-pill show-planner__run-toggle');
        const autoInput = document.createElement('input');
        autoInput.type = 'checkbox';
        autoInput.addEventListener('change', (event) => this.updateAutoAdvance(event.target.checked));
        autoLabel.appendChild(autoInput);
        const autoText = document.createElement('span');
        autoText.textContent = 'Auto advance using cue timing';
        autoLabel.appendChild(autoText);
        settingsRow.appendChild(autoLabel);

        section.appendChild(settingsRow);

        this.timerEl = timer;
        this.runControls = {
            start: startButton,
            prev: prevButton,
            next: nextButton,
            stop: stopButton,
            tempo: tempoInput,
            beatsPerBar: beatsInput,
            autoAdvance: autoInput
        };

        this.updateRunControlsUI();
        this.updateTimerDisplay();

        return section;
    }

    refreshPresetOptions() {
        if (!this.form) return;
        const select = this.form.querySelector('select[name="preset"]');
        if (!select) return;
        const previousValue = select.value;
        const options = this.getPresetOptions();
        select.innerHTML = options.map(option => `<option value="${option.id}">${option.label}</option>`).join('');
        if (!options.length) {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Save a preset first';
            select.appendChild(placeholder);
            select.disabled = true;
        } else {
            select.disabled = false;
            const match = options.find(option => option.id === previousValue);
            select.value = match ? match.id : options[0].id;
        }
    }

    getPresetOptions() {
        const presets = Array.isArray(this.presetManager?.presets)
            ? this.presetManager.presets
            : [];
        return presets.map(preset => ({
            id: preset.id,
            label: preset.name || preset.id
        }));
    }

    handleAddCue(formData) {
        const presetId = formData.get('preset');
        if (!presetId) {
            this.form.querySelector('select[name="preset"]').focus();
            return;
        }
        const preset = this.presetManager?.findPresetById?.(presetId)
            || this.presetManager?.presets?.find?.(item => item.id === presetId);
        if (!preset) return;

        const cue = {
            id: `cue-${Date.now()}`,
            presetId,
            presetName: preset.name,
            label: (formData.get('label') || '').trim() || preset.name,
            timing: this.parseTiming(formData.get('timing')),
            notes: (formData.get('notes') || '').trim()
        };

        this.cues.push(cue);
        this.persist();
        this.renderCueList();
        this.form.reset();
        if (this.hub) {
            this.hub.emit('showplanner-cue-added', { cue: clone(cue) });
        }
    }

    parseTiming(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric < 0) {
            return null;
        }
        return Math.round(numeric * 2) / 2;
    }

    renderCueList() {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';

        this.syncActiveIndex();

        if (!this.cues.length) {
            const empty = createElement('li', 'show-planner__empty', 'No cues yet. Save presets and stack your setlist.');
            this.listEl.appendChild(empty);
        } else {
            this.cues.forEach((cue, index) => {
                this.listEl.appendChild(this.renderCueItem(cue, index));
            });
        }

        if (this.listCountEl) {
            const count = this.cues.length;
            this.listCountEl.textContent = count ? `${count} cue${count === 1 ? '' : 's'}` : '';
        }

        this.updateRunControlsUI();
        this.updateTimerDisplay();
    }

    renderCueItem(cue, index) {
        const item = createElement('li', 'show-planner__item');
        item.dataset.cueId = cue.id;
        if (cue.id === this.activeCueId) {
            item.classList.add('show-planner__item--active');
        }
        if (this.runState.isRunning && index === this.runState.activeIndex + 1) {
            item.classList.add('show-planner__item--up-next');
        }

        const details = createElement('div', 'show-planner__item-details');
        const labelParts = [this.escapeHtml(cue.label)];
        if (cue.timing) {
            labelParts.push(this.escapeHtml(`${cue.timing} bars`));
        }
        const statusChips = [];
        if (cue.id === this.activeCueId) {
            const isActive = this.runState.isRunning;
            const label = isActive ? 'Now' : 'Loaded';
            const chipClass = isActive ? 'show-planner__chip show-planner__chip--active' : 'show-planner__chip';
            statusChips.push(`<span class="${chipClass}">${label}</span>`);
        } else if (this.runState.isRunning && index === this.runState.activeIndex + 1) {
            statusChips.push('<span class="show-planner__chip">Up next</span>');
        }
        const notesMarkup = cue.notes ? `<p>${this.escapeHtml(cue.notes)}</p>` : '';
        const statusMarkup = statusChips.length ? `<div class="show-planner__item-status">${statusChips.join('')}</div>` : '';
        details.innerHTML = `
            <strong>${labelParts.join(' • ')}</strong>
            <span>${this.escapeHtml(cue.presetName || cue.presetId)}</span>
            ${statusMarkup}
            ${notesMarkup}
        `;
        item.appendChild(details);

        const actions = createElement('div', 'show-planner__item-actions');
        actions.innerHTML = `
            <button type="button" data-action="go">Go</button>
            <button type="button" data-action="up" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" data-action="down" ${index === this.cues.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" data-action="delete">✕</button>
        `;
        item.appendChild(actions);

        actions.querySelector('[data-action="go"]').addEventListener('click', () => this.triggerCue(cue));
        actions.querySelector('[data-action="delete"]').addEventListener('click', () => this.deleteCue(cue.id));
        actions.querySelector('[data-action="up"]').addEventListener('click', () => this.moveCue(cue.id, -1));
        actions.querySelector('[data-action="down"]').addEventListener('click', () => this.moveCue(cue.id, 1));

        return item;
    }

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    triggerCue(cue, options = {}) {
        if (!cue) return;
        const { fromRun = false } = options;
        const preset = this.presetManager?.findPresetById?.(cue.presetId)
            || this.presetManager?.presets?.find?.(item => item.id === cue.presetId);
        if (!preset) {
            this.handlePresetRemoval(cue.presetId);
            return;
        }

        if (typeof this.presetManager?.applyPreset === 'function') {
            this.presetManager.applyPreset(preset);
        }
        this.activeCueId = cue.id;
        this.syncActiveIndex();
        if (this.runState.isRunning) {
            this.runState.cueStartedAt = this.getNow();
            this.runState.elapsed = 0;
            this.scheduleTick();
        } else {
            this.cancelTick();
        }
        this.renderCueList();
        this.persistSoon();
        if (this.hub) {
            this.hub.emit('showplanner-cue-triggered', {
                cue: clone(cue),
                preset: clone(preset)
            });
            if (fromRun) {
                this.hub.emit('showplanner-run-advanced', {
                    cue: clone(cue),
                    preset: clone(preset),
                    index: this.runState.activeIndex
                });
            }
        }
        if (this.hub) {
            // Legacy event to keep hub consumers aware of cue focus changes
            this.hub.emit('showplanner-cue-focus', { cue: clone(cue) });
        }
    }

    deleteCue(id) {
        const index = this.cues.findIndex(cue => cue.id === id);
        if (index === -1) return;
        const next = this.cues.filter(cue => cue.id !== id);
        const removedActive = this.activeCueId === id;
        this.cues = next;
        const hasCues = this.cues.length > 0;
        if (removedActive) {
            const replacement = hasCues ? this.cues[Math.min(index, this.cues.length - 1)] : null;
            this.activeCueId = replacement ? replacement.id : null;
        }
        const wasRunning = this.runState.isRunning;
        this.syncActiveIndex();

        if (wasRunning) {
            if (!hasCues) {
                this.stopRun({ clearActive: true });
            } else if (removedActive) {
                const cue = this.activeCueId
                    ? this.cues.find(item => item.id === this.activeCueId)
                    : this.cues[0];
                if (cue) {
                    this.triggerCue(cue, { fromRun: true });
                }
            } else {
                this.renderCueList();
            }
        } else {
            this.renderCueList();
        }

        this.persist();

        if (this.hub) {
            this.hub.emit('showplanner-cue-removed', { id });
        }

        this.refreshPresetOptions();
    }

    moveCue(id, offset) {
        const index = this.cues.findIndex(cue => cue.id === id);
        if (index === -1) return;
        const targetIndex = index + offset;
        if (targetIndex < 0 || targetIndex >= this.cues.length) return;
        const [cue] = this.cues.splice(index, 1);
        this.cues.splice(targetIndex, 0, cue);
        this.syncActiveIndex();
        this.persist();
        this.renderCueList();
    }

    clearAllCues() {
        if (!this.cues.length) return;
        this.cues = [];
        this.activeCueId = null;
        this.stopRun({ clearActive: true });
        this.persist();
        this.renderCueList();
        if (this.hub) {
            this.hub.emit('showplanner-cleared');
        }
        this.refreshPresetOptions();
    }

    markActiveCueByPreset(presetId) {
        if (!presetId) return;
        const cue = this.cues.find(item => item.presetId === presetId);
        if (cue) {
            this.activeCueId = cue.id;
            this.syncActiveIndex();
            if (this.runState.isRunning) {
                this.runState.cueStartedAt = this.getNow();
                this.runState.elapsed = 0;
                this.scheduleTick();
            }
            this.renderCueList();
            this.persistSoon();
        }
    }

    handlePresetRemoval(presetId) {
        if (!presetId) return;
        const before = this.cues.length;
        this.cues = this.cues.filter(cue => cue.presetId !== presetId);
        if (before !== this.cues.length) {
            const hasCues = this.cues.length > 0;
            const activeStillExists = this.activeCueId && this.cues.some(cue => cue.id === this.activeCueId);
            if (!activeStillExists) {
                this.activeCueId = hasCues ? this.cues[0].id : null;
            }
            const wasRunning = this.runState.isRunning;
            this.syncActiveIndex();

            if (wasRunning) {
                if (!hasCues) {
                    this.stopRun({ clearActive: true });
                } else if (!activeStillExists) {
                    const cue = this.activeCueId
                        ? this.cues.find(item => item.id === this.activeCueId)
                        : this.cues[0];
                    if (cue) {
                        this.triggerCue(cue, { fromRun: true });
                    }
                } else {
                    this.renderCueList();
                }
            } else {
                this.renderCueList();
            }
            this.persist();
        }
        this.refreshPresetOptions();
    }

    applyState(state = {}) {
        if (!state || typeof state !== 'object') return;

        let shouldRender = false;

        if (Array.isArray(state.cues)) {
            this.cues = state.cues.map(sanitizeCue).filter(Boolean);
            shouldRender = true;
        }

        if (Object.prototype.hasOwnProperty.call(state, 'activeCueId')) {
            this.activeCueId = typeof state.activeCueId === 'string' ? state.activeCueId : null;
            shouldRender = true;
        }

        if (state.run && typeof state.run === 'object') {
            if (Object.prototype.hasOwnProperty.call(state.run, 'tempo')) {
                this.runState.tempo = this.clampTempo(state.run.tempo);
            }
            if (Object.prototype.hasOwnProperty.call(state.run, 'beatsPerBar')) {
                this.runState.beatsPerBar = this.clampBeatsPerBar(state.run.beatsPerBar);
            }
            if (Object.prototype.hasOwnProperty.call(state.run, 'autoAdvance')) {
                this.runState.autoAdvance = toBoolean(state.run.autoAdvance, this.runState.autoAdvance);
            }
        }

        this.syncActiveIndex();

        if (shouldRender) {
            this.renderCueList();
        } else {
            this.updateRunControlsUI();
            this.updateTimerDisplay();
        }

        this.persist();
        this.refreshPresetOptions();
    }

    getState() {
        return {
            cues: this.cues.map(cue => ({ ...cue })),
            activeCueId: this.activeCueId,
            run: {
                tempo: this.runState.tempo,
                beatsPerBar: this.runState.beatsPerBar,
                autoAdvance: this.runState.autoAdvance
            }
        };
    }

    destroy() {
        this.unsubscribe.forEach(unsub => {
            try {
                unsub();
            } catch (error) {
                // ignore
            }
        });
        this.unsubscribe = [];
        this.cancelTick();
        this.detachKeyboardShortcuts();
        if (this.persistDebounce) {
            clearTimeout(this.persistDebounce);
            this.persistDebounce = null;
        }
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
    }
}
