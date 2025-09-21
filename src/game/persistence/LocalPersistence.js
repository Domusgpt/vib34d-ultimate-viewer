const STORAGE_KEY = 'latticePulseProgress';

export class LocalPersistence {
    constructor() {
        this.state = {
            highScores: {},
            settings: {
                audio: true,
                tilt: false
            }
        };
        this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.state = { ...this.state, ...parsed };
            }
        } catch (err) {
            console.warn('LocalPersistence: failed to load state', err);
        }
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        } catch (err) {
            console.warn('LocalPersistence: failed to save state', err);
        }
    }

    recordScore(levelId, score, combo, meta = {}) {
        const existing = this.state.highScores[levelId];
        if (!existing || score > existing.score) {
            this.state.highScores[levelId] = {
                score,
                combo,
                ...meta,
                timestamp: Date.now()
            };
            this.save();
            return true;
        }
        return false;
    }

    getBestScore(levelId) {
        return this.state.highScores[levelId] || null;
    }

    updateSettings(updates) {
        this.state.settings = { ...this.state.settings, ...updates };
        this.save();
    }

    getSettings() {
        return this.state.settings;
    }
}
