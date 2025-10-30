import { DEFAULT_GESTURE_CONFIG } from './PerformanceConfig.js';

const DEFAULT_CAPTURE_EVENTS = ['touchpad:update', 'hardware:midi-value'];
const DEFAULT_MAX_DURATION = 120000;
const DEFAULT_MAX_EVENTS = 2200;

function clone(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        return null;
    }
}

function createId(prefix = 'take') {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
    if (typeof performance !== 'undefined' && performance.now) {
        return performance.now();
    }
    return Date.now();
}

function formatDuration(ms) {
    if (!ms || ms <= 0) {
        return '0.0s';
    }
    if (ms < 1000) {
        return `${ms.toFixed(0)}ms`;
    }
    const seconds = ms / 1000;
    if (seconds < 60) {
        return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainder = (seconds % 60).toFixed(0).padStart(2, '0');
    return `${minutes}:${remainder}`;
}

function formatBeats(ms, tempo) {
    if (!tempo || tempo <= 0) {
        return null;
    }
    const beats = (ms / 60000) * tempo;
    if (beats < 1) {
        return null;
    }
    if (beats < 16) {
        return `≈${beats.toFixed(1)} beats`;
    }
    return `≈${beats.toFixed(0)} beats`;
}

function sanitizeEvents(events = []) {
    if (!Array.isArray(events)) {
        return [];
    }
    return events
        .map(event => {
            if (!event || typeof event !== 'object') {
                return null;
            }
            const time = typeof event.time === 'number' && event.time >= 0 ? event.time : 0;
            const type = typeof event.type === 'string' ? event.type : 'custom';
            const payload = clone(event.payload) || {};
            const normalized = typeof event.normalized === 'number' ? event.normalized : undefined;
            if (typeof normalized === 'number' && typeof payload.normalized !== 'number') {
                payload.normalized = normalized;
            }
            return { time, type, payload };
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);
}

function normalizeRecording(record = {}, index = 0) {
    const id = typeof record.id === 'string' && record.id ? record.id : createId('take');
    const name = typeof record.name === 'string' && record.name
        ? record.name
        : `Take ${index + 1}`;
    const events = sanitizeEvents(record.events);
    const duration = typeof record.duration === 'number' && record.duration > 0
        ? record.duration
        : events.length
            ? events[events.length - 1].time
            : 0;
    const createdAt = typeof record.createdAt === 'number' ? record.createdAt : Date.now();
    const updatedAt = typeof record.updatedAt === 'number' ? record.updatedAt : createdAt;
    const sources = Array.isArray(record.sources) ? record.sources.filter(Boolean) : [];

    return {
        id,
        name,
        duration,
        events,
        createdAt,
        updatedAt,
        sources
    };
}

function describeSources(sources = []) {
    if (!sources.length) {
        return 'custom';
    }
    const labels = sources.map(source => {
        switch (source) {
            case 'touchpad:update':
                return 'Touch Pad';
            case 'hardware:midi-value':
                return 'MIDI';
            case 'audio:flourish':
                return 'Audio';
            default:
                return source;
        }
    });
    return Array.from(new Set(labels)).join(' + ');
}

export class PerformanceGestureRecorder {
    constructor({
        parameterManager = null,
        hub = null,
        container = null,
        config = DEFAULT_GESTURE_CONFIG,
        onStatusChange = null
    } = {}) {
        this.parameterManager = parameterManager;
        this.hub = hub;
        this.config = { ...DEFAULT_GESTURE_CONFIG, ...(config || {}) };
        this.onStatusChange = typeof onStatusChange === 'function' ? onStatusChange : () => {};

        this.container = container || this.ensureContainer();
        this.statusEl = null;
        this.tempoEl = null;
        this.listEl = null;
        this.recordButton = null;
        this.stopButton = null;
        this.playButton = null;
        this.clearButton = null;
        this.importInput = null;

        this.recordings = [];
        this.selectedId = null;
        this.isRecording = false;
        this.isPlaying = false;
        this.currentRecording = null;
        this.playbackTimers = [];
        this.statusState = 'idle';
        this.statusMessage = 'Ready';
        this.subscriptions = [];
        this.currentTempo = null;
        this.beatsPerBar = null;
        this.showRunning = false;

        this.loadState();
        this.render();
        this.bindHub();
        this.emitGestureSummaries();
    }

    ensureContainer() {
        const existing = document.getElementById('performance-gestures');
        if (existing) {
            existing.innerHTML = '';
            return existing;
        }
        const section = document.createElement('section');
        section.id = 'performance-gestures';
        return section;
    }

    bindHub() {
        if (!this.hub || typeof this.hub.on !== 'function') {
            return;
        }
        const captureEvents = Array.isArray(this.config.captureEvents) && this.config.captureEvents.length
            ? this.config.captureEvents
            : DEFAULT_CAPTURE_EVENTS;
        captureEvents.forEach(eventName => {
            this.subscriptions.push(this.hub.on(eventName, payload => this.captureEvent(eventName, payload)));
        });
        this.subscriptions.push(this.hub.on('audio:flourish', payload => this.captureEvent('audio:flourish', payload)));
        this.subscriptions.push(this.hub.on('show:start', meta => this.handleShowStart(meta)));
        this.subscriptions.push(this.hub.on('show:stop', () => this.handleShowStop()));
        this.subscriptions.push(this.hub.on('show:cue-trigger', ({ cue } = {}) => this.handleCueTrigger(cue)));
    }

    unbindHub() {
        this.subscriptions.forEach(unsubscribe => {
            try {
                unsubscribe?.();
            } catch (error) {
                // ignore cleanup failures
            }
        });
        this.subscriptions = [];
    }

    render() {
        if (!this.container) {
            return;
        }
        this.container.classList.add('performance-block', 'gesture-recorder');
        this.container.innerHTML = `
            <header class="performance-block__header gesture-recorder__header">
                <div>
                    <h3 class="performance-block__title">Gesture Recorder</h3>
                    <p class="performance-block__subtitle">
                        Capture touch pad and hardware moves into reusable flourishes.
                        <span class="gesture-recorder__tempo" data-role="tempo"></span>
                    </p>
                </div>
                <div class="gesture-recorder__status" data-role="status">Ready</div>
            </header>
            <div class="gesture-recorder__controls">
                <button type="button" data-action="record">Record</button>
                <button type="button" data-action="stop" disabled>Stop</button>
                <button type="button" data-action="play" disabled>Play</button>
                <button type="button" data-action="clear" disabled>Clear</button>
                <div class="gesture-recorder__library-actions">
                    <button type="button" data-action="export" class="gesture-recorder__export" disabled>Export</button>
                    <label class="gesture-recorder__import">
                        Import
                        <input type="file" accept="application/json" data-action="import" hidden />
                    </label>
                </div>
            </div>
            <section class="gesture-recorder__takes">
                <header class="gesture-recorder__takes-header">
                    <h4>Captured Gestures</h4>
                    <span class="gesture-recorder__hint">Double-click a take to rename it.</span>
                </header>
                <ul class="gesture-recorder__list" data-role="list"></ul>
            </section>
        `;

        this.statusEl = this.container.querySelector('[data-role="status"]');
        this.tempoEl = this.container.querySelector('[data-role="tempo"]');
        this.listEl = this.container.querySelector('[data-role="list"]');
        this.recordButton = this.container.querySelector('[data-action="record"]');
        this.stopButton = this.container.querySelector('[data-action="stop"]');
        this.playButton = this.container.querySelector('[data-action="play"]');
        this.clearButton = this.container.querySelector('[data-action="clear"]');
        this.exportButton = this.container.querySelector('[data-action="export"]');
        this.importInput = this.container.querySelector('[data-action="import"]');

        this.recordButton.addEventListener('click', () => this.toggleRecording());
        this.stopButton.addEventListener('click', () => this.stopRecording());
        this.playButton.addEventListener('click', () => this.togglePlayback());
        this.clearButton.addEventListener('click', () => this.clearRecordings());
        this.exportButton.addEventListener('click', () => this.exportRecordings());
        this.importInput.addEventListener('change', event => this.importRecordings(event));

        this.renderList();
        this.updateTempoDisplay();
        this.updateControls();
        this.updateStatusDisplay();
    }

    renderList() {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';
        if (!this.recordings.length) {
            const empty = document.createElement('li');
            empty.className = 'gesture-recorder__empty';
            empty.textContent = 'Record a take to build your flourish library.';
            this.listEl.appendChild(empty);
            return;
        }

        this.recordings.forEach(recording => {
            const item = document.createElement('li');
            item.className = 'gesture-recorder__take';
            if (recording.id === this.selectedId) {
                item.classList.add('gesture-recorder__take--selected');
            }
            item.dataset.id = recording.id;
            const durationLabel = formatDuration(recording.duration);
            const beatsLabel = formatBeats(recording.duration, this.currentTempo);
            const metaParts = [durationLabel, `${recording.events.length} events`, describeSources(recording.sources)];
            if (beatsLabel) {
                metaParts.splice(1, 0, beatsLabel);
            }
            const meta = metaParts.join(' • ');
            item.innerHTML = `
                <button type="button" class="gesture-recorder__take-select" data-action="select">
                    <span class="gesture-recorder__take-name">${recording.name}</span>
                    <span class="gesture-recorder__take-meta">${meta}</span>
                </button>
                <div class="gesture-recorder__take-actions">
                    <button type="button" data-action="duplicate">Duplicate</button>
                    <button type="button" data-action="delete">Delete</button>
                </div>
            `;

            item.querySelector('[data-action="select"]').addEventListener('click', () => this.selectRecording(recording.id));
            item.querySelector('[data-action="select"]').addEventListener('dblclick', () => this.renameRecording(recording.id));
            item.querySelector('[data-action="duplicate"]').addEventListener('click', () => this.duplicateRecording(recording.id));
            item.querySelector('[data-action="delete"]').addEventListener('click', () => this.deleteRecording(recording.id));

            this.listEl.appendChild(item);
        });
    }

    updateControls() {
        if (!this.recordButton || !this.stopButton || !this.playButton) {
            return;
        }
        this.recordButton.disabled = this.isRecording;
        this.stopButton.disabled = !this.isRecording && !this.isPlaying;
        const hasSelection = Boolean(this.selectedId && this.recordings.find(record => record.id === this.selectedId));
        this.playButton.disabled = !hasSelection;
        this.playButton.textContent = this.isPlaying ? 'Stop' : 'Play';
        this.clearButton.disabled = !this.recordings.length;
        if (this.exportButton) {
            this.exportButton.disabled = !this.recordings.length;
        }
    }

    updateStatusDisplay() {
        if (!this.statusEl) return;
        const label = this.statusState === 'recording'
            ? 'Recording'
            : this.statusState === 'playing'
                ? 'Playback'
                : 'Ready';
        this.statusEl.textContent = this.statusMessage || label;
        if (this.container) {
            this.container.classList.toggle('gesture-recorder--recording', this.statusState === 'recording');
            this.container.classList.toggle('gesture-recorder--playing', this.statusState === 'playing');
        }
    }

    updateTempoDisplay() {
        if (!this.tempoEl) return;
        if (!this.currentTempo) {
            this.tempoEl.textContent = '';
            return;
        }
        const tempo = `${Math.round(this.currentTempo)} BPM`;
        const meter = this.beatsPerBar ? `${this.beatsPerBar} beats/bar` : null;
        const running = this.showRunning ? '• Show running' : null;
        const parts = [tempo];
        if (meter) parts.push(meter);
        if (running) parts.push(running);
        this.tempoEl.textContent = parts.length ? `(${parts.join(' • ')})` : '';
    }

    setStatus(state, message) {
        this.statusState = state || 'idle';
        if (message) {
            this.statusMessage = message;
        } else if (this.statusState === 'idle') {
            this.statusMessage = 'Ready';
        }
        this.updateStatusDisplay();
        if (message) {
            this.onStatusChange(message);
        } else if (this.statusState === 'recording') {
            this.onStatusChange('Recording gesture');
        }
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
            return;
        }
        this.startRecording();
    }

    startRecording() {
        if (this.isRecording) return;
        if (this.isPlaying) {
            this.stopPlayback();
        }
        const id = createId('take');
        const name = this.generateRecordingName();
        this.currentRecording = {
            id,
            name,
            events: [],
            duration: 0,
            sources: [],
            sourceSet: new Set(),
            startedAt: now(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.isRecording = true;
        this.setStatus('recording', `Recording ${name}`);
        this.updateControls();
        this.hub?.emit?.('gestures:recording-start', { id, name });
    }

    stopRecording({ reason = '', discard = false } = {}) {
        if (!this.isRecording) {
            return;
        }
        const recording = this.currentRecording;
        this.isRecording = false;
        this.currentRecording = null;

        if (!recording) {
            this.setStatus('idle');
            this.updateControls();
            return;
        }

        recording.duration = Math.max(recording.duration || 0, now() - recording.startedAt);
        recording.events = sanitizeEvents(recording.events);
        recording.sourceSet?.forEach(value => recording.sources.push(value));
        recording.sources = Array.from(new Set(recording.sources));
        recording.updatedAt = Date.now();
        delete recording.startedAt;
        delete recording.sourceSet;

        if (discard || !recording.events.length) {
            const message = discard ? 'Recording discarded' : 'Recording cancelled';
            this.setStatus('idle', message);
            this.updateControls();
            return;
        }

        const maxEvents = typeof this.config.maxEvents === 'number' && this.config.maxEvents > 0
            ? this.config.maxEvents
            : DEFAULT_MAX_EVENTS;
        if (recording.events.length > maxEvents) {
            recording.events = recording.events.slice(0, maxEvents);
            recording.duration = recording.events[recording.events.length - 1].time;
        }

        this.recordings.unshift(recording);
        this.selectedId = recording.id;
        this.persistState();
        this.renderList();
        this.emitGestureSummaries();
        const message = reason
            ? `Recording saved (${reason})`
            : `Saved ${recording.name}`;
        this.setStatus('idle', message);
        this.updateControls();
        this.hub?.emit?.('gestures:recording-stop', { id: recording.id, name: recording.name });
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.stopPlayback();
            return;
        }
        if (!this.selectedId) {
            return;
        }
        this.playRecording(this.selectedId);
    }

    playRecording(id) {
        const recording = this.recordings.find(item => item.id === id);
        if (!recording || !recording.events.length) {
            return;
        }
        this.stopPlayback();
        if (this.isRecording) {
            this.stopRecording({ discard: true });
        }
        this.isPlaying = true;
        this.activePlaybackId = recording.id;
        this.playbackStartedAt = now();
        this.playbackTimers = [];
        this.setStatus('playing', `Playing ${recording.name}`);
        this.updateControls();
        this.hub?.emit?.('gestures:playback-start', { id: recording.id, name: recording.name });

        recording.events.forEach(event => {
            const timer = setTimeout(() => {
                this.applyPlaybackEvent(recording, event);
            }, Math.max(0, event.time));
            this.playbackTimers.push(timer);
        });
        const finalTimer = setTimeout(() => {
            this.finishPlayback();
        }, Math.max(16, recording.duration + 16));
        this.playbackTimers.push(finalTimer);
    }

    applyPlaybackEvent(recording, event) {
        if (!event) return;
        const payload = clone(event.payload) || {};
        const parameterId = payload.parameter;
        const value = this.resolveEventValue(parameterId, payload);
        if (parameterId && typeof value === 'number') {
            this.parameterManager?.setParameter?.(parameterId, value, 'gesture');
        }
        this.hub?.emit?.('gestures:playback-event', {
            recordingId: recording?.id,
            name: recording?.name,
            event: {
                type: event.type,
                time: event.time,
                payload
            }
        });
    }

    resolveEventValue(parameterId, payload = {}) {
        if (typeof payload.value === 'number') {
            return payload.value;
        }
        const normalized = typeof payload.normalized === 'number' ? payload.normalized : null;
        if (normalized === null || typeof this.parameterManager?.getParameterDefinition !== 'function') {
            return normalized;
        }
        const def = this.parameterManager.getParameterDefinition(parameterId);
        if (!def) {
            return normalized;
        }
        const clamped = Math.max(0, Math.min(1, normalized));
        const value = def.min + (def.max - def.min) * clamped;
        if (def.type === 'int') {
            return Math.round(value);
        }
        return value;
    }

    stopPlayback() {
        if (!this.isPlaying) {
            return;
        }
        this.playbackTimers.forEach(timer => clearTimeout(timer));
        this.playbackTimers = [];
        const wasActive = this.activePlaybackId;
        this.isPlaying = false;
        this.activePlaybackId = null;
        this.setStatus('idle', 'Playback stopped');
        this.updateControls();
        if (wasActive) {
            this.hub?.emit?.('gestures:playback-stop', { id: wasActive });
        }
    }

    finishPlayback() {
        if (!this.isPlaying) {
            return;
        }
        const active = this.activePlaybackId;
        this.isPlaying = false;
        this.playbackTimers = [];
        this.activePlaybackId = null;
        this.setStatus('idle', 'Playback finished');
        this.updateControls();
        if (active) {
            this.hub?.emit?.('gestures:playback-complete', { id: active });
        }
    }

    selectRecording(id) {
        if (!id) return;
        this.selectedId = id;
        this.renderList();
        this.updateControls();
        const recording = this.recordings.find(item => item.id === id);
        if (recording) {
            this.setStatus('idle', `Selected ${recording.name}`);
        }
    }

    renameRecording(id) {
        const recording = this.recordings.find(item => item.id === id);
        if (!recording) return;
        const next = window?.prompt ? window.prompt('Rename gesture', recording.name) : null;
        if (!next || next === recording.name) {
            return;
        }
        recording.name = next.trim();
        recording.updatedAt = Date.now();
        this.persistState();
        this.renderList();
        this.emitGestureSummaries();
        this.setStatus('idle', `Renamed to ${recording.name}`);
    }

    deleteRecording(id) {
        if (!id) return;
        const index = this.recordings.findIndex(item => item.id === id);
        if (index === -1) return;
        const [removed] = this.recordings.splice(index, 1);
        if (this.selectedId === id) {
            this.selectedId = this.recordings[0]?.id || null;
        }
        this.persistState();
        this.renderList();
        this.updateControls();
        this.emitGestureSummaries();
        if (removed) {
            this.setStatus('idle', `Deleted ${removed.name}`);
        }
    }

    duplicateRecording(id) {
        const recording = this.recordings.find(item => item.id === id);
        if (!recording) return;
        const copy = normalizeRecording({ ...recording, id: createId('take'), name: `${recording.name} (copy)` }, this.recordings.length);
        this.recordings.unshift(copy);
        this.selectedId = copy.id;
        this.persistState();
        this.renderList();
        this.updateControls();
        this.emitGestureSummaries();
        this.setStatus('idle', `Duplicated ${recording.name}`);
    }

    clearRecordings() {
        if (!this.recordings.length) return;
        this.recordings = [];
        this.selectedId = null;
        this.persistState();
        this.renderList();
        this.updateControls();
        this.emitGestureSummaries();
        this.setStatus('idle', 'Cleared gesture library');
    }

    generateRecordingName() {
        const prefix = this.config.autoNamePrefix || 'Take';
        const total = this.recordings.length + 1;
        return `${prefix} ${total}`;
    }

    captureEvent(type, payload) {
        if (!this.isRecording || !this.currentRecording) {
            return;
        }
        const timestamp = now() - this.currentRecording.startedAt;
        const maxDuration = typeof this.config.maxDuration === 'number' && this.config.maxDuration > 0
            ? this.config.maxDuration
            : DEFAULT_MAX_DURATION;
        if (timestamp > maxDuration) {
            this.currentRecording.events.push({ type, time: maxDuration, payload: clone(payload) || {} });
            this.currentRecording.duration = maxDuration;
            this.stopRecording({ reason: 'duration limit reached' });
            return;
        }

        const sanitizedPayload = clone(payload) || {};
        this.currentRecording.events.push({ type, time: timestamp, payload: sanitizedPayload });
        this.currentRecording.duration = timestamp;
        this.currentRecording.sourceSet.add(type);

        const maxEvents = typeof this.config.maxEvents === 'number' && this.config.maxEvents > 0
            ? this.config.maxEvents
            : DEFAULT_MAX_EVENTS;
        if (this.currentRecording.events.length >= maxEvents) {
            this.stopRecording({ reason: 'event limit reached' });
        }
    }

    handleShowStart(meta = {}) {
        if (typeof meta.tempo === 'number') {
            this.currentTempo = meta.tempo;
        }
        if (typeof meta.beatsPerBar === 'number') {
            this.beatsPerBar = meta.beatsPerBar;
        }
        this.showRunning = true;
        this.updateTempoDisplay();
    }

    handleShowStop() {
        this.showRunning = false;
        this.updateTempoDisplay();
    }

    handleCueTrigger(cue) {
        if (!cue || !cue.gestureId) {
            return;
        }
        const recording = this.recordings.find(item => item.id === cue.gestureId);
        if (recording) {
            this.playRecording(recording.id);
        }
    }

    getSummaries() {
        return this.recordings.map(recording => ({
            id: recording.id,
            name: recording.name,
            duration: recording.duration,
            events: recording.events.length,
            sources: recording.sources
        }));
    }

    emitGestureSummaries() {
        const summary = this.getSummaries();
        this.hub?.emit?.('gestures:list', { gestures: summary });
    }

    exportRecordings() {
        if (!this.recordings.length) {
            return;
        }
        if (typeof Blob === 'undefined' || typeof URL === 'undefined') {
            return;
        }
        const payload = { gestures: this.getState().recordings };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'vib34d-gesture-library.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    importRecordings(event) {
        if (!event?.target?.files?.length || typeof FileReader === 'undefined') {
            return;
        }
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                const list = Array.isArray(parsed?.gestures) ? parsed.gestures : Array.isArray(parsed) ? parsed : [];
                this.recordings = list.map((record, index) => normalizeRecording(record, index));
                this.selectedId = this.recordings[0]?.id || null;
                this.persistState();
                this.renderList();
                this.updateControls();
                this.emitGestureSummaries();
                this.setStatus('idle', 'Imported gestures');
            } catch (error) {
                console.warn('PerformanceGestureRecorder failed to import gestures', error);
                this.setStatus('idle', 'Failed to import gestures');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    persistState() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        try {
            const payload = JSON.stringify(this.getState());
            window.localStorage.setItem(this.config.storageKey, payload);
        } catch (error) {
            console.warn('PerformanceGestureRecorder failed to persist state', error);
        }
    }

    loadState() {
        if (typeof window === 'undefined' || !window.localStorage) {
            this.recordings = [];
            this.selectedId = null;
            return;
        }
        try {
            const raw = window.localStorage.getItem(this.config.storageKey);
            if (!raw) {
                this.recordings = [];
                this.selectedId = null;
                return;
            }
            const parsed = JSON.parse(raw);
            const list = Array.isArray(parsed?.recordings)
                ? parsed.recordings
                : Array.isArray(parsed)
                    ? parsed
                    : [];
            this.recordings = list.map((record, index) => normalizeRecording(record, index));
            this.selectedId = typeof parsed?.selectedId === 'string' ? parsed.selectedId : this.recordings[0]?.id || null;
        } catch (error) {
            console.warn('PerformanceGestureRecorder failed to load state', error);
            this.recordings = [];
            this.selectedId = null;
        }
    }

    getState() {
        return {
            recordings: this.recordings.map((record, index) => normalizeRecording(record, index)),
            selectedId: this.selectedId
        };
    }

    applyState(state = {}) {
        this.stopPlayback();
        this.stopRecording({ discard: true });
        const list = Array.isArray(state.recordings) ? state.recordings : [];
        this.recordings = list.map((record, index) => normalizeRecording(record, index));
        this.selectedId = typeof state.selectedId === 'string' ? state.selectedId : this.recordings[0]?.id || null;
        this.persistState();
        this.renderList();
        this.updateControls();
        this.emitGestureSummaries();
        this.setStatus('idle', 'Gestures loaded');
    }

    destroy() {
        this.stopPlayback();
        this.stopRecording({ discard: true });
        this.unbindHub();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
