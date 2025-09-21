import { SeededRandom } from '../utils/SeededRandom.js';

const GEOMETRY_NAMES = [
    'TETRAHEDRON',
    'HYPERCUBE',
    'SPHERE',
    'TORUS',
    'KLEIN BOTTLE',
    'FRACTAL',
    'WAVE',
    'CRYSTAL'
];

const HOLOGRAPHIC_VARIANT_GROUPS = {
    0: [0, 1, 2, 3],       // Tetrahedron variants
    1: [4, 5, 6, 7],       // Hypercube
    2: [8, 9, 10, 11],     // Sphere
    3: [12, 13, 14, 15],   // Torus
    4: [16, 17, 18, 19],   // Klein Bottle
    5: [20, 21, 22],       // Fractal
    6: [23, 24, 25],       // Wave
    7: [26, 27, 28, 29]    // Crystal
};

const GEOMETRY_SPAWN_PROFILES = {
    0: { pattern: 'vertexPulse', density: 0.7 },
    1: { pattern: 'hypercubeBelts', density: 1.0 },
    2: { pattern: 'orbitalShells', density: 0.9 },
    3: { pattern: 'torusLane', density: 1.1 },
    4: { pattern: 'kleinInversion', density: 0.8 },
    5: { pattern: 'fractalChain', density: 1.2 },
    6: { pattern: 'waveLane', density: 1.0 },
    7: { pattern: 'crystalShards', density: 0.95 }
};

export class GeometryController {
    constructor() {
        this.geometryIndex = 0;
        this.variantLevel = 0;
        this.mode = 'faceted';
        this.random = new SeededRandom(1);
    }

    setSeed(seed) {
        this.random.setSeed(seed);
    }

    setGeometry(index) {
        this.geometryIndex = Math.max(0, Math.min(GEOMETRY_NAMES.length - 1, index));
    }

    setVariantLevel(level) {
        this.variantLevel = level;
    }

    setMode(mode) {
        this.mode = mode;
    }

    getGeometryName(index = this.geometryIndex) {
        return GEOMETRY_NAMES[index] || GEOMETRY_NAMES[0];
    }

    cycleGeometry(direction = 1) {
        const newIndex = (this.geometryIndex + direction + GEOMETRY_NAMES.length) % GEOMETRY_NAMES.length;
        this.geometryIndex = newIndex;
        this.variantLevel = 0;
        return this.geometryIndex;
    }

    getVariantForMode(mode = this.mode, geometryIndex = this.geometryIndex, variantLevel = this.variantLevel) {
        if (mode === 'holographic') {
            const group = HOLOGRAPHIC_VARIANT_GROUPS[geometryIndex] || [0];
            const index = group[variantLevel % group.length];
            return index;
        }

        // Faceted & Quantum use 0-7 geometry index directly with fractional variant control
        return geometryIndex;
    }

    getSpawnProfile(geometryIndex = this.geometryIndex) {
        return GEOMETRY_SPAWN_PROFILES[geometryIndex] || GEOMETRY_SPAWN_PROFILES[0];
    }

    generateSpawn(beatIndex, difficulty = 1.0, overrides = {}) {
        const geometryIndex = this.geometryIndex;
        const profile = this.getSpawnProfile(geometryIndex);
        const rng = this.random;
        const pattern = overrides.pattern || profile.pattern;
        const baseDensity = (overrides.density ?? profile.density) * difficulty;

        switch (pattern) {
            case 'vertexPulse':
                return this.generateVertexPulse(geometryIndex, beatIndex, baseDensity, rng);
            case 'hypercubeBelts':
                return this.generateHypercubeBelts(geometryIndex, beatIndex, baseDensity, rng);
            case 'orbitalShells':
                return this.generateOrbitalShells(geometryIndex, beatIndex, baseDensity, rng);
            case 'torusLane':
                return this.generateTorusLane(geometryIndex, beatIndex, baseDensity, rng);
            case 'kleinInversion':
                return this.generateKleinInversion(geometryIndex, beatIndex, baseDensity, rng);
            case 'fractalChain':
                return this.generateFractalChain(geometryIndex, beatIndex, baseDensity, rng);
            case 'waveLane':
                return this.generateWaveLane(geometryIndex, beatIndex, baseDensity, rng);
            case 'crystalShards':
                return this.generateCrystalShards(geometryIndex, beatIndex, baseDensity, rng);
            case 'torusLane':
                return this.generateTorusLane(geometryIndex, beatIndex, baseDensity, rng);
            case 'orbital':
                return this.generateOrbitalShells(geometryIndex, beatIndex, baseDensity, rng);
            case 'belt':
                return this.generateHypercubeBelts(geometryIndex, beatIndex, baseDensity, rng);
            case 'shard':
                return this.generateCrystalShards(geometryIndex, beatIndex, baseDensity, rng);
            default:
                return [];
        }
    }

