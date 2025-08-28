/**
 * VIB34D Quantum System - Complete modular implementation
 * ULTRA PRESERVATION: Every visual effect, shader, parameter, and interaction preserved EXACTLY
 */

export class QuantumSystem {
    constructor() {
        this.name = 'quantum';
        this.isActive = false;
        this.isInitialized = false;
        
        // Canvas management - EXACT same IDs as index.html
        this.canvasIds = [
            'quantum-background-canvas',
            'quantum-shadow-canvas', 
            'quantum-content-canvas',
            'quantum-highlight-canvas',
            'quantum-accent-canvas'
        ];
        
        // Engine and UI components
        this.engine = null;
        this.visualizers = [];
        this.parameters = new Map();
        
        // Geometry configuration exactly like index.html - QUANTUM ENHANCED
        this.geometries = [
            'Quantum Tetra', 'Quantum Cube', 'Quantum Sphere',
            'Quantum Torus', 'Quantum Klein', 'Quantum Fractal', 
            'Quantum Wave', 'Quantum Crystal'
        ];
        
        console.log('🌌 QuantumSystem: Initialized with enhanced holographic effects');
    }

    /**
     * Initialize the Quantum system - PRESERVE ALL ORIGINAL FUNCTIONALITY
     */
    async initialize() {
        console.log('🌌 QuantumSystem: Starting initialization with complex 3D lattice');
        
        try {
            // Import engine exactly like index.html does
            const { QuantumEngine } = await import('../../src/quantum/QuantumEngine.js');
            
            // CRITICAL: Don't create engine yet - will be created on activation
            // This preserves the exact behavior of index.html
            this.QuantumEngine = QuantumEngine;
            
            // Setup geometry UI exactly like index.html
            this.setupGeometry();
            
            // Initialize enhanced quantum parameters exactly like index.html
            this.initializeParameters();
            
            this.isInitialized = true;
            console.log('✅ QuantumSystem: Initialization complete with enhanced holographic effects');
            return true;
        } catch (error) {
            console.error('❌ QuantumSystem: Initialization failed:', error);
            return false;
        }
    }

    /**
     * Activate the Quantum system - PRESERVE EXACT VISUAL EFFECTS
     */
    async activate() {
        console.log('🌌 QuantumSystem: Activating with complex 3D lattice functions');
        
        try {
            // Create engine if not exists (exactly like index.html does)
            if (!this.engine) {
                await this.createEngine();
            }
            
            // Show canvas layers
            this.showCanvasLayers();
            
            // Activate engine with EXACT parameters from original
            if (this.engine) {
                this.engine.isActive = true;
                this.engine.setActive(true); // Quantum engine specific activation
                
                // Start render loop exactly like index.html
                if (this.engine.startRenderLoop) {
                    this.engine.startRenderLoop();
                }
                
                // Force all visualizers to start rendering - CRITICAL for gallery preview
                if (this.engine.visualizers) {
                    this.engine.visualizers.forEach(visualizer => {
                        if (visualizer && visualizer.gl) {
                            visualizer.isActive = true;
                        }
                    });
                }
                
                // Make globally accessible for gallery/viewer integration
                window.quantumEngine = this.engine;
            }
            
            // Update UI state
            this.updateUI();
            
            this.isActive = true;
            console.log('✅ QuantumSystem: Activated successfully with enhanced holographic mode');
            return true;
        } catch (error) {
            console.error('❌ QuantumSystem: Activation failed:', error);
            return false;
        }
    }

    /**
     * Deactivate the Quantum system
     */
    async deactivate() {
        console.log('🌌 QuantumSystem: Deactivating');
        
        try {
            // Deactivate engine
            if (this.engine) {
                this.engine.isActive = false;
                this.engine.setActive(false); // Quantum engine specific deactivation
                
                // Stop render loop
                if (this.engine.stopRenderLoop) {
                    this.engine.stopRenderLoop();
                }
            }
            
            // Hide canvas layers
            this.hideCanvasLayers();
            
            this.isActive = false;
            console.log('✅ QuantumSystem: Deactivated successfully');
            return true;
        } catch (error) {
            console.error('❌ QuantumSystem: Deactivation failed:', error);
            return false;
        }
    }

    /**
     * Create engine exactly like index.html does - PRESERVE ALL QUANTUM ENHANCEMENTS
     */
    async createEngine() {
        console.log('🌌 QuantumSystem: Creating engine with enhanced quantum effects');
        
        try {
            // Create engine with exact parameters from index.html
            this.engine = new this.QuantumEngine();
            
            // Wait for initialization (quantum engine auto-initializes)
            // The engine creates visualizers in constructor
            
            if (this.engine.visualizers && this.engine.visualizers.length > 0) {
                // Make visualizers accessible
                this.visualizers = this.engine.visualizers;
                
                // Setup parameter listeners exactly like index.html
                this.setupParameterListeners();
                
                console.log(`✅ QuantumSystem: Engine created with ${this.visualizers.length} enhanced quantum visualizers`);
                return true;
            } else {
                throw new Error('Quantum engine initialization failed - no visualizers created');
            }
        } catch (error) {
            console.error('❌ QuantumSystem: Engine creation failed:', error);
            this.engine = null;
            return false;
        }
    }

