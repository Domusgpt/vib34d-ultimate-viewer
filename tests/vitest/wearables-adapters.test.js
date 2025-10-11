import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SensorSchemaRegistry } from '../../src/ui/adaptive/sensors/SensorSchemaRegistry.js';
import { SensoryInputBridge } from '../../src/ui/adaptive/SensoryInputBridge.js';
import { WearableDeviceManager } from '../../src/ui/adaptive/sensors/WearableDeviceManager.js';
import { BiometricWristWearableAdapter } from '../../src/ui/adaptive/sensors/adapters/BiometricWristWearableAdapter.js';
import { ARVisorWearableAdapter } from '../../src/ui/adaptive/sensors/adapters/ARVisorWearableAdapter.js';
import { LicenseManager } from '../../src/product/licensing/LicenseManager.js';

describe('Wearable sensor schemas', () => {
    let registry;

    beforeEach(() => {
        registry = new SensorSchemaRegistry();
    });

    it('normalizes AR visor payloads and reports range violations', () => {
        const result = registry.validate('wearable.ar-visor', {
            deviceId: 'visor-alpha',
            gaze: { x: 1.4, y: -0.3, depth: 0.9, vergence: 6.2, stability: -0.4 },
            environment: { luminance: 1.3, noiseLevel: -0.1, motion: 0.4, temperature: 82 },
            gesture: { intent: 'swipe-right', vector: { x: 1.4, y: -1.2, z: 0.8 } },
            fieldOfView: { horizontal: 190, vertical: 15, diagonal: 220 },
            batteryLevel: 1.2,
            deviceTemperature: 92,
            uptimeSeconds: -5
        });

        const eye = result.payload.channels['eye-tracking'];
        expect(eye.confidence).toBeCloseTo(0.82, 5);
        expect(eye.payload.x).toBeLessThanOrEqual(1);
        expect(eye.payload.y).toBeGreaterThanOrEqual(0);
        expect(eye.payload.vergence).toBeLessThanOrEqual(5);

        const ambient = result.payload.channels.ambient;
        expect(ambient.payload.luminance).toBeLessThanOrEqual(1);
        expect(ambient.payload.noiseLevel).toBeGreaterThanOrEqual(0);
        expect(ambient.payload.temperature).toBeLessThanOrEqual(60);

        const gesture = result.payload.channels.gesture;
        expect(gesture.payload.vector.x).toBeLessThanOrEqual(1);
        expect(gesture.payload.vector.y).toBeGreaterThanOrEqual(-1);

        const metadata = result.payload.metadata;
        expect(metadata.batteryLevel).toBeLessThanOrEqual(1);
        expect(metadata.deviceTemperature).toBeLessThanOrEqual(90);
        expect(metadata.uptimeSeconds).toBeGreaterThanOrEqual(0);
        expect(metadata.fieldOfView.horizontal).toBeLessThanOrEqual(160);
        expect(metadata.fieldOfView.vertical).toBeGreaterThanOrEqual(30);

        const issueFields = result.issues.map(issue => issue.field);
        expect(issueFields).toContain('channels.eye-tracking.vergence');
        expect(issueFields).toContain('channels.ambient.luminance');
        expect(issueFields).toContain('metadata.batteryLevel');
    });

    it('normalizes spatial schemas for planes, depth, hit tests, and anchors', () => {
        const planes = registry.validate('spatial.scene-planes', {
            timestamp: 120,
            space: { type: 'local-floor', id: 'room-1' },
            planes: [
                {
                    id: 'plane-1',
                    space: 'local-floor',
                    pose: {
                        position: { x: 1, y: 1.4, z: 0.5 },
                        orientation: { x: 0, y: 0, z: 0, w: 1 }
                    },
                    alignment: 'horizontal',
                    extent: { width: 2.5, height: 1.5 },
                    polygon: [
                        { x: 0, y: 0, z: 0 },
                        { x: 1, y: 0, z: 0 },
                        { x: 1, y: 0, z: 1 }
                    ],
                    classification: 'floor',
                    lastChangedTime: 110
                }
            ],
            removedIds: ['stale-plane']
        });

        expect(planes.payload.planes[0].alignment).toBe('horizontal');
        expect(planes.payload.planes[0].polygon?.length).toBe(3);
        expect(planes.payload.removedIds).toEqual(['stale-plane']);
        expect(planes.issues).toHaveLength(0);

        const depth = registry.validate('spatial.depth-buffer', {
            timestamp: 130,
            space: { type: 'viewer', id: 'viewer-1' },
            format: 'r16u',
            width: 256,
            height: 192,
            rawValueToMeters: 0.001,
            near: -2,
            far: 3000,
            buffer: { type: 'cpu', handle: 'buffer-1' },
            intrinsics: { fx: 450.5, fy: 449.9 },
            confidence: 1.2
        });

        expect(depth.payload.buffer.type).toBe('cpu');
        expect(depth.payload.near).toBeGreaterThanOrEqual(0);
        expect(depth.payload.far).toBeLessThanOrEqual(1000);
        expect(depth.payload.confidence).toBeLessThanOrEqual(1);
        expect(depth.issues.find(issue => issue.field === 'near')).toBeDefined();
        expect(depth.issues.find(issue => issue.field === 'far')).toBeDefined();
        expect(depth.issues.find(issue => issue.field === 'confidence')).toBeDefined();

        const hitTests = registry.validate('spatial.hit-test-results', {
            timestamp: 140,
            space: 'viewer',
            results: [
                {
                    rayId: 'ray-1',
                    space: { type: 'local', id: 'origin' },
                    pose: {
                        position: { x: 0, y: 1, z: 2 },
                        orientation: { x: 0, y: 0, z: 0, w: 1 }
                    },
                    distance: 2.4,
                    timestamp: 140,
                    type: 'plane',
                    normal: { x: 0, y: 1, z: 0 },
                    anchors: ['anchor-1'],
                    inputSource: { handedness: 'left', profiles: ['touch'] },
                    confidence: 0.9
                }
            ]
        });

        expect(hitTests.payload.results).toHaveLength(1);
        expect(hitTests.payload.results[0].rayId).toBe('ray-1');
        expect(hitTests.payload.results[0].inputSource?.handedness).toBe('left');

        const anchors = registry.validate('spatial.anchors', {
            timestamp: 150,
            space: 'local',
            anchors: [
                {
                    id: 'anchor-1',
                    space: { type: 'local', id: 'origin' },
                    pose: {
                        position: { x: 0.2, y: 0.5, z: 0.8 },
                        orientation: { x: 0, y: 0, z: 0, w: 1 }
                    },
                    classification: 'desk',
                    lastChangedTime: 150
                }
            ]
        });

        expect(anchors.payload.anchors[0].classification).toBe('unknown');
        expect(anchors.issues.some(issue => issue.field === 'anchors.0.classification')).toBe(true);
    });

    it('injects spatial channels into AR visor composite normalization', () => {
        const result = registry.validate('wearable.ar-visor', {
            deviceId: 'visor-gamma',
            gaze: { x: 0.45, y: 0.55, depth: 0.38 },
            gesture: { intent: 'tap', vector: { x: 0.01, y: 0.02, z: -0.03 } },
            environment: { luminance: 0.5, noiseLevel: 0.2, motion: 0.1 },
            spatial: {
                planes: {
                    timestamp: 200,
                    space: { type: 'local-floor', id: 'room-2' },
                    planes: [
                        {
                            id: 'plane-1',
                            space: 'local-floor',
                            pose: {
                                position: { x: 0, y: 0, z: 0 },
                                orientation: { x: 0, y: 0, z: 0, w: 1 }
                            },
                            alignment: 'horizontal',
                            extent: { width: 3, height: 2 },
                            polygon: [
                                { x: 0, y: 0, z: 0 },
                                { x: 1, y: 0, z: 0 },
                                { x: 1, y: 0, z: 1 }
                            ],
                            lastChangedTime: 200
                        }
                    ]
                },
                depth: {
                    timestamp: 200,
                    space: 'viewer',
                    format: 'r16u',
                    width: 128,
                    height: 128,
                    rawValueToMeters: 0.001,
                    buffer: { type: 'cpu', handle: 'depth-buffer' }
                },
                hitTests: {
                    timestamp: 200,
                    space: 'viewer',
                    results: [
                        {
                            rayId: 'ray-1',
                            space: 'local',
                            pose: {
                                position: { x: 0, y: 1, z: 0 },
                                orientation: { x: 0, y: 0, z: 0, w: 1 }
                            },
                            distance: 1.2,
                            timestamp: 200
                        }
                    ]
                },
                anchors: {
                    timestamp: 200,
                    space: 'local',
                    anchors: [
                        {
                            id: 'anchor-1',
                            space: 'local',
                            pose: {
                                position: { x: 0.1, y: 0.4, z: 0.2 },
                                orientation: { x: 0, y: 0, z: 0, w: 1 }
                            },
                            lastChangedTime: 200
                        }
                    ]
                }
            }
        });

        const planesChannel = result.payload.channels['spatial.planes'];
        expect(planesChannel).toBeDefined();
        expect(planesChannel.payload.planes[0].space.type).toBe('local-floor');
        expect(planesChannel.confidence).toBeCloseTo(0.78, 2);

        const depthChannel = result.payload.channels['spatial.depth'];
        expect(depthChannel.payload.format).toBe('r16u');
        expect(depthChannel.confidence).toBeCloseTo(0.72, 2);

        const hitTestChannel = result.payload.channels['spatial.hit-tests'];
        expect(hitTestChannel.payload.results).toHaveLength(1);

        const anchorChannel = result.payload.channels['spatial.anchors'];
        expect(anchorChannel.payload.anchors[0].id).toBe('anchor-1');
        expect(anchorChannel.confidence).toBeCloseTo(0.76, 2);
    });
});

