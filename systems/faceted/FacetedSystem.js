/**
 * VIB34D Faceted System - Complete modular implementation
 * Preserves ALL functionality from original index.html
 */

import { TopologyLibrary } from '../../src/core/TopologyLibrary.js';

export class FacetedSystem {
    constructor() {
        this.name = 'faceted';
        this.isActive = false;
        this.isInitialized = false;
        
        // Canvas management
        this.canvasIds = [
            'background-canvas',
            'shadow-canvas', 
            'content-canvas',
            'highlight-canvas',
            'accent-canvas'
        ];
        
        // Engine and UI components
        this.engine = null;
        this.visualizers = [];
        this.parameters = new Map();
        
        // Geometry configuration exactly like index.html
        this.geometries = [
            'Tetra', 'Cube', 'Sphere',
            'Torus', 'Klein', 'Fractal', 
            'Wave', 'Crystal'
        ];
        
        console.log('🔷 FacetedSystem: Initialized');
    }

    /**
     * Initialize the Faceted system
     */
    async initialize() {
        console.log('🔷 FacetedSystem: Starting initialization');
        
        try {
            // Import engine exactly like index.html does
            const { VIB34DIntegratedEngine } = await import('../../src/core/Engine.js');
            
            // CRITICAL: Don't create engine yet - will be created on activation
            // This preserves the exact behavior of index.html
            this.VIB34DIntegratedEngine = VIB34DIntegratedEngine;
            
            // Setup geometry UI exactly like index.html
            this.setupGeometry();
            
            // Initialize default parameters exactly like index.html
            this.initializeParameters();
            
            this.isInitialized = true;
            console.log('✅ FacetedSystem: Initialization complete');
            return true;
        } catch (error) {
            console.error('❌ FacetedSystem: Initialization failed:', error);
            return false;
        }
    }

    /**
     * Activate the Faceted system
     */
    async activate() {
        console.log('🔷 FacetedSystem: Activating');
        
        try {
            // Create engine if not exists (exactly like index.html does)
            if (!this.engine) {
                await this.createEngine();
            }
            
            // Show canvas layers
            this.showCanvasLayers();
            
            // Activate engine
            if (this.engine) {
                this.engine.isActive = true;
                
                // Start render loop exactly like index.html
                if (this.engine.startRenderLoop) {
                    this.engine.startRenderLoop();
                }
                
                // Make globally accessible for gallery/viewer integration
                window.engine = this.engine;
            }
            
            // Update UI state
            this.updateUI();
            
            this.isActive = true;
            console.log('✅ FacetedSystem: Activated successfully');
            return true;
        } catch (error) {
            console.error('❌ FacetedSystem: Activation failed:', error);
            return false;
        }
    }

    /**
     * Deactivate the Faceted system
     */
    async deactivate() {
        console.log('🔷 FacetedSystem: Deactivating');
        
        try {
            // Deactivate engine
            if (this.engine) {
                this.engine.isActive = false;
                
                // Stop render loop
                if (this.engine.stopRenderLoop) {
                    this.engine.stopRenderLoop();
                }
            }
            
            // Hide canvas layers
            this.hideCanvasLayers();
            
            this.isActive = false;
            console.log('✅ FacetedSystem: Deactivated successfully');
            return true;
        } catch (error) {
            console.error('❌ FacetedSystem: Deactivation failed:', error);
            return false;
        }
    }

    /**
     * Create engine exactly like index.html does
     */
    async createEngine() {
        console.log('🔷 FacetedSystem: Creating engine');
        
        try {
            // Create engine with exact parameters from index.html
            this.engine = new this.VIB34DIntegratedEngine();
            
            // Initialize with default parameters
            const success = await this.engine.initialize();
            
            if (success) {
                // Make visualizers accessible
                this.visualizers = this.engine.visualizers || [];

                // Setup parameter listeners exactly like index.html
                this.setupParameterListeners();

                this.syncTopologyParametersFromEngine();

                console.log('✅ FacetedSystem: Engine created successfully');
                return true;
            } else {
                throw new Error('Engine initialization failed');
            }
        } catch (error) {
            console.error('❌ FacetedSystem: Engine creation failed:', error);
            this.engine = null;
            return false;
        }
    }

