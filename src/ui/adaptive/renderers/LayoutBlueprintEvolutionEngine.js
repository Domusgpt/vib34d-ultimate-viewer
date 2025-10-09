import { buildLayoutBlueprint } from './LayoutBlueprintRenderer.js';

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function cloneVariant(variant = {}) {
    return {
        ...variant,
        recommendations: Array.isArray(variant.recommendations) ? [...variant.recommendations] : [],
        tags: Array.isArray(variant.tags) ? [...variant.tags] : [],
        adjustments: Array.isArray(variant.adjustments) ? variant.adjustments.map(adjustment => ({ ...adjustment })) : [],
        analytics: clone(variant.analytics || {}),
        analyticsDelta: clone(variant.analyticsDelta || {}),
        blueprint: clone(variant.blueprint || {}),
        layout: variant.layout ? clone(variant.layout) : undefined,
        context: variant.context ? clone(variant.context) : undefined,
        design: variant.design ? clone(variant.design) : undefined
    };
}

function cloneAggregate(aggregate = null) {
    if (!aggregate) return aggregate;
    return {
        ...aggregate,
        tags: Array.isArray(aggregate.tags) ? [...aggregate.tags] : [],
        recommendations: Array.isArray(aggregate.recommendations) ? [...aggregate.recommendations] : []
    };
}

