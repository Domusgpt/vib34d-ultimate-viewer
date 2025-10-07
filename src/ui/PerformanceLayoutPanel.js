import { DEFAULT_LAYOUT_CONFIG } from './PerformanceConfig.js';

function clamp(value, min, max) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return min;
    }
    return Math.min(max, Math.max(min, value));
}

export const LAYOUT_PROFILES = [
    {
        id: 'balanced',
        label: 'Balanced Grid',
        template: '1.15fr 0.95fr 1fr',
        description: 'Even distribution across control, audio, and library columns.'
    },
    {
        id: 'control-forward',
        label: 'Control Forward',
        template: '1.45fr 0.85fr 0.85fr',
        description: 'Widen the control deck for multi-touch focus while keeping other tools nearby.'
    },
    {
        id: 'audio-forward',
        label: 'Audio Forward',
        template: '0.9fr 1.45fr 0.85fr',
        description: 'Expand audio & atmosphere tools when reactive tuning is the priority.'
    },
    {
        id: 'library-forward',
        label: 'Library Forward',
        template: '0.9fr 0.85fr 1.45fr',
        description: 'Give preset management and show planning the widest column for cue-heavy sets.'
    }
];

export function getLayoutProfile(profileId) {
    return LAYOUT_PROFILES.find((profile) => profile.id === profileId) || LAYOUT_PROFILES[0];
}

export class PerformanceLayoutPanel {
    constructor({
        container = null,
        config = {},
        onChange = null,
        onReset = null,
        onPreview = null,
        onSaveProfile = null,
        onUpdateProfile = null,
        onDeleteProfile = null,
        onApplyProfile = null
    } = {}) {
        this.container = container || this.ensureContainer();
        this.onChange = typeof onChange === 'function' ? onChange : () => {};
        this.onReset = typeof onReset === 'function' ? onReset : () => {};
        this.onPreview = typeof onPreview === 'function' ? onPreview : () => {};
        this.onSaveProfile = typeof onSaveProfile === 'function' ? onSaveProfile : () => {};
        this.onUpdateProfile = typeof onUpdateProfile === 'function' ? onUpdateProfile : () => {};
        this.onDeleteProfile = typeof onDeleteProfile === 'function' ? onDeleteProfile : () => {};
        this.onApplyProfile = typeof onApplyProfile === 'function' ? onApplyProfile : () => {};
        this.state = this.normalizeState(config);
        this.inputs = {};
        this.handlers = [];
        this.previewButtons = [];
        this.previewMode = 'auto';
        this.profiles = Array.isArray(config?.profiles) ? config.profiles.slice() : [];
        this.selectedProfileId = null;
        this.profileElements = {};

        this.render();
        this.applyState(this.state);
        this.setPreviewMode(this.previewMode, { emit: false });
        this.setProfiles(this.profiles);
    }

    ensureContainer() {
        if (typeof document === 'undefined') {
            return null;
        }
        const element = document.createElement('section');
        return element;
    }

    normalizeState(state = {}) {
        const fallback = DEFAULT_LAYOUT_CONFIG || {};
        const normalized = { ...fallback, ...(state || {}) };
        normalized.density = clamp(Number(normalized.density ?? fallback.density ?? 0.45), 0, 1);
        normalized.fontScale = clamp(Number(normalized.fontScale ?? fallback.fontScale ?? 1), 0.85, 1.25);
        normalized.surfaceScale = clamp(Number(normalized.surfaceScale ?? fallback.surfaceScale ?? 1), 0.7, 1.4);
        normalized.profile = getLayoutProfile(normalized.profile)?.id || getLayoutProfile().id;
        const breakpoint = Number(normalized.mobileBreakpoint ?? fallback.mobileBreakpoint ?? 1100);
        normalized.mobileBreakpoint = clamp(Math.round(breakpoint), 720, 1600);
        const allowedPanels = ['pads', 'audio', 'presets'];
        normalized.defaultPanel = allowedPanels.includes(normalized.defaultPanel)
            ? normalized.defaultPanel
            : (fallback.defaultPanel || 'pads');
        return normalized;
    }

