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
    generateTargets(beat, difficulty = {}) {
        const geometry = this.getGeometryId();
        const generator = GEOMETRY_GENERATORS[geometry] || GEOMETRY_GENERATORS.TETRA;
        const density = difficulty.density ?? 0.9;
        const speed = difficulty.speed ?? 1.0;
        const chaos = difficulty.chaos ?? 0.15;
        const rawAudio = difficulty.audio || {};
        const energy = clamp01(rawAudio.energy ?? averageBands(rawAudio));
        const accent = clamp01(Math.abs(rawAudio.delta ?? 0) * 0.6 + Math.max(0, rawAudio.trend ?? 0));
        const hush = clamp01(rawAudio.silence ? Math.min(1, rawAudio.silence / 1.6) : 0);
        const audioState = {
            bass: clamp01(rawAudio.bass ?? energy),
            mid: clamp01(rawAudio.mid ?? energy),
            high: clamp01(rawAudio.high ?? energy),
            energy,
            delta: rawAudio.delta ?? 0,
            trend: rawAudio.trend ?? 0,
            silence: rawAudio.silence ?? 0,
            origin: rawAudio.origin
        };
        const amountFactor = 0.32 + energy * 1.85;
        const hushPenalty = 1 - hush * 0.65;
        const swing = (rawAudio.trend ?? 0) * 0.12;
        const spacingBase = 0.08 + (1 - energy) * 0.045;
        const amount = Math.max(1, Math.round(density * amountFactor * hushPenalty));
        const targets = [];
        for (let i = 0; i < amount; i++) {
            const beatOffset = i * spacingBase + swing * (i % 2 === 0 ? 1 : -1);
            targets.push(generator(this.rng, beat + beatOffset, {
                speed,
                chaos,
                audio: audioState,
                energy,
                accent,
                hush,
                mode: this.mode
            }));
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

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function clampInt(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(value)));
}

function averageBands(audio = {}) {
    const bass = audio.bass ?? audio.energy ?? 0.5;
    const mid = audio.mid ?? audio.energy ?? 0.5;
    const high = audio.high ?? audio.energy ?? 0.5;
    return (bass + mid + high) / 3;
}

