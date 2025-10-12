import {
    blendAnchorCluster,
    blendHitTestCluster,
    mergeDeviceClusters
} from './QuaternionClusterToolkit.js';

const DEFAULT_INTERVAL = 180;

export class SpatialQuaternionSceneBinder {
    constructor(options = {}) {
        const {
            bridge,
            synchronizer,
            logger = console,
            anchorReducer = blendAnchorCluster,
            hitTestReducer = blendHitTestCluster
        } = options;

        if (!bridge || typeof bridge.subscribe !== 'function' || typeof bridge.processSample !== 'function') {
            throw new Error('SpatialQuaternionSceneBinder requires a SensoryInputBridge instance');
        }
        if (!synchronizer || typeof synchronizer.applyOrientation !== 'function') {
            throw new Error('SpatialQuaternionSceneBinder requires a ShaderQuaternionSynchronizer instance');
        }

        this.bridge = bridge;
        this.synchronizer = synchronizer;
        this.logger = logger;
        this.anchorReducer = anchorReducer;
        this.hitTestReducer = hitTestReducer;

        this.deviceSnapshots = new Map();
        this.trace = [];
        this.traceIndex = 0;
        this.traceTimer = null;
        this.subscription = null;
        this.observers = new Set();

        this.handleComposite = this.handleComposite.bind(this);
    }

    attach() {
        if (this.subscription) {
            return this;
        }
        this.subscription = this.bridge.subscribe('wearable.ar-visor', this.handleComposite);
        return this;
    }

    detach() {
        if (this.subscription) {
            try {
                this.subscription();
            } catch (error) {
                this.logger?.warn?.('[SpatialQuaternionSceneBinder] unsubscribe failed', error);
            }
            this.subscription = null;
        }
        this.stopTrace();
    }

    loadTrace(frames = []) {
        this.trace = Array.isArray(frames) ? frames.slice() : [];
        this.traceIndex = 0;
        return this;
    }

    playTrace(options = {}) {
        const { loop = true, interval = DEFAULT_INTERVAL } = options;
        if (!Array.isArray(this.trace) || this.trace.length === 0) {
            this.logger?.warn?.('[SpatialQuaternionSceneBinder] No trace frames loaded');
            return () => {};
        }

        this.stopTrace();

        const tick = () => {
            const frame = this.trace[this.traceIndex];
            if (frame) {
                try {
                    const payload = this.buildCompositePayload(frame);
                    this.bridge.processSample('wearable.ar-visor', {
                        confidence: frame.confidence ?? 0.85,
                        payload
                    });
                } catch (error) {
                    this.logger?.warn?.('[SpatialQuaternionSceneBinder] failed to process trace frame', error);
                }
            }

            this.traceIndex += 1;
            if (this.traceIndex >= this.trace.length) {
                if (loop) {
                    this.traceIndex = 0;
                } else {
                    this.stopTrace();
                    return;
                }
            }

            this.traceTimer = setTimeout(tick, interval);
        };

        tick();
        return () => this.stopTrace();
    }

    stopTrace() {
        if (this.traceTimer) {
            clearTimeout(this.traceTimer);
            this.traceTimer = null;
        }
    }

    addObserver(observer) {
        if (typeof observer === 'function') {
            this.observers.add(observer);
            return () => this.removeObserver(observer);
        }
        return () => {};
    }

    removeObserver(observer) {
        if (typeof observer === 'function') {
            this.observers.delete(observer);
        }
    }

    notifyObservers(payload) {
        if (!this.observers.size) {
            return;
        }
        for (const observer of this.observers) {
            try {
                observer(payload);
            } catch (error) {
                this.logger?.warn?.('[SpatialQuaternionSceneBinder] observer failed', error);
            }
        }
    }

    getSnapshot() {
        const devices = Array.from(this.deviceSnapshots.values());
        return {
            devices,
            multiDeviceCluster: mergeDeviceClusters(devices) || null
        };
    }

