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
- **Tap** to pulse captures, **swipe** to rotate 4D planes, **pinch** to shift dimensional depth, **long-press** to enter a slow-motion phase, and **tilt** (optional) for drift correction.
- Runs as a deterministic 60 Hz loop with beat-driven spawns (Suno BPM metadata) and offline caching via `sw-lattice-pulse.js`.
- Progression currently ships with three seedable level JSONs covering Faceted Torus, Quantum Sphere, and Holographic Crystal lattices—each targeting 60 FPS on modern phones.
- **Rogue-lite flow director** promotes endless depth climbs: difficulty, geometry biases, and score multipliers scale with every cleared section while preserving deterministic seeds.
- Dynamic events trigger from the analyser (drops, surges, silence, vocals) introducing glitch rushes, reverse flicks, tempo flips, quick-draw taps, and charge/extra-life challenges with on-screen prompts.
- Double taps bank slow-motion charges, long-press converts high combos into extra lives, and audio-reactive LOD ensures the lattice stays silky even when the beat hits.

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