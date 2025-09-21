const STEP = 1 / 60;

export class GameLoop {
    constructor({ update, render, fixedStep = STEP }) {
        this.update = update;
        this.render = render;
        this.fixedStep = fixedStep;
        this.accumulator = 0;
        this.lastTime = 0;
        this.running = false;
        this.rafId = null;
        this.frame = this.frame.bind(this);
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.accumulator = 0;
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame(this.frame);
    }

    stop() {
        this.running = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    frame(now) {
        if (!this.running) return;

        const delta = (now - this.lastTime) / 1000;
        this.lastTime = now;
        this.accumulator += delta;

        while (this.accumulator >= this.fixedStep) {
            this.update(this.fixedStep);
            this.accumulator -= this.fixedStep;
        }

        if (this.render) {
            this.render();
        }

        this.rafId = requestAnimationFrame(this.frame);
    }
}
