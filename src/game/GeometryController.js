import { createSeededRNG } from './utils/Random.js';

const FACETED_GEOMETRIES = ['TETRA', 'CUBE', 'SPHERE', 'TORUS', 'KLEIN', 'FRACTAL', 'WAVE', 'CRYSTAL'];
const HOLO_CATEGORY_MAP = [
    0, 0, 0, 0,
    1, 1, 1, 1,
    2, 2, 2, 2,
    3, 3, 3, 3,
    4, 4, 4, 4,
    5, 5, 5,
    6, 6, 6,
    7, 7, 7, 7
];

/**
 * Geometry-driven spawn rules and visual tweaks.
 */
export class GeometryController {
    constructor(seed = 1234) {
        this.rng = createSeededRNG(seed);
        this.mode = 'faceted';
        this.geometryIndex = 0;
    }

    setMode(mode) {
        this.mode = mode;
    }

    setGeometry(index) {
        this.geometryIndex = index;
    }

    random() {
        return this.rng.nextFloat();
    }

    randomRange(min, max) {
        return this.rng.nextRange(min, max);
    }

    createEventTarget(type, beat, options = {}) {
        const generator = EVENT_GENERATORS[type];
        if (generator) {
            return generator(this, beat, options);
        }
        // default to quick-draw style
        return EVENT_GENERATORS['quick-draw'](this, beat, options);
    }

    /**
     * Determine geometry id across all systems.
     */
    getGeometryId() {
        if (this.mode === 'holographic') {
            const category = HOLO_CATEGORY_MAP[this.geometryIndex] ?? 0;
            return FACETED_GEOMETRIES[Math.min(category, FACETED_GEOMETRIES.length - 1)];
        }
        return FACETED_GEOMETRIES[this.geometryIndex % FACETED_GEOMETRIES.length];
    }

    /**
     * Generate spawn targets for a beat.
     */
    generateTargets(beat, difficulty) {
        const geometry = this.getGeometryId();
        const generator = GEOMETRY_GENERATORS[geometry] || GEOMETRY_GENERATORS.TETRA;
        const density = difficulty?.density ?? 0.9;
        const speed = difficulty?.speed ?? 1.0;
        const chaos = difficulty?.chaos ?? 0.15;

        const amount = Math.max(1, Math.round(density * (0.8 + this.rng.nextFloat())));
        const targets = [];
        for (let i = 0; i < amount; i++) {
            targets.push(generator(this.rng, beat + i * 0.1, { speed, chaos }));
        }
        return targets;
    }

    /**
     * Provide per-geometry parameter biases.
     */
    getParameterBias() {
        const geometry = this.getGeometryId();
        return GEOMETRY_PARAMETER_BIAS[geometry] || { hueShift: 0, chaos: 1, speed: 1 };
    }
}

function randomSign(rng) {
    return rng.nextFloat() > 0.5 ? 1 : -1;
}

