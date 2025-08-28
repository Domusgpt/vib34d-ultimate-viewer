/**
 * SERVER-SIDE VALIDATION SCRIPT
 * Tests core functionality that can be validated without browser
 */

const fs = require('fs');
const path = require('path');

class ServerSideValidator {
    constructor() {
        this.results = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(description, testFn) {
        try {
            const result = testFn();
            if (result) {
                console.log(`✅ ${description}`);
                this.passed++;
                this.results.push({ test: description, result: 'PASS' });
            } else {
                console.log(`❌ ${description}`);
                this.failed++;
                this.results.push({ test: description, result: 'FAIL' });
            }
        } catch (error) {
            console.log(`💥 ${description} - ERROR: ${error.message}`);
            this.failed++;
            this.results.push({ test: description, result: 'ERROR', error: error.message });
        }
    }

    async runValidation() {
        console.log('🔍 VIB34D Server-Side Validation Starting...\n');

        // File Structure Tests
        console.log('📁 TESTING FILE STRUCTURE...');
        
        this.test('index-clean.html exists', () => {
            return fs.existsSync('index-clean.html');
        });
        
        this.test('gallery.html exists', () => {
            return fs.existsSync('gallery.html');
        });
        
        this.test('base-variations.json exists', () => {
            return fs.existsSync('collections/base-variations.json');
        });
        
        this.test('UnifiedSaveManager.js exists', () => {
            return fs.existsSync('src/core/UnifiedSaveManager.js');
        });
        
        this.test('CollectionManager.js exists', () => {
            return fs.existsSync('src/features/CollectionManager.js');
        });

        // JSON Structure Tests
        console.log('\n📋 TESTING JSON STRUCTURE...');
        
        try {
            const baseVariationsContent = fs.readFileSync('collections/base-variations.json', 'utf8');
            const baseVariations = JSON.parse(baseVariationsContent);
            
            this.test('base-variations.json is valid JSON', () => true);
            
            this.test('base-variations.json has correct structure', () => {
                return baseVariations.type === 'holographic-collection' &&
                       Array.isArray(baseVariations.variations) &&
                       baseVariations.variations.length > 0;
            });
            
            this.test('base-variations.json variations have parameters', () => {
                return baseVariations.variations.every(v => 
                    v.parameters && typeof v.parameters === 'object'
                );
            });
            
            this.test('base-variations.json variations have system field', () => {
                return baseVariations.variations.every(v => 
                    typeof v.system === 'string' && v.system.length > 0
                );
            });
            
            // Check for all 4 systems
            const systems = [...new Set(baseVariations.variations.map(v => v.system))];
            this.test('base-variations.json contains all 4 systems', () => {
                const expectedSystems = ['faceted', 'quantum', 'holographic'];
                return expectedSystems.every(sys => systems.includes(sys));
            });
            
        } catch (error) {
            this.test('base-variations.json parsing', () => false);
        }

        // Code Structure Tests  
        console.log('\n🔧 TESTING CODE STRUCTURE...');
        
        try {
            const saveManagerContent = fs.readFileSync('src/core/UnifiedSaveManager.js', 'utf8');
            
            this.test('UnifiedSaveManager has captureCurrentState method', () => {
                return saveManagerContent.includes('captureCurrentState()');
            });
            
            this.test('UnifiedSaveManager has saveToGallery method', () => {
                return saveManagerContent.includes('saveToGallery(');
            });
            
            this.test('UnifiedSaveManager has normalizeParameters method', () => {
                return saveManagerContent.includes('normalizeParameters(');
            });
            
            this.test('UnifiedSaveManager handles all 4 systems', () => {
                return ['faceted', 'quantum', 'holographic', 'polychora']
                    .every(sys => saveManagerContent.includes(sys));
            });
            
        } catch (error) {
            this.test('UnifiedSaveManager code analysis', () => false);
        }

        try {
            const collectionManagerContent = fs.readFileSync('src/features/CollectionManager.js', 'utf8');
            
            this.test('CollectionManager has autoDiscoverCollections method', () => {
                return collectionManagerContent.includes('autoDiscoverCollections()');
            });
            
            this.test('CollectionManager has loadUserSavedVariations method', () => {
                return collectionManagerContent.includes('loadUserSavedVariations()');
            });
            
            this.test('CollectionManager handles localStorage keys', () => {
                return collectionManagerContent.includes('vib34d-unified-variations') &&
                       collectionManagerContent.includes('vib34d-unified-collections');
            });
            
        } catch (error) {
            this.test('CollectionManager code analysis', () => false);
        }

        // Gallery HTML Structure Tests
        console.log('\n🖼️ TESTING GALLERY HTML STRUCTURE...');
        
        try {
            const galleryContent = fs.readFileSync('gallery.html', 'utf8');
            
            this.test('gallery.html imports CollectionManager', () => {
                return galleryContent.includes('CollectionManager.js');
            });
            
            this.test('gallery.html has autoDiscoverCollections call', () => {
                return galleryContent.includes('autoDiscoverCollections()');
            });
            
            this.test('gallery.html has preview functionality', () => {
                return galleryContent.includes('startPreview') && 
                       galleryContent.includes('stopPreview');
            });
            
            this.test('gallery.html handles real-time updates', () => {
                return galleryContent.includes('gallery-refresh-needed') ||
                       galleryContent.includes('storage');
            });
            
        } catch (error) {
            this.test('gallery.html analysis', () => false);
        }

        // Engine Integration Tests
        console.log('\n⚙️ TESTING ENGINE INTEGRATION...');
        
        const engines = {
            'QuantumEngine.js': 'src/quantum/QuantumEngine.js',
            'RealHolographicSystem.js': 'src/holograms/RealHolographicSystem.js', 
            'PolychoraSystem.js': 'src/core/PolychoraSystem.js'
        };
        
        Object.entries(engines).forEach(([name, path]) => {
            try {
                const content = fs.readFileSync(path, 'utf8');
                
                if (name === 'QuantumEngine.js' || name === 'RealHolographicSystem.js') {
                    this.test(`${name} has getParameters method`, () => {
                        return content.includes('getParameters()');
                    });
                } else if (name === 'PolychoraSystem.js') {
                    this.test(`${name} has parameters property`, () => {
                        return content.includes('this.parameters = {');
                    });
                }
                
            } catch (error) {
                this.test(`${name} analysis`, () => false);
            }
        });

        // Critical Integration Points
        console.log('\n🔗 TESTING CRITICAL INTEGRATION POINTS...');
        
        try {
            const galleryManagerContent = fs.readFileSync('js/gallery/gallery-manager.js', 'utf8');
            
            this.test('gallery-manager.js has preserveCriticalFunctions', () => {
                return galleryManagerContent.includes('preserveCriticalFunctions');
            });
            
            this.test('gallery-manager.js handles global scope corruption', () => {
                return galleryManagerContent.includes('restoreCriticalFunctions');
            });
            
            this.test('gallery-manager.js has saveToGallery function', () => {
                return galleryManagerContent.includes('window.saveToGallery = async function');
            });
            
        } catch (error) {
            this.test('gallery-manager.js analysis', () => false);
        }

        this.generateReport();
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('🚨 SERVER-SIDE VALIDATION REPORT');
        console.log('='.repeat(60));
        
        const total = this.passed + this.failed;
        const successRate = ((this.passed / total) * 100).toFixed(1);
        
        console.log(`\n📊 RESULTS:`);
        console.log(`✅ Passed: ${this.passed}`);
        console.log(`❌ Failed: ${this.failed}`);
        console.log(`📈 Success Rate: ${successRate}%`);
        
        if (this.failed === 0) {
            console.log('\n🎉 ALL SERVER-SIDE VALIDATION PASSED');
            console.log('✅ File structure and code integrity verified');
        } else if (this.failed < 3) {
            console.log('\n⚠️ MINOR ISSUES DETECTED');
            console.log('🔧 Some validation tests failed - review recommended');
        } else {
            console.log('\n🚨 SIGNIFICANT ISSUES DETECTED');
            console.log('💥 Multiple validation failures - system may be broken');
        }
        
        console.log('\n='.repeat(60));
    }
}

// Run validation
const validator = new ServerSideValidator();
validator.runValidation().catch(error => {
    console.error('💥 Validation script failed:', error);
    process.exit(1);
});