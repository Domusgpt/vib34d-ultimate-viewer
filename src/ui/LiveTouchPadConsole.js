/**
 * LiveTouchPadConsole
 * Multi-touch performance console with configurable axes per touch pad.
 */
export class LiveTouchPadConsole {
    constructor({
        parameterSchema = {},
        padCount = 3,
        container = document.body,
        onParameterChange = () => {},
        onAxisChange = () => {}
    } = {}) {
        this.schema = parameterSchema;
        this.padCount = padCount;
        this.container = container;
        this.onParameterChange = onParameterChange;
        this.onAxisChange = onAxisChange;

        this.padStates = new Map();

        this.parameterOptions = this.buildParameterOptions();
        this.buildConsole();
    }

    buildParameterOptions() {
        const baseOptions = Object.keys(this.schema);
        if (!baseOptions.includes('hue')) baseOptions.unshift('hue');
        return baseOptions;
    }

    buildConsole() {
        this.root = document.createElement('div');
        this.root.id = 'live-touch-console';
        this.root.innerHTML = `
            <style>
                #live-touch-console {
                    position: fixed;
                    left: 20px;
                    bottom: 20px;
                    width: 420px;
                    max-width: calc(100vw - 40px);
                    background: rgba(4, 8, 15, 0.9);
                    border: 2px solid rgba(0, 255, 255, 0.4);
                    border-radius: 14px;
                    padding: 16px;
                    z-index: 2100;
                    color: #d6f6ff;
                    font-family: 'Orbitron', sans-serif;
                    backdrop-filter: blur(16px);
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
                }

                #live-touch-console h2 {
                    margin: 0 0 12px;
                    font-size: 1rem;
                    color: #00f6ff;
                    letter-spacing: 0.08em;
                    text-shadow: 0 0 12px rgba(0, 255, 255, 0.4);
                }

                .pad-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 12px;
                }

                .touch-pad {
                    background: rgba(0, 10, 25, 0.9);
                    border: 1px solid rgba(0, 200, 255, 0.4);
                    border-radius: 12px;
                    padding: 12px;
                }

                .pad-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    font-size: 0.8rem;
                    color: #9ee8ff;
                }

                .axis-config {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 6px;
                    margin-bottom: 8px;
                }

                .axis-config label {
                    display: flex;
                    flex-direction: column;
                    font-size: 0.65rem;
                    color: #7fc4ff;
                }

                .axis-config select {
                    margin-top: 2px;
                    background: rgba(0, 40, 70, 0.8);
                    color: #e0f8ff;
                    border: 1px solid rgba(0, 200, 255, 0.4);
                    border-radius: 6px;
                    padding: 4px;
                    font-size: 0.65rem;
                }

                .pad-surface {
                    position: relative;
                    width: 100%;
                    height: 150px;
                    border-radius: 12px;
                    background: radial-gradient(circle at center, rgba(0, 120, 255, 0.2), rgba(0, 40, 80, 0.65));
                    overflow: hidden;
                    touch-action: none;
                }

                .pad-surface::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: 12px;
                    border: 1px dashed rgba(0, 255, 255, 0.2);
                }

                .pad-status {
                    margin-top: 6px;
                    font-size: 0.65rem;
                    display: flex;
                    justify-content: space-between;
                    color: #b7f1ff;
                }

                @media (max-width: 768px) {
                    #live-touch-console {
                        width: auto;
                        right: 20px;
                        left: 20px;
                    }
                }
            </style>
            <h2>LIVE PERFORMANCE CONSOLE</h2>
            <div class="pad-grid"></div>
        `;

        this.container.appendChild(this.root);
        this.padGrid = this.root.querySelector('.pad-grid');

        for (let i = 0; i < this.padCount; i++) {
            this.createPad(i);
        }
    }

