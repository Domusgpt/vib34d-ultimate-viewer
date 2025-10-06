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
    constructor({ container = null, config = {}, onChange = null, onReset = null } = {}) {
        this.container = container || this.ensureContainer();
        this.onChange = typeof onChange === 'function' ? onChange : () => {};
        this.onReset = typeof onReset === 'function' ? onReset : () => {};
        this.state = this.normalizeState(config);
        this.inputs = {};
        this.handlers = [];

        this.render();
        this.applyState(this.state);
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

    destroy() {
        this.handlers.forEach(({ element, type, handler }) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(type, handler);
            }
        });
        this.handlers = [];
        this.inputs = {};
    }
}
