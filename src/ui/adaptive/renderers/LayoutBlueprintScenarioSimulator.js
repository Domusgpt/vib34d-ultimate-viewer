import { buildLayoutBlueprint } from './LayoutBlueprintRenderer.js';

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function toNumber(value, fallback = 0) {
    const cast = Number(value);
    return Number.isFinite(cast) ? cast : fallback;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function detectAnomalies(analytics = {}) {
    const anomalies = [];
    if (analytics.zoneBalanceScore !== undefined && analytics.zoneBalanceScore < 0.42) {
        anomalies.push({
            type: 'zone-balance',
            severity: 'high',
            message: 'Interactive density collapsing toward a single zone.'
        });
    }
    if (analytics.focusReliability !== undefined && analytics.focusReliability < 0.48) {
        anomalies.push({
            type: 'focus',
            severity: 'medium',
            message: 'Focus cues drifting below reliability threshold.'
        });
    }
    if (analytics.stressRisk !== undefined && analytics.stressRisk > 0.68) {
        anomalies.push({
            type: 'stress',
            severity: 'high',
            message: 'Stress risk exceeds calming fallback guardrails.'
        });
    }
    if (analytics.motionStability !== undefined && analytics.motionStability < 0.52) {
        anomalies.push({
            type: 'motion',
            severity: 'medium',
            message: 'Motion stability trending below wearable comfort guidance.'
        });
    }
    return anomalies;
}

function combineUnique(list = []) {
    return Array.from(new Set(list.filter(Boolean)));
}

function weightMetric(sum, value, weight) {
    return sum + value * weight;
}

function normalizeScenarioSteps(steps = []) {
    return steps
        .filter(Boolean)
        .map((step, index) => ({
            ...step,
            id: step.id || `step-${index + 1}`
        }));
}

export class LayoutBlueprintScenarioSimulator {
    constructor(options = {}) {
        this.insightEngine = options.insightEngine || null;
        this.maxSteps = Math.max(1, options.maxSteps ?? 20);
        this.defaultStepWeight = Math.max(1, options.defaultStepWeight ?? 1);
    }

    runScenario(config = {}) {
        const scenarioId = config.id || `scenario-${Date.now()}`;
        const startedAt = Date.now();
        const steps = normalizeScenarioSteps(config.steps).slice(0, this.maxSteps);
        const contextDefaults = config.contextDefaults || {};
        const baseLayout = config.layout || {};
        const baseDesign = config.design || {};
        const storeStepHistory = config.storeStepHistory ?? false;

        const results = [];
        let zoneBalanceWeighted = 0;
        let focusReliabilityWeighted = 0;
        let stressRiskWeighted = 0;
        let motionStabilityWeighted = 0;
        let totalWeight = 0;
        let peakStressRisk = 0;
        let lowestMotionStability = 1;
        let cumulativeDwellMs = 0;
        const aggregateRecommendations = new Set();
        const aggregateStatusTags = new Set();
        const aggregateAnomalies = [];

        steps.forEach((step, index) => {
            const stepStartedAt = Date.now();
            const context = {
                ...contextDefaults,
                ...(step.context || {})
            };
            const layout = step.layout || baseLayout;
            const design = step.design || baseDesign;
            const blueprint = buildLayoutBlueprint(layout, design, context);

            let insightResult = null;
            if (this.insightEngine) {
                insightResult = this.insightEngine.analyze(blueprint, {
                    id: `${scenarioId}-${step.id}`,
                    storeHistory: storeStepHistory
                });
            }

            const analytics = clone(
                insightResult?.analytics || blueprint.analytics || {}
            );
            const recommendations = combineUnique(
                insightResult?.recommendations || blueprint.analytics?.recommendations || []
            );
            const statusTags = combineUnique(
                insightResult?.statusTags || blueprint.analytics?.statusTags || []
            );
            const anomalies = detectAnomalies(analytics);

            const dwellMs = Math.max(0, toNumber(context.dwellMs, 0));
            const weight = dwellMs > 0 ? dwellMs : this.defaultStepWeight;
            totalWeight += weight;
            zoneBalanceWeighted = weightMetric(zoneBalanceWeighted, analytics.zoneBalanceScore ?? 0, weight);
            focusReliabilityWeighted = weightMetric(focusReliabilityWeighted, analytics.focusReliability ?? 0, weight);
            stressRiskWeighted = weightMetric(stressRiskWeighted, analytics.stressRisk ?? 0, weight);
            motionStabilityWeighted = weightMetric(motionStabilityWeighted, analytics.motionStability ?? 0, weight);

            peakStressRisk = Math.max(peakStressRisk, analytics.stressRisk ?? 0);
            if (typeof analytics.motionStability === 'number') {
                lowestMotionStability = Math.min(lowestMotionStability, analytics.motionStability);
            }
            cumulativeDwellMs += dwellMs;

            recommendations.forEach(value => aggregateRecommendations.add(value));
            statusTags.forEach(value => aggregateStatusTags.add(value));
            aggregateAnomalies.push(...anomalies);

            const stepCompletedAt = Date.now();
            results.push({
                id: step.id,
                startedAt: stepStartedAt,
                completedAt: stepCompletedAt,
                durationMs: stepCompletedAt - stepStartedAt,
                context: clone(context),
                blueprint,
                analytics,
                recommendations,
                statusTags,
                anomalies,
                notes: step.notes || null
            });
        });

        const averageZoneBalance = totalWeight ? zoneBalanceWeighted / totalWeight : 0;
        const averageFocusReliability = totalWeight ? focusReliabilityWeighted / totalWeight : 0;
        const averageStressRisk = totalWeight ? stressRiskWeighted / totalWeight : 0;
        const averageMotionStability = totalWeight ? motionStabilityWeighted / totalWeight : 0;

        const durationMs = Date.now() - startedAt;
        const aggregate = {
            averageZoneBalance: Number(averageZoneBalance.toFixed(3)),
            averageFocusReliability: Number(averageFocusReliability.toFixed(3)),
            averageStressRisk: Number(averageStressRisk.toFixed(3)),
            averageMotionStability: Number(averageMotionStability.toFixed(3)),
            peakStressRisk: Number(peakStressRisk.toFixed(3)),
            lowestMotionStability: Number(lowestMotionStability.toFixed(3)),
            scenarioConfidence: Number(
                clamp(
                    (averageZoneBalance + averageFocusReliability + (1 - averageStressRisk) + averageMotionStability) / 4,
                    0,
                    1
                ).toFixed(3)
            ),
            anomalyCount: aggregateAnomalies.length,
            dwellDurationMs: cumulativeDwellMs
        };

        const recommendations = combineUnique(Array.from(aggregateRecommendations));
        const statusTags = combineUnique(Array.from(aggregateStatusTags));

        const scenarioResult = {
            scenarioId,
            startedAt,
            completedAt: startedAt + durationMs,
            durationMs,
            steps: results,
            aggregate,
            recommendations,
            statusTags,
            anomalies: aggregateAnomalies
        };

        if (this.insightEngine && typeof this.insightEngine.recordScenarioResult === 'function') {
            this.insightEngine.recordScenarioResult({
                id: scenarioId,
                startedAt,
                completedAt: startedAt + durationMs,
                aggregate,
                recommendations,
                statusTags,
                anomalies: aggregateAnomalies,
                steps: results.map(step => ({
                    id: step.id,
                    analytics: clone(step.analytics),
                    statusTags: [...step.statusTags],
                    recommendations: [...step.recommendations]
                }))
            });
        }

        return scenarioResult;
    }
}

export function createLayoutBlueprintScenarioSimulator(options = {}) {
    return new LayoutBlueprintScenarioSimulator(options);
}
