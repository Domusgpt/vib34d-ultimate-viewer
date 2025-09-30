/**
 * Performance TouchPad Controller
 * Multi-touch XY pads with configurable parameter mappings
 */

import { getParameterOptionGroups, populateSelectWithOptions, ensureOption } from './parameterOptions.js';

export class TouchPadController {
    constructor(options) {
        const {
            parameterManager,
            container = null,
            padCount = 3,
            availableParameters = null,
            defaultMappings = [],
            onMappingChange = null,
            layoutOptions = null,
            onLayoutChange = null
        } = options || {};

        this.parameterManager = parameterManager;
        this.padCount = padCount;
        this.onMappingChange = onMappingChange;
        this.onLayoutChange = onLayoutChange;
        this.availableParameters = availableParameters || parameterManager?.listParameters() || [];

        this.rootElement = null;
        this.container = container || this.ensureContainer();
        this.padStates = [];
        this.unsubscribe = null;
        this.defaultMappings = defaultMappings;
        this.layoutOptions = {
            padCount: this.padCount,
            columns: 'auto',
            padSize: 1,
            padGap: 16,
            padAspect: 1,
            crosshair: 16,
            ...layoutOptions
        };

        this.parameterOptionGroups = this.resolveParameterOptionGroups();

        this.buildUI();
        this.applyLayoutOptions(this.layoutOptions, { silent: true });
        this.registerListeners();
    }

    resolveParameterOptionGroups() {
        if (Array.isArray(this.availableParameters) && this.availableParameters.length > 0 && typeof this.availableParameters[0] === 'object') {
            return this.availableParameters;
        }

        return getParameterOptionGroups(this.parameterManager);
    }

    /**
     * Ensure a container exists for the touch pads
     */
    ensureContainer() {
        const existing = document.getElementById('performance-touchpads');
        if (existing) return existing;

        const element = document.createElement('section');
        element.id = 'performance-touchpads';
        element.classList.add('performance-touchpads');
        document.body.appendChild(element);
        return element;
    }

    /**
     * Build touch pad UI elements
     */
    buildUI() {
        if (!this.parameterManager) {
            console.warn('TouchPadController requires a ParameterManager instance');
            return;
        }

        // Clear container for rebuilds
        const preservedMappings = this.padStates.length > 0 ? this.getMappings() : null;

        this.container.innerHTML = '';
        this.padStates = [];

        const title = document.createElement('header');
        title.classList.add('performance-section-header');
        title.innerHTML = `
            <div>
                <h3>Multi-Touch Control Pads</h3>
                <p class="performance-subtitle">Assign any engine parameter to live XY pads with multi-touch gestures.</p>
            </div>
        `;

        this.container.appendChild(title);

        const padGrid = document.createElement('div');
        padGrid.classList.add('touchpad-grid');
        this.container.appendChild(padGrid);

        const defaults = this.createDefaultMappings();

        for (let i = 0; i < this.padCount; i++) {
            const savedMapping = preservedMappings?.find(item => item.id === i);
            const mapping = savedMapping
                ? {
                    x: savedMapping.bindings?.x,
                    y: savedMapping.bindings?.y,
                    gesture: savedMapping.bindings?.gesture,
                    mode: savedMapping.modes
                }
                : (defaults[i] || defaults[defaults.length - 1]);

            const padElement = this.createPadElement(i, mapping);
            padGrid.appendChild(padElement);
        }

        if (preservedMappings) {
            this.notifyMappingChange();
        }
    }

    /**
     * Create default mapping presets for pads
     */
    createDefaultMappings() {
        if (Array.isArray(this.defaultMappings) && this.defaultMappings.length > 0) {
            return this.defaultMappings;
        }

        return [
            { x: 'rot4dXW', y: 'rot4dYW', gesture: 'rot4dZW' },
            { x: 'gridDensity', y: 'morphFactor', gesture: 'chaos' },
            { x: 'hue', y: 'intensity', gesture: 'saturation' }
        ];
    }

