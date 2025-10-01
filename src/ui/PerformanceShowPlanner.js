import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

const STORAGE_AVAILABLE = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

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
        this.cues = this.loadCuesFromStorage();
        this.activeCueId = null;
        this.unsubscribe = [];

        this.render();
        this.renderCueList();
        this.attachHubListeners();
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
        if (!STORAGE_AVAILABLE || !this.config?.storageKey) {
            return [];
        }
        try {
            const raw = window.localStorage.getItem(this.config.storageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(cue => cue && cue.id && cue.presetId);
        } catch (error) {
            console.warn('PerformanceShowPlanner: failed to load cues', error);
            return [];
        }
    }

    persist() {
        if (!STORAGE_AVAILABLE || !this.config?.storageKey) {
            return;
        }
        try {
            window.localStorage.setItem(this.config.storageKey, JSON.stringify(this.cues));
        } catch (error) {
            console.warn('PerformanceShowPlanner: failed to persist cues', error);
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
    }

    renderCueItem(cue, index) {
        const item = createElement('li', 'show-planner__item');
        item.dataset.cueId = cue.id;
        if (cue.id === this.activeCueId) {
            item.classList.add('show-planner__item--active');
        }

        const details = createElement('div', 'show-planner__item-details');
        const labelParts = [cue.label];
        if (cue.timing) {
            labelParts.push(`${cue.timing} bars`);
        }
        details.innerHTML = `
            <strong>${labelParts.join(' • ')}</strong>
            <span>${cue.presetName || cue.presetId}</span>
            ${cue.notes ? `<p>${this.escapeHtml(cue.notes)}</p>` : ''}
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

    triggerCue(cue) {
        if (!cue) return;
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
        this.renderCueList();
        if (this.hub) {
            this.hub.emit('showplanner-cue-triggered', {
                cue: clone(cue),
                preset: clone(preset)
            });
        }
    }

    deleteCue(id) {
        const next = this.cues.filter(cue => cue.id !== id);
        if (next.length === this.cues.length) return;
        this.cues = next;
        if (this.activeCueId === id) {
            this.activeCueId = null;
        }
        this.persist();
        this.renderCueList();
        if (this.hub) {
            this.hub.emit('showplanner-cue-removed', { id });
        }
    }

    moveCue(id, offset) {
        const index = this.cues.findIndex(cue => cue.id === id);
        if (index === -1) return;
        const targetIndex = index + offset;
        if (targetIndex < 0 || targetIndex >= this.cues.length) return;
        const [cue] = this.cues.splice(index, 1);
        this.cues.splice(targetIndex, 0, cue);
        this.persist();
        this.renderCueList();
    }

    clearAllCues() {
        if (!this.cues.length) return;
        this.cues = [];
        this.activeCueId = null;
        this.persist();
        this.renderCueList();
        if (this.hub) {
            this.hub.emit('showplanner-cleared');
        }
    }

    markActiveCueByPreset(presetId) {
        if (!presetId) return;
        const cue = this.cues.find(item => item.presetId === presetId);
        if (cue) {
            this.activeCueId = cue.id;
            this.renderCueList();
        }
    }

    handlePresetRemoval(presetId) {
        if (!presetId) return;
        const before = this.cues.length;
        this.cues = this.cues.filter(cue => cue.presetId !== presetId);
        if (before !== this.cues.length) {
            if (this.activeCueId && !this.cues.some(cue => cue.id === this.activeCueId)) {
                this.activeCueId = null;
            }
            this.persist();
            this.renderCueList();
        }
        this.refreshPresetOptions();
    }

    applyState(state = {}) {
        if (!state || !Array.isArray(state.cues)) return;
        this.cues = state.cues.map(cue => ({ ...cue })).filter(cue => cue.id && cue.presetId);
        this.activeCueId = state.activeCueId || null;
        this.persist();
        this.renderCueList();
        this.refreshPresetOptions();
    }

    getState() {
        return {
            cues: this.cues.map(cue => ({ ...cue })),
            activeCueId: this.activeCueId
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
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
    }
}
