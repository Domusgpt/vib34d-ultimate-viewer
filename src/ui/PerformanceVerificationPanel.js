const DEFAULT_CHECKS = [
    { id: 'touchpads', label: 'Touch pad mappings', description: 'Ensure pads are mapped and ready.' },
    { id: 'audio', label: 'Audio reactivity', description: 'Verify audio reactivity is configured.' },
    { id: 'hardware', label: 'Hardware bridge', description: 'Confirm MIDI devices or mappings exist.' },
    { id: 'network', label: 'Network bridge', description: 'Check OSC bridge connectivity preferences.' },
    { id: 'gestures', label: 'Gesture recorder', description: 'Make sure gesture takes are stored.' },
    { id: 'presets', label: 'Preset library', description: 'Validate presets and playlists are available.' },
    { id: 'showPlanner', label: 'Show planner', description: 'Ensure cue stacks are populated.' },
    { id: 'theme', label: 'Theme state', description: 'Confirm an accent theme is active.' },
    { id: 'layout', label: 'Layout profile', description: 'Verify responsive layout preferences.' }
];

const STATUS_ICONS = {
    pass: '✓',
    warn: '⚠',
    fail: '✕'
};

const STATUS_LABELS = {
    pass: 'Pass',
    warn: 'Check',
    fail: 'Action'
};

const STATUS_CLASSES = {
    pass: 'is-pass',
    warn: 'is-warn',
    fail: 'is-fail'
};

const DEV_TRACK_STATUSES = [
    { id: 'todo', label: 'To do', icon: '○' },
    { id: 'progress', label: 'In progress', icon: '◐' },
    { id: 'done', label: 'Done', icon: '●' }
];

const DEFAULT_CONFIG = {
    storageKey: 'vib34d-performance-verification',
    defaultRestMinutes: 25,
    restDurations: [10, 15, 20, 25, 30, 45],
    defaultFocusMinutes: 50,
    focusDurations: [25, 35, 45, 50, 60, 75],
    autoRestOnFocusComplete: true,
    checks: DEFAULT_CHECKS,
    devTrack: {
        defaultStatus: 'todo',
        maxTasks: 12
    }
};

function clampDuration(minutes, durations, fallback) {
    if (!Array.isArray(durations) || durations.length === 0) {
        return fallback;
    }
    if (durations.includes(minutes)) {
        return minutes;
    }
    const sorted = durations.slice().sort((a, b) => a - b);
    return sorted.reduce((closest, current) => {
        if (closest === null) return current;
        return Math.abs(current - minutes) < Math.abs(closest - minutes) ? current : closest;
    }, null);
}

function formatDuration(ms) {
    if (!ms || ms <= 0) {
        return 'Ready for a break';
    }
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) {
        return `${seconds}s remaining`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s remaining`;
}

function formatFocusDuration(ms) {
    if (!ms || ms <= 0) {
        return 'Focus idle';
    }
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) {
        return `${seconds}s left`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s left`;
}

function now() {
    return Date.now();
}

