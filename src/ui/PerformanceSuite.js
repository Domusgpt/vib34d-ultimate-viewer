import { TouchPadController } from './TouchPadController.js';
import { AudioReactivityPanel } from './AudioReactivityPanel.js';
import { PerformancePresetManager } from './PerformancePresetManager.js';
import { PerformanceHub } from './PerformanceHub.js';
import { mergePerformanceConfig, DEFAULT_LAYOUT_CONFIG } from './PerformanceConfig.js';
import { PerformanceShowPlanner } from './PerformanceShowPlanner.js';
import { PerformanceThemePanel } from './PerformanceThemePanel.js';
import { normalizeThemeState, normalizeThemeTransition, DEFAULT_THEME_TRANSITION } from './PerformanceThemeUtils.js';
import { PerformanceMidiBridge } from './PerformanceMidiBridge.js';
import { PerformanceGestureRecorder } from './PerformanceGestureRecorder.js';
import { PerformanceTelemetryPanel } from './PerformanceTelemetryPanel.js';
import { PerformanceOscBridge } from './PerformanceOscBridge.js';
import { PerformanceLayoutPanel, getLayoutProfile } from './PerformanceLayoutPanel.js';

function clampBetween(value, min, max) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return min;
    }
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

const PREVIEW_WIDTHS = {
    desktop: 1440,
    tablet: 1024,
    phone: 428
};

const PREVIEW_LABELS = {
    auto: 'Live viewport',
    desktop: 'Desktop preview · 1440px',
    tablet: 'Tablet preview · 1024px',
    phone: 'Phone preview · 428px'
};

export class PerformanceSuite {
    constructor({ engine = null, parameterManager = null, config = {}, themeContext = {} } = {}) {
        this.engine = engine;
        this.parameterManager = parameterManager;
        this.config = mergePerformanceConfig(config);
        this.themeContext = themeContext || {};
        this.layoutDefaults = this.sanitizeLayoutState(DEFAULT_LAYOUT_CONFIG);
        this.layoutConfig = this.normalizeLayoutConfig(this.config?.layout);
        this.columnLabels = {
            pads: 'Control Deck',
            audio: 'Audio & Atmosphere',
            presets: 'Library & Planner'
        };
        this.stackLabels = {
            touchpads: 'Touch Pads & Layout',
            telemetry: 'Telemetry & Diagnostics',
            gestures: 'Gesture Recorder',
            theme: 'Color Atmosphere',
            audio: 'Audio Reactivity',
            hardware: 'Hardware Bridge',
            network: 'Network Bridge',
            presets: 'Preset Library',
            planner: 'Show Planner'
        };
        this.transitionDefaults = normalizeThemeTransition(
            this.config?.theme?.transitionDefaults,
            DEFAULT_THEME_TRANSITION
        );

        this.hub = new PerformanceHub({ engine: this.engine, parameterManager: this.parameterManager });
        this.root = null;
        this.layoutPanel = null;
        this.touchPadController = null;
        this.audioPanel = null;
        this.presetManager = null;
        this.subscriptions = [];
        this.showPlanner = null;
        this.themePanel = null;
        this.hardwareBridge = null;
        this.gestureRecorder = null;
        this.telemetryPanel = null;
        this.oscBridge = null;
        this.mobileTabs = null;
        this.mobileTabButtons = [];
        this.onMobileTabClick = null;
        this.onResize = null;
        this.collapsibleStacks = [];
        this.responsive = {
            mode: 'desktop',
            activePanel: this.layoutConfig.defaultPanel,
            breakpoint: this.layoutConfig.mobileBreakpoint
        };
        this.previewState = {
            mode: this.layoutConfig?.previewMode || 'auto',
            width: null
        };

        this.mountLayout();
        this.applyLayoutState(this.layoutConfig, { persist: false, silentStatus: true, updatePanel: false });
        this.syncPreviewWidth();
        this.setupResponsiveBehavior();
        this.setupCollapsibleStacks();
        this.initModules();
    }

    normalizeLayoutConfig(layout = {}) {
        const defaults = this.sanitizeLayoutState({ ...this.layoutDefaults, ...(DEFAULT_LAYOUT_CONFIG || {}) }, this.layoutDefaults);
        const merged = this.sanitizeLayoutState({ ...defaults, ...(layout || {}) }, defaults);
        const stored = this.loadStoredLayoutState(merged.storageKey, merged);
        if (stored) {
            return this.sanitizeLayoutState({ ...merged, ...stored }, merged);
        }
        return merged;
    }

    resolveLayoutProfile(profileId) {
        return getLayoutProfile(profileId);
    }

