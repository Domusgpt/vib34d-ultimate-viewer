# Adaptive SDK Boundary Proposal

## Purpose
Define an explicit, supportable interface for product teams and partners consuming the adaptive engine. The proposal captures the initial module surface, dependency injection patterns, and packaging considerations required to evolve the prototype into a salable SDK.

## Guiding Principles
1. **Composable inputs and outputs.** Sensor feeds, layout strategies, and telemetry providers must be replaceable without deep
   engine changes.
2. **Progressive adoption.** Downstream products should be able to adopt a subset (e.g., layout only) before integrating full
   adaptive control loops.
3. **Commercial hardening.** Licensing checks, telemetry consent, and extension hooks ship as part of the boundary rather than
   ad-hoc demo logic.

## Proposed Public Surface
| Area | Export | Responsibilities |
|------|--------|------------------|
| Core | `AdaptiveInterfaceEngine` | Lifecycle orchestration, module registry, high-level `renderAdaptiveFrame(context)` API. |
| Inputs | `SensoryInputBridge`, `SensorSchemaRegistry`, `registerSensorSchema`, sensor adapter interfaces | Normalization + validation contracts for gaze, neural, biometric, ambient signals plus adapter lifecycle controls. |
| Layout | `SpatialLayoutSynthesizer`, `LayoutStrategy`, `LayoutContext` types | Strategy registration, generation of layout descriptors, annotations, and motion cues. |
| Patterns | `InterfacePatternRegistry`, `DesignLanguageManager` | Mapping between layout descriptors and monetizable UI packages. |
| Telemetry | `TelemetryClient`, `TelemetryProvider`, `ComplianceVaultTelemetryProvider`, `ProductTelemetryHarness` compatibility shim | Event buffering, provider injection, consent state, compliance exports. |
| Utilities | `createAdaptiveSDK(config)`, `AdaptiveError`, `AdaptiveLogger`, `types/adaptive-sdk.d.ts` | Bootstrapping helper returning configured engine + telemetry/consent hooks with type definitions. |

## Dependency Injection Model
- **Sensors:** supply adapters via `createAdaptiveSDK({ sensorAdapters: [...] })` or manually call `registerSensorAdapter(type, adapter)`. Adapters may implement `connect`, `disconnect`, `test`, and `read` (pull) or use the `ingest` hook (push). Schemas can be registered via `sensorSchemas` config or `registerSensorSchema` helper.
- **Layout Strategies:** `SpatialLayoutSynthesizer` exposes `registerStrategy(strategy)` and `clearStrategies()` for swapping
  out bundles. Built-in strategies remain available as fallbacks.
- **Telemetry Providers:** Providers implement `identify`, `track`, and `flush`. The runtime defaults to buffered mode via
  `ProductTelemetryHarness` + `ConsoleTelemetryProvider` when no provider is specified.
- **Pattern Packs:** `InterfacePatternRegistry` accepts packaged bundles containing metadata, monetization hints, and renderers.

## Packaging Plan
1. **Phase 1:** Ship as ESM bundle + type definitions. Provide factory `createAdaptiveSDK` returning
   `{ engine, sensoryBridge, telemetry, registerSensorSchema, registerSensorAdapter, connectSensorAdapter, disconnectSensorAdapter, testSensorAdapter, updateTelemetryConsent, getTelemetryConsent, getTelemetryAuditTrail }` and honoring `sensorSchemas`, `sensorAdapters`, and `telemetryConsent` configuration.
2. **Phase 2:** Publish adapters for React/Vue/Web Components. Ensure wearable demo consumes the same factory to avoid drift.
3. **Phase 3:** Release plug-in kits (Figma/Webflow) that call into the SDK boundary for previews and telemetry capture.

## Acceptance Criteria
- Runtime initialization requires only the configuration object defined above.
- Layout/telemetry modules expose abstract strategy/provider interfaces with Vitest coverage.
- Telemetry consent + license keys enforced before any `send` call.
- README and integration docs reference the SDK surface rather than internal files.

## Open Questions
- How should we version pattern packs relative to engine releases?
- Do we need a compatibility layer for legacy VIB34D gallery consumers?
- Should licensing checks block engine boot or degrade gracefully with limited features?

## Next Steps
1. Align backlog item **B-01** with this boundary and break down implementation tasks.
2. Provide type sketches (TypeScript or JSDoc) for the exported interfaces.
3. Schedule design review with partner teams to validate packaging expectations.
