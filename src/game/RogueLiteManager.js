const MODIFIER_POOL = [
    {
        id: 'bass-rush',
        label: 'Bass Rush',
        description: 'Bass peaks slam extra lattice shards into the grid.',
        effects: { densityBoost: 0.4, bassBias: 0.65 }
    },
    {
        id: 'phase-loop',
        label: 'Phase Loop',
        description: 'Phase energy regenerates faster while combos stay alive.',
        effects: { phaseRegenBonus: 0.25 }
    },
    {
        id: 'fracture',
        label: 'Fracture Chains',
        description: 'Fractal and crystal geometries spawn more cluster events.',
        effects: { clusterBias: 0.35 }
    },
    {
        id: 'woah-drops',
        label: 'WOAH Drops',
        description: 'Huge drops trigger quick draw crystal challenges.',
        effects: { dropQuickDraw: true }
    }
];

const EFFECT_DEFS = {
    glitch: {
        id: 'glitch',
        label: 'Glitch Storm',
        variant: 'alert',
        data: { glitchLevel: 1.1 }
    },
    reverse: {
        id: 'reverse',
        label: 'Reverse Flow',
        variant: 'alert',
        data: { invertControls: true }
    },
    'tempo-shift': {
        id: 'tempo-shift',
        label: 'Tempo Warp',
        variant: 'info',
        data: { tempoMultiplier: 1.2 }
    }
};

