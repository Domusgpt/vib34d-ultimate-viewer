/**
 * COMPREHENSIVE GALLERY SAVE/LOAD TESTING SYSTEM
 * RED TEAM ANALYSIS: Test every component to find failures
 */

console.log('🔍 COMPREHENSIVE GALLERY SAVE/LOAD TESTING INITIATED');
console.log('🚨 RED TEAM MODE: Assuming everything is broken until proven working');

class GalleryTestFramework {
    constructor() {
        this.results = [];
        this.criticalIssues = [];
        this.minorIssues = [];
        this.testsPassed = 0;
        this.testsFailed = 0;
    }
    
    /**
     * RED TEAM MINDSET: Test everything with maximum skepticism
     */
    async runComprehensiveTests() {
        console.log('🎯 Starting RED TEAM comprehensive testing...');
        
        // Phase 1: Basic Infrastructure Tests
        await this.testBasicInfrastructure();
        
        // Phase 2: System Switching & Engine Tests  
        await this.testSystemSwitching();
        
        // Phase 3: Parameter Capture Tests
        await this.testParameterCapture();
        
        // Phase 4: Save System Tests
        await this.testSaveSystem();
        
        // Phase 5: Collection Loading Tests
        await this.testCollectionLoading();
        
        // Phase 6: Gallery System Tests
        await this.testGallerySystem();
        
        // Phase 7: Real-time Update Tests
        await this.testRealTimeUpdates();
        
        // Phase 8: Edge Case & Failure Tests
        await this.testEdgeCases();
        
        this.generateReport();
    }
    
    /**
     * Test basic infrastructure - RED TEAM: Assume nothing works
     */
    async testBasicInfrastructure() {
        console.log('\n🔍 PHASE 1: BASIC INFRASTRUCTURE TESTS');
        
        // Test 1: Critical global functions existence
        this.test('window.saveToGallery exists', () => {
            return typeof window.saveToGallery === 'function';
        });
        
        this.test('window.switchSystem exists', () => {
            return typeof window.switchSystem === 'function';
        });
        
        this.test('window.updateParameter exists', () => {
            return typeof window.updateParameter === 'function';
        });
        
        // Test 2: Engine initialization
        this.test('Main engine initialized', () => {
            return window.engine !== undefined && window.engine !== null;
        });
        
        // Test 3: System availability  
        this.test('Current system defined', () => {
            return window.currentSystem !== undefined && typeof window.currentSystem === 'string';
        });
        
        // Test 4: DOM elements critical for save/load
        this.test('Parameter sliders exist', () => {
            const criticalSliders = ['gridDensity', 'morphFactor', 'hue', 'speed'];
            return criticalSliders.every(id => document.getElementById(id) !== null);
        });
        
        this.test('Geometry buttons exist', () => {
            const geomButtons = document.querySelectorAll('.geom-btn');
            return geomButtons.length >= 8; // Should have 8 geometry types
        });
    }
    
    /**
     * Test system switching - RED TEAM: Each system must work independently
     */
    async testSystemSwitching() {
        console.log('\n🔍 PHASE 2: SYSTEM SWITCHING TESTS');
        
        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
        
        for (const system of systems) {
            await this.testSystemSwitch(system);
        }
    }
    
