import { SeededRandom } from '../utils/SeededRandom.js';

export class LevelManager {
    constructor({ storageKey = 'latticePulseProgress' } = {}) {
        this.storageKey = storageKey;
        this.levels = [];
        this.currentIndex = 0;
        this.progress = this.loadProgress();
        this.random = new SeededRandom(1);
    }

    loadProgress() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return {};
            return JSON.parse(stored);
        } catch (error) {
            console.warn('Level progress load failed:', error);
            return {};
        }
    }

    saveProgress() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.progress));
        } catch (error) {
            console.warn('Level progress save failed:', error);
        }
    }

    setLevels(levelArray) {
        this.levels = levelArray;
        this.currentIndex = 0;
    }

    getCurrentLevel() {
        return this.levels[this.currentIndex] || null;
    }

    advanceLevel() {
        if (this.currentIndex < this.levels.length - 1) {
            this.currentIndex += 1;
        }
        return this.getCurrentLevel();
    }

    recordScore(levelId, score) {
        const levelProgress = this.progress[levelId] || { best: 0, attempts: 0 };
        levelProgress.best = Math.max(levelProgress.best, score);
        levelProgress.attempts += 1;
        this.progress[levelId] = levelProgress;
        this.saveProgress();
    }

    getLevelProgress(levelId) {
        return this.progress[levelId] || { best: 0, attempts: 0 };
    }

    applyLevelSettings(level, { modeController, geometryController, audioService }) {
        if (!level) return;
        if (geometryController) {
            geometryController.setGeometry(level.geometryIndex || 0);
            geometryController.setMode(level.system || 'faceted');
            geometryController.setSeed(level.seed || 1);
        }
        if (modeController) {
            modeController.setMode(level.system || 'faceted');
            modeController.setGeometry(level.geometryIndex || 0);
            modeController.updateParameters({
                speed: level.difficulty?.speed || 1,
                chaos: level.difficulty?.chaos || 0.1,
                gridDensity: level.difficulty?.gridDensity || 18,
                hue: level.palette?.hue || 210,
                intensity: level.palette?.intensity || 0.6,
                saturation: level.palette?.saturation || 0.85
            });
        }
        if (audioService && level.bpm) {
            audioService.setBpm(level.bpm);
        }
    }
}
