/**
 * Loads seedable level presets and drives rogue-lite stage progression.
 */
export class LevelManager {
    constructor() {
        this.templates = [];
        this.rotation = [];
        this.currentStage = null;
        this.depth = 0;
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
                loadedLevels.push(normalizeTemplate(data));
            } catch (err) {
                console.warn(`LevelManager: failed to load ${file}`, err);
            }
        }
        if (loadedLevels.length === 0) {
            console.warn('LevelManager: Falling back to default inline level.');
            loadedLevels.push(normalizeTemplate(defaultLevel()));
        }
        this.templates = loadedLevels;
        this.rotation = loadedLevels.length ? loadedLevels : [normalizeTemplate(defaultLevel())];
        this.depth = 0;
        this.currentStage = this.buildStage(0);
        return this.rotation;
    }

    getTemplates() {
        return this.rotation;
    }

    startRun() {
        this.depth = 0;
        this.currentStage = this.buildStage(0);
        return this.currentStage;
    }

    getCurrentLevel() {
        return this.currentStage;
    }

    nextLevel() {
        this.depth += 1;
        this.currentStage = this.buildStage(this.depth);
        return this.currentStage;
    }

    reset() {
        this.depth = 0;
        this.currentStage = this.buildStage(0);
    }

    buildStage(depth) {
        const template = this.rotation[depth % this.rotation.length];
        if (!template) {
            return normalizeTemplate(defaultLevel());
        }
        const loop = Math.floor(depth / this.rotation.length);
        const scale = 1 + loop * 0.25 + depth * 0.08;
        const baseDifficulty = template._baseDifficulty;
        const density = clamp(baseDifficulty.density * scale, 0.45, 5);
        const speed = clamp(baseDifficulty.speed * (1 + loop * 0.12 + depth * 0.03), 0.5, 4);
        const chaos = clamp(baseDifficulty.chaos * (1 + loop * 0.1 + depth * 0.02), 0.08, 2.4);
        const stageSeed = (template.seed ?? 1000) + depth * 37 + loop * 101;
        const stageId = `${template.id || `${template.system}-${template.geometryIndex}`}-d${depth + 1}`;

        return {
            ...template,
            id: stageId,
            seed: stageSeed,
            runDepth: depth + 1,
            runLoop: loop,
            difficultyScale: scale,
            scoreScale: template.scoreScale || (1 + depth * 0.1 + loop * 0.15),
            targetBeats: Math.round((template.targetBeats || 64) * (1 + loop * 0.15)),
            slowMoCharges: Math.min(3, Math.floor(loop / 2)),
            difficulty: {
                ...template.difficulty,
                density,
                speed,
                chaos,
                dimension: template.difficulty.dimension,
                morph: template.difficulty.morph
            }
        };
    }
}

function normalizeTemplate(level) {
    const clone = JSON.parse(JSON.stringify(level));
    const baseDifficulty = {
        density: clone.difficulty?.density ?? 1,
        speed: clone.difficulty?.speed ?? 1,
        chaos: clone.difficulty?.chaos ?? 0.15,
        dimension: clone.difficulty?.dimension ?? 3.6,
        morph: clone.difficulty?.morph ?? 1
    };
    clone._baseDifficulty = baseDifficulty;
    clone.difficulty = {
        density: baseDifficulty.density,
        speed: baseDifficulty.speed,
        chaos: baseDifficulty.chaos,
        dimension: baseDifficulty.dimension,
        morph: baseDifficulty.morph
    };
    return clone;
}

function defaultLevel() {
    return {
        id: 'fallback-faceted',
        system: 'faceted',
        geometryIndex: 3,
        track: {
            url: null,
            id: 'metronome'
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
            density: 1.0,
            dimension: 3.6,
            morph: 1.0
        },
        color: {
            hue: 210,
            intensity: 0.55,
            saturation: 0.85
        }
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