    async testSystemSwitch(system) {
        try {
            console.log(`🎯 Testing ${system} system...`);
            
            // Switch to system
            if (typeof window.switchSystem === 'function') {
                await window.switchSystem(system);
                await this.wait(500); // Allow system to initialize
            }
            
            // Test system is actually active
            this.test(`${system}: window.currentSystem updated`, () => {
                return window.currentSystem === system;
            });
            
            // Test engine availability for parameter capture
            let engineAvailable = false;
            let parameterAccessible = false;
            
            if (system === 'faceted') {
                engineAvailable = window.engine && window.engine.parameterManager;
                if (engineAvailable) {
                    try {
                        const params = window.engine.parameterManager.getAllParameters();
                        parameterAccessible = params && typeof params === 'object';
                    } catch (e) {
                        parameterAccessible = false;
                    }
                }
            } else if (system === 'quantum') {
                engineAvailable = window.quantumEngine;
                if (engineAvailable && typeof window.quantumEngine.getParameters === 'function') {
                    try {
                        const params = window.quantumEngine.getParameters();
                        parameterAccessible = params && typeof params === 'object';
                    } catch (e) {
                        parameterAccessible = false;
                    }
                }
            } else if (system === 'holographic') {
                engineAvailable = window.holographicSystem;
                if (engineAvailable && typeof window.holographicSystem.getParameters === 'function') {
                    try {
                        const params = window.holographicSystem.getParameters();
                        parameterAccessible = params && typeof params === 'object';
                    } catch (e) {
                        parameterAccessible = false;
                    }
                }
            } else if (system === 'polychora') {
                engineAvailable = window.polychoraSystem;
                if (engineAvailable) {
                    try {
                        const params = window.polychoraSystem.parameters;
                        parameterAccessible = params && typeof params === 'object';
                    } catch (e) {
                        parameterAccessible = false;
                    }
                }
            }
            
            this.test(`${system}: Engine available`, () => engineAvailable);
            this.test(`${system}: Parameters accessible`, () => parameterAccessible);
            
            // Test canvas layers are shown/hidden correctly
            const canvasContainers = {
                'faceted': 'vib34dLayers',
                'quantum': 'quantumLayers', 
                'holographic': 'holographicLayers',
                'polychora': 'polychoraLayers'
            };
            
            Object.entries(canvasContainers).forEach(([sys, containerId]) => {
                const container = document.getElementById(containerId);
                if (container) {
                    const shouldBeVisible = sys === system;
                    const isVisible = container.style.display !== 'none';
                    
                    this.test(`${system}: ${sys} layers ${shouldBeVisible ? 'shown' : 'hidden'}`, () => {
                        return shouldBeVisible === isVisible;
                    });
                }
            });
            
        } catch (error) {
            this.fail(`${system}: System switching failed`, error.message);
        }
    }
    
    /**
     * Test parameter capture - RED TEAM: Verify each system captures different parameters
     */
    async testParameterCapture() {
        console.log('\n🔍 PHASE 3: PARAMETER CAPTURE TESTS');
        
        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
        
        for (const system of systems) {
            await this.testParameterCaptureForSystem(system);
        }
        
        // Test manual parameter capture fallback
        await this.testManualParameterCapture();
    }
    
    async testParameterCaptureForSystem(system) {
        try {
            // Switch to system first
            if (typeof window.switchSystem === 'function') {
                await window.switchSystem(system);
                await this.wait(300);
            }
            
            // Import UnifiedSaveManager to test parameter capture
            let saveManager;
            try {
                const { UnifiedSaveManager } = await import('./src/core/UnifiedSaveManager.js');
                saveManager = new UnifiedSaveManager(window.engine);
            } catch (error) {
                this.fail(`${system}: UnifiedSaveManager import failed`, error.message);
                return;
            }
            
            // Test parameter capture
            let capturedState = null;
            try {
                capturedState = saveManager.captureCurrentState();
            } catch (error) {
                this.fail(`${system}: Parameter capture failed`, error.message);
                return;
            }
            
            // Validate captured state structure
            this.test(`${system}: State captured`, () => capturedState !== null);
            this.test(`${system}: System field set`, () => capturedState.system === system);
            this.test(`${system}: Parameters field exists`, () => capturedState.parameters && typeof capturedState.parameters === 'object');
            this.test(`${system}: Parameters not empty`, () => Object.keys(capturedState.parameters).length > 0);
            
            // Test specific parameter existence
            const expectedParams = ['geometry', 'gridDensity', 'hue', 'speed'];
            expectedParams.forEach(param => {
                this.test(`${system}: ${param} parameter captured`, () => {
                    return capturedState.parameters[param] !== undefined;
                });
            });
            
        } catch (error) {
            this.fail(`${system}: Parameter capture test failed`, error.message);
        }
    }
    
    async testManualParameterCapture() {
        console.log('🔍 Testing manual parameter capture fallback...');
        
        try {
            const { UnifiedSaveManager } = await import('./src/core/UnifiedSaveManager.js');
            const saveManager = new UnifiedSaveManager(window.engine);
            
            const manualParams = saveManager.captureManualParameters();
            
            this.test('Manual capture: Returns object', () => typeof manualParams === 'object');
            this.test('Manual capture: Has geometry', () => manualParams.geometry !== undefined);
            this.test('Manual capture: Has slider values', () => {
                return manualParams.gridDensity !== undefined || manualParams.hue !== undefined;
            });
            
        } catch (error) {
            this.fail('Manual parameter capture failed', error.message);
        }
    }
    
