/**
 * Monitors render frame times and requests LOD adjustments when needed.
 */
export class PerformanceController {
    constructor(callback) {
        this.callback = callback;
        this.samples = [];
        this.windowSize = 90;
        this.currentLevel = 0; // 0 = high, 1 = medium, 2 = low
        this.frameStart = 0;
    }

    beginFrame() {
        this.frameStart = performance.now();
    }

    endFrame() {
        if (!this.frameStart) return;
        const duration = performance.now() - this.frameStart;
        this.samples.push(duration);
        if (this.samples.length >= this.windowSize) {
            const avgDuration = this.samples.reduce((acc, val) => acc + val, 0) / this.samples.length;
            const fps = 1000 / avgDuration;
            let targetLevel = this.currentLevel;
            if (fps < 48) {
                targetLevel = 2;
            } else if (fps < 55) {
                targetLevel = Math.max(targetLevel, 1);
            } else if (fps > 58 && this.currentLevel > 0) {
                targetLevel = this.currentLevel - 1;
            }
            if (targetLevel !== this.currentLevel) {
                this.currentLevel = targetLevel;
                if (this.callback) {
                    this.callback(targetLevel);
                }
            }
            this.samples.length = 0;
        }
    }
}
