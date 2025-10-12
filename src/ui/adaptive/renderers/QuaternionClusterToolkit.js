const EPSILON = 1e-9;

const identityQuaternion = () => ({ x: 0, y: 0, z: 0, w: 1 });

function normalizeQuaternion(quaternion) {
    if (!quaternion || typeof quaternion !== 'object') {
        return null;
    }
    const x = Number(quaternion.x) || 0;
    const y = Number(quaternion.y) || 0;
    const z = Number(quaternion.z) || 0;
    const w = Number.isFinite(quaternion.w) ? Number(quaternion.w) : Math.sqrt(Math.max(0, 1 - (x * x + y * y + z * z)));
    const length = Math.hypot(x, y, z, w);
    if (length < EPSILON) {
        return null;
    }
    return { x: x / length, y: y / length, z: z / length, w: w / length };
}

function dotQuaternion(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

function alignHemisphere(reference, quaternion) {
    return dotQuaternion(reference, quaternion) < 0
        ? { x: -quaternion.x, y: -quaternion.y, z: -quaternion.z, w: -quaternion.w }
        : quaternion;
}

export function averageQuaternionSamples(samples = [], options = {}) {
    const { fallbackIdentity = true } = options;
    let reference = null;
    let accumX = 0;
    let accumY = 0;
    let accumZ = 0;
    let accumW = 0;
    let totalWeight = 0;
    let count = 0;

    for (const sample of samples) {
        if (!sample) continue;
        const orientation = sample.orientation || sample.quaternion;
        const weight = Math.max(0, Number(sample.weight ?? sample.confidence ?? 1));
        if (!orientation || weight <= 0) {
            continue;
        }
        const normalized = normalizeQuaternion(orientation);
        if (!normalized) {
            continue;
        }
        const aligned = reference ? alignHemisphere(reference, normalized) : normalized;
        if (!reference) {
            reference = aligned;
        }
        accumX += aligned.x * weight;
        accumY += aligned.y * weight;
        accumZ += aligned.z * weight;
        accumW += aligned.w * weight;
        totalWeight += weight;
        count += 1;
    }

    if (totalWeight <= EPSILON || count === 0) {
        return fallbackIdentity ? identityQuaternion() : null;
    }

    const length = Math.hypot(accumX, accumY, accumZ, accumW);
    if (length <= EPSILON) {
        return fallbackIdentity ? identityQuaternion() : null;
    }

    return {
        x: accumX / length,
        y: accumY / length,
        z: accumZ / length,
        w: accumW / length
    };
}

export function blendAnchorCluster(anchors = [], options = {}) {
    if (!Array.isArray(anchors) || anchors.length === 0) {
        return null;
    }

    const samples = [];
    let sumConfidence = 0;
    let totalWeight = 0;
    let count = 0;
    let positionX = 0;
    let positionY = 0;
    let positionZ = 0;

    for (const anchor of anchors) {
        const pose = anchor?.pose;
        const orientation = pose?.orientation;
        if (!orientation) {
            continue;
        }
        const confidence = Math.max(0, Math.min(1, Number(anchor?.confidence ?? pose?.confidence ?? 0.5)));
        const weight = confidence > 0 ? confidence : 0.0001;

        samples.push({ orientation, weight, confidence });
        if (pose?.position) {
            positionX += Number(pose.position.x) * weight || 0;
            positionY += Number(pose.position.y) * weight || 0;
            positionZ += Number(pose.position.z) * weight || 0;
        }
        sumConfidence += confidence * weight;
        totalWeight += weight;
        count += 1;
    }

    if (samples.length === 0 || totalWeight <= EPSILON) {
        return null;
    }

    const orientation = averageQuaternionSamples(samples);
    if (!orientation) {
        return null;
    }

    const avgConfidence = Math.max(0, Math.min(1, sumConfidence / totalWeight));
    const blendedPosition = {
        x: positionX / totalWeight,
        y: positionY / totalWeight,
        z: positionZ / totalWeight
    };

    let variance = 0;
    for (const sample of samples) {
        const normalized = normalizeQuaternion(sample.orientation);
        if (!normalized) continue;
        const dot = Math.abs(dotQuaternion(orientation, normalized));
        variance += (1 - dot) * sample.weight;
    }
    variance = variance / totalWeight;

    return {
        orientation,
        confidence: avgConfidence,
        weight: totalWeight,
        sampleCount: count,
        position: blendedPosition,
        variance,
        space: options.space || null
    };
}

export function blendHitTestCluster(results = [], options = {}) {
    if (!Array.isArray(results) || results.length === 0) {
        return null;
    }

    const { distanceFalloff = 0.01 } = options;
    const samples = [];
    let totalWeight = 0;
    let sumConfidence = 0;
    let sumDistance = 0;
    let positionX = 0;
    let positionY = 0;
    let positionZ = 0;
    let count = 0;

    for (const result of results) {
        const pose = result?.pose;
        const orientation = pose?.orientation;
        if (!orientation) {
            continue;
        }
        const confidence = Math.max(0, Math.min(1, Number(result?.confidence ?? 0.5)));
        const distance = Math.max(0, Number(result?.distance ?? 0));
        const weight = Math.max(EPSILON, confidence - distance * distanceFalloff);

        samples.push({ orientation, weight, confidence });
        if (pose?.position) {
            positionX += Number(pose.position.x) * weight || 0;
            positionY += Number(pose.position.y) * weight || 0;
            positionZ += Number(pose.position.z) * weight || 0;
        }
        sumConfidence += confidence * weight;
        sumDistance += distance * weight;
        totalWeight += weight;
        count += 1;
    }

    if (samples.length === 0 || totalWeight <= EPSILON) {
        return null;
    }

    const orientation = averageQuaternionSamples(samples);
    if (!orientation) {
        return null;
    }

    const blendedPosition = {
        x: positionX / totalWeight,
        y: positionY / totalWeight,
        z: positionZ / totalWeight
    };

    let variance = 0;
    for (const sample of samples) {
        const normalized = normalizeQuaternion(sample.orientation);
        if (!normalized) continue;
        const dot = Math.abs(dotQuaternion(orientation, normalized));
        variance += (1 - dot) * sample.weight;
    }
    variance = variance / totalWeight;

    return {
        orientation,
        confidence: Math.max(0, Math.min(1, sumConfidence / totalWeight)),
        averageDistance: sumDistance / totalWeight,
        weight: totalWeight,
        sampleCount: count,
        position: blendedPosition,
        variance,
        space: options.space || null
    };
}

export function mergeDeviceClusters(clusters = [], options = {}) {
    if (!Array.isArray(clusters) || clusters.length === 0) {
        return null;
    }

    const { fallbackIdentity = true } = options;

    const samples = [];
    const summaries = [];

    let totalWeight = 0;
    let totalConfidence = 0;
    let positionX = 0;
    let positionY = 0;
    let positionZ = 0;
    let sampleCount = 0;
    let dominant = null;

    for (const entry of clusters) {
        if (!entry) continue;

        const orientation = entry.anchorCluster?.orientation
            || entry.hitTestCluster?.orientation
            || entry.poseOrientation
            || entry.orientation
            || null;

        if (!orientation) {
            continue;
        }

        const weight = Math.max(
            EPSILON,
            Number(entry.anchorCluster?.weight)
                || Number(entry.hitTestCluster?.weight)
                || Number(entry.anchorCluster?.confidence)
                || Number(entry.hitTestCluster?.confidence)
                || Number(entry.lastConfidence)
                || 0.5
        );

        const confidence = Math.max(0, Math.min(1, Number(
            entry.anchorCluster?.confidence
                ?? entry.hitTestCluster?.confidence
                ?? entry.lastConfidence
                ?? entry.confidence
                ?? 0.5
        )));

        samples.push({ orientation, weight, confidence });
        totalWeight += weight;
        totalConfidence += confidence * weight;
        sampleCount += 1;

        const positionSource = entry.anchorCluster?.position
            || entry.hitTestCluster?.position
            || entry.posePosition
            || null;
        if (positionSource) {
            positionX += Number(positionSource.x) * weight || 0;
            positionY += Number(positionSource.y) * weight || 0;
            positionZ += Number(positionSource.z) * weight || 0;
        }

        if (!dominant || weight > dominant.weight) {
            dominant = {
                deviceId: entry.deviceId ?? null,
                weight,
                confidence
            };
        }

        summaries.push({
            deviceId: entry.deviceId ?? null,
            anchor: entry.anchorCluster ? {
                confidence: entry.anchorCluster.confidence ?? null,
                variance: entry.anchorCluster.variance ?? null
            } : null,
            hitTest: entry.hitTestCluster ? {
                confidence: entry.hitTestCluster.confidence ?? null,
                variance: entry.hitTestCluster.variance ?? null,
                averageDistance: entry.hitTestCluster.averageDistance ?? null
            } : null,
            weight,
            confidence
        });
    }

    if (samples.length === 0 || totalWeight <= EPSILON) {
        return fallbackIdentity ? {
            orientation: identityQuaternion(),
            confidence: 0,
            variance: 1,
            deviceCount: 0,
            weight: 0,
            position: null,
            sampleCount: 0,
            dominantDeviceId: null,
            sources: []
        } : null;
    }

    const orientation = averageQuaternionSamples(samples, { fallbackIdentity });
    if (!orientation) {
        return null;
    }

    let variance = 0;
    for (const sample of samples) {
        const normalized = normalizeQuaternion(sample.orientation);
        if (!normalized) continue;
        const dot = Math.abs(dotQuaternion(orientation, normalized));
        variance += (1 - dot) * sample.weight;
    }
    variance = variance / totalWeight;

    const position = totalWeight > EPSILON
        ? {
            x: positionX / totalWeight,
            y: positionY / totalWeight,
            z: positionZ / totalWeight
        }
        : null;

    return {
        orientation,
        confidence: Math.max(0, Math.min(1, totalConfidence / totalWeight)),
        variance,
        deviceCount: sampleCount,
        weight: totalWeight,
        position,
        sampleCount,
        dominantDeviceId: dominant?.deviceId ?? null,
        sources: summaries
    };
}

export const QuaternionClusterToolkit = {
    averageQuaternionSamples,
    blendAnchorCluster,
    blendHitTestCluster,
    mergeDeviceClusters
};

export default QuaternionClusterToolkit;