describe('SensoryInputBridge wearable multiplexing', () => {
    it('routes wearable payloads into semantic channels and emits metadata events', () => {
        const bridge = new SensoryInputBridge({ autoConnectAdapters: false, confidenceThreshold: 0 });
        let metadataEvent = null;
        bridge.subscribe('wearable.ar-visor:metadata', event => {
            metadataEvent = event;
        });

        const payload = {
            deviceId: 'visor-beta',
            firmwareVersion: '2.0.1',
            channels: {
                'eye-tracking': { confidence: 0.9, payload: { x: 0.35, y: 0.62, depth: 0.42 } },
                ambient: { confidence: 0.5, payload: { luminance: 0.58, noiseLevel: 0.24, motion: 0.16 } },
                gesture: { confidence: 0.61, payload: { intent: 'tap', vector: { x: 0.1, y: 0.2, z: -0.05 } } }
            },
            metadata: { batteryLevel: 0.82 }
        };

        bridge.processSample('wearable.ar-visor', { confidence: 0.94, payload });

        const snapshot = bridge.getSnapshot();
        const expectedFocusX = 0.5 + (0.35 - 0.5) * 0.9;
        const expectedFocusY = 0.5 + (0.62 - 0.5) * 0.9;
        const expectedLuminance = 0.5 + (0.58 - 0.5) * 0.5;

        expect(snapshot.focusVector.x).toBeCloseTo(expectedFocusX, 5);
        expect(snapshot.focusVector.y).toBeCloseTo(expectedFocusY, 5);
        expect(snapshot.environment.luminance).toBeCloseTo(expectedLuminance, 5);
        expect(snapshot.gestureIntent).toBe('tap');

        expect(metadataEvent).toMatchObject({
            deviceId: 'visor-beta',
            firmwareVersion: '2.0.1',
            metadata: expect.objectContaining({ batteryLevel: 0.82 }),
            confidence: 0.94,
            timestamp: expect.any(Number)
        });
    });
});

