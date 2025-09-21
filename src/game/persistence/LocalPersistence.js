const STORAGE_KEY = 'latticePulseProgress';

export class LocalPersistence {
    constructor() {
        this.state = {
            highScores: {},
            settings: {
                audio: true,
                tilt: false
            },
            runs: {}
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
            if (!this.state.runs) {
                this.state.runs = {};
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

    recordScore(levelId, score, combo) {
        const existing = this.state.highScores[levelId];
        if (!existing || score > existing.score) {
            this.state.highScores[levelId] = {
                score,
                combo,
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

    recordRunResult(levelId, summary) {
        if (!levelId || !summary) return false;
        if (!this.state.runs) {
            this.state.runs = {};
        }
        const existing = this.state.runs[levelId];
        const isBetter = !existing || summary.stage > existing.stage || (summary.stage === existing.stage && summary.score > existing.score);
        if (isBetter) {
            this.state.runs[levelId] = {
                stage: summary.stage,
                score: summary.score,
                combo: summary.maxCombo,
                timestamp: summary.timestamp || Date.now()
            };
            this.save();
        }
        return isBetter;
    }

    getRunRecord(levelId) {
        return this.state.runs?.[levelId] || null;
    }

    updateSettings(updates) {
        this.state.settings = { ...this.state.settings, ...updates };
        this.save();
    }

    getSettings() {
        return this.state.settings;
    }
}
