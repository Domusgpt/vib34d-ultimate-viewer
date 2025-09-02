/**
 * VIB34D Main Application Controller
 * Handles system switching, UI coordination, and global state management
 */

export class VIB34DApp {
    constructor() {
        this.currentSystem = 'faceted';
        this.userParameterState = {};
        this.isInitialized = false;
        
        // Make essential functions globally accessible
        this.setupGlobalFunctions();
    }

    setupGlobalFunctions() {
        // System switching function
        window.switchSystem = async (system) => {
            console.log(`🎯 switchSystem called with: ${system}`);
            
            // SIMPLE CANVAS MANAGER: Destroy old, create new
            if (window.canvasManager) {
                try {
                    console.log(`🔄 Switching to ${system} system...`);
                    const newEngine = await window.canvasManager.switchToSystem(system, window.engineClasses);
                    
                    if (newEngine) {
                        console.log(`✅ ${system} system ready with engine`);
                        
                        // Update global state and UI
                        window.currentSystem = system;
                        this.currentSystem = system;
                        
                        // Update ReactivityManager with new active system
                        if (window.reactivityManager) {
                            window.reactivityManager.setActiveSystem(system, newEngine);
                        }
                        
                        // CRITICAL: Sync new engine to current UI parameter state
                        setTimeout(() => {
                            if (window.syncVisualizerToUI) {
                                window.syncVisualizerToUI(system, newEngine);
                            } else {
                                console.warn('⚠️ syncVisualizerToUI function not available');
                            }
                        }, 300); // Small delay for system initialization
                        
                        // Update UI buttons
                        document.querySelectorAll('.system-btn').forEach(btn => {
                            btn.classList.toggle('active', btn.dataset.system === system);
                        });
                        
                        // Update panel header
                        const headers = {
                            faceted: 'FACETED SYSTEM',
                            quantum: 'QUANTUM SYSTEM', 
                            holographic: 'HOLOGRAPHIC SYSTEM',
                            polychora: 'POLYCHORA SYSTEM'
                        };
                        const panelHeader = document.getElementById('panelHeader');
                        if (panelHeader) panelHeader.textContent = headers[system] || 'VIB34D SYSTEM';
                        
                        // CRITICAL FIX: Update geometry buttons for the new system
                        if (window.setupGeometry) {
                            window.setupGeometry(system);
                            console.log(`🎯 Updated geometry buttons for ${system} system`);
                        }
                        
                        console.log(`✅ Switched to ${system} system successfully`);
                        return; // Success - exit early
                    } else if (system === 'polychora') {
                        console.log(`🔮 Polychora system not implemented yet`);
                        return; // Expected for polychora
                    } else {
                        console.error(`❌ ${system} engine failed to create`);
                    }
                } catch (error) {
                    console.error(`❌ Failed to switch to ${system}:`, error);
                }
            }
            
            // If we get here, CanvasManager failed - this is an error
            console.error(`💥 CanvasManager failed for ${system} - system may not work properly`);
        };

        // Geometry selection function
        window.selectGeometry = (index) => {
            document.querySelectorAll('.geom-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.index == index);
            });
            
            if (window.updateParameter) {
                window.updateParameter('geometry', index);
            }
        };

        // Parameter sync system - UI Controls Master Strategy
        window.userParameterState = this.userParameterState;
        
        // Enhanced parameter update that preserves user intent
        window.enhancedUpdateParameter = (param, value) => {
            // Store user's parameter choice
            this.userParameterState[param] = parseFloat(value);
            console.log(`💾 User set ${param} = ${value}`);
            
            // Call original updateParameter
            if (window.originalUpdateParameter) {
                window.originalUpdateParameter(param, value);
            }
        };
        
        // Get all current UI parameter values (prefers user-stored values)
        window.getCurrentUIParameterState = () => {
            const parameterIds = [
                'rot4dXW', 'rot4dYW', 'rot4dZW', 
                'gridDensity', 'morphFactor', 'chaos', 
                'speed', 'hue', 'intensity', 'saturation'
            ];
            
            const currentState = {};
            parameterIds.forEach(paramId => {
                // PREFER: User-stored values over slider defaults
                if (this.userParameterState[paramId] !== undefined) {
                    currentState[paramId] = this.userParameterState[paramId];
                } else {
                    // FALLBACK: Get current slider value
                    const slider = document.getElementById(paramId);
                    if (slider) {
                        currentState[paramId] = parseFloat(slider.value);
                        console.log(`📊 UI read ${paramId} = ${slider.value} (from slider)`);
                    }
                }
            });
            
            return currentState;
        };

        // Sync sliders to stored values
        window.syncSlidersToStoredValues = () => {
            console.log('🔄 Syncing sliders to stored values...');
            
            Object.entries(this.userParameterState).forEach(([param, value]) => {
                const slider = document.getElementById(param);
                if (slider && !isNaN(value)) {
                    slider.value = value;
                    
                    // Update display value
                    const display = slider.parentElement?.querySelector('.control-value');
                    if (display) {
                        display.textContent = value;
                    }
                    
                    console.log(`🔄 Synced ${param} slider to ${value}`);
                } else if (!slider) {
                    console.warn(`⚠️ Slider not found for parameter: ${param}`);
                }
            });
        };