    /**
     * Create a single pad element with controls
     */
    createPadElement(index, mapping) {
        const padWrapper = document.createElement('div');
        padWrapper.classList.add('touchpad-wrapper');

        const padHeader = document.createElement('div');
        padHeader.classList.add('touchpad-header');
        padHeader.innerHTML = `
            <div class="touchpad-title">Pad ${index + 1}</div>
            <div class="touchpad-mapping"></div>
        `;

        const mappingContainer = padHeader.querySelector('.touchpad-mapping');

        const padState = {
            id: index,
            element: padWrapper,
            surface: null,
            readout: null,
            axisBindings: {
                x: mapping?.x || 'rot4dXW',
                y: mapping?.y || 'rot4dYW',
                gesture: mapping?.gesture || 'none'
            },
            axisModes: {
                x: mapping?.mode?.x || 'swing',
                y: mapping?.mode?.y || 'swing',
                gesture: mapping?.mode?.gesture || 'absolute'
            },
            axisBaselines: {
                x: null,
                y: null,
                gesture: null
            },
            activePointers: new Map(),
            centroid: { x: 0.5, y: 0.5 },
            gestureValue: 0
        };

        padState.controls = {
            x: this.createAxisControl('X Axis', 'x', padState.axisBindings.x, padState.axisModes.x),
            y: this.createAxisControl('Y Axis', 'y', padState.axisBindings.y, padState.axisModes.y),
            gesture: this.createAxisControl('Gesture', 'gesture', padState.axisBindings.gesture, padState.axisModes.gesture, true)
        };

        mappingContainer.appendChild(padState.controls.x.container);
        mappingContainer.appendChild(padState.controls.y.container);
        mappingContainer.appendChild(padState.controls.gesture.container);

        const padSurface = document.createElement('div');
        padSurface.classList.add('touchpad-surface');
        padSurface.setAttribute('data-pad-index', index);
        padSurface.setAttribute('tabindex', '0');

        const crosshair = document.createElement('div');
        crosshair.classList.add('touchpad-crosshair');
        padSurface.appendChild(crosshair);

        const readout = document.createElement('div');
        readout.classList.add('touchpad-readout');
        readout.innerHTML = `
            <div><span>X:</span> <strong>0.00</strong></div>
            <div><span>Y:</span> <strong>0.00</strong></div>
            <div class="touchpad-gesture"><span>Spread:</span> <strong>0.00</strong></div>
        `;

        padWrapper.appendChild(padHeader);
        padWrapper.appendChild(padSurface);
        padWrapper.appendChild(readout);

        padState.surface = padSurface;
        padState.readout = readout;
        padState.crosshair = crosshair;

        this.attachPadEvents(padState);
        this.padStates.push(padState);

        // Initialize baselines with current parameter values
        ['x', 'y', 'gesture'].forEach(axis => {
            const param = padState.axisBindings[axis];
            if (param && param !== 'none') {
                padState.axisBaselines[axis] = this.parameterManager.getParameter(param);
            }
        });

        return padWrapper;
    }

    applyLayoutOptions(options = {}, { silent = false } = {}) {
        const next = {
            ...this.layoutOptions,
            ...options
        };

        next.padCount = Math.max(1, Math.min(8, parseInt(next.padCount, 10) || this.layoutOptions.padCount));
        next.columns = next.columns === 'auto'
            ? 'auto'
            : Math.max(1, Math.min(6, parseInt(next.columns, 10) || this.layoutOptions.columns));
        next.padSize = Math.max(0.6, Math.min(2.5, parseFloat(next.padSize) || this.layoutOptions.padSize));
        next.padGap = Math.max(4, Math.min(48, parseInt(next.padGap, 10) || this.layoutOptions.padGap));
        next.padAspect = Math.max(0.5, Math.min(2, parseFloat(next.padAspect) || this.layoutOptions.padAspect));
        next.crosshair = Math.max(8, Math.min(48, parseInt(next.crosshair, 10) || this.layoutOptions.crosshair));

        const padCountChanged = next.padCount !== this.padCount;

        this.layoutOptions = next;

        if (padCountChanged) {
            this.padCount = next.padCount;
            this.buildUI();
        }

        this.updateLayoutStyles();

        if (!silent) {
            this.emitLayoutChange();
        }
    }

    updateLayoutStyles() {
        if (!this.container) return;

        const {
            columns,
            padSize,
            padGap,
            padAspect,
            crosshair
        } = this.layoutOptions;

        const minHeight = Math.round(220 * padSize);
        const padding = Math.max(8, Math.round(12 * padSize));
        const radius = Math.max(8, Math.round(14 * padSize));
        const template = columns === 'auto'
            ? `repeat(auto-fit, minmax(${minHeight}px, 1fr))`
            : `repeat(${columns}, minmax(${minHeight}px, 1fr))`;

        this.container.style.setProperty('--touchpad-template', template);
        this.container.style.setProperty('--touchpad-gap', `${padGap}px`);
        this.container.style.setProperty('--touchpad-min-height', `${minHeight}px`);
        this.container.style.setProperty('--touchpad-aspect', padAspect.toFixed(2));
        this.container.style.setProperty('--touchpad-padding', `${padding}px`);
        this.container.style.setProperty('--touchpad-radius', `${radius}px`);
        this.container.style.setProperty('--touchpad-crosshair', `${crosshair}px`);
    }

