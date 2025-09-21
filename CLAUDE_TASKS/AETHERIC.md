# Task: Integrate AETHERIC into vib34d-ultimate-viewer

## Goal
Add a distinct fifth engine ("AETHERIC") that preserves the shared 11-parameter grammar and mobile performance.

## Files to create
- `src/systems/aetheric/aetheric.js`
- `src/shaders/aetheric.vert.glsl`
- `src/shaders/aetheric.frag.glsl`

## Files to update
- `src/systems/index.js`: import + append `createAethericSystem()`
- (If needed) `js/controls/ui-handlers.js`: add "Scale" slider (0.25–2.0), default 1.0

## Acceptance tests
- Page loads without console errors on mobile and desktop
- Toggle between all 5 systems; parameters persist and cross-apply
- FPS ≥ 45 on mid-tier Android using default settings
- Gallery save/load preserves AETHERIC state
- No WebGL context churn; single-pass render per frame