    render() {
        if (!this.container) return;
        this.container.classList.add('performance-block', 'performance-layout');
        this.container.innerHTML = `
            <header class="performance-block__header performance-layout__header">
                <div>
                    <h3 class="performance-block__title">Layout &amp; Display</h3>
                    <p class="performance-block__subtitle">Dial in spacing, emphasis, and mobile ergonomics.</p>
                </div>
                <button type="button" class="performance-layout__reset" data-action="reset">Reset</button>
            </header>
            <div class="performance-layout__grid">
                <div class="performance-layout__field">
                    <label class="performance-layout__label" for="performance-layout-density">Interface Density</label>
                    <input id="performance-layout-density" class="performance-layout__range" type="range" min="0" max="100" step="1" data-role="density" />
                    <div class="performance-layout__scale" aria-hidden="true">
                        <span>Airy</span>
                        <span>Compact</span>
                    </div>
                </div>
                <div class="performance-layout__field">
                    <label class="performance-layout__label" for="performance-layout-surface">
                        Pad Surface Size <span class="performance-layout__value" data-output="surface">100%</span>
                    </label>
                    <input id="performance-layout-surface" class="performance-layout__range" type="range" min="70" max="150" step="1" data-role="surface" />
                    <div class="performance-layout__scale" aria-hidden="true">
                        <span>Compact</span>
                        <span>Expanded</span>
                    </div>
                </div>
                <div class="performance-layout__field">
                    <label class="performance-layout__label" for="performance-layout-font">
                        Text Scale <span class="performance-layout__value" data-output="font">100%</span>
                    </label>
                    <input id="performance-layout-font" class="performance-layout__range" type="range" min="85" max="120" step="1" data-role="font" />
                    <div class="performance-layout__scale" aria-hidden="true">
                        <span>Smaller</span>
                        <span>Larger</span>
                    </div>
                </div>
                <div class="performance-layout__field">
                    <label class="performance-layout__label" for="performance-layout-profile">Column Emphasis</label>
                    <select id="performance-layout-profile" data-role="profile"></select>
                    <p class="performance-layout__profile-description" data-role="profile-description"></p>
                </div>
                <div class="performance-layout__field">
                    <label class="performance-layout__label" for="performance-layout-default">Default Mobile Panel</label>
                    <select id="performance-layout-default" data-role="default-panel">
                        <option value="pads">Control Deck</option>
                        <option value="audio">Audio &amp; Atmosphere</option>
                        <option value="presets">Library &amp; Planner</option>
                    </select>
                </div>
                <div class="performance-layout__field">
                    <label class="performance-layout__label" for="performance-layout-breakpoint">
                        Mobile Breakpoint <span class="performance-layout__value" data-output="breakpoint"></span>
                    </label>
                    <input id="performance-layout-breakpoint" type="number" min="720" max="1600" step="10" data-role="breakpoint" />
                    <small class="performance-layout__hint">Viewport width where tabs replace the column grid.</small>
                </div>
                <div class="performance-layout__field performance-layout__field--preview">
                    <span class="performance-layout__label">Viewport Preview</span>
                    <div class="performance-layout__preview-buttons" role="group" aria-label="Viewport preview modes">
                        <button type="button" class="performance-layout__preview" data-preview-mode="auto">Live</button>
                        <button type="button" class="performance-layout__preview" data-preview-mode="desktop">Desktop</button>
                        <button type="button" class="performance-layout__preview" data-preview-mode="tablet">Tablet</button>
                        <button type="button" class="performance-layout__preview" data-preview-mode="phone">Phone</button>
                    </div>
                    <p class="performance-layout__preview-note" data-preview-note>Follows current viewport.</p>
                </div>
                <div class="performance-layout__field performance-layout__field--profiles">
                    <label class="performance-layout__label" for="performance-layout-profile-select">Saved Layout Profiles</label>
                    <div class="performance-layout__profiles-select">
                        <select id="performance-layout-profile-select" data-role="saved-profile-select" aria-label="Saved layout profiles"></select>
                        <div class="performance-layout__profile-actions" role="group" aria-label="Saved layout profile actions">
                            <button type="button" data-action="apply-profile">Apply</button>
                            <button type="button" data-action="update-profile">Update</button>
                            <button type="button" data-action="delete-profile">Delete</button>
                        </div>
                    </div>
                    <p class="performance-layout__empty" data-role="profile-empty">No saved profiles yet.</p>
                    <p class="performance-layout__profile-description performance-layout__profile-description--saved" data-role="saved-profile-description"></p>
                    <div class="performance-layout__profile-save">
                        <input type="text" data-role="profile-name" placeholder="Profile name" maxlength="48" aria-label="Layout profile name" />
                        <button type="button" data-action="save-profile">Save New</button>
                    </div>
                    <p class="performance-layout__hint">Profiles capture density, pad surface size, text scale, column focus, mobile panel, breakpoint, and preview mode.</p>
                </div>
            </div>
        `;

        const profileSelect = this.container.querySelector('[data-role="profile"]');
        if (profileSelect) {
            profileSelect.innerHTML = LAYOUT_PROFILES.map((profile) => `
                <option value="${profile.id}">${profile.label}</option>
            `).join('');
        }

        this.inputs = {
            density: this.container.querySelector('[data-role="density"]'),
            surface: this.container.querySelector('[data-role="surface"]'),
            font: this.container.querySelector('[data-role="font"]'),
            profile: profileSelect,
            defaultPanel: this.container.querySelector('[data-role="default-panel"]'),
            breakpoint: this.container.querySelector('[data-role="breakpoint"]')
        };

        this.previewButtons = Array.from(this.container.querySelectorAll('[data-preview-mode]'));
        this.profileElements = {
            select: this.container.querySelector('[data-role="saved-profile-select"]'),
            description: this.container.querySelector('[data-role="saved-profile-description"]'),
            empty: this.container.querySelector('[data-role="profile-empty"]'),
            nameInput: this.container.querySelector('[data-role="profile-name"]'),
            save: this.container.querySelector('[data-action="save-profile"]'),
            apply: this.container.querySelector('[data-action="apply-profile"]'),
            update: this.container.querySelector('[data-action="update-profile"]'),
            delete: this.container.querySelector('[data-action="delete-profile"]')
        };

        const resetButton = this.container.querySelector('[data-action="reset"]');
        if (resetButton) {
            const handler = (event) => {
                event.preventDefault();
                this.onReset();
            };
            resetButton.addEventListener('click', handler);
            this.handlers.push({ element: resetButton, type: 'click', handler });
        }

        this.bindInputs();
        this.bindPreviewButtons();
        this.bindProfileControls();
    }