    /**
     * Show canvas layers for this system
     */
    showCanvasLayers() {
        const layers = document.getElementById('vib34dLayers');
        if (layers) {
            layers.style.display = 'block';
            layers.style.visibility = 'visible';
            layers.style.opacity = '1';
            console.log('🔷 FacetedSystem: Canvas layers visible');
        }
    }

    /**
     * Hide canvas layers for this system
     */
    hideCanvasLayers() {
        const layers = document.getElementById('vib34dLayers');
        if (layers) {
            layers.style.display = 'none';
            layers.style.visibility = 'hidden';
            layers.style.opacity = '0';
            console.log('🔷 FacetedSystem: Canvas layers hidden');
        }
    }

    /**
     * Setup geometry UI exactly like index.html
     */
    setupGeometry() {
        const geometryGrid = document.getElementById('geometryGrid');
        if (!geometryGrid) return;
        
        geometryGrid.innerHTML = '';
        
        this.geometries.forEach((geom, index) => {
            const btn = document.createElement('button');
            btn.className = 'geom-btn';
            btn.textContent = geom;
            btn.dataset.index = index;
            btn.onclick = () => this.selectGeometry(index);
            
            // Set active state for default geometry (index 0)
            if (index === 0) {
                btn.classList.add('active');
            }
            
            geometryGrid.appendChild(btn);
        });
        
        console.log('🔷 FacetedSystem: Geometry UI setup complete');
    }

    /**
     * Initialize default parameters exactly like index.html
     */
    initializeParameters() {
        const defaultParams = {
            geometry: 0,
            rot4dXW: 0,
            rot4dYW: 0,
            rot4dZW: 0,
            rot4dXY: 0,
            rot4dXZ: 0,
            rot4dYZ: 0,
            gridDensity: 15,
            morphFactor: 1.0,
            chaos: 0.2,
            speed: 1.0,
            hue: 200,
            intensity: 0.5,
            saturation: 0.8
        };

        Object.entries(defaultParams).forEach(([param, value]) => {
            this.parameters.set(param, value);
        });

        const defaultFamily = TopologyLibrary.getFamilyForGeometry(defaultParams.geometry) ?? 0;
        const defaultVariant = TopologyLibrary.getDefaultVariantId(defaultFamily);
        const topologyDefaults = TopologyLibrary.getDefaults(defaultFamily, defaultVariant);

        this.parameters.set('topologyFamily', defaultFamily);
        this.parameters.set('topologyVariant', defaultVariant);
        this.parameters.set('topologyShellWidth', topologyDefaults.shellWidth);
        this.parameters.set('topologyPlaneThickness', topologyDefaults.planeThickness);

        console.log('🔷 FacetedSystem: Default parameters initialized');
    }

    /**
     * Setup parameter listeners exactly like index.html
     */
    setupParameterListeners() {
        // Make updateParameter globally accessible for slider events
        if (!window.updateParameter) {
            window.updateParameter = (param, value) => {
                if (window.systemManager && window.systemManager.getCurrentSystemName() === 'faceted') {
                    this.updateParameter(param, value);
                }
            };
        }
        
        // Make selectGeometry globally accessible
        if (!window.selectGeometry) {
            window.selectGeometry = (index) => {
                if (window.systemManager && window.systemManager.getCurrentSystemName() === 'faceted') {
                    this.selectGeometry(index);
                }
            };
        }

        if (!window.setTopologyFamily) {
            window.setTopologyFamily = (familyId) => {
                if (window.systemManager && window.systemManager.getCurrentSystemName() === 'faceted') {
                    this.updateParameter('topologyFamily', familyId);
                }
            };
        }

        if (!window.setTopologyVariant) {
            window.setTopologyVariant = (variantId) => {
                if (window.systemManager && window.systemManager.getCurrentSystemName() === 'faceted') {
                    this.updateParameter('topologyVariant', variantId);
                }
            };
        }

        if (!window.getTopologyFamilies) {
            window.getTopologyFamilies = () => {
                if (this.engine && this.engine.getTopologyFamilies) {
                    return this.engine.getTopologyFamilies();
                }
                return [];
            };
        }

        if (!window.getTopologyVariants) {
            window.getTopologyVariants = (familyId) => {
                if (this.engine && this.engine.getTopologyVariants) {
                    return this.engine.getTopologyVariants(familyId);
                }
                return [];
            };
        }

        if (!window.getTopologyVariantsForGeometry) {
            window.getTopologyVariantsForGeometry = (geometryIndex) => {
                if (this.engine && this.engine.getTopologyVariantsForGeometry) {
                    return this.engine.getTopologyVariantsForGeometry(geometryIndex);
                }
                return [];
            };
        }
    }

