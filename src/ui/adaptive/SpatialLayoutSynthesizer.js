/**
 * SpatialLayoutSynthesizer
 * ------------------------------------------------------------
 * Translates adaptive signals into layout descriptors suitable for wearable,
 * projection, and ambient interfaces. Uses a 4D-inspired parameter space to
 * determine zoning, density, and motion heuristics.
 */

const DEFAULT_SURFACES = [
    { id: 'primary', curvature: 0.12, visibility: 1 },
    { id: 'peripheral', curvature: 0.38, visibility: 0.6 },
    { id: 'ambient', curvature: 0.72, visibility: 0.45 }
];

export class SpatialLayoutSynthesizer {
    constructor(options = {}) {
        const {
            surfaces = DEFAULT_SURFACES,
            motionSensitivity = 0.35,
            focusAmplifier = 1.2,
            engagementWeight = 0.65
        } = options;

        this.surfaces = surfaces;
        this.motionSensitivity = motionSensitivity;
        this.focusAmplifier = focusAmplifier;
        this.engagementWeight = engagementWeight;

        this.patterns = new Map();
    }

    registerPattern(id, resolver) {
        this.patterns.set(id, resolver);
    }

    generateLayout(context) {
        const {
            focusVector,
            intentionVector,
            engagementLevel,
            biometricStress,
            gestureIntent,
            environment
        } = context;

        const intensity = this.computeAttentionIntensity(focusVector, engagementLevel, biometricStress);
        const zones = this.allocateZones(intensity, environment);
        const motion = this.computeMotion(intentionVector, gestureIntent);

        const layout = {
            intensity,
            zones,
            motion,
            typographyScale: this.computeTypographyScale(engagementLevel, biometricStress),
            colorAdaptation: this.computeColorAdaptation(environment, biometricStress),
            annotations: []
        };

        for (const [id, resolver] of this.patterns) {
            try {
                const annotation = resolver({ context, layout });
                if (annotation) {
                    layout.annotations.push({ id, ...annotation });
                }
            } catch (error) {
                console.warn(`[SpatialLayoutSynthesizer] Pattern ${id} failed`, error);
            }
        }

        return layout;
    }

    computeAttentionIntensity(focusVector, engagementLevel, stress) {
        const focusMagnitude = Math.sqrt(
            Math.pow(focusVector.x - 0.5, 2) +
            Math.pow(focusVector.y - 0.5, 2) +
            Math.pow(focusVector.depth - 0.3, 2)
        );
        const invertedFocus = 1 - Math.min(focusMagnitude * this.focusAmplifier, 1);
        const engagementBoost = engagementLevel * this.engagementWeight;
        const stressPenalty = stress * 0.45;
        return Math.max(0.1, Math.min(1, invertedFocus + engagementBoost - stressPenalty));
    }

    allocateZones(intensity, environment) {
        return this.surfaces.map(surface => {
            const visibility = surface.visibility * (0.6 + intensity * 0.4);
            const luminanceCompensation = 1 - environment.luminance * 0.3;
            const noiseCompensation = 1 - environment.noiseLevel * 0.2;

            return {
                id: surface.id,
                curvature: surface.curvature,
                occupancy: Math.max(0.1, Math.min(1, visibility * luminanceCompensation * noiseCompensation)),
                layeringDepth: this.computeLayering(surface, intensity),
                recommendedComponents: this.recommendComponents(surface, intensity)
            };
        });
    }

    computeLayering(surface, intensity) {
        const base = surface.id === 'primary' ? 0.15 : surface.id === 'peripheral' ? 0.32 : 0.58;
        return base + intensity * 0.4;
    }

    recommendComponents(surface, intensity) {
        if (surface.id === 'primary') {
            return intensity > 0.65 ? ['holographic-panel', 'adaptive-controls'] : ['glanceable-card'];
        }
        if (surface.id === 'peripheral') {
            return intensity > 0.5 ? ['ambient-indicator', 'intent-feedback'] : ['pulse-strip'];
        }
        return ['environmental-visualizer'];
    }

    computeMotion(intentionVector, gestureIntent) {
        const vectorMagnitude = Math.sqrt(
            Math.pow(intentionVector.x, 2) +
            Math.pow(intentionVector.y, 2) +
            Math.pow(intentionVector.z, 2) +
            Math.pow(intentionVector.w, 2)
        );
        const baseVelocity = Math.min(1, vectorMagnitude * this.motionSensitivity + 0.1);
        return {
            velocity: baseVelocity,
            bias: gestureIntent?.vector || { x: 0, y: 0, z: 0 },
            easing: gestureIntent?.intent === 'hold' ? 'ease-out' : 'ease-in-out'
        };
    }

    computeTypographyScale(engagementLevel, stress) {
        const base = 1.0 + engagementLevel * 0.15;
        return Math.max(0.8, base - stress * 0.1);
    }

    computeColorAdaptation(environment, stress) {
        const ambientInfluence = environment.luminance * 0.5 + environment.motion * 0.35;
        const stressTint = stress * 12;
        return {
            hueShift: Math.round((ambientInfluence * 45 + 180) % 360),
            saturation: Math.max(40, 75 - stressTint),
            lightness: Math.max(30, 60 - environment.luminance * 20)
        };
    }
}

