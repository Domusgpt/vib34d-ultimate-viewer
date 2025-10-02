import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createId(prefix = 'preset') {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export class PerformancePresetManager {
    constructor({
        parameterManager = null,
        touchPadController = null,
        audioPanel = null,
        container = null,
        hub = null,
        config = DEFAULT_PERFORMANCE_CONFIG.presets
    } = {}) {
        this.parameterManager = parameterManager;
        this.touchPadController = touchPadController;
        this.audioPanel = audioPanel;
        this.hub = hub;
        this.config = { ...DEFAULT_PERFORMANCE_CONFIG.presets, ...(config || {}) };

        this.container = container || this.ensureContainer();
        this.storageKey = this.config.storageKey || 'vib34d-performance-presets';
        this.playlistKey = this.config.playlistKey || 'vib34d-performance-playlist';

        this.presets = this.loadPresets();
        this.playlist = this.loadPlaylist();

        this.render();
        this.renderPresetList();
        this.renderPlaylist();
        this.emitPresetListChanged();
    }

    ensureContainer() {
        const existing = document.getElementById('performance-presets');
        if (existing) {
            existing.innerHTML = '';
            return existing;
        }
        const section = document.createElement('section');
        section.id = 'performance-presets';
        return section;
    }

    loadPresets() {
        if (typeof window === 'undefined' || !window.localStorage) return [];
        try {
            const raw = window.localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            console.warn('PresetManager failed to load presets', error);
            return [];
        }
    }

    loadPlaylist() {
        if (typeof window === 'undefined' || !window.localStorage) return [];
        try {
            const raw = window.localStorage.getItem(this.playlistKey);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            console.warn('PresetManager failed to load playlist', error);
            return [];
        }
    }

    persistPresets() {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            window.localStorage.setItem(this.storageKey, JSON.stringify(this.presets));
        } catch (error) {
            console.warn('PresetManager failed to persist presets', error);
        }
    }

    persistPlaylist() {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            window.localStorage.setItem(this.playlistKey, JSON.stringify(this.playlist));
        } catch (error) {
            console.warn('PresetManager failed to persist playlist', error);
        }
    }

    render() {
        if (!this.container) return;
        this.container.classList.add('performance-block');
        this.container.innerHTML = '';

        const header = document.createElement('header');
        header.className = 'performance-block__header';
        header.innerHTML = `
            <div>
                <h3 class="performance-block__title">Presets &amp; Cues</h3>
                <p class="performance-block__subtitle">Capture pad layouts, audio tuning, and create playlists for live runs.</p>
            </div>
        `;
        this.container.appendChild(header);

        const saveForm = document.createElement('form');
        saveForm.className = 'preset-save';
        saveForm.innerHTML = `
            <label>
                <span>Preset name</span>
                <input type="text" name="name" required placeholder="Sunset build" />
            </label>
            <label>
                <span>Notes</span>
                <textarea name="notes" rows="2" placeholder="Describe choreography, cues, or lighting direction"></textarea>
            </label>
            <button type="submit">Save preset</button>
        `;
        saveForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const formData = new FormData(saveForm);
            const name = (formData.get('name') || '').toString().trim();
            if (!name) return;
            const notes = (formData.get('notes') || '').toString();
            this.createPreset({ name, notes });
            saveForm.reset();
        });
        this.container.appendChild(saveForm);

        const listsWrapper = document.createElement('div');
        listsWrapper.className = 'preset-lists';

        const presetList = document.createElement('section');
        presetList.className = 'preset-list';
        presetList.innerHTML = `
            <header class="preset-list__header">
                <h4>Library</h4>
                <div class="preset-list__actions">
                    <button type="button" class="preset-export">Export</button>
                    <label class="preset-import">
                        <span>Import</span>
                        <input type="file" accept="application/json" />
                    </label>
                </div>
            </header>
            <ul class="preset-list__items"></ul>
        `;
        listsWrapper.appendChild(presetList);
        this.container.appendChild(listsWrapper);

        const playlistSection = document.createElement('section');
        playlistSection.className = 'preset-playlist';
        playlistSection.innerHTML = `
            <header class="preset-playlist__header">
                <h4>Playlist</h4>
                <div class="preset-playlist__actions">
                    <button type="button" class="playlist-start">Start</button>
                    <button type="button" class="playlist-clear">Clear</button>
                </div>
            </header>
            <ol class="preset-playlist__items"></ol>
        `;
        listsWrapper.appendChild(playlistSection);

        presetList.querySelector('.preset-export').addEventListener('click', () => this.exportPresets());
        presetList.querySelector('.preset-import input').addEventListener('change', (event) => this.importPresets(event));

        playlistSection.querySelector('.playlist-start').addEventListener('click', () => this.startPlaylist());
        playlistSection.querySelector('.playlist-clear').addEventListener('click', () => this.clearPlaylist());

        this.listEl = presetList.querySelector('.preset-list__items');
        this.playlistEl = playlistSection.querySelector('.preset-playlist__items');
    }

    createPreset({ name, notes }) {
        const preset = {
            id: createId('preset'),
            name,
            notes,
            createdAt: Date.now(),
            touchPads: this.touchPadController?.getState?.() || {},
            audio: this.audioPanel?.getSettings?.() || {},
            metadata: {
                lastEdited: Date.now()
            }
        };
        this.presets.unshift(preset);
        this.persistPresets();
        this.renderPresetList();
        this.hub?.emit?.('preset:saved', clone(preset));
        this.emitPresetListChanged();
    }

    renderPresetList() {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';
        if (!this.presets.length) {
            const empty = document.createElement('li');
            empty.className = 'preset-list__empty';
            empty.textContent = 'No presets saved yet.';
            this.listEl.appendChild(empty);
            return;
        }

        this.presets.forEach(preset => {
            const item = document.createElement('li');
            item.className = 'preset-list__item';
            item.innerHTML = `
                <div class="preset-list__details">
                    <strong>${preset.name}</strong>
                    ${preset.notes ? `<p>${preset.notes}</p>` : ''}
                </div>
                <div class="preset-list__buttons">
                    <button type="button" data-action="load">Load</button>
                    <button type="button" data-action="queue">Queue</button>
                    <button type="button" data-action="delete">Delete</button>
                </div>
            `;

            item.querySelector('[data-action="load"]').addEventListener('click', () => this.applyPreset(preset));
            item.querySelector('[data-action="queue"]').addEventListener('click', () => this.queuePreset(preset.id));
            item.querySelector('[data-action="delete"]').addEventListener('click', () => this.deletePreset(preset.id));
            this.listEl.appendChild(item);
        });
    }

    renderPlaylist() {
        if (!this.playlistEl) return;
        this.playlistEl.innerHTML = '';
        if (!this.playlist.length) {
            const empty = document.createElement('li');
            empty.className = 'preset-playlist__empty';
            empty.textContent = 'Queue presets to build a run order.';
            this.playlistEl.appendChild(empty);
            return;
        }

        this.playlist.forEach((entry, index) => {
            const preset = this.presets.find(p => p.id === entry.presetId);
            const item = document.createElement('li');
            item.className = 'preset-playlist__item';
            item.innerHTML = `
                <div>
                    <strong>${preset ? preset.name : 'Unknown preset'}</strong>
                    ${entry.notes ? `<p>${entry.notes}</p>` : ''}
                </div>
                <div class="preset-playlist__buttons">
                    <button type="button" data-action="load">Load now</button>
                    <button type="button" data-action="remove">Remove</button>
                </div>
            `;

            item.querySelector('[data-action="load"]').addEventListener('click', () => {
                if (preset) this.applyPreset(preset);
            });
            item.querySelector('[data-action="remove"]').addEventListener('click', () => this.removeFromPlaylist(index));

            this.playlistEl.appendChild(item);
        });
    }

    applyPreset(preset) {
        if (!preset) return;
        if (preset.touchPads && this.touchPadController?.applyState) {
            this.touchPadController.applyState(preset.touchPads);
        }
        if (preset.audio && this.audioPanel?.applySettings) {
            this.audioPanel.applySettings(preset.audio);
        }
        this.hub?.emit?.('preset:loaded', clone(preset));
    }

    deletePreset(id) {
        this.presets = this.presets.filter(p => p.id !== id);
        this.persistPresets();
        this.renderPresetList();
        this.playlist = this.playlist.filter(entry => entry.presetId !== id);
        this.persistPlaylist();
        this.renderPlaylist();
        this.emitPresetListChanged();
    }

    queuePreset(id) {
        if (!id) return;
        this.playlist.push({ presetId: id, notes: '' });
        this.persistPlaylist();
        this.renderPlaylist();
    }

    removeFromPlaylist(index) {
        this.playlist.splice(index, 1);
        this.persistPlaylist();
        this.renderPlaylist();
    }

    startPlaylist() {
        if (!this.playlist.length) return;
        const [first] = this.playlist;
        const preset = this.presets.find(p => p.id === first.presetId);
        if (preset) {
            this.applyPreset(preset);
            this.hub?.emit?.('preset:playlist-start', clone({ playlist: this.playlist, current: first }));
        }
    }

    clearPlaylist() {
        this.playlist = [];
        this.persistPlaylist();
        this.renderPlaylist();
    }

    exportPresets() {
        if (!this.presets.length) return;
        if (typeof window === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return;
        const blob = new Blob([JSON.stringify({ presets: this.presets }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'vib34d-performance-presets.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    importPresets(event) {
        if (typeof FileReader === 'undefined') {
            return;
        }
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                if (Array.isArray(parsed?.presets)) {
                    this.presets = parsed.presets.map(preset => ({ ...preset, id: preset.id || createId('preset') }));
                    this.persistPresets();
                    this.renderPresetList();
                    this.emitPresetListChanged();
                }
            } catch (error) {
                console.warn('Failed to import presets', error);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    getState() {
        return {
            presets: clone(this.presets),
            playlist: clone(this.playlist)
        };
    }

    applyState(state = {}) {
        if (Array.isArray(state.presets)) {
            this.presets = clone(state.presets);
            this.persistPresets();
        }
        if (Array.isArray(state.playlist)) {
            this.playlist = clone(state.playlist);
            this.persistPlaylist();
        }
        this.renderPresetList();
        this.renderPlaylist();
        this.emitPresetListChanged();
    }

    getPresetSummaries() {
        return this.presets.map(({ id, name, notes }) => ({ id, name, notes }));
    }

    getPresetById(id) {
        const preset = this.presets.find(p => p.id === id);
        return preset ? clone(preset) : null;
    }

    loadPresetById(id) {
        const preset = this.presets.find(p => p.id === id);
        if (!preset) return false;
        this.applyPreset(preset);
        return true;
    }

    emitPresetListChanged() {
        const summaries = this.getPresetSummaries();
        this.hub?.emit?.('preset:list-changed', summaries);
    }
}