    generateVertexPulse(geometryIndex, beatIndex, density, rng) {
        const vertices = [
            { x: 0.3, y: 0.25 },
            { x: 0.7, y: 0.25 },
            { x: 0.5, y: 0.72 },
            { x: 0.5, y: 0.45 }
        ];

        const count = Math.max(1, Math.round(2 * density));
        const result = [];
        for (let i = 0; i < count; i++) {
            const base = vertices[(beatIndex + i) % vertices.length];
            result.push({
                type: 'node',
                x: base.x + rng.range(-0.05, 0.05),
                y: base.y + rng.range(-0.05, 0.05),
                radius: 0.06,
                lifespan: 1.6,
                speed: 0.3,
                metadata: { geometryIndex }
            });
        }
        return result;
    }

    generateHypercubeBelts(geometryIndex, beatIndex, density, rng) {
        const lanes = [0.2, 0.35, 0.65, 0.8];
        const result = [];
        const count = Math.max(1, Math.round(3 * density));
        for (let i = 0; i < count; i++) {
            const lane = lanes[(beatIndex + i) % lanes.length];
            result.push({
                type: 'belt',
                x: lane,
                y: rng.range(0.15, 0.85),
                radius: 0.05,
                lifespan: 1.8,
                speed: 0.45,
                direction: (i % 2 === 0) ? 1 : -1,
                metadata: { geometryIndex }
            });
        }
        return result;
    }

    generateOrbitalShells(geometryIndex, beatIndex, density, rng) {
        const rings = [0.18, 0.35, 0.55, 0.75];
        const result = [];
        const count = Math.max(1, Math.round(3 * density));
        for (let i = 0; i < count; i++) {
            const radius = rings[(beatIndex + i) % rings.length];
            const angle = rng.range(0, Math.PI * 2);
            result.push({
                type: 'orb',
                x: 0.5 + Math.cos(angle) * radius * 0.5,
                y: 0.5 + Math.sin(angle) * radius * 0.5,
                radius: 0.05,
                lifespan: 2.0,
                speed: 0.35,
                orbitRadius: radius,
                orbitSpeed: rng.range(0.4, 0.8),
                metadata: { geometryIndex }
            });
        }
        return result;
    }

    generateTorusLane(geometryIndex, beatIndex, density, rng) {
        const lanes = [0.3, 0.5, 0.7];
        const result = [];
        const count = Math.max(1, Math.round(4 * density));
        for (let i = 0; i < count; i++) {
            const lane = lanes[(beatIndex + i) % lanes.length];
            result.push({
                type: 'ring',
                x: rng.range(0.15, 0.85),
                y: lane,
                radius: 0.07,
                lifespan: 1.5,
                speed: 0.5,
                direction: (i + beatIndex) % 2 === 0 ? 1 : -1,
                metadata: { geometryIndex }
            });
        }
        return result;
    }

    generateKleinInversion(geometryIndex, beatIndex, density, rng) {
        const result = [];
        const count = Math.max(1, Math.round(3 * density));
        for (let i = 0; i < count; i++) {
            const phase = ((beatIndex + i) % 6) / 6;
            result.push({
                type: 'arc',
                x: 0.5 + Math.sin(phase * Math.PI * 2) * 0.3,
                y: 0.5 + Math.cos(phase * Math.PI * 2) * 0.2,
                radius: 0.05,
                lifespan: 1.7,
                speed: 0.38,
                rotationSpeed: (phase < 0.5 ? 1 : -1) * 0.6,
                metadata: { geometryIndex }
            });
        }
        return result;
    }

    generateFractalChain(geometryIndex, beatIndex, density, rng) {
        const result = [];
        const segments = 4 + Math.floor(density * 3);
        for (let i = 0; i < segments; i++) {
            const offset = i / segments;
            result.push({
                type: 'chain',
                x: 0.2 + offset * 0.6 + rng.range(-0.03, 0.03),
                y: 0.25 + Math.sin((beatIndex * 0.5 + offset * Math.PI * 2)) * 0.2,
                radius: 0.045,
                lifespan: 2.2,
                speed: 0.4,
                metadata: { geometryIndex }
            });
        }
        return result;
    }

    generateWaveLane(geometryIndex, beatIndex, density, rng) {
        const result = [];
        const lanes = 3 + Math.floor(density * 2);
        for (let i = 0; i < lanes; i++) {
            const phase = (beatIndex + i) * 0.6;
            result.push({
                type: 'wave',
                x: 0.1,
                y: 0.2 + i * (0.6 / (lanes - 1)),
                radius: 0.04,
                lifespan: 2.0,
                speed: 0.6,
                waveAmplitude: 0.15,
                waveFrequency: 2.2,
                wavePhase: phase,
                metadata: { geometryIndex }
            });
        }
        return result;
    }

    generateCrystalShards(geometryIndex, beatIndex, density, rng) {
        const result = [];
        const shards = Math.max(3, Math.round(5 * density));
        for (let i = 0; i < shards; i++) {
            result.push({
                type: 'shard',
                x: rng.range(0.25, 0.75),
                y: rng.range(0.2, 0.8),
                radius: 0.05,
                lifespan: 1.6,
                speed: 0.55,
                direction: rng.range(-1, 1),
                metadata: { geometryIndex }
            });
        }
        return result;
    }
}
