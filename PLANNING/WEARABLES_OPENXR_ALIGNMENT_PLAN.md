# Wearables OpenXR Alignment Development Plan

## 1. Purpose & Scope
This plan describes how to evolve the wearables stack (sensor schemas, adapters, telemetry bridge, SDK surface) so it conforms to OpenXR runtime expectations while remaining compatible with existing adaptive runtime consumers. The scope covers the runtime/device integration lane; UI/web telemetry consumers remain in a parallel track but must be kept in sync through shared contracts. We assume willingness to refactor or replace components when alignment yields clearer interoperability or reduced maintenance.

## 2. Guiding Principles
1. **Interop First** – Prefer OpenXR-native abstractions (actions, spaces, interaction profiles) over bespoke constructs when a one-to-one mapping exists.
2. **Progressive Adoption** – Layer new capabilities behind feature flags/manifests so existing partners can migrate gradually.
3. **Testable Compliance** – Every change should be validated through automated tests comparing our payloads/actions against OpenXR conformance rules.
4. **Bidirectional Compatibility** – Support both ingesting OpenXR runtimes and projecting data back out for non-OpenXR consumers.
5. **Documented Migration Paths** – Provide clear developer documentation, changelogs, and SDK typings describing behavioral changes.

## 3. Target Architecture Overview
| Layer | Current State | Target Refactor | Notes |
| --- | --- | --- | --- |
| Device Discovery | Static schema registration inside `SensorSchemaRegistry`. | Capability manifests per adapter with OpenXR interaction profile IDs and extension names; dynamic registry enumeration. | Aligns with recommendations from the platform comparison brief. |
| Data Model | Channel-based payloads with confidences. | Dual-path model: normalized channels plus derived OpenXR `XrAction` state cache. | Allows existing consumers to keep channel data while OpenXR apps bind to actions. |
| Spatial Context | Optional metadata without shared reference frames. | Standardized `XrSpace` identifiers (local, stage, view) stored alongside poses and timestamps. | Requires refactoring `SensoryInputBridge` metadata handling. |
| Negotiation & Licensing | Implicit licensing gates per adapter. | Explicit capability negotiation API mirroring `xrEnumerateInstanceExtensionProperties` + license attestation handshake. | Keeps licensing but exposes it through OpenXR-inspired flow. |
| Telemetry & Events | Bridge-managed event emission without runtime frame synchronization. | Clock service integrated with runtime prediction (`xrWaitFrame` analogue) ensuring telemetry is aligned with frame timing. | Enables deterministic replay/testing. |
| SDK Surface | Custom TS types for adapters/bridge. | Namespaced OpenXR compatibility layer (`adaptive.openxr`) exporting action enums, capability queries, and compatibility helpers. | Provide progressive adoption wrappers. |

## 4. Workstreams & Tasks

### 4.1 Capability & Discovery Manifests
- Define manifest schema describing interaction profiles, OpenXR extension IDs, licensing requirements, and fallback behaviors.
- Refactor adapters (`BaseWearableDeviceAdapter` derivatives) to publish manifests and register with an enumerator API.
- Update `WearableDeviceManager` to expose `listCapabilities()` akin to `xrEnumerateInstanceExtensionProperties`.
- Provide migration tooling to convert existing static registry entries into manifests.

### 4.2 Action Layer Abstraction
- Design action mapping table translating channel payloads into OpenXR action types (boolean, float, vector2f, pose, vibration).
- Implement an `ActionStateStore` inside the bridge that updates per frame using normalized channel data.
- Supply default bindings for AR visor, neural band, biometric wrist adapters referencing standard interaction profiles (e.g., `XR_EXT_eye_gaze_interaction`).
- Extend tests to validate that action states match expected ranges and semantics for each device.

### 4.3 Space & Timing Alignment
- Introduce a `SpaceRegistry` that manages named spaces (`local`, `stage`, `view`, device-specific anchors) with consistent orientation/handedness.
- Update payload metadata to embed `XrSpace` identifiers and include predicted display times or frame IDs from a shared clock service.
- Refactor `SensoryInputBridge` to propagate aligned timestamps and provide utilities similar to `xrLocateSpace`.
- Add conformance checks verifying pose matrices, handedness, and timestamp monotonicity.

### 4.4 Negotiation, Licensing, and Consent Flow
- Build a negotiation API sequence mirroring OpenXR initialization: capability query → license check → session creation.
- Integrate telemetry/licensing modules so attestation occurs when capabilities are enabled.
- Document consent prompts aligning with OpenXR privacy guidelines (eye, hand, biometric data).
- Provide sample flows for enabling/disabling extensions dynamically at runtime.

