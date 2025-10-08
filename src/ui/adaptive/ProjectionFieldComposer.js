const clamp = (value, min, max) => {
    if (Number.isNaN(value) || typeof value !== 'number') {
        return min;
    }
    return Math.min(Math.max(value, min), max);
};

const DEFAULT_CHANNELS = [
    {
        id: 'core-focal',
        label: 'Core Focal',
        surfaces: ['primary'],
        depthRange: [0.12, 0.38],
        amplitude: 0.82,
        timeline: { segments: 4, durationMs: 3200, emphasis: [0] },
        modulationWeights: { focus: 0.7, intention: 0.5, engagement: 0.6 }
    },
    {
        id: 'ambient-context',
        label: 'Ambient Context',
        surfaces: ['peripheral', 'ambient'],
        depthRange: [0.36, 0.88],
        amplitude: 0.46,
        timeline: { segments: 3, durationMs: 4200, emphasis: [1] },
        modulationWeights: { focus: 0.25, intention: 0.6, engagement: 0.4 }
    }
];

function defaultContext() {
    return {
        focusVector: { x: 0.5, y: 0.5, depth: 0.3 },
        intentionVector: { x: 0, y: 0, z: 0, w: 0 },
        engagementLevel: 0.4,
        biometricStress: 0.2,
        environment: { luminance: 0.5, noiseLevel: 0.2, motion: 0.1 }
    };
}

function normalizeArray(value, fallback = []) {
    if (!Array.isArray(value)) return fallback;
    return value;
}

export class ProjectionFieldComposer {
    constructor(options = {}) {
        const {
            channels = [],
            useDefaultChannels = true,
            temporalResolution = 120,
            modulationSmoothing = 0.18
        } = options;

        this.temporalResolution = temporalResolution;
        this.modulationSmoothing = modulationSmoothing;
        this.channels = new Map();

        if (useDefaultChannels) {
            DEFAULT_CHANNELS.forEach(channel => this.registerChannel(channel));
        }

        normalizeArray(channels).forEach(channel => this.registerChannel(channel));
    }

    registerChannel(channel) {
        if (!channel?.id) {
            throw new Error('Projection channel must include an id');
        }
        const descriptor = {
            ...channel,
            label: channel.label || channel.id,
            surfaces: normalizeArray(channel.surfaces, ['primary']),
            depthRange: channel.depthRange || [0.18, 0.72],
            amplitude: typeof channel.amplitude === 'number' ? clamp(channel.amplitude, 0, 1) : 0.5,
            timeline: {
                segments: clamp(channel.timeline?.segments ?? 3, 1, 12),
                durationMs: Math.max(channel.timeline?.durationMs ?? 3200, 500),
                emphasis: normalizeArray(channel.timeline?.emphasis)
            },
            modulationWeights: channel.modulationWeights || { focus: 0.5, intention: 0.5, engagement: 0.5 }
        };

        this.channels.set(channel.id, descriptor);
    }

    clearChannels() {
        this.channels.clear();
    }

    getChannel(id) {
        return this.channels.get(id) || null;
    }

    composeBlueprint({ context, layout, design } = {}) {
        const state = { ...defaultContext(), ...(context || {}) };
        const activeLayout = layout || { zones: [] };
        const designSpec = design || {};

        const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const blueprint = {
            version: '1.0',
            timestamp,
            temporalResolution: this.temporalResolution,
            modulation: this.buildModulation(state),
            stateVectors: {
                focus: state.focusVector,
                intention: state.intentionVector,
                engagement: state.engagementLevel,
                biometricStress: state.biometricStress
            },
            design: this.buildDesignDescriptor(designSpec),
            projectionChannels: []
        };

        for (const channel of this.channels.values()) {
            blueprint.projectionChannels.push(
                this.buildChannelBlueprint(channel, state, activeLayout, blueprint.design)
            );
        }

        return blueprint;
    }

    buildModulation(state) {
        const engagement = clamp(state.engagementLevel ?? 0.4, 0, 1);
        const stress = clamp(state.biometricStress ?? 0.2, 0, 1);
        const motion = clamp(state.environment?.motion ?? 0.1, 0, 1);
        const luminance = clamp(state.environment?.luminance ?? 0.5, 0, 1);

        const coherence = clamp(engagement * (1 - stress) * (1 - this.modulationSmoothing) + 0.25, 0, 1);
        const calmIndex = clamp((1 - stress) * 0.7 + (1 - motion) * 0.3, 0, 1);

        return {
            engagement,
            stress,
            motion,
            luminance,
            coherence,
            calmIndex
        };
    }

    buildDesignDescriptor(designSpec) {
        const pattern = designSpec.pattern || {};
        const monetization = designSpec.monetization || {};
        const integration = designSpec.integration || {};

        return {
            patternId: pattern.id || null,
            patternName: pattern.name || null,
            monetizationTier: monetization.tier || 'starter',
            integration,
            components: normalizeArray(pattern.components),
            tokens: integration.designTokens || { color: 'glance', motion: 'flow' }
        };
    }

