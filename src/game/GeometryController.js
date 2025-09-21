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
    generateTargets(beat, difficulty, audio = {}, modifiers = {}) {
        const geometry = this.getGeometryId();
        const generator = GEOMETRY_GENERATORS[geometry] || GEOMETRY_GENERATORS.TETRA;
        const densityBase = difficulty?.density ?? 0.9;
        const speed = difficulty?.speed ?? 1.0;
        const chaos = difficulty?.chaos ?? 0.15;
        const energy = audio?.energy ?? 0.5;
        const bass = audio?.bass ?? 0.3;
        const flux = audio?.flux ?? 0;
        const densityBias = 0.6 + energy * 0.9 + (modifiers.densityBoost || 0) + (modifiers.bassBias || 0) * bass;
        const amount = Math.max(1, Math.round(densityBase * (0.5 + densityBias + this.rng.nextFloat() * 0.5)));
        const targets = [];
        for (let i = 0; i < amount; i++) {
            targets.push(generator(this.rng, beat + i * 0.1, { speed, chaos, audio, modifiers, flux }));
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

    generateEventTargets(type, options = {}) {
        const geometry = this.getGeometryId();
        switch (type) {
            case 'quickdraw':
                return generateQuickDrawTargets(this.rng, geometry, options);
            case 'burst':
                return generateBurstTargets(this.rng, geometry, options);
            default:
                return [];
        }
    }
}

function randomSign(rng) {
    return rng.nextFloat() > 0.5 ? 1 : -1;
}

const GEOMETRY_GENERATORS = {
    TETRA(rng, beat, ctx = {}) {
        const audio = ctx.audio || {};
        const flux = ctx.flux || audio.flux || 0;
        const chaosBoost = (ctx.modifiers?.glitchLevel || 0) * 0.2;
        const base = 0.55 + (audio.mid || 0) * 0.25;
        return {
            id: `tetra-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: randomSign(rng) * base,
                y: randomSign(rng) * base,
                z: randomSign(rng) * base,
                w: randomSign(rng) * base
            },
            radius: 0.08 + chaosBoost * 0.12,
            dueBeat: beat + 1.4 - Math.min(0.6, (audio.energy || 0) * 0.35),
            behavior: flux > 0.25 ? 'pulse-glitch' : 'pulse'
        };
    },
    CUBE(rng, beat, ctx = {}) {
        const audio = ctx.audio || {};
        const reverse = ctx.modifiers?.reverseControls;
        const axis = rng.choose(['x', 'y', 'z']);
        const pos = {
            x: rng.nextRange(-0.9, 0.9),
            y: rng.nextRange(-0.9, 0.9),
            z: rng.nextRange(-0.9, 0.9),
            w: rng.nextRange(-0.7, 0.7)
        };
        const offset = rng.nextRange(0.35, 0.8 + (audio.energy || 0) * 0.15);
        const other = { ...pos };
        other[axis] += offset;
        pos[axis] -= offset;
        return {
            id: `cube-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'lane',
            vec4: pos,
            vec4b: other,
            radius: 0.05,
            dueBeat: beat + 1.6,
            behavior: reverse ? 'slide-reverse' : 'slide'
        };
    },
    SPHERE(rng, beat, ctx = {}) {
        const audio = ctx.audio || {};
        const theta = rng.nextRange(0, Math.PI);
        const phi = rng.nextRange(0, Math.PI * 2);
        const radius = 0.75 + (audio.energy || 0) * 0.25;
        return {
            id: `sphere-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: radius * Math.sin(theta) * Math.cos(phi),
                y: radius * Math.cos(theta),
                z: radius * Math.sin(theta) * Math.sin(phi),
                w: rng.nextRange(-0.4, 0.4)
            },
            radius: 0.09 + (audio.high || 0) * 0.04,
            dueBeat: beat + 1.2 - Math.min(0.4, (audio.energy || 0) * 0.25),
            behavior: (audio.mid || 0) > 0.5 ? 'orbit-flare' : 'orbit'
        };
    },
    TORUS(rng, beat, ctx = {}) {
        const audio = ctx.audio || {};
        const reverse = ctx.modifiers?.reverseControls;
        const major = 0.7 + (audio.bass || 0) * 0.25;
        const minor = 0.22 + (audio.energy || 0) * 0.12;
        const angle = (beat * (reverse ? -0.9 : 0.9) + rng.nextFloat()) * Math.PI * 2;
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
            radius: 0.04 + (audio.mid || 0) * 0.03,
            dueBeat: beat + 1.8,
            behavior: reverse ? 'belt-reverse' : 'belt'
        };
    },
    KLEIN(rng, beat, ctx = {}) {
        const audio = ctx.audio || {};
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
            radius: 0.07 + (audio.high || 0) * 0.03,
            dueBeat: beat + 1.5 - Math.min(0.4, (audio.energy || 0) * 0.25),
            behavior: 'invert'
        };
    },
    FRACTAL(rng, beat, ctx = {}) {
        const audio = ctx.audio || {};
        const depth = rng.nextInt(2, 5 + Math.floor((audio.energy || 0) * 3));
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
            behavior: ctx.modifiers?.clusterBias ? 'chain-chaos' : 'chain'
        };
    },
    WAVE(rng, beat, ctx = {}) {
        const audio = ctx.audio || {};
        const phase = beat * 0.5 + rng.nextRange(0, Math.PI * 2);
        const amplitude = 0.6 + (audio.high || 0) * 0.4;
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
            dueBeat: beat + 1.3,
            behavior: (audio.mid || 0) > 0.6 ? 'sweep-sync' : 'sweep'
        };
    },
    CRYSTAL(rng, beat, ctx = {}) {
        const audio = ctx.audio || {};
        const spikeDir = rng.nextRange(0, Math.PI * 2);
        const height = rng.nextRange(0.4, 0.9 + (audio.energy || 0) * 0.3);
        return {
            id: `crystal-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: Math.cos(spikeDir) * 0.4,
                y: height,
                z: Math.sin(spikeDir) * 0.4,
                w: rng.nextRange(-0.3, 0.3)
            },
            radius: 0.06 + (audio.high || 0) * 0.05,
            dueBeat: beat + 1.6 - Math.min(0.3, (audio.energy || 0) * 0.2),
            behavior: ctx.modifiers?.glitchLevel ? 'shard-glitch' : 'shard'
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

function generateQuickDrawTargets(rng, geometry, { count = 3 } = {}) {
    const targets = [];
    for (let i = 0; i < count; i++) {
        const angle = rng.nextRange(0, Math.PI * 2);
        const radial = 0.55 + rng.nextRange(-0.15, 0.2);
        const height = geometry === 'CRYSTAL' ? rng.nextRange(0.2, 0.9) : rng.nextRange(-0.4, 0.6);
        targets.push({
            id: `quick-${geometry.toLowerCase()}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: Math.cos(angle) * radial,
                y: height,
                z: Math.sin(angle) * radial,
                w: rng.nextRange(-0.35, 0.35)
            },
            radius: 0.12,
            dueBeat: 0.2,
            behavior: 'quickdraw'
        });
    }
    return targets;
}

function generateBurstTargets(rng, geometry, { count = 5 } = {}) {
    const targets = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / Math.max(1, count)) * Math.PI * 2 + rng.nextRange(-0.2, 0.2);
        const radial = 0.4 + rng.nextRange(-0.08, 0.12);
        const height = geometry === 'CRYSTAL' ? rng.nextRange(0.2, 0.85) : rng.nextRange(-0.35, 0.6);
        targets.push({
            id: `burst-${geometry.toLowerCase()}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: Math.cos(angle) * radial,
                y: height,
                z: Math.sin(angle) * radial,
                w: rng.nextRange(-0.3, 0.3)
            },
            radius: 0.1,
            dueBeat: 0.4 + (i % 3) * 0.1,
            behavior: 'burst'
        });
    }
    return targets;
}
