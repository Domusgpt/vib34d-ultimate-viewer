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

### 🎯 Lattice Pulse – Mobile Game

The new **Lattice Pulse** mode turns the faceted/quantum/holographic renderers into a rhythm-arcade loop.

- Launch the PWA: `http://localhost:8080/lattice-pulse.html`
- Tap the start screen to unlock audio and begin.
- **Tap** to pulse captures, **swipe** to rotate 4D planes, **pinch** to shift dimensional depth, **double-tap** to trigger slow-motion, **long-press** to enter a phase shield, and **tilt** (optional) for drift correction.
- Stage-based **rogue-lite climb**: the selected geometry/system stays fixed for the run while beats, density, and chaos scale every stage.
- Audio-reactive director now detects drops, bridges, lulls, silences, rhythm shifts, and vocal spikes to inject WarioWare-style directives—Pulse Blast bursts, Hold the Phase, Swipe Sync, Freeze windows, and Quick Draws—layered atop the beat grid with bombastic callouts, glitches, reverses, and tempo warps.
- Earn and spend pulse charges for slow-motion or bonus lives via double-tap specials, bank directive rewards for density/tempo boosts, track local best stages/scores, and keep the run going endlessly on any track.
- Runs as a deterministic 60 Hz loop with beat-driven spawns (Suno BPM metadata) and offline caching via `sw-lattice-pulse.js`.
- Ships with faceted, quantum, and holographic templates seeded for the rogue run starter set—each targeting 60 FPS on modern phones.

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