    emitLayoutChange() {
        if (typeof this.onLayoutChange === 'function') {
            this.onLayoutChange(this.getLayoutOptions());
        }
    }

    getLayoutOptions() {
        return { ...this.layoutOptions };
    }

    /**
     * Create axis selector and mode toggle controls
     */
    createAxisControl(label, axisKey, selectedValue, mode, allowNone = false) {
        const container = document.createElement('div');
        container.classList.add('axis-control');

        const labelElement = document.createElement('label');
        labelElement.textContent = label;

        const select = document.createElement('select');
        select.classList.add('axis-select');

        populateSelectWithOptions(select, this.parameterOptionGroups, { allowNone });

        if (selectedValue && selectedValue !== 'none') {
            ensureOption(select, selectedValue, this.getParameterLabel(selectedValue));
        }

        if (selectedValue) {
            select.value = selectedValue;
        } else {
            select.value = allowNone ? 'none' : select.options[0]?.value;
        }

        const modeButton = document.createElement('button');
        modeButton.type = 'button';
        modeButton.classList.add('axis-mode');
        modeButton.dataset.axis = axisKey;
        this.updateModeButton(modeButton, mode);

        container.appendChild(labelElement);
        container.appendChild(select);
        container.appendChild(modeButton);

        return {
            container,
            select,
            modeButton
        };
    }

    /**
     * Update mode button visual state
     */
    updateModeButton(button, mode) {
        button.dataset.mode = mode;
        if (mode === 'swing') {
            button.textContent = '±';
            button.title = 'Swing mode: center is neutral';
        } else if (mode === 'absolute') {
            button.textContent = '→';
            button.title = 'Absolute mode: full range control';
        } else {
            button.textContent = '∑';
            button.title = 'Aggregate mode';
        }
    }

    /**
     * Attach pointer and control events to a pad
     */
    attachPadEvents(padState) {
        const { surface, controls } = padState;

        surface.addEventListener('pointerdown', (event) => {
            surface.setPointerCapture(event.pointerId);
            this.addPointer(padState, event);
        });

        surface.addEventListener('pointermove', (event) => {
            if (!padState.activePointers.has(event.pointerId)) return;
            this.updatePointer(padState, event);
        });

        ['pointerup', 'pointercancel', 'pointerleave', 'pointerout'].forEach(type => {
            surface.addEventListener(type, (event) => {
                this.removePointer(padState, event.pointerId);
            });
        });

        // Keyboard fallback for single pointer adjustments
        surface.addEventListener('keydown', (event) => {
            const step = (event.shiftKey ? 0.05 : 0.02);
            if (event.key === 'ArrowLeft') {
                this.nudgePad(padState, -step, 0);
                event.preventDefault();
            } else if (event.key === 'ArrowRight') {
                this.nudgePad(padState, step, 0);
                event.preventDefault();
            } else if (event.key === 'ArrowUp') {
                this.nudgePad(padState, 0, step);
                event.preventDefault();
            } else if (event.key === 'ArrowDown') {
                this.nudgePad(padState, 0, -step);
                event.preventDefault();
            }
        });

        controls.x.select.addEventListener('change', () => this.updateAxisBinding(padState, 'x'));
        controls.y.select.addEventListener('change', () => this.updateAxisBinding(padState, 'y'));
        controls.gesture.select.addEventListener('change', () => this.updateAxisBinding(padState, 'gesture'));

        controls.x.modeButton.addEventListener('click', () => this.toggleAxisMode(padState, 'x'));
        controls.y.modeButton.addEventListener('click', () => this.toggleAxisMode(padState, 'y'));
        controls.gesture.modeButton.addEventListener('click', () => this.toggleAxisMode(padState, 'gesture', ['absolute', 'swing']));
    }

    /**
     * Update axis bindings when drop-down changes
     */
    updateAxisBinding(padState, axis) {
        const control = padState.controls[axis];
        const newValue = control.select.value;
        padState.axisBindings[axis] = newValue;

        if (newValue && newValue !== 'none') {
            padState.axisBaselines[axis] = this.parameterManager.getParameter(newValue);
        }

        this.notifyMappingChange();
    }

    /**
     * Toggle axis control mode
     */
    toggleAxisMode(padState, axis, allowedModes = ['swing', 'absolute']) {
        const currentMode = padState.axisModes[axis];
        const index = allowedModes.indexOf(currentMode);
        const nextMode = allowedModes[(index + 1) % allowedModes.length];
        padState.axisModes[axis] = nextMode;
        this.updateModeButton(padState.controls[axis].modeButton, nextMode);
        this.notifyMappingChange();
    }