describe('Wearable adapters', () => {
    it('enforces licensing before streaming biometric wrist samples', async () => {
        const telemetry = {
            track: vi.fn(),
            recordAudit: vi.fn()
        };
        const licenseManager = new LicenseManager();

        const adapter = new BiometricWristWearableAdapter({
            telemetry,
            licenseManager,
            deviceId: 'wrist-01',
            trace: [
                {
                    vitals: { stress: 0.44, heartRate: 72, temperature: 37.4, oxygen: 0.97, hrv: 54 },
                    environment: { luminance: 0.32, noiseLevel: 0.18, motion: 0.2, temperature: 24, humidity: 0.41 },
                    quality: { overall: 0.91, vitals: 0.9, environment: 0.6 },
                    batteryLevel: 0.76,
                    skinContact: true
                }
            ]
        });

        const blocked = await adapter.read();
        expect(blocked).toBeNull();
        expect(telemetry.recordAudit).toHaveBeenCalled();
        const auditPayload = telemetry.recordAudit.mock.calls[0][1];
        expect(auditPayload.reason).toBe('status');

        telemetry.recordAudit.mockClear();

        licenseManager.setLicense({ key: 'valid-key', features: ['wearables-biometric'] });
        await licenseManager.validate();

        const sample = await adapter.read();
        expect(sample?.payload.channels.biometric).toBeDefined();
        expect(sample?.payload.channels.biometric.payload.heartRate).toBe(72);
        expect(telemetry.track).toHaveBeenCalled();
        const trackCall = telemetry.track.mock.calls.find(([event]) => event.includes('wearable.biometric-wrist.sample'));
        expect(trackCall).toBeDefined();
        expect(trackCall[1].channels).toContain('biometric');
        expect(trackCall[2]).toEqual({ classification: 'system' });
        expect(telemetry.recordAudit).not.toHaveBeenCalled();
    });

    it('normalizes AR visor spatial traces into schema-ready payloads', () => {
        const adapter = new ARVisorWearableAdapter({
            deviceId: 'visor-spatial',
            defaultConfidence: 0.8
        });

        const raw = {
            deviceId: 'visor-spatial',
            channels: {
                'eye-tracking': {
                    payload: { x: 0.52, y: 0.47, depth: 0.36 },
                    confidence: 0.9
                },
                spatial: {
                    planes: {
                        payload: {
                            timestamp: 12,
                            space: { type: 'local-floor', id: 'room' },
                            planes: [
                                {
                                    id: 'plane-a',
                                    space: { type: 'local-floor', id: 'room' },
                                    pose: {
                                        position: { x: 0, y: 0, z: 0 },
                                        orientation: { x: 0, y: 0, z: 0, w: 1 }
                                    },
                                    alignment: 'horizontal',
                                    extent: { width: 3, height: 2 },
                                    polygon: [
                                        { x: 0, y: 0, z: 0 },
                                        { x: 3, y: 0, z: 0 },
                                        { x: 3, y: 0, z: 2 }
                                    ],
                                    lastChangedTime: 12
                                }
                            ]
                        },
                        confidence: 0.66
                    }
                }
            },
            spatial: {
                depth: {
                    timestamp: 12,
                    space: 'viewer',
                    format: 'r16u',
                    width: 128,
                    height: 128,
                    rawValueToMeters: 0.001,
                    buffer: { type: 'cpu', handle: 'depth-buffer' },
                    confidence: 1.2
                }
            },
            scene: {
                hitTests: {
                    timestamp: 12,
                    space: { type: 'viewer' },
                    results: [
                        {
                            rayId: 'ray-alpha',
                            space: { type: 'local', id: 'origin' },
                            pose: {
                                position: { x: 0, y: 1, z: 0 },
                                orientation: { x: 0, y: 0, z: 0, w: 1 }
                            },
                            distance: 1.1,
                            timestamp: 12
                        }
                    ]
                },
                anchors: {
                    timestamp: 12,
                    space: { type: 'local' },
                    anchors: [
                        {
                            id: 'anchor-a',
                            space: { type: 'local', id: 'origin' },
                            pose: {
                                position: { x: 0.1, y: 0.2, z: 0.3 },
                                orientation: { x: 0, y: 0, z: 0, w: 1 }
                            },
                            lastChangedTime: 12
                        }
                    ]
                }
            },
            quality: {
                overall: 0.64,
                scene: 0.7,
                scenePlanes: 0.68,
                depth: 0.73,
                hitTests: 0.72,
                anchors: 0.74
            },
            sceneConfidence: 0.71
        };

        const normalized = adapter.normalizeSample(raw);
        expect(normalized.confidence).toBeCloseTo(0.64, 5);
        expect(normalized.payload.deviceId).toBe('visor-spatial');
        expect(normalized.payload.spatial?.planes?.confidence).toBeCloseTo(0.66, 5);
        expect(normalized.payload.spatial?.depth?.confidence).toBeLessThanOrEqual(1);
        expect(normalized.payload.spatial?.hitTests?.payload?.results).toHaveLength(1);
        expect(normalized.payload.spatial?.anchors?.payload?.anchors).toHaveLength(1);

        const registry = new SensorSchemaRegistry();
        const { payload: sanitized, issues } = registry.validate('wearable.ar-visor', normalized.payload);

        expect(issues).toHaveLength(0);
        expect(sanitized.channels['spatial.planes'].payload.planes).toHaveLength(1);
        expect(sanitized.channels['spatial.depth'].payload.format).toBe('r16u');
        expect(sanitized.channels['spatial.hit-tests'].payload.results).toHaveLength(1);
        expect(sanitized.channels['spatial.anchors'].payload.anchors).toHaveLength(1);
    });
});