const GEOMETRY_GENERATORS = {
    TETRA(rng, beat) {
        const base = 0.65;
        return {
            id: `tetra-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: randomSign(rng) * base,
                y: randomSign(rng) * base,
                z: randomSign(rng) * base,
                w: randomSign(rng) * base
            },
            radius: 0.08,
            dueBeat: beat + 1.5,
            behavior: 'pulse'
        };
    },
    CUBE(rng, beat) {
        const axis = rng.choose(['x', 'y', 'z']);
        const pos = {
            x: rng.nextRange(-0.9, 0.9),
            y: rng.nextRange(-0.9, 0.9),
            z: rng.nextRange(-0.9, 0.9),
            w: rng.nextRange(-0.7, 0.7)
        };
        const offset = rng.nextRange(0.35, 0.8);
        const other = { ...pos };
        other[axis] += offset;
        pos[axis] -= offset;
        return {
            id: `cube-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'lane',
            vec4: pos,
            vec4b: other,
            radius: 0.05,
            dueBeat: beat + 1.8,
            behavior: 'slide'
        };
    },
    SPHERE(rng, beat) {
        const theta = rng.nextRange(0, Math.PI);
        const phi = rng.nextRange(0, Math.PI * 2);
        const radius = 0.85;
        return {
            id: `sphere-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: radius * Math.sin(theta) * Math.cos(phi),
                y: radius * Math.cos(theta),
                z: radius * Math.sin(theta) * Math.sin(phi),
                w: rng.nextRange(-0.4, 0.4)
            },
            radius: 0.09,
            dueBeat: beat + 1.3,
            behavior: 'orbit'
        };
    },
    TORUS(rng, beat) {
        const major = 0.75;
        const minor = 0.25;
        const angle = (beat * 0.9 + rng.nextFloat()) * Math.PI * 2;
        return {
            id: `torus-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'lane',
            vec4: {
                x: (major + minor * Math.cos(angle)) * Math.cos(angle),
                y: minor * Math.sin(angle * 2),
                z: (major + minor * Math.cos(angle)) * Math.sin(angle),
                w: rng.nextRange(-0.5, 0.5)
            },
            vec4b: {
                x: (major + minor * Math.cos(angle + 0.3)) * Math.cos(angle + 0.3),
                y: minor * Math.sin((angle + 0.3) * 2),
                z: (major + minor * Math.cos(angle + 0.3)) * Math.sin(angle + 0.3),
                w: rng.nextRange(-0.5, 0.5)
            },
            radius: 0.04,
            dueBeat: beat + 2,
            behavior: 'belt'
        };
    },
    KLEIN(rng, beat) {
        const u = rng.nextRange(0, Math.PI * 2);
        const v = rng.nextRange(0, Math.PI * 2);
        const r = 0.4;
        const cosU = Math.cos(u);
        const sinU = Math.sin(u);
        const cosV = Math.cos(v);
        const sinV = Math.sin(v);
        const x = (r + cosU / 2) * cosV;
        const y = (r + cosU / 2) * sinV;
        const z = sinU / 2;
        const w = Math.sin(u) * Math.cos(v);
        return {
            id: `klein-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: { x, y, z, w },
            radius: 0.07,
            dueBeat: beat + 1.6,
            behavior: 'invert'
        };
    },
    FRACTAL(rng, beat) {
        const depth = rng.nextInt(2, 5);
        const scale = 0.5 / depth;
        const offsets = [rng.nextRange(-1, 1), rng.nextRange(-1, 1), rng.nextRange(-1, 1)];
        return {
            id: `fractal-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'cluster',
            children: Array.from({ length: depth * 2 }, (_, idx) => ({
                vec4: {
                    x: offsets[0] + scale * ((idx % 2) ? 1 : -1),
                    y: offsets[1] + scale * ((idx & 2) ? 1 : -1),
                    z: offsets[2] + scale * ((idx & 4) ? 1 : -1),
                    w: rng.nextRange(-0.6, 0.6)
                },
                radius: 0.04
            })),
            dueBeat: beat + 2.2,
            radius: 0.04,
            behavior: 'chain'
        };
    },
    WAVE(rng, beat) {
        const phase = beat * 0.5 + rng.nextRange(0, Math.PI * 2);
        const amplitude = 0.7;
        return {
            id: `wave-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'lane',
            vec4: {
                x: -0.9,
                y: Math.sin(phase) * amplitude,
                z: Math.cos(phase * 1.2) * 0.4,
                w: Math.sin(phase * 0.7) * 0.4
            },
            vec4b: {
                x: 0.9,
                y: Math.sin(phase + 0.5) * amplitude,
                z: Math.cos((phase + 0.5) * 1.2) * 0.4,
                w: Math.sin((phase + 0.5) * 0.7) * 0.4
            },
            radius: 0.05,
            dueBeat: beat + 1.4,
            behavior: 'sweep'
        };
    },
    CRYSTAL(rng, beat) {
        const spikeDir = rng.nextRange(0, Math.PI * 2);
        const height = rng.nextRange(0.4, 0.9);
        return {
            id: `crystal-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: Math.cos(spikeDir) * 0.4,
                y: height,
                z: Math.sin(spikeDir) * 0.4,
                w: rng.nextRange(-0.3, 0.3)
            },
            radius: 0.06,
            dueBeat: beat + 1.7,
            behavior: 'shard'
        };
    }
};

