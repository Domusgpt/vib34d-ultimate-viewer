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

function mergeAdjustment(aggregate, adjustment) {
    if (!adjustment || !adjustment.type || !adjustment.target) {
        return aggregate;
    }

    const key = `${adjustment.type}:${adjustment.target}`;
    if (!aggregate[key]) {
        aggregate[key] = {
            type: adjustment.type,
            target: adjustment.target,
            recommended: 0,
            change: 0,
            summaries: new Set(),
            tags: new Set()
        };
    }

    const entry = aggregate[key];
    entry.recommended += 1;
    entry.change += toNumber(adjustment.change, 0);
    if (adjustment.summary) {
        entry.summaries.add(adjustment.summary);
    }
    if (Array.isArray(adjustment.tags)) {
        adjustment.tags.forEach(tag => entry.tags.add(tag));
    }
    return aggregate;
}

function finalizeAdjustments(aggregateMap) {
    return Object.values(aggregateMap).map(entry => ({
        type: entry.type,
        target: entry.target,
        recommendations: entry.recommended,
        aggregateChange: Number(entry.change.toFixed(3)),
        summaries: Array.from(entry.summaries),
        tags: Array.from(entry.tags)
    }));
}

const DEFAULT_CALIBRATORS = [
    {
        id: 'focus-stability-boost',
        title: 'Focus Stability Boost',
        description: 'Increase focus weighting, add adaptive halos, and tighten dwell calibration when focus reliability dips.',
        priority: 'high',
        evaluate({ blueprint }) {
            const analytics = blueprint?.analytics || {};
            const focusReliability = toNumber(analytics.focusReliability, 0.5);
            if (focusReliability >= 0.72) {
                return null;
            }

            const deficit = clamp(0.72 - focusReliability, 0, 0.4);
            const adjustments = [
                {
                    type: 'layout',
                    target: 'focusWeight',
                    change: Number((deficit * 0.6).toFixed(3)),
                    summary: 'Increase focus weighting to stabilize attention hand-off.',
                    tags: ['focus', 'attention']
                },
                {
                    type: 'design',
                    target: 'haloIntensity',
                    change: Number((deficit * 0.5).toFixed(3)),
                    summary: 'Intensify adaptive halos for primary zones.',
                    tags: ['visual-feedback']
                },
                {
                    type: 'sensors',
                    target: 'dwellCalibrationMs',
                    change: Number(Math.round(deficit * 180)),
                    summary: 'Shorten dwell calibration window for gaze confirmation.',
                    tags: ['sensor-calibration']
                }
            ];

            const expectedFocus = clamp(focusReliability + deficit * 0.65, 0, 1);
            return {
                id: 'focus-stability-boost',
                title: 'Focus Stability Boost',
                rationale: `Focus reliability at ${focusReliability.toFixed(2)} sits below the adaptive comfort threshold (0.72).`,
                score: Number((0.7 + deficit * 0.3).toFixed(3)),
                priority: 'high',
                tags: ['focus', 'stability'],
                adjustments,
                expectedImpact: {
                    focusReliability: Number(expectedFocus.toFixed(3)),
                    haloClarity: Number((0.58 + deficit * 0.3).toFixed(3))
                }
            };
        }
    },
    {
        id: 'stress-diffusion',
        title: 'Stress Diffusion Sweep',
        description: 'Redistribute interaction density and enable calming haptics when biometric stress risk spikes.',
        priority: 'medium',
        evaluate({ blueprint }) {
            const analytics = blueprint?.analytics || {};
            const stressRisk = toNumber(analytics.stressRisk, 0.4);
            if (stressRisk <= 0.55) {
                return null;
            }

            const overshoot = clamp(stressRisk - 0.55, 0, 0.45);
            const adjustments = [
                {
                    type: 'layout',
                    target: 'zoneRedistribution',
                    change: Number((overshoot * 0.8).toFixed(3)),
                    summary: 'Disperse high-density zones toward peripheral arcs.',
                    tags: ['comfort', 'balance']
                },
                {
                    type: 'design',
                    target: 'hapticSequence',
                    change: 1,
                    summary: 'Enable calming haptic fallback sequence.',
                    tags: ['haptics']
                },
                {
                    type: 'telemetry',
                    target: 'stressEventSampling',
                    change: Number(Math.round(overshoot * 5)),
                    summary: 'Increase telemetry sampling for stress event labeling.',
                    tags: ['telemetry', 'compliance']
                }
            ];

            const expectedStress = clamp(stressRisk - overshoot * 0.6, 0, 1);
            return {
                id: 'stress-diffusion',
                title: 'Stress Diffusion Sweep',
                rationale: `Biometric stress risk at ${stressRisk.toFixed(2)} exceeds calming guardrails (0.55).`,
                score: Number((0.65 + overshoot * 0.25).toFixed(3)),
                priority: 'medium',
                tags: ['stress', 'comfort'],
                adjustments,
                expectedImpact: {
                    stressRisk: Number(expectedStress.toFixed(3)),
                    comfortIndex: Number((0.62 + overshoot * 0.2).toFixed(3))
                }
            };
        }
    },
    {
        id: 'motion-harmonics',
        title: 'Motion Harmonics Calibration',
        description: 'Rebalance motion cues and anchor transitions to maintain stability during movement-heavy use.',
        priority: 'medium',
        evaluate({ blueprint }) {
            const analytics = blueprint?.analytics || {};
            const motionStability = toNumber(analytics.motionStability, 0.7);
            if (motionStability >= 0.68) {
                return null;
            }

            const gap = clamp(0.68 - motionStability, 0, 0.5);
            const adjustments = [
                {
                    type: 'layout',
                    target: 'motionAnchors',
                    change: Number((gap * 0.7).toFixed(3)),
                    summary: 'Add stabilizing anchors to transitional zones.',
                    tags: ['motion']
                },
                {
                    type: 'design',
                    target: 'motionBlur',
                    change: Number((gap * -0.4).toFixed(3)),
                    summary: 'Reduce motion blur intensity to lower disorientation.',
                    tags: ['visual-feedback']
                },
                {
                    type: 'sensors',
                    target: 'imuSmoothing',
                    change: Number((gap * 0.5).toFixed(3)),
                    summary: 'Increase IMU smoothing factor.',
                    tags: ['sensor-calibration']
                }
            ];

            const expectedStability = clamp(motionStability + gap * 0.55, 0, 1);
            return {
                id: 'motion-harmonics',
                title: 'Motion Harmonics Calibration',
                rationale: `Motion stability at ${motionStability.toFixed(2)} trails the recommended wearable baseline (0.68).`,
                score: Number((0.6 + gap * 0.35).toFixed(3)),
                priority: 'medium',
                tags: ['motion', 'stability'],
                adjustments,
                expectedImpact: {
                    motionStability: Number(expectedStability.toFixed(3)),
                    transitionCoherence: Number((0.57 + gap * 0.28).toFixed(3))
                }
            };
        }
    },
    {
        id: 'zone-balance-optimizer',
        title: 'Zone Balance Optimizer',
        description: 'Normalize blueprint density ratios and update spec weights when zones skew toward overload.',
        priority: 'low',
        evaluate({ blueprint }) {
            const analytics = blueprint?.analytics || {};
            const zoneBalanceScore = toNumber(analytics.zoneBalanceScore, 0.5);
            if (zoneBalanceScore >= 0.64) {
                return null;
            }

            const imbalance = clamp(0.64 - zoneBalanceScore, 0, 0.5);
            const adjustments = [
                {
                    type: 'layout',
                    target: 'zoneDensity',
                    change: Number((imbalance * 0.75).toFixed(3)),
                    summary: 'Reallocate density to under-served zones.',
                    tags: ['balance']
                },
                {
                    type: 'design',
                    target: 'contrastSpread',
                    change: Number((imbalance * 0.5).toFixed(3)),
                    summary: 'Increase contrast spread for peripheral cues.',
                    tags: ['visual-feedback']
                }
            ];

            const expectedBalance = clamp(zoneBalanceScore + imbalance * 0.6, 0, 1);
            return {
                id: 'zone-balance-optimizer',
                title: 'Zone Balance Optimizer',
                rationale: `Zone balance score at ${zoneBalanceScore.toFixed(2)} indicates density collapse toward a subset of surfaces.`,
                score: Number((0.55 + imbalance * 0.4).toFixed(3)),
                priority: 'low',
                tags: ['balance', 'layout'],
                adjustments,
                expectedImpact: {
                    zoneBalanceScore: Number(expectedBalance.toFixed(3)),
                    peripheralEngagement: Number((0.53 + imbalance * 0.27).toFixed(3))
                }
            };
        }
    }
];

