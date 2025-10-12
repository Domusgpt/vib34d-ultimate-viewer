const DEG_TO_RAD = Math.PI / 180;

function quaternionFromEuler(degRoll = 0, degPitch = 0, degYaw = 0) {
    const roll = degRoll * DEG_TO_RAD;
    const pitch = degPitch * DEG_TO_RAD;
    const yaw = degYaw * DEG_TO_RAD;

    const cy = Math.cos(yaw / 2);
    const sy = Math.sin(yaw / 2);
    const cp = Math.cos(pitch / 2);
    const sp = Math.sin(pitch / 2);
    const cr = Math.cos(roll / 2);
    const sr = Math.sin(roll / 2);

    return {
        w: cr * cp * cy + sr * sp * sy,
        x: sr * cp * cy - cr * sp * sy,
        y: cr * sp * cy + sr * cp * sy,
        z: cr * cp * sy - sr * sp * cy
    };
}

function createDepthBuffer(value) {
    const width = 4;
    const height = 4;
    const data = new Array(width * height).fill(value);
    return { width, height, data, format: 'r16uint' };
}

function anchor(id, confidence, position, orientation, variance = 0.02) {
    return {
        id,
        confidence,
        pose: {
            position,
            orientation
        },
        variance
    };
}

function hit(id, confidence, distance, position, orientation) {
    return {
        id,
        confidence,
        distance,
        pose: {
            position,
            orientation
        }
    };
}

export const DEMO_AR_VISOR_SPATIAL_TRACE = [
    {
        timestamp: 0,
        deviceId: 'visor-alpha',
        confidence: 0.9,
        anchors: [
            anchor('alpha-floor', 0.92, { x: 0.1, y: 0, z: -0.4 }, quaternionFromEuler(0, 1.5, 8)),
            anchor('alpha-desk', 0.88, { x: 0.85, y: 0.74, z: -0.6 }, quaternionFromEuler(0.4, 3.2, 11))
        ],
        hitTests: [
            hit('alpha-ray-0', 0.86, 0.62, { x: 0.32, y: -0.1, z: -1.2 }, quaternionFromEuler(-1.4, 2.8, 6))
        ],
        poseOrientation: quaternionFromEuler(-1, 1.8, 7),
        gaze: { x: 0.46, y: 0.52, depth: 0.44 },
        ambient: { luminance: 0.58, noiseLevel: 0.18, motion: 0.16 },
        gesture: { intent: 'point', vector: { x: 0.04, y: -0.02, z: 0.08 } },
        depth: createDepthBuffer(0.52),
        planes: [
            {
                id: 'alpha-plane-0',
                confidence: 0.82,
                pose: { position: { x: 0, y: 0, z: -1.1 }, orientation: quaternionFromEuler(0, 0.5, 5) },
                alignment: 'horizontal',
                extent: { width: 3.2, height: 2.8 }
            }
        ]
    },
    {
        timestamp: 120,
        deviceId: 'visor-beta',
        confidence: 0.88,
        anchors: [
            anchor('beta-floor', 0.91, { x: -0.15, y: 0, z: -0.6 }, quaternionFromEuler(0.6, 0.8, 3)),
            anchor('beta-screen', 0.83, { x: -0.6, y: 1.3, z: -1.8 }, quaternionFromEuler(-0.8, 2.4, -4))
        ],
        hitTests: [
            hit('beta-ray-0', 0.82, 0.74, { x: -0.42, y: -0.05, z: -1.4 }, quaternionFromEuler(0.2, 3.6, -2)),
            hit('beta-ray-1', 0.7, 0.9, { x: -0.5, y: -0.08, z: -1.65 }, quaternionFromEuler(0.4, 3.4, -6))
        ],
        poseOrientation: quaternionFromEuler(-0.4, 2.6, -3),
        gaze: { x: 0.54, y: 0.47, depth: 0.48 },
        ambient: { luminance: 0.6, noiseLevel: 0.15, motion: 0.18 },
        gesture: { intent: 'air-tap', vector: { x: -0.02, y: 0.01, z: 0.03 } },
        depth: createDepthBuffer(0.47),
        planes: [
            {
                id: 'beta-plane-0',
                confidence: 0.79,
                pose: { position: { x: -0.4, y: 0.82, z: -1.5 }, orientation: quaternionFromEuler(0.2, 1.6, -8) },
                alignment: 'vertical',
                extent: { width: 2.4, height: 1.8 }
            }
        ]
    },
    {
        timestamp: 240,
        deviceId: 'visor-alpha',
        confidence: 0.93,
        anchors: [
            anchor('alpha-floor', 0.95, { x: 0.12, y: -0.02, z: -0.45 }, quaternionFromEuler(0.3, 2.1, 9)),
            anchor('alpha-desk', 0.87, { x: 0.88, y: 0.74, z: -0.58 }, quaternionFromEuler(0.6, 3.6, 13))
        ],
        hitTests: [
            hit('alpha-ray-0', 0.88, 0.58, { x: 0.36, y: -0.12, z: -1.22 }, quaternionFromEuler(-1.1, 3.1, 8))
        ],
        poseOrientation: quaternionFromEuler(-0.6, 2.2, 9),
        gaze: { x: 0.48, y: 0.51, depth: 0.46 },
        ambient: { luminance: 0.61, noiseLevel: 0.16, motion: 0.2 },
        gesture: { intent: 'point', vector: { x: 0.06, y: -0.01, z: 0.07 } },
        depth: createDepthBuffer(0.55),
        planes: [
            {
                id: 'alpha-plane-0',
                confidence: 0.83,
                pose: { position: { x: 0.05, y: 0.02, z: -1.1 }, orientation: quaternionFromEuler(0.1, 0.7, 6) },
                alignment: 'horizontal',
                extent: { width: 3.15, height: 2.75 }
            }
        ]
    },
    {
        timestamp: 360,
        deviceId: 'visor-beta',
        confidence: 0.9,
        anchors: [
            anchor('beta-floor', 0.9, { x: -0.18, y: 0.02, z: -0.55 }, quaternionFromEuler(0.8, 1.1, 5)),
            anchor('beta-screen', 0.84, { x: -0.62, y: 1.32, z: -1.72 }, quaternionFromEuler(-0.6, 2.8, -2))
        ],
        hitTests: [
            hit('beta-ray-0', 0.84, 0.71, { x: -0.45, y: -0.04, z: -1.48 }, quaternionFromEuler(0.35, 3.4, -4))
        ],
        poseOrientation: quaternionFromEuler(-0.2, 2.9, -1),
        gaze: { x: 0.55, y: 0.44, depth: 0.49 },
        ambient: { luminance: 0.57, noiseLevel: 0.14, motion: 0.19 },
        gesture: { intent: 'air-tap', vector: { x: -0.03, y: 0.02, z: 0.04 } },
        depth: createDepthBuffer(0.5),
        planes: [
            {
                id: 'beta-plane-0',
                confidence: 0.78,
                pose: { position: { x: -0.42, y: 0.84, z: -1.54 }, orientation: quaternionFromEuler(0.25, 1.7, -6) },
                alignment: 'vertical',
                extent: { width: 2.5, height: 1.9 }
            }
        ]
    }
];

export default DEMO_AR_VISOR_SPATIAL_TRACE;