    /**
     * Show canvas layers for this system - EXACT layer management
     */
    showCanvasLayers() {
        const layers = document.getElementById('quantumLayers');
        if (layers) {
            layers.style.display = 'block';
            layers.style.visibility = 'visible';
            layers.style.opacity = '1';
            console.log('🌌 QuantumSystem: Canvas layers visible with enhanced effects');
        }
    }

    /**
     * Hide canvas layers for this system
     */
    hideCanvasLayers() {
        const layers = document.getElementById('quantumLayers');
        if (layers) {
            layers.style.display = 'none';
            layers.style.visibility = 'hidden';
            layers.style.opacity = '0';
            console.log('🌌 QuantumSystem: Canvas layers hidden');
        }
    }

    /**
     * Setup geometry UI exactly like index.html - QUANTUM ENHANCED NAMES
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
        
        console.log('🌌 QuantumSystem: Quantum geometry UI setup complete');
    }

    /**
     * Initialize enhanced quantum parameters exactly like index.html
     */
    initializeParameters() {
        // QUANTUM ENHANCED default parameters - exactly like QuantumEngine
        const defaultParams = {
            geometry: 0,
            rot4dXW: 0,
            rot4dYW: 0, 
            rot4dZW: 0,
            gridDensity: 20,      // Higher density for quantum
            morphFactor: 1.0,
            chaos: 0.2,
            speed: 1.0,
            hue: 280,             // Purple-blue for quantum
            intensity: 0.7,       // Higher intensity
            saturation: 0.9       // More vivid
        };
        
        Object.entries(defaultParams).forEach(([param, value]) => {
            this.parameters.set(param, value);
        });
        
        console.log('🌌 QuantumSystem: Enhanced quantum parameters initialized');
    }

    /**
     * Setup parameter listeners exactly like index.html
     */
    setupParameterListeners() {
        // CRITICAL: Quantum system needs to hook into global parameter updates
        const originalUpdateParameter = window.updateParameter;
        
        window.updateParameter = (param, value) => {
            // If quantum system is active, handle the parameter
            if (window.systemManager && window.systemManager.getCurrentSystemName() === 'quantum') {
                this.updateParameter(param, value);
            } else if (originalUpdateParameter) {
                // Pass through to other systems
                originalUpdateParameter(param, value);
            }
        };
        
        // CRITICAL: Quantum system needs to hook into global geometry selection
        const originalSelectGeometry = window.selectGeometry;
        
        window.selectGeometry = (index) => {
            // If quantum system is active, handle the geometry selection
            if (window.systemManager && window.systemManager.getCurrentSystemName() === 'quantum') {
                this.selectGeometry(index);
            } else if (originalSelectGeometry) {
                // Pass through to other systems
                originalSelectGeometry(index);
            }
        };
    }

    /**
     * Update parameter exactly like index.html - PRESERVE ALL QUANTUM EFFECTS
     */
    updateParameter(param, value) {
        console.log(`🌌 QuantumSystem: Updating ${param} = ${value} with enhanced quantum processing`);
        
        // Store parameter
        this.parameters.set(param, value);
        
        // Update UI display
        this.updateParameterDisplay(param, value);
        
        // Update engine if active - CRITICAL for quantum effects
        if (this.engine && this.isActive) {
            try {
                // Quantum engine has enhanced parameter processing
                this.engine.updateParameter(param, value);
                
                // CRITICAL: Force immediate render for gallery preview mode
                if (window.isGalleryPreview && this.engine.render) {
                    this.engine.render();
                }
            } catch (error) {
                console.warn(`🌌 QuantumSystem: Parameter update failed for ${param}:`, error);
            }
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
     * Select geometry exactly like index.html - QUANTUM ENHANCED
     */
    selectGeometry(index) {
        console.log(`🌌 QuantumSystem: Selecting quantum geometry ${index} (${this.geometries[index]})`);
        
        // Update UI
        document.querySelectorAll('.geom-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.index == index);
        });
        
        // Update parameter with quantum enhancement
        this.updateParameter('geometry', index);
    }

    /**
     * Update UI for this system - SHOW QUANTUM FEATURES
     */
    updateUI() {
        // Show geometry section for quantum system
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
     * Force render for gallery preview mode - CRITICAL for quantum effects
     */
    forceRender() {
        if (this.engine && this.engine.render) {
            // Call render multiple times to ensure quantum animation starts
            for (let i = 0; i < 5; i++) {
                setTimeout(() => this.engine.render(), i * 10);
            }
            console.log('🌌 QuantumSystem: Force render triggered for gallery preview with enhanced effects');
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
            geometries: this.geometries.length,
            enhanced: true,  // Quantum system marker
            effects: ['complex_3d_lattice', 'holographic_shimmer', 'volumetric_lighting', 'rgb_glitch', 'hsv_colors']
        };
    }
}