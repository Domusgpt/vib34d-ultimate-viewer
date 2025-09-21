export class PerformanceController {
    constructor({ modeController, windowSize = 120 }) {
        this.modeController = modeController;
        this.windowSize = windowSize;
        this.samples = [];
        this.lastTime = performance.now();
        this.lodLevel = 0;
    }

    recordFrame(now = performance.now()) {
        const delta = now - this.lastTime;
        this.lastTime = now;
        if (delta <= 0) return;
        const fps = 1000 / delta;
        this.samples.push(fps);
        if (this.samples.length > this.windowSize) {
            this.samples.shift();
        }
    }

    getAverageFps() {
        if (!this.samples.length) return 60;
        const sum = this.samples.reduce((a, b) => a + b, 0);
        return sum / this.samples.length;
    }

    update() {
        const fps = this.getAverageFps();
        if (fps < 50 && this.lodLevel < 2) {
            this.lodLevel += 1;
            this.applyLOD();
        } else if (fps > 58 && this.lodLevel > 0) {
            this.lodLevel -= 1;
            this.applyLOD();
        }
    }

    applyLOD() {
        const params = this.modeController.getParameters();
        const adjustments = { ...params };
        if (this.lodLevel === 0) {
            adjustments.gridDensity = Math.max(params.gridDensity, 18);
            adjustments.intensity = Math.min(params.intensity + 0.1, 1);
        } else if (this.lodLevel === 1) {
            adjustments.gridDensity = Math.min(params.gridDensity, 14);
            adjustments.chaos = Math.min(params.chaos, 0.25);
        } else {
            adjustments.gridDensity = Math.min(params.gridDensity, 10);
            adjustments.chaos = Math.min(params.chaos, 0.18);
            adjustments.intensity = Math.max(params.intensity - 0.1, 0.35);
        }
        this.modeController.updateParameters(adjustments);
    }
}
