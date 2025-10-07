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

## 🧠 Adaptive Architecture Overview

| Layer | Purpose | Key Files |
|-------|---------|-----------|
| Core Runtime | Extends the legacy `VIB34DIntegratedEngine` with adaptive hooks while preserving existing visualizers. | `src/core/AdaptiveInterfaceEngine.js` |
| Sensory Input | Normalizes gaze, neural, biometric, and ambient signals into semantic channels. | `src/ui/adaptive/SensoryInputBridge.js` |
| Layout Synthesis | Generates intent-driven layout descriptors, motion cues, and color adaptation guidance. | `src/ui/adaptive/SpatialLayoutSynthesizer.js` |
| Design Language | Maps engine variations to monetizable interface patterns and integration metadata. | `src/features/DesignLanguageManager.js`, `src/ui/adaptive/InterfacePatternRegistry.js` |
| Telemetry | Buffers analytics/licensing events for later provider integration. | `src/product/ProductTelemetryHarness.js` |
| Experience Shell | Demonstration UI highlighting adaptive behaviours and commercialization hooks. | `wearable-designer.html` |

Read the [Adaptive Engine Architecture Review](DOCS/ADAPTIVE_ENGINE_ARCHITECTURE_REVIEW.md) for an in-depth assessment of the current implementation, strengths, and risks.

## 📈 Roadmap & Tracking

- [Adaptive Engine Development Tracker](PLANNING/ADAPTIVE_ENGINE_TRACKER.md) – Source of truth for backlog, sprint focus, and environment readiness.
- [Adaptive Engine Core Viability Assessment](DOCS/ADAPTIVE_ENGINE_CORE_ASSESSMENT.md) – Deep-dive on whether the current stack can graduate to a commercial SDK and what refactors are required.
- `DOCS/ADAPTIVE_UI_PRODUCT_PLAN.md` – Strategic objectives and go-to-market framing from the previous refactor.
- `DOCS/PARTNER_INTEGRATION_STRATEGY.md` – High-level integration opportunities for tooling ecosystems.

Upcoming focus areas include defining a formal SDK boundary, introducing sensor data schemas, modularizing layout strategies, and replacing the telemetry stub with provider plug-ins. Progress on these tasks is recorded in the tracker above.

## 🎨 Engine Heritage

All four holographic subsystems remain available for creative workflows and continue to share the unified parameter controls described in `SYSTEM_STATUS.md`. The adaptive layer currently sits on top of this proven rendering core.

## 🔧 Development Notes

- The adaptive modules are delivered as native ES modules; a static HTTP server is sufficient for local prototyping.
- Legacy gallery/test harnesses remain in the repository to preserve historical functionality while refactoring proceeds.
- Automated testing for the adaptive pipeline has not yet been implemented—see the tracker for next steps.

## 📊 Reality Check

- ⚠️ Prototype status – Suitable for demonstrations, not production deployments.
- ⚠️ Documentation gap – API contracts, adapter lifecycles, and telemetry providers still need formal specs.
- ✅ Visualization core – Legacy systems remain stable and documented (see `SYSTEM_STATUS.md`).

Contributions should reference the architecture review and tracker documents to stay aligned with the evolving roadmap.