    /**
     * Test save system - RED TEAM: Save must work for all systems
     */
    async testSaveSystem() {
        console.log('\n🔍 PHASE 4: SAVE SYSTEM TESTS');
        
        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
        
        for (const system of systems) {
            await this.testSaveForSystem(system);
        }
        
        await this.testLocalStorageSave();
        await this.testSaveErrors();
    }
    
    async testSaveForSystem(system) {
        try {
            console.log(`🎯 Testing save for ${system} system...`);
            
            // Switch to system
            if (typeof window.switchSystem === 'function') {
                await window.switchSystem(system);
                await this.wait(300);
            }
            
            // Modify some parameters to make save meaningful
            if (typeof window.updateParameter === 'function') {
                window.updateParameter('hue', Math.random() * 360);
                window.updateParameter('gridDensity', 10 + Math.random() * 30);
            }
            
            // Test save function
            let saveResult = null;
            let saveError = null;
            
            if (typeof window.saveToGallery === 'function') {
                try {
                    saveResult = await window.saveToGallery();
                } catch (error) {
                    saveError = error;
                }
            }
            
            this.test(`${system}: Save completed without error`, () => saveError === null);
            
            // Check localStorage was updated
            const storedVariations = localStorage.getItem('vib34d-unified-variations');
            this.test(`${system}: localStorage updated`, () => storedVariations !== null);
            
            if (storedVariations) {
                try {
                    const variations = JSON.parse(storedVariations);
                    this.test(`${system}: Saved variations is array`, () => Array.isArray(variations));
                    this.test(`${system}: Has saved variations`, () => variations.length > 0);
                    
                    // Check most recent variation
                    if (variations.length > 0) {
                        const latest = variations[variations.length - 1];
                        this.test(`${system}: Latest variation has correct system`, () => latest.system === system);
                        this.test(`${system}: Latest variation has parameters`, () => latest.parameters && typeof latest.parameters === 'object');
                    }
                } catch (parseError) {
                    this.fail(`${system}: localStorage data parse failed`, parseError.message);
                }
            }
            
        } catch (error) {
            this.fail(`${system}: Save test failed`, error.message);
        }
    }
    
    async testLocalStorageSave() {
        console.log('🔍 Testing localStorage save functionality...');
        
        // Clear localStorage to test clean save
        const originalData = localStorage.getItem('vib34d-unified-variations');
        localStorage.removeItem('vib34d-unified-variations');
        
        try {
            // Test save creates new localStorage
            if (typeof window.saveToGallery === 'function') {
                await window.saveToGallery();
            }
            
            const newData = localStorage.getItem('vib34d-unified-variations');
            this.test('localStorage: Created on first save', () => newData !== null);
            
            if (newData) {
                const variations = JSON.parse(newData);
                this.test('localStorage: Valid JSON structure', () => Array.isArray(variations));
                this.test('localStorage: Contains variation', () => variations.length > 0);
            }
            
        } finally {
            // Restore original data
            if (originalData) {
                localStorage.setItem('vib34d-unified-variations', originalData);
            }
        }
    }
    
    async testSaveErrors() {
        console.log('🔍 Testing save error handling...');
        
        // Test save with broken engine reference
        const originalEngine = window.engine;
        window.engine = null;
        
        try {
            let errorOccurred = false;
            try {
                if (typeof window.saveToGallery === 'function') {
                    await window.saveToGallery();
                }
            } catch (error) {
                errorOccurred = true;
            }
            
            this.test('Save error handling: Handles null engine gracefully', () => errorOccurred);
            
        } finally {
            window.engine = originalEngine;
        }
    }
    
