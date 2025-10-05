# Performance Suite Development Notes

This memo documents every subsystem introduced while building the live Performance Suite, how
those pieces collaborate on stage, and the follow-on ideas queued for future releases.
It complements the reference guide by focusing on implementation intent and the rationale
behind each addition.

## Foundational Architecture

### Parameter Management & Engine Hooks
- **`src/core/Parameters.js`** was expanded with rich metadata (labels, tags, ranges,
  curves) and change listeners so UI controllers can present readable names, validate
  ranges, and broadcast updates without touching engine internals.
- Engine shells (`src/core/Engine.js`, `src/core/CanvasManager.js`, and system-specific
  subclasses) were adapted to hydrate the shared `PerformanceSuiteHost`, preserve state
  across engine swaps, and accept live audio/theme/preset payloads triggered from the suite.

### Shared Messaging Layer
- **`src/ui/PerformanceHub.js`** exposes a tiny event bus that synchronizes pads, audio,
  presets, themes, and planner cues. All UI modules publish and subscribe via the hub to
  avoid direct coupling.
- The hub is published globally through `PerformanceSuite` so external extensions (MIDI
  bridges, OSC listeners, lighting rigs) can listen in or dispatch custom events.

## Live Control Surface

### Touch Pad Controller
- **`src/ui/TouchPadController.js`** renders multi-touch pads with:
  - Axis pickers backed by the parameter registry and a search/tag filter panel.
  - Per-axis curve, smoothing, and inversion controls that pre-shape gesture data.
  - Layout presets, template selector (Orbital Sculpt, Chromatic Wash, Geometry Chisel),
    and pad count slider so rigs can swap between curated arrangements quickly.
  - Import/export helpers that keep mappings portable across presets and shows.

### Audio Reactivity Pipeline
- **`src/ui/AudioReactivityPanel.js`** exposes mic/line-in routing, smoothing, gain,
  beat detection, band weighting, and flourish triggers so the engine can modulate
  parameters using live music analysis.
- Engines receive reactivity payloads through `setLiveAudioSettings`, apply weighting per
  band (bass/mid/treble/energy), and emit flourish hooks for choreographed bursts.

### Hardware Bridge & MIDI Learn
- **`src/ui/PerformanceMidiBridge.js`** requests Web MIDI access, lists connected inputs,
  and lets performers “learn” hardware knobs/faders to any parameter in the registry.
- Mappings persist locally, publish hub events (`hardware:midi-value`), and smooth incoming
  CC values before converting them to engine-friendly ranges to prevent on-stage jumps.
- The bridge feeds directly into `ParameterManager.setParameter`, letting tactile rigs sit
  alongside multi-touch pads and audio-driven modulation.
- **New in this revision:** presets now capture hardware mappings alongside pads/audio so
  tactile rigs restore instantly when loading shows or planner cues.

## Library & Playback Stack

### Performance Preset Manager
- **`src/ui/PerformancePresetManager.js`** snapshots the entire suite state—pads, audio,
  show planner, theme palettes, and transition curves—into a persistent library with
  playlist support, renaming, tagging, and summary badges.
- Presets can be loaded without overriding the current theme when a cue specifically
  instructs the suite to “hold current glow.”

### Show Planner & Cue Sequencer
- **`src/ui/PerformanceShowPlanner.js`** choreographs live sets with tempo, beats-per-bar,
  looping, cue stacks, notes, auto-advance, and keyboard shortcuts. Cues can trigger presets,
  adopt preset palettes, enforce palette overrides, or hold the active theme.
- Theme transitions (duration + easing) were threaded end-to-end so cues can define how the
  glow fades between palettes.
- **New in this revision:** a timeline overview renders estimated runtime, beat totals,
  per-cue progress bars, and highlights the currently running cue. The view adapts to
  manual cues while surfacing preset accents for at-a-glance navigation.
- **Also new:** tap-tempo and BPM nudge controls with visual feedback feed a shared
  `show:tempo-update` event so external clocks, MIDI rigs, or lighting consoles can snap
  to the latest timing changes without polling the planner state.

## Theme & Atmosphere System

### Theme Utilities & Panel
- **`src/ui/PerformanceThemeUtils.js`** centralizes palette catalogs, transition defaults,
  easing presets, normalization, equality checks, and theme diffing helpers.
- **`src/ui/PerformanceThemePanel.js`** lets operators swap curated palettes, tweak accent
  overrides, adjust bloom strength, and dial transition curves before broadcasting the
  normalized theme state through the hub.

### Theme Host & Persistence
- **`src/ui/PerformanceSuiteHost.js`** caches active themes, re-applies them whenever the
  engine switches (faceted, quantum, holographic, polychora), and pushes CSS variables into
  the global stylesheet so the glow animates consistently.
- Presets and show planner cues persist theme snapshots—including transition metadata—so
  palettes, fades, and overrides travel between rehearsals and venues.

### Performance Suite Shell & Styling
- **`src/ui/PerformanceSuite.js`** orchestrates module instantiation, status messaging,
  import/export, hub wiring, and exposes suite state for extensions.
- **`styles/performance.css`** delivers the stage-ready UI: gradient panels, glowing buttons,
  theme-aware borders, planner accents, and the newly added timeline visuals.

## Documentation
- **`DOCS/PERFORMANCE_SUITE_REFERENCE.md`** describes the module layout, feature set, and
  data contracts for integrators.
- **`DOCS/PERFORMANCE_SUITE_DEVELOPMENT_NOTES.md`** (this memo) captures the motivations,
  cross-module wiring, and upgrade history—including the latest timeline overview.

## Intended Future Enhancements
- **Network Sync:** WebRTC/OSC bridge for multi-machine playback so VJs, lighting consoles,
  and projection systems stay locked to the same cue clock.
- **OSC & HID Expansion:** Extend the hardware bridge to WebHID/OSC devices, enabling
  cross-rig sync with lighting desks or alternative controllers.
- **DMX & Lighting Hooks:** Export theme palettes and cue timings over Art-Net/sACN to sync
  moving lights and LED walls with projection cues.
- **Gesture Macros:** Allow pads to trigger macro scripts (e.g., burst transitions, layered
  parameter sweeps) beyond single-parameter mappings.
- **Show Analytics:** Capture performance logs (trigger times, manual overrides) for post-show
  review and to refine choreography.

These notes should help reviewers, collaborators, and future contributors understand the full
surface area of the performance suite and the roadmap ahead.