const GEOMETRY_GENERATORS = {
    TETRA(rng, beat, opts = {}) {
        const { audio = {}, energy = 0.55, accent = 0.4, hush = 0, chaos = 0.15 } = opts;
        const bass = audio.bass ?? energy;
        const high = audio.high ?? energy;
        const spread = 0.45 + bass * 0.35;
        const jitter = chaos * 0.18 + Math.abs(audio.delta ?? 0) * 0.25;
        const drift = (audio.trend ?? 0) * 0.18;
        const delay = clamp(0.8 + (1 - energy) * 0.6 + hush * 0.35 - bass * 0.22, 0.55, 2.4);
        return {
            id: `tetra-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: randomSign(rng) * (spread + rng.nextRange(-jitter, jitter) + drift),
                y: randomSign(rng) * (spread + rng.nextRange(-jitter, jitter) - drift),
                z: randomSign(rng) * (spread + rng.nextRange(-jitter * 0.8, jitter * 0.8)),
                w: randomSign(rng) * (0.4 + high * 0.35 + rng.nextRange(-0.12, 0.12))
            },
            radius: 0.06 + bass * 0.06,
            dueBeat: beat + delay,
            behavior: accent > 0.55 ? 'burst' : 'pulse'
        };
    },
    CUBE(rng, beat, opts = {}) {
        const { audio = {}, energy = 0.5, accent = 0.3, hush = 0, chaos = 0.2 } = opts;
        const mid = audio.mid ?? energy;
        const high = audio.high ?? energy;
        const axisPreference = mid >= high ? ['x', 'y', 'z'] : ['z', 'y', 'x'];
        const axis = rng.choose(axisPreference.slice(0, 2));
        const pos = {
            x: rng.nextRange(-0.85, 0.85),
            y: rng.nextRange(-0.85, 0.85),
            z: rng.nextRange(-0.85, 0.85),
            w: rng.nextRange(-0.6, 0.6) * (0.7 + high * 0.4)
        };
        const axisOffset = 0.28 + chaos * 0.25 + Math.abs(audio.delta ?? 0) * 0.22 + mid * 0.12;
        const other = { ...pos };
        other[axis] += axisOffset;
        pos[axis] -= axisOffset;
        const delay = clamp(1.05 + (1 - energy) * 0.8 + hush * 0.5, 0.75, 2.8);
        return {
            id: `cube-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'lane',
            vec4: pos,
            vec4b: other,
            radius: 0.04 + high * 0.035,
            dueBeat: beat + delay,
            behavior: accent > 0.45 ? 'slide' : 'drift'
        };
    },
    SPHERE(rng, beat, opts = {}) {
        const { audio = {}, energy = 0.6, accent = 0.35, hush = 0 } = opts;
        const high = audio.high ?? energy;
        const mid = audio.mid ?? energy;
        const bass = audio.bass ?? energy;
        const theta = rng.nextRange(0, Math.PI) * (0.7 + high * 0.5);
        const phi = rng.nextRange(0, Math.PI * 2) + (audio.delta ?? 0) * 2.2;
        const radius = 0.7 + bass * 0.25;
        const wSwing = (mid - bass) * 0.35 + (audio.trend ?? 0) * 0.18;
        const delay = clamp(0.9 + (1 - energy) * 0.5 + hush * 0.45, 0.55, 2.1);
        return {
            id: `sphere-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: radius * Math.sin(theta) * Math.cos(phi),
                y: radius * Math.cos(theta),
                z: radius * Math.sin(theta) * Math.sin(phi),
                w: rng.nextRange(-0.35, 0.35) + wSwing
            },
            radius: 0.07 + high * 0.05,
            dueBeat: beat + delay,
            behavior: accent > 0.5 ? 'flare' : 'orbit'
        };
    },
    TORUS(rng, beat, opts = {}) {
        const { audio = {}, energy = 0.5, accent = 0.45, hush = 0, chaos = 0.18 } = opts;
        const bass = audio.bass ?? energy;
        const high = audio.high ?? energy;
        const flow = (audio.trend ?? 0) * 0.4;
        const major = 0.6 + bass * 0.3;
        const minor = 0.18 + high * 0.15;
        const angle = (beat * (0.8 + energy * 0.25) + rng.nextFloat() + flow) * Math.PI * 2;
        const arcShift = 0.3 + chaos * 0.15 + Math.abs(audio.delta ?? 0) * 0.2;
        const delay = clamp(1.3 + (1 - energy) * 0.7 + hush * 0.4, 0.9, 2.6);
        return {
            id: `torus-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'lane',
            vec4: {
                x: (major + minor * Math.cos(angle)) * Math.cos(angle),
                y: minor * Math.sin(angle * 2),
                z: (major + minor * Math.cos(angle)) * Math.sin(angle),
                w: rng.nextRange(-0.45, 0.45) + flow * 0.2
            },
            vec4b: {
                x: (major + minor * Math.cos(angle + arcShift)) * Math.cos(angle + arcShift),
                y: minor * Math.sin((angle + arcShift) * 2),
                z: (major + minor * Math.cos(angle + arcShift)) * Math.sin(angle + arcShift),
                w: rng.nextRange(-0.45, 0.45) - flow * 0.15
            },
            radius: 0.035 + high * 0.035,
            dueBeat: beat + delay,
            behavior: accent > 0.6 ? 'spiral' : 'belt'
        };
    },
    KLEIN(rng, beat, opts = {}) {
        const { audio = {}, energy = 0.52, accent = 0.42, hush = 0 } = opts;
        const mid = audio.mid ?? energy;
        const high = audio.high ?? energy;
        const bass = audio.bass ?? energy;
        const u = rng.nextRange(0, Math.PI * 2);
        const v = rng.nextRange(0, Math.PI * 2) + (audio.delta ?? 0) * 2.6;
        const baseRadius = 0.32 + mid * 0.28;
        const cosU = Math.cos(u);
        const sinU = Math.sin(u);
        const cosV = Math.cos(v);
        const sinV = Math.sin(v);
        const x = (baseRadius + cosU * 0.35) * cosV;
        const y = (baseRadius + cosU * 0.35) * sinV;
        const z = sinU * (0.25 + bass * 0.25);
        const w = Math.sin(u) * Math.cos(v) * (0.65 + high * 0.35);
        const delay = clamp(1.05 + (1 - energy) * 0.7 + hush * 0.55, 0.75, 2.5);
        return {
            id: `klein-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: { x, y, z, w },
            radius: 0.055 + mid * 0.045,
            dueBeat: beat + delay,
            behavior: accent > 0.52 ? 'twist' : 'invert'
        };
    },
    FRACTAL(rng, beat, opts = {}) {
        const { audio = {}, energy = 0.6, accent = 0.5, hush = 0, chaos = 0.2 } = opts;
        const high = audio.high ?? energy;
        const mid = audio.mid ?? energy;
        const depth = clampInt(Math.round(2 + accent * 3 + chaos * 3), 2, 6);
        const scale = (0.36 + high * 0.2) / depth;
        const offsets = [rng.nextRange(-0.9, 0.9), rng.nextRange(-0.9, 0.9), rng.nextRange(-0.9, 0.9)];
        const childCount = depth * 3;
        const delay = clamp(1.5 + (1 - energy) * 1.1 + hush * 0.7, 1.0, 3.1);
        const children = Array.from({ length: childCount }, (_, idx) => {
            const phase = (idx / childCount) * Math.PI * 2;
            const wobble = Math.sin(phase + (audio.delta ?? 0) * 4) * scale * 0.8;
            return {
                vec4: {
                    x: offsets[0] + scale * ((idx % 2) ? 1 : -1) + wobble,
                    y: offsets[1] + scale * ((idx & 2) ? 1 : -1),
                    z: offsets[2] + scale * ((idx & 4) ? 1 : -1),
                    w: rng.nextRange(-0.55, 0.55) + (audio.trend ?? 0) * 0.3
                },
                radius: 0.035 + high * 0.02
            };
        });
        return {
            id: `fractal-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'cluster',
            children,
            dueBeat: beat + delay,
            radius: 0.035 + mid * 0.025,
            behavior: accent > 0.55 ? 'cascade' : 'chain'
        };
    },
    WAVE(rng, beat, opts = {}) {
        const { audio = {}, energy = 0.55, accent = 0.45, hush = 0, chaos = 0.22 } = opts;
        const high = audio.high ?? energy;
        const bass = audio.bass ?? energy;
        const phase = beat * (0.45 + energy * 0.35) + rng.nextRange(0, Math.PI * 2);
        const amplitude = 0.45 + high * 0.4;
        const depth = 0.32 + bass * 0.28;
        const flow = (audio.trend ?? 0) * 0.6;
        const delay = clamp(1.1 + (1 - energy) * 0.6 + hush * 0.4, 0.8, 2.4);
        return {
            id: `wave-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'lane',
            vec4: {
                x: -0.92,
                y: Math.sin(phase) * amplitude + flow * 0.2,
                z: Math.cos(phase * 1.2) * depth,
                w: Math.sin(phase * 0.7) * (0.35 + high * 0.2)
            },
            vec4b: {
                x: 0.92,
                y: Math.sin(phase + 0.45) * amplitude - flow * 0.18,
                z: Math.cos((phase + 0.45) * 1.2) * depth,
                w: Math.sin((phase + 0.45) * 0.7) * (0.35 + high * 0.2)
            },
            radius: 0.045 + high * 0.03,
            dueBeat: beat + delay,
            behavior: accent > 0.55 ? 'rip' : 'sweep'
        };
    },
    CRYSTAL(rng, beat, opts = {}) {
        const { audio = {}, energy = 0.58, accent = 0.48, hush = 0 } = opts;
        const high = audio.high ?? energy;
        const bass = audio.bass ?? energy;
        const spikeDir = rng.nextRange(0, Math.PI * 2) + (audio.delta ?? 0) * 5.2;
        const radial = 0.25 + bass * 0.28;
        const height = 0.45 + high * 0.55;
        const wWarp = (audio.trend ?? 0) * 0.3;
        const delay = clamp(1.2 + (1 - energy) * 0.7 + hush * 0.5, 0.85, 2.6);
        return {
            id: `crystal-${beat.toFixed(2)}-${rng.nextInt(0, 9999)}`,
            type: 'node',
            vec4: {
                x: Math.cos(spikeDir) * radial,
                y: height,
                z: Math.sin(spikeDir) * radial,
                w: rng.nextRange(-0.28, 0.28) + wWarp
            },
            radius: 0.05 + high * 0.045,
            dueBeat: beat + delay,
            behavior: accent > 0.58 ? 'eruption' : 'shard'
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