export class LayoutBlueprintCalibrationEngine {
    constructor(options = {}) {
        this.insightEngine = options.insightEngine || null;
        this.calibrators = new Map();
        this.historyLimit = Math.max(1, options.historyLimit ?? 30);
        this.history = [];

        const defaults = options.defaults ?? DEFAULT_CALIBRATORS;
        if (defaults !== false) {
            const calibrators = Array.isArray(defaults) ? defaults : DEFAULT_CALIBRATORS;
            calibrators.forEach(calibrator => this.registerCalibrator(calibrator));
        }
    }

    registerCalibrator(calibrator) {
        if (!calibrator || !calibrator.id || typeof calibrator.evaluate !== 'function') {
            throw new Error('Invalid calibrator provided.');
        }
        this.calibrators.set(calibrator.id, {
            priority: 'medium',
            ...calibrator
        });
        return this;
    }

    removeCalibrator(id) {
        this.calibrators.delete(id);
        return this;
    }

    clearCalibrators() {
        this.calibrators.clear();
        return this;
    }

    listCalibrators() {
        return Array.from(this.calibrators.values()).map(calibrator => ({
            id: calibrator.id,
            title: calibrator.title,
            description: calibrator.description,
            priority: calibrator.priority,
            tags: Array.isArray(calibrator.tags) ? [...calibrator.tags] : []
        }));
    }

