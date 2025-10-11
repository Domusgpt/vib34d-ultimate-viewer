# WebXR Spatial Interaction Integration Plan

## 1. Purpose
This document analyzes the WebXR spatial interaction stack—Hit Testing, Anchors, Plane Detection/Scene Understanding, and Depth Sensing—to determine what our wearables runtime must implement so the adaptive platform can participate in browser-grade XR experiences. The goal is to connect the Khronos-aligned wearables architecture to WebXR semantics, ensuring downstream UI/web teams receive telemetry that aligns with standard APIs without duplicating effort.

## 2. WebXR Spatial Modules Overview
### 2.1 Hit Testing API
- Provides `XRHitTestSource` objects bound to reference spaces (viewer, local, bounded-floor) and optional ray offsets.
- Runtime returns `XRHitTestResult` entries per frame with pose transforms, surface normals (when available), and transient input metadata for tracked controllers/hands.
- Hit tests are expected to respect real-world geometry from depth/meshing subsystems and can be lightweight (viewer-aligned rays) or heavy (scene meshes).

### 2.2 Anchors Module
- Allows apps to create persistent `XRAnchor` objects from hit test results.
- Anchors require continuous pose tracking, pose accuracy metadata, and lifecycle events (removed/updated) to keep spatial content stable.
- Anchors are typically backed by platform world-understanding services (ARKit, ARCore, Windows Mixed Reality) that manage relocalization.

### 2.3 Plane & Scene Understanding
- WebXR Plane Detection module yields `XRPlane` objects representing planar surfaces with polygon meshes, alignment hints (horizontal/vertical), and tracking states.
- Scene Understanding proposals extend this to semantic meshes (walls, floors, ceilings) requiring spatial classification and timestamped updates.

### 2.4 Depth Sensing
- WebXR Depth Sensing provides `XRDepthInformation` buffers (CPU-friendly or GPU textures) keyed to views, enabling per-pixel depth reconstruction.
- Accurate hit testing and occlusion rely on synchronized camera pose, intrinsics, and confidence maps.

### 2.5 Lighting Estimation (Optional but Related)
- Supplies spherical harmonics or reflection probes for realistic rendering; depends on similar world-understanding data.

## 3. Mapping Requirements to Our Architecture
| WebXR Capability | Data Requirements | Current State | Required Enhancements |
| --- | --- | --- | --- |
| Hit Testing | Ray definition, spatial scene data, per-frame results tied to spaces and predicted display time. | Bridge tracks wearable snapshots and poses but lacks scene geometry ingestion. | Introduce a spatial scene service that aggregates plane/depth feeds, exposes `performHitTest()` APIs, and emits results via the bridge with OpenXR-compatible `XrSpace` metadata. |
| Anchors | Persistent anchors with update/removal events and tracking accuracy metrics. | No persistent spatial object registry. | Build an `AnchorStore` linked to the SpaceRegistry; adapters must surface platform anchor IDs, status, and accuracy/confidence to downstream consumers. |
| Plane Detection | Plane polygons, orientation, extents, timestamps. | Schemas only cover wearable telemetry (poses, biometrics). | Extend SensorSchemaRegistry with spatial scene composites (`scene.plane`, `scene.mesh`) and ensure adapters forward plane updates. |
| Depth Sensing | View-relative depth buffers, intrinsics, reliability. | No depth channel support. | Add GPU/CPU depth buffer channels, integrate with frame timing service, and align metadata with WebXR `XRDepthInformation`. |
| Lighting Estimation | Spherical harmonics, reflection cube maps. | Not represented. | Optional: define lighting channels for runtime parity; treat as stretch goal after hit test/anchors. |

## 4. Implementation Plan
### Phase A – Spatial Data Foundations (Sprint 0-1)
1. **Scene Data Schema**: Extend `SensorSchemaRegistry` with spatial scene composites for planes, meshes, and depth buffers; include alignment with OpenXR spaces for compatibility.【F:src/ui/adaptive/sensors/SensorSchemaRegistry.js†L398-L612】
2. **Spatial Ingestion Adapters**: Update wearable adapters (especially AR visor) to source plane/depth feeds from device SDKs and publish to the bridge, guarded by capability manifests.
3. **SpaceRegistry Enhancements**: Finalize `SpaceRegistry` design from the OpenXR alignment plan to anchor scene data against consistent reference spaces.

