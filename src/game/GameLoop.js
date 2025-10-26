const STEP = 1 / 60;

/**
 * Deterministic fixed-step game loop with decoupled rendering.
 */
export class GameLoop {
    constructor(update, render, { maxSubSteps = 5 } = {}) {
        this.update = update;
        this.render = render;
        this.maxSubSteps = maxSubSteps;
        this.accumulator = 0;
        this.lastTime = null;
        this.running = false;
        this.rafId = null;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        const tick = (time) => {
            if (!this.running) return;
            const delta = (time - this.lastTime) / 1000;
            this.lastTime = time;
            this.accumulator += delta;
            let steps = 0;
            while (this.accumulator >= STEP && steps < this.maxSubSteps) {
                this.update(STEP);
                this.accumulator -= STEP;
                steps += 1;
            }
            this.render();
            this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
    }

    stop() {
        this.running = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
}

export { STEP as FIXED_STEP };
