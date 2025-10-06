# Performance Suite Visual Testing Protocol

This checklist documents the manual sweeps we run whenever the live performance suite UI
changes. Follow these steps before shipping visual updates or when verifying bug fixes so the
stage-ready dashboard stays ergonomic across devices.

## 1. Pre-Flight Setup

1. Run `npm install` (if dependencies are missing) and start the viewer with `npm run dev`.
2. Open the viewer in a Chromium-based browser with device emulation tools available.
3. Clear `localStorage` keys prefixed with `vib34d-` to avoid stale presets or layout settings.
4. Load the performance suite via the control panel toggle to ensure every module mounts.

## 2. Viewport Sweep

Perform the following viewport checks, refreshing between each size if layout glitches appear:

| Viewport | Expectations |
| --- | --- |
| **1440×900 desktop** | Three-column layout visible, all stacks expanded, header copy readable. |
| **1024×768 tablet** | Mobile tab bar appears, "Control Deck" column active by default, other columns hidden. |
| **834×1112 portrait tablet** | Tabs stack into two rows, collapsible toggles remain accessible, pads stay usable. |
| **428×926 phone** | Tabs stack vertically, padding tightens, status badge stretches full width without overlap. |

At each breakpoint, confirm the mobile tab bar highlights the active column and that `aria-pressed`
updates in the accessibility tree (inspect with devtools).

## 3. Stack Collapse Behaviour

1. Expand and collapse each stack header (Touch Pads, Telemetry, Gestures, Theme, Audio,
   Hardware, Network, Presets, Planner).
2. Verify the suite status badge announces the action ("Touch Pads & Layout collapsed").
3. Ensure `aria-expanded`/`aria-hidden` toggle correctly in devtools.
4. Re-open collapsed stacks and confirm content renders without layout jumps.

## 4. Module Spot Checks

* **Touch Pads** – Change pad count, switch templates, and drag inside each pad to confirm
  pointer overlays stay aligned after responsive transitions.
* **Audio Reactivity** – Toggle enabled state and adjust smoothing sliders; verify labels wrap
  correctly on narrow widths.
* **Hardware Bridge** – Run the MIDI “learn” prompt; ensure dialogs stay inside the viewport.
* **Network Bridge** – Toggle the OSC relay, check the log area for overflow or clipped badges.
* **Telemetry & Gesture Recorder** – Confirm charts and lists resize without horizontal scroll.
* **Preset Manager & Show Planner** – Switch between presets, open cue editors, and verify the
  timeline progress bars remain legible on tablet widths.

## 5. Theme & Color Regression

1. Cycle through palette presets in the Color Atmosphere panel.
2. Override accent and glow sliders to ensure CSS variables propagate to headers, buttons, and
   the mobile tab bar.
3. Trigger a preset that changes the theme and verify the tab bar, stack toggles, and status badge
   animate to the new palette without flashes.

## 6. Accessibility & Keyboard

1. Tab through the mobile tab bar and stack toggles; focus rings should appear and match the
   accent color.
2. Use keyboard activation (`Enter`/`Space`) on stack toggles to confirm collapse behaviour mirrors
   pointer clicks.
3. Check that screen readers announce the stack headers as buttons with proper expanded state.

## 7. Capture & Reporting

* Take annotated screenshots for any anomalies, noting viewport size and reproduction steps.
* File regressions against the relevant module with screenshots attached.
* When fixes land, re-run the viewport sweep plus the affected module checklist before closing the issue.

Adhering to this protocol keeps the suite reliable for performers moving between laptops, tablets,
and phones during rehearsals and shows.
