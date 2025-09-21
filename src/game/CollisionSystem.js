import { distanceSq } from './utils/Math4D.js';

/**
 * Screen-space collision grid for touch pulses and active targets.
 */
export class CollisionSystem {
    constructor({ size = 32 } = {}) {
        this.gridSize = size;
        this.cells = new Map();
        this.lastTargets = [];
    }

    rebuild(targets) {
        this.cells.clear();
        this.lastTargets = targets;
        targets.forEach((target) => {
            const entries = expandTarget(target);
            entries.forEach(({ center, radius }) => {
                const bounds = radiusBounds(center, radius, this.gridSize);
                for (let gx = bounds.minX; gx <= bounds.maxX; gx++) {
                    for (let gy = bounds.minY; gy <= bounds.maxY; gy++) {
                        const key = `${gx}:${gy}`;
                        if (!this.cells.has(key)) {
                            this.cells.set(key, []);
                        }
                        this.cells.get(key).push({ target, center, radius });
                    }
                }
            });
        });
    }

    query(point, radius) {
        const bounds = radiusBounds(point, radius, this.gridSize);
        const candidates = [];
        for (let gx = bounds.minX; gx <= bounds.maxX; gx++) {
            for (let gy = bounds.minY; gy <= bounds.maxY; gy++) {
                const key = `${gx}:${gy}`;
                const cell = this.cells.get(key);
                if (cell) {
                    cell.forEach((entry) => candidates.push(entry));
                }
            }
        }
        return candidates;
    }

    resolvePulse(pulse) {
        const hits = [];
        const candidates = this.query(pulse.position, pulse.radius);
        const unique = new Set();
        candidates.forEach(({ target, center, radius }) => {
            if (unique.has(target.id)) return;
            if (target.type === 'lane') {
                const dist = distanceToSegmentSq(pulse.position, target.screenA, target.screenB);
                if (dist <= (pulse.radius + radius) * (pulse.radius + radius)) {
                    unique.add(target.id);
                    hits.push({ target, quality: pulseQuality(target) });
                }
            } else if (target.type === 'cluster') {
                const hitChild = target.children?.find((child) => {
                    const dist = distanceSq(child.screen, pulse.position);
                    return dist <= Math.pow(pulse.radius + (child.radius || 0.05), 2);
                });
                if (hitChild) {
                    unique.add(target.id);
                    hits.push({ target, quality: pulseQuality(target) });
                }
            } else {
                const dist = distanceSq(center, pulse.position);
                if (dist <= Math.pow(pulse.radius + (target.radius || 0.08), 2)) {
                    unique.add(target.id);
                    hits.push({ target, quality: pulseQuality(target) });
                }
            }
        });
        return hits;
    }
}

function expandTarget(target) {
    if (target.type === 'lane') {
        const mid = {
            x: (target.screenA.x + target.screenB.x) / 2,
            y: (target.screenA.y + target.screenB.y) / 2
        };
        return [{ center: mid, radius: target.radius || 0.05 }];
    }
    if (target.type === 'cluster') {
        return (target.children || []).map((child) => ({
            center: child.screen,
            radius: child.radius || 0.04
        }));
    }
    return [{ center: target.screen, radius: target.radius || 0.08 }];
}

function radiusBounds(center, radius, grid) {
    const minX = Math.max(0, Math.floor((center.x - radius) * grid));
    const minY = Math.max(0, Math.floor((center.y - radius) * grid));
    const maxX = Math.min(grid - 1, Math.floor((center.x + radius) * grid));
    const maxY = Math.min(grid - 1, Math.floor((center.y + radius) * grid));
    return { minX, minY, maxX, maxY };
}

function distanceToSegmentSq(point, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = point.x - a.x;
    const apy = point.y - a.y;
    const abLenSq = abx * abx + aby * aby;
    const t = abLenSq === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
    const closestX = a.x + abx * t;
    const closestY = a.y + aby * t;
    const dx = point.x - closestX;
    const dy = point.y - closestY;
    return dx * dx + dy * dy;
}

function pulseQuality(target) {
    if (target.remaining == null) return 'good';
    const window = Math.abs(target.remaining);
    if (window < 0.05) return 'perfect';
    if (window < 0.12) return 'great';
    return 'good';
}
