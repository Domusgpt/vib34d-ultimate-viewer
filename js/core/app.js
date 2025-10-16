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
                'rot4dXW', 'rot4dYW', 'rot4dZW', 'rot4dXY', 'rot4dXZ', 'rot4dYZ',
                'dimension', 'gridDensity', 'morphFactor', 'chaos',
                'speed', 'hue', 'intensity', 'saturation',
                'topologyFamily', 'topologyVariant'
            ];

            const currentState = {};
            parameterIds.forEach(paramId => {
                if (this.userParameterState[paramId] !== undefined) {
                    currentState[paramId] = this.userParameterState[paramId];
                    return;
                }

                const element = document.getElementById(paramId);
                if (element) {
                    const rawValue = element.value;
                    const numericValue = element.tagName === 'SELECT'
                        ? parseInt(rawValue, 10)
                        : parseFloat(rawValue);

                    if (!Number.isNaN(numericValue)) {
                        currentState[paramId] = numericValue;
                    }
                    return;
                }

                if (window.engine?.parameterManager && typeof window.engine.parameterManager.getParameter === 'function') {
                    const engineValue = window.engine.parameterManager.getParameter(paramId);
                    if (engineValue !== undefined) {
                        currentState[paramId] = engineValue;
                    }
                }
            });

            return currentState;
        };

        // Sync sliders to stored values
        window.syncSlidersToStoredValues = () => {
            console.log('🔄 Syncing sliders to stored values...');

            Object.entries(this.userParameterState).forEach(([param, value]) => {
                const element = document.getElementById(param);
                if (!element || Number.isNaN(value)) {
                    if (!element) {
                        console.warn(`⚠️ Control not found for parameter: ${param}`);
                    }
                    return;
                }

                element.value = value;

                const display = element.parentElement?.querySelector('.control-value');
                if (display) {
                    display.textContent = value;
                }

                console.log(`🔄 Synced ${param} control to ${value}`);
            });
        };

        // Function to sync visualizer to UI state
        window.syncVisualizerToUI = (systemName, engine) => {
            console.log(`🔄 Syncing ${systemName} visualizer to UI state...`);

            window.syncSlidersToStoredValues();
            const currentParams = window.getCurrentUIParameterState();
            console.log('📊 Current UI parameter state:', currentParams);

            Object.entries(currentParams).forEach(([param, value]) => {
                try {
                    if (systemName === 'faceted' && engine?.parameterManager) {
                        engine.parameterManager.setParameter(param, value);
                    } else if (systemName === 'quantum' && typeof engine?.updateParameter === 'function') {
                        engine.updateParameter(param, value);
                    } else if (systemName === 'holographic' && typeof engine?.updateParameters === 'function') {
                        engine.updateParameters({ [param]: value });
                    } else if (systemName === 'polychora' && typeof engine?.updateParameter === 'function') {
                        engine.updateParameter(param, value);
                    } else if (typeof window.updateParameter === 'function') {
                        window.updateParameter(param, value);
                    }
                } catch (error) {
                    console.warn(`⚠️ ${param} sync failed for ${systemName}:`, error);
                }
            });

            if (typeof window.updateAllParameterDisplays === 'function') {
                window.updateAllParameterDisplays(currentParams);
            }

            if (window.deviceTiltHandler) {
                window.deviceTiltHandler.updateBaseRotation({
                    rot4dXW: currentParams.rot4dXW || 0,
                    rot4dYW: currentParams.rot4dYW || 0,
                    rot4dZW: currentParams.rot4dZW || 0,
                    rot4dXY: currentParams.rot4dXY || 0,
                    rot4dXZ: currentParams.rot4dXZ || 0,
                    rot4dYZ: currentParams.rot4dYZ || 0
                });

                window.deviceTiltHandler.updateBaseParameters({
                    dimension: currentParams.dimension || 3.5,
                    morphFactor: currentParams.morphFactor || 1.0,
                    chaos: currentParams.chaos || 0.2,
                    intensity: currentParams.intensity || 0.8,
                    gridDensity: currentParams.gridDensity || 15
                });
            }

            if (typeof window.injectReactivityState === 'function') {
                window.injectReactivityState(systemName, engine);
            }

            setTimeout(() => {
                if (typeof window.restoreAllToggleStates === 'function') {
                    window.restoreAllToggleStates();
                }

                setTimeout(() => {
                    if (typeof window.synchronizeEngineStates === 'function') {
                        window.synchronizeEngineStates();
                    }
                }, 200);
            }, 400);

            if (typeof window.syncTopologyUI === 'function') {
                window.syncTopologyUI();
            }

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
                window.deviceTiltHandler.updateBaseRotation({
                    rot4dXW: this.userParameterState.rot4dXW || 0,
                    rot4dYW: this.userParameterState.rot4dYW || 0,
                    rot4dZW: this.userParameterState.rot4dZW || 0,
                    rot4dXY: this.userParameterState.rot4dXY || 0,
                    rot4dXZ: this.userParameterState.rot4dXZ || 0,
                    rot4dYZ: this.userParameterState.rot4dYZ || 0
                });

                window.deviceTiltHandler.updateBaseParameters({
                    dimension: this.userParameterState.dimension || 3.5,
                    morphFactor: this.userParameterState.morphFactor || 1.0,
                    chaos: this.userParameterState.chaos || 0.2,
                    intensity: this.userParameterState.intensity || 0.8,
                    gridDensity: this.userParameterState.gridDensity || 15
                });
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