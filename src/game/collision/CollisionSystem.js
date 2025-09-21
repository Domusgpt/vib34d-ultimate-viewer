export class CollisionSystem {
    constructor({ gridResolution = 32 }) {
        this.gridResolution = gridResolution;
        this.grid = new Map();
        this.bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    }

    rebuild(targets) {
        this.grid.clear();
        targets.forEach(target => {
            const cells = this.getCellsForTarget(target);
            cells.forEach(key => {
                if (!this.grid.has(key)) {
                    this.grid.set(key, []);
                }
                this.grid.get(key).push(target);
            });
        });
    }

    getCellsForTarget(target) {
        const half = target.radius || 0.05;
        const minX = Math.max(this.bounds.minX, target.x - half);
        const maxX = Math.min(this.bounds.maxX, target.x + half);
        const minY = Math.max(this.bounds.minY, target.y - half);
        const maxY = Math.min(this.bounds.maxY, target.y + half);

        const startX = Math.floor(minX * this.gridResolution);
        const endX = Math.floor(maxX * this.gridResolution);
        const startY = Math.floor(minY * this.gridResolution);
        const endY = Math.floor(maxY * this.gridResolution);

        const cells = [];
        for (let gx = startX; gx <= endX; gx++) {
            for (let gy = startY; gy <= endY; gy++) {
                cells.push(`${gx},${gy}`);
            }
        }
        return cells;
    }

    queryCircle({ x, y, radius }) {
        const cellX = Math.floor(x * this.gridResolution);
        const cellY = Math.floor(y * this.gridResolution);
        const results = new Set();

        for (let gx = cellX - 1; gx <= cellX + 1; gx++) {
            for (let gy = cellY - 1; gy <= cellY + 1; gy++) {
                const key = `${gx},${gy}`;
                const bucket = this.grid.get(key);
                if (!bucket) continue;
                bucket.forEach(target => {
                    if (this.circleOverlap(target, { x, y, radius })) {
                        results.add(target);
                    }
                });
            }
        }

        return Array.from(results);
    }

    circleOverlap(target, pulse) {
        if (!target) return false;
        if (target.type === 'belt') {
            return this.capsuleOverlap(target, pulse);
        }
        if (target.type === 'wave') {
            return this.waveOverlap(target, pulse);
        }
        const dx = target.x - pulse.x;
        const dy = target.y - pulse.y;
        const distanceSq = dx * dx + dy * dy;
        const radius = (target.radius || 0.05) + pulse.radius;
        return distanceSq <= radius * radius;
    }

    capsuleOverlap(target, pulse) {
        const x = Math.max(Math.min(pulse.x, target.x + 0.05), target.x - 0.05);
        const dy = pulse.y - target.y;
        const dx = pulse.x - x;
        const distanceSq = dx * dx + dy * dy;
        const radius = (target.radius || 0.05) + pulse.radius * 0.8;
        return distanceSq <= radius * radius;
    }

    waveOverlap(target, pulse) {
        const dx = pulse.x - target.x;
        const dy = pulse.y - target.y;
        const radius = (target.radius || 0.04) + pulse.radius * 0.9;
        return dx * dx + dy * dy <= radius * radius;
    }
}