    sanitizeLayoutState(state = {}, fallback = {}) {
        const base = { ...(fallback || {}) };
        const allowedPanels = ['pads', 'audio', 'presets'];
        const storageKeyCandidate = state.storageKey ?? base.storageKey ?? DEFAULT_LAYOUT_CONFIG?.storageKey;
        const storageKey = typeof storageKeyCandidate === 'string' && storageKeyCandidate.trim().length
            ? storageKeyCandidate
            : 'vib34d-performance-layout';

        const profile = this.resolveLayoutProfile(state.profile)?.id
            || this.resolveLayoutProfile(base.profile)?.id
            || getLayoutProfile().id;

        const normalizeNumber = (value, defaultValue, min, max) => {
            const source = typeof value === 'number' && !Number.isNaN(value)
                ? value
                : (typeof defaultValue === 'number' && !Number.isNaN(defaultValue) ? defaultValue : undefined);
            if (typeof source !== 'number' || Number.isNaN(source)) {
                return clampBetween((min + max) / 2, min, max);
            }
            return clampBetween(source, min, max);
        };

        const density = normalizeNumber(state.density, base.density ?? 0.45, 0, 1);
        const fontScale = normalizeNumber(state.fontScale, base.fontScale ?? 1, 0.85, 1.25);
        const surfaceScale = normalizeNumber(state.surfaceScale, base.surfaceScale ?? 1, 0.7, 1.4);
        const mobileBreakpoint = Math.round(normalizeNumber(state.mobileBreakpoint, base.mobileBreakpoint ?? 1100, 720, 1600));

        const collapsedStacks = Array.isArray(state.collapsedStacks)
            ? state.collapsedStacks.filter(Boolean)
            : (Array.isArray(base.collapsedStacks) ? base.collapsedStacks.slice() : []);

        const defaultPanel = allowedPanels.includes(state.defaultPanel)
            ? state.defaultPanel
            : (allowedPanels.includes(base.defaultPanel) ? base.defaultPanel : 'pads');

        const allowedPreviewModes = ['auto', 'desktop', 'tablet', 'phone'];
        const previewMode = allowedPreviewModes.includes(state.previewMode)
            ? state.previewMode
            : (allowedPreviewModes.includes(base.previewMode) ? base.previewMode : 'auto');

        return {
            storageKey,
            profile,
            density,
            fontScale,
            surfaceScale,
            mobileBreakpoint,
            collapsedStacks,
            defaultPanel,
            previewMode
        };
    }