        // Function to sync visualizer to UI state
        window.syncVisualizerToUI = (systemName, engine) => {
            console.log(`🔄 Syncing ${systemName} visualizer to UI state...`);
            
            const currentParams = window.getCurrentUIParameterState();
            console.log('📊 Current UI parameter state:', currentParams);
            
            // Apply each parameter to the visualizer
            Object.entries(currentParams).forEach(([param, value]) => {
                if (window.updateParameter) {
                    window.updateParameter(param, value);
                    console.log(`✅ Applied ${param} = ${value} to ${systemName}`);
                }
            });
            
            console.log(`✅ ${systemName} visualizer synced to UI`);
        };
        
        // Device Tilt Functions for 4D Rotation Control
        window.toggleDeviceTilt = async () => {
            if (!window.deviceTiltHandler) {
                console.warn('🎯 Device tilt handler not available');
                return false;
            }
            
            const tiltBtn = document.getElementById('tiltBtn');
            
            if (window.deviceTiltHandler.isEnabled) {
                // Disable tilt
                window.deviceTiltHandler.disable();
                if (tiltBtn) {
                    tiltBtn.style.background = '';
                    tiltBtn.title = 'Device Tilt (4D Rotation)';
                }
                console.log('🎯 Device tilt disabled');
                return false;
            } else {
                // Enable tilt
                const enabled = await window.deviceTiltHandler.enable();
                if (enabled) {
                    if (tiltBtn) {
                        tiltBtn.style.background = 'linear-gradient(45deg, #00ffff, #0099ff)';
                        tiltBtn.style.color = '#000';
                        tiltBtn.title = 'Device Tilt Active - Tilt device to control 4D rotation!';
                    }
                    console.log('🎯 Device tilt enabled');
                    return true;
                } else {
                    console.warn('🎯 Device tilt failed to enable');
                    return false;
                }
            }
        };
        
        // Update base rotations for tilt system when parameters change
        window.updateTiltBaseRotations = () => {
            if (window.deviceTiltHandler && this.userParameterState) {
                window.deviceTiltHandler.updateBaseRotation(
                    this.userParameterState.rot4dXW || 0,
                    this.userParameterState.rot4dYW || 0,
                    this.userParameterState.rot4dZW || 0
                );
            }
        };
    }

    // Initialize the application
    async initialize() {
        console.log('🚀 Initializing VIB34D Application...');
        
        try {
            // Initialize CanvasManager if needed
            if (!window.canvasManager) {
                try {
                    console.log('🔧 Initializing CanvasManager...');
                    const { CanvasManager } = await import('../../src/core/CanvasManager.js');
                    window.canvasManager = new CanvasManager();
                    console.log('✅ CanvasManager initialized');
                } catch (error) {
                    console.warn('⚠️ CanvasManager not available:', error.message);
                    // Create a stub so the app doesn't crash
                    window.canvasManager = {
                        switchToSystem: async () => {
                            console.log('⚠️ CanvasManager stub: switchToSystem called');
                            return null;
                        }
                    };
                }
            }
            
            // Initialize ReactivityManager if needed
            if (!window.reactivityManager) {
                try {
                    console.log('🔧 Initializing ReactivityManager...');
                    const { ReactivityManager } = await import('../../src/core/ReactivityManager.js');
                    window.reactivityManager = new ReactivityManager();
                    console.log('✅ ReactivityManager initialized');
                } catch (error) {
                    console.warn('⚠️ ReactivityManager not available:', error.message);
                    // Create a stub so the app doesn't crash
                    window.reactivityManager = {
                        setActiveSystem: () => {},
                        setMouseMode: () => {},
                        toggleMouse: () => {},
                        setClickMode: () => {},
                        toggleClick: () => {},
                        setScrollMode: () => {},
                        toggleScroll: () => {}
                    };
                }
            }
            
            // Initialize global geometries from GeometryLibrary
            try {
                console.log('🔧 Initializing global geometries...');
                const { GeometryLibrary } = await import('../../src/geometry/GeometryLibrary.js');
                
                window.geometries = {
                    faceted: GeometryLibrary.getGeometryNames(),
                    quantum: GeometryLibrary.getGeometryNames(),
                    holographic: GeometryLibrary.getGeometryNames(),
                    polychora: GeometryLibrary.getGeometryNames()
                };
                
                console.log('✅ Global geometries initialized with 9 geometries each:', window.geometries);
            } catch (error) {
                console.warn('⚠️ GeometryLibrary not available, using fallback:', error.message);
                // Create fallback geometry arrays
                window.geometries = {
                    faceted: ['TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS', 'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL', 'HYPERTETRAHEDRON'],
                    quantum: ['TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS', 'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL', 'HYPERTETRAHEDRON'],
                    holographic: ['TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS', 'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL', 'HYPERTETRAHEDRON'],
                    polychora: ['TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS', 'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL', 'HYPERTETRAHEDRON']
                };
            }
            
            this.isInitialized = true;
            console.log('✅ VIB34D Application initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize VIB34D Application:', error);
            throw error;
        }
    }

    // Get current system state
    getCurrentSystem() {
        return this.currentSystem;
    }

    // Update parameter in user state
    updateParameter(param, value) {
        this.userParameterState[param] = parseFloat(value);
        console.log(`💾 Parameter updated: ${param} = ${value}`);
    }

    // Get current parameter state
    getParameterState() {
        return { ...this.userParameterState };
    }
}

export default VIB34DApp;