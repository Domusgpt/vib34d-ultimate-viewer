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
- **Live performance console** with multitouch pads, preset management, and choreographed flourishes

## 🎛️ Live Performance Extensions

The new **Live Performance Engine** transforms VIB34D into a stage-ready visualizer for DJs and bands:

- Three configurable multi-touch pads let you map any parameter to X, Y, pinch, or rotation axes using dropdown selectors.
- Expanded audio reactivity controls allow per-band toggles (bass/mid/high/energy) plus a master audio switch.
- Save, recall, and crossfade presets with custom transition times for choreographed scenes.
- Build flourish sequences by capturing keyframes, then trigger them manually or automatically when audio energy peaks.
- Reactive flourishes can be bound to specific frequency bands with adjustable thresholds and cooldowns for reliable stage playback.

Everything lives in a docked console near the bottom of the viewport so performers can manage visuals without leaving the browser window.

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