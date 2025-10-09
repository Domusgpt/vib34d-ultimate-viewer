import { buildLayoutBlueprint } from './LayoutBlueprintRenderer.js';

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function roundDelta(value) {
    return Number(value.toFixed(3));
}

export class LayoutBlueprintInsightEngine {
    constructor(options = {}) {
        this.historyLimit = Math.max(1, options.historyLimit ?? 50);
        this.history = [];
        this.scenarioHistoryLimit = Math.max(1, options.scenarioHistoryLimit ?? 15);
        this.scenarioHistory = [];
        this.calibrationHistoryLimit = Math.max(1, options.calibrationHistoryLimit ?? 25);
        this.calibrationHistory = [];
        this.evolutionHistoryLimit = Math.max(1, options.evolutionHistoryLimit ?? 20);
        this.evolutionHistory = [];
    }

    analyze(blueprintOrLayout, options = {}) {
        let blueprint = null;
        if (blueprintOrLayout && blueprintOrLayout.generatedAt && Array.isArray(blueprintOrLayout.zones)) {
            blueprint = blueprintOrLayout;
        } else {
            const layout = blueprintOrLayout || options.layout || {};
            const design = options.design || {};
            const context = options.context || {};
            blueprint = buildLayoutBlueprint(layout, design, context);
        }

        if (!blueprint) {
            return null;
        }

        const analytics = blueprint.analytics || {};
        const lastEntry = this.history.length ? this.history[this.history.length - 1] : null;
        const trend = this.computeTrend(analytics, lastEntry?.analytics);

        const recommendations = Array.isArray(analytics.recommendations)
            ? analytics.recommendations
            : [];
        const statusTags = Array.isArray(analytics.statusTags) ? analytics.statusTags : [];

        const snapshot = {
            id: options.id || `blueprint-${Date.now()}`,
            generatedAt: blueprint.generatedAt,
            analytics: clone(analytics),
            statusTags: [...statusTags],
            recommendations: [...recommendations],
            summary: {
                zoneCount: Array.isArray(blueprint.zones) ? blueprint.zones.length : 0,
                recommendedComponentCount: Array.isArray(blueprint.recommendedComponents)
                    ? blueprint.recommendedComponents.length
                    : 0,
                engagementLevel: blueprint.engagementLevel,
                biometricStress: blueprint.biometricStress
            },
            focusVector: clone(blueprint.focusVector),
            motion: clone(blueprint.motion)
        };

        if (options.storeHistory !== false) {
            this.history.push(snapshot);
            if (this.history.length > this.historyLimit) {
                this.history.splice(0, this.history.length - this.historyLimit);
            }
        }

        return {
            blueprint,
            analytics,
            recommendations,
            statusTags,
            trend,
            history: this.getHistory()
        };
    }

    computeTrend(current = {}, previous = null) {
        const metrics = ['zoneBalanceScore', 'focusReliability', 'stressRisk', 'motionStability'];
        const deltas = {};
        let positive = 0;
        let negative = 0;

        for (const metric of metrics) {
            const currentValue = typeof current[metric] === 'number' ? current[metric] : 0;
            const previousValue = previous && typeof previous[metric] === 'number' ? previous[metric] : null;
            const delta = previousValue === null ? 0 : roundDelta(currentValue - previousValue);
            deltas[metric] = delta;
            if (delta > 0.01) {
                positive += 1;
            } else if (delta < -0.01) {
                negative += 1;
            }
        }

        let direction = 'stable';
        if (positive && !negative) {
            direction = 'improving';
        } else if (negative && !positive) {
            direction = 'declining';
        } else if (positive && negative) {
            direction = 'mixed';
        }

        return { direction, deltas };
    }

    getHistory() {
        return this.history.map(entry => ({ ...entry, analytics: clone(entry.analytics) }));
    }

    clearHistory() {
        this.history = [];
    }

    recordScenarioResult(result) {
        if (!result) {
            return null;
        }

        const entry = {
            id: result.id || `scenario-${Date.now()}`,
            startedAt: result.startedAt,
            completedAt: result.completedAt,
            aggregate: clone(result.aggregate || {}),
            recommendations: Array.isArray(result.recommendations) ? [...result.recommendations] : [],
            statusTags: Array.isArray(result.statusTags) ? [...result.statusTags] : [],
            anomalies: Array.isArray(result.anomalies) ? result.anomalies.map(anomaly => ({ ...anomaly })) : [],
            steps: Array.isArray(result.steps)
                ? result.steps.map(step => ({
                    id: step.id,
                    analytics: clone(step.analytics || {}),
                    statusTags: Array.isArray(step.statusTags) ? [...step.statusTags] : [],
                    recommendations: Array.isArray(step.recommendations) ? [...step.recommendations] : []
                }))
                : []
        };

        this.scenarioHistory.push(entry);
        if (this.scenarioHistory.length > this.scenarioHistoryLimit) {
            this.scenarioHistory.splice(0, this.scenarioHistory.length - this.scenarioHistoryLimit);
        }

        return entry;
    }