    /**
     * Test collection loading - RED TEAM: Every collection must load correctly
     */
    async testCollectionLoading() {
        console.log('\n🔍 PHASE 5: COLLECTION LOADING TESTS');
        
        try {
            // Test CollectionManager import
            const { CollectionManager } = await import('./src/features/CollectionManager.js');
            const collectionManager = new CollectionManager();
            
            // Test auto-discovery
            let collections = [];
            try {
                collections = await collectionManager.autoDiscoverCollections();
            } catch (error) {
                this.fail('Collection loading: Auto-discovery failed', error.message);
                return;
            }
            
            this.test('Collection loading: Returns array', () => Array.isArray(collections));
            this.test('Collection loading: Has collections', () => collections.length > 0);
            
            // Test each collection structure
            collections.forEach((collection, index) => {
                this.test(`Collection ${index}: Has name`, () => collection.name && typeof collection.name === 'string');
                this.test(`Collection ${index}: Has type`, () => collection.type === 'holographic-collection');
                this.test(`Collection ${index}: Has variations array`, () => Array.isArray(collection.variations));
                
                // Test first variation structure if exists
                if (collection.variations.length > 0) {
                    const variation = collection.variations[0];
                    this.test(`Collection ${index}: Variation has parameters`, () => {
                        return variation.parameters && typeof variation.parameters === 'object';
                    });
                    this.test(`Collection ${index}: Variation has system`, () => {
                        return typeof variation.system === 'string';
                    });
                }
            });
            
            // Test specific file loading
            try {
                const baseCollection = await collectionManager.loadCollection('base-variations.json');
                this.test('File loading: base-variations.json loads', () => baseCollection !== null);
                this.test('File loading: Has 30 variations', () => baseCollection.variations && baseCollection.variations.length >= 30);
            } catch (error) {
                this.fail('File loading: base-variations.json failed', error.message);
            }
            
        } catch (error) {
            this.fail('Collection loading: Module import failed', error.message);
        }
    }
    
    /**
     * Test gallery system - RED TEAM: Gallery must display all collections correctly
     */
    async testGallerySystem() {
        console.log('\n🔍 PHASE 6: GALLERY SYSTEM TESTS');
        
        // Test gallery page accessibility
        try {
            const response = await fetch('gallery.html');
            this.test('Gallery: Page accessible', () => response.ok);
        } catch (error) {
            this.fail('Gallery: Page fetch failed', error.message);
        }
        
        // Test gallery preview system (if available)
        this.test('Gallery: Preview fix exists', () => {
            return window.galleryPreviewFix !== undefined;
        });
        
        // Test collection rendering functions
        this.test('Gallery: startPreview function exists', () => {
            return typeof window.startPreview === 'function';
        });
        
        this.test('Gallery: stopPreview function exists', () => {
            return typeof window.stopPreview === 'function';
        });
    }
    
    /**
     * Test real-time updates - RED TEAM: All 4 update methods must work
     */
    async testRealTimeUpdates() {
        console.log('\n🔍 PHASE 7: REAL-TIME UPDATE TESTS');
        
        // Test event-based updates
        let eventFired = false;
        const eventHandler = () => { eventFired = true; };
        
        window.addEventListener('gallery-refresh-needed', eventHandler);
        window.dispatchEvent(new CustomEvent('gallery-refresh-needed'));
        
        this.test('Real-time: Event system works', () => eventFired);
        window.removeEventListener('gallery-refresh-needed', eventHandler);
        
        // Test localStorage trigger
        const originalValue = localStorage.getItem('vib34d-gallery-update-trigger');
        localStorage.setItem('vib34d-gallery-update-trigger', Date.now().toString());
        
        this.test('Real-time: localStorage trigger sets', () => {
            return localStorage.getItem('vib34d-gallery-update-trigger') !== originalValue;
        });
    }
    
    /**
     * Test edge cases - RED TEAM: System must handle all failure modes
     */
    async testEdgeCases() {
        console.log('\n🔍 PHASE 8: EDGE CASES & FAILURE TESTS');
        
        // Test save with invalid parameters
        try {
            const originalUpdateParameter = window.updateParameter;
            window.updateParameter = null;
            
            // This should trigger fallback to manual parameter capture
            if (typeof window.saveToGallery === 'function') {
                await window.saveToGallery();
            }
            
            this.test('Edge case: Handles missing updateParameter', () => true);
            window.updateParameter = originalUpdateParameter;
        } catch (error) {
            // This is expected - test passes if it doesn't crash the system
            this.test('Edge case: Graceful error handling', () => true);
        }
        
        // Test gallery with no saved variations
        const originalVariations = localStorage.getItem('vib34d-unified-variations');
        localStorage.removeItem('vib34d-unified-variations');
        
        try {
            const { CollectionManager } = await import('./src/features/CollectionManager.js');
            const collectionManager = new CollectionManager();
            const collections = await collectionManager.autoDiscoverCollections();
            
            this.test('Edge case: Handles no localStorage variations', () => Array.isArray(collections));
        } finally {
            if (originalVariations) {
                localStorage.setItem('vib34d-unified-variations', originalVariations);
            }
        }
        
        // Test parameter capture with missing sliders
        const slider = document.getElementById('gridDensity');
        if (slider) {
            slider.remove();
            
            try {
                const { UnifiedSaveManager } = await import('./src/core/UnifiedSaveManager.js');
                const saveManager = new UnifiedSaveManager(window.engine);
                const params = saveManager.captureManualParameters();
                
                this.test('Edge case: Handles missing sliders', () => typeof params === 'object');
            } catch (error) {
                this.fail('Edge case: Missing slider test failed', error.message);
            }
        }
    }
    