    bindInputs() {
        Object.entries(this.inputs).forEach(([key, element]) => {
            if (!element) return;
            const eventName = element.tagName === 'SELECT' ? 'change' : 'input';
            const handler = () => {
                this.state = this.normalizeState(this.readStateFromInputs());
                this.updateOutputs();
                this.onChange(this.state);
            };
            element.addEventListener(eventName, handler);
            this.handlers.push({ element, type: eventName, handler });
        });
    }

    bindPreviewButtons() {
        if (!Array.isArray(this.previewButtons) || !this.previewButtons.length) {
            return;
        }
        this.previewButtons.forEach((button) => {
            const mode = button.getAttribute('data-preview-mode');
            const handler = (event) => {
                event.preventDefault();
                this.setPreviewMode(mode, { emit: true });
            };
            button.addEventListener('click', handler);
            this.handlers.push({ element: button, type: 'click', handler });
        });
    }

    bindProfileControls() {
        const { select, save, apply, update, delete: deleteButton, nameInput } = this.profileElements || {};
        if (select) {
            const handler = () => {
                this.selectedProfileId = select.value || null;
                this.updateProfileDescription();
                this.updateProfileButtonsState();
            };
            select.addEventListener('change', handler);
            this.handlers.push({ element: select, type: 'change', handler });
        }
        if (save) {
            const handler = (event) => {
                event.preventDefault();
                const name = (nameInput?.value || '').trim();
                this.onSaveProfile({
                    name: name || null,
                    state: { ...this.state, previewMode: this.previewMode }
                });
                this.clearProfileNameInput();
            };
            save.addEventListener('click', handler);
            this.handlers.push({ element: save, type: 'click', handler });
        }
        if (apply) {
            const handler = (event) => {
                event.preventDefault();
                if (!this.selectedProfileId) return;
                this.onApplyProfile({ id: this.selectedProfileId });
            };
            apply.addEventListener('click', handler);
            this.handlers.push({ element: apply, type: 'click', handler });
        }
        if (update) {
            const handler = (event) => {
                event.preventDefault();
                if (!this.selectedProfileId) return;
                const name = (nameInput?.value || '').trim();
                this.onUpdateProfile({
                    id: this.selectedProfileId,
                    name: name || null,
                    state: { ...this.state, previewMode: this.previewMode }
                });
            };
            update.addEventListener('click', handler);
            this.handlers.push({ element: update, type: 'click', handler });
        }
        if (deleteButton) {
            const handler = (event) => {
                event.preventDefault();
                if (!this.selectedProfileId) return;
                this.onDeleteProfile({ id: this.selectedProfileId });
            };
            deleteButton.addEventListener('click', handler);
            this.handlers.push({ element: deleteButton, type: 'click', handler });
        }
    }

