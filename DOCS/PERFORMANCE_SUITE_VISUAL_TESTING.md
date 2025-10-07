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

> 💡 Tip: The Layout & Display panel now exposes **Viewport Preview** buttons (Live/Desktop/Tablet/Phone).
> Use them for quick breakpoint spot checks—the suite clamps to the simulated width, updates the status
> badge, and mirrors mobile tab behaviour without needing browser emulation.

## 3. Layout & Density Controls

1. Open the **Layout & Display** panel at the top of the Touch Pads stack.
2. Sweep the **Interface Density** slider from airy (0) to compact (100) and confirm column spacing,
   block padding, and pad grid gaps adjust smoothly without clipping content.
3. Drag the **Pad Surface Size** and **Text Scale** sliders; verify pad minimum widths grow/shrink,
   pad surface heights update, and typography scales while maintaining readability.
4. Cycle through each **Column Emphasis** profile and ensure column widths rebalance according to the
   description, with the suite status badge reporting "Layout updated".
5. Change the **Default Mobile Panel** and **Mobile Breakpoint**, reload the page, and confirm the
   selected panel becomes active on mobile viewports at the new breakpoint.
6. Collapse two stacks (e.g., Telemetry and Network), refresh the viewer, and verify they remain
   collapsed thanks to the persisted layout state.
7. Toggle each **Viewport Preview** button and confirm the suite constrains to 1440px (Desktop), 1024px
   (Tablet), and 428px (Phone) while updating the status badge with the selected mode. Return to **Live**
   to resume full-width behaviour.
8. Enter a name in **Saved Layout Profiles → Profile name**, press **Save New**, reload the page, and
   verify the new profile remains in the list with the status badge announcing "Layout profile saved".
9. Select the saved profile and choose **Apply**; confirm density/text/pad scale/default panel snap to
   the stored values, preview mode updates, and the status badge reports "Layout profile applied".
10. Adjust controls (e.g., increase Pad Surface Size), press **Update**, and confirm the profile summary
    reflects the new values. Use **Delete** to remove the profile and ensure the selector collapses to
    the remaining entry with a "Layout profile deleted" status message.
11. Use the **Column Order** Move Up/Move Down controls to reorder the columns (e.g., move Library &
    Planner to the first slot). Confirm the desktop grid reflows immediately, the "Columns:" summary
    updates, the mobile tab order matches the new sequence when switching to Tablet preview, and after
    refreshing the viewer the chosen order persists.

## 4. Stack Collapse Behaviour

1. Expand and collapse each stack header (Touch Pads, Telemetry, Gestures, Theme, Audio,
   Hardware, Network, Presets, Planner).
2. Verify the suite status badge announces the action ("Touch Pads & Layout collapsed").
3. Ensure `aria-expanded`/`aria-hidden` toggle correctly in devtools.
4. Re-open collapsed stacks and confirm content renders without layout jumps.

## 5. Module Spot Checks

* **Touch Pads** – Change pad count, switch templates, and drag inside each pad to confirm
  pointer overlays stay aligned after responsive transitions.
* **Audio Reactivity** – Toggle enabled state and adjust smoothing sliders; verify labels wrap
  correctly on narrow widths.
* **Hardware Bridge** – Run the MIDI “learn” prompt; ensure dialogs stay inside the viewport.
* **Network Bridge** – Toggle the OSC relay, check the log area for overflow or clipped badges.
* **Telemetry & Gesture Recorder** – Confirm charts and lists resize without horizontal scroll.
* **Preset Manager & Show Planner** – Switch between presets, open cue editors, and verify the
  timeline progress bars remain legible on tablet widths.

## 6. Theme & Color Regression

1. Cycle through palette presets in the Color Atmosphere panel.
2. Override accent and glow sliders to ensure CSS variables propagate to headers, buttons, and
   the mobile tab bar.
3. Trigger a preset that changes the theme and verify the tab bar, stack toggles, and status badge
   animate to the new palette without flashes.

## 7. Accessibility & Keyboard

1. Tab through the mobile tab bar and stack toggles; focus rings should appear and match the
   accent color.
2. Use keyboard activation (`Enter`/`Space`) on stack toggles to confirm collapse behaviour mirrors
   pointer clicks.
3. Check that screen readers announce the stack headers as buttons with proper expanded state.

## 8. Capture & Reporting

* Take annotated screenshots for any anomalies, noting viewport size and reproduction steps.
* File regressions against the relevant module with screenshots attached.
* When fixes land, re-run the viewport sweep plus the affected module checklist before closing the issue.

Adhering to this protocol keeps the suite reliable for performers moving between laptops, tablets,
and phones during rehearsals and shows.
