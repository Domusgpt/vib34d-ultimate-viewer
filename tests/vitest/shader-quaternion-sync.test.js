import { describe, it, expect, beforeEach } from 'vitest';
import { ShaderQuaternionSynchronizer } from '../../src/ui/adaptive/renderers/ShaderQuaternionSynchronizer.js';

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

function createStubSystem(defaults = {}) {
    const parameters = new Map(Object.entries(defaults));
    const updates = [];
    return {
        parameters,
        updates,
        updateParameter(param, value) {
            parameters.set(param, value);
            updates.push({ param, value });
        }
    };
}

describe('ShaderQuaternionSynchronizer', () => {
    let bridge;
    let callbacks;

    beforeEach(() => {
        callbacks = new Map();
        bridge = {
            subscribe(channel, handler) {
                callbacks.set(channel, handler);
                return () => callbacks.delete(channel);
            }
        };
    });

    it('applies spatial anchor orientation across shader systems', () => {
        const quantum = createStubSystem({ chaos: 0.2, intensity: 0.7, rot4dXW: 0, rot4dYW: 0, rot4dZW: 0 });
        const holographic = createStubSystem({ hue: 320, saturation: 0.9, rot4dXW: 0, rot4dYW: 0, rot4dZW: 0 });
        const faceted = createStubSystem({ speed: 1, rot4dXW: 0, rot4dYW: 0, rot4dZW: 0 });

        const sync = new ShaderQuaternionSynchronizer({
            bridge,
            systems: { quantum, holographic, faceted },
            baseAlpha: 1,
            rotationScale: 2,
            energySmoothing: 1
        });
        sync.start();

        const handler = callbacks.get('spatial.anchors');
        expect(handler).toBeTypeOf('function');

        const orientation = quaternionFromEuler(-0.1, 0.2, 0.3);
        handler({
            payload: { anchors: [{ confidence: 0.9, pose: { orientation } }] },
            confidence: 0.9,
            timestamp: 1000
        });

        expect(quantum.parameters.get('rot4dXW')).toBeCloseTo(0.4, 5);
        expect(quantum.parameters.get('rot4dYW')).toBeCloseTo(0.6, 5);
        expect(quantum.parameters.get('rot4dZW')).toBeCloseTo(-0.2, 5);

        expect(holographic.parameters.get('hue')).toBe(360);
        expect(holographic.parameters.get('saturation')).toBeCloseTo(0.9, 5);
        expect(faceted.parameters.get('speed')).toBeCloseTo(1, 5);
    });

    it('blends anchor clusters using weighted quaternion averages', () => {
        const quantum = createStubSystem({ rot4dYW: 0 });

        const sync = new ShaderQuaternionSynchronizer({
            bridge,
            systems: { quantum },
            baseAlpha: 1,
            rotationScale: 1,
            energySmoothing: 1
        });
        sync.start();

        const handler = callbacks.get('spatial.anchors');
        expect(handler).toBeTypeOf('function');

        const anchorA = quaternionFromEuler(0, 0, 0);
        const anchorB = quaternionFromEuler(0, 0, Math.PI / 2);

        handler({
            payload: {
                anchors: [
                    { confidence: 0.9, pose: { orientation: anchorA, position: { x: 0, y: 0, z: 0 } } },
                    { confidence: 0.9, pose: { orientation: anchorB, position: { x: 1, y: 0, z: 0 } } }
                ]
            },
            confidence: 0.9,
            timestamp: 42
        });

        expect(quantum.parameters.get('rot4dYW')).toBeCloseTo(Math.PI / 4, 2);
    });

    it('derives motion energy from subsequent samples to modulate parameters', () => {
        const quantum = createStubSystem({ chaos: 0.25, intensity: 0.6, rot4dXW: 0, rot4dYW: 0, rot4dZW: 0 });
        const holographic = createStubSystem({ hue: 300, saturation: 0.85, rot4dXW: 0, rot4dYW: 0, rot4dZW: 0 });
        const faceted = createStubSystem({ speed: 0.8, rot4dXW: 0, rot4dYW: 0, rot4dZW: 0 });

        const sync = new ShaderQuaternionSynchronizer({
            bridge,
            systems: { quantum, holographic, faceted },
            baseAlpha: 1,
            rotationScale: 2,
            energySmoothing: 1,
            velocityReference: 2
        });

        const first = quaternionFromEuler(0, 0, 0);
        const second = quaternionFromEuler(0.5, 0.4, 0.3);

        sync.applyOrientation(first, { confidence: 1, timestamp: 0 });
        sync.applyOrientation(second, { confidence: 1, timestamp: 1000 });

        expect(quantum.parameters.get('chaos')).toBeGreaterThan(0.25);
        expect(quantum.parameters.get('intensity')).toBeGreaterThan(0.6);
        expect(faceted.parameters.get('speed')).toBeGreaterThan(0.8);
    });

    it('attenuates updates when confidence falls below the threshold', () => {
        const quantum = createStubSystem({ rot4dXW: 0 });
        const sync = new ShaderQuaternionSynchronizer({
            bridge,
            systems: { quantum },
            rotationScale: 2,
            baseAlpha: 0.5,
            minConfidence: 0.6,
            energySmoothing: 1
        });

        const orientation = quaternionFromEuler(0, 0.5, 0);
        sync.applyOrientation(orientation, { confidence: 0.2, timestamp: 0 });

        expect(quantum.parameters.get('rot4dXW')).toBeCloseTo(0.1666666, 4);
    });

    it('notifies observers with quaternion diagnostics payloads', () => {
        const quantum = createStubSystem({ rot4dXW: 0, rot4dYW: 0, rot4dZW: 0 });
        const sync = new ShaderQuaternionSynchronizer({
            bridge,
            systems: { quantum },
            rotationScale: 1,
            baseAlpha: 1,
            energySmoothing: 1
        });

        let payload = null;
        sync.addObserver(update => {
            payload = update;
        });

        const orientation = quaternionFromEuler(0.1, -0.2, 0.05);
        sync.applyOrientation(orientation, { confidence: 0.8, timestamp: 420, source: 'spatial.pose' });

        expect(payload).not.toBeNull();
        expect(payload?.source).toBe('spatial.pose');
        expect(payload?.motionEnergy).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(payload?.systems?.[0]?.parameters?.rot4dXW ?? NaN)).toBe(true);
        expect(payload?.metadata).toBeNull();

        let anchorPayload = null;
        sync.addObserver(update => {
            if (update.source === 'spatial.anchors') {
                anchorPayload = update;
            }
        });

        sync.handleEvent('spatial.anchors', {
            payload: {
                anchors: [
                    { confidence: 0.8, pose: { orientation: quaternionFromEuler(0, 0, 0.1) } },
                    { confidence: 0.6, pose: { orientation: quaternionFromEuler(0, 0, 0.2) } }
                ]
            },
            confidence: 0.8,
            timestamp: 1000
        });

        expect(anchorPayload?.metadata?.anchorCluster?.sampleCount).toBe(2);
        expect(anchorPayload?.metadata?.anchorCluster?.orientation).toBeDefined();
    });
});
