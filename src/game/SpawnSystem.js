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
        this.spawnContext = {};
        this.audioProfile = {};
    }

    setDifficulty(difficulty) {
        this.difficulty = { ...this.difficulty, ...difficulty };
    }

    handleBeat(beatInfo, audioAnalysis = {}, context = {}) {
        this.currentInterval = beatInfo.interval;
        this.audioProfile = audioAnalysis || {};
        this.spawnContext = { ...this.spawnContext, ...context };
        const effectiveDifficulty = {
            ...this.difficulty,
            density: (this.difficulty.density || 1) * (1 + (context.densityBoost || 0)),
            chaos: (this.difficulty.chaos || 0.2) * (1 + (context.chaosBoost || 0)),
            speed: (this.difficulty.speed || 1) * (context.tempoMultiplier || 1)
        };
        const spawnDefs = this.geometryController.generateTargets(beatInfo.beat, effectiveDifficulty, audioAnalysis, this.spawnContext);
        const tempo = context.tempoMultiplier || 1;
        spawnDefs.forEach((def) => {
            const beatsAhead = Math.max(1, def.dueBeat - beatInfo.beat);
            const timeToImpact = (beatsAhead * beatInfo.interval) / tempo;
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

    update(dt, params, aspect, context = {}) {
        this.lastParams = params;
        this.aspect = aspect;
        this.spawnContext = { ...this.spawnContext, ...context };
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

    removeTarget(id) {
        const index = this.targets.findIndex((t) => t.id === id);
        if (index >= 0) {
            this.targets.splice(index, 1);
        }
    }

    reset() {
        this.targets.length = 0;
    }

    setSpawnContext(context = {}) {
        this.spawnContext = { ...this.spawnContext, ...context };
    }

    injectEventTargets(event, options = {}) {
        if (!event) return;
        const tempo = this.spawnContext.tempoMultiplier || 1;
        const defs = this.geometryController.generateEventTargets(event.eventType, {
            count: event.count,
            audio: this.audioProfile,
            options
        });
        const baseTime = Math.max(0.35, (event.timeToImpact || 0.5) / tempo);
        defs.forEach((def, index) => {
            this.targets.push({
                ...def,
                id: `${event.id}-${index}`,
                state: 'incoming',
                timer: 0,
                timeToImpact: baseTime + index * 0.08,
                lifespan: event.lifespan || 2.5,
                screenA: null,
                screenB: null,
                event: { type: event.eventType, id: event.id }
            });
        });
    }
}