### Phase B – Hit Testing Service (Sprint 2-3)
1. **Hit Test Manager**: Implement a `HitTestService` within the bridge layer that maintains registered rays, consumes scene data, and emits hit test results each frame aligned with predicted display time.
2. **Transient Input Support**: Link the `WearableDeviceManager` hand/controller data to hit test subscriptions so transient sources mirror WebXR semantics.
3. **Testing Harness**: Create Vitest suites simulating plane + ray intersections and validating pose accuracy/clamping rules.

### Phase C – Anchor Lifecycle (Sprint 3-4)
1. **AnchorStore**: Persist anchors derived from hit test results, propagate updates/removals, and expose subscription APIs similar to `XRAnchorSet`.
2. **Relocalization Hooks**: Surface adapter callbacks for when platform anchors adjust due to world understanding updates; ensure bridge re-bases poses smoothly.
3. **SDK Exposure**: Extend `types/adaptive-sdk.d.ts` with anchor/hit test interfaces, referencing OpenXR spaces for dual compatibility.【F:types/adaptive-sdk.d.ts†L1-L202】

### Phase D – Depth & Lighting Integration (Sprint 4-5)
1. **Depth Buffer Pipeline**: Support streaming GPU textures or CPU buffers, gating by capability manifest due to bandwidth implications.
2. **Occlusion Utilities**: Provide helper APIs for compositors to query depth at a pose; align with WebXR depth semantics.
3. **Lighting Channels (Optional)**: If required by UX roadmap, add lighting estimation channels mapped to spherical harmonics.

## 5. Readiness & Sequencing Recommendation
- **Start Immediately After Manifest Foundations**: Spatial data work (Phase A) should begin once capability manifests are in review (end of current Sprint 0) so scene schemas integrate with the same manifest/negotiation architecture.
- **Parallelization Guidance**: Hit test service (Phase B) can overlap with action layer work as long as shared SpaceRegistry contracts are stable.
- **Anchors & Depth**: Defer anchor lifecycle until hit test outputs are validated; depth sensing should follow anchors since it relies on established frame timing and scene data ingestion.
- **UI/Web Coordination**: Web telemetry track must prepare to consume new spatial events; schedule joint design reviews before Phase B kicks off.

## 6. Architectural Assurance Checklist
1. **Spaces Unified**: Confirm all spatial outputs (hit tests, anchors, planes) reference the same `XrSpace` identifiers defined in the OpenXR alignment plan.
2. **Capability Negotiation**: Extend manifest schema to advertise `spatial.hit-test`, `spatial.anchors`, `spatial.depth`, and `spatial.lighting` flags so clients can opt in before subscription.
3. **Telemetry Compliance**: Ensure telemetry payloads include confidence/accuracy metrics required by WebXR modules (e.g., anchor tracking states, depth buffer confidence).
4. **Performance Budgets**: Profile scene ingestion and hit testing to stay within frame budget (ideally <2 ms per frame on target hardware) and expose tuning knobs (ray count, plane update rate).
5. **Security & Privacy**: Coordinate with licensing/consent flows to gate spatial understanding features, mirroring platform privacy requirements.

## 7. Risks & Mitigations
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Scene data overburdens bridge history | Latency spikes, dropped frames. | Introduce dedicated spatial cache with eviction separate from wearable channel history; stream large meshes via references instead of inline payloads. |
| Divergent coordinate conventions | Misaligned hit results across OpenXR/WebXR consumers. | Standardize on right-handed, meter-based poses with quaternion orientation; add automated conformance tests comparing to reference traces. |
| Privacy compliance gaps for spatial mapping | Blocks deployment in regulated markets. | Integrate consent prompts and logging with licensing gates before enabling spatial capabilities. |
| Testing complexity | Hard to simulate world-understanding data. | Build deterministic fixtures using synthetic planes/depth maps and integrate with CI to validate hit test math. |

## 8. Next Steps
1. Finalize capability manifest extensions for spatial features and circulate to UI/web + platform stakeholders.
2. Kick off Phase A spike to prototype plane schema ingestion using recorded AR visor traces.
3. Draft SDK interface proposal for hit test/anchor APIs and share with developer advocacy for feedback.
4. Schedule architecture review to confirm SpaceRegistry and HitTestService designs before implementation begins.