    calibrate(input = {}) {
        let blueprint = null;
        if (input.blueprint && input.blueprint.generatedAt) {
            blueprint = input.blueprint;
        } else {
            const layout = input.layout || {};
            const design = input.design || {};
            const context = input.context || {};
            blueprint = buildLayoutBlueprint(layout, design, context);
        }

        if (!blueprint) {
            return null;
        }

        const calibrations = [];
        const aggregateAdjustments = {};
        const aggregateTags = new Set();
        let aggregateScore = 0;
        let highestPriority = 'low';
        const priorityRank = { high: 3, medium: 2, low: 1 };

        for (const calibrator of this.calibrators.values()) {
            const result = calibrator.evaluate({
                blueprint,
                insights: input.insights || null,
                scenario: input.scenario || null,
                context: input.context || null
            });
            if (!result) {
                continue;
            }
            const formatted = {
                id: result.id || calibrator.id,
                title: result.title || calibrator.title,
                rationale: result.rationale || calibrator.description || 'Calibration available.',
                score: Number(toNumber(result.score, 0).toFixed(3)),
                priority: result.priority || calibrator.priority || 'medium',
                tags: Array.isArray(result.tags) ? [...result.tags] : [],
                adjustments: Array.isArray(result.adjustments)
                    ? result.adjustments.map(adjustment => ({ ...adjustment }))
                    : [],
                expectedImpact: result.expectedImpact ? { ...result.expectedImpact } : null
            };

            formatted.adjustments.forEach(adjustment => mergeAdjustment(aggregateAdjustments, adjustment));
            formatted.tags.forEach(tag => aggregateTags.add(tag));
            aggregateScore += formatted.score;
            if (priorityRank[formatted.priority] > priorityRank[highestPriority]) {
                highestPriority = formatted.priority;
            }

            calibrations.push(formatted);
        }

        const calibrationCount = calibrations.length;
        const averageScore = calibrationCount ? Number((aggregateScore / calibrationCount).toFixed(3)) : 0;
        const aggregatedAdjustments = finalizeAdjustments(aggregateAdjustments);
        const tags = Array.from(aggregateTags);

        const aggregate = {
            calibrationCount,
            averageScore,
            highestPriority,
            adjustments: aggregatedAdjustments,
            tags,
            nextActions: calibrations
                .filter(entry => Array.isArray(entry.adjustments) && entry.adjustments.length)
                .map(entry => ({
                    id: entry.id,
                    title: entry.title,
                    priority: entry.priority,
                    summary: entry.rationale
                }))
        };

        const result = {
            id: input.id || `calibration-${Date.now()}`,
            generatedAt: Date.now(),
            blueprint: {
                analytics: clone(blueprint.analytics || {}),
                summary: {
                    zoneCount: Array.isArray(blueprint.zones) ? blueprint.zones.length : 0,
                    engagementLevel: blueprint.engagementLevel,
                    biometricStress: blueprint.biometricStress
                }
            },
            calibrations,
            aggregate
        };

        if (Array.isArray(input.annotations)) {
            result.annotations = input.annotations.map(annotation => ({ ...annotation }));
        }

        if (input.storeHistory !== false) {
            this.history.push(result);
            if (this.history.length > this.historyLimit) {
                this.history.splice(0, this.history.length - this.historyLimit);
            }
        }

        if (this.insightEngine && typeof this.insightEngine.recordCalibrationResult === 'function') {
            this.insightEngine.recordCalibrationResult(result);
        }

        return result;
    }

    getHistory() {
        return this.history.map(entry => ({
            ...entry,
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

    clearHistory() {
        this.history = [];
    }
}

export function createLayoutBlueprintCalibrationEngine(options = {}) {
    return new LayoutBlueprintCalibrationEngine(options);
}
