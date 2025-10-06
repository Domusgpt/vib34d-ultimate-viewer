# Performance Suite Architecture & Feature Guide

This document summarizes the live control system that powers the upgraded performance suite,
explains how each module cooperates during shows, and records follow-on ideas that should keep
the tool evolving for touring crews.

## Top-Level Layout

The suite mounts inside `PerformanceSuite` and is composed of three stacked columns:

* **Multi-touch pad column** – driven by `TouchPadController`, exposes every pad mapping,
  axis curve, invert toggle, smoothing window, pad count, and pad template selector.
* **Audio & atmosphere column** – hosts the `PerformanceThemePanel`, `AudioReactivityPanel`,
  `PerformanceMidiBridge`, and new `PerformanceOscBridge` stack so palette, audio reactivity,
  hardware mappings, and outbound network relays live in the same lane.
* **Library & planner column** – renders the `PerformancePresetManager` for snapshots / playlists
  and the `PerformanceShowPlanner` for choreographing cues, sequences, and live playback.

`PerformanceSuite` also mediates shared state by wiring a `PerformanceHub` event bus, publishing
status notices, persisting module state, and exposing import/export helpers for external tools.

### Responsive Layout & Ergonomics

* The suite now renders a mobile tab bar (Control Deck, Audio & Atmosphere, Library & Planner)
  when the viewport width drops below the configurable breakpoint. Selecting a tab switches the
  active column while keeping the other modules mounted, so multi-touch pads remain usable on
  phones and small tablets.
* Every stack inside the columns ships with a collapsible header that surfaces a quick summary
  (“Multi-touch surfaces, templates, and axis response”, “OSC/WebSocket relays and remote
  diagnostics”, etc.). Toggling the header updates the suite status badge for quick operator
  feedback and sets `aria-expanded`/`aria-hidden` attributes for assistive tech.
* Layout defaults (`mobileBreakpoint`, `defaultPanel`, `collapsedStacks`) live under
  `PerformanceConfig.layout`, letting custom builds tune when the mobile nav activates or which
  stacks start collapsed.
* A dedicated Layout & Display panel lets operators adjust interface density, pad surface scale,
  column emphasis, text sizing, the responsive breakpoint, and now trigger viewport preview modes.
  Layout choices persist between sessions (including collapsed stack states and the last preview
  mode) so the suite reopens with the preferred ergonomics on every device.
* Responsive styling in `styles/performance.css` tightens padding, reflows the header, and adjusts
  toggle density so the suite remains ergonomic in portrait orientations without sacrificing the
  stage-ready aesthetic.

## Module Responsibilities

### Layout & Display Controls

* `PerformanceLayoutPanel` exposes interface density, pad surface scaling, text size, column
  emphasis profiles, and viewport preview toggles (Live/Desktop/Tablet/Phone) alongside the default
  mobile panel selector. It writes changes through the layout storage key so ergonomics—and preview
  choices—persist between reloads and across engine swaps.
* Preview selections call into `PerformanceSuite.applyPreviewMode`, which constrains the shell width,
  flips responsive mode, and surfaces status messaging without needing external device emulation.
* Layout adjustments drive a dedicated CSS variable map (`--performance-shell-padding`,
  `--performance-column-template`, `--performance-pad-min-width`, etc.), ensuring spacing and sizing
  refresh instantly without forcing module reinitialization.

### Parameter & Mapping Control

* `TouchPadController` normalizes pad templates, allows performers to rename pads, change axis
  assignments through the filtered parameter palette, and tune per-axis response curves, inversion,
  and smoothing. Layout templates, pad count controls, and gesture processing are synchronized
  through the shared hub.
* Touch pad metadata (labels, tags, curve defaults) originate from `PerformanceConfig` so new
  controllers inherit curated mappings with minimal setup time.

### Audio Reactivity

* `AudioReactivityPanel` captures live mic / line-in settings including beat sync, smoothing,
  sensitivity, per-band weighting, and flourish trigger thresholding. Settings are broadcast over the
  hub and handed directly to the active engine via `setLiveAudioSettings`.

### Hardware Controllers

* `PerformanceMidiBridge` detects Web MIDI devices, surfaces input selection, and provides a “learn”
  workflow so any CC message can be bound to suite parameters. Incoming values are smoothed and
  normalized before driving `ParameterManager.setParameter` calls to avoid sudden jumps.
* Hardware mappings persist in `localStorage`, emit `hardware:midi-value` hub events, and are bundled
  into presets so tactile rigs reload alongside pad layouts and audio settings.

### Network / OSC Bridge

* `PerformanceOscBridge` exposes a WebSocket-powered relay so hub events stream to external tools
  such as OSC translators, lighting consoles, or secondary operator dashboards.
* Operators can toggle which event families forward (touch pads, audio reactivity, presets, show cues,
  hardware, gestures, and theme updates), adjust the OSC-style namespace, and enable auto-connect.
* A rolling message log, status badge, and manual heartbeat trigger provide quick diagnostics when
  verifying remote listeners before a show.

### Gesture Capture & Playback

