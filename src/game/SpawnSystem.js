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
        this.audioReactive = { energy: 0, bass: 0, mid: 0, high: 0 };
    }

    setDifficulty(difficulty) {
        this.difficulty = { ...this.difficulty, ...difficulty };
    }

    handleBeat(beatInfo, directives = {}) {
        this.currentInterval = beatInfo.interval;
        if (beatInfo.reactive) {
            this.audioReactive = {
                ...beatInfo.reactive,
                origin: beatInfo.origin || beatInfo.reactive.origin
            };
        }
        const energy = clamp01(this.audioReactive?.energy ?? averageEnergy(this.audioReactive));
        const silence = this.audioReactive?.silence ?? 0;
        const hushPenalty = 1 - clamp01(silence / 1.8) * 0.6;
        const densityFactor = Math.max(0.12, (0.25 + energy * 1.75) * hushPenalty);
        const speedFactor = 0.65 + clamp01(this.audioReactive?.mid ?? energy) * 1.2;
        const chaosBase = 0.6 + clamp01(this.audioReactive?.high ?? energy) * 1.5;
        const chaosFactor = chaosBase + (beatInfo.origin === 'geometry-fallback' ? 0.1 : 0);
        const multiplier = directives?.multiplier ?? 1;
        const chaosBoost = directives?.chaosBoost ?? 1;
        const spawnDefs = this.geometryController.generateTargets(beatInfo.beat, {
            density: this.difficulty.density * densityFactor * multiplier,
            speed: this.difficulty.speed * speedFactor,
            chaos: this.difficulty.chaos * chaosFactor * chaosBoost,
            audio: this.audioReactive
        });
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

        const remaining = [];
        this.targets.forEach((target) => {
            target.timer += dt;
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
                target.screenA = project4DToScreen(target.vec4, params, aspect);
                target.screenB = project4DToScreen(target.vec4b, params, aspect);
            } else if (target.type === 'cluster') {
                // cluster uses children already projected
            } else {
                target.screen = project4DToScreen(target.vec4, params, aspect);
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

    injectEventTarget(definition = {}) {
        if (!definition) return;
        const params = this.lastParams || {};
        const aspect = this.aspect || 1;
        const target = {
            id: definition.id || `event-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            type: definition.type || 'node',
            vec4: definition.vec4 || { x: 0, y: 0, z: 0, w: 0 },
            vec4b: definition.vec4b || null,
            radius: definition.radius || 0.08,
            state: 'active',
            timer: 0,
            timeToImpact: definition.timeToImpact ?? 0.25,
            lifespan: definition.lifespan ?? 1.5,
            behavior: definition.behavior || 'event',
            children: definition.children || null
        };
        if (target.type === 'lane') {
            target.screenA = project4DToScreen(target.vec4, params, aspect);
            target.screenB = project4DToScreen(target.vec4b || target.vec4, params, aspect);
        } else if (target.type === 'cluster') {
            target.children = (target.children || []).map((child) => ({
                ...child,
                screen: project4DToScreen(child.vec4, params, aspect)
            }));
        } else {
            target.screen = project4DToScreen(target.vec4, params, aspect);
        }
        this.targets.push(target);
        return target.id;
    }

    removeTarget(id) {
        const index = this.targets.findIndex((t) => t.id === id);
        if (index >= 0) {
            this.targets.splice(index, 1);
        }
    }

    reset() {
        this.targets.length = 0;
    }
}

function averageEnergy(reactive) {
    if (!reactive) return 0.5;
    const bass = reactive.bass ?? 0.5;
    const mid = reactive.mid ?? 0.5;
    const high = reactive.high ?? 0.5;
    return (bass + mid + high) / 3;
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
