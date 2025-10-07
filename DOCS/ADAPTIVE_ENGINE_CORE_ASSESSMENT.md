# Adaptive Engine Core Viability Assessment

## 1. Session Context (2025-10-07)
- **Objective:** Validate whether the current adaptive stack can serve as the commercial core for wearable/ambient UI tooling.
- **Inputs Reviewed:** `AdaptiveInterfaceEngine`, sensory/layout modules, commercialization utilities, and the wearable designer shell.
- **Outcome:** The existing structure is a strong prototype but requires a refactor programme before being packaged as a core SDK.

## 2. Capability Fit Analysis
| Layer | Strengths | Limitations | Decision |
|-------|-----------|-------------|----------|
| Core Runtime (`AdaptiveInterfaceEngine`) | Preserves legacy visualizer compatibility while introducing adaptive pipeline hooks for sensory updates.【F:src/core/AdaptiveInterfaceEngine.js†L16-L79】 | Lifecycle and variation flows are hardwired to demo hooks instead of a published API surface. | Keep, but extract public methods + TypeScript definitions during SDK boundary work (Phase 1).
| Sensory Input (`SensoryInputBridge`) | Extensible channel registry, configurable decay, schema normalization, and snapshot export suitable for eye/neural adapters.【F:src/ui/adaptive/SensoryInputBridge.js†L10-L248】【F:src/ui/adaptive/sensors/SensorSchemaRegistry.js†L1-L218】 | Still missing hardware lifecycle controls (`connect/disconnect`, error events) and consent reporting. | Retain architecture, add adapter interface + consent-aware diagnostics in refactor.
| Layout (`SpatialLayoutSynthesizer`) | Multi-zone descriptors with chroma/motion heuristics already mapped to engine parameters.【F:src/ui/adaptive/SpatialLayoutSynthesizer.js†L18-L111】 | Monolithic heuristics make alternative strategies/testing difficult. | Split into strategy modules (zoning/motion/color) and expose injection API.
| Commercialization (`DesignLanguageManager`, `InterfacePatternRegistry`, `ProductTelemetryHarness`) | Provides monetization metadata and telemetry hooks showing business value.【F:src/features/DesignLanguageManager.js†L18-L78】【F:src/ui/adaptive/InterfacePatternRegistry.js†L11-L87】【F:src/product/ProductTelemetryHarness.js†L7-L70】 | Telemetry lacks provider abstraction & privacy controls; registry is in-memory without persistence APIs. | Replace harness with provider plug-ins, introduce persistence/export adapters.
| Experience Shell (`wearable-designer.html`) | Demonstrates adaptive behaviour + commercialization toggles end-to-end.【F:wearable-designer.html†L1-L255】 | Single 255-line file prevents reuse, testing, or partner integration samples. | Rebuild as modular demo kit (Phase 3).

## 3. Scalability & Elegance Gaps
1. **API Boundary Ambiguity** – Consumers must import internal modules directly; no SDK packaging, versioning, or compatibility guarantees.
2. **Data Contract Fragility** – Runtime schema validation now clamps payloads, but missing hardware lifecycle hooks and consent flows still threaten production integrations.
3. **Testing & Automation Debt** – No automated verification; telemetry and layout logic are untested.
4. **Commercialization Hardening** – Telemetry lacks opt-in/PII controls; monetization metadata needs persistence/export surfaces for partner platforms.

## 4. Core Decision
- **Go-Forward Stance:** The prototype is a viable foundation *if and only if* we execute the refactor roadmap. A rewrite is unnecessary; strategic modularization and contract hardening will yield an SDK-grade core.
- **KPIs for Graduation:**
  - Public SDK entry point with semantic versioning and documentation.
  - Validated sensory adapter contracts (runtime schemas + adapter lifecycle tests).
  - Pluggable layout/telemetry strategies with baseline automated coverage.
  - Modular demo kit showcasing partner integration flows.

## 5. Refactor Programme Synopsis
| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| Phase 0 (now) | Planning & alignment | Updated tracker, session log, viability assessment (this doc). |
| Phase 1 | SDK boundary & contracts | Package `AdaptiveInterfaceEngine`, define adapter interfaces, add schema validation. |
| Phase 2 | Modular subsystems | Strategy modules for layout, provider pattern for telemetry, baseline Playwright smoke tests. |
| Phase 3 | Commercialization assets | Modular demo kit, partner starter templates, monetization analytics documentation. |

## 6. Immediate Next Actions
1. Finalize environment readiness plan (document dependency gaps, prioritize lightweight alternatives before full `install-deps`).
2. Update development tracker with new sprint items for SDK boundary definition and environment tooling.
3. Author a modularization brief for the layout/telemetry refactor (to seed Phase 2 backlog refinement).
4. Capture session log entry (see `PLANNING/SESSION_LOG.md`) with decisions and follow-up owners.

