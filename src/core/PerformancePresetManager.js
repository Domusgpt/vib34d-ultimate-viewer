/**
 * PerformancePresetManager
 * Handles saving/loading live performance parameter presets and
 * executing choreographed flourish sequences.
 */
export class PerformancePresetManager {
    constructor({ schema = {}, captureState, applyParameter } = {}) {
        this.schema = schema;
        this.captureState = captureState || (() => ({}));
        this.applyParameter = applyParameter || (() => {});

        this.presets = new Map();
        this.flourishes = new Map();
        this.currentLiveState = {};
        this.isPlayingFlourish = false;
        this.activeFlourish = null;
        this.pendingFrame = null;

        this.easingFunctions = {
            linear: (t) => t,
            easeInQuad: (t) => t * t,
            easeOutQuad: (t) => t * (2 - t),
            easeInOutQuad: (t) => (t < 0.5) ? 2 * t * t : -1 + (4 - 2 * t) * t,
            easeOutCubic: (t) => (--t) * t * t + 1,
            easeInOutCubic: (t) => t < 0.5
                ? 4 * t * t * t
                : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
        };
    }

    /**
     * Normalize value according to schema limits
     */
    normalizeValue(param, value) {
        const spec = this.schema?.[param];
        if (!spec) return value;

        const min = spec.min ?? 0;
        const max = spec.max ?? 1;
        let next = value;

        if (typeof next === 'number') {
            if (Number.isFinite(min)) next = Math.max(min, next);
            if (Number.isFinite(max)) next = Math.min(max, next);
        }

        if (spec.type === 'integer') {
            next = Math.round(next);
        }

        return next;
    }

    /**
     * Save a preset
     */
    savePreset(name, state = this.captureState()) {
        if (!name) throw new Error('Preset name is required');
        const normalized = {};
        Object.entries(state).forEach(([param, value]) => {
            normalized[param] = this.normalizeValue(param, value);
        });
        this.presets.set(name, normalized);
        return normalized;
    }

    /**
     * Remove a preset
     */
    deletePreset(name) {
        this.presets.delete(name);
    }

    /**
     * Apply state immediately
     */
    applyState(state, { recordLive = true } = {}) {
        if (!state) return;
        Object.entries(state).forEach(([param, value]) => {
            const normalized = this.normalizeValue(param, value);
            this.applyParameter(param, normalized);
            if (recordLive) {
                this.currentLiveState[param] = normalized;
            }
        });
    }

    /**
     * Load preset optionally with transition
     */
    loadPreset(name, options = {}) {
        const preset = this.presets.get(name);
        if (!preset) return false;

        if (options.duration && options.duration > 0) {
            return this.animateTransition(preset, options);
        }

        this.applyState(preset);
        return true;
    }

    /**
     * Animate transition to target state
     */
    animateTransition(targetState, { duration = 1000, easing = 'easeInOutQuad', onComplete } = {}) {
        if (this.pendingFrame) {
            cancelAnimationFrame(this.pendingFrame);
            this.pendingFrame = null;
        }

        const startState = { ...this.captureState(), ...this.currentLiveState };
        const keys = Array.from(new Set([...Object.keys(startState), ...Object.keys(targetState)]));
        const easingFn = this.easingFunctions[easing] || this.easingFunctions.easeInOutQuad;
        const startTime = performance.now();

        return new Promise((resolve) => {
            const step = (now) => {
                const t = Math.min(1, (now - startTime) / duration);
                const progress = easingFn(t);
                const frameState = {};

                keys.forEach((param) => {
                    const startValue = startState[param] ?? targetState[param];
                    const endValue = targetState[param] ?? startState[param];
                    if (startValue === undefined || endValue === undefined) return;
                    const next = startValue + (endValue - startValue) * progress;
                    frameState[param] = this.normalizeValue(param, next);
                });

                this.applyState(frameState, { recordLive: true });

                if (t < 1) {
                    this.pendingFrame = requestAnimationFrame(step);
                } else {
                    this.pendingFrame = null;
                    if (typeof onComplete === 'function') onComplete();
                    resolve(true);
                }
            };

            this.pendingFrame = requestAnimationFrame(step);
        });
    }

    /**
     * Record live parameter change
     */
    recordLiveValue(param, value) {
        this.currentLiveState[param] = this.normalizeValue(param, value);
    }

    /**
     * Start recording flourish
     */
    startFlourish(name) {
        if (!name) throw new Error('Flourish name required');
        this.flourishes.set(name, { steps: [], reactive: false, metadata: {} });
        return this.flourishes.get(name);
    }

    addFlourishStep(name, { state = this.captureState(), duration = 1000, easing = 'easeInOutQuad', hold = 0 } = {}) {
        const flourish = this.flourishes.get(name);
        if (!flourish) throw new Error(`Flourish ${name} not found`);
        flourish.steps.push({ state, duration, easing, hold });
        return flourish.steps.length;
    }

    setFlourishReactive(name, reactiveConfig = {}) {
        const flourish = this.flourishes.get(name);
        if (!flourish) throw new Error(`Flourish ${name} not found`);
        flourish.reactive = true;
        flourish.metadata = {
            threshold: reactiveConfig.threshold ?? 0.85,
            band: reactiveConfig.band || 'energy',
            cooldown: reactiveConfig.cooldown ?? 2000,
            lastTrigger: 0
        };
    }

    clearFlourish(name) {
        this.flourishes.delete(name);
    }

    async triggerFlourish(name) {
        const flourish = this.flourishes.get(name);
        if (!flourish || flourish.steps.length === 0) return false;
        if (this.isPlayingFlourish) return false;

        this.isPlayingFlourish = true;
        this.activeFlourish = name;

        for (const step of flourish.steps) {
            await this.animateTransition(step.state, { duration: step.duration, easing: step.easing });
            if (step.hold) {
                await new Promise((resolve) => setTimeout(resolve, step.hold));
            }
        }

        this.isPlayingFlourish = false;
        this.activeFlourish = null;
        return true;
    }

    getPresetNames() {
        return Array.from(this.presets.keys());
    }

    getFlourishNames() {
        return Array.from(this.flourishes.keys());
    }
}
