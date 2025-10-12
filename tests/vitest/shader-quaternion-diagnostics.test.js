import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ShaderQuaternionSynchronizer } from '../../src/ui/adaptive/renderers/ShaderQuaternionSynchronizer.js';
import { ShaderQuaternionDiagnosticsOverlay } from '../../src/ui/adaptive/renderers/ShaderQuaternionDiagnosticsOverlay.js';

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
    return {
        parameters,
        updateParameter(param, value) {
            parameters.set(param, value);
        }
    };
}

describe('ShaderQuaternionDiagnosticsOverlay', () => {
    let bridge;
    let container;

    beforeEach(() => {
        bridge = {
            subscribe() {
                return () => {};
            }
        };
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    it('renders quaternion telemetry from the synchronizer', () => {
        const quantum = createStubSystem({ rot4dXW: 0, rot4dYW: 0, rot4dZW: 0 });
        const sync = new ShaderQuaternionSynchronizer({
            bridge,
            systems: { quantum },
            baseAlpha: 1,
            rotationScale: 1,
            energySmoothing: 1
        });

        const overlay = new ShaderQuaternionDiagnosticsOverlay({
            synchronizer: sync,
            container,
            document
        });

        overlay.mount();

        const orientation = quaternionFromEuler(0.15, 0.25, -0.35);
        sync.applyOrientation(orientation, { confidence: 0.9, timestamp: 1000, source: 'spatial.pose' });

        const yaw = container.querySelector('[data-testid="shader-q-yaw"]');
        const params = container.querySelector('[data-testid="shader-q-params-quantum"]');
        const source = container.querySelector('[data-testid="shader-q-source"]');

        expect(yaw?.textContent).not.toBe('0.0°');
        expect(params?.textContent || '').toContain('rot4dXW');
        expect(source?.textContent).toBe('spatial.pose');

        overlay.unmount();
        expect(container.querySelector('[data-testid="shader-q-yaw"]')).toBeNull();
    });
});