    setProfiles(profiles = [], { selectedId = null } = {}) {
        this.profiles = Array.isArray(profiles)
            ? profiles.filter((profile) => profile && typeof profile === 'object' && profile.id && profile.name)
            : [];
        const select = this.profileElements?.select;
        if (!select) {
            return;
        }

        const currentSelection = selectedId || this.selectedProfileId;
        let nextSelection = null;
        const options = this.profiles.map((profile) => {
            if (!nextSelection && (profile.id === currentSelection)) {
                nextSelection = profile.id;
            }
            return `<option value="${this.escapeHtml(profile.id)}">${this.escapeHtml(profile.name)}</option>`;
        });

        select.innerHTML = options.join('');
        if (!nextSelection && this.profiles.length) {
            nextSelection = this.profiles[0].id;
        }

        if (nextSelection) {
            select.removeAttribute('disabled');
            select.value = nextSelection;
            this.selectedProfileId = nextSelection;
        } else {
            select.value = '';
            select.setAttribute('disabled', 'disabled');
            this.selectedProfileId = null;
        }

        this.updateProfileDescription();
        this.updateProfileButtonsState();
        this.toggleProfileEmptyState();
    }

    toggleProfileEmptyState() {
        const hasProfiles = this.profiles.length > 0;
        const emptyMessage = this.profileElements?.empty;
        if (emptyMessage) {
            emptyMessage.style.display = hasProfiles ? 'none' : 'block';
        }
        const description = this.profileElements?.description;
        if (description) {
            description.style.display = hasProfiles ? 'block' : 'none';
        }
        const actions = [this.profileElements?.apply, this.profileElements?.update, this.profileElements?.delete];
        actions.forEach((button) => {
            if (button) {
                button.style.display = hasProfiles ? '' : 'none';
            }
        });
    }

    updateProfileButtonsState() {
        const hasSelection = Boolean(this.selectedProfileId);
        const apply = this.profileElements?.apply;
        const update = this.profileElements?.update;
        const deleteButton = this.profileElements?.delete;
        if (apply) {
            apply.disabled = !hasSelection;
        }
        if (update) {
            update.disabled = !hasSelection;
        }
        if (deleteButton) {
            deleteButton.disabled = !hasSelection;
        }
    }

    updateProfileDescription() {
        const descriptionEl = this.profileElements?.description;
        if (!descriptionEl) return;
        const profile = this.getSelectedProfile();
        if (!profile) {
            descriptionEl.textContent = '';
            return;
        }
        const summary = this.formatProfileSummary(profile);
        descriptionEl.textContent = profile.description?.trim?.() ? profile.description.trim() : summary;
    }

    getSelectedProfile() {
        if (!this.selectedProfileId) {
            return null;
        }
        return this.profiles.find((profile) => profile.id === this.selectedProfileId) || null;
    }

    formatProfileSummary(profile) {
        if (!profile || !profile.state) {
            return '';
        }
        const { density = 0.45, surfaceScale = 1, fontScale = 1, profile: profileId, defaultPanel = 'pads', mobileBreakpoint = 1100, previewMode = 'auto' } = profile.state || {};
        const densityLabel = `${Math.round(density * 100)}% density`;
        const surfaceLabel = `${Math.round(surfaceScale * 100)}% pad surface`;
        const fontLabel = `${Math.round(fontScale * 100)}% text`;
        const profileLabel = getLayoutProfile(profileId)?.label || 'Balanced grid';
        const panelLabel = defaultPanel === 'audio' ? 'Audio focus' : (defaultPanel === 'presets' ? 'Library focus' : 'Control focus');
        const breakpointLabel = `${mobileBreakpoint}px breakpoint`;
        const previewLabel = previewMode === 'auto' ? 'Live viewport' : `${previewMode.charAt(0).toUpperCase()}${previewMode.slice(1)} preview`;
        return `${profileLabel} · ${panelLabel} · ${densityLabel} · ${surfaceLabel} · ${fontLabel} · ${breakpointLabel} · ${previewLabel}`;
    }

