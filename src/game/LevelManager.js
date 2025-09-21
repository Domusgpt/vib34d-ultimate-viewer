import { createSeededRNG } from './utils/Random.js';

/**
 * Loads seedable level presets and orchestrates endless roguelite depth progression.
 */
export class LevelManager {
    constructor() {
        this.levels = [];
        this.loaded = false;
        this.runSeed = Math.floor(Math.random() * 100000);
        this.rng = createSeededRNG(this.runSeed);
        this.stage = 0;
        this.order = [];
        this.orderIndex = 0;
        this.currentLevel = null;
    }

    async load() {
        const levelFiles = [
            'lvl-01-faceted-torus.json',
            'lvl-02-quantum-sphere.json',
            'lvl-03-holographic-crystal.json'
        ];
        const loadedLevels = [];
        for (const file of levelFiles) {
            try {
                const url = new URL(`./levels/${file}`, import.meta.url);
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                loadedLevels.push(data);
            } catch (err) {
                console.warn(`LevelManager: failed to load ${file}`, err);
            }
        }
        if (loadedLevels.length === 0) {
            console.warn('LevelManager: Falling back to default inline level.');
            loadedLevels.push(defaultLevel());
        }
        this.levels = loadedLevels;
        this.loaded = false;
        this.stage = 0;
        this.order = [];
        this.currentLevel = null;
        this.loaded = true;
        return this.levels;
    }

    startRun({ seed, shuffle = true } = {}) {
        if (!this.loaded) {
            throw new Error('LevelManager: call load() before startRun().');
        }
        if (typeof seed === 'number') {
            this.runSeed = seed;
        }
        this.rng = createSeededRNG(this.runSeed);
        this.stage = 0;
        this.order = this.levels.map((_, index) => index);
        if (shuffle && this.order.length > 1) {
            this.order = this.rng.shuffle(this.order);
        }
        this.orderIndex = 0;
        const template = this.levels[this.order[this.orderIndex]] || defaultLevel();
        this.currentLevel = this.buildStage(template, this.stage, {});
        return this.currentLevel;
    }

    getCurrentLevel() {
        return this.currentLevel;
    }

    nextStage(summary = {}) {
        if (!this.loaded) {
            throw new Error('LevelManager: call load() before nextStage().');
        }
        this.stage += 1;
        if (!this.levels.length) {
            this.currentLevel = this.buildStage(defaultLevel(), this.stage, summary);
            return this.currentLevel;
        }
        this.orderIndex = (this.orderIndex + 1) % this.order.length;
        if (this.orderIndex === 0 && this.order.length > 1) {
            this.order = this.rng.shuffle(this.order);
        }
        const template = this.levels[this.order[this.orderIndex]];
        this.currentLevel = this.buildStage(template, this.stage, summary);
        return this.currentLevel;
    }

    buildStage(template, stageIndex, summary = {}) {
        const depth = stageIndex + 1;
        const scaling = computeScaling(template, depth, summary, this.rng);
        const targetBeats = Math.round((template.targetBeats || 64) + depth * 6);
        const baseDifficulty = template.difficulty || {};
        const difficulty = {
            speed: clamp((baseDifficulty.speed ?? 1) * scaling.speed, 0.4, 3.6),
            chaos: clamp((baseDifficulty.chaos ?? 0.15) * scaling.chaos + depth * 0.015, 0, 1.8),
            density: clamp((baseDifficulty.density ?? 1) * scaling.density, 0.55, 4.0),
            morph: baseDifficulty.morph ?? 1.0,
            dimension: baseDifficulty.dimension ?? 3.6
        };
        return {
            ...template,
            id: `${template.id || 'rogue-template'}-depth-${depth}`,
            baseId: template.id || 'rogue-template',
            stage: depth,
            seed: (template.seed ?? 1337) + depth * 97,
            bpm: Math.round((template.bpm || 120) * scaling.tempo),
            windowMs: Math.max(90, (template.windowMs || 150) - depth * 2),
            targetBeats,
            difficulty,
            difficultyScale: scaling.intensity,
            modifiers: {
                dropBias: scaling.dropBias,
                quickDrawBias: scaling.quickDrawBias,
                reverseChance: scaling.reverseChance,
                glitchBoost: scaling.glitchBoost,
                bridgeWindow: scaling.bridgeWindow,
                tempoShift: scaling.tempo
            }
        };
    }
}

function defaultLevel() {
    return {
        id: 'fallback-faceted',
        system: 'faceted',
        geometryIndex: 3,
        track: {
            url: null,
            id: 'mic-live',
            mode: 'microphone'
        },
        bpm: 120,
        seed: 1024,
        planes: ['XW', 'YW'],
        windowMs: 160,
        spawn: { pattern: 'belt', density: 0.8 },
        powerups: ['pulse+'],
        targetBeats: 64,
        difficulty: {
            speed: 1.0,
            chaos: 0.15,
            density: 1.0
        },
        color: {
            hue: 210,
            intensity: 0.55,
            saturation: 0.85
        },
        difficultyScale: 1,
        modifiers: {
            dropBias: 0.2,
            quickDrawBias: 0.18,
            reverseChance: 0.08,
            glitchBoost: 1,
            bridgeWindow: 1.1,
            tempoShift: 1
        }
    };
}

function computeScaling(template, depth, summary, rng) {
    const comboFactor = summary.combo ? 1 + Math.min(0.45, summary.combo / 90) : 1;
    const survivalFactor = summary.lives != null && summary.lives <= 1 ? 0.9 : 1;
    const stageMomentum = summary.stageScore ? 1 + Math.min(0.4, summary.stageScore / 6000) : 1;
    const intensity = (1 + depth * 0.14) * comboFactor;
    const density = intensity * stageMomentum * survivalFactor;
    const speed = 1 + depth * 0.08 + (summary.stage || 1) * 0.01;
    const chaos = 1 + depth * 0.06 + (template.system === 'quantum' ? 0.1 : 0);
    const dropBiasBase = 0.22 + depth * 0.05 + (template.system === 'holographic' ? 0.12 : 0);
    const quickDrawBias = 0.18 + depth * 0.04;
    const reverseChance = depth > 1 ? 0.08 + depth * 0.04 : 0.05;
    const glitchBoost = template.system === 'quantum' ? 1.25 : template.system === 'holographic' ? 1.1 : 1;
    const tempo = 1 + Math.min(0.25, depth * 0.025);
    const bridgeWindow = Math.max(0.8, 1.25 - depth * 0.03);
    const jitter = rng ? rng.nextRange(0.95, 1.05) : 1;
    return {
        density: density * jitter,
        speed,
        chaos,
        intensity,
        dropBias: Math.min(0.95, dropBiasBase),
        quickDrawBias: Math.min(0.9, quickDrawBias),
        reverseChance: Math.min(0.85, reverseChance),
        glitchBoost,
        tempo,
        bridgeWindow
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
