/**
 * VIB34D Parameter Synchronization Fix
 * Implements UI CONTROLS MASTER strategy for parameter persistence
 */

// STRATEGY: UI Controls Master - Systems sync to UI on switch
// This ensures user intent is preserved and UX is predictable

function createParameterSyncSystem() {
    
    // Get all current UI parameter values
    function getCurrentUIParameterState() {
        const parameterIds = [
            'rot4dXW', 'rot4dYW', 'rot4dZW', 
            'gridDensity', 'morphFactor', 'chaos', 
            'speed', 'hue', 'intensity', 'saturation'
        ];
        
        const currentState = {};
        parameterIds.forEach(paramId => {
            const slider = document.getElementById(paramId);
            if (slider) {
                currentState[paramId] = parseFloat(slider.value);
                console.log(`📊 UI State: ${paramId} = ${currentState[paramId]}`);
            }
        });
        
        return currentState;
    }
    
    // Sync visualizer to current UI state
    function syncVisualizerToUI(system, engine) {
        const uiState = getCurrentUIParameterState();
        
        console.log(`🔄 Syncing ${system} system to UI parameter state...`);
        
        // Apply each parameter to the system
        for (const [param, value] of Object.entries(uiState)) {
            try {
                // Use the existing updateParameter flow but force it to the specific engine
                if (system === 'faceted' && engine.parameterManager) {
                    engine.parameterManager.setParameter(param, value);
                } else if (system === 'quantum' && engine.updateParameter) {
                    engine.updateParameter(param, value);
                } else if (system === 'holographic' && engine.updateParameters) {
                    const params = {};
                    params[param] = value;
                    engine.updateParameters(params);
                } else if (system === 'polychora' && engine.updateParameter) {
                    engine.updateParameter(param, value);
                }
                
                console.log(`   ✅ ${param}: ${value} → ${system}`);
                
            } catch (error) {
                console.warn(`   ⚠️ ${param} sync failed for ${system}:`, error.message);
            }
        }
        
        // Update UI displays to match (in case there's any drift)
        updateAllDisplays(uiState);
        
        console.log(`✅ ${system} system synced to UI state`);
    }
    
    // Update all parameter displays
    function updateAllDisplays(uiState) {
        const displayMappings = {
            rot4dXW: 'xwValue',
            rot4dYW: 'ywValue', 
            rot4dZW: 'zwValue',
            gridDensity: 'densityValue',
            morphFactor: 'morphValue',
            chaos: 'chaosValue',
            speed: 'speedValue',
            hue: 'hueValue',
            intensity: 'intensityValue',
            saturation: 'saturationValue'
        };
        
        for (const [param, displayId] of Object.entries(displayMappings)) {
            const display = document.getElementById(displayId);
            const value = uiState[param];
            
            if (display && value !== undefined) {
                if (param === 'hue') {
                    display.textContent = value + '°';
                } else if (param.startsWith('rot4d')) {
                    display.textContent = value.toFixed(2);
                } else {
                    display.textContent = value.toFixed(1);
                }
            }
        }
    }
    
    // Enhanced switchSystem function with parameter sync
    function createEnhancedSwitchSystem(originalSwitchSystem) {
        return async function(system) {
            console.log(`🎯 Enhanced switchSystem called with: ${system}`);
            
            // Call original switch system logic
            await originalSwitchSystem(system);
            
            // After system switch, sync visualizer to UI state
            const engines = {
                faceted: window.engine,
                quantum: window.quantumEngine,
                holographic: window.holographicSystem,
                polychora: window.polychoraSystem
            };
            
            const engine = engines[system];
            if (engine) {
                // Small delay to ensure system is ready
                setTimeout(() => {
                    syncVisualizerToUI(system, engine);
                }, 200);
            }
        };
    }
    
    return {
        getCurrentUIParameterState,
        syncVisualizerToUI,
        updateAllDisplays,
        createEnhancedSwitchSystem
    };
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createParameterSyncSystem };
} else if (typeof window !== 'undefined') {
    window.createParameterSyncSystem = createParameterSyncSystem;
}