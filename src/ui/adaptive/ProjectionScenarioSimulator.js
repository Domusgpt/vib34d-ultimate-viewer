import { ProjectionFieldComposer } from './ProjectionFieldComposer.js';

const clone = value => {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (error) {
            // fall back below
        }
    }
    return JSON.parse(JSON.stringify(value ?? null));
};

const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

const mergeDeep = (target, source) => {
    if (!isObject(source)) {
        return source;
    }
    const output = Array.isArray(target) ? [...target] : { ...(target || {}) };
    for (const [key, value] of Object.entries(source)) {
        if (Array.isArray(value)) {
            output[key] = value.map(item => (isObject(item) ? mergeDeep({}, item) : item));
        } else if (isObject(value)) {
            output[key] = mergeDeep(output[key], value);
        } else {
            output[key] = value;
        }
    }
    return output;
};

const DEFAULT_SCENARIOS = [
    {
        id: 'gesture-intensive',
        label: 'Gesture Intensive',
        description: 'High intent bursts with rapid peripheral cues and motion bias.',
        context: {
            engagementLevel: 0.78,
            intentionVector: { x: 0.22, y: -0.18, z: 0.35, w: 0.92 },
            environment: { motion: 0.42 }
        },
        layoutAdjuster: layout => {
            const working = clone(layout);
            if (working.motion) {
                working.motion.velocity = 0.68;
                working.motion.bias = { x: 0.24, y: -0.12, z: 0.1 };
            }
            working.zones?.forEach(zone => {
                if (zone.id === 'peripheral') {
                    zone.occupancy = Math.min(0.62, (zone.occupancy ?? 0.45) + 0.18);
                    zone.biasX = 0.16;
                    zone.biasY = 0.68;
                }
                if (zone.id === 'primary') {
                    zone.occupancy = Math.min(0.68, (zone.occupancy ?? 0.45) + 0.12);
                    zone.biasX = 0.46;
                    zone.biasY = 0.42;
                }
            });
            return working;
        },
        designOverrides: {
            integration: {
                designTokens: { motion: 'burst', color: 'electric' }
            }
        }
    },
    {
        id: 'low-light-focus',
        label: 'Low Light Focus',
        description: 'Dim ambient conditions with calm biometric state and depth-weighted focus.',
        context: {
            biometricStress: 0.18,
            engagementLevel: 0.58,
            environment: { luminance: 0.08, motion: 0.08, noiseLevel: 0.12 }
        },
        layoutAdjuster: layout => {
            const working = clone(layout);
            if (working.colorAdaptation) {
                working.colorAdaptation.hueShift = 210;
                working.colorAdaptation.lightness = 62;
            }
            working.zones?.forEach(zone => {
                if (zone.id === 'primary') {
                    zone.layeringDepth = 0.22;
                    zone.occupancy = Math.max(0.38, (zone.occupancy ?? 0.45) - 0.06);
                }
                if (zone.id === 'ambient') {
                    zone.occupancy = Math.max(0.28, (zone.occupancy ?? 0.4) - 0.04);
                }
            });
            return working;
        },
        designOverrides: {
            integration: {
                designTokens: { motion: 'glide', color: 'lumen' }
            }
        }
    },
    {
        id: 'ambient-crowd-awareness',
        label: 'Ambient Crowd Awareness',
        description: 'High ambient motion and mixed focus requiring wide coverage.',
        context: {
            engagementLevel: 0.66,
            environment: { motion: 0.72, noiseLevel: 0.58, luminance: 0.34 }
        },
        layoutAdjuster: layout => {
            const working = clone(layout);
            if (working.motion) {
                working.motion.velocity = 0.52;
                working.motion.bias = { x: -0.18, y: 0.16, z: 0 };
            }
            working.zones?.forEach(zone => {
                if (zone.id === 'ambient') {
                    zone.occupancy = Math.min(0.58, (zone.occupancy ?? 0.4) + 0.18);
                    zone.biasX = 0.78;
                    zone.biasY = 0.32;
                }
                if (zone.id === 'peripheral') {
                    zone.occupancy = Math.min(0.55, (zone.occupancy ?? 0.4) + 0.12);
                }
            });
            return working;
        },
        designOverrides: {
            integration: {
                designTokens: { motion: 'pulse', color: 'ambient' }
            }
        }
    }
];