    buildChannelBlueprint(channel, state, layout, designDescriptor) {
        const focus = state.focusVector || defaultContext().focusVector;
        const intention = state.intentionVector || defaultContext().intentionVector;

        const timeline = this.buildTimeline(channel, state);
        const surfaces = channel.surfaces
            .map(surfaceId => this.buildSurfaceProjection(surfaceId, channel, timeline, state, layout, designDescriptor))
            .filter(Boolean);

        const amplitude = channel.amplitude;
        const energyProfile = {
            amplitude,
            focus: clamp(amplitude * (channel.modulationWeights.focus ?? 0.5) * (0.5 + focus.depth), 0, 1),
            intention: clamp(amplitude * (channel.modulationWeights.intention ?? 0.5) * (0.6 + Math.abs(intention.w || 0) * 0.4), 0, 1),
            engagement: clamp(amplitude * (channel.modulationWeights.engagement ?? 0.5) * (0.5 + state.engagementLevel * 0.5), 0, 1)
        };

        return {
            id: channel.id,
            label: channel.label,
            depthRange: channel.depthRange,
            timeline,
            energyProfile,
            surfaces,
            designGuidance: this.buildChannelDesignGuidance(channel, designDescriptor, state)
        };
    }

    buildTimeline(channel, state) {
        const segments = channel.timeline.segments;
        const duration = channel.timeline.durationMs;
        const emphasis = channel.timeline.emphasis || [];
        const base = [];
        const engagement = clamp(state.engagementLevel ?? 0.4, 0, 1);

        for (let i = 0; i < segments; i++) {
            const start = (duration / segments) * i;
            const end = start + duration / segments;
            const emphasisBoost = emphasis.includes(i) ? 0.2 : 0;
            const energy = clamp(0.5 + engagement * 0.4 - i * 0.05 + emphasisBoost, 0, 1);
            base.push({ index: i, startMs: Math.round(start), endMs: Math.round(end), energy });
        }

        const dominantSegment = base.reduce((max, segment) => (segment.energy > max.energy ? segment : max), base[0] || { index: 0, energy: 0 });

        return {
            durationMs: duration,
            segments: base,
            dominantSegment: dominantSegment?.index ?? 0
        };
    }

    buildChannelDesignGuidance(channel, designDescriptor, state) {
        const tokens = designDescriptor.tokens || { color: 'glance', motion: 'flow' };
        const coherence = this.buildModulation(state).coherence;
        const paletteShift = clamp(coherence * (channel.amplitude + 0.35), 0, 1);

        return {
            recommendedPalette: tokens.color,
            motionStyle: tokens.motion,
            paletteShift,
            surfaceCount: channel.surfaces.length,
            emphasis: channel.timeline.emphasis,
            monetizationTier: designDescriptor.monetizationTier
        };
    }

    buildSurfaceProjection(surfaceId, channel, timeline, state, layout, designDescriptor) {
        const zone = layout.zones?.find(item => item.id === surfaceId);
        if (!zone) return null;

        const focus = state.focusVector || defaultContext().focusVector;
        const intention = state.intentionVector || defaultContext().intentionVector;

        const depthTarget = this.interpolateDepthTarget(channel.depthRange, zone.layeringDepth ?? 0.3, focus.depth ?? 0.3);
        const focusAffinity = this.computeFocusAffinity(zone, focus);
        const intentionBias = clamp(0.5 + (intention.z ?? 0) * 0.5, 0, 1);
        const coverage = clamp(zone.occupancy ?? 0.45, 0, 1);

        const recommendedComponents = this.pickComponentsForSurface(surfaceId, designDescriptor.components);

        return {
            id: surfaceId,
            focusAffinity,
            coverage,
            depthTarget,
            intentionBias,
            recommendedComponents,
            timelineOffsets: this.buildTimelineOffsets(timeline, focusAffinity, intentionBias)
        };
    }

    interpolateDepthTarget([minDepth, maxDepth], layeringDepth, focusDepth) {
        const closeness = 1 - clamp(Math.abs(focusDepth - layeringDepth) / 0.7, 0, 1);
        const target = minDepth + (maxDepth - minDepth) * (0.35 + closeness * 0.65);
        return Number(target.toFixed(3));
    }

    computeFocusAffinity(zone, focus) {
        const dx = Math.abs((zone.biasX ?? 0.5) - (focus.x ?? 0.5));
        const dy = Math.abs((zone.biasY ?? 0.5) - (focus.y ?? 0.5));
        const depthDelta = Math.abs((zone.layeringDepth ?? 0.3) - (focus.depth ?? 0.3));
        const spatialDistance = (dx + dy) / 2;
        const affinity = clamp(1 - (spatialDistance * 0.6 + depthDelta * 0.4), 0, 1);
        return Number((0.35 + affinity * 0.65).toFixed(3));
    }

    pickComponentsForSurface(surfaceId, components = []) {
        if (!components.length) return [];
        if (surfaceId === 'primary') {
            return components.slice(0, 2);
        }
        if (surfaceId === 'peripheral') {
            return components.filter(component => component.includes('indicator') || component.includes('strip'));
        }
        return components.filter(component => component.includes('ambient'));
    }

    buildTimelineOffsets(timeline, focusAffinity, intentionBias) {
        const offsets = [];
        const engagementWeight = (focusAffinity + intentionBias) / 2;
        timeline.segments.forEach(segment => {
            const offset = clamp(segment.startMs + segment.energy * 120 * engagementWeight, 0, timeline.durationMs);
            offsets.push(Number(offset.toFixed(1)));
        });
        return offsets;
    }
}
