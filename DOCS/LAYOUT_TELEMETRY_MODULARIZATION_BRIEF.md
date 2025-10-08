# Layout & Telemetry Modularization Brief

## Purpose
Establish the target architecture and acceptance criteria for splitting the adaptive layout and telemetry layers into modular, swappable components. This brief seeds Backlog items B-03, B-04, and B-08.

## Current Pain Points
- `SpatialLayoutSynthesizer` combines intensity heuristics, zone allocation, motion synthesis, and annotation plug-ins in a single class, making it difficult to extend for new wearable surfaces or haptic-only interfaces.【F:src/ui/adaptive/SpatialLayoutSynthesizer.js†L1-L113】
- `ProductTelemetryHarness` handles licensing, buffering, and network flushing without any provider abstraction or privacy controls, limiting monetization readiness for enterprise deployments.【F:src/product/ProductTelemetryHarness.js†L1-L63】
- Demo wiring in `wearable-designer.html` binds these modules directly to UI controls, preventing SDK consumers from selecting only the pieces they need.

## Target End-State
> **Implementation Update (2025-10-10):** Baseline strategy/annotation interfaces now live in `src/ui/adaptive/strategies` and
> `src/ui/adaptive/annotations` with runtime registration exercised by the wearable designer demo.

1. **Layout Strategy Plug-ins**
   - Introduce a `LayoutStrategy` interface with `prepare(context)` and `compose(layoutDraft)` hooks.
   - Provide reference strategies: `FocusWeightedStrategy` (current behavior), `PeripheralHandoffStrategy`, and `HapticFallbackStrategy`.
   - Move annotation handling into discrete `LayoutAnnotation` modules that declare dependencies and priority.
> **Implementation Update (2025-10-10):** `ProductTelemetryHarness` now delegates to provider implementations under
> `src/product/telemetry` and supports runtime registration via the adaptive engine.

2. **Telemetry Provider Interface**
   - Define `TelemetryProvider` with `identify`, `track`, and `flush` methods plus metadata about storage locations.
   - Ship `ConsoleTelemetryProvider` (default), `HttpTelemetryProvider` (configurable endpoint), and a stub `PartnerTelemetryProvider` for integrations.
   - Require opt-in data minimization flags and anonymization options for biometric streams.
> **Implementation Update (2025-10-10):** The new `createAdaptiveSDK` factory composes sensors, strategies, and telemetry
> providers for partner demos.

> **Implementation Update (2025-10-21):** Added `LicenseAttestationAnalytics` with harness + SDK integration, Vitest coverage, and wearable-designer surfacing so commercialization teams can inspect pack counters/history without bespoke dashboards.【F:src/product/licensing/LicenseAttestationAnalytics.js†L1-L417】【F:src/product/ProductTelemetryHarness.js†L1-L608】【F:src/core/AdaptiveSDK.js†L1-L210】【F:tests/vitest/license-attestation-analytics.test.js†L1-L49】【F:wearable-designer.html†L244-L420】

3. **SDK Composition Layer**
   - Create a lightweight `AdaptiveSDK` factory that wires `SensoryInputBridge`, layout strategies, and telemetry providers via dependency injection.
   - Ensure UI shells (demo experiences, partner plug-ins) can import from this factory without bundling unused adapters.

## Acceptance Criteria
- Strategies, annotations, and telemetry providers can be registered and swapped at runtime without modifying core classes.
- Unit tests cover registration lifecycles and conflict resolution rules for layout and telemetry modules.
- Documentation includes migration notes for partners adopting the new interfaces.
- Demo shell loads default strategies/providers but can toggle alternatives via configuration JSON.

## Deliverables
- Updated module scaffolding in `/src/ui/adaptive` and `/src/product` that reflects the interfaces above.
- Integration tests or smoke scripts validating end-to-end signal → layout → telemetry flow using the new abstractions.
- README and partner collateral updates summarizing the modular architecture.

## Dependencies & Risks
- Requires decision on the lightweight testing stack to avoid reintroducing the Playwright blocker.
- Telemetry provider changes must align with privacy/legal review before public release.
- Layout strategy plug-ins may increase bundle size; consider tree-shaking guidance for partner SDKs.

## Next Actions
1. Finalize testing stack recommendation (see `DOCS/TESTING_STACK_EVALUATION.md`).
2. Define SDK public API boundary (Backlog item B-01) to inform dependency injection design.
3. Produce migration checklist for existing demo experiences to adopt modular interfaces.
