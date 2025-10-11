# WebXR Spatial Schema Deltas

## Purpose
This note captures the concrete schema updates our wearables runtime needs so the spatial data we ingest from devices can map directly to WebXR hit testing, plane detection, depth sensing, and anchor semantics. It complements the broader WebXR spatial integration plan by translating feature goals into specific payload structures that must be supported inside `SensorSchemaRegistry` and the wearable composites.

## Guiding Principles
- **WebXR Compatible Fields** – Each schema mirrors the data expected by WebXR (`XRHitTestResult`, `XRPlane`, `XRDepthInformation`, `XRAnchor`) so UI/web consumers can project the payloads into browser APIs with minimal transformation.
- **OpenXR-Friendly Spaces** – Space references always specify an OpenXR/WebXR-aligned reference space type and optional runtime-defined identifier, guaranteeing consistent spatial relationships.
- **Confidence & Tracking Metadata** – All schemas expose confidence/accuracy/tracking-state data so downstream systems can gate rendering.
- **Collection-Level Wrappers** – Wearable composites emit spatial data as collections (planes, hit test results, anchors) keyed by timestamps to reduce bridge churn and support delta updates (`removedIds`).

## Schema Overview
| Schema Type | Purpose | Key Fields |
| --- | --- | --- |
| `spatial.space-reference` | Helper structure reused by other schemas to describe the reference space for a pose or dataset. | `{ type: 'viewer' \| 'local' \| 'local-floor' \| 'bounded-floor' \| 'unbounded' \| 'stage' \| 'device' \| 'custom'; id?: string; }` |
| `spatial.pose` | Pose helper capturing position + orientation with WebXR-aligned conventions (right-handed, meters). | `{ position: { x, y, z }; orientation: { x, y, z, w }; }` |
| `spatial.scene-plane` | Represents a single detected plane aligned with WebXR `XRPlane`. | `id`, `space`, `pose`, `alignment` (`horizontal`/`vertical`/`slanted`/`unknown`), `extent` (`width`, `height`), `polygon[]`, `lastChangedTime`, `trackingState`, `classification` |
| `spatial.scene-planes` | Collection wrapper for plane updates carried by wearables. | `timestamp`, `space`, `planes[]`, `removedIds[]` |
| `spatial.depth-buffer` | CPU/GPU depth data aligned with WebXR `XRDepthInformation`. | `space`, `viewId`, `timestamp`, `format`, `width`, `height`, `rawValueToMeters`, `near`, `far`, `intrinsics`, `buffer` descriptor, `confidence` |
| `spatial.hit-test-ray` | Registered hit-test source definition. | `id`, `space`, `offsetRay` (`origin`, `direction`), `entityTypes[]`, `targetRaySpace`, `handedness`, `transient`, `profile`, `initialResults` |
| `spatial.hit-test-result` | Result payload matching `XRHitTestResult`. | `rayId`, `space`, `pose`, `transformMatrix`, `distance`, `timestamp`, `type`, `normal`, `anchors[]`, `inputSource` descriptor, `confidence` |
| `spatial.hit-test-results` | Collection wrapper for per-frame hit-test evaluations. | `timestamp`, `space`, `results[]` |
| `spatial.anchor` | Persistent anchor state. | `id`, `space`, `pose`, `lastChangedTime`, `trackingState`, `accuracy`, `associatedRayId`, `classification`, `confidence` |
| `spatial.anchors` | Anchor set changes shared by wearables. | `timestamp`, `space`, `anchors[]`, `removedIds[]` |

## Wearable Composite Impact (AR Visor First)
- Add optional `spatial.planes`, `spatial.depth`, `spatial.hit-tests`, and `spatial.anchors` channels to the AR visor composite.
- Each channel should look for raw data under `channels.spatial.*`, `spatial.*`, or `scene.*` nodes so adapters can source device SDK payloads naturally.
- Default confidences:
  - Planes: `0.78` (scene understanding reliability).
  - Depth: `0.72` (sensor noise, depends on device).
  - Hit tests: `0.8` (aggregated from scene + ray quality).
  - Anchors: `0.76` (platform-managed accuracy).
- Bridge metadata should surface `timestamp` and `space` to keep history/time-series consistent with wearable snapshots.

## Development Sequencing
1. **Sprint Now (Turn N)** – Implement the new schemas in `SensorSchemaRegistry`, add AR visor composite channels, and cover them with Vitest fixtures. This establishes the data contract before adapter/bridge services are wired up.
2. **Next Sprint (Turn N+1)** – Extend `SensoryInputBridge` / `WearableDeviceManager` with spatial routing helpers (e.g., `bridge.subscribe('wearable.ar-visor:spatial.planes', ...)`) and start ingesting recorded plane/depth traces.
3. **Turn N+2** – Build the hit test orchestration service that consumes registered rays and spatial data to emit `spatial.hit-test-results` collections each frame.
4. **Turn N+3** – Layer in anchor lifecycle management and integrate capability manifest gating.

## Ready-to-Start Decision
All required dependencies (registry helpers, composite wiring plan, confidence defaults) are now defined. Implementation should begin **immediately** so upcoming turns can focus on adapter ingestion and bridge services.
