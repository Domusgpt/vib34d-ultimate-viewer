# Wearable Designer Migration Checklist

## Objective
Transition `wearable-designer.html` from a monolithic prototype into an integration sample that consumes the modular adaptive SDK
interfaces.

## Pre-Migration Prerequisites
- [ ] SDK boundary finalized and exported via `createAdaptiveRuntime` factory.
- [ ] Layout strategies and telemetry providers injectable (Phase 2 deliverables).
- [ ] Baseline Vitest coverage in place for layout + telemetry modules.
- [ ] Partner design team reviews migration scope and UI dependencies.

## Migration Tasks
1. **Bootstrap Integration Layer**
   - [ ] Replace direct imports with `createAdaptiveRuntime` + dependency map.
   - [ ] Introduce configuration file for pattern packs and sensor channel wiring.
2. **Componentize UI Shell**
   - [ ] Break sections (hero, monetization banners, telemetry console) into reusable Web Components or templated modules.
   - [ ] Ensure styling tokens map to `DesignLanguageManager` outputs.
3. **Telemetry & Licensing Hooks**
   - [ ] Wire consent + license prompts to `ProductTelemetryHarness` provider injection.
   - [ ] Verify flushing/analytics toggles respect disabled state.
4. **Testing & Validation**
   - [ ] Author Vitest integration tests for the new adapter layer (mock sensors + telemetry).
   - [ ] Schedule manual wearable experience review against the monetization checklist.

## Post-Migration Follow-ups
- [ ] Update README Quick Start to reference the new modular entry point.
- [ ] Capture learnings + UI deltas in the development tracker.
- [ ] Plan product marketing assets demonstrating plug-in pathway.
