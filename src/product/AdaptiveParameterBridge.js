import AdaptiveModalityManager from '../core/adaptive/AdaptiveModalityManager.js';

/**
 * AdaptiveParameterBridge connects the modality manager to engine render loops.
 * It maintains system-specific parameter blueprints and returns aggregated values
 * on demand so existing rendering code can remain largely untouched.
 */
export default class AdaptiveParameterBridge {
    constructor({ modalityManager = null, logger = console } = {}) {
        this.logger = logger;
        this.modalityManager = modalityManager || new AdaptiveModalityManager({ logger });
        this.systemProfiles = new Map();
        this.lastComputed = new Map();
    }

    getModalityManager() {
        return this.modalityManager;
    }

    registerSystemProfile(systemName, { baseParameters = {}, transform } = {}) {
        this.systemProfiles.set(systemName, { baseParameters, transform });
        this.logger.info?.(`🧭 Registered adaptive parameter profile for ${systemName}`);
    }

    getParametersForSystem(systemName, defaults = {}) {
        const profile = this.systemProfiles.get(systemName) || {};
        const mergedDefaults = { ...defaults, ...profile.baseParameters };
        let evaluated = this.modalityManager.evaluateParameters({ baseParameters: mergedDefaults });

        if (profile.transform) {
            try {
                evaluated = profile.transform(evaluated, { systemName });
            } catch (error) {
                this.logger.error?.(`❌ System transform failed for ${systemName}:`, error);
            }
        }

        this.lastComputed.set(systemName, evaluated);
        return evaluated;
    }

    ingestSignal(modalityId, payload, context) {
        return this.modalityManager.ingestSignal(modalityId, payload, context);
    }

    getLastComputed(systemName) {
        return this.lastComputed.get(systemName) || null;
    }
}
