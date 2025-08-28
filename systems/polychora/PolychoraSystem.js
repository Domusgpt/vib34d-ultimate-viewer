/**
 * VIB34D Polychora System - Complete modular implementation
 * ULTRA PRESERVATION: Every 4D polytope, glassmorphic effect, mathematical function preserved EXACTLY
 */

export class PolychoraSystem {
    constructor() {
        this.name = 'polychora';
        this.isActive = false;
        this.isInitialized = false;
        
        // Canvas management - EXACT same IDs as index.html
        this.canvasIds = [
            'polychora-background-canvas',
            'polychora-shadow-canvas', 
            'polychora-content-canvas',
            'polychora-highlight-canvas',
            'polychora-accent-canvas'
        ];
        
        // Engine and UI components
        this.engine = null;
        this.visualizers = [];
        this.parameters = new Map();
        
        // 4D Polytope configuration exactly like index.html
        this.polytopes = [
            '5-Cell', 'Tesseract', '16-Cell',
            '24-Cell', '600-Cell', '120-Cell'
        ];
        
        console.log('🔮 PolychoraSystem: Initialized with true 4D polytope mathematics');
    }

    /**
     * Initialize the Polychora system - PRESERVE ALL 4D MATHEMATICS
     */
    async initialize() {
        console.log('🔮 PolychoraSystem: Starting initialization with glassmorphic 4D polytopes');
        
        try {
            // Import engine exactly like index.html does
            const { PolychoraSystem: PolychoraEngine } = await import('../../src/core/PolychoraSystem.js');
            
            // CRITICAL: Don't create engine yet - will be created on activation
            // This preserves the exact behavior of index.html
            this.PolychoraEngine = PolychoraEngine;
            
            // Setup polytope UI exactly like index.html
            this.setupPolytopes();
            
            // Initialize 4D parameters exactly like index.html
            this.initializeParameters();
            
            this.isInitialized = true;
            console.log('✅ PolychoraSystem: Initialization complete with 4D polytope mathematics');
            return true;
        } catch (error) {
            console.error('❌ PolychoraSystem: Initialization failed:', error);
            return false;
        }
    }

