# VIB34D Holographic Visualization Engine

A WebGL-based 4D mathematics visualization system with 4 different rendering engines.

## 🚀 Quick Start

```bash
# Clone and navigate
cd v2-refactored-mobile-fix

# Start local server
python3 -m http.server 8080

# Open in browser
http://localhost:8080/index-clean.html
```

### 🎯 Lattice Pulse – Mobile Roguelite

The **Lattice Pulse** mode now plays as an endless, audio-reactive roguelite run that reuses the faceted, quantum, and holographic renderers without spinning up extra WebGL contexts.

- Launch the PWA: `http://localhost:8080/lattice-pulse.html` and tap the start screen to arm audio playback. The game now requests microphone access so every spawn, directive, and shader nudge flows from whatever music is in the room; if access is denied the run falls back to geometry-specific groove patterns that keep the lattice alive until live audio returns.
- Each run descends through curated depth tiers—geometry + system pairings stay fixed per depth while difficulty, spawn density, and shader LOD scale dynamically with your score, combo, and survival time.
- Faceted, Quantum, and Holographic geometries react uniquely to the analyser stream: bass-heavy inputs build torus belts and tetra bursts, mids weave cube slides, highs lace sphere flares, and silence triggers their bespoke fallback cadences so “no music” still feels intentional instead of dead air.
- A new Event Director listens to bass/mid/high energy to schedule drops, glitch reversals, rhythm slowdowns, and quick-draw mini events that punctuate bridges and beat collapses.
- Audio-reactive micro directives now pop up during drops and bridges—swipe, pinch, or hold on command to earn bonus score, shields, and difficulty surges while the HUD blasts out WarioWare-style prompts.
- Controls: **tap** to pulse, **swipe** to steer 4D rotation, **pinch** for dimension shifts, **double-tap** to trigger a time-warp slow motion, **triple-tap** to cash in an extra life, **long-press** for a shielded phase shift, and optional **tilt** for drift correction.
- Runs as a deterministic 60 Hz loop with audio-driven spawns, adaptive LOD, and offline caching via `sw-lattice-pulse.js`; progress and best depth/scores persist locally.

## 🎮 The 4 Systems

**🔷 FACETED** - Simple 2D geometric patterns  
**🌌 QUANTUM** - Complex 3D lattice effects  
**✨ HOLOGRAPHIC** - Audio-reactive visualizations  
**🔮 POLYCHORA** - True 4D polytope mathematics  

Switch between systems using the top navigation buttons. All systems share the same 11-parameter control system.

## 📱 Mobile Support

Mobile performance is optimized. The system loads quickly on phones and runs at 45-60 FPS on most devices.

## 🎨 Features

- **Real-time 4D mathematics** with WebGL rendering
- **11 parameter control system** with live updates  
- **Gallery system** for saving/loading configurations
- **Trading card export** in multiple formats
- **Audio reactivity** in holographic system
- **Cross-system compatibility** - parameters work across all engines

## 🔧 Development

Main files:
- `index-clean.html` - Main interface (427 lines)
- `js/core/app.js` - System controller  
- `js/controls/ui-handlers.js` - Parameter controls
- `src/` - Engine implementations

CSS is modularized in `styles/` directory. All JavaScript uses ES6 modules with graceful fallbacks.

## 📊 Status

✅ All systems operational  
✅ Mobile optimized  
✅ No critical issues  
✅ Ready for use  

See `CLAUDE.md` for detailed documentation and `SYSTEM_STATUS.md` for current technical status.