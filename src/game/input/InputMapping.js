const LONG_PRESS_THRESHOLD = 0.5; // seconds
const PULSE_WINDOW = 0.15; // seconds
const ROT_SENSITIVITY = 1.2;
const DIMENSION_SENSITIVITY = 0.8;

export class InputMapping {
    constructor({ element, onParameterDelta, onPulse, onLongPress }) {
        this.element = element;
        this.onParameterDelta = onParameterDelta;
        this.onPulse = onPulse;
        this.onLongPress = onLongPress;
        this.pointerStates = new Map();
        this.primaryPointerId = null;
        this.interaction = { x: 0.5, y: 0.5, intensity: 0 };
        this.pulseState = { active: false, radius: 0, timer: 0 };
        this.longPressTimer = 0;
        this.longPressActive = false;
        this.tilt = { beta: 0, gamma: 0 };
        this.lastUpdate = performance.now();
        this.pinchDistance = null;
        this.init();
    }

    init() {
        this.element.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        this.element.addEventListener('pointermove', this.handlePointerMove.bind(this));
        this.element.addEventListener('pointerup', this.handlePointerUp.bind(this));
        this.element.addEventListener('pointercancel', this.handlePointerUp.bind(this));
        this.element.addEventListener('pointerleave', this.handlePointerUp.bind(this));

        window.addEventListener('deviceorientation', event => {
            this.tilt.beta = event.beta || 0;
            this.tilt.gamma = event.gamma || 0;
        });
    }

    handlePointerDown(event) {
        this.element.setPointerCapture(event.pointerId);
        const rect = this.element.getBoundingClientRect();
        const normalized = this.normalize(event.clientX, event.clientY, rect);
        const state = {
            id: event.pointerId,
            startX: normalized.x,
            startY: normalized.y,
            x: normalized.x,
            y: normalized.y,
            startTime: performance.now(),
            lastTime: performance.now(),
            lastX: normalized.x,
            lastY: normalized.y,
            velocityX: 0,
            velocityY: 0
        };
        this.pointerStates.set(event.pointerId, state);
        if (this.primaryPointerId === null) {
            this.primaryPointerId = event.pointerId;
            this.interaction.x = normalized.x;
            this.interaction.y = normalized.y;
            this.longPressTimer = 0;
            this.longPressActive = false;
        }
    }

    handlePointerMove(event) {
        const state = this.pointerStates.get(event.pointerId);
        if (!state) return;

        const rect = this.element.getBoundingClientRect();
        const normalized = this.normalize(event.clientX, event.clientY, rect);
        const now = performance.now();
        const dt = (now - state.lastTime) / 1000;
        if (dt <= 0) return;

        const deltaX = normalized.x - state.x;
        const deltaY = normalized.y - state.y;
        state.velocityX = deltaX / dt;
        state.velocityY = deltaY / dt;
        state.lastX = normalized.x;
        state.lastY = normalized.y;
        state.lastTime = now;
        state.x = normalized.x;
        state.y = normalized.y;

        if (event.pointerId === this.primaryPointerId) {
            this.interaction.x = normalized.x;
            this.interaction.y = normalized.y;
            this.interaction.intensity = Math.min(1, Math.hypot(state.velocityX, state.velocityY));
            this.emitRotation(deltaX, deltaY);
        } else {
            this.handlePinch();
        }
    }

    handlePointerUp(event) {
        const state = this.pointerStates.get(event.pointerId);
        if (!state) return;

        this.pointerStates.delete(event.pointerId);
        this.element.releasePointerCapture(event.pointerId);

        if (event.pointerId === this.primaryPointerId) {
            const duration = (performance.now() - state.startTime) / 1000;
            const distance = Math.hypot(state.lastX - state.startX, state.lastY - state.startY);
            if (duration < 0.3 && distance < 0.03) {
                this.triggerPulse(state.lastX, state.lastY);
            }
            this.primaryPointerId = null;
            this.interaction.intensity = 0;
            this.longPressTimer = 0;
            this.longPressActive = false;
        }

        if (this.pointerStates.size === 1) {
            this.primaryPointerId = Array.from(this.pointerStates.keys())[0];
            this.pinchDistance = null;
        }
        if (this.pointerStates.size < 2) {
            this.pinchDistance = null;
        }
    }

    handlePinch() {
        if (this.pointerStates.size < 2) return;
        const pointers = Array.from(this.pointerStates.values());
        const [a, b] = pointers;
        const currentDistance = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDistance === null) {
            this.pinchDistance = currentDistance;
            return;
        }
        const delta = (currentDistance - this.pinchDistance) * DIMENSION_SENSITIVITY;
        this.pinchDistance = currentDistance;
        this.onParameterDelta?.({ dimension: delta });
    }

    emitRotation(deltaX, deltaY) {
        this.onParameterDelta?.({
            rot4dXW: deltaX * ROT_SENSITIVITY,
            rot4dYW: deltaY * ROT_SENSITIVITY
        });
    }

    triggerPulse(x, y) {
        this.pulseState = { active: true, radius: 0.15, timer: PULSE_WINDOW, x, y };
        this.onPulse?.({ x, y, radius: 0.15, duration: PULSE_WINDOW });
    }

    normalize(x, y, rect) {
        return {
            x: (x - rect.left) / rect.width,
            y: (y - rect.top) / rect.height
        };
    }

    update(dt) {
        const now = performance.now();
        const elapsed = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;

        if (this.primaryPointerId !== null) {
            this.longPressTimer += elapsed;
            if (!this.longPressActive && this.longPressTimer > LONG_PRESS_THRESHOLD) {
                this.longPressActive = true;
                this.onLongPress?.();
            }
        }

        if (this.pulseState.active) {
            this.pulseState.timer -= dt;
            this.pulseState.radius *= 0.92;
            if (this.pulseState.timer <= 0) {
                this.pulseState.active = false;
            }
        }

        if (Math.abs(this.tilt.beta) > 1 || Math.abs(this.tilt.gamma) > 1) {
            const tiltX = this.tilt.gamma / 90;
            const tiltY = this.tilt.beta / 90;
            this.onParameterDelta?.({
                rot4dZW: tiltX * 0.3,
                chaos: Math.abs(tiltY) * 0.05
            });
        }
    }

    getInteraction() {
        return this.interaction;
    }

    getPulseState() {
        return this.pulseState;
    }
}
