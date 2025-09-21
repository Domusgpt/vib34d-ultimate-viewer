export const DEFAULT_LEVELS = [
    {
        id: 'lvl-01-faceted-torus',
        name: 'Lattice Breaker',
        system: 'faceted',
        geometryIndex: 3,
        track: 'suno:track_001',
        bpm: 128,
        seed: 4711,
        planes: ['XW', 'YW'],
        windowMs: 150,
        spawn: { pattern: 'torusLane', density: 0.8 },
        difficulty: { speed: 1.0, chaos: 0.12, gridDensity: 18 },
        palette: { hue: 210, saturation: 0.85, intensity: 0.6 }
    },
    {
        id: 'lvl-02-quantum-sphere',
        name: 'Quantum Bloom',
        system: 'quantum',
        geometryIndex: 2,
        track: 'suno:track_014',
        bpm: 140,
        seed: 8722,
        planes: ['XW', 'ZW'],
        windowMs: 140,
        spawn: { pattern: 'orbitalShells', density: 1.0 },
        difficulty: { speed: 1.2, chaos: 0.2, gridDensity: 20 },
        palette: { hue: 268, saturation: 0.92, intensity: 0.72 }
    },
    {
        id: 'lvl-03-holographic-crystal',
        name: 'Crystal Resonance',
        system: 'holographic',
        geometryIndex: 7,
        track: 'suno:track_029',
        bpm: 122,
        seed: 1299,
        planes: ['YW', 'ZW'],
        windowMs: 160,
        spawn: { pattern: 'crystalShards', density: 1.1 },
        difficulty: { speed: 1.1, chaos: 0.18, gridDensity: 22 },
        palette: { hue: 188, saturation: 0.88, intensity: 0.66 }
    }
];
