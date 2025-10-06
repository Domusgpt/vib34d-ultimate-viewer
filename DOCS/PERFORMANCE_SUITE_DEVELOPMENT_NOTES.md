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
- **Earlier enhancement:** presets capture hardware mappings alongside pads/audio so tactile
  rigs restore instantly when loading shows or planner cues.

### Network / OSC Bridge
- **`src/ui/PerformanceOscBridge.js`** opens a WebSocket connection to companion bridges or
  OSC gateways so suite events (touch pads, audio reactivity, presets, show cues, themes,
  hardware, and gestures) mirror to lighting desks or remote control rigs.
- Operators can toggle which event families forward, define a namespace for OSC-style
  addressing, enable auto-connect, and review a rolling message log to confirm traffic.
- Heartbeat triggers allow quick connectivity tests while disconnected events queue in the log
  for visibility, making it easier to diagnose when remote listeners fall offline mid-show.

### Telemetry & Diagnostics Monitor
- **`src/ui/PerformanceTelemetryPanel.js`** renders the new telemetry block that charts 4D
  rotation vectors, dimensional blend, speed, chaos, and intensity with live normalization.
- The panel listens to parameter change events plus hub pulses (`touchpad:update`,
  `hardware:midi-value`, gesture playback, and cue triggers) to show which subsystem is
  currently driving the engine.
- Rotation energy and activity indices are trended in a short history list so operators can
  confirm responsiveness during rehearsals or troubleshoot rigs mid-show.

### Gesture Recorder & Flourish Library
- **`src/ui/PerformanceGestureRecorder.js`** records touch pad and MIDI gestures with
  timestamped events, smoothing, and replay. Takes are persisted, exported/imported,
  and broadcast over the hub so extensions can mirror playback.
- Recording status updates feed the suite status badge while playback re-injects parameter
  values for quick flourish recall during shows.
- Gestures can be assigned to show planner cues, letting timed sequences fire curated motion
  sweeps alongside presets, playlists, and audio-reactive modulation.

## Library & Playback Stack

### Performance Preset Manager
- **`src/ui/PerformancePresetManager.js`** snapshots the entire suite state—pads, audio,
  show planner, theme palettes, and transition curves—into a persistent library with
  playlist support, renaming, tagging, and summary badges.
- Presets can be loaded without overriding the current theme when a cue specifically
  instructs the suite to “hold current glow.”
- **New in this revision:** gesture libraries are bundled with presets so live flourish
  clips travel with shows, MIDI rigs, and pad layouts.

### Show Planner & Cue Sequencer
- **`src/ui/PerformanceShowPlanner.js`** choreographs live sets with tempo, beats-per-bar,
  looping, cue stacks, notes, auto-advance, and keyboard shortcuts. Cues can trigger presets,
  adopt preset palettes, enforce palette overrides, hold the active theme, and now trigger
  specific gesture takes captured in the recorder.
- Theme transitions (duration + easing) were threaded end-to-end so cues can define how the
  glow fades between palettes.
- **Earlier enhancement:** a timeline overview renders estimated runtime, beat totals,
  per-cue progress bars, and highlights the currently running cue while surfacing preset accents
  for at-a-glance navigation.
- **New in this revision:** cue forms include gesture selectors that follow the recorder’s
  library and auto-play flourishes when cues fire, whether manually or via auto-advance.

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
  theme-aware borders, planner accents, the timeline visuals, and the latest responsive
  tweaks.
- **New in this revision:** the suite shell adds a Layout & Display panel with density, pad surface
  scale, text sizing, and column emphasis controls that persist through the shared layout storage
  key. Collapsed stack choices are now saved, and the stylesheet was refactored around layout-driven
  CSS variables so spacing, typography, and pad dimensions update live when operators tweak the
  controls. The panel now layers on viewport preview toggles (Live/Desktop/Tablet/Phone) wired into
  new `PerformanceSuite` preview utilities, letting operators simulate breakpoints with an inline
  width clamp and status messaging—perfect for mobile ergonomics and visual QA without leaving the
  dashboard.

## Documentation
- **`DOCS/PERFORMANCE_SUITE_REFERENCE.md`** describes the module layout, feature set, and
  data contracts for integrators.
- **`DOCS/PERFORMANCE_SUITE_DEVELOPMENT_NOTES.md`** (this memo) captures the motivations,
  cross-module wiring, and upgrade history—including the latest timeline overview and telemetry monitor.
- **`DOCS/PERFORMANCE_SUITE_VISUAL_TESTING.md`** outlines manual viewport sweeps, module
  collapse/expand checks, theming steps, and the new layout density/profile passes so visual
  regressions are easy to spot during QA.

## Intended Future Enhancements
- **Network Sync Director:** Layer on peer discovery and session leadership so multiple suites
  can sync cue clocks over the new OSC/WebSocket bridge for distributed crews.
- **OSC & HID Expansion:** Extend the hardware bridge to WebHID devices and add inbound OSC
  listeners so tactile rigs and lighting desks can drive suite parameters bi-directionally.
- **DMX & Lighting Hooks:** Export theme palettes and cue timings over Art-Net/sACN to sync
  moving lights and LED walls with projection cues.
- **Gesture Layers & Blending:** Stack multiple gesture takes with blend curves so performers
  can layer sweeps, ramp intensities, or fade between recorded clips during playback.
- **Show Analytics:** Capture performance logs (trigger times, manual overrides) for post-show
  review and to refine choreography.

These notes should help reviewers, collaborators, and future contributors understand the full
surface area of the performance suite and the roadmap ahead.
