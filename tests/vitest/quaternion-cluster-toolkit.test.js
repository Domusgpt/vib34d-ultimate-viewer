import { describe, it, expect } from 'vitest';
import {
    averageQuaternionSamples,
    blendAnchorCluster,
    blendHitTestCluster,
    mergeDeviceClusters
} from '../../src/ui/adaptive/renderers/QuaternionClusterToolkit.js';

function quaternionFromEuler(roll, pitch, yaw) {
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

describe('QuaternionClusterToolkit', () => {
    it('averages quaternion samples with hemisphere alignment', () => {
        const a = quaternionFromEuler(0, 0, 0);
        const b = { x: -a.x, y: -a.y, z: -a.z, w: -a.w }; // opposite hemisphere
        const result = averageQuaternionSamples([
            { orientation: a, weight: 1 },
            { orientation: b, weight: 1 }
        ]);

        expect(result).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    });

    it('blends anchor clusters into aggregate orientation and confidence', () => {
        const anchors = [
            {
                confidence: 0.9,
                pose: { orientation: quaternionFromEuler(0, 0, 0.2), position: { x: 0, y: 0, z: 0 } }
            },
            {
                confidence: 0.6,
                pose: { orientation: quaternionFromEuler(0, 0, 0.4), position: { x: 1, y: 0, z: 0 } }
            }
        ];

        const blended = blendAnchorCluster(anchors);
        expect(blended).not.toBeNull();
        expect(blended?.orientation?.w).toBeTypeOf('number');
        expect(blended?.confidence).toBeGreaterThan(0.6);
        expect(blended?.sampleCount).toBe(2);
        expect(blended?.variance).toBeGreaterThanOrEqual(0);
    });

    it('weights hit-test results by confidence and distance', () => {
        const hits = [
            {
                confidence: 0.8,
                distance: 0.1,
                pose: { orientation: quaternionFromEuler(0, 0, 0.3), position: { x: 0, y: 0, z: 0.1 } }
            },
            {
                confidence: 0.4,
                distance: 0.8,
                pose: { orientation: quaternionFromEuler(0, 0, 0.9), position: { x: 0, y: 0, z: 0.8 } }
            }
        ];

        const blended = blendHitTestCluster(hits, { distanceFalloff: 0.5 });
        expect(blended).not.toBeNull();
        expect(blended?.averageDistance).toBeLessThan(0.4);
        expect(blended?.confidence).toBeGreaterThan(0.5);
        expect(blended?.variance).toBeGreaterThanOrEqual(0);
    });

    it('merges multi-device clusters with weighted quaternion averaging', () => {
        const anchor = quaternionFromEuler(0, 0, 0.2);
        const secondary = quaternionFromEuler(0.05, -0.04, 0.4);

        const aggregate = mergeDeviceClusters([
            {
                deviceId: 'alpha',
                anchorCluster: {
                    orientation: anchor,
                    confidence: 0.9,
                    weight: 0.9,
                    position: { x: 0.1, y: 0, z: -0.5 }
                }
            },
            {
                deviceId: 'beta',
                hitTestCluster: {
                    orientation: secondary,
                    confidence: 0.75,
                    weight: 0.7,
                    position: { x: -0.2, y: 0, z: -0.6 }
                }
            }
        ]);

        expect(aggregate).not.toBeNull();
        expect(aggregate?.deviceCount).toBe(2);
        expect(aggregate?.dominantDeviceId).toBe('alpha');
        expect(aggregate?.confidence).toBeGreaterThan(0.7);
        expect(aggregate?.position?.z).toBeLessThan(-0.5);
        expect(aggregate?.variance).toBeGreaterThanOrEqual(0);
    });
});