* `PerformanceGestureRecorder` records touch pad and MIDI gestures into timestamped takes with
  smoothing, export/import helpers, and playback scheduling. It publishes library summaries over the
  hub and re-injects parameter values when clips are played.
* Gesture takes can be assigned to show planner cues; playback automatically fires when cues trigger,
  allowing choreographed flourishes to sit alongside presets, playlists, and audio-reactive changes.

### Live Telemetry & Diagnostics

* `PerformanceTelemetryPanel` visualizes real-time 4D rotation vectors, dynamic parameters, and
  incoming control pulses from touch pads, MIDI devices, gesture playback, and cue triggers.
* Rotation energy and activity indices are trended in a compact history list so operators can review
  how aggressively pads or hardware are driving the engine mid-show.

### Presets & Library Management

* `PerformancePresetManager` snapshots the entire live state (pads, audio, show planner, and theme
  palette). It persists the library, generates playlist metadata with active theme badges, and can
  replay presets while optionally letting the show planner override themes.
* Theme data saved with each preset contains normalized transition curves so fades restore with the
  same timing dialed in during rehearsal, and gesture libraries are bundled so flourish clips travel
  with shows.

### Show Planner & Cue Playback

* `PerformanceShowPlanner` stores tempo, looping, cue stacks, manual notes, and integrates tightly
  with the preset library for quick lookups.
* Each cue captures its theme strategy (hold current, adopt preset palette, enforce a palette
  override, or lock the current glow), along with preset ID, gesture take, duration (beats),
  auto-advance flag, and run-state metadata.
* Cue editors expose transition duration/easing selectors plus gesture drop-downs fed by the recorder
  so flourishes auto-play when cues fire. Transition metadata and gesture IDs travel with exports,
  hub events, and manual trigger actions.
* The planner’s run controls support start/stop, prev/next, looping, auto-advance, tempo changes,
  and keyboard shortcuts while emitting status badges and timeline notifications across the suite.

### Theme & Atmosphere System

* `PerformanceThemePanel` centralizes palette selection, accent overrides, highlight bloom, glow
  strength, and now transition timing. The slider + easing selector update CSS variables so the entire
  dashboard animates between palettes with consistent cross-fades.
* Theme state (palette, overrides, transition) is cached in `PerformanceSuiteHost`. The host keeps
  settings alive while engines swap, reapplies them to every system tab, and exports normalized theme
  bundles for extensions.
* `PerformanceThemeUtils` standardizes default palettes, easing presets, transition normalization,
  and palette resolution so every module works from the same schema.

### Styling & Atmosphere

* `styles/performance.css` delivers the glow-heavy aesthetic, gradient backgrounds, and responsive
  layout for each module. With this update, the sheet uses new transition variables so backgrounds,
  borders, badges, and status pills animate smoothly whenever palettes or cues change.

## Cross-Module Messaging

* `PerformanceHub` brokers touch pad gestures, audio reactivity updates, preset loads, playlist
  events, show planner triggers, and theme updates. Modules subscribe to only the messages they need
  and never directly mutate each other’s state.
* `PerformanceSuiteHost` exposes the suite to every rendering system (faceted, quantum, holographic,
  polychora). It snapshots module state during engine teardown, reapplies it when engines boot, and
  updates CSS variables for accent, highlight, glow, and transition timing.

## Storage & Persistence

* Touch pad layouts, audio settings, themes, preset libraries, playlists, and show planner stacks
  all persist via `localStorage` using keys defined in `PerformanceConfig`.
* Export/import helpers are available through the hub so external extensions (OSC bridges, MIDI
  routers, timeline sequencers) can sync or drive the same state objects.

## Latest Enhancements (This Iteration)

* Introduced the `PerformanceLayoutPanel` with density, pad surface scale, text sizing, and column
  emphasis controls so the suite can be tuned for club booths, festival FOH, or rehearsal studios in
  seconds.
* Persist layout preferences (including collapsed stacks and default mobile panel) via the shared
  layout storage key, allowing ergonomics to follow operators as engines swap or browsers reload.
* Refactored `styles/performance.css` to consume layout-driven CSS variables, ensuring responsive
  spacing, pad sizing, and typography react instantly to panel adjustments without reinitializing
  modules.
* Expanded documentation and visual QA flows to cover layout profiles, responsive breakpoint tuning,
  and regression sweeps across the new density and scale ranges.

## Future Ideas & Extensions

* **Cue Timeline Editor:** add a drag-and-drop timeline with beat snapping for planners who want to
  schedule cues visually against a song structure.
* **Network Sync:** build on the OSC bridge to coordinate multiple operators (lighting, visuals, VJ)
  over WebRTC/WebSocket with session leadership and cue clock sharing.
* **Analytics Overlay:** capture gesture heat maps, cue trigger history, and audio-reactivity stats
  to refine presets after each performance.
* **Automation Scripts:** expose a scripting layer for pre/post cue hooks (e.g., trigger lighting
  macros, fire DMX scenes, schedule automated theme sweeps).
* **Gesture Morphing:** blend between multiple gesture takes with weighted curves so performers can
  improvise transitions between recorded flourishes.

Keeping this document updated will help onboarding operators, integrators, and future contributors
understand how the suite fits together and where the roadmap is heading.