    loadStoredLayoutState(storageKey, fallback = {}) {
        if (typeof window === 'undefined' || !window.localStorage || !storageKey) {
            return null;
        }
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw);
            return this.sanitizeLayoutState(parsed, fallback);
        } catch (error) {
            console.warn('PerformanceSuite failed to load layout state', error);
            return null;
        }
    }

    persistLayoutState(state = null) {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        const storageKey = (state && state.storageKey) || this.layoutConfig?.storageKey;
        if (!storageKey) {
            return;
        }
        try {
            const payload = JSON.stringify(this.getLayoutState(state || this.layoutConfig));
            window.localStorage.setItem(storageKey, payload);
        } catch (error) {
            console.warn('PerformanceSuite failed to persist layout state', error);
        }
    }

    getLayoutState(source = this.layoutConfig) {
        const base = source || this.layoutDefaults || {};
        return this.sanitizeLayoutState(base, this.layoutDefaults);
    }

    applyLayoutState(state = {}, { persist = true, silentStatus = false, updatePanel = true } = {}) {
        const previousDefaultPanel = this.layoutConfig?.defaultPanel;
        const normalized = this.sanitizeLayoutState(
            { ...(this.layoutConfig || this.layoutDefaults), ...(state || {}) },
            this.layoutDefaults
        );
        this.layoutConfig = normalized;
        this.responsive.breakpoint = normalized.mobileBreakpoint;
        this.previewState.mode = normalized.previewMode || 'auto';

        if (this.root) {
            this.root.dataset.layoutProfile = normalized.profile;
            const profile = this.resolveLayoutProfile(normalized.profile);
            if (profile?.template) {
                this.root.style.setProperty('--performance-column-template', profile.template);
            }

            const airy = 1 - normalized.density;
            const columnGap = Math.round(18 + airy * 14);
            const stackGap = Math.round(18 + airy * 10);
            const stackBodyGap = Math.round(16 + airy * 8);
            const blockPadding = Math.round(18 + airy * 6);
            const blockGap = Math.round(14 + airy * 6);
            const padGridGap = Math.round(16 + airy * 6);
            const shellPadding = Math.round(22 + airy * 8);
            const padMinWidth = Math.round(220 * normalized.surfaceScale);
            const padSurfaceHeight = Math.round(180 * normalized.surfaceScale);

            this.root.style.setProperty('--performance-column-gap', `${columnGap}px`);
            this.root.style.setProperty('--performance-stack-gap', `${stackGap}px`);
            this.root.style.setProperty('--performance-stack-body-gap', `${stackBodyGap}px`);
            this.root.style.setProperty('--performance-block-padding', `${blockPadding}px`);
            this.root.style.setProperty('--performance-block-gap', `${blockGap}px`);
            this.root.style.setProperty('--performance-pad-grid-gap', `${padGridGap}px`);
            this.root.style.setProperty('--performance-shell-padding', `${shellPadding}px`);
            this.root.style.setProperty('--performance-font-scale', normalized.fontScale.toFixed(3));
            this.root.style.setProperty('--performance-pad-min-width', `${padMinWidth}px`);
            this.root.style.setProperty('--performance-pad-surface-height', `${padSurfaceHeight}px`);

            const collapsedSet = new Set(normalized.collapsedStacks || []);
            const stacks = Array.from(this.root.querySelectorAll('.performance-suite__stack'));
            stacks.forEach((stack) => {
                const target = stack.getAttribute('data-stack');
                if (!target) return;
                const button = stack.querySelector('[data-action="toggle-stack"]');
                const body = stack.querySelector('.performance-suite__stack-body');
                const shouldCollapse = collapsedSet.has(target);
                this.setStackCollapsed(stack, button, body, shouldCollapse);
            });
        }

        if (this.layoutPanel && updatePanel) {
            this.layoutPanel.applyState(normalized);
            this.layoutPanel.setPreviewMode(normalized.previewMode, { emit: false });
        }

        if (persist) {
            this.persistLayoutState(normalized);
        }

        this.syncPreviewWidth();

        if (!silentStatus) {
            const profile = this.resolveLayoutProfile(normalized.profile);
            this.updateStatus(`${profile?.label || 'Layout'} updated`);
        }

        if (this.onResize) {
            this.onResize();
        }

        if (this.responsive.mode === 'mobile') {
            const shouldUpdateActivePanel = !this.responsive.activePanel
                || this.responsive.activePanel === previousDefaultPanel;
            if (shouldUpdateActivePanel) {
                this.setActivePanel(normalized.defaultPanel, { silent: true });
            }
        }
    }

    syncCollapsedStack(target, collapsed, { persist = true } = {}) {
        if (!target) {
            return;
        }
        const set = new Set(this.layoutConfig?.collapsedStacks || []);
        if (collapsed) {
            set.add(target);
        } else {
            set.delete(target);
        }
        this.layoutConfig.collapsedStacks = Array.from(set);
        if (persist) {
            this.persistLayoutState();
        }
    }

    mountLayout() {
        if (typeof document === 'undefined') return;
        const host = document.getElementById('controlPanel') || document.body;
        this.root = document.createElement('section');
        this.root.className = 'performance-suite';
        this.root.innerHTML = `
            <header class="performance-suite__header">
                <div>
                    <h2>Live Performance Suite</h2>
                    <p>Designed for DJs, bands, and visual operators performing in sync.</p>
                </div>
                <div class="performance-suite__status" data-role="status">Ready</div>
            </header>
            <nav class="performance-suite__mobile-tabs" data-role="mobile-tabs" aria-label="Performance suite navigation">
                <button type="button" data-panel="pads" class="is-active" aria-pressed="true">Control Deck</button>
                <button type="button" data-panel="audio" aria-pressed="false">Audio &amp; Atmosphere</button>
                <button type="button" data-panel="presets" aria-pressed="false">Library &amp; Planner</button>
            </nav>
            <div class="performance-suite__columns">
                <section class="performance-suite__column performance-suite__column--pads" data-panel="pads">
                    <article class="performance-suite__stack" data-stack="touchpads">
                        <button class="performance-suite__stack-toggle" data-action="toggle-stack" data-target="touchpads" aria-expanded="true" aria-controls="performance-stack-body-touchpads" type="button">
                            <span class="performance-suite__stack-title">Touch Pads &amp; Layout</span>
                            <span class="performance-suite__stack-meta">Multi-touch surfaces, templates, and axis response</span>
                            <span class="performance-suite__stack-icon" aria-hidden="true"></span>
                        </button>
                        <div class="performance-suite__stack-body" id="performance-stack-body-touchpads" data-role="touchpads-stack">
                            <div data-role="layout"></div>
                            <div data-role="pads"></div>
                        </div>
                    </article>
                    <article class="performance-suite__stack" data-stack="telemetry">
                        <button class="performance-suite__stack-toggle" data-action="toggle-stack" data-target="telemetry" aria-expanded="true" aria-controls="performance-stack-body-telemetry" type="button">
                            <span class="performance-suite__stack-title">Telemetry &amp; Diagnostics</span>
                            <span class="performance-suite__stack-meta">Rotation energy, control pulses, and history traces</span>
                            <span class="performance-suite__stack-icon" aria-hidden="true"></span>
                        </button>
                        <div class="performance-suite__stack-body" id="performance-stack-body-telemetry" data-role="telemetry"></div>
                    </article>
                    <article class="performance-suite__stack" data-stack="gestures">
                        <button class="performance-suite__stack-toggle" data-action="toggle-stack" data-target="gestures" aria-expanded="true" aria-controls="performance-stack-body-gestures" type="button">
                            <span class="performance-suite__stack-title">Gesture Recorder</span>
                            <span class="performance-suite__stack-meta">Capture, replay, and export curated flourishes</span>
                            <span class="performance-suite__stack-icon" aria-hidden="true"></span>
                        </button>
                        <div class="performance-suite__stack-body" id="performance-stack-body-gestures" data-role="gestures"></div>
                    </article>
                </section>
                <section class="performance-suite__column performance-suite__column--audio" data-panel="audio">
                    <article class="performance-suite__stack" data-stack="theme">
                        <button class="performance-suite__stack-toggle" data-action="toggle-stack" data-target="theme" aria-expanded="true" aria-controls="performance-stack-body-theme" type="button">
                            <span class="performance-suite__stack-title">Color Atmosphere</span>
                            <span class="performance-suite__stack-meta">Palettes, glow strength, and transition timing</span>
                            <span class="performance-suite__stack-icon" aria-hidden="true"></span>
                        </button>
                        <div class="performance-suite__stack-body" id="performance-stack-body-theme" data-role="theme"></div>
                    </article>
                    <article class="performance-suite__stack" data-stack="audio">
                        <button class="performance-suite__stack-toggle" data-action="toggle-stack" data-target="audio" aria-expanded="true" aria-controls="performance-stack-body-audio" type="button">
                            <span class="performance-suite__stack-title">Audio Reactivity</span>
                            <span class="performance-suite__stack-meta">Band weighting, smoothing, and flourish triggers</span>
                            <span class="performance-suite__stack-icon" aria-hidden="true"></span>
                        </button>
                        <div class="performance-suite__stack-body" id="performance-stack-body-audio" data-role="audio"></div>
                    </article>
                    <article class="performance-suite__stack" data-stack="hardware">
                        <button class="performance-suite__stack-toggle" data-action="toggle-stack" data-target="hardware" aria-expanded="true" aria-controls="performance-stack-body-hardware" type="button">
                            <span class="performance-suite__stack-title">Hardware Bridge</span>
                            <span class="performance-suite__stack-meta">MIDI device discovery, smoothing, and mappings</span>
                            <span class="performance-suite__stack-icon" aria-hidden="true"></span>
                        </button>
                        <div class="performance-suite__stack-body" id="performance-stack-body-hardware" data-role="hardware"></div>
                    </article>
                    <article class="performance-suite__stack" data-stack="network">
                        <button class="performance-suite__stack-toggle" data-action="toggle-stack" data-target="network" aria-expanded="true" aria-controls="performance-stack-body-network" type="button">
                            <span class="performance-suite__stack-title">Network Bridge</span>
                            <span class="performance-suite__stack-meta">OSC/WebSocket relays and remote diagnostics</span>
                            <span class="performance-suite__stack-icon" aria-hidden="true"></span>
                        </button>
                        <div class="performance-suite__stack-body" id="performance-stack-body-network" data-role="network"></div>
                    </article>
                </section>
                <section class="performance-suite__column performance-suite__column--presets" data-panel="presets">
                    <article class="performance-suite__stack" data-stack="presets">
                        <button class="performance-suite__stack-toggle" data-action="toggle-stack" data-target="presets" aria-expanded="true" aria-controls="performance-stack-body-presets" type="button">
                            <span class="performance-suite__stack-title">Preset Library</span>
                            <span class="performance-suite__stack-meta">Snapshots, playlists, and theme-aware summaries</span>
                            <span class="performance-suite__stack-icon" aria-hidden="true"></span>
                        </button>
                        <div class="performance-suite__stack-body" id="performance-stack-body-presets" data-role="presets"></div>
                    </article>
                    <article class="performance-suite__stack" data-stack="planner">
                        <button class="performance-suite__stack-toggle" data-action="toggle-stack" data-target="planner" aria-expanded="true" aria-controls="performance-stack-body-planner" type="button">
                            <span class="performance-suite__stack-title">Show Planner</span>
                            <span class="performance-suite__stack-meta">Cue stacks, tempo, timeline, and playback controls</span>
                            <span class="performance-suite__stack-icon" aria-hidden="true"></span>
                        </button>
                        <div class="performance-suite__stack-body" id="performance-stack-body-planner" data-role="planner"></div>
                    </article>
                </section>
            </div>
        `;
        host.appendChild(this.root);

        this.statusEl = this.root.querySelector('[data-role="status"]');
        this.layoutContainer = this.root.querySelector('[data-role="layout"]');
        this.touchpadContainer = this.root.querySelector('[data-role="pads"]')
            || this.root.querySelector('.performance-suite__column--pads');
        this.telemetryContainer = this.root.querySelector('[data-role="telemetry"]')
            || this.root.querySelector('.performance-suite__column--pads');
        this.gestureContainer = this.root.querySelector('[data-role="gestures"]')
            || this.root.querySelector('.performance-suite__column--pads');
        this.audioColumn = this.root.querySelector('.performance-suite__column--audio');
        this.themeContainer = this.root.querySelector('[data-role="theme"]');
        this.audioContainer = this.root.querySelector('[data-role="audio"]');
        this.hardwareContainer = this.root.querySelector('[data-role="hardware"]');
        this.networkContainer = this.root.querySelector('[data-role="network"]');
        this.presetsContainer = this.root.querySelector('[data-role="presets"]');
        this.showPlannerContainer = this.root.querySelector('[data-role="planner"]');
    }

    setupResponsiveBehavior() {
        if (!this.root) return;

        this.mobileTabs = this.root.querySelector('[data-role="mobile-tabs"]');
        this.mobileTabButtons = this.mobileTabs
            ? Array.from(this.mobileTabs.querySelectorAll('button[data-panel]'))
            : [];

        this.setActivePanel(this.responsive.activePanel || this.layoutConfig.defaultPanel, { silent: true });

        if (this.mobileTabs) {
            this.onMobileTabClick = (event) => {
                const button = event.target.closest('button[data-panel]');
                if (!button) return;
                const target = button.getAttribute('data-panel');
                if (!target) return;
                this.setActivePanel(target);
            };
            this.mobileTabs.addEventListener('click', this.onMobileTabClick);
        }

        if (typeof window !== 'undefined') {
            this.onResize = () => {
                const viewportWidth = this.getViewportWidth();
                if (this.previewState.mode === 'auto') {
                    this.previewState.width = viewportWidth;
                    this.syncPreviewWidth();
                }
                const mode = this.determineResponsiveMode(viewportWidth);
                this.applyResponsiveMode(mode);
            };
            window.addEventListener('resize', this.onResize);
            this.onResize();
        } else {
            this.applyResponsiveMode('desktop');
        }
    }

    setActivePanel(panel, { silent = false } = {}) {
        if (!panel) {
            return;
        }
        this.responsive.activePanel = panel;
        if (this.root) {
            this.root.dataset.activePanel = panel;
        }
        if (Array.isArray(this.mobileTabButtons) && this.mobileTabButtons.length) {
            this.mobileTabButtons.forEach((button) => {
                const isActive = button.getAttribute('data-panel') === panel;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        }
        if (!silent && this.responsive.mode === 'mobile') {
            const label = this.columnLabels[panel] || 'panel';
            this.updateStatus(`Viewing ${label}`);
        }
    }

    applyResponsiveMode(mode) {
        const nextMode = mode === 'mobile' ? 'mobile' : 'desktop';
        if (this.root) {
            this.root.dataset.layoutMode = nextMode;
        }
        this.responsive.mode = nextMode;
        if (this.mobileTabs) {
            this.mobileTabs.hidden = nextMode !== 'mobile';
        }
        if (nextMode === 'mobile') {
            this.setActivePanel(this.responsive.activePanel || this.layoutConfig.defaultPanel, { silent: true });
            if (this.mobileTabs) {
                this.mobileTabs.setAttribute('aria-hidden', 'false');
            }
        } else if (this.mobileTabs) {
            this.mobileTabs.setAttribute('aria-hidden', 'true');
        }
    }

    getViewportWidth() {
        if (typeof window === 'undefined') {
            return this.previewState.width || 0;
        }
        return window.innerWidth || document.documentElement?.clientWidth || 0;
    }

    getPreviewWidth(mode) {
        const width = PREVIEW_WIDTHS[mode];
        return typeof width === 'number' && !Number.isNaN(width) ? width : null;
    }

    determineResponsiveMode(viewportWidth) {
        if (this.previewState.mode && this.previewState.mode !== 'auto') {
            return this.previewState.mode === 'desktop' ? 'desktop' : 'mobile';
        }
        const breakpoint = this.responsive.breakpoint || this.layoutConfig.mobileBreakpoint;
        return viewportWidth <= breakpoint ? 'mobile' : 'desktop';
    }

    getPreviewLabel(mode) {
        return PREVIEW_LABELS[mode] || PREVIEW_LABELS.auto;
    }

    syncPreviewWidth() {
        if (!this.root) {
            return;
        }
        const mode = this.previewState.mode || 'auto';
        let width = null;
        if (mode === 'auto') {
            width = this.getViewportWidth();
            this.root.classList.remove('performance-suite--preview-active');
            this.root.style.removeProperty('--performance-suite-preview-width');
            this.root.dataset.previewLabel = '';
        } else {
            width = this.getPreviewWidth(mode);
            if (typeof width === 'number') {
                this.root.style.setProperty('--performance-suite-preview-width', `${width}px`);
            }
            this.root.classList.add('performance-suite--preview-active');
            this.root.dataset.previewLabel = this.getPreviewLabel(mode).toUpperCase();
        }
        this.root.dataset.previewMode = mode;
        this.previewState.width = width;
    }

    applyPreviewMode(mode, { silent = false, fromPanel = false } = {}) {
        const allowed = ['auto', 'desktop', 'tablet', 'phone'];
        const nextMode = allowed.includes(mode) ? mode : 'auto';
        const previousMode = this.previewState.mode;
        this.previewState.mode = nextMode;
        if (!fromPanel && this.layoutPanel?.setPreviewMode) {
            this.layoutPanel.setPreviewMode(nextMode, { emit: false });
        }
        this.syncPreviewWidth();
        const viewportWidth = this.getViewportWidth();
        const layoutMode = this.determineResponsiveMode(viewportWidth);
        this.applyResponsiveMode(layoutMode);
        if (this.layoutConfig) {
            this.layoutConfig.previewMode = nextMode;
            if (nextMode !== previousMode) {
                this.persistLayoutState(this.layoutConfig);
            }
        }
        if (!silent && nextMode !== previousMode) {
            const label = this.getPreviewLabel(nextMode);
            this.updateStatus(`Viewport preview: ${label}`);
        }
    }

    setupCollapsibleStacks() {
        if (!this.root) return;
        const defaults = new Set(this.layoutConfig.collapsedStacks || []);
        const stacks = Array.from(this.root.querySelectorAll('.performance-suite__stack'));
        stacks.forEach((stack) => {
            const target = stack.getAttribute('data-stack');
            const button = stack.querySelector('[data-action="toggle-stack"]');
            const body = stack.querySelector('.performance-suite__stack-body');
            if (!button || !body) {
                return;
            }
            const initialCollapsed = defaults.has(target);
            this.setStackCollapsed(stack, button, body, initialCollapsed);
            this.syncCollapsedStack(target, initialCollapsed, { persist: false });
            const handler = () => {
                const wasCollapsed = stack.classList.contains('is-collapsed');
                const nextCollapsed = !wasCollapsed;
                this.setStackCollapsed(stack, button, body, nextCollapsed);
                this.syncCollapsedStack(target, nextCollapsed);
                const label = this.stackLabels[target] || 'section';
                this.updateStatus(`${label} ${nextCollapsed ? 'collapsed' : 'expanded'}`);
            };
            button.addEventListener('click', handler);
            this.collapsibleStacks.push({ button, handler });
        });
    }

    setStackCollapsed(stack, button, body, collapsed) {
        const isCollapsed = Boolean(collapsed);
        stack.classList.toggle('is-collapsed', isCollapsed);
        if (button) {
            button.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
        }
        if (body) {
            body.setAttribute('aria-hidden', isCollapsed ? 'true' : 'false');
        }
    }

    initModules() {
        if (!this.touchpadContainer || !this.audioContainer || !this.presetsContainer || !this.showPlannerContainer) {
            return;
        }

        if (this.themeContainer || this.audioColumn) {
            this.themePanel = new PerformanceThemePanel({
                container: this.themeContainer || this.audioColumn,
                config: this.config.theme,
                context: this.themeContext,
                onThemeChange: (state) => this.applyThemeState(state, { notifyHost: true })
            });

            let initialTheme = this.themeContext?.themeState;
            if ((!initialTheme || (initialTheme.paletteId === 'system' && !initialTheme.overrides)) && this.config?.theme?.storageKey) {
                const storedTheme = this.loadStoredThemeState();
                if (storedTheme) {
                    initialTheme = storedTheme;
                }
            }

            if (!initialTheme) {
                initialTheme = { paletteId: 'system' };
            }
            this.applyThemeState(initialTheme, { notifyHost: true, silentStatus: true });
        }

        if (this.layoutContainer) {
            this.layoutPanel = new PerformanceLayoutPanel({
                container: this.layoutContainer,
                config: this.layoutConfig,
                onChange: (layoutState) => {
                    this.applyLayoutState(layoutState, { persist: true, updatePanel: false });
                },
                onReset: () => {
                    this.applyLayoutState(this.layoutDefaults, { persist: true, silentStatus: true });
                    this.applyPreviewMode('auto', { silent: true });
                    this.updateStatus('Layout reset');
                },
                onPreview: ({ mode }) => this.applyPreviewMode(mode, { fromPanel: true })
            });
            this.layoutPanel.setPreviewMode(this.previewState.mode, { emit: false });
        }

        this.touchPadController = new TouchPadController({
            parameterManager: this.parameterManager,
            container: this.touchpadContainer,
            config: this.config.touchPads,
            hub: this.hub,
            onMappingChange: () => this.updateStatus('Touch pads ready')
        });

        if (this.telemetryContainer) {
            this.telemetryPanel = new PerformanceTelemetryPanel({
                parameterManager: this.parameterManager,
                container: this.telemetryContainer,
                config: this.config.telemetry,
                hub: this.hub
            });
        }

        if (this.gestureContainer) {
            this.gestureRecorder = new PerformanceGestureRecorder({
                parameterManager: this.parameterManager,
                container: this.gestureContainer,
                config: this.config.gestures,
                hub: this.hub,
                onStatusChange: (status) => this.updateStatus(status)
            });
        }

        this.audioPanel = new AudioReactivityPanel({
            parameterManager: this.parameterManager,
            container: this.audioContainer,
            config: this.config.audio,
            hub: this.hub,
            onSettingsChange: (settings) => this.applyAudioSettings(settings)
        });

        this.hardwareBridge = new PerformanceMidiBridge({
            parameterManager: this.parameterManager,
            container: this.hardwareContainer || this.audioColumn,
            config: this.config.hardware,
            hub: this.hub,
            onStatusChange: (status) => this.updateStatus(status)
        });

        if (this.networkContainer || this.audioColumn) {
            this.oscBridge = new PerformanceOscBridge({
                container: this.networkContainer || this.audioColumn,
                config: this.config.network,
                hub: this.hub,
                onStatusChange: (status) => this.updateStatus(status)
            });
        }

        this.presetManager = new PerformancePresetManager({
            parameterManager: this.parameterManager,
            touchPadController: this.touchPadController,
            audioPanel: this.audioPanel,
            hardwareBridge: this.hardwareBridge,
            gestureRecorder: this.gestureRecorder,
            container: this.presetsContainer,
            hub: this.hub,
            config: this.config.presets,
            themeOptions: this.config.theme,
            themeContext: this.themeContext,
            getThemeState: () => this.themePanel?.getState?.() || this.themeContext?.themeState || { paletteId: 'system' },
            applyThemeState: (state) => this.applyThemeState(state, { notifyHost: true, silentStatus: true })
        });

        this.showPlanner = new PerformanceShowPlanner({
            container: this.showPlannerContainer,
            hub: this.hub,
            presetManager: this.presetManager,
            config: this.config.showPlanner,
            themeOptions: this.config.theme,
            themeContext: this.themeContext,
            applyThemeState: (themeState, meta) => this.applyCueThemeState(themeState, meta),
            gestureOptions: this.gestureRecorder?.getSummaries?.() || []
        });

        const activeTheme = this.themePanel?.getState?.() || this.themeContext?.themeState || { paletteId: 'system' };
        this.presetManager?.setActiveThemeState?.(activeTheme);
        this.showPlanner?.setActiveThemeState?.(activeTheme);
        if (this.gestureRecorder && this.showPlanner?.setGestureOptions) {
            this.showPlanner.setGestureOptions(this.gestureRecorder.getSummaries());
        }

        this.subscriptions.push(this.hub.on('preset:loaded', () => this.updateStatus('Preset loaded')));
        this.subscriptions.push(this.hub.on('preset:playlist-start', () => this.updateStatus('Playlist launched')));
        this.subscriptions.push(this.hub.on('audio:flourish', () => this.updateStatus('Flourish triggered')));
        this.subscriptions.push(this.hub.on('show:cue-trigger', ({ cue } = {}) => {
            if (cue?.label) {
                this.updateStatus(`Cue triggered: ${cue.label}`);
            }
        }));
    }

    applyAudioSettings(settings) {
        if (this.engine && typeof this.engine.setLiveAudioSettings === 'function') {
            this.engine.setLiveAudioSettings(settings);
        }
        this.updateStatus('Audio reactivity updated');
    }

    updateStatus(message) {
        if (!this.statusEl) return;
        this.statusEl.textContent = message;
        clearTimeout(this.statusTimeout);
        this.statusTimeout = setTimeout(() => {
            this.statusEl.textContent = 'Ready';
        }, 2500);
    }

    getState() {
        return {
            layout: this.getLayoutState(),
            touchPads: this.touchPadController?.getState?.() || {},
            audio: this.audioPanel?.getSettings?.() || {},
            hardware: this.hardwareBridge?.getState?.() || {},
            network: this.oscBridge?.getState?.() || {},
            gestures: this.gestureRecorder?.getState?.() || { recordings: [] },
            presets: this.presetManager?.getState?.() || { presets: [], playlist: [] },
            showPlanner: this.showPlanner?.getState?.() || { cues: [] },
            theme: this.themePanel?.getState?.() || this.themeContext?.themeState || { paletteId: 'system' }
        };
    }

    applyState(state = {}) {
        if (state.layout) {
            this.applyLayoutState(state.layout, { persist: false, silentStatus: true });
        }
        if (state.theme) {
            this.applyThemeState(state.theme, { notifyHost: true, silentStatus: true });
        }
        if (state.touchPads && this.touchPadController?.applyState) {
            this.touchPadController.applyState(state.touchPads);
        }
        if (state.audio && this.audioPanel?.applySettings) {
            this.audioPanel.applySettings(state.audio);
        }
        if (state.hardware && this.hardwareBridge?.applyState) {
            this.hardwareBridge.applyState(state.hardware);
        }
        if (state.network && this.oscBridge?.applyState) {
            this.oscBridge.applyState(state.network);
        }
        if (state.gestures && this.gestureRecorder?.applyState) {
            this.gestureRecorder.applyState(state.gestures);
        }
        if (state.presets && this.presetManager?.applyState) {
            this.presetManager.applyState(state.presets);
        }
        if (state.showPlanner && this.showPlanner?.applyState) {
            this.showPlanner.applyState(state.showPlanner);
        }
    }

    applyThemeState(themeState, { notifyHost = false, silentStatus = false, transition = null } = {}) {
        const baseState = themeState ? { ...themeState } : { paletteId: 'system' };
        if (transition) {
            baseState.transition = transition;
        }

        const normalizedTarget = normalizeThemeState(baseState, { transitionDefaults: this.transitionDefaults });

        if (this.themePanel) {
            this.themePanel.applyState(normalizedTarget, { notify: false });
        }

        this.themeContext = this.themeContext || {};
        const normalizedState = this.themePanel?.getState?.()
            || normalizeThemeState(normalizedTarget, { transitionDefaults: this.transitionDefaults });
        this.themeContext.themeState = normalizedState;

        this.persistThemeState(normalizedState);

        this.presetManager?.setActiveThemeState?.(normalizedState);
        this.showPlanner?.setActiveThemeState?.(normalizedState);

        this.hub?.emit?.('theme:updated', { state: normalizedState });

        if (notifyHost && typeof this.themeContext?.onThemeChange === 'function') {
            this.themeContext.onThemeChange(normalizedState);
        }

        if (!silentStatus) {
            this.updateStatus('Theme updated');
        }
    }

    applyCueThemeState(themeState, { cueLabel = '', mode = '', transition = null } = {}) {
        if (!themeState && !transition) {
            return;
        }
        const state = themeState ? { ...themeState } : { paletteId: 'system' };
        if (transition) {
            state.transition = transition;
        }
        this.applyThemeState(state, { notifyHost: true, silentStatus: true });
        if (cueLabel) {
            const descriptor = mode === 'palette' ? 'palette' : 'theme';
            this.updateStatus(`Cue ${descriptor} applied: ${cueLabel}`);
        } else {
            this.updateStatus('Cue theme applied');
        }
    }

    loadStoredThemeState() {
        const storageKey = this.config?.theme?.storageKey;
        if (!storageKey || typeof window === 'undefined') {
            return null;
        }

        try {
            const raw = window.localStorage.getItem(storageKey);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('PerformanceSuite failed to load stored theme state', error);
            return null;
        }
    }

    persistThemeState(state) {
        const storageKey = this.config?.theme?.storageKey;
        if (!storageKey || typeof window === 'undefined') {
            return;
        }

        try {
            window.localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (error) {
            console.warn('PerformanceSuite failed to persist theme state', error);
        }
    }

    destroy() {
        if (typeof window !== 'undefined' && this.onResize) {
            window.removeEventListener('resize', this.onResize);
            this.onResize = null;
        }
        if (this.mobileTabs && this.onMobileTabClick) {
            this.mobileTabs.removeEventListener('click', this.onMobileTabClick);
            this.onMobileTabClick = null;
        }
        if (this.collapsibleStacks.length) {
            this.collapsibleStacks.forEach(({ button, handler }) => {
                button.removeEventListener('click', handler);
            });
            this.collapsibleStacks = [];
        }
        this.mobileTabButtons = [];
        this.mobileTabs = null;
        if (this.layoutPanel) {
            this.layoutPanel.destroy();
            this.layoutPanel = null;
        }
        if (this.touchPadController) {
            this.touchPadController.destroy();
            this.touchPadController = null;
        }
        if (this.telemetryPanel) {
            this.telemetryPanel.destroy();
            this.telemetryPanel = null;
        }
        if (this.audioPanel) {
            this.audioPanel = null;
        }
        if (this.hardwareBridge) {
            this.hardwareBridge.destroy();
            this.hardwareBridge = null;
        }
        if (this.oscBridge) {
            this.oscBridge.destroy();
            this.oscBridge = null;
        }
        if (this.gestureRecorder) {
            this.gestureRecorder.destroy();
            this.gestureRecorder = null;
        }
        if (this.presetManager) {
            this.presetManager = null;
        }
        if (this.showPlanner) {
            this.showPlanner.destroy();
            this.showPlanner = null;
        }
        if (this.themePanel) {
            this.themePanel.destroy();
            this.themePanel = null;
        }
        this.subscriptions.forEach(unsubscribe => unsubscribe?.());
        this.subscriptions = [];
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
            this.statusTimeout = null;
        }
        if (this.root && this.root.parentNode) {
            this.root.parentNode.removeChild(this.root);
        }
    }
}