export class ProjectionScenarioSimulator {
    constructor(options = {}) {
        const { composer, scenarios = [], useDefaultScenarios = true } = options;
        if (!(composer instanceof ProjectionFieldComposer)) {
            throw new Error('ProjectionScenarioSimulator requires a ProjectionFieldComposer instance.');
        }
        this.composer = composer;
        this.scenarios = new Map();
        if (useDefaultScenarios) {
            DEFAULT_SCENARIOS.forEach(scenario => this.registerScenario(scenario));
        }
        scenarios.forEach(scenario => this.registerScenario(scenario));
    }

    registerScenario(scenario) {
        if (!scenario || !scenario.id) {
            throw new Error('Projection scenario must include an id.');
        }
        const descriptor = {
            label: scenario.label || scenario.id,
            description: scenario.description || '',
            context: scenario.context ? mergeDeep({}, scenario.context) : null,
            layoutAdjuster: scenario.layoutAdjuster,
            layoutPatch: scenario.layoutPatch ? mergeDeep({}, scenario.layoutPatch) : null,
            designOverrides: scenario.designOverrides ? mergeDeep({}, scenario.designOverrides) : null
        };
        this.scenarios.set(scenario.id, descriptor);
        return descriptor;
    }

    clearScenarios() {
        this.scenarios.clear();
    }

    getScenario(id) {
        return this.scenarios.get(id) || null;
    }

    listScenarios() {
        return Array.from(this.scenarios.entries()).map(([id, descriptor]) => ({
            id,
            label: descriptor.label,
            description: descriptor.description
        }));
    }

    simulateScenario(id, options = {}) {
        const scenario = this.scenarios.get(id);
        if (!scenario) {
            throw new Error(`Projection scenario '${id}' not found.`);
        }

        const baseContext = mergeDeep({}, options.context || {});
        const context = scenario.context ? mergeDeep(baseContext, scenario.context) : baseContext;

        const baseLayout = clone(options.layout || { zones: [] });
        let layout = baseLayout;
        if (typeof scenario.layoutAdjuster === 'function') {
            layout = scenario.layoutAdjuster(baseLayout) || baseLayout;
        } else if (scenario.layoutPatch) {
            layout = mergeDeep(baseLayout, scenario.layoutPatch);
        }

        const design = scenario.designOverrides
            ? mergeDeep(mergeDeep({}, options.design || {}), scenario.designOverrides)
            : mergeDeep({}, options.design || {});

        const blueprint = this.composer.composeBlueprint({ context, layout, design });
        const metrics = this.buildMetrics(blueprint);

        return {
            scenario: { id, label: scenario.label, description: scenario.description },
            blueprint,
            metrics
        };
    }

    buildMetrics(blueprint) {
        const channels = Array.isArray(blueprint.projectionChannels) ? blueprint.projectionChannels : [];
        const surfaces = new Set();
        let amplitudeTotal = 0;
        let dominant = { id: null, label: null, energy: -Infinity };
        let longestDuration = 0;

        channels.forEach(channel => {
            const amplitude = channel.energyProfile?.amplitude ?? 0;
            amplitudeTotal += amplitude;
            const engagementEnergy = channel.energyProfile?.engagement ?? 0;
            if (engagementEnergy > dominant.energy) {
                dominant = { id: channel.id, label: channel.label, energy: engagementEnergy };
            }
            if (channel.timeline?.durationMs > longestDuration) {
                longestDuration = channel.timeline.durationMs;
            }
            channel.surfaces?.forEach(surface => {
                if (surface?.id) {
                    surfaces.add(surface.id);
                }
            });
        });

        const averageAmplitude = channels.length ? Number((amplitudeTotal / channels.length).toFixed(3)) : 0;
        const coherence = Number((blueprint.modulation?.coherence ?? 0).toFixed(3));

        return {
            channelCount: channels.length,
            averageAmplitude,
            dominantChannel: dominant.id ? { id: dominant.id, label: dominant.label, engagementEnergy: Number(dominant.energy.toFixed(3)) } : null,
            surfacesEngaged: surfaces.size,
            timelineSpanMs: longestDuration,
            coherence
        };
    }
}