    /**
     * Activate the Polychora system - PRESERVE EXACT 4D MATHEMATICS
     */
    async activate() {
        console.log('🔮 PolychoraSystem: Activating with glassmorphic 4D polytope rendering');
        
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
                
                // Polychora system may have specific activation method
                if (this.engine.setActive) {
                    this.engine.setActive(true);
                }
                
                // Start render loop exactly like index.html
                if (this.engine.startRenderLoop) {
                    this.engine.startRenderLoop();
                } else if (this.engine.render) {
                    // Start manual render loop for Polychora
                    this.startRenderLoop();
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
                window.polychoraSystem = this.engine;
            }
            
            // Update UI state
            this.updateUI();
            
            this.isActive = true;
            console.log('✅ PolychoraSystem: Activated successfully with glassmorphic 4D polytope rendering');
            return true;
        } catch (error) {
            console.error('❌ PolychoraSystem: Activation failed:', error);
            return false;
        }
    }

    /**
     * Deactivate the Polychora system
     */
    async deactivate() {
        console.log('🔮 PolychoraSystem: Deactivating');
        
        try {
            // Stop render loop
            if (this.renderLoopId) {
                cancelAnimationFrame(this.renderLoopId);
                this.renderLoopId = null;
            }
            
            // Deactivate engine
            if (this.engine) {
                this.engine.isActive = false;
                
                if (this.engine.setActive) {
                    this.engine.setActive(false);
                }
                
                // Stop render loop
                if (this.engine.stopRenderLoop) {
                    this.engine.stopRenderLoop();
                }
            }
            
            // Hide canvas layers
            this.hideCanvasLayers();
            
            this.isActive = false;
            console.log('✅ PolychoraSystem: Deactivated successfully');
            return true;
        } catch (error) {
            console.error('❌ PolychoraSystem: Deactivation failed:', error);
            return false;
        }
    }

    /**
     * Create engine exactly like index.html does - PRESERVE ALL 4D POLYTOPE EFFECTS
     */
    async createEngine() {
        console.log('🔮 PolychoraSystem: Creating engine with glassmorphic 4D polytope mathematics');
        
        try {
            // Create engine with exact parameters from index.html
            this.engine = new this.PolychoraEngine();
            
            // Initialize the polychora engine
            const success = this.engine.initialize ? await this.engine.initialize() : true;
            
            if (success && this.engine) {
                // Make visualizers accessible if they exist
                if (this.engine.visualizers) {
                    this.visualizers = this.engine.visualizers;
                } else {
                    // Polychora might not expose visualizers directly
                    this.visualizers = [];
                }
                
                // Setup parameter listeners exactly like index.html
                this.setupParameterListeners();
                
                console.log(`✅ PolychoraSystem: Engine created with glassmorphic 4D polytope rendering`);
                return true;
            } else {
                throw new Error('Polychora engine initialization failed');
            }
        } catch (error) {
            console.error('❌ PolychoraSystem: Engine creation failed:', error);
            this.engine = null;
            return false;
        }
    }

    /**
     * Start manual render loop for Polychora system
     */
    startRenderLoop() {
        const renderFrame = () => {
            if (this.isActive && this.engine && this.engine.render) {
                try {
                    this.engine.render();
                } catch (error) {
                    console.warn('🔮 PolychoraSystem: Render error:', error);
                }
            }
            
            if (this.isActive) {
                this.renderLoopId = requestAnimationFrame(renderFrame);
            }
        };
        
        this.renderLoopId = requestAnimationFrame(renderFrame);
        console.log('🔮 PolychoraSystem: Manual render loop started');
    }

    /**
     * Show canvas layers for this system - EXACT layer management
     */
    showCanvasLayers() {
        const layers = document.getElementById('polychoraLayers');
        if (layers) {
            layers.style.display = 'block';
            layers.style.visibility = 'visible';
            layers.style.opacity = '1';
            console.log('🔮 PolychoraSystem: Canvas layers visible with glassmorphic 4D effects');
        }
    }

    /**
     * Hide canvas layers for this system
     */
    hideCanvasLayers() {
        const layers = document.getElementById('polychoraLayers');
        if (layers) {
            layers.style.display = 'none';
            layers.style.visibility = 'hidden';
            layers.style.opacity = '0';
            console.log('🔮 PolychoraSystem: Canvas layers hidden');
        }
    }

    /**
     * Setup polytope UI exactly like index.html - 4D POLYTOPE NAMES
     */
    setupPolytopes() {
        const geometryGrid = document.getElementById('geometryGrid');
        if (!geometryGrid) return;
        
        geometryGrid.innerHTML = '';
        
        this.polytopes.forEach((polytope, index) => {
            const btn = document.createElement('button');
            btn.className = 'geom-btn';
            btn.textContent = polytope;
            btn.dataset.index = index;
            btn.onclick = () => this.selectPolytope(index);
            
            // Set active state for default polytope (index 0)
            if (index === 0) {
                btn.classList.add('active');
            }
            
            geometryGrid.appendChild(btn);
        });
        
        console.log('🔮 PolychoraSystem: 4D polytope UI setup complete');
    }

    /**
     * Initialize 4D parameters exactly like index.html
     */
    initializeParameters() {
        // 4D POLYTOPE specific parameters - glassmorphic theme
        const defaultParams = {
            geometry: 0,        // Actually polytope index for polychora
            rot4dXW: 0,         // CRITICAL: 4D rotations are key for polytopes
            rot4dYW: 0, 
            rot4dZW: 0,
            gridDensity: 25,    // Higher density for complex polytopes
            morphFactor: 1.0,
            chaos: 0.1,         // Lower chaos for clean polytope math
            speed: 0.8,         // Slower for contemplation
            hue: 45,            // Orange/gold for polytopes
            intensity: 0.4,     // Subtle intensity for glass effect
            saturation: 0.7     // Moderate saturation
        };
        
        Object.entries(defaultParams).forEach(([param, value]) => {
            this.parameters.set(param, value);
        });
        
        console.log('🔮 PolychoraSystem: 4D polytope parameters initialized');
    }

    /**
     * Setup parameter listeners exactly like index.html
     */
    setupParameterListeners() {
        // CRITICAL: Polychora system needs to hook into global parameter updates
        const originalUpdateParameter = window.updateParameter;
        
        window.updateParameter = (param, value) => {
            // If polychora system is active, handle the parameter
            if (window.systemManager && window.systemManager.getCurrentSystemName() === 'polychora') {
                this.updateParameter(param, value);
            } else if (originalUpdateParameter) {
                // Pass through to other systems
                originalUpdateParameter(param, value);
            }
        };
        
        // CRITICAL: Polychora system needs to hook into global polytope selection
        const originalSelectGeometry = window.selectGeometry;
        
        window.selectGeometry = (index) => {
            // If polychora system is active, handle as polytope selection
            if (window.systemManager && window.systemManager.getCurrentSystemName() === 'polychora') {
                this.selectPolytope(index);
            } else if (originalSelectGeometry) {
                // Pass through to other systems
                originalSelectGeometry(index);
            }
        };
    }

    /**
     * Update parameter exactly like index.html - PRESERVE ALL 4D MATHEMATICS
     */
    updateParameter(param, value) {
        console.log(`🔮 PolychoraSystem: Updating ${param} = ${value} with 4D polytope mathematics`);
        
        // Store parameter
        this.parameters.set(param, value);
        
        // Update UI display
        this.updateParameterDisplay(param, value);
        
        // Update engine if active - CRITICAL for 4D effects
        if (this.engine && this.isActive) {
            try {
                // Polychora engine parameter update
                if (this.engine.updateParameter) {
                    this.engine.updateParameter(param, value);
                } else if (this.engine.setParameter) {
                    this.engine.setParameter(param, value);
                } else {
                    // Direct update for specific 4D parameters
                    this.updatePolychoraParameter(param, value);
                }
                
                // CRITICAL: Force immediate render for gallery preview mode
                if (window.isGalleryPreview && this.engine.render) {
                    this.engine.render();
                }
            } catch (error) {
                console.warn(`🔮 PolychoraSystem: Parameter update failed for ${param}:`, error);
            }
        }
    }

    /**
     * Update polychora-specific parameters
     */
    updatePolychoraParameter(param, value) {
        // Handle 4D-specific parameter updates
        if (param.startsWith('rot4d') && this.engine.setRotation) {
            const rotations = {
                rot4dXW: this.parameters.get('rot4dXW') || 0,
                rot4dYW: this.parameters.get('rot4dYW') || 0,
                rot4dZW: this.parameters.get('rot4dZW') || 0
            };
            rotations[param] = value;
            this.engine.setRotation(rotations.rot4dXW, rotations.rot4dYW, rotations.rot4dZW);
        } else if (param === 'geometry' && this.engine.setPolytope) {
            this.engine.setPolytope(value);
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
     * Select polytope exactly like index.html - 4D SPECIFIC
     */
    selectPolytope(index) {
        console.log(`🔮 PolychoraSystem: Selecting 4D polytope ${index} (${this.polytopes[index]})`);
        
        // Update UI
        document.querySelectorAll('.geom-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.index == index);
        });
        
        // Update polytope in engine if active
        if (this.engine && this.isActive) {
            if (this.engine.setPolytope) {
                this.engine.setPolytope(index);
            } else if (this.engine.currentPolytope !== undefined) {
                this.engine.currentPolytope = index;
            }
        }
        
        // Update parameter
        this.updateParameter('geometry', index);
    }

    /**
     * Update UI for this system - SHOW 4D FEATURES
     */
    updateUI() {
        // Show geometry section for polychora system (shows polytopes)
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
     * Force render for gallery preview mode - CRITICAL for 4D effects
     */
    forceRender() {
        if (this.engine && this.engine.render) {
            // Call render multiple times to ensure 4D animation starts
            for (let i = 0; i < 5; i++) {
                setTimeout(() => this.engine.render(), i * 10);
            }
            console.log('🔮 PolychoraSystem: Force render triggered for gallery preview with glassmorphic 4D effects');
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
            polytopes: this.polytopes.length,
            fourDimensional: true,  // Polychora system marker
            effects: ['4d_polytopes', 'glassmorphic_rendering', 'true_4d_mathematics', '4d_rotations', 'distance_functions']
        };
    }
}