    handleComposite(event = {}) {
        const payload = event.payload;
        if (!payload || typeof payload !== 'object') {
            return;
        }

        const channels = payload.channels || {};
        const deviceId = payload.deviceId || 'wearable.ar-visor';

        let anchorCluster = null;
        const anchorChannel = channels['spatial.anchors'];
        if (anchorChannel?.payload?.anchors?.length) {
            anchorCluster = this.anchorReducer(anchorChannel.payload.anchors, {
                space: anchorChannel.payload.space || null
            });
        }

        let hitTestCluster = null;
        const hitChannel = channels['spatial.hit-tests'];
        if (hitChannel?.payload?.results?.length) {
            hitTestCluster = this.hitTestReducer(hitChannel.payload.results, {
                space: hitChannel.payload.space || null
            });
        }

        const snapshot = {
            deviceId,
            anchorCluster,
            hitTestCluster,
            poseOrientation: payload.metadata?.pose?.orientation || null,
            posePosition: payload.metadata?.pose?.position || null,
            lastTimestamp: event.timestamp || Date.now(),
            lastConfidence: event.confidence ?? anchorCluster?.confidence ?? hitTestCluster?.confidence ?? 0.5
        };

        this.deviceSnapshots.set(deviceId, snapshot);

        const aggregate = mergeDeviceClusters(Array.from(this.deviceSnapshots.values()));
        if (aggregate) {
            let latestTimestamp = snapshot.lastTimestamp;
            for (const deviceSnapshot of this.deviceSnapshots.values()) {
                if (deviceSnapshot?.lastTimestamp && deviceSnapshot.lastTimestamp > latestTimestamp) {
                    latestTimestamp = deviceSnapshot.lastTimestamp;
                }
            }
            aggregate.timestamp = latestTimestamp;
        }
        if (aggregate && aggregate.orientation) {
            this.synchronizer.applyOrientation(aggregate.orientation, {
                confidence: aggregate.confidence,
                timestamp: aggregate.timestamp || snapshot.lastTimestamp,
                source: 'spatial.multi-device',
                metadata: { multiDeviceCluster: aggregate }
            });
        }

        this.notifyObservers({
            deviceId,
            deviceSnapshot: snapshot,
            multiDeviceCluster: aggregate
        });
    }

    buildCompositePayload(frame) {
        const {
            deviceId = 'wearable.ar-visor',
            timestamp = Date.now(),
            anchors = [],
            hitTests = [],
            gaze = { x: 0.5, y: 0.5, depth: 0.5 },
            ambient = { luminance: 0.5, noiseLevel: 0.2, motion: 0.15 },
            gesture = { intent: 'none', vector: { x: 0, y: 0, z: 0 } },
            planes = [],
            depth,
            poseOrientation
        } = frame || {};

        const anchorSpace = frame.anchorSpace || { type: 'local-floor', id: 'demo-lab' };
        const hitSpace = frame.hitTestSpace || { type: 'viewer', id: 'demo-lab' };

        return {
            deviceId,
            timestamp,
            channels: {
                'eye-tracking': {
                    confidence: frame.gazeConfidence ?? 0.82,
                    payload: {
                        x: Number(gaze.x) || 0.5,
                        y: Number(gaze.y) || 0.5,
                        depth: Number(gaze.depth) || 0.45
                    }
                },
                'spatial.anchors': {
                    confidence: frame.anchorConfidence ?? 0.8,
                    payload: {
                        space: anchorSpace,
                        anchors
                    }
                },
                'spatial.hit-tests': {
                    confidence: frame.hitConfidence ?? 0.78,
                    payload: {
                        space: hitSpace,
                        results: hitTests
                    }
                },
                'spatial.planes': {
                    confidence: frame.planeConfidence ?? 0.72,
                    payload: {
                        timestamp,
                        space: anchorSpace,
                        planes
                    }
                },
                'spatial.depth': depth ? {
                    confidence: frame.depthConfidence ?? 0.68,
                    payload: depth
                } : undefined,
                ambient: {
                    confidence: frame.ambientConfidence ?? 0.6,
                    payload: ambient
                },
                gesture: {
                    confidence: frame.gestureConfidence ?? 0.55,
                    payload: gesture
                }
            },
            metadata: {
                pose: poseOrientation ? {
                    orientation: poseOrientation,
                    position: frame.posePosition || null
                } : undefined
            }
        };
    }
}

export default SpatialQuaternionSceneBinder;