    getScenarioHistory() {
        return this.scenarioHistory.map(entry => ({
            ...entry,
            aggregate: clone(entry.aggregate || {}),
            recommendations: Array.isArray(entry.recommendations) ? [...entry.recommendations] : [],
            statusTags: Array.isArray(entry.statusTags) ? [...entry.statusTags] : [],
            anomalies: Array.isArray(entry.anomalies) ? entry.anomalies.map(anomaly => ({ ...anomaly })) : [],
            steps: Array.isArray(entry.steps)
                ? entry.steps.map(step => ({
                    ...step,
                    analytics: clone(step.analytics || {}),
                    statusTags: Array.isArray(step.statusTags) ? [...step.statusTags] : [],
                    recommendations: Array.isArray(step.recommendations) ? [...step.recommendations] : []
                }))
                : []
        }));
    }

    clearScenarioHistory() {
        this.scenarioHistory = [];
    }

    recordCalibrationResult(result) {
        if (!result) {
            return null;
        }

        const entry = {
            id: result.id || `calibration-${Date.now()}`,
            generatedAt: result.generatedAt || Date.now(),
            aggregate: clone(result.aggregate || {}),
            calibrations: Array.isArray(result.calibrations)
                ? result.calibrations.map(item => ({
                      id: item.id,
                      title: item.title,
                      priority: item.priority,
                      score: item.score,
                      tags: Array.isArray(item.tags) ? [...item.tags] : [],
                      adjustments: Array.isArray(item.adjustments)
                          ? item.adjustments.map(adjustment => ({ ...adjustment }))
                          : [],
                      expectedImpact: item.expectedImpact ? { ...item.expectedImpact } : null,
                      rationale: item.rationale
                  }))
                : []
        };

        this.calibrationHistory.push(entry);
        if (this.calibrationHistory.length > this.calibrationHistoryLimit) {
            this.calibrationHistory.splice(0, this.calibrationHistory.length - this.calibrationHistoryLimit);
        }

        return entry;
    }

    getCalibrationHistory() {
        return this.calibrationHistory.map(entry => ({
            ...entry,
            aggregate: clone(entry.aggregate || {}),
            calibrations: Array.isArray(entry.calibrations)
                ? entry.calibrations.map(calibration => ({
                      ...calibration,
                      adjustments: Array.isArray(calibration.adjustments)
                          ? calibration.adjustments.map(adjustment => ({ ...adjustment }))
                          : []
                  }))
                : []
        }));
    }

    clearCalibrationHistory() {
        this.calibrationHistory = [];
    }

    recordEvolutionResult(result) {
        if (!result) {
            return null;
        }

        const entry = {
            id: result.id || `evolution-${Date.now()}`,
            generatedAt: result.generatedAt || new Date().toISOString(),
            baseAnalytics: clone(result.baseAnalytics || {}),
            aggregate: clone(result.aggregate || {}),
            variants: Array.isArray(result.variants)
                ? result.variants.map(variant => ({
                      id: variant.id,
                      title: variant.title,
                      strategyId: variant.strategyId,
                      score: variant.score,
                      scoreDelta: variant.scoreDelta,
                      analytics: clone(variant.analytics || {}),
                      analyticsDelta: clone(variant.analyticsDelta || {}),
                      tags: Array.isArray(variant.tags) ? [...variant.tags] : [],
                      recommendations: Array.isArray(variant.recommendations) ? [...variant.recommendations] : []
                  }))
                : []
        };

        this.evolutionHistory.push(entry);
        if (this.evolutionHistory.length > this.evolutionHistoryLimit) {
            this.evolutionHistory.splice(0, this.evolutionHistory.length - this.evolutionHistoryLimit);
        }

        return entry;
    }

    getEvolutionHistory() {
        return this.evolutionHistory.map(entry => ({
            ...entry,
            baseAnalytics: clone(entry.baseAnalytics || {}),
            aggregate: clone(entry.aggregate || {}),
            variants: Array.isArray(entry.variants)
                ? entry.variants.map(variant => ({
                      ...variant,
                      analytics: clone(variant.analytics || {}),
                      analyticsDelta: clone(variant.analyticsDelta || {}),
                      tags: Array.isArray(variant.tags) ? [...variant.tags] : [],
                      recommendations: Array.isArray(variant.recommendations) ? [...variant.recommendations] : []
                  }))
                : []
        }));
    }

    clearEvolutionHistory() {
        this.evolutionHistory = [];
    }

}

export function createLayoutBlueprintInsightEngine(options = {}) {
    return new LayoutBlueprintInsightEngine(options);
}