    /**
     * Add a pointer to the pad state
     */
    addPointer(padState, event) {
        padState.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        this.updatePadFromPointers(padState);
    }

    /**
     * Update pointer position
     */
    updatePointer(padState, event) {
        padState.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        this.updatePadFromPointers(padState);
    }

    /**
     * Remove pointer from pad state
     */
    removePointer(padState, pointerId) {
        if (padState.activePointers.has(pointerId)) {
            padState.activePointers.delete(pointerId);
            this.updatePadFromPointers(padState, { pointerReleased: true });
        }
    }

    /**
     * Nudge pad position via keyboard controls
     */
    nudgePad(padState, deltaX, deltaY) {
        padState.centroid.x = this.clamp01(padState.centroid.x + deltaX);
        padState.centroid.y = this.clamp01(padState.centroid.y - deltaY);
        this.applyPadValues(padState);
    }

    /**
     * Update pad values based on active pointers
     */
    updatePadFromPointers(padState, options = {}) {
        const { surface } = padState;
        const rect = surface.getBoundingClientRect();

        if (padState.activePointers.size === 0) {
            if (options.pointerReleased) {
                // Optionally ease back to center on release in swing mode
                if (padState.axisModes.x === 'swing' || padState.axisModes.y === 'swing') {
                    padState.centroid = { x: 0.5, y: 0.5 };
                    padState.gestureValue = 0;
                    this.applyPadValues(padState, { graceful: true });
                }
            }
            return;
        }

        const positions = Array.from(padState.activePointers.values()).map(pointer => {
            return {
                x: this.clamp01((pointer.x - rect.left) / rect.width),
                y: this.clamp01((pointer.y - rect.top) / rect.height)
            };
        });

        const centroid = positions.reduce((acc, pos) => ({
            x: acc.x + pos.x,
            y: acc.y + pos.y
        }), { x: 0, y: 0 });

        centroid.x /= positions.length;
        centroid.y /= positions.length;

        padState.centroid = centroid;
        padState.gestureValue = this.calculateGestureValue(positions, centroid, rect);

        this.applyPadValues(padState);
    }

    /**
     * Calculate gesture intensity based on multi-touch spread
     */
    calculateGestureValue(positions, centroid, rect) {
        if (positions.length <= 1) return 0;

        const maxDistance = Math.sqrt(rect.width ** 2 + rect.height ** 2) / Math.sqrt(2);
        const distances = positions.map(pos => {
            const dx = (pos.x - centroid.x) * rect.width;
            const dy = (pos.y - centroid.y) * rect.height;
            return Math.sqrt(dx * dx + dy * dy);
        });

        const averageDistance = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
        return this.clamp01(averageDistance / maxDistance);
    }

    /**
     * Apply current pad values to parameters
     */
    applyPadValues(padState, options = {}) {
        const { centroid, gestureValue } = padState;
        const crosshair = padState.crosshair;

        crosshair.style.setProperty('--x', `${centroid.x * 100}%`);
        crosshair.style.setProperty('--y', `${centroid.y * 100}%`);

        const xParam = padState.axisBindings.x;
        const yParam = padState.axisBindings.y;
        const gestureParam = padState.axisBindings.gesture;

        const updates = [];

        if (xParam && xParam !== 'none') {
            const value = this.convertNormalizedToParam(xParam, centroid.x, padState.axisModes.x, padState.axisBaselines.x);
            updates.push({ param: xParam, value, axis: 'x' });
        }

        if (yParam && yParam !== 'none') {
            const invertedY = 1 - centroid.y;
            const value = this.convertNormalizedToParam(yParam, invertedY, padState.axisModes.y, padState.axisBaselines.y);
            updates.push({ param: yParam, value, axis: 'y' });
        }

        if (gestureParam && gestureParam !== 'none') {
            const value = this.convertNormalizedToParam(
                gestureParam,
                gestureValue,
                padState.axisModes.gesture,
                padState.axisBaselines.gesture
            );
            updates.push({ param: gestureParam, value, axis: 'gesture' });
        }

        updates.forEach(update => {
            const applied = this.parameterManager.setParameter(update.param, update.value, 'touchpad');
            if (applied) {
                if (update.axis === 'x') padState.axisBaselines.x = this.parameterManager.getParameter(update.param);
                if (update.axis === 'y') padState.axisBaselines.y = this.parameterManager.getParameter(update.param);
                if (update.axis === 'gesture') padState.axisBaselines.gesture = this.parameterManager.getParameter(update.param);
            }
        });

        this.updateReadout(padState, updates);

        if (!options.graceful) {
            this.notifyMappingChange();
        }
    }

