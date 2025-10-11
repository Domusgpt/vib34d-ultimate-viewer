# Quaternion Alignment for XR Wearables

## Why Quaternions Matter in XR Pipelines
- **Stable orientation tracking** – WebXR/OpenXR runtimes expose headsets, controllers, hit-test poses, and anchors as position/orientation tuples backed by unit quaternions. They avoid gimbal lock in 6DoF scenes and guarantee smooth interpolation during rapid user motion.
- **Action and space transforms** – OpenXR interaction profiles publish controller grip/aim spaces, while WebXR reference spaces (viewer, local, local-floor) apply quaternion transforms when mapping poses across coordinate frames.
- **Anchors and hit tests** – Spatial anchors, plane normals, and hit-test results are persisted as quaternions to ensure long-term stability when the runtime re-localizes.
- **Compositor hand-off** – XR compositors convert quaternion poses into view matrices before shading, so fidelity of quaternion math directly impacts rendering accuracy.

## Existing Quaternion Touchpoints in Our Runtime
- **SensorSchemaRegistry** already validates pose quaternions for wearable metadata, spatial planes, depth buffers (camera orientation), hit-test results, and anchors. The new spatial composites enforce normalization (unit length, components) so downstream consumers receive consistent orientation data.
- **BaseWearableDeviceAdapter** clamps confidences and deep clones payloads without mutating quaternion components, preserving precision from transport traces.
- **SensoryInputBridge** fans out normalized wearable samples, letting us emit quaternion-bearing channels (eye orientation, spatial poses) with bounded history for time-synchronized rendering.

## Synergy with the Quaternion-Based Shader System
- **Direct shader ingestion** – Our shader pipeline expects quaternion-based orientation inputs for camera rigs and object instances. Because wearable channels now normalize quaternions, we can feed shader uniforms directly from bridge snapshots without extra conversion.
- **Consistent reference frames** – By summarizing spatial reference spaces (type/id) inside the AR visor metadata, we can precompute shader-friendly transform caches keyed by the same identifiers, reducing per-frame coordinate reconciliation.
- **Hit-test driven placement** – Hit-test result quaternions align with our instancing shaders, allowing immediate placement of virtual assets with correct rotation. The shared quaternion representation avoids double conversion and rounding drift.
- **Anchor persistence** – Anchors emit stable quaternions that the shader system can store for occlusion and relighting passes, enabling persistent scene elements even as the runtime re-localizes.

## Implementation Strategy
1. **Adapter quaternion integrity** – Ensure adapters never coerce quaternion components; they should propagate normalized quaternions from transport traces or call registry helpers before emission. The AR visor adapter now clones spatial payloads intact so quaternions reach the shader stage verbatim.
2. **Bridge snapshot alignment** – Extend snapshot descriptors to tag spatial spaces and timestamps so the shader engine can align quaternion transforms with temporal smoothing windows.
3. **Shader pipeline bindings** – Map `WearableDeviceManager` snapshots to shader uniform buffers, keeping quaternion orientation arrays contiguous for GPU upload. Introduce helper utilities for converting quaternion + translation to 4x4 matrices on-demand inside GLSL/TSL modules.
4. **Validation tooling** – Augment Vitest suites with quaternion normalization checks (unit length, orientation continuity) and provide debug visualizers that compare wearable quaternions to shader outputs for drift detection.

## When to Execute
- **Immediate (current sprint)** – Adapter + schema work (complete) plus metadata summaries create the foundation. Begin wiring bridge snapshots into the shader staging layer now so teams can experiment with hit-test/anchor rendering.
- **Upcoming sprints** – Add quaternion smoothing utilities, GPU upload helpers, and visualization tests once shader integration starts. Coordinate with the UI/web telemetry track to confirm quaternion conventions before rolling into broader SDK updates.
- **Ongoing** – Monitor runtime precision by logging quaternion deltas between frames; feed insights back into calibration tools and licensing telemetry where high-fidelity orientation is a gating feature.

## Next Steps
- Integrate quaternion metadata from wearable snapshots into the adaptive renderer prototype.
- Schedule a joint review with the shader pipeline team to validate uniform layouts and interpolation requirements.
- Extend documentation to include quaternion troubleshooting guides for partner OEMs contributing transport traces.