function createTaskId() {
    return `task-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export class PerformanceVerificationPanel {
    constructor({ container = null, hub = null, config = {}, providers = {}, onStatusChange = null } = {}) {
        this.container = container;
        this.hub = hub;
        this.config = { ...DEFAULT_CONFIG, ...(config || {}) };
        this.providers = providers || {};
        this.onStatusChange = typeof onStatusChange === 'function' ? onStatusChange : null;

        this.root = null;
        this.checkListEl = null;
        this.runButton = null;
        this.restSelect = null;
        this.restButton = null;
        this.restStopButton = null;
        this.restStatusEl = null;
        this.devTrackEl = null;
        this.lastRunEl = null;
        this.activityLogEl = null;

        this.state = {
            lastRun: null,
            results: [],
            rest: {
                minutes: this.config.defaultRestMinutes,
                deadline: null
            },
            focus: {
                minutes: this.config.defaultFocusMinutes,
                deadline: null,
                startedAt: null
            },
            devTrackNotes: '',
            devTrackTasks: []
        };
        this.restInterval = null;
        this.focusInterval = null;
        this.subscriptions = [];

        this.handlers = {
            runChecks: () => this.runChecks(),
            startRest: () => this.startRestTimer(),
            stopRest: () => this.clearRestTimer(true),
            restChange: () => this.handleRestDurationChange(),
            startFocus: () => this.startFocusSession(),
            stopFocus: () => this.clearFocusSession(true),
            focusChange: () => this.handleFocusDurationChange(),
            devTrack: () => this.handleDevTrackChange(),
            addDevTask: event => this.handleAddDevTask(event),
            devTaskInputKeydown: event => this.handleDevTaskInputKeydown(event),
            devTaskListClick: event => this.handleDevTaskListClick(event),
            devTaskListInput: event => this.handleDevTaskListInput(event),
            devTaskListChange: event => this.handleDevTaskListChange(event)
        };

        this.mount();
        this.loadState();
        this.renderChecks();
        this.bindEvents();
        this.resumeRestTimerIfNeeded();
        this.resumeFocusSessionIfNeeded();
        this.renderDevTrack();
        this.syncRestControls();
        this.syncFocusControls();
        this.updateRestStatus();
        this.updateFocusStatus();
        this.updateCheckDisplay();
    }

    mount() {
        if (!this.container || typeof document === 'undefined') {
            return;
        }
        this.container.classList.add('performance-block', 'performance-verification');
        this.container.innerHTML = `
            <header class="performance-block__header performance-verification__header">
                <div>
                    <h3 class="performance-block__title">Verification &amp; Rest</h3>
                    <p class="performance-block__subtitle">Run live diagnostics, balance focus cycles, and track the development track for upcoming improvements.</p>
                </div>
                <div class="performance-verification__last-run" data-role="last-run">Never run</div>
            </header>
            <section class="performance-verification__section">
                <div class="performance-verification__actions">
                    <button type="button" class="performance-button" data-action="run-checks">Run diagnostics</button>
                    <div class="performance-verification__timers">
                        <div class="performance-verification__timer" data-timer="focus">
                            <h5>Focus cadence</h5>
                            <div class="performance-verification__timer-controls">
                                <label>
                                    <span>Session length</span>
                                    <select data-role="focus-duration"></select>
                                </label>
                                <div class="performance-verification__timer-buttons">
                                    <button type="button" class="performance-button performance-button--ghost" data-action="start-focus">Start focus</button>
                                    <button type="button" class="performance-button performance-button--ghost" data-action="stop-focus" disabled>End</button>
                                </div>
                            </div>
                            <div class="performance-verification__timer-status" data-role="focus-status">Focus idle</div>
                        </div>
                        <div class="performance-verification__timer" data-timer="rest">
                            <h5>Rest cadence</h5>
                            <div class="performance-verification__timer-controls">
                                <label>
                                    <span>Rest timer</span>
                                    <select data-role="rest-duration"></select>
                                </label>
                                <div class="performance-verification__timer-buttons">
                                    <button type="button" class="performance-button performance-button--ghost" data-action="start-rest">Start reminder</button>
                                    <button type="button" class="performance-button performance-button--ghost" data-action="stop-rest" disabled>Clear</button>
                                </div>
                            </div>
                            <div class="performance-verification__timer-status" data-role="rest-status">Ready for a break</div>
                        </div>
                    </div>
                </div>
            </section>
            <section class="performance-verification__section">
                <h4>Readiness checklist</h4>
                <ul class="performance-verification__checks" data-role="check-list"></ul>
            </section>
            <section class="performance-verification__section">
                <h4>Activity log</h4>
                <ul class="performance-verification__activity" data-role="activity"></ul>
            </section>
            <section class="performance-verification__section">
                <h4>Development track</h4>
                <div class="performance-verification__devtrack" data-role="devtrack-container">
                    <div class="performance-verification__devtrack-add">
                        <input type="text" data-role="devtrack-input" placeholder="Add follow-up task" aria-label="Add development task" />
                        <button type="button" class="performance-button performance-button--ghost" data-action="add-dev-task">Add</button>
                    </div>
                    <ul class="performance-verification__devtrack-list" data-role="devtrack-list"></ul>
                    <textarea class="performance-verification__notes" data-role="devtrack" placeholder="Document context, QA findings, and longer-term notes."></textarea>
                </div>
            </section>
        `;

        this.root = this.container;
        this.checkListEl = this.root.querySelector('[data-role="check-list"]');
        this.runButton = this.root.querySelector('[data-action="run-checks"]');
        this.focusSelect = this.root.querySelector('[data-role="focus-duration"]');
        this.focusButton = this.root.querySelector('[data-action="start-focus"]');
        this.focusStopButton = this.root.querySelector('[data-action="stop-focus"]');
        this.focusStatusEl = this.root.querySelector('[data-role="focus-status"]');
        this.restSelect = this.root.querySelector('[data-role="rest-duration"]');
        this.restButton = this.root.querySelector('[data-action="start-rest"]');
        this.restStopButton = this.root.querySelector('[data-action="stop-rest"]');
        this.restStatusEl = this.root.querySelector('[data-role="rest-status"]');
        this.devTrackEl = this.root.querySelector('[data-role="devtrack"]');
        this.devTrackListEl = this.root.querySelector('[data-role="devtrack-list"]');
        this.devTrackInputEl = this.root.querySelector('[data-role="devtrack-input"]');
        this.lastRunEl = this.root.querySelector('[data-role="last-run"]');
        this.activityLogEl = this.root.querySelector('[data-role="activity"]');

        this.populateRestOptions();
        this.populateFocusOptions();
    }

    bindEvents() {
        if (this.runButton) {
            this.runButton.addEventListener('click', this.handlers.runChecks);
        }
        if (this.focusButton) {
            this.focusButton.addEventListener('click', this.handlers.startFocus);
        }
        if (this.focusStopButton) {
            this.focusStopButton.addEventListener('click', this.handlers.stopFocus);
        }
        if (this.focusSelect) {
            this.focusSelect.addEventListener('change', this.handlers.focusChange);
        }
        if (this.restButton) {
            this.restButton.addEventListener('click', this.handlers.startRest);
        }
        if (this.restStopButton) {
            this.restStopButton.addEventListener('click', this.handlers.stopRest);
        }
        if (this.restSelect) {
            this.restSelect.addEventListener('change', this.handlers.restChange);
        }
        if (this.devTrackEl) {
            this.devTrackEl.addEventListener('input', this.handlers.devTrack);
        }
        if (this.devTrackInputEl) {
            this.devTrackInputEl.addEventListener('keydown', this.handlers.devTaskInputKeydown);
        }
        if (this.devTrackListEl) {
            this.devTrackListEl.addEventListener('click', this.handlers.devTaskListClick);
            this.devTrackListEl.addEventListener('input', this.handlers.devTaskListInput);
            this.devTrackListEl.addEventListener('change', this.handlers.devTaskListChange);
        }

        if (this.hub?.on) {
            const watchedEvents = [
                'touchpad:update',
                'audio:flourish',
                'preset:loaded',
                'preset:playlist-start',
                'show:cue-trigger',
                'hardware:midi-value',
                'gestures:playback-event',
                'network:bridge-status'
            ];
            watchedEvents.forEach(eventName => {
                const unsubscribe = this.hub.on(eventName, payload => {
                    this.registerActivity(eventName, payload);
                });
                this.subscriptions.push(unsubscribe);
            });
        }
    }

    populateRestOptions() {
        if (!this.restSelect) return;
        const durations = Array.isArray(this.config.restDurations) ? this.config.restDurations : DEFAULT_CONFIG.restDurations;
        this.restSelect.innerHTML = '';
        durations.forEach(minutes => {
            const option = document.createElement('option');
            option.value = String(minutes);
            option.textContent = `${minutes} minute${minutes === 1 ? '' : 's'}`;
            this.restSelect.appendChild(option);
        });
    }

    populateFocusOptions() {
        if (!this.focusSelect) return;
        const durations = Array.isArray(this.config.focusDurations) && this.config.focusDurations.length
            ? this.config.focusDurations
            : DEFAULT_CONFIG.focusDurations;
        this.focusSelect.innerHTML = '';
        durations.forEach(minutes => {
            const option = document.createElement('option');
            option.value = String(minutes);
            option.textContent = `${minutes} minute${minutes === 1 ? '' : 's'}`;
            this.focusSelect.appendChild(option);
        });
    }

    renderChecks() {
        if (!this.checkListEl) return;
        const checks = Array.isArray(this.config.checks) && this.config.checks.length
            ? this.config.checks
            : DEFAULT_CHECKS;
        this.checkListEl.innerHTML = '';
        checks.forEach(check => {
            const item = document.createElement('li');
            item.className = 'performance-verification__check';
            item.dataset.checkId = check.id;
            item.innerHTML = `
                <span class="performance-verification__check-icon" aria-hidden="true"></span>
                <div class="performance-verification__check-body">
                    <strong>${check.label}</strong>
                    <p>${check.description}</p>
                </div>
                <span class="performance-verification__check-status">Pending</span>
            `;
            this.checkListEl.appendChild(item);
        });
    }

    renderDevTrack() {
        if (!this.devTrackEl) return;
        this.devTrackEl.value = this.state.devTrackNotes || '';
        this.updateDevTrackPlaceholder();
        this.renderDevTrackTasks();
    }

    renderDevTrackTasks() {
        if (!this.devTrackListEl) return;
        const tasks = Array.isArray(this.state.devTrackTasks) ? this.state.devTrackTasks : [];
        this.devTrackListEl.innerHTML = '';
        if (!tasks.length) {
            const empty = document.createElement('li');
            empty.className = 'performance-verification__devtrack-empty';
            empty.textContent = 'No tasks yet — capture the next improvements so the team stays aligned.';
            this.devTrackListEl.appendChild(empty);
            return;
        }
        tasks.forEach(task => {
            const item = document.createElement('li');
            item.className = 'performance-verification__devtrack-item';
            item.dataset.taskId = task.id;
            const statusOptions = DEV_TRACK_STATUSES.map(status => `
                <option value="${status.id}" ${status.id === task.status ? 'selected' : ''}>${status.icon} ${status.label}</option>
            `).join('');
            item.innerHTML = `
                <div class="performance-verification__devtrack-item-main">
                    <select data-role="devtrack-task-status" aria-label="Task status">
                        ${statusOptions}
                    </select>
                    <input type="text" value="${task.title || ''}" data-role="devtrack-task-title" placeholder="Describe the task" aria-label="Task title" />
                </div>
                <button type="button" class="performance-button performance-button--ghost" data-action="remove-dev-task" aria-label="Remove task">Remove</button>
            `;
            this.devTrackListEl.appendChild(item);
        });
        this.updateDevTrackPlaceholder();
    }

    getDevTrackConfig() {
        return {
            ...DEFAULT_CONFIG.devTrack,
            ...(this.config.devTrack || {})
        };
    }

    normalizeDevTrackTasks(tasks) {
        const config = this.getDevTrackConfig();
        const allowed = new Set(DEV_TRACK_STATUSES.map(status => status.id));
        if (!Array.isArray(tasks)) {
            return [];
        }
        return tasks
            .filter(task => task && (typeof task.title === 'string' || typeof task.title === 'number'))
            .map(task => ({
                id: task.id || createTaskId(),
                title: String(task.title || '').trim() || 'Untitled task',
                status: allowed.has(task.status) ? task.status : (config.defaultStatus || DEV_TRACK_STATUSES[0].id)
            }))
            .slice(0, config.maxTasks || DEFAULT_CONFIG.devTrack.maxTasks);
    }

    normalizeFocusState() {
        const fallback = this.config.defaultFocusMinutes || DEFAULT_CONFIG.defaultFocusMinutes;
        const minutes = Number(this.state.focus?.minutes);
        const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : fallback;
        const deadline = this.state.focus?.deadline ? Number(this.state.focus.deadline) : null;
        const startedAt = this.state.focus?.startedAt ? Number(this.state.focus.startedAt) : null;
        this.state.focus = {
            minutes: safeMinutes,
            deadline: Number.isFinite(deadline) && deadline > 0 ? deadline : null,
            startedAt: Number.isFinite(startedAt) && startedAt > 0 ? startedAt : null
        };
    }

    handleAddDevTask(event) {
        if (event) {
            event.preventDefault();
        }
        if (!this.devTrackInputEl) return;
        const inputValue = (this.devTrackInputEl.value || '').trim();
        const config = this.getDevTrackConfig();
        const tasks = Array.isArray(this.state.devTrackTasks) ? this.state.devTrackTasks.slice() : [];
        if (tasks.length >= (config.maxTasks || DEFAULT_CONFIG.devTrack.maxTasks)) {
            this.emitStatus('Development track is full — clear a task before adding another.');
            return;
        }
        const title = inputValue || `Task ${tasks.length + 1}`;
        const newTask = {
            id: createTaskId(),
            title,
            status: config.defaultStatus || DEV_TRACK_STATUSES[0].id
        };
        tasks.push(newTask);
        this.state.devTrackTasks = tasks;
        this.devTrackInputEl.value = '';
        this.persistState();
        this.renderDevTrackTasks();
        this.emitStatus('Development task added');
    }

    handleDevTaskInputKeydown(event) {
        if (event?.key === 'Enter') {
            this.handleAddDevTask(event);
        }
    }

    handleDevTaskListClick(event) {
        const button = event?.target?.closest?.('[data-action="remove-dev-task"]');
        if (!button) return;
        const item = button.closest('.performance-verification__devtrack-item');
        if (!item) return;
        const taskId = item.dataset.taskId;
        this.removeDevTask(taskId);
    }

    handleDevTaskListInput(event) {
        const input = event?.target;
        if (!input || input.dataset.role !== 'devtrack-task-title') {
            return;
        }
        const item = input.closest('.performance-verification__devtrack-item');
        if (!item) return;
        const taskId = item.dataset.taskId;
        this.updateDevTaskTitle(taskId, input.value);
    }

    handleDevTaskListChange(event) {
        const select = event?.target;
        if (!select || select.dataset.role !== 'devtrack-task-status') {
            return;
        }
        const item = select.closest('.performance-verification__devtrack-item');
        if (!item) return;
        const taskId = item.dataset.taskId;
        this.updateDevTaskStatus(taskId, select.value);
    }

    removeDevTask(taskId) {
        if (!taskId) return;
        const tasks = Array.isArray(this.state.devTrackTasks) ? this.state.devTrackTasks.slice() : [];
        const nextTasks = tasks.filter(task => task.id !== taskId);
        if (nextTasks.length === tasks.length) return;
        this.state.devTrackTasks = nextTasks;
        this.persistState();
        this.renderDevTrackTasks();
        this.emitStatus('Development task removed');
    }

    updateDevTaskTitle(taskId, title) {
        if (!taskId) return;
        const tasks = Array.isArray(this.state.devTrackTasks) ? this.state.devTrackTasks.slice() : [];
        const idx = tasks.findIndex(task => task.id === taskId);
        if (idx === -1) return;
        tasks[idx] = {
            ...tasks[idx],
            title: String(title ?? '')
        };
        this.state.devTrackTasks = tasks;
        this.persistState();
    }

    updateDevTaskStatus(taskId, status) {
        if (!taskId) return;
        const tasks = Array.isArray(this.state.devTrackTasks) ? this.state.devTrackTasks.slice() : [];
        const idx = tasks.findIndex(task => task.id === taskId);
        if (idx === -1) return;
        const config = this.getDevTrackConfig();
        const allowed = new Set(DEV_TRACK_STATUSES.map(s => s.id));
        const nextStatus = allowed.has(status) ? status : (config.defaultStatus || DEV_TRACK_STATUSES[0].id);
        tasks[idx] = {
            ...tasks[idx],
            status: nextStatus
        };
        this.state.devTrackTasks = tasks;
        this.persistState();
        this.renderDevTrackTasks();
        this.emitStatus('Development task updated');
    }

    updateDevTrackPlaceholder() {
        if (!this.devTrackInputEl || this.devTrackInputEl.value) return;
        this.devTrackInputEl.placeholder = this.state.devTrackTasks?.length
            ? 'Add follow-up task'
            : 'Define the next task in the dev track';
    }

    handleDevTrackChange() {
        const value = this.devTrackEl ? this.devTrackEl.value : '';
        this.state.devTrackNotes = value;
        this.persistState();
        this.emitStatus('Development track updated');
    }

    handleFocusDurationChange() {
        const value = Number(this.focusSelect?.value || this.config.defaultFocusMinutes);
        const safeDuration = clampDuration(value, this.config.focusDurations, this.config.defaultFocusMinutes);
        this.state.focus.minutes = safeDuration || this.config.defaultFocusMinutes;
        this.persistState();
        if (this.focusSelect && this.focusSelect.value !== String(this.state.focus.minutes)) {
            this.focusSelect.value = String(this.state.focus.minutes);
        }
    }

    handleRestDurationChange() {
        const value = Number(this.restSelect?.value || this.config.defaultRestMinutes);
        const safeDuration = clampDuration(value, this.config.restDurations, this.config.defaultRestMinutes);
        this.state.rest.minutes = safeDuration || this.config.defaultRestMinutes;
        this.persistState();
        if (this.restSelect && this.restSelect.value !== String(this.state.rest.minutes)) {
            this.restSelect.value = String(this.state.rest.minutes);
        }
    }

    syncFocusControls() {
        if (this.focusSelect) {
            this.focusSelect.value = String(this.state.focus.minutes || this.config.defaultFocusMinutes);
        }
        const hasDeadline = Boolean(this.state.focus.deadline && this.state.focus.deadline > now());
        if (this.focusButton) {
            this.focusButton.disabled = hasDeadline;
        }
        if (this.focusStopButton) {
            this.focusStopButton.disabled = !hasDeadline;
        }
    }

    syncRestControls() {
        if (this.restSelect) {
            this.restSelect.value = String(this.state.rest.minutes || this.config.defaultRestMinutes);
        }
        const hasDeadline = Boolean(this.state.rest.deadline && this.state.rest.deadline > now());
        if (this.restButton) {
            this.restButton.disabled = hasDeadline;
        }
        if (this.restStopButton) {
            this.restStopButton.disabled = !hasDeadline;
        }
    }

    startFocusSession() {
        const minutes = this.state.focus.minutes || this.config.defaultFocusMinutes;
        const durationMs = Math.max(1, minutes) * 60 * 1000;
        const startTime = now();
        this.state.focus.deadline = startTime + durationMs;
        this.state.focus.startedAt = startTime;
        this.persistState();
        this.syncFocusControls();
        this.beginFocusTimer();
        this.emitStatus(`Focus session started (${minutes} min)`);
    }

    startRestTimer() {
        const minutes = this.state.rest.minutes || this.config.defaultRestMinutes;
        const durationMs = Math.max(1, minutes) * 60 * 1000;
        this.state.rest.deadline = now() + durationMs;
        this.persistState();
        this.syncRestControls();
        this.beginRestTimer();
        this.emitStatus(`Rest reminder scheduled (${minutes} min)`);
    }

    resumeFocusSessionIfNeeded() {
        if (this.state.focus.deadline && this.state.focus.deadline > now()) {
            this.syncFocusControls();
            this.beginFocusTimer();
        } else {
            this.clearFocusSession(false);
        }
    }

    resumeRestTimerIfNeeded() {
        if (this.state.rest.deadline && this.state.rest.deadline > now()) {
            this.syncRestControls();
            this.beginRestTimer();
        } else {
            this.state.rest.deadline = null;
            this.persistState();
            this.syncRestControls();
            this.updateRestStatus();
        }
    }

    beginFocusTimer() {
        if (this.focusInterval) {
            clearInterval(this.focusInterval);
        }
        this.focusInterval = setInterval(() => this.updateFocusStatus(), 1000);
        this.updateFocusStatus();
    }

    beginRestTimer() {
        if (this.restInterval) {
            clearInterval(this.restInterval);
        }
        this.restInterval = setInterval(() => this.updateRestStatus(), 1000);
        this.updateRestStatus();
    }

    clearFocusSession(announce = false, options = {}) {
        if (this.focusInterval) {
            clearInterval(this.focusInterval);
            this.focusInterval = null;
        }
        const hadDeadline = Boolean(this.state.focus.deadline);
        this.state.focus.deadline = null;
        this.state.focus.startedAt = null;
        this.persistState();
        this.syncFocusControls();
        this.updateFocusStatus();
        if (announce) {
            this.emitStatus(options.message || 'Focus session cleared');
        }
        if (options.autoRest && hadDeadline) {
            const restActive = this.state.rest.deadline && this.state.rest.deadline > now();
            if (!restActive) {
                this.startRestTimer();
            }
        }
    }

    clearRestTimer(announce = false) {
        if (this.restInterval) {
            clearInterval(this.restInterval);
            this.restInterval = null;
        }
        this.state.rest.deadline = null;
        this.persistState();
        this.syncRestControls();
        this.updateRestStatus();
        if (announce) {
            this.emitStatus('Rest reminder cleared');
        }
    }

    updateFocusStatus() {
        if (!this.focusStatusEl) return;
        const deadline = this.state.focus.deadline;
        if (!deadline || deadline <= now()) {
            this.focusStatusEl.textContent = 'Focus idle';
            if (deadline && deadline <= now()) {
                this.clearFocusSession(true, {
                    message: 'Focus session complete',
                    autoRest: this.config.autoRestOnFocusComplete !== false
                });
            }
            return;
        }
        const remaining = deadline - now();
        const startedAt = this.state.focus.startedAt || (deadline - (this.state.focus.minutes || this.config.defaultFocusMinutes) * 60 * 1000);
        const total = Math.max(1, deadline - startedAt);
        const percent = Math.max(0, Math.min(100, Math.round(((total - remaining) / total) * 100)));
        this.focusStatusEl.textContent = `${formatFocusDuration(remaining)} · ${percent}% complete`;
    }

    updateRestStatus() {
        if (!this.restStatusEl) return;
        const deadline = this.state.rest.deadline;
        if (!deadline || deadline <= now()) {
            this.restStatusEl.textContent = 'Ready for a break';
            if (deadline && deadline <= now()) {
                this.emitStatus('Rest reminder reached');
                this.clearRestTimer();
            }
            return;
        }
        const remaining = deadline - now();
        this.restStatusEl.textContent = formatDuration(remaining);
        if (remaining <= 0) {
            this.emitStatus('Rest reminder reached');
            this.clearRestTimer();
        }
    }

    runChecks() {
        const checks = Array.isArray(this.config.checks) && this.config.checks.length
            ? this.config.checks
            : DEFAULT_CHECKS;
        const results = checks.map(check => {
            const base = { id: check.id, status: 'warn', detail: 'No data' };
            const methodName = `check${check.id.charAt(0).toUpperCase()}${check.id.slice(1)}`;
            const handler = typeof this[methodName] === 'function' ? this[methodName].bind(this) : null;
            if (handler) {
                try {
                    const outcome = handler();
                    if (outcome && outcome.status) {
                        base.status = outcome.status;
                        base.detail = outcome.detail || '';
                    }
                } catch (error) {
                    base.status = 'fail';
                    base.detail = error?.message || 'Check failed';
                    console.warn('Verification check failed', check.id, error);
                }
            } else {
                const fallback = this.runGenericCheck(check.id);
                base.status = fallback.status;
                base.detail = fallback.detail;
            }
            return base;
        });

        this.state.results = results;
        this.state.lastRun = now();
        this.persistState();
        this.updateCheckDisplay();
        this.emitStatus('Diagnostics finished');
        return results;
    }

    runGenericCheck(checkId) {
        const getterName = `get${checkId.charAt(0).toUpperCase()}${checkId.slice(1)}State`;
        const provider = this.providers[getterName];
        if (typeof provider !== 'function') {
            return { status: 'warn', detail: 'No data available' };
        }
        const state = provider();
        if (state && Object.keys(state).length) {
            return { status: 'pass', detail: 'State captured' };
        }
        return { status: 'warn', detail: 'Missing configuration' };
    }

    updateCheckDisplay() {
        if (!this.checkListEl) return;
        const resultMap = new Map((this.state.results || []).map(result => [result.id, result]));
        Array.from(this.checkListEl.children).forEach(item => {
            const id = item.dataset.checkId;
            const status = resultMap.get(id) || { status: 'pending', detail: '' };
            const iconEl = item.querySelector('.performance-verification__check-icon');
            const statusEl = item.querySelector('.performance-verification__check-status');
            item.classList.remove('is-pass', 'is-warn', 'is-fail');
            const statusKey = STATUS_CLASSES[status.status] ? status.status : null;
            if (statusKey) {
                item.classList.add(STATUS_CLASSES[statusKey]);
            }
            if (iconEl) {
                iconEl.textContent = STATUS_ICONS[status.status] || '•';
            }
            if (statusEl) {
                const label = STATUS_LABELS[status.status] || 'Pending';
                statusEl.textContent = status.detail ? `${label} · ${status.detail}` : label;
            }
        });
        if (this.lastRunEl) {
            if (this.state.lastRun) {
                const date = new Date(this.state.lastRun);
                this.lastRunEl.textContent = `Last run ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            } else {
                this.lastRunEl.textContent = 'Never run';
            }
        }
    }

    registerActivity(eventName, payload = {}) {
        if (!this.activityLogEl) return;
        const timestamp = new Date();
        const entry = document.createElement('li');
        entry.innerHTML = `
            <span>${timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <strong>${eventName}</strong>
            <em>${this.describeActivityPayload(payload)}</em>
        `;
        this.activityLogEl.insertBefore(entry, this.activityLogEl.firstChild);
        while (this.activityLogEl.children.length > 8) {
            this.activityLogEl.removeChild(this.activityLogEl.lastChild);
        }
    }

    describeActivityPayload(payload) {
        if (!payload || typeof payload !== 'object') {
            return '';
        }
        if (payload.parameter) {
            return `parameter: ${payload.parameter}`;
        }
        if (payload.cue?.label) {
            return `cue: ${payload.cue.label}`;
        }
        if (payload.padId) {
            return `pad: ${payload.padId}`;
        }
        if (payload.status) {
            return String(payload.status);
        }
        return Object.keys(payload).slice(0, 2).map(key => `${key}: ${payload[key]}`).join(', ');
    }

    emitStatus(message) {
        if (this.onStatusChange) {
            this.onStatusChange(message);
        }
    }

    loadState() {
        if (typeof window === 'undefined') {
            return;
        }
        try {
            const stored = window.localStorage?.getItem?.(this.config.storageKey);
            if (!stored) return;
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object') {
                this.state = {
                    ...this.state,
                    ...parsed,
                    rest: {
                        ...this.state.rest,
                        ...(parsed.rest || {})
                    },
                    focus: {
                        ...this.state.focus,
                        ...(parsed.focus || {})
                    }
                };
                this.state.devTrackTasks = this.normalizeDevTrackTasks(parsed.devTrackTasks || this.state.devTrackTasks);
                this.normalizeFocusState();
            }
        } catch (error) {
            console.warn('PerformanceVerificationPanel failed to load state', error);
        }
    }

    persistState() {
        if (typeof window === 'undefined') {
            return;
        }
        try {
            window.localStorage?.setItem?.(this.config.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('PerformanceVerificationPanel failed to persist state', error);
        }
    }

    getState() {
        return {
            lastRun: this.state.lastRun,
            results: Array.isArray(this.state.results) ? this.state.results.slice() : [],
            rest: { ...this.state.rest },
            focus: { ...this.state.focus },
            devTrackNotes: this.state.devTrackNotes,
            devTrackTasks: Array.isArray(this.state.devTrackTasks) ? this.state.devTrackTasks.slice() : []
        };
    }

    applyState(state = {}) {
        if (state.lastRun) {
            this.state.lastRun = state.lastRun;
        }
        if (Array.isArray(state.results)) {
            this.state.results = state.results.slice();
        }
        if (state.rest) {
            this.state.rest = {
                ...this.state.rest,
                ...state.rest
            };
        }
        if (state.focus) {
            this.state.focus = {
                ...this.state.focus,
                ...state.focus
            };
        }
        if (typeof state.devTrackNotes === 'string') {
            this.state.devTrackNotes = state.devTrackNotes;
        }
        if (Array.isArray(state.devTrackTasks)) {
            this.state.devTrackTasks = this.normalizeDevTrackTasks(state.devTrackTasks);
        }
        this.normalizeFocusState();
        this.persistState();
        this.renderDevTrack();
        this.syncRestControls();
        this.syncFocusControls();
        this.updateCheckDisplay();
        this.resumeRestTimerIfNeeded();
        this.resumeFocusSessionIfNeeded();
    }

    checkTouchpads() {
        const provider = this.providers.getTouchpadsState;
        const state = typeof provider === 'function' ? provider() : null;
        const padCount = state?.padCount || 0;
        const mappings = Array.isArray(state?.mappings) ? state.mappings.filter(Boolean) : [];
        if (padCount === 0 || mappings.length === 0) {
            return { status: 'fail', detail: 'No pads configured' };
        }
        const unmapped = mappings.filter(mapping => !mapping || !mapping.axes);
        if (unmapped.length) {
            return { status: 'warn', detail: 'Some pads missing axes' };
        }
        return { status: 'pass', detail: `${padCount} pads ready` };
    }

    checkAudio() {
        const provider = this.providers.getAudioState;
        const settings = typeof provider === 'function' ? provider() : null;
        if (!settings) {
            return { status: 'warn', detail: 'No settings detected' };
        }
        if (settings.enabled === false) {
            return { status: 'warn', detail: 'Audio reactivity disabled' };
        }
        const flourish = settings.flourish;
        if (flourish && flourish.enabled === false) {
            return { status: 'warn', detail: 'Flourish trigger disabled' };
        }
        return { status: 'pass', detail: 'Audio reactivity armed' };
    }

    checkHardware() {
        const provider = this.providers.getHardwareState;
        const state = typeof provider === 'function' ? provider() : null;
        if (!state) {
            return { status: 'warn', detail: 'No mappings stored' };
        }
        const mappings = Array.isArray(state.mappings) ? state.mappings : [];
        if (mappings.length === 0) {
            return { status: 'warn', detail: 'No hardware mappings yet' };
        }
        return { status: 'pass', detail: `${mappings.length} mapping${mappings.length === 1 ? '' : 's'}` };
    }

    checkNetwork() {
        const provider = this.providers.getNetworkState;
        const state = typeof provider === 'function' ? provider() : null;
        if (!state) {
            return { status: 'warn', detail: 'Bridge idle' };
        }
        if (state.enabled === false && state.autoConnect === false) {
            return { status: 'warn', detail: 'Remote bridge disabled' };
        }
        return { status: 'pass', detail: 'Network bridge configured' };
    }

    checkGestures() {
        const provider = this.providers.getGesturesState;
        const state = typeof provider === 'function' ? provider() : null;
        const recordings = Array.isArray(state?.recordings) ? state.recordings : [];
        if (!recordings.length) {
            return { status: 'warn', detail: 'No gesture takes captured' };
        }
        return { status: 'pass', detail: `${recordings.length} take${recordings.length === 1 ? '' : 's'}` };
    }

    checkPresets() {
        const provider = this.providers.getPresetsState;
        const state = typeof provider === 'function' ? provider() : null;
        const presets = Array.isArray(state?.presets) ? state.presets : [];
        const playlist = Array.isArray(state?.playlist) ? state.playlist : [];
        if (!presets.length) {
            return { status: 'fail', detail: 'No presets saved' };
        }
        if (!playlist.length) {
            return { status: 'warn', detail: 'Playlist empty' };
        }
        return { status: 'pass', detail: `${presets.length} presets, ${playlist.length} cues queued` };
    }

    checkShowPlanner() {
        const provider = this.providers.getShowPlannerState;
        const state = typeof provider === 'function' ? provider() : null;
        const cues = Array.isArray(state?.cues) ? state.cues : [];
        if (!cues.length) {
            return { status: 'warn', detail: 'Cue stack empty' };
        }
        return { status: 'pass', detail: `${cues.length} cue${cues.length === 1 ? '' : 's'}` };
    }

    checkTheme() {
        const provider = this.providers.getThemeState;
        const state = typeof provider === 'function' ? provider() : null;
        if (!state) {
            return { status: 'warn', detail: 'No theme applied' };
        }
        if (state.paletteId === 'system' && !state.overrides) {
            return { status: 'warn', detail: 'Using system palette' };
        }
        return { status: 'pass', detail: `${state.paletteId || 'custom'} theme active` };
    }

    checkLayout() {
        const provider = this.providers.getLayoutState;
        const state = typeof provider === 'function' ? provider() : null;
        if (!state) {
            return { status: 'warn', detail: 'No layout stored' };
        }
        if (Array.isArray(state.columnOrder) && state.columnOrder.length === 3) {
            return { status: 'pass', detail: `Order: ${state.columnOrder.join(' › ')}` };
        }
        return { status: 'warn', detail: 'Column order incomplete' };
    }

    destroy() {
        if (this.runButton) {
            this.runButton.removeEventListener('click', this.handlers.runChecks);
        }
        if (this.focusButton) {
            this.focusButton.removeEventListener('click', this.handlers.startFocus);
        }
        if (this.focusStopButton) {
            this.focusStopButton.removeEventListener('click', this.handlers.stopFocus);
        }
        if (this.focusSelect) {
            this.focusSelect.removeEventListener('change', this.handlers.focusChange);
        }
        if (this.restButton) {
            this.restButton.removeEventListener('click', this.handlers.startRest);
        }
        if (this.restStopButton) {
            this.restStopButton.removeEventListener('click', this.handlers.stopRest);
        }
        if (this.restSelect) {
            this.restSelect.removeEventListener('change', this.handlers.restChange);
        }
        if (this.devTrackEl) {
            this.devTrackEl.removeEventListener('input', this.handlers.devTrack);
        }
        if (this.devTrackInputEl) {
            this.devTrackInputEl.removeEventListener('keydown', this.handlers.devTaskInputKeydown);
        }
        if (this.devTrackListEl) {
            this.devTrackListEl.removeEventListener('click', this.handlers.devTaskListClick);
            this.devTrackListEl.removeEventListener('input', this.handlers.devTaskListInput);
            this.devTrackListEl.removeEventListener('change', this.handlers.devTaskListChange);
        }
        this.subscriptions.forEach(unsubscribe => unsubscribe?.());
        this.subscriptions = [];
        if (this.focusInterval) {
            clearInterval(this.focusInterval);
            this.focusInterval = null;
        }
        if (this.restInterval) {
            clearInterval(this.restInterval);
            this.restInterval = null;
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
