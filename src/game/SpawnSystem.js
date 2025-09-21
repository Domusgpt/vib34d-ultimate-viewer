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
        this.dynamics = null;
        this.stageContext = { stage: 0 };
        this.rhythmModifier = 1;
    }

    setDifficulty(difficulty) {
        this.difficulty = { ...this.difficulty, ...difficulty };
    }

    handleBeat(beatInfo) {
        this.currentInterval = beatInfo.interval;
        const spawnDefs = this.geometryController.generateTargets(
            beatInfo.beat,
            this.difficulty,
            this.dynamics,
            this.stageContext
        );
        spawnDefs.forEach((def) => {
            const beatsAhead = Math.max(1, def.dueBeat - beatInfo.beat);
            const timeToImpact = beatsAhead * beatInfo.interval * (1 / (this.rhythmModifier || 1));
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

    update(dt, params, aspect, { timeScale = 1 } = {}) {
        this.lastParams = params;
        this.aspect = aspect;
        this.newTargets.length = 0;
        this.expiredTargets.length = 0;
        const scaledDt = dt * (timeScale || 1);

        const remaining = [];
        this.targets.forEach((target) => {
            target.timer += scaledDt;
            if (target.children) {
                target.children.forEach((child) => {
                    child.timer += scaledDt;
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

    setDynamics(dynamics) {
        this.dynamics = dynamics;
    }

    setStageContext(context) {
        this.stageContext = context || { stage: 0 };
    }

    setRhythmModifier(modifier) {
        this.rhythmModifier = modifier || 1;
    }
}