### 4.5 SDK & Tooling Updates
- Introduce an `adaptive-openxr` TypeScript namespace exposing helpers for action creation, capability querying, and migration adapters.
- Update `types/adaptive-sdk.d.ts` and developer docs with OpenXR-compatible interfaces.
- Create reference implementation demonstrating bridging our stack with an OpenXR runtime (e.g., Monado) including a sample WebXR overlay.
- Offer CLI tooling to validate manifests and action mappings before publishing.

### 4.6 Compliance & QA Automation
- Expand Vitest suites with OpenXR conformance fixtures (pose validation, action semantics, extension negotiation).
- Add integration tests replaying OpenXR event streams to ensure compatibility.
- Establish nightly compatibility runs against a headless OpenXR runtime to guard against regressions.
- Coordinate with QA to capture manual certification steps for major vendors (Meta, Microsoft, HTC, Varjo, Pico).

### 4.7 Migration & Deprecation Strategy
- Publish deprecation schedule for legacy schema registration APIs, including feature flags controlling new behavior.
- Provide compatibility shims and instrumentation to detect deprecated usage in partner integrations.
- Stage rollout: **Phase A** (dual path), **Phase B** (default to OpenXR alignment), **Phase C** (remove legacy-only hooks).
- Communicate timeline in release notes and partner briefings.

## 5. Deliverables & Milestones
| Milestone | Target | Key Deliverables |
| --- | --- | --- |
| M1 – Manifest Foundations | Sprint 0-1 | Manifest schema, adapter updates, discovery API, migration script, baseline tests. |
| M2 – Action & Space Layer | Sprint 2-3 | ActionStateStore, default bindings, SpaceRegistry, bridge refactor, pose/time conformance tests. |
| M3 – Negotiation & SDK | Sprint 4-5 | Capability negotiation API, licensing alignment, `adaptive-openxr` namespace, sample integration app. |
| M4 – Compliance Automation | Sprint 6 | Nightly conformance pipeline, coverage reports, QA certification checklist. |
| M5 – Migration Cutover | Sprint 7+ | Deprecation toggles, telemetry dashboards updated, partner comms package, readiness review. |

## 6. Decision Points & Refactor Triggers
- **Manifest Adoption:** If manifest integration reveals fundamental schema constraints, greenlight full replacement of `SensorSchemaRegistry` internals with manifest-driven registry.
- **Action Mapping Complexity:** If action derivation becomes unmanageable, consider exposing a dedicated OpenXR runtime adapter instead of channel-to-action translation.
- **Space Alignment:** If existing metadata cannot be reconciled, replace metadata pipeline with new `SpaceRegistry` and migrate consumers via compatibility layer.
- **SDK Surface:** Decide whether to keep hybrid APIs or fork an `adaptive-openxr` package when dual maintenance becomes costly.

## 7. Risks & Mitigations
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Divergence from UI/web telemetry contracts | Breaks dashboards/analytics. | Share manifest schema and action mappings with UI/web team, add cross-track contract tests. |
| Vendor-specific extension gaps | Missing functionality for proprietary features. | Allow manifest overrides per deployment, maintain vendor extension catalog with fallback strategies. |
| Performance overhead from dual data paths | Increased latency in bridge processing. | Profile bridge, introduce configurable throttling, and optimize hot paths using typed arrays/batched updates. |
| Certification delays | Slows partner onboarding. | Engage vendors early with pilot builds, maintain compliance checklist, automate evidence capture. |

## 8. Dependencies
- Telemetry/licensing services for capability gating and consent logging.
- Access to OpenXR runtime (e.g., Monado, vendor SDKs) for automated tests.
- Hardware samples or recorded traces for AR visor, neural band, biometric wrist devices.
- Collaboration with UI/web telemetry track for dashboard adjustments.

## 9. Reporting & Communication
- **Weekly**: Alignment sync with UI/web and platform compliance stakeholders.
- **Bi-weekly**: OpenXR compatibility demo to surface progress and collect partner feedback.
- **Release Notes**: Dedicated section for OpenXR alignment status and migration guidance.
- **Dashboarding**: Track manifest adoption, action coverage, and conformance pass rates.

## 10. Immediate Next Steps
1. Finalize manifest schema draft and circulate for stakeholder review.
2. Prototype manifest-based registration for one adapter (AR visor) to validate discovery flow.
3. Set up OpenXR runtime harness (Monado or vendor-provided) within CI to support upcoming automation.
4. Publish engineering RFC summarizing migration phases and solicit feedback from partner teams.
