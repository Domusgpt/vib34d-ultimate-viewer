# VIB34D Adaptive Interface Platform (Prototype)

The VIB34D visualization engine now includes an experimental adaptive layer aimed at wearable, ambient, and projection-first interfaces. The current codebase demonstrates the concept but still requires significant engineering work before it can be marketed as a supported SDK. Start here to understand the available pieces and how we plan to evolve them.

## 🚀 Quick Start (Concept Demo)

```bash
# Clone and navigate
cd vib34d-ultimate-viewer

# Start local server (no build tooling required)
python3 -m http.server 8080

# Open the wearable/ambient demo shell
http://localhost:8080/wearable-designer.html
```

> **Note:** `wearable-designer.html` is a prototype experience that wires the adaptive engine into a marketing-oriented UI. It is not yet packaged as a reusable toolkit.

> **New:** The demo shell now ships with a telemetry consent panel and downloadable compliance log powered by the `ComplianceVaultTelemetryProvider`. Use it to trial consent toggles and review the audit stream before embedding the SDK elsewhere.

## 🧠 Adaptive Architecture Overview

| Layer | Purpose | Key Files |
|-------|---------|-----------|
| Core Runtime | Extends the legacy `VIB34DIntegratedEngine` with adaptive hooks while preserving existing visualizers. | `src/core/AdaptiveInterfaceEngine.js` |
| Sensory Input | Normalizes gaze, neural, biometric, and ambient signals into semantic channels with schema validation. | `src/ui/adaptive/SensoryInputBridge.js`, `src/ui/adaptive/sensors/SensorSchemaRegistry.js` |
| Layout Synthesis | Generates intent-driven layout descriptors, motion cues, and color adaptation guidance using pluggable strategies/annotations. | `src/ui/adaptive/SpatialLayoutSynthesizer.js`, `src/ui/adaptive/strategies/*`, `src/ui/adaptive/annotations/*` |
| Design Language | Maps engine variations to monetizable interface patterns and integration metadata. | `src/features/DesignLanguageManager.js`, `src/ui/adaptive/InterfacePatternRegistry.js` |
| Telemetry | Classifies events, gates analytics/biometrics behind consent, and dispatches via provider interfaces (console, HTTP, partner, compliance vault). | `src/product/ProductTelemetryHarness.js`, `src/product/telemetry/*` |
| SDK Composition | Lightweight factory for DI-based integration into partner shells. | `src/core/AdaptiveSDK.js` |
| Experience Shell | Demonstration UI highlighting adaptive behaviours and commercialization hooks. | `wearable-designer.html` |

Read the [Adaptive Engine Architecture Review](DOCS/ADAPTIVE_ENGINE_ARCHITECTURE_REVIEW.md) for an in-depth assessment of the current implementation, strengths, and risks.

## 📈 Roadmap & Tracking

- [Adaptive Engine Development Tracker](PLANNING/ADAPTIVE_ENGINE_TRACKER.md) – Source of truth for backlog, sprint focus, and environment readiness.
- [Adaptive Engine Core Viability Assessment](DOCS/ADAPTIVE_ENGINE_CORE_ASSESSMENT.md) – Deep-dive on whether the current stack can graduate to a commercial SDK and what refactors are required.
- [Adaptive Engine Testing Stack Evaluation](DOCS/TESTING_STACK_EVALUATION.md) – Recommendation to adopt Vitest + jsdom for Phase 1 coverage while keeping Playwright optional.
- [Layout & Telemetry Modularization Brief](DOCS/LAYOUT_TELEMETRY_MODULARIZATION_BRIEF.md) – Target interfaces and acceptance criteria for strategy/provider refactors.
- [Adaptive SDK Boundary Proposal](DOCS/SDK_BOUNDARY_PROPOSAL.md) – Proposed public API surface, dependency injection model, and packaging plan for commercialization.
- [Telemetry Privacy & Consent Guide](DOCS/TELEMETRY_PRIVACY_AND_CONSENT_GUIDE.md) – Default classifications, consent lifecycle mechanics, and adapter lifecycle telemetry expectations.
- `DOCS/ADAPTIVE_UI_PRODUCT_PLAN.md` – Strategic objectives and go-to-market framing from the previous refactor.
- `DOCS/PARTNER_INTEGRATION_STRATEGY.md` – High-level integration opportunities for tooling ecosystems.
- [Wearable Designer Migration Checklist](PLANNING/WEARABLE_DESIGNER_MIGRATION_CHECKLIST.md) – Tasks for porting the demo shell onto the modular runtime once interfaces stabilize.

Phase 1 now delivers runtime-pluggable layout strategies, annotations, telemetry providers, sensor payload schema validation, consent-aware telemetry, and downloadable audit exports via the `AdaptiveSDK` factory. Upcoming focus areas include promoting the consent UI components into reusable packages, deepening hardware adapter lifecycle coverage, and porting experience shells onto the new factory. Progress on these tasks is recorded in the tracker above.

## 🎨 Engine Heritage

All four holographic subsystems remain available for creative workflows and continue to share the unified parameter controls described in `SYSTEM_STATUS.md`. The adaptive layer currently sits on top of this proven rendering core.

## 🔧 Development Notes

- The adaptive modules are delivered as native ES modules; a static HTTP server is sufficient for local prototyping.
- Legacy gallery/test harnesses remain in the repository to preserve historical functionality while refactoring proceeds.
- Automated testing for the adaptive pipeline now uses Vitest + jsdom (`npm test`). Playwright smoke suites remain available under `npm run test:e2e*` but require optional browser installs.

## 📊 Reality Check

- ⚠️ Prototype status – Suitable for demonstrations, not production deployments.
- ⚠️ Documentation gap – API contracts, adapter lifecycles, and telemetry providers still need formal specs.
- ✅ Visualization core – Legacy systems remain stable and documented (see `SYSTEM_STATUS.md`).

Contributions should reference the architecture review and tracker documents to stay aligned with the evolving roadmap.