describe('SensoryInputBridge history and wearable snapshots', () => {
    it('retains bounded channel history and publishes wearable snapshots', () => {
        const bridge = new SensoryInputBridge({
            autoConnectAdapters: false,
            confidenceThreshold: 0,
            channelHistoryLimit: 2
        });

        bridge.processSample('eye-tracking', { confidence: 0.9, payload: { x: 0.1, y: 0.2, depth: 0.3 } });
        bridge.processSample('eye-tracking', { confidence: 0.9, payload: { x: 0.4, y: 0.5, depth: 0.6 } });
        bridge.processSample('eye-tracking', { confidence: 0.9, payload: { x: 0.8, y: 0.9, depth: 0.2 } });

        const history = bridge.getChannelHistory('eye-tracking');
        expect(history).toHaveLength(2);
        expect(history[0].payload.x).toBeCloseTo(0.4, 5);
        expect(history[1].payload.x).toBeCloseTo(0.8, 5);

        const wearablePayload = {
            deviceId: 'visor-history',
            channels: {
                'eye-tracking': { confidence: 0.6, payload: { x: 0.25, y: 0.5, depth: 0.4 } }
            },
            metadata: { batteryLevel: 0.9 }
        };

        const updates = [];
        const globalUpdates = [];
        bridge.subscribe('wearable.ar-visor:update', snapshot => updates.push(snapshot));
        bridge.subscribe('wearable:update', snapshot => globalUpdates.push(snapshot));

        bridge.processSample('wearable.ar-visor', { confidence: 0.82, payload: wearablePayload });

        const snapshot = bridge.getWearableSnapshot('wearable.ar-visor', 'visor-history');
        expect(snapshot?.channels['eye-tracking'].payload.x).toBeCloseTo(0.25, 5);
        expect(snapshot?.metadata?.batteryLevel).toBeCloseTo(0.9, 5);
        expect(bridge.listWearableDevices('wearable.ar-visor')).toContain('visor-history');

        const wearableHistory = bridge.getWearableHistory('wearable.ar-visor');
        expect(wearableHistory).toHaveLength(1);
        expect(wearableHistory[0].composite.channels['eye-tracking'].payload.depth).toBeCloseTo(0.4, 5);

        expect(updates).toHaveLength(1);
        expect(globalUpdates).toHaveLength(1);
        expect(globalUpdates[0].type).toBe('wearable.ar-visor');
    });
});

