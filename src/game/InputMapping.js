/**
 * Maps touch + pointer gestures into high-level events for the game.
 */
export class InputMapping {
    constructor(element, { planes = ['XW', 'YW'] } = {}) {
        this.element = element;
        this.planes = planes;
        this.listeners = new Map();
        this.pulses = [];
        this.activePointers = new Map();
        this.initialPinchDistance = null;
        this.lastTilt = { beta: 0, gamma: 0 };

        ['rotate', 'pulse', 'pinch', 'longpressstart', 'longpressend', 'tilt', 'special', 'swipeend'].forEach((evt) => {
            this.listeners.set(evt, new Set());
        });

        this.element.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.element.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.element.addEventListener('pointerup', (e) => this.onPointerUp(e));
        this.element.addEventListener('pointercancel', (e) => this.onPointerCancel(e));
        this.element.addEventListener('pointerout', (e) => this.onPointerCancel(e));

        this.setupTilt();

        this.lastTapTime = 0;
        this.specialTapWindow = 220;
    }

    on(event, callback) {
        const set = this.listeners.get(event);
        if (!set) return () => {};
        set.add(callback);
        return () => set.delete(callback);
    }

    emit(event, detail) {
        const set = this.listeners.get(event);
        if (!set) return;
        set.forEach((callback) => callback(detail));
    }

    onPointerDown(event) {
        this.element.setPointerCapture?.(event.pointerId);
        const pointer = this.createPointerState(event);
        this.activePointers.set(event.pointerId, pointer);
        pointer.longPressTimeout = setTimeout(() => {
            pointer.longPressed = true;
            this.emit('longpressstart', { position: pointer.position });
        }, 450);
    }

    onPointerMove(event) {
        const pointer = this.activePointers.get(event.pointerId);
        if (!pointer) return;
        const prevPos = pointer.position;
        pointer.position = this.normalizePosition(event);
        pointer.deltaX += pointer.position.x - prevPos.x;
        pointer.deltaY += pointer.position.y - prevPos.y;

        if (this.activePointers.size === 2) {
            this.handlePinch();
        } else {
            this.emit('rotate', {
                deltaX: pointer.position.x - prevPos.x,
                deltaY: pointer.position.y - prevPos.y,
                plane: this.planes[0]
            });
        }
    }

    onPointerUp(event) {
        const pointer = this.activePointers.get(event.pointerId);
        if (!pointer) return;
        clearTimeout(pointer.longPressTimeout);

        const elapsed = performance.now() - pointer.startTime;
        const moved = Math.hypot(pointer.deltaX, pointer.deltaY);

        if (pointer.longPressed) {
            this.emit('longpressend', {});
        } else if (elapsed < 250 && moved < 0.03) {
            // tap -> pulse
            const pulse = {
                position: pointer.position,
                radius: 0.1,
                timestamp: performance.now()
            };
            const now = performance.now();
            if (now - this.lastTapTime < this.specialTapWindow) {
                this.emit('special', { position: pointer.position });
                this.lastTapTime = 0;
            } else {
                this.lastTapTime = now;
            }
            this.pulses.push(pulse);
            this.emit('pulse', pulse);
        } else {
            this.emit('rotate', {
                deltaX: pointer.deltaX,
                deltaY: pointer.deltaY,
                plane: this.planes[1] || this.planes[0]
            });
            this.emit('swipeend', {
                deltaX: pointer.deltaX,
                deltaY: pointer.deltaY,
                duration: elapsed / 1000
            });
        }

        this.activePointers.delete(event.pointerId);
        if (this.activePointers.size < 2) {
            this.initialPinchDistance = null;
        }
    }

    onPointerCancel(event) {
        const pointer = this.activePointers.get(event.pointerId);
        if (pointer) {
            clearTimeout(pointer.longPressTimeout);
        }
        this.activePointers.delete(event.pointerId);
    }

    handlePinch() {
        const pointers = Array.from(this.activePointers.values());
        if (pointers.length !== 2) return;
        const [a, b] = pointers;
        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (this.initialPinchDistance == null) {
            this.initialPinchDistance = distance;
            return;
        }
        const scale = distance / (this.initialPinchDistance || 0.0001);
        this.emit('pinch', { scaleDelta: scale - 1 });
        this.initialPinchDistance = distance;
    }

    setupTilt() {
        if (typeof DeviceOrientationEvent === 'undefined') return;
        const handler = (event) => {
            this.lastTilt = { beta: event.beta || 0, gamma: event.gamma || 0 };
            this.emit('tilt', this.lastTilt);
        };
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            window.addEventListener('click', async () => {
                try {
                    const res = await DeviceOrientationEvent.requestPermission();
                    if (res === 'granted') {
                        window.addEventListener('deviceorientation', handler);
                    }
                } catch (err) {
                    console.warn('Tilt permission denied', err);
                }
            }, { once: true });
        } else {
            window.addEventListener('deviceorientation', handler);
        }
    }

    createPointerState(event) {
        return {
            startTime: performance.now(),
            position: this.normalizePosition(event),
            deltaX: 0,
            deltaY: 0,
            longPressTimeout: null,
            longPressed: false
        };
    }

    normalizePosition(event) {
        const rect = this.element.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) / rect.width,
            y: (event.clientY - rect.top) / rect.height
        };
    }

    consumePulses() {
        const output = this.pulses.slice();
        this.pulses.length = 0;
        return output;
    }
}
