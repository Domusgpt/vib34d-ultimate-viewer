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
| Inputs | `SensoryInputBridge`, `registerSensorChannel`, `SensorChannelError` | Normalization contracts for gaze, neural, biometric, ambient signals. |
| Layout | `SpatialLayoutSynthesizer`, `LayoutStrategy`, `LayoutContext` types | Strategy registration, generation of layout descriptors, annotations, and motion cues. |
| Patterns | `InterfacePatternRegistry`, `DesignLanguageManager` | Mapping between layout descriptors and monetizable UI packages. |
| Telemetry | `TelemetryClient`, `TelemetryProvider`, `ProductTelemetryHarness` compatibility shim | Event buffering, provider injection, consent state. |
| Utilities | `createAdaptiveSDK(config)`, `AdaptiveError`, `AdaptiveLogger` | Bootstrapping helper returning configured engine + telemetry hooks. |

## Dependency Injection Model
- **Sensors:** pass an object map `{ gaze: provider, neural: provider }` into `createAdaptiveRuntime`. Providers must expose `start`,
  `stop`, and `onData(callback)`.
- **Layout Strategies:** `SpatialLayoutSynthesizer` exposes `registerStrategy(strategy)` and `clearStrategies()` for swapping
  out bundles. Built-in strategies remain available as fallbacks.
- **Telemetry Providers:** Providers implement `identify`, `track`, and `flush`. The runtime defaults to buffered mode via
  `ProductTelemetryHarness` + `ConsoleTelemetryProvider` when no provider is specified.
- **Pattern Packs:** `InterfacePatternRegistry` accepts packaged bundles containing metadata, monetization hints, and renderers.

## Packaging Plan
1. **Phase 1:** Ship as ESM bundle + type definitions. Provide factory `createAdaptiveSDK` returning
   `{ engine, sensoryBridge, telemetry }`.
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
