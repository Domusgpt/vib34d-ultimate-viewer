/**
 * Loads seedable level presets and advances through the campaign graph.
 */
export class LevelManager {
    constructor() {
        this.levels = [];
        this.currentIndex = 0;
        this.loaded = false;
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
        this.loaded = true;
        return this.levels;
    }

    getCurrentLevel() {
        return this.levels[this.currentIndex];
    }

    nextLevel() {
        this.currentIndex = (this.currentIndex + 1) % this.levels.length;
        return this.getCurrentLevel();
    }

    reset() {
        this.currentIndex = 0;
    }
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
            density: 1.0
        },
        color: {
            hue: 210,
            intensity: 0.55,
            saturation: 0.85
        }
    };
}
