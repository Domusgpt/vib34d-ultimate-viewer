# Performance Suite Architecture & Feature Guide

This document summarizes the live control system that powers the upgraded performance suite,
explains how each module cooperates during shows, and records follow-on ideas that should keep
the tool evolving for touring crews.

## Top-Level Layout

The suite mounts inside `PerformanceSuite` and is composed of three stacked columns:

* **Multi-touch pad column** – driven by `TouchPadController`, exposes every pad mapping,
  axis curve, invert toggle, smoothing window, pad count, and pad template selector.
* **Audio & atmosphere column** – hosts the `PerformanceThemePanel`, `AudioReactivityPanel`, and
  new `PerformanceMidiBridge` stack so palette, audio reactivity, and hardware mappings live in the
  same lane.
* **Library & planner column** – renders the `PerformancePresetManager` for snapshots / playlists
  and the `PerformanceShowPlanner` for choreographing cues, sequences, and live playback.

`PerformanceSuite` also mediates shared state by wiring a `PerformanceHub` event bus, publishing
status notices, persisting module state, and exposing import/export helpers for external tools.

## Module Responsibilities

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

* Added the gesture recorder module with take management, export/import, and hub broadcasts so
  recorded flourishes can be replayed across the suite or external integrations.
* Presets, playlists, and show planner cues now persist both hardware mappings and gesture libraries
  to keep rigs and flourishes aligned when swapping shows or triggering cues mid-set.
* Extended the show planner with timeline overview, gesture selectors, and cue-triggered playback that
  respect tempo and auto-advance settings.
* Introduced the telemetry panel for real-time monitoring of 4D rotation energy, dynamic activity, and
  cross-module input pulses to help performers verify reactive behavior at a glance.

## Future Ideas & Extensions

* **OSC Bridge:** extend hardware messaging over OSC/WebRTC so lighting consoles and remote rigs can
  subscribe to the same cue + parameter events.
* **Cue Timeline Editor:** add a drag-and-drop timeline with beat snapping for planners who want to
  schedule cues visually against a song structure.
* **Network Sync:** broadcast hub events over WebRTC/WebSocket so multiple operators (lighting,
  visuals, VJ) can coordinate from separate devices.
* **Analytics Overlay:** capture gesture heat maps, cue trigger history, and audio-reactivity stats
  to refine presets after each performance.
* **Automation Scripts:** expose a scripting layer for pre/post cue hooks (e.g., trigger lighting
  macros, fire DMX scenes, schedule automated theme sweeps).
* **Gesture Morphing:** blend between multiple gesture takes with weighted curves so performers can
  improvise transitions between recorded flourishes.

Keeping this document updated will help onboarding operators, integrators, and future contributors
understand how the suite fits together and where the roadmap is heading.