    /**
     * Update parameter exactly like index.html
     */
    updateParameter(param, value) {
        console.log(`🔷 FacetedSystem: Updating ${param} = ${value}`);
        
        // Store parameter
        this.parameters.set(param, value);
        
        // Update UI display
        this.updateParameterDisplay(param, value);
        
        // Update engine if active
        if (this.engine && this.isActive) {
            try {
                this.engine.updateParameter(param, value);
            } catch (error) {
                console.warn(`🔷 FacetedSystem: Parameter update failed for ${param}:`, error);
            }
        }

        if (param === 'geometry' || param === 'topologyFamily' || param === 'topologyVariant') {
            this.syncTopologyParametersFromEngine();
        }
    }

    /**
     * Update parameter display exactly like index.html
     */
    updateParameterDisplay(param, value) {
        // Update slider value
        const slider = document.getElementById(param);
        if (slider) {
            slider.value = value;
        }
        
        // Update value display
        const displays = {
            rot4dXW: 'xwValue',
            rot4dYW: 'ywValue',
            rot4dZW: 'zwValue',
            rot4dXY: 'xyValue',
            rot4dXZ: 'xzValue',
            rot4dYZ: 'yzValue',
            gridDensity: 'densityValue',
            morphFactor: 'morphValue',
            chaos: 'chaosValue',
            speed: 'speedValue',
            hue: 'hueValue',
            intensity: 'intensityValue',
            saturation: 'saturationValue'
        };
        
        const displayId = displays[param];
        if (displayId) {
            const display = document.getElementById(displayId);
            if (display) {
                if (param === 'hue') {
                    display.textContent = `${value}°`;
                } else if (param === 'gridDensity') {
                    display.textContent = value;
                } else {
                    display.textContent = parseFloat(value).toFixed(2);
                }
            }
        }
    }

    /**
     * Select geometry exactly like index.html
     */
    selectGeometry(index) {
        console.log(`🔷 FacetedSystem: Selecting geometry ${index} (${this.geometries[index]})`);
        
        // Update UI
        document.querySelectorAll('.geom-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.index == index);
        });
        
        // Update parameter
        this.updateParameter('geometry', index);
    }

    syncTopologyParametersFromEngine() {
        if (!this.engine || !this.engine.getTopologyState) {
            return;
        }

        const state = this.engine.getTopologyState();
        if (!state) {
            return;
        }

        this.parameters.set('topologyFamily', state.family);
        this.parameters.set('topologyVariant', state.variant);
        this.parameters.set('topologyShellWidth', state.shellWidth);
        this.parameters.set('topologyPlaneThickness', state.planeThickness);
    }

    /**
     * Update UI for this system
     */
    updateUI() {
        // Show geometry section for faceted system
        const geometrySection = document.getElementById('geometrySection');
        if (geometrySection) {
            geometrySection.style.display = 'block';
        }
        
        // Hide holographic section
        const holographicSection = document.getElementById('holographicSection');
        if (holographicSection) {
            holographicSection.style.display = 'none';
        }
    }

    /**
     * Force render for gallery preview mode
     */
    forceRender() {
        if (this.engine && this.engine.render) {
            // Call render multiple times to ensure animation starts
            for (let i = 0; i < 5; i++) {
                setTimeout(() => this.engine.render(), i * 10);
            }
            console.log('🔷 FacetedSystem: Force render triggered for gallery preview');
        }
    }

    /**
     * Get current parameters
     */
    getParameters() {
        return new Map(this.parameters);
    }

    /**
     * Get system info
     */
    getInfo() {
        return {
            name: this.name,
            isActive: this.isActive,
            isInitialized: this.isInitialized,
            hasEngine: !!this.engine,
            visualizerCount: this.visualizers.length,
            geometries: this.geometries.length
        };
    }
}