const GEOMETRY_PARAMETER_BIAS = {
    TETRA: { hueShift: 0, chaos: 0.8, speed: 1.05 },
    CUBE: { hueShift: 12, chaos: 1.0, speed: 1.0 },
    SPHERE: { hueShift: 48, chaos: 0.9, speed: 0.95 },
    TORUS: { hueShift: 84, chaos: 1.1, speed: 1.1 },
    KLEIN: { hueShift: 132, chaos: 1.3, speed: 0.9 },
    FRACTAL: { hueShift: 210, chaos: 1.5, speed: 0.85 },
    WAVE: { hueShift: 280, chaos: 1.2, speed: 1.2 },
    CRYSTAL: { hueShift: 320, chaos: 0.75, speed: 0.9 }
};

const EVENT_GENERATORS = {
    'quick-draw'(controller, beat, { urgency = 0.65 } = {}) {
        const radius = 0.07;
        const theta = controller.randomRange(0, Math.PI * 2);
        const phi = controller.randomRange(0, Math.PI);
        const depth = controller.randomRange(-0.4, 0.4);
        return {
            id: `event-qd-${beat.toFixed(2)}-${controller.rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: Math.cos(theta) * 0.6,
                y: Math.sin(phi) * 0.6,
                z: Math.sin(theta) * 0.6,
                w: depth
            },
            radius,
            dueBeat: beat + urgency,
            timeToImpact: Math.max(0.55, urgency),
            behavior: 'quickdraw',
            eventTag: 'quick-draw'
        };
    },
    'reverse-flick'(controller, beat, { urgency = 0.8 } = {}) {
        const offset = controller.randomRange(0.3, 0.9);
        const vertical = controller.randomRange(-0.6, 0.6);
        return {
            id: `event-rf-${beat.toFixed(2)}-${controller.rng.nextInt(0, 9999)}`,
            type: 'lane',
            vec4: { x: -offset, y: vertical, z: controller.randomRange(-0.3, 0.3), w: controller.randomRange(-0.4, 0.4) },
            vec4b: { x: offset, y: -vertical, z: controller.randomRange(-0.3, 0.3), w: controller.randomRange(-0.4, 0.4) },
            radius: 0.055,
            dueBeat: beat + urgency,
            timeToImpact: Math.max(0.8, urgency + 0.2),
            behavior: 'reverse',
            eventTag: 'reverse-flick'
        };
    },
    'glitch-rush'(controller, beat, { urgency = 1.0 } = {}) {
        const children = Array.from({ length: 6 }, (_, idx) => ({
            vec4: {
                x: controller.randomRange(-0.9, 0.9),
                y: controller.randomRange(-0.9, 0.9),
                z: controller.randomRange(-0.6, 0.6),
                w: controller.randomRange(-0.6, 0.6)
            },
            radius: 0.05 + (idx % 2) * 0.02
        }));
        return {
            id: `event-gr-${beat.toFixed(2)}-${controller.rng.nextInt(0, 9999)}`,
            type: 'cluster',
            children,
            radius: 0.05,
            dueBeat: beat + urgency,
            timeToImpact: Math.max(1.2, urgency + 0.3),
            behavior: 'glitch',
            eventTag: 'glitch-rush'
        };
    },
    'tempo-flip'(controller, beat, { urgency = 0.9 } = {}) {
        const theta = controller.randomRange(0, Math.PI * 2);
        return {
            id: `event-tf-${beat.toFixed(2)}-${controller.rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: Math.cos(theta) * 0.5,
                y: Math.sin(theta) * 0.5,
                z: controller.randomRange(-0.2, 0.2),
                w: controller.randomRange(-0.3, 0.3)
            },
            radius: 0.09,
            dueBeat: beat + urgency,
            timeToImpact: Math.max(0.9, urgency + 0.15),
            behavior: 'tempo',
            eventTag: 'tempo-flip'
        };
    }
};
