import { project4DToScreen } from './utils/Math4D.js';

/**
 * Beat-driven spawn manager. Keeps targets in deterministic order and
 * computes their projected positions for collision tests.
 */
export class SpawnSystem {
    constructor(geometryController) {
        this.geometryController = geometryController;
        this.targets = [];
        this.newTargets = [];
        this.expiredTargets = [];
        this.aspect = 1;
        this.currentInterval = 0.5;
        this.difficulty = { density: 1, speed: 1, chaos: 0.2 };
        this.lastParams = null;
        this.tempoScale = 1;
        this.glitchLevel = 0;
        this.glitchTimer = 0;
        this.reverseTimer = 0;
        this.lastBeat = 0;
    }

    setDifficulty(difficulty) {
        this.difficulty = { ...this.difficulty, ...difficulty };
    }

    handleBeat(beatInfo) {
        this.currentInterval = beatInfo.interval;
        this.lastBeat = beatInfo.beat;
        const spawnDefs = this.geometryController.generateTargets(beatInfo.beat, this.difficulty);
        spawnDefs.forEach((def) => {
            const beatsAhead = Math.max(1, def.dueBeat - beatInfo.beat);
            const timeToImpact = beatsAhead * beatInfo.interval;
            this.targets.push({
                ...def,
                state: 'incoming',
                timer: 0,
                timeToImpact,
                lifespan: timeToImpact + beatInfo.interval * 1.25,
                screenA: null,
                screenB: null,
                children: def.children ? def.children.map((child) => ({ ...child, timer: 0 })) : null
            });
        });
    }

    update(dt, params, aspect) {
        this.lastParams = params;
        this.aspect = aspect;
        this.newTargets.length = 0;
        this.expiredTargets.length = 0;

        if (this.glitchTimer > 0) {
            this.glitchTimer = Math.max(0, this.glitchTimer - dt);
            if (this.glitchTimer === 0) {
                this.glitchLevel = 0;
            }
        }

        if (this.reverseTimer > 0) {
            this.reverseTimer = Math.max(0, this.reverseTimer - dt);
        }

        const remaining = [];
        this.targets.forEach((target) => {
            target.timer += dt * this.tempoScale;
            if (target.children) {
                target.children.forEach((child) => {
                    child.timer += dt;
                    child.screen = project4DToScreen(child.vec4, params, aspect);
                    child.alpha = Math.min(1, child.timer / target.timeToImpact);
                });
            }

            if (target.state === 'incoming' && target.timer > target.timeToImpact * 0.35) {
                target.state = 'active';
                this.newTargets.push(target);
            }

            target.remaining = target.timeToImpact - target.timer;
            if (target.type === 'lane') {
                const screenA = project4DToScreen(target.vec4, params, aspect);
                const screenB = project4DToScreen(target.vec4b, params, aspect);
                if (this.reverseTimer > 0 || target.behavior === 'reverse') {
                    target.screenA = screenB;
                    target.screenB = screenA;
                } else {
                    target.screenA = screenA;
                    target.screenB = screenB;
                }
            } else if (target.type === 'cluster') {
                // cluster uses children already projected
            } else {
                target.screen = project4DToScreen(target.vec4, params, aspect);
            }

            if (this.glitchLevel > 0.001) {
                const intensity = Math.min(1.2, this.glitchLevel);
                if (target.screen) {
                    jitterPoint(target.screen, intensity, this.geometryController);
                }
                if (target.screenA) jitterPoint(target.screenA, intensity, this.geometryController);
                if (target.screenB) jitterPoint(target.screenB, intensity, this.geometryController);
                if (target.children) {
                    target.children.forEach((child) => {
                        if (child.screen) jitterPoint(child.screen, intensity, this.geometryController);
                    });
                }
            }

            if (target.timer > target.lifespan) {
                target.state = 'expired';
                this.expiredTargets.push(target);
            } else {
                remaining.push(target);
            }
        });
        this.targets = remaining;
        return {
            newTargets: this.newTargets,
            expiredTargets: this.expiredTargets
        };
    }

    getActiveTargets() {
        return this.targets.filter((t) => t.state === 'active');
    }

    removeTarget(id) {
        const index = this.targets.findIndex((t) => t.id === id);
        if (index >= 0) {
            this.targets.splice(index, 1);
        }
    }

    reset() {
        this.targets.length = 0;
        this.glitchLevel = 0;
        this.glitchTimer = 0;
        this.reverseTimer = 0;
        this.tempoScale = 1;
    }

    setTempoScale(scale) {
        this.tempoScale = Math.max(0.35, Math.min(2.5, scale));
    }

    setGlitch(level, duration = 0) {
        if (level <= 0) {
            this.glitchLevel = 0;
            this.glitchTimer = 0;
            return;
        }
        this.glitchLevel = Math.max(this.glitchLevel, level);
        this.glitchTimer = Math.max(this.glitchTimer, duration);
    }

    triggerReverse(duration = 1.6) {
        this.reverseTimer = Math.max(this.reverseTimer, duration);
    }

    injectEventTarget(definition, interval = this.currentInterval) {
        const beatsAhead = definition.dueBeat != null ? Math.max(0.2, (definition.dueBeat - this.lastBeat)) : 1;
        const timeToImpact = definition.timeToImpact ?? beatsAhead * interval;
        const target = {
            ...definition,
            state: 'incoming',
            timer: 0,
            timeToImpact,
            lifespan: definition.lifespan ?? timeToImpact + interval * 1.1,
            screenA: null,
            screenB: null,
            children: definition.children ? definition.children.map((child) => ({ ...child, timer: 0 })) : null
        };
        this.targets.push(target);
        return target;
    }
}

function jitterPoint(point, intensity, geometryController) {
    if (!point) return;
    const sample = typeof geometryController?.random === 'function' ? geometryController.random() : Math.random();
    const angle = sample * Math.PI * 2;
    const radius = (typeof geometryController?.random === 'function' ? geometryController.random() : Math.random()) * 0.015 * intensity;
    point.x = clamp01(point.x + Math.cos(angle) * radius);
    point.y = clamp01(point.y + Math.sin(angle) * radius);
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