    escapeHtml(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.replace(/[&<>"']/g, (match) => {
            switch (match) {
                case '&':
                    return '&amp;';
                case '<':
                    return '&lt;';
                case '>':
                    return '&gt;';
                case '"':
                    return '&quot;';
                case '\'':
                    return '&#39;';
                default:
                    return match;
            }
        });
    }

    clearProfileNameInput() {
        const input = this.profileElements?.nameInput;
        if (input) {
            input.value = '';
        }
    }

    readStateFromInputs() {
        const densityValue = Number(this.inputs.density?.value ?? this.state.density * 100) / 100;
        const surfaceValue = Number(this.inputs.surface?.value ?? this.state.surfaceScale * 100) / 100;
        const fontValue = Number(this.inputs.font?.value ?? this.state.fontScale * 100) / 100;
        const breakpointValue = Number(this.inputs.breakpoint?.value ?? this.state.mobileBreakpoint);
        return {
            density: densityValue,
            surfaceScale: surfaceValue,
            fontScale: fontValue,
            profile: this.inputs.profile?.value || this.state.profile,
            defaultPanel: this.inputs.defaultPanel?.value || this.state.defaultPanel,
            mobileBreakpoint: breakpointValue
        };
    }

    updateOutputs() {
        if (!this.container) return;
        const surfaceOutput = this.container.querySelector('[data-output="surface"]');
        const fontOutput = this.container.querySelector('[data-output="font"]');
        const breakpointOutput = this.container.querySelector('[data-output="breakpoint"]');
        const profileDescription = this.container.querySelector('[data-role="profile-description"]');
        const previewNote = this.container.querySelector('[data-preview-note]');

        if (surfaceOutput) {
            surfaceOutput.textContent = `${Math.round(this.state.surfaceScale * 100)}%`;
        }
        if (fontOutput) {
            fontOutput.textContent = `${Math.round(this.state.fontScale * 100)}%`;
        }
        if (breakpointOutput) {
            breakpointOutput.textContent = `${this.state.mobileBreakpoint}px`;
        }
        if (profileDescription) {
            profileDescription.textContent = getLayoutProfile(this.state.profile)?.description || '';
        }
        if (previewNote) {
            previewNote.textContent = this.getPreviewDescription(this.previewMode);
        }
    }

    applyState(state = {}) {
        this.state = this.normalizeState(state);
        if (this.inputs.density) {
            this.inputs.density.value = Math.round(this.state.density * 100);
        }
        if (this.inputs.surface) {
            this.inputs.surface.value = Math.round(this.state.surfaceScale * 100);
        }
        if (this.inputs.font) {
            this.inputs.font.value = Math.round(this.state.fontScale * 100);
        }
        if (this.inputs.profile) {
            this.inputs.profile.value = this.state.profile;
        }
        if (this.inputs.defaultPanel) {
            this.inputs.defaultPanel.value = this.state.defaultPanel;
        }
        if (this.inputs.breakpoint) {
            this.inputs.breakpoint.value = this.state.mobileBreakpoint;
        }
        this.updateOutputs();
    }

    setPreviewMode(mode, { emit = false } = {}) {
        const allowed = ['auto', 'desktop', 'tablet', 'phone'];
        const nextMode = allowed.includes(mode) ? mode : 'auto';
        this.previewMode = nextMode;
        if (Array.isArray(this.previewButtons) && this.previewButtons.length) {
            this.previewButtons.forEach((button) => {
                const buttonMode = button.getAttribute('data-preview-mode');
                const isActive = buttonMode === nextMode;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        }
        this.updateOutputs();
        if (emit) {
            this.onPreview({ mode: nextMode });
        }
    }

    getPreviewDescription(mode) {
        switch (mode) {
            case 'desktop':
                return 'Simulating 1440px desktop viewport.';
            case 'tablet':
                return 'Simulating 1024px tablet viewport (mobile layout with wider canvas).';
            case 'phone':
                return 'Simulating 428px phone viewport (mobile layout).';
            default:
                return 'Follows current viewport.';
        }
    }

    destroy() {
        this.handlers.forEach(({ element, type, handler }) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(type, handler);
            }
        });
        this.handlers = [];
        this.inputs = {};
        this.previewButtons = [];
    }
}