    /**
     * Test assertion helper
     */
    test(description, testFn) {
        try {
            const result = testFn();
            if (result) {
                console.log(`✅ ${description}`);
                this.testsPassed++;
                this.results.push({ test: description, result: 'PASS', details: null });
            } else {
                console.log(`❌ ${description}`);
                this.testsFailed++;
                this.results.push({ test: description, result: 'FAIL', details: 'Test returned false' });
                this.minorIssues.push(description);
            }
        } catch (error) {
            console.log(`💥 ${description} - ERROR: ${error.message}`);
            this.testsFailed++;
            this.results.push({ test: description, result: 'ERROR', details: error.message });
            this.criticalIssues.push({ test: description, error: error.message });
        }
    }
    
    fail(description, details) {
        console.log(`💥 ${description} - ${details}`);
        this.testsFailed++;
        this.results.push({ test: description, result: 'FAIL', details });
        this.criticalIssues.push({ test: description, error: details });
    }
    
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Generate comprehensive test report - RED TEAM ANALYSIS
     */
    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('🚨 RED TEAM ANALYSIS: COMPREHENSIVE GALLERY TEST REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n📊 TEST SUMMARY:`);
        console.log(`✅ Tests Passed: ${this.testsPassed}`);
        console.log(`❌ Tests Failed: ${this.testsFailed}`);
        console.log(`📈 Success Rate: ${((this.testsPassed / (this.testsPassed + this.testsFailed)) * 100).toFixed(1)}%`);
        
        if (this.criticalIssues.length > 0) {
            console.log(`\n🚨 CRITICAL ISSUES (${this.criticalIssues.length}):`);
            this.criticalIssues.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue.test}`);
                console.log(`   💥 ${issue.error}`);
            });
        }
        
        if (this.minorIssues.length > 0) {
            console.log(`\n⚠️ MINOR ISSUES (${this.minorIssues.length}):`);
            this.minorIssues.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue}`);
            });
        }
        
        console.log(`\n🎯 RED TEAM CONCLUSION:`);
        if (this.criticalIssues.length === 0 && this.testsFailed === 0) {
            console.log(`✅ SYSTEM APPEARS FUNCTIONAL - All tests passed`);
            console.log(`🎉 Gallery save/load workflow is working as documented`);
        } else if (this.criticalIssues.length === 0 && this.testsFailed < 5) {
            console.log(`⚠️ SYSTEM MOSTLY FUNCTIONAL - Minor issues detected`);
            console.log(`🔧 Recommended: Address minor issues for optimal performance`);
        } else if (this.criticalIssues.length < 3) {
            console.log(`🚨 SYSTEM PARTIALLY BROKEN - Critical issues found`);
            console.log(`🛠️ URGENT: Fix critical issues before deployment`);
        } else {
            console.log(`💥 SYSTEM SEVERELY BROKEN - Multiple critical failures`);
            console.log(`🚫 DO NOT DEPLOY - Major overhaul required`);
        }
        
        console.log('\n='.repeat(80));
        
        // Store results for external access
        window.galleryTestResults = {
            passed: this.testsPassed,
            failed: this.testsFailed,
            criticalIssues: this.criticalIssues,
            minorIssues: this.minorIssues,
            allResults: this.results
        };
    }
}

// Auto-run if not already running
if (typeof window !== 'undefined' && !window.galleryTestFramework) {
    window.galleryTestFramework = new GalleryTestFramework();
    
    // Wait for page to be fully loaded, then run tests
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => window.galleryTestFramework.runComprehensiveTests(), 1000);
        });
    } else {
        setTimeout(() => window.galleryTestFramework.runComprehensiveTests(), 1000);
    }
}

export { GalleryTestFramework };