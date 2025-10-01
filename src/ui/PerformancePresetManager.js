import { DEFAULT_PERFORMANCE_CONFIG } from './PerformanceConfig.js';

const STORAGE_AVAILABLE = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function clone(value) {
    return JSON.parse(JSON.stringify(value));
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
        this.presets = this.loadPresetsFromStorage();

        this.render();
        this.renderPresetList();
    }

    findPresetById(id) {
        if (!id || !Array.isArray(this.presets)) {
            return null;
        }
        return this.presets.find(preset => preset.id === id) || null;
    }

    applyPresetById(id) {
        const preset = this.findPresetById(id);
        if (!preset) {
            return false;
        }
        this.applyPreset(preset);
        return true;
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

    render() {
        if (!this.container) return;
        this.container.classList.add('performance-block');
        this.container.innerHTML = '';

        const header = document.createElement('header');
        header.className = 'performance-block__header';
        header.innerHTML = `
            <div>
                <h3 class="performance-block__title">Presets</h3>
                <p class="performance-block__subtitle">Capture mappings, parameters and audio settings to rehearse choreography or swap shows instantly.</p>
            </div>
        `;
        this.container.appendChild(header);

        const createRow = document.createElement('div');
        createRow.className = 'preset-create-row';
        createRow.innerHTML = `
            <input type="text" class="preset-input" placeholder="Preset name">
            <button type="button" class="preset-save">Save Preset</button>
        `;
        const saveButton = createRow.querySelector('.preset-save');
        const input = createRow.querySelector('.preset-input');
        saveButton.addEventListener('click', () => {
            const name = input.value.trim();
            if (!name) {
                input.focus();
                input.classList.add('is-invalid');
                return;
            }
            input.classList.remove('is-invalid');
            this.savePreset(name);
            input.value = '';
        });
        input.addEventListener('input', () => input.classList.remove('is-invalid'));
        this.container.appendChild(createRow);

        const list = document.createElement('ul');
        list.className = 'preset-list';
        this.container.appendChild(list);
        this.listElement = list;
    }

    renderPresetList() {
        if (!this.listElement) return;
        this.listElement.innerHTML = '';

        if (!Array.isArray(this.presets) || this.presets.length === 0) {
            const emptyState = document.createElement('li');
            emptyState.className = 'preset-empty';
            emptyState.textContent = 'No presets saved yet. Create one after dialling in a look.';
            this.listElement.appendChild(emptyState);
            return;
        }

        const escapeHtml = (value) => String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        this.presets.forEach(preset => {
            const item = document.createElement('li');
            item.className = 'preset-item';
            const layoutPresetId = preset.touchPads?.layoutPresetId || preset.layoutPresetId || null;
            const layoutLabel = this.findLayoutPresetLabel(layoutPresetId);
            const padLabels = (preset.touchPads?.mappings || preset.mappings || [])
                .map(mapping => mapping.label || mapping.id)
                .filter(Boolean)
                .slice(0, 3);
            const padCount = typeof preset.touchPads?.padCount === 'number'
                ? preset.touchPads.padCount
                : Array.isArray(preset.mappings)
                    ? preset.mappings.length
                    : null;
            const summaryParts = [];
            if (padLabels.length) {
                summaryParts.push(padLabels.join(' • '));
            } else {
                summaryParts.push('No pad mappings saved');
            }
            if (padCount) {
                summaryParts.push(`${padCount} pad${padCount === 1 ? '' : 's'}`);
            }
            if (layoutLabel) {
                summaryParts.push(layoutLabel);
            }
            const padSummary = summaryParts.map(escapeHtml).join(' • ');
            item.innerHTML = `
                <div class="preset-item__details">
                    <strong>${escapeHtml(preset.name)}</strong>
                    <span>${new Date(preset.createdAt).toLocaleString()}</span>
                    <small class="preset-item__summary">${padSummary}</small>
                </div>
                <div class="preset-item__actions">
                    <button type="button" data-action="load">Load</button>
                    <button type="button" data-action="delete">Delete</button>
                </div>
            `;

            item.querySelector('[data-action="load"]').addEventListener('click', () => this.applyPreset(preset));
            item.querySelector('[data-action="delete"]').addEventListener('click', () => this.deletePreset(preset.id));
            this.listElement.appendChild(item);
        });
    }

    collectState() {
        const parameters = this.parameterManager?.getAllParameters?.() || {};
        const touchPadState = this.touchPadController?.getState?.();
        const mappings = touchPadState?.mappings
            || this.touchPadController?.getMappings?.()
            || [];
        const layout = touchPadState?.layout
            || this.touchPadController?.getLayoutSettings?.()
            || null;
        const layoutPresetId = touchPadState?.layoutPresetId
            || this.touchPadController?.activeLayoutPresetId
            || null;
        const audio = this.audioPanel?.getSettings?.() || {};
        return {
            parameters,
            mappings,
            layout,
            layoutPresetId,
            audio,
            touchPads: touchPadState ? clone(touchPadState) : { mappings, layout }
        };
    }

    savePreset(name) {
        const state = this.collectState();
        const preset = {
            id: `preset-${Date.now()}`,
            name,
            createdAt: Date.now(),
            ...state
        };
        this.presets.unshift(preset);
        this.persist();
        this.renderPresetList();
        if (this.hub) {
            this.hub.emit('preset-saved', { preset: clone(preset) });
        }
    }

    applyPreset(preset) {
        if (!preset) return;

        if (this.parameterManager && preset.parameters) {
            this.parameterManager.setParameters(preset.parameters, { source: 'preset' });
        }
        if (this.touchPadController) {
            if (preset.touchPads && this.touchPadController.applyState) {
                this.touchPadController.applyState(preset.touchPads);
            } else {
                if (preset.mappings) {
                    this.touchPadController.applyMappings(preset.mappings);
                }
                if (preset.layout && this.touchPadController.applyLayout) {
                    this.touchPadController.applyLayout(preset.layout);
                }
            }
        }
        if (this.audioPanel && preset.audio) {
            this.audioPanel.applySettings(preset.audio);
        }

        if (this.hub) {
            this.hub.emit('preset-applied', { preset: clone(preset) });
        }
    }

    deletePreset(id) {
        this.presets = this.presets.filter(preset => preset.id !== id);
        this.persist();
        this.renderPresetList();
        if (this.hub) {
            this.hub.emit('preset-deleted', { id });
        }
    }

    findLayoutPresetLabel(layoutPresetId) {
        if (!layoutPresetId) return '';
        if (layoutPresetId === 'custom') {
            return 'Custom layout';
        }
        const presets = this.touchPadController?.layoutPresets || [];
        const match = presets.find(preset => preset.id === layoutPresetId);
        return match?.label || '';
    }

    loadPresetsFromStorage() {
        if (!STORAGE_AVAILABLE) return [];
        try {
            const raw = window.localStorage.getItem(this.config.storageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('Failed to load performance presets', error);
            return [];
        }
    }

    persist() {
        if (!STORAGE_AVAILABLE) return;
        try {
            window.localStorage.setItem(this.config.storageKey, JSON.stringify(this.presets));
        } catch (error) {
            console.warn('Failed to persist presets', error);
        }
    }

    getState() {
        return {
            presets: clone(this.presets)
        };
    }
}
