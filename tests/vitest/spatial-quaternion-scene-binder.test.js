import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialQuaternionSceneBinder } from '../../src/ui/adaptive/renderers/SpatialQuaternionSceneBinder.js';
import { DEMO_AR_VISOR_SPATIAL_TRACE } from '../../src/data/spatial/arVisorDemoTrace.js';

function createBridgeStub() {
    const callbacks = new Map();
    return {
        callbacks,
        subscribe(channel, handler) {
            callbacks.set(channel, handler);
            return () => callbacks.delete(channel);
        },
        processSample(type, sample) {
            const handler = callbacks.get(type);
            if (handler) {
                handler({ payload: sample.payload, confidence: sample.confidence, timestamp: sample.payload?.timestamp });
            }
        }
    };
}

function createSynchronizerStub() {
    const calls = [];
    return {
        calls,
        applyOrientation(quaternion, context) {
            calls.push({ quaternion, context });
        }
    };
}

describe('SpatialQuaternionSceneBinder', () => {
    let bridge;
    let synchronizer;

    beforeEach(() => {
        bridge = createBridgeStub();
        synchronizer = createSynchronizerStub();
    });

    it('subscribes to composite wearable events and drives synchronizer updates', () => {
        const binder = new SpatialQuaternionSceneBinder({ bridge, synchronizer }).attach();

        binder.loadTrace([DEMO_AR_VISOR_SPATIAL_TRACE[0]]);
        binder.playTrace({ loop: false, interval: 10 });

        expect(synchronizer.calls.length).toBeGreaterThan(0);
        const update = synchronizer.calls[0];
        expect(update.quaternion).toBeDefined();
        expect(update.context?.source).toBe('spatial.multi-device');
        binder.detach();
    });

    it('merges multi-device frames and emits observer notifications', () => {
        const binder = new SpatialQuaternionSceneBinder({ bridge, synchronizer });
        const updates = [];
        binder.addObserver(payload => updates.push(payload));
        binder.attach();

        const [alpha, beta] = DEMO_AR_VISOR_SPATIAL_TRACE;
        bridge.processSample('wearable.ar-visor', { confidence: 0.9, payload: alpha });
        bridge.processSample('wearable.ar-visor', { confidence: 0.88, payload: beta });

        expect(updates.length).toBeGreaterThanOrEqual(2);
        const latest = updates.at(-1);
        expect(latest?.multiDeviceCluster?.deviceCount).toBeGreaterThanOrEqual(2);
        expect(latest?.multiDeviceCluster?.dominantDeviceId).toBeTruthy();
        expect(synchronizer.calls.length).toBeGreaterThanOrEqual(2);
        binder.detach();
    });
});