const DIRECTIVE_DEFS = {
    'pulse-blast': {
        id: 'pulse-blast',
        label: 'Pulse Blast',
        shout: 'Pulse Blast!',
        variant: 'alert',
        requirement: 'pulse-count',
        goal: 5,
        duration: 3.8,
        reward: {
            score: 600,
            charge: 1,
            tempoBoost: 0.18,
            tempoDuration: 5,
            densityBoost: 0.25,
            densityDuration: 5
        },
        penalty: {
            glitch: 0.35
        }
    },
    'phase-hold': {
        id: 'phase-hold',
        label: 'Hold the Phase',
        shout: 'Hold the Phase!',
        variant: 'info',
        requirement: 'phase-hold',
        goal: 2.8,
        duration: 4.5,
        reward: {
            score: 450,
            phaseEnergy: 0.4,
            charge: 1
        },
        penalty: {
            chaos: 0.25
        }
    },
    'swipe-sync': {
        id: 'swipe-sync',
        label: 'Swipe Sync',
        shout: 'Swipe Sync!',
        variant: 'alert',
        requirement: 'swipe',
        goal: 2,
        threshold: 0.18,
        duration: 3.6,
        reward: {
            score: 520,
            tempoBoost: 0.22,
            tempoDuration: 4.5
        },
        penalty: {
            reverse: true
        }
    },
    'silence-freeze': {
        id: 'silence-freeze',
        label: 'Do Not Pulse',
        shout: 'Freeze!',
        variant: 'alert',
        requirement: 'no-pulse',
        duration: 3.2,
        reward: {
            score: 380,
            charge: 1
        },
        penalty: {
            glitch: 0.4,
            chaos: 0.2
        }
    },
    'echo-pulse': {
        id: 'echo-pulse',
        label: 'Echo the Vocal',
        shout: 'Echo!',
        variant: 'success',
        requirement: 'pulse-precision',
        goal: 2,
        duration: 4,
        reward: {
            score: 700,
            charge: 1,
            densityBoost: 0.2,
            densityDuration: 6
        },
        penalty: {
            glitch: 0.25
        }
    }
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function choose(array) {
    if (!array.length) return null;
    const index = Math.floor(Math.random() * array.length);
    return array[index];
}

function defaultTemplate() {
    return {
        id: 'rogue-default',
        system: 'faceted',
        geometryIndex: 3,
        variantIndex: 12,
        bpm: 128,
        difficulty: { density: 0.9, speed: 1, chaos: 0.18 },
        windowMs: 150
    };
}

export class RogueLiteManager {
    constructor({ audioService, hud, persistence } = {}) {
        this.audioService = audioService;
        this.hud = hud;
        this.persistence = persistence;
        this.templates = [];
        this.currentRun = null;
        this.activeEffects = [];
        this.eventQueue = [];
        this.cooldowns = { drop: 0, lull: 0, silence: 0, flux: 0, quickdraw: 0, directive: 0 };
        this.activeDirective = null;
        this.transientModifiers = { density: 0, chaos: 0, tempo: 1, remaining: 0, duration: 0 };
    }

    setTemplates(levels) {
        this.templates = Array.isArray(levels) ? levels.slice() : [];
    }

    startRun(preferred) {
        const base = preferred || choose(this.templates) || defaultTemplate();
        this.currentRun = {
            base,
            stage: 1,
            runId: `run-${base.id || 'base'}-${Date.now()}`,
            modifiers: [],
            charges: clamp(base.specialCharges ?? 1, 1, 3)
        };
        this.queueCallout('Rogue Run Initiated', 'info', 2.4);
        this.activeDirective = null;
        this.transientModifiers = { density: 0, chaos: 0, tempo: 1, remaining: 0, duration: 0 };
        return this.buildStageConfig();
    }

    buildStageConfig() {
        if (!this.currentRun) return null;
        const { base, stage, runId, modifiers, charges } = this.currentRun;
        const densityScale = 1 + (stage - 1) * 0.18;
        const chaosScale = 1 + (stage - 1) * 0.14;
        const speedScale = 1 + (stage - 1) * 0.1;
        const beats = Math.min(64 + stage * 8, 180);
        return {
            ...base,
            id: `${base.id || 'rogue'}-stage-${stage}`,
            baseId: base.id || 'rogue',
            stage,
            runId,
            endless: true,
            targetBeats: beats,
            specialCharges: charges,
            runMultiplier: 1 + (stage - 1) * 0.06,
            modifiers: modifiers.map((mod) => mod.id),
            difficulty: {
                ...base.difficulty,
                density: (base.difficulty?.density ?? 1) * densityScale,
                chaos: (base.difficulty?.chaos ?? 0.2) * chaosScale,
                speed: (base.difficulty?.speed ?? 1) * speedScale
            }
        };
    }

    advanceStage(gameState) {
        if (!this.currentRun) return null;
        this.currentRun.stage += 1;
        this.activeDirective = null;
        const unlocked = this.unlockModifier();
        this.currentRun.charges = clamp((this.currentRun.charges || 1) + 1, 1, 3);
        if (gameState && gameState.lives < 3 && this.currentRun.stage % 3 === 0) {
            gameState.grantLife?.();
            this.queueCallout('Extra Life!', 'success', 1.6);
        }
        if (unlocked) {
            this.queueCallout(`${unlocked.label} unlocked`, 'success', 2.5);
        }
        this.queueCallout(`Stage ${this.currentRun.stage}`, 'info', 1.8);
        this.cooldowns.directive = Math.max(this.cooldowns.directive, 3);
        return this.buildStageConfig();
    }

    unlockModifier() {
        if (!this.currentRun) return null;
        const available = MODIFIER_POOL.filter((mod) => !this.currentRun.modifiers.some((active) => active.id === mod.id));
        if (!available.length) return null;
        const chosen = choose(available);
        if (!chosen) return null;
        this.currentRun.modifiers.push({ ...chosen, unlockedAt: this.currentRun.stage });
        return chosen;
    }

    update(dt, analysis, gameState) {
        if (!this.currentRun) {
            return { stage: 1, effects: this.serializeEffects(), persistentModifiers: [], spawnModifiers: {}, events: [] };
        }
        this.tickCooldowns(dt);
        this.tickEffects(dt);
        this.tickTransientModifiers(dt);
        this.handleAudioAnalysis(analysis, gameState);
        const effects = this.serializeEffects();
        const spawnModifiers = this.computeSpawnModifiers(analysis, effects);
        if (gameState) {
            if (spawnModifiers.phaseRegenBonus != null) {
                gameState.setPhaseRegenBonus?.(spawnModifiers.phaseRegenBonus);
            }
            if (effects.glitchLevel > 0) {
                gameState.applyGlitch?.(effects.glitchLevel, 0.25);
            }
            if (effects.reverseControls) {
                gameState.activateReverseControls?.(0.1);
            }
        }
        return {
            stage: this.currentRun.stage,
            runId: this.currentRun.runId,
            effects,
            persistentModifiers: this.currentRun.modifiers.slice(),
            spawnModifiers,
            events: this.consumeEvents()
        };
    }

    handleAudioAnalysis(analysis, gameState) {
        if (!analysis) return;
        let directiveTriggered = false;
        const directiveReady = this.canTriggerDirective(gameState);

        if (analysis.drop && this.cooldowns.drop <= 0) {
            const intensity = 1 + (this.currentRun.stage - 1) * 0.12;
            this.activateEffect('glitch', 5, { glitchLevel: 0.9 + intensity * 0.35 });
            this.cooldowns.drop = 8;
            const hasDropQuickDraw = this.currentRun.modifiers.some((mod) => mod.effects?.dropQuickDraw);
            if (hasDropQuickDraw && this.cooldowns.quickdraw <= 0) {
                this.spawnQuickDraw();
                this.cooldowns.quickdraw = 10;
            }
            if (directiveReady && this.cooldowns.directive <= 0) {
                const count = Math.min(6, 4 + Math.floor(this.currentRun.stage / 2));
                this.queueDirective('pulse-blast', {
                    spawnEvent: {
                        id: `burst-${Date.now()}`,
                        eventType: 'burst',
                        count,
                        lifespan: 3.2,
                        timeToImpact: 0.6
                    }
                });
                this.armDirectiveCooldown(6);
                directiveTriggered = true;
            }
        }

        if (analysis.lull && this.cooldowns.lull <= 0) {
            this.activateEffect('reverse', 6, { invertControls: true });
            this.cooldowns.lull = 12;
            if (!directiveTriggered && directiveReady && this.cooldowns.directive <= 0.5) {
                this.queueDirective('phase-hold');
                this.armDirectiveCooldown(6);
                directiveTriggered = true;
            }
        }

        if (analysis.silence && this.cooldowns.silence <= 0) {
            this.spawnQuickDraw();
            this.cooldowns.silence = 14;
            if (!directiveTriggered && directiveReady && this.cooldowns.directive <= 0.5) {
                this.queueDirective('silence-freeze');
                this.armDirectiveCooldown(7);
                directiveTriggered = true;
            }
        }

        if (!directiveTriggered && directiveReady && this.cooldowns.directive <= 0) {
            if (analysis.bridge) {
                this.queueDirective('phase-hold');
                this.armDirectiveCooldown(6);
                directiveTriggered = true;
            } else if (analysis.rhythmShift && this.currentRun.stage >= 2) {
                this.queueDirective('swipe-sync');
                this.armDirectiveCooldown(5);
                directiveTriggered = true;
            } else if (analysis.vocal) {
                this.queueDirective('echo-pulse');
                this.armDirectiveCooldown(5.5);
                directiveTriggered = true;
            }
        }

        if (analysis.flux > 0.3 && this.cooldowns.flux <= 0 && this.currentRun.stage >= 2) {
            const mult = 1.15 + Math.min(0.25, analysis.flux * 0.8);
            this.activateEffect('tempo-shift', 5, { tempoMultiplier: mult });
            this.cooldowns.flux = 10;
        }
    }

    canTriggerDirective(gameState) {
        if (!this.currentRun) return false;
        if (this.activeDirective) return false;
        if (this.cooldowns.directive > 0) return false;
        if (gameState?.hasActiveDirective?.()) return false;
        return true;
    }

    queueDirective(id, options = {}) {
        const def = DIRECTIVE_DEFS[id];
        if (!def) return;
        this.activeDirective = id;
        const shout = options.callout || def.shout || def.label;
        const variant = options.variant || def.variant || 'info';
        const calloutDuration = options.calloutDuration || 2.1;
        if (shout) {
            this.queueCallout(shout, variant, calloutDuration);
        }
        this.eventQueue.push({ type: 'directive', directiveId: id });
        if (options.spawnEvent) {
            this.eventQueue.push({ type: 'spawn-event', event: options.spawnEvent });
        }
    }

    armDirectiveCooldown(seconds = 5) {
        this.cooldowns.directive = Math.max(this.cooldowns.directive, seconds);
    }

    activateEffect(id, duration, data = {}) {
        const def = EFFECT_DEFS[id];
        if (!def) return;
        const effect = {
            id,
            label: def.label,
            variant: def.variant || 'info',
            duration,
            data: { ...(def.data || {}), ...data }
        };
        this.activeEffects = this.activeEffects.filter((e) => e.id !== id);
        this.activeEffects.push(effect);
        this.eventQueue.push({ type: 'effect-start', id, label: def.label, variant: def.variant, duration, data: effect.data });
    }

    spawnQuickDraw() {
        if (!this.currentRun) return;
        const eventId = `quickdraw-${Date.now()}`;
        const count = Math.min(5, 3 + Math.floor(this.currentRun.stage / 2));
        this.eventQueue.push({
            type: 'spawn-event',
            event: {
                id: eventId,
                eventType: 'quickdraw',
                count,
                lifespan: 3.8
            }
        });
        this.queueCallout('Quick Draw!', 'alert', 2.5);
        this.cooldowns.quickdraw = Math.max(this.cooldowns.quickdraw, 10);
    }

    handleTargetResolved(target, quality) {
        if (!target?.event) return;
        if (target.event.type === 'quickdraw') {
            const message = quality === 'perfect' ? 'Quick Draw Perfect!' : 'Quick Draw Cleared!';
            this.queueCallout(message, 'success', 1.6);
            this.activeEffects = this.activeEffects.filter((effect) => effect.data?.eventId !== target.event.id);
        }
    }

    handleTargetExpired(target) {
        if (!target?.event) return;
        if (target.event.type === 'quickdraw') {
            this.queueCallout('Missed the Quick Draw!', 'alert', 1.8);
        }
    }

    handleSpecialTap(gameState) {
        if (!gameState) {
            return null;
        }
        if (typeof gameState.spendSpecialCharges === 'function' && gameState.lives <= 1) {
            const granted = gameState.spendSpecialCharges(2);
            if (granted) {
                this.queueCallout('Extra Life Ready!', 'success', 1.6);
                return { type: 'extra-life' };
            }
        }
        if (!gameState?.spendSpecialCharges?.(1)) {
            this.queueCallout('No special charge!', 'alert', 1.2);
            return null;
        }
        const duration = 4;
        const factor = 0.55;
        this.queueCallout('Slow Motion!', 'success', 1.6);
        return { type: 'slowmo', duration, factor };
    }

    completeRun(gameState) {
        if (!this.currentRun) return null;
        const baseId = this.currentRun.base?.id || 'rogue';
        const summary = {
            baseId,
            runId: this.currentRun.runId,
            stage: this.currentRun.stage,
            score: gameState?.score || 0,
            maxCombo: gameState?.maxCombo || 0,
            timestamp: Date.now()
        };
        this.currentRun = null;
        this.activeEffects.length = 0;
        this.eventQueue.length = 0;
        this.activeDirective = null;
        this.transientModifiers = { density: 0, chaos: 0, tempo: 1, remaining: 0, duration: 0 };
        this.cooldowns.directive = 0;
        return summary;
    }

    computeSpawnModifiers(analysis, effects) {
        const modifiers = {
            energy: analysis?.energy ?? 0.5,
            bass: analysis?.bass ?? 0.3,
            mid: analysis?.mid ?? 0.3,
            high: analysis?.high ?? 0.3,
            flux: analysis?.flux ?? 0,
            tempoMultiplier: effects?.tempoMultiplier ?? 1,
            glitchLevel: effects?.glitchLevel ?? 0,
            reverseControls: effects?.reverseControls ?? false,
            densityBoost: 0,
            chaosBoost: (effects?.glitchLevel || 0) * 0.25,
            phaseRegenBonus: 0,
            flags: this.currentRun?.modifiers?.map((mod) => mod.id) || []
        };
        (this.currentRun?.modifiers || []).forEach((mod) => {
            if (mod.effects?.densityBoost) {
                modifiers.densityBoost += mod.effects.densityBoost;
            }
            if (mod.effects?.clusterBias) {
                modifiers.clusterBias = (modifiers.clusterBias || 0) + mod.effects.clusterBias;
            }
            if (mod.effects?.phaseRegenBonus) {
                modifiers.phaseRegenBonus = (modifiers.phaseRegenBonus || 0) + mod.effects.phaseRegenBonus;
            }
            if (mod.effects?.bassBias) {
                modifiers.bassBias = (modifiers.bassBias || 0) + mod.effects.bassBias;
            }
            if (mod.effects?.dropQuickDraw) {
                modifiers.dropQuickDraw = true;
            }
        });
        if (this.transientModifiers?.remaining > 0 && this.transientModifiers?.duration > 0) {
            const ratio = this.transientModifiers.remaining / this.transientModifiers.duration;
            modifiers.densityBoost += (this.transientModifiers.density || 0) * ratio;
            modifiers.chaosBoost += (this.transientModifiers.chaos || 0) * ratio;
            modifiers.tempoMultiplier *= 1 + ((this.transientModifiers.tempo || 1) - 1) * ratio;
        }
        return modifiers;
    }

    serializeEffects() {
        const state = {
            glitchLevel: 0,
            reverseControls: false,
            tempoMultiplier: 1
        };
        this.activeEffects.forEach((effect) => {
            if (effect.id === 'glitch') {
                state.glitchLevel = Math.max(state.glitchLevel, effect.data?.glitchLevel ?? 1);
            }
            if (effect.id === 'reverse') {
                state.reverseControls = true;
            }
            if (effect.id === 'tempo-shift') {
                state.tempoMultiplier *= effect.data?.tempoMultiplier ?? 1.15;
            }
        });
        return state;
    }

    tickCooldowns(dt) {
        Object.keys(this.cooldowns).forEach((key) => {
            this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
        });
    }

    tickEffects(dt) {
        const remaining = [];
        this.activeEffects.forEach((effect) => {
            effect.duration -= dt;
            if (effect.duration <= 0) {
                this.eventQueue.push({ type: 'effect-end', id: effect.id });
            } else {
                remaining.push(effect);
            }
        });
        this.activeEffects = remaining;
    }

    queueCallout(text, variant = 'info', duration = 1.6) {
        this.eventQueue.push({ type: 'callout', text, variant, duration });
    }

    consumeEvents() {
        const queue = this.eventQueue.slice();
        this.eventQueue.length = 0;
        return queue;
    }

    getPersistentModifiers() {
        return this.currentRun?.modifiers || [];
    }

    getStage() {
        return this.currentRun?.stage || 1;
    }

    hasActiveDirective() {
        return Boolean(this.activeDirective);
    }

    tickTransientModifiers(dt) {
        const mod = this.transientModifiers;
        if (!mod) return;
        if (mod.remaining > 0) {
            mod.remaining = Math.max(0, mod.remaining - dt);
            if (mod.remaining === 0) {
                mod.density = 0;
                mod.chaos = 0;
                mod.tempo = 1;
                mod.duration = 0;
            }
        }
    }

    applyTransientBoosts({ densityBoost = 0, chaosBoost = 0, tempoBoost = 0, duration = 4 } = {}) {
        const mod = this.transientModifiers;
        if (!mod) return;
        mod.density = Math.max(mod.density, densityBoost);
        mod.chaos = Math.max(mod.chaos, chaosBoost);
        mod.tempo = Math.max(mod.tempo, 1 + tempoBoost);
        mod.duration = Math.max(mod.duration, duration);
        mod.remaining = mod.duration;
    }

    handleDirectiveOutcome(event, gameState) {
        if (!event) return;
        const def = DIRECTIVE_DEFS[event.id];
        this.activeDirective = null;
        this.armDirectiveCooldown(3.5);
        if (!def) return;
        const stageMult = this.currentRun ? 1 + (this.currentRun.stage - 1) * 0.12 : 1;

        if (event.status === 'success') {
            this.queueCallout(`${def.label} Clear!`, 'success', 1.8);
            if (def.reward?.score && gameState) {
                gameState.score += Math.round(def.reward.score * stageMult);
            }
            if (def.reward?.charge && gameState) {
                gameState.gainSpecialCharge(def.reward.charge);
            }
            if (def.reward?.life && gameState) {
                for (let i = 0; i < def.reward.life; i += 1) {
                    gameState.grantLife?.();
                }
            }
            if (def.reward?.phaseEnergy && gameState) {
                gameState.phaseEnergy = Math.min(1, gameState.phaseEnergy + def.reward.phaseEnergy);
            }
            if (def.reward?.tempoBoost) {
                this.activateEffect('tempo-shift', def.reward.tempoDuration || 4, {
                    tempoMultiplier: 1 + def.reward.tempoBoost
                });
            }
            if (def.reward?.densityBoost || def.reward?.chaosBoost) {
                this.applyTransientBoosts({
                    densityBoost: def.reward.densityBoost || 0,
                    chaosBoost: def.reward.chaosBoost || 0,
                    duration: def.reward.densityDuration || def.reward.chaosDuration || 4
                });
            }
        } else {
            this.queueCallout(`${def.label} Failed`, 'alert', 1.6);
            if (def.penalty?.glitch) {
                this.activateEffect('glitch', 3.5, { glitchLevel: 0.6 + def.penalty.glitch });
            }
            if (def.penalty?.chaos) {
                this.applyTransientBoosts({ chaosBoost: def.penalty.chaos, duration: 4 });
            }
            if (def.penalty?.reverse) {
                this.activateEffect('reverse', 4, { invertControls: true });
            }
            if (def.penalty?.drainCharge && gameState?.specialCharges) {
                const drain = Math.min(gameState.specialCharges, def.penalty.drainCharge);
                if (drain > 0) {
                    gameState.spendSpecialCharges?.(drain);
                }
            }
        }
    }

    getDirectiveDefinition(id) {
        const def = DIRECTIVE_DEFS[id];
        return def ? { ...def } : null;
    }
}