    /**
     * Convert normalized 0-1 input to parameter range
     */
    convertNormalizedToParam(paramName, normalizedValue, mode, baseline) {
        const definition = this.parameterManager.getParameterDefinition(paramName);
        if (!definition) return normalizedValue;

        const span = definition.max - definition.min;

        if (mode === 'swing') {
            const base = baseline != null ? baseline : this.parameterManager.getParameter(paramName);
            const delta = (normalizedValue * 2 - 1) * span * 0.5;
            return this.parameterManager.clampToDefinition(paramName, base + delta);
        }

        return this.parameterManager.clampToDefinition(paramName, definition.min + normalizedValue * span);
    }

    /**
     * Update readout values for a pad
     */
    updateReadout(padState, updates) {
        if (!padState.readout) return;
        const xLine = padState.readout.querySelector('div:nth-child(1) strong');
        const yLine = padState.readout.querySelector('div:nth-child(2) strong');
        const gestureLine = padState.readout.querySelector('.touchpad-gesture strong');

        updates.forEach(update => {
            const valueText = update.value.toFixed(2);
            if (update.axis === 'x') xLine.textContent = valueText;
            if (update.axis === 'y') yLine.textContent = valueText;
            if (update.axis === 'gesture') gestureLine.textContent = valueText;
        });
    }

    /**
     * Register listeners for parameter updates
     */
    registerListeners() {
        if (!this.parameterManager) return;
        this.unsubscribe = this.parameterManager.addChangeListener(({ name, value }) => {
            this.padStates.forEach(padState => {
                ['x', 'y', 'gesture'].forEach(axis => {
                    if (padState.axisBindings[axis] === name) {
                        if (padState.axisModes[axis] === 'swing') {
                            padState.axisBaselines[axis] = value;
                        }
                        if (axis === 'x') {
                            const xLine = padState.readout.querySelector('div:nth-child(1) strong');
                            xLine.textContent = value.toFixed(2);
                        } else if (axis === 'y') {
                            const yLine = padState.readout.querySelector('div:nth-child(2) strong');
                            yLine.textContent = value.toFixed(2);
                        } else if (axis === 'gesture') {
                            const gestureLine = padState.readout.querySelector('.touchpad-gesture strong');
                            gestureLine.textContent = value.toFixed(2);
                        }
                    }
                });
            });
        });
    }

    /**
     * Notify listeners about mapping changes
     */
    notifyMappingChange() {
        if (typeof this.onMappingChange === 'function') {
            this.onMappingChange(this.getMappings());
        }
    }

    /**
     * Retrieve current mappings for persistence
     */
    getMappings() {
        return this.padStates.map(padState => ({
            id: padState.id,
            bindings: { ...padState.axisBindings },
            modes: { ...padState.axisModes }
        }));
    }

    /**
     * Apply mappings from saved preset
     */
    applyMappings(mappings = []) {
        mappings.forEach(mapping => {
            const padState = this.padStates[mapping.id];
            if (!padState) return;

            ['x', 'y', 'gesture'].forEach(axis => {
                const param = mapping.bindings?.[axis];
                if (param) {
                    padState.axisBindings[axis] = param;
                    if (padState.controls[axis]) {
                        ensureOption(padState.controls[axis].select, param, this.getParameterLabel(param));
                        padState.controls[axis].select.value = param;
                    }
                    if (param !== 'none') {
                        padState.axisBaselines[axis] = this.parameterManager.getParameter(param);
                    }
                }

                const mode = mapping.modes?.[axis];
                if (mode) {
                    padState.axisModes[axis] = mode;
                    if (padState.controls[axis]) {
                        this.updateModeButton(padState.controls[axis].modeButton, mode);
                    }
                }
            });
        });

        this.notifyMappingChange();
    }

    /**
     * Format parameter names for UI
     */
    formatParameterName(name) {
        return this.getParameterLabel(name);
    }

    getParameterLabel(name) {
        if (!name || name === 'none') return 'None';
        if (this.parameterManager?.formatParameterLabel) {
            return this.parameterManager.formatParameterLabel(name);
        }

        return name
            .replace(/rot4d/, '4D ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, char => char.toUpperCase())
            .trim();
    }

    clamp01(value) {
        return Math.max(0, Math.min(1, value));
    }

    /**
     * Destroy controller and detach listeners
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        this.padStates.forEach(padState => {
            padState.activePointers.clear();
        });
    }
}