function toNumber(value, fallback = 0) {
    const cast = Number(value);
    return Number.isFinite(cast) ? cast : fallback;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function createBlueprintSpecs(blueprint) {
    const layout = {
        intensity: toNumber(blueprint?.intensity, 0.5),
        motion: clone(blueprint?.motion || {}),
        zones: Array.isArray(blueprint?.zones)
            ? blueprint.zones.map(zone => ({
                  id: zone.id,
                  occupancy: toNumber(zone.occupancy, 0.4),
                  layeringDepth: toNumber(zone.layeringDepth, 0.25),
                  curvature: toNumber(zone.curvature, 0.35),
                  visibility: toNumber(zone.visibility, 0.6),
                  recommendedComponents: Array.isArray(zone.recommendedComponents)
                      ? [...zone.recommendedComponents]
                      : Array.isArray(zone.components)
                      ? [...zone.components]
                      : []
              }))
            : [],
        annotations: Array.isArray(blueprint?.annotations) ? blueprint.annotations.map(annotation => ({ ...annotation })) : []
    };

    const design = (() => {
        if (blueprint?.design && typeof blueprint.design === 'object') {
            return clone(blueprint.design);
        }
        return {
            pattern: blueprint?.pattern || null,
            monetization: blueprint?.monetization ? clone(blueprint.monetization) : null,
            integration: blueprint?.integration ? clone(blueprint.integration) : null
        };
    })();

    const context = {
        focusVector: clone(blueprint?.focusVector || {}),
        engagementLevel: toNumber(blueprint?.engagementLevel, 0.4),
        biometricStress: toNumber(blueprint?.biometricStress, 0.25)
    };

    return { layout, design, context };
}

function computeVariantScore(analytics = {}) {
    const zoneBalance = clamp(toNumber(analytics.zoneBalanceScore, 0.5), 0, 1);
    const focusReliability = clamp(toNumber(analytics.focusReliability, 0.5), 0, 1);
    const stressRelief = 1 - clamp(toNumber(analytics.stressRisk, 0.5), 0, 1);
    const motionStability = clamp(toNumber(analytics.motionStability, 0.5), 0, 1);
    return Number(((zoneBalance + focusReliability + stressRelief + motionStability) / 4).toFixed(3));
}

function computeAnalyticsDelta(base = {}, variant = {}) {
    const metrics = ['zoneBalanceScore', 'focusReliability', 'stressRisk', 'motionStability'];
    const delta = {};
    metrics.forEach(metric => {
        const baseValue = typeof base[metric] === 'number' ? base[metric] : 0;
        const variantValue = typeof variant[metric] === 'number' ? variant[metric] : 0;
        delta[metric] = Number((variantValue - baseValue).toFixed(3));
    });
    return delta;
}

function mergeTags(target = new Set(), tags = []) {
    if (Array.isArray(tags)) {
        tags.forEach(tag => {
            if (tag) {
                target.add(tag);
            }
        });
    }
    return target;
}

const DEFAULT_EVOLUTION_STRATEGIES = [
    {
        id: 'balance-harmonics',
        title: 'Balance Harmonics Variant',
        description: 'Redistribute occupancy to stabilize peripheral density when zone balance falls below adaptive comfort.',
        weight: 0.85,
        generate({ blueprint, layout }) {
            const balance = toNumber(blueprint?.analytics?.zoneBalanceScore, 0.55);
            if (balance >= 0.68) {
                return null;
            }

            const primary = layout.zones.find(zone => zone.id === 'primary');
            const peripheral = layout.zones.find(zone => zone.id === 'peripheral');
            const ambient = layout.zones.find(zone => zone.id === 'ambient');

            const adjustments = [];
            const redistributedZones = layout.zones.map(zone => ({ ...zone }));
            const redistribution = clamp((0.68 - balance) * 0.3, 0.02, 0.18);

            if (primary) {
                primary.occupancy = clamp(primary.occupancy - redistribution, 0.35, 0.95);
                adjustments.push({
                    type: 'layout',
                    target: 'primary.occupancy',
                    change: Number((-redistribution).toFixed(3))
                });
            }
            if (peripheral) {
                peripheral.occupancy = clamp(peripheral.occupancy + redistribution * 0.65, 0.18, 0.75);
                adjustments.push({
                    type: 'layout',
                    target: 'peripheral.occupancy',
                    change: Number((redistribution * 0.65).toFixed(3))
                });
            }
            if (ambient) {
                ambient.occupancy = clamp(ambient.occupancy + redistribution * 0.35, 0.1, 0.6);
                adjustments.push({
                    type: 'layout',
                    target: 'ambient.occupancy',
                    change: Number((redistribution * 0.35).toFixed(3))
                });
            }

            return {
                id: 'balance-harmonics',
                title: 'Balance Harmonics Variant',
                rationale: `Zone balance ${balance.toFixed(2)} flagged for redistribution; boosting peripheral occupancy to relax focus stress.`,
                layout: { ...layout, zones: redistributedZones },
                recommendations: [
                    'Adopt the harmonics variant for prototypes targeting ambient-heavy surfaces.',
                    'Pair with calibration sweep to validate halo comfort after redistribution.'
                ],
                tags: ['balance', 'comfort'],
                adjustments
            };
        }
    },
    {
        id: 'focus-cohesion',
        title: 'Focus Cohesion Variant',
        description: 'Tighten dwell calibration and reinforce halo contrast when focus reliability is degraded.',
        weight: 0.9,
        generate({ blueprint, layout, context }) {
            const reliability = toNumber(blueprint?.analytics?.focusReliability, 0.58);
            if (reliability >= 0.7) {
                return null;
            }

            const intensityBump = clamp((0.72 - reliability) * 0.4, 0.02, 0.18);
            const adjustedContext = {
                ...context,
                engagementLevel: clamp(context.engagementLevel + intensityBump * 0.35, 0, 1)
            };

            const adjustedLayout = {
                ...layout,
                intensity: clamp(layout.intensity + intensityBump * 0.85, 0.2, 0.95),
                annotations: [
                    ...(layout.annotations || []),
                    {
                        id: `focus-${Date.now()}`,
                        type: 'insight',
                        summary: 'Reinforced halo + tightened dwell timing via focus cohesion variant.',
                        severity: 'warning'
                    }
                ]
            };

            const adjustments = [
                {
                    type: 'layout',
                    target: 'intensity',
                    change: Number((intensityBump * 0.85).toFixed(3))
                },
                {
                    type: 'context',
                    target: 'engagementLevel',
                    change: Number((intensityBump * 0.35).toFixed(3))
                }
            ];

            return {
                id: 'focus-cohesion',
                title: 'Focus Cohesion Variant',
                rationale: `Focus reliability ${reliability.toFixed(2)} triggers cohesion reinforcement (target ≥ 0.70).`,
                layout: adjustedLayout,
                context: adjustedContext,
                recommendations: [
                    'Enable focus cohesion when neural or gaze drift is detected during wearable QA.',
                    'Layer calibration studio runs after cohesion adoption to validate impact.'
                ],
                tags: ['focus', 'stability'],
                adjustments
            };
        }
    },
    {
        id: 'motion-serenity',
        title: 'Motion Serenity Variant',
        description: 'Dampen motion velocity and bias drift to reduce stress risk spikes tied to motion instability.',
        weight: 0.75,
        generate({ blueprint, layout, context }) {
            const motionStability = toNumber(blueprint?.analytics?.motionStability, 0.6);
            const stressRisk = toNumber(blueprint?.analytics?.stressRisk, 0.55);
            if (motionStability >= 0.72 && stressRisk <= 0.62) {
                return null;
            }

            const velocityDrop = clamp((0.72 - motionStability) * 0.4 + (stressRisk - 0.55) * 0.25, 0.04, 0.2);
            const adjustedLayout = {
                ...layout,
                motion: {
                    ...layout.motion,
                    velocity: clamp(toNumber(layout.motion?.velocity, 0.5) - velocityDrop, 0.05, 0.9),
                    bias: {
                        x: clamp(toNumber(layout.motion?.bias?.x, 0) * 0.75, -1, 1),
                        y: clamp(toNumber(layout.motion?.bias?.y, 0) * 0.75, -1, 1),
                        z: clamp(toNumber(layout.motion?.bias?.z, 0) * 0.75, -1, 1)
                    }
                }
            };

            const adjustedContext = {
                ...context,
                biometricStress: clamp(context.biometricStress - velocityDrop * 0.4, 0, 1)
            };

            return {
                id: 'motion-serenity',
                title: 'Motion Serenity Variant',
                rationale: 'Stabilizing motion cues to curb stress spikes and smooth wearable transitions.',
                layout: adjustedLayout,
                context: adjustedContext,
                recommendations: [
                    'Adopt serenity variant for healthcare wearables or high-alert contexts.',
                    'Pair with commercialization reporting to quantify comfort-driven retention gains.'
                ],
                tags: ['motion', 'comfort'],
                adjustments: [
                    { type: 'layout', target: 'motion.velocity', change: Number((-velocityDrop).toFixed(3)) }
                ]
            };
        }
    }
];

export class LayoutBlueprintEvolutionEngine {
    constructor(options = {}) {
        this.historyLimit = Math.max(1, options.historyLimit ?? 20);
        this.history = [];
        this.strategies = new Map();
        this.insightEngine = options.insightEngine || null;

        const useDefaults = options.defaults !== false;
        if (useDefaults) {
            for (const strategy of DEFAULT_EVOLUTION_STRATEGIES) {
                this.registerStrategy(strategy);
            }
        }
    }

    registerStrategy(strategy) {
        if (!strategy || !strategy.id || typeof strategy.generate !== 'function') {
            throw new Error('Evolution strategy must define an id and generate() function.');
        }
        this.strategies.set(strategy.id, { ...strategy });
        return this;
    }

    removeStrategy(id) {
        this.strategies.delete(id);
        return this;
    }

    clearStrategies() {
        this.strategies.clear();
        return this;
    }

    getStrategies() {
        return Array.from(this.strategies.values()).map(strategy => ({ ...strategy }));
    }

    evolve(options = {}) {
        const id = options.id || `evolution-${Date.now()}`;
        let blueprint = options.blueprint || null;

        if (!blueprint) {
            const layout = options.layout || {};
            const design = options.design || {};
            const context = options.context || {};
            blueprint = buildLayoutBlueprint(layout, design, context);
        }

        if (!blueprint) {
            return null;
        }

        const specs = createBlueprintSpecs(blueprint);
        const baseAnalytics = clone(blueprint.analytics || {});
        const baseScore = computeVariantScore(baseAnalytics);

        const variants = [];
        for (const strategy of this.strategies.values()) {
            let outcome = null;
            try {
                outcome = strategy.generate({
                    blueprint,
                    layout: clone(specs.layout),
                    design: clone(specs.design),
                    context: clone(specs.context),
                    options: options.strategyOptions || {}
                });
            } catch (error) {
                variants.push({
                    id: strategy.id,
                    title: strategy.title || strategy.id,
                    strategyId: strategy.id,
                    error: error.message,
                    failed: true
                });
                continue;
            }

            if (!outcome) {
                continue;
            }

            const variantLayout = outcome.layout || specs.layout;
            const variantDesign = outcome.design || specs.design;
            const variantContext = outcome.context || specs.context;
            const variantBlueprint = buildLayoutBlueprint(variantLayout, variantDesign, variantContext);
            const analyticsDelta = computeAnalyticsDelta(baseAnalytics, variantBlueprint.analytics);
            const score = computeVariantScore(variantBlueprint.analytics);

            const recommendationSet = new Set();
            mergeTags(recommendationSet, outcome.recommendations);

            variants.push({
                id: outcome.id || strategy.id,
                title: outcome.title || strategy.title || outcome.id || strategy.id,
                strategyId: strategy.id,
                rationale: outcome.rationale || strategy.description || '',
                recommendations: Array.from(recommendationSet),
                tags: Array.from(mergeTags(new Set(), outcome.tags)),
                adjustments: Array.isArray(outcome.adjustments) ? outcome.adjustments.map(item => ({ ...item })) : [],
                analytics: clone(variantBlueprint.analytics || {}),
                analyticsDelta,
                score,
                scoreDelta: Number((score - baseScore).toFixed(3)),
                blueprint: variantBlueprint,
                generatedAt: variantBlueprint.generatedAt,
                weight: toNumber(outcome.weight ?? strategy.weight ?? 1, 1)
            });
        }

        if (!variants.length) {
            return {
                id,
                generatedAt: new Date().toISOString(),
                blueprint,
                variants: [],
                aggregate: {
                    variantCount: 0,
                    recommendedVariantId: null,
                    baseScore
                }
            };
        }

        const sorted = [...variants].sort((a, b) => b.score - a.score);
        const recommended = sorted[0];
        const aggregateTags = new Set();
        const aggregateRecommendations = new Set();
        let weightedScoreSum = 0;
        let totalWeight = 0;

        for (const variant of variants) {
            mergeTags(aggregateTags, variant.tags);
            mergeTags(aggregateRecommendations, variant.recommendations);
            const weight = clamp(toNumber(variant.weight, 1), 0.1, 5);
            weightedScoreSum += variant.score * weight;
            totalWeight += weight;
        }

        const aggregate = {
            variantCount: variants.length,
            baseScore,
            recommendedVariantId: recommended.id,
            recommendedScore: recommended.score,
            weightedScore: Number((weightedScoreSum / totalWeight).toFixed(3)),
            tags: Array.from(aggregateTags),
            recommendations: Array.from(aggregateRecommendations),
            averageScoreDelta: Number(
                (
                    variants.reduce((total, variant) => total + variant.scoreDelta, 0) /
                    variants.length
                ).toFixed(3)
            )
        };

        const result = {
            id,
            generatedAt: new Date().toISOString(),
            blueprint,
            variants,
            aggregate
        };

        this.history.push({
            ...result,
            blueprint: clone(blueprint),
            variants: variants.map(variant => cloneVariant(variant)),
            aggregate: cloneAggregate(aggregate)
        });
        if (this.history.length > this.historyLimit) {
            this.history.splice(0, this.history.length - this.historyLimit);
        }

        if (this.insightEngine?.recordEvolutionResult) {
            this.insightEngine.recordEvolutionResult({
                id,
                generatedAt: result.generatedAt,
                baseAnalytics,
                aggregate,
                variants: result.variants
            });
        }

        return result;
    }

    getHistory() {
        return this.history.map(entry => ({
            ...entry,
            blueprint: clone(entry.blueprint || {}),
            aggregate: cloneAggregate(entry.aggregate),
            variants: Array.isArray(entry.variants) ? entry.variants.map(variant => cloneVariant(variant)) : []
        }));
    }

    clearHistory() {
        this.history = [];
    }
}

export function createLayoutBlueprintEvolutionEngine(options = {}) {
    return new LayoutBlueprintEvolutionEngine(options);
}