describe('WearableDeviceManager orchestration', () => {
    it('relays composite updates to subscribers and exposes snapshots', () => {
        const bridge = new SensoryInputBridge({
            autoConnectAdapters: false,
            confidenceThreshold: 0,
            channelHistoryLimit: 3
        });
        const manager = new WearableDeviceManager({ bridge });

        const adapter = {
            read: vi.fn()
        };
        manager.registerAdapter('wearable.neural-band', adapter);

        const updates = [];
        const unsubscribe = manager.subscribeToDevice('wearable.neural-band', 'band-x', snapshot => {
            updates.push(snapshot);
        });

        manager.ingest('wearable.neural-band', {
            deviceId: 'band-x',
            channels: {
                'neural-intent': {
                    confidence: 0.85,
                    payload: { x: 0.12, y: -0.1, z: 0.05, w: 0.9, engagement: 0.75 }
                }
            },
            metadata: { signalQuality: { overall: 0.92 } }
        }, 0.88);

        expect(updates).toHaveLength(1);
        expect(updates[0].type).toBe('wearable.neural-band');
        expect(updates[0].metadata.signalQuality.overall).toBeCloseTo(0.92, 5);

        const snapshot = manager.getDeviceSnapshot('wearable.neural-band', 'band-x');
        expect(snapshot).not.toBeNull();
        expect(snapshot.channels['neural-intent'].payload.w).toBeCloseTo(0.9, 5);

        unsubscribe();

        manager.ingest('wearable.neural-band', {
            deviceId: 'band-x',
            channels: {
                'neural-intent': {
                    confidence: 0.5,
                    payload: { x: 0.3, y: 0.1, z: 0.15, w: 0.6, engagement: 0.5 }
                }
            }
        }, 0.6);

        expect(updates).toHaveLength(1);
        expect(manager.listDevices('wearable.neural-band')).toContain('band-x');

        const history = manager.getDeviceHistory('wearable.neural-band');
        expect(history.length).toBeGreaterThanOrEqual(2);
        expect(history[history.length - 1].composite.channels['neural-intent'].payload.w).toBeCloseTo(0.6, 5);
    });
});

