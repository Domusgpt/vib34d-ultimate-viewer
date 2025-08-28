/**
 * VIB34D SystemManager - Unified system coordination
 * Preserves 100% gallery and viewer functionality while providing clean modular architecture
 */

export class SystemManager {
    constructor() {
        this.systems = new Map();
        this.currentSystem = null;
        this.currentSystemName = 'faceted';
        this.isInitialized = false;
        
        // Preserve critical global state for gallery/viewer integration
        this.galleryMode = false;
        this.hideUI = false;
        this.parameterBridge = null;
    }

    /**
     * Initialize SystemManager with exact index.html behavior preservation
     */
    async initialize() {
        console.log('🚀 SystemManager: Initializing with preserved gallery/viewer integration');
        
        // CRITICAL: Parse URL parameters EXACTLY like index.html does
        this.parseURLParameters();
        
        // Initialize parameter bridge for cross-system communication
        this.parameterBridge = new ParameterBridge();
        
        // Mark as initialized
        this.isInitialized = true;
        
        // Make globally accessible for gallery/viewer integration
        window.systemManager = this;
        window.switchSystem = this.switchSystem.bind(this);
        
        console.log('✅ SystemManager: Ready with preserved integrations');
        return true;
    }

    /**
     * CRITICAL: Exact URL parameter parsing from index.html to preserve gallery functionality
     */
    parseURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check if this is a gallery preview (EXACT match to index.html:602-720)
        if (urlParams.has('system')) {
            const targetSystem = urlParams.get('system');
            this.hideUI = urlParams.get('hideui') === 'true';
            
            // Store gallery preview data exactly like index.html
            const parameters = {};
            urlParams.forEach((value, key) => {
                if (!['system', 'hideui', 'alllayers', 'highquality'].includes(key)) {
                    parameters[key] = parseFloat(value) || value;
                }
            });
            
            const allLayers = urlParams.get('alllayers') === 'true';
            const highQuality = urlParams.get('highquality') === 'true';
            if (allLayers || highQuality) {
                window.forceAllLayers = true;
                window.forceHighQuality = true;
            }
            
            // CRITICAL: Store exactly like index.html for gallery compatibility
            window.galleryPreviewData = {
                system: targetSystem,
                parameters: parameters,
                hideUI: this.hideUI
            };
            
            window.isGalleryPreview = true;
            window.currentSystem = targetSystem;
            this.currentSystemName = targetSystem;
            this.galleryMode = true;
            
            console.log('🎨 SystemManager: Gallery preview mode detected:', window.galleryPreviewData);
        }
    }

    /**
     * Register a system module
     */
    async registerSystem(name, SystemClass) {
        console.log(`📝 SystemManager: Registering ${name} system`);
        
        try {
            const system = new SystemClass();
            
            // Initialize the system
            await system.initialize();
            
            // Store the system
            this.systems.set(name, system);
            
            console.log(`✅ SystemManager: ${name} system registered successfully`);
            return true;
        } catch (error) {
            console.error(`❌ SystemManager: Failed to register ${name} system:`, error);
            return false;
        }
    }

    /**
     * CRITICAL: Switch between systems with exact index.html behavior
     * This preserves gallery iframe switching and viewer integration
     */
    async switchSystem(systemName) {
        console.log(`🎯 SystemManager: Switching to ${systemName} system`);
        
        try {
            // Get target system
            const targetSystem = this.systems.get(systemName);
            if (!targetSystem) {
                console.error(`❌ SystemManager: System ${systemName} not found`);
                return false;
            }
            
            // Deactivate current system
            if (this.currentSystem && this.currentSystem !== targetSystem) {
                console.log(`🔄 SystemManager: Deactivating ${this.currentSystemName}`);
                await this.currentSystem.deactivate();
            }
            
            // CRITICAL: Canvas layer management exactly like index.html
            this.updateCanvasLayers(systemName);
            
            // Activate new system
            console.log(`🔄 SystemManager: Activating ${systemName}`);
            await targetSystem.activate();
            
            // Update state
            this.currentSystem = targetSystem;
            this.currentSystemName = systemName;
            window.currentSystem = systemName; // Global state for gallery/viewer
            
            // CRITICAL: Update UI exactly like index.html does
            this.updateSystemUI(systemName);
            
            // CRITICAL: Apply gallery preview parameters if in gallery mode
            if (window.galleryPreviewData) {
                await this.applyGalleryPreviewData();
            }
            
            console.log(`✅ SystemManager: Successfully switched to ${systemName}`);
            return true;
        } catch (error) {
            console.error(`❌ SystemManager: Failed to switch to ${systemName}:`, error);
            return false;
        }
    }

    /**
     * CRITICAL: Canvas layer management exactly like index.html
     * Preserves gallery iframe rendering and viewer functionality
     */
    updateCanvasLayers(activeSystem) {
        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
        
        systems.forEach(system => {
            const layerId = system === 'faceted' ? 'vib34dLayers' : `${system}Layers`;
            const layers = document.getElementById(layerId);
            
            if (layers) {
                const shouldShow = system === activeSystem;
                layers.style.display = shouldShow ? 'block' : 'none';
                
                // CRITICAL: For gallery previews, also set visibility and opacity
                if (window.isGalleryPreview) {
                    layers.style.visibility = shouldShow ? 'visible' : 'hidden';
                    layers.style.opacity = shouldShow ? '1' : '0';
                }
                
                console.log(`🎯 SystemManager: ${system} layers → ${shouldShow ? 'VISIBLE' : 'HIDDEN'}`);
            }
        });
    }

    /**
     * CRITICAL: Update UI exactly like index.html does
     * Preserves button states and panel headers
     */
    updateSystemUI(systemName) {
        // Update button states
        document.querySelectorAll('.system-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.system === systemName);
        });
        
        // Update panel header
        const headers = {
            faceted: 'FACETED SYSTEM',
            quantum: 'QUANTUM SYSTEM', 
            holographic: 'HOLOGRAPHIC SYSTEM',
            polychora: 'POLYCHORA SYSTEM'
        };
        
        const panelHeader = document.querySelector('.panel-header span') || 
                          document.getElementById('panelHeader');
        if (panelHeader) {
            panelHeader.textContent = headers[systemName] || 'VIB34D SYSTEM';
        }
    }

    /**
     * CRITICAL: Apply gallery preview data exactly like index.html
     * Preserves iframe parameter synchronization
     */
    async applyGalleryPreviewData() {
        const previewData = window.galleryPreviewData;
        if (!previewData) return;
        
        console.log('🎨 SystemManager: Applying gallery preview parameters');
        
        // Apply parameters exactly like index.html does
        Object.entries(previewData.parameters).forEach(([param, value]) => {
            if (param === 'geometry' || param === 'geometryType' || param === 'polytope') {
                const geometryIndex = parseInt(value);
                if (!isNaN(geometryIndex) && window.selectGeometry) {
                    window.selectGeometry(geometryIndex);
                }
            } else {
                // Parameter mapping
                const parameterMapping = {
                    'geometryType': 'geometry',
                    'density': 'gridDensity', 
                    'morph': 'morphFactor'
                };
                
                const actualParam = parameterMapping[param] || param;
                
                // Update slider and apply parameter
                const slider = document.getElementById(actualParam);
                if (slider) {
                    slider.value = value;
                    if (window.updateParameter) {
                        window.updateParameter(actualParam, value);
                    }
                }
            }
        });
        
        // Force render for gallery preview
        if (this.currentSystem && this.currentSystem.forceRender) {
            this.currentSystem.forceRender();
        }
    }

    /**
     * Update parameter across all systems
     */
    updateParameter(param, value) {
        if (this.parameterBridge) {
            this.parameterBridge.updateParameter(param, value);
        }
        
        // Apply to current system immediately
        if (this.currentSystem && this.currentSystem.updateParameter) {
            this.currentSystem.updateParameter(param, value);
        }
    }

    /**
     * Get current system
     */
    getCurrentSystem() {
        return this.currentSystem;
    }

    /**
     * Get current system name
     */
    getCurrentSystemName() {
        return this.currentSystemName;
    }
}

/**
 * Parameter Bridge - handles cross-system parameter communication
 */
class ParameterBridge {
    constructor() {
        this.parameters = new Map();
        this.subscribers = new Set();
    }

    updateParameter(param, value) {
        this.parameters.set(param, value);
        
        // Notify all subscribers
        this.subscribers.forEach(subscriber => {
            if (subscriber.updateParameter) {
                subscriber.updateParameter(param, value);
            }
        });
    }

    subscribe(system) {
        this.subscribers.add(system);
    }

    unsubscribe(system) {
        this.subscribers.delete(system);
    }

    getParameter(param) {
        return this.parameters.get(param);
    }
}