    createPad(index) {
        const pad = document.createElement('div');
        pad.className = 'touch-pad';
        pad.dataset.index = index;

        const axisOptions = this.parameterOptions.map(param => `<option value="${param}">${param}</option>`).join('');
        const noneOption = '<option value="none">none</option>';

        const defaultMappings = this.getDefaultMappings(index);

        pad.innerHTML = `
            <div class="pad-header">
                <span>Pad ${String.fromCharCode(65 + index)}</span>
                <span class="pointer-count">0 touches</span>
            </div>
            <div class="axis-config">
                <label>X Axis
                    <select class="axis-select" data-axis="x">
                        ${axisOptions}
                    </select>
                </label>
                <label>Y Axis
                    <select class="axis-select" data-axis="y">
                        ${axisOptions}
                    </select>
                </label>
                <label>Pinch Axis
                    <select class="axis-select" data-axis="pinch">
                        ${noneOption}${axisOptions}
                    </select>
                </label>
                <label>Rotation Axis
                    <select class="axis-select" data-axis="rotation">
                        ${noneOption}${axisOptions}
                    </select>
                </label>
            </div>
            <div class="pad-surface"></div>
            <div class="pad-status">
                <span class="status-position">X: 0.50 Y: 0.50</span>
                <span class="status-gesture">Pinch: 0.50 Rot: 0.50</span>
            </div>
        `;

        this.padGrid.appendChild(pad);

        const selects = pad.querySelectorAll('.axis-select');
        selects.forEach(select => {
            const axis = select.dataset.axis;
            const value = defaultMappings[axis] || (axis === 'pinch' || axis === 'rotation' ? 'none' : this.parameterOptions[0]);
            select.value = value;
            select.addEventListener('change', () => {
                this.updatePadMapping(index, axis, select.value);
            });
        });

        const padState = {
            index,
            element: pad,
            surface: pad.querySelector('.pad-surface'),
            mappings: { ...defaultMappings },
            pointers: new Map(),
            baseDistance: null,
            baseAngle: null
        };

        this.padStates.set(index, padState);
        this.bindPadEvents(padState);
    }

    getDefaultMappings(index) {
        const defaults = [
            { x: 'rot4dXW', y: 'rot4dYW', pinch: 'rot4dZW', rotation: 'hue' },
            { x: 'gridDensity', y: 'morphFactor', pinch: 'chaos', rotation: 'speed' },
            { x: 'hue', y: 'saturation', pinch: 'intensity', rotation: 'dimension' }
        ];
        return defaults[index] || { x: this.parameterOptions[0], y: this.parameterOptions[1] || this.parameterOptions[0] };
    }

    bindPadEvents(padState) {
        const surface = padState.surface;
        surface.addEventListener('pointerdown', (event) => this.handlePointerDown(padState, event));
        surface.addEventListener('pointermove', (event) => this.handlePointerMove(padState, event));
        surface.addEventListener('pointerup', (event) => this.handlePointerEnd(padState, event));
        surface.addEventListener('pointercancel', (event) => this.handlePointerEnd(padState, event));
        surface.addEventListener('pointerout', (event) => this.handlePointerEnd(padState, event));
    }

    handlePointerDown(padState, event) {
        event.preventDefault();
        padState.surface.setPointerCapture(event.pointerId);
        padState.pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        this.updateGestureBase(padState);
        this.updateStatus(padState);
    }

    handlePointerMove(padState, event) {
        if (!padState.pointers.has(event.pointerId)) return;
        event.preventDefault();
        padState.pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        this.processPadGesture(padState);
    }

    handlePointerEnd(padState, event) {
        if (padState.pointers.has(event.pointerId)) {
            padState.pointers.delete(event.pointerId);
            if (padState.pointers.size < 2) {
                padState.baseDistance = null;
                padState.baseAngle = null;
            }
            this.updateStatus(padState);
        }
    }

    updateGestureBase(padState) {
        if (padState.pointers.size >= 2) {
            const [p1, p2] = Array.from(padState.pointers.values());
            padState.baseDistance = this.distance(p1, p2);
            padState.baseAngle = this.angle(p1, p2);
        }
    }

    processPadGesture(padState) {
        const rect = padState.surface.getBoundingClientRect();
        const normalized = this.computeNormalizedValues(padState, rect);
        this.updateStatus(padState, normalized);
        this.dispatchParameterUpdates(padState, normalized);
    }

    computeNormalizedValues(padState, rect) {
        const pointers = Array.from(padState.pointers.values());
        const count = pointers.length;

        let centerX = 0.5;
        let centerY = 0.5;
        let pinch = 0.5;
        let rotation = 0.5;

        if (count >= 1) {
            const avg = pointers.reduce((acc, point) => {
                acc.x += point.clientX;
                acc.y += point.clientY;
                return acc;
            }, { x: 0, y: 0 });
            centerX = (avg.x / count - rect.left) / rect.width;
            centerY = (avg.y / count - rect.top) / rect.height;
        }

        if (count >= 2) {
            const [p1, p2] = pointers;
            const distance = this.distance(p1, p2);
            const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
            pinch = distance / diagonal;
            pinch = Math.max(0, Math.min(1, pinch));

            const angle = this.angle(p1, p2);
            const baseAngle = padState.baseAngle ?? angle;
            let delta = angle - baseAngle;
            while (delta > Math.PI) delta -= 2 * Math.PI;
            while (delta < -Math.PI) delta += 2 * Math.PI;
            rotation = (delta + Math.PI) / (2 * Math.PI);
            rotation = Math.max(0, Math.min(1, rotation));
        }

        return {
            x: Math.max(0, Math.min(1, centerX)),
            y: Math.max(0, Math.min(1, 1 - centerY)),
            pinch,
            rotation,
            count
        };
    }

    dispatchParameterUpdates(padState, values) {
        const mapParam = (param, normalized) => {
            if (!param || param === 'none') return;
            const schema = this.schema[param];
            if (!schema) {
                this.onParameterChange(param, normalized);
                return;
            }
            const value = schema.min + (schema.max - schema.min) * normalized;
            const finalValue = schema.type === 'integer' ? Math.round(value) : parseFloat(value.toFixed(4));
            this.onParameterChange(param, finalValue);
        };

        mapParam(padState.mappings.x, values.x);
        mapParam(padState.mappings.y, values.y);
        mapParam(padState.mappings.pinch, values.pinch);
        mapParam(padState.mappings.rotation, values.rotation);
    }

    updateStatus(padState, values = { x: 0.5, y: 0.5, pinch: 0.5, rotation: 0.5, count: padState.pointers.size }) {
        const position = padState.element.querySelector('.status-position');
        const gesture = padState.element.querySelector('.status-gesture');
        const pointerCount = padState.element.querySelector('.pointer-count');

        if (position) {
            position.textContent = `X: ${values.x.toFixed(2)} Y: ${values.y.toFixed(2)}`;
        }
        if (gesture) {
            gesture.textContent = `Pinch: ${values.pinch.toFixed(2)} Rot: ${values.rotation.toFixed(2)}`;
        }
        if (pointerCount) {
            pointerCount.textContent = `${padState.pointers.size} touch${padState.pointers.size === 1 ? '' : 'es'}`;
        }
    }

    updatePadMapping(index, axis, param) {
        const padState = this.padStates.get(index);
        if (!padState) return;
        padState.mappings[axis] = param;
        this.onAxisChange(index, { ...padState.mappings });
    }

    distance(p1, p2) {
        const dx = p2.clientX - p1.clientX;
        const dy = p2.clientY - p1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    angle(p1, p2) {
        const dx = p2.clientX - p1.clientX;
        const dy = p2.clientY - p1.clientY;
        return Math.atan2(dy, dx);
    }

    destroy() {
        if (this.root) {
            this.root.remove();
            this.root = null;
        }
        this.padStates.clear();
    }
}
