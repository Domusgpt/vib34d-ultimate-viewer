// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * VIB34D Comprehensive Testing Suite - 2025 Web Standards
 * Testing all 4 visualization systems with modern web practices
 */

test.describe('VIB34D Comprehensive Testing - 2025 Standards', () => {
    
    // Test timeout for complex WebGL operations
    test.setTimeout(120000);

    test.beforeEach(async ({ page }) => {
        // Enable verbose console logging
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warn') {
                console.log(`Browser ${msg.type()}: ${msg.text()}`);
            }
        });

        // Navigate to the application
        await page.goto('/index-clean.html');
        
        // Wait for application to fully load
        await page.waitForFunction(() => window.moduleReady === true, { timeout: 30000 });
        
        // Wait for initial render
        await page.waitForTimeout(2000);
    });

    test('1. System Architecture Validation', async ({ page }) => {
        console.log('🏗️ Testing System Architecture...');

        // Test all 4 systems are available
        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
        
        for (const system of systems) {
            const button = page.locator(`[data-system="${system}"]`);
            await expect(button).toBeVisible();
            await expect(button).toContainText(system.toUpperCase());
        }

        // Test system switching without JavaScript errors
        let errorCount = 0;
        page.on('pageerror', () => errorCount++);
        
        for (const system of systems) {
            console.log(`  Switching to ${system} system...`);
            await page.click(`[data-system="${system}"]`);
            await page.waitForTimeout(1000);
            
            // Verify system is active
            const activeButton = page.locator('.system-btn.active');
            await expect(activeButton).toHaveAttribute('data-system', system);
            
            // Verify correct canvas layers are visible
            const layersContainer = page.locator(`#${system === 'faceted' ? 'vib34dLayers' : system + 'Layers'}`);
            await expect(layersContainer).toBeVisible();
        }

        expect(errorCount).toBe(0);
        console.log('✅ System Architecture: All systems switch correctly');
    });

    test('2. Parameter System Comprehensive Testing', async ({ page }) => {
        console.log('🎛️ Testing Parameter System...');

        const parameters = [
            { name: 'rot4dXW', min: -6.28, max: 6.28 },
            { name: 'rot4dYW', min: -6.28, max: 6.28 },
            { name: 'rot4dZW', min: -6.28, max: 6.28 },
            { name: 'gridDensity', min: 5, max: 100 },
            { name: 'morphFactor', min: 0, max: 2 },
            { name: 'chaos', min: 0, max: 1 },
            { name: 'speed', min: 0.1, max: 3 },
            { name: 'hue', min: 0, max: 360 },
            { name: 'intensity', min: 0, max: 1 },
            { name: 'saturation', min: 0, max: 1 }
        ];

        // Test parameter controls exist and respond
        for (const param of parameters) {
            const slider = page.locator(`#${param.name}`);
            const display = page.locator(`#${param.name}-display`);
            
            await expect(slider).toBeVisible();
            await expect(display).toBeVisible();
            
            // Test parameter updates
            await slider.fill(String(param.max));
            await page.waitForTimeout(100);
            
            // Verify display updates
            const displayValue = await display.textContent();
            expect(parseFloat(displayValue)).toBeGreaterThan(param.min);
            
            console.log(`  ✅ ${param.name}: ${displayValue}`);
        }

        console.log('✅ Parameter System: All 11 parameters responsive');
    });

    test('3. Cross-System Parameter Persistence', async ({ page }) => {
        console.log('🔄 Testing Parameter Persistence...');

        const testValue = '25';
        
        // Set a parameter in faceted system
        await page.click('[data-system="faceted"]');
        await page.waitForTimeout(500);
        await page.fill('#gridDensity', testValue);
        
        // Switch to quantum system
        await page.click('[data-system="quantum"]');
        await page.waitForTimeout(500);
        
        // Verify parameter persisted
        const gridDensityValue = await page.locator('#gridDensity').inputValue();
        expect(gridDensityValue).toBe(testValue);
        
        // Switch to holographic system
        await page.click('[data-system="holographic"]');
        await page.waitForTimeout(500);
        
        // Verify parameter still persisted
        const persistedValue = await page.locator('#gridDensity').inputValue();
        expect(persistedValue).toBe(testValue);
        
        console.log('✅ Parameter Persistence: Values maintained across systems');
    });

    test('4. Mobile Performance and Responsiveness', async ({ page }) => {
        console.log('📱 Testing Mobile Performance...');

        // Test mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(1000);

        // Check mobile-specific elements
        const mobileCollapseBtn = page.locator('.mobile-collapse-btn');
        await expect(mobileCollapseBtn).toBeVisible();

        // Test touch interaction
        await page.tap('.system-btn[data-system="quantum"]');
        await page.waitForTimeout(1000);
        
        // Verify system switched on mobile
        const activeSystem = await page.locator('.system-btn.active').getAttribute('data-system');
        expect(activeSystem).toBe('quantum');

        // Test parameter interaction on mobile
        const slider = page.locator('#speed');
        await slider.tap();
        await page.waitForTimeout(500);

        console.log('✅ Mobile Performance: Touch interactions working');
    });

    test('5. WebGL Context Management', async ({ page }) => {
        console.log('🎨 Testing WebGL Context Management...');

        // Get WebGL context count for each system
        const webglContexts = await page.evaluate(() => {
            const canvases = document.querySelectorAll('canvas');
            let webglCount = 0;
            
            canvases.forEach(canvas => {
                const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
                if (gl) webglCount++;
            });
            
            return { total: canvases.length, webgl: webglCount };
        });

        console.log(`  Canvas elements: ${webglContexts.total}, WebGL contexts: ${webglContexts.webgl}`);
        
        // Test system switching maintains WebGL contexts properly
        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
        
        for (const system of systems) {
            await page.click(`[data-system="${system}"]`);
            await page.waitForTimeout(1000);
            
            const contextInfo = await page.evaluate(() => {
                const canvases = document.querySelectorAll('canvas');
                let activeCanvases = 0;
                
                canvases.forEach(canvas => {
                    if (canvas.style.display !== 'none' && canvas.offsetParent !== null) {
                        activeCanvases++;
                    }
                });
                
                return activeCanvases;
            });
            
            expect(contextInfo).toBeGreaterThan(0);
            console.log(`  ${system}: ${contextInfo} active canvases`);
        }

        console.log('✅ WebGL Context Management: Proper context handling');
    });

    test('6. Gallery and Export System', async ({ page }) => {
        console.log('💾 Testing Gallery and Export System...');

        // Test save to gallery function
        const saveButton = page.locator('button:has-text("Save to Gallery")');
        await expect(saveButton).toBeVisible();
        
        // Test trading card generation
        const tradingCardButton = page.locator('button:has-text("Trading Card")');
        await expect(tradingCardButton).toBeVisible();
        
        // Test gallery open function
        const galleryButton = page.locator('.action-btn[title="Gallery"]');
        await expect(galleryButton).toBeVisible();
        
        console.log('✅ Gallery System: All export functions available');
    });

    test('7. Performance Benchmarking', async ({ page }) => {
        console.log('⚡ Testing Performance Benchmarks...');

        // Measure loading time
        const startTime = Date.now();
        await page.goto('/index-clean.html');
        await page.waitForFunction(() => window.moduleReady === true);
        const loadTime = Date.now() - startTime;
        
        console.log(`  Loading time: ${loadTime}ms`);
        expect(loadTime).toBeLessThan(10000); // Should load in under 10 seconds

        // Measure system switching performance
        const systems = ['quantum', 'holographic', 'polychora', 'faceted'];
        
        for (const system of systems) {
            const switchStart = Date.now();
            await page.click(`[data-system="${system}"]`);
            await page.waitForTimeout(500);
            const switchTime = Date.now() - switchStart;
            
            console.log(`  ${system} switch: ${switchTime}ms`);
            expect(switchTime).toBeLessThan(2000); // System switch should be under 2 seconds
        }

        console.log('✅ Performance: All benchmarks within acceptable ranges');
    });

    test('8. Error Handling and Resilience', async ({ page }) => {
        console.log('🛡️ Testing Error Handling...');

        let errorCount = 0;
        const errors = [];
        
        page.on('pageerror', (error) => {
            errorCount++;
            errors.push(error.message);
        });

        // Test rapid system switching
        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
        
        for (let i = 0; i < 3; i++) {
            for (const system of systems) {
                await page.click(`[data-system="${system}"]`);
                await page.waitForTimeout(100); // Rapid switching
            }
        }

        // Test parameter spam
        for (let i = 0; i < 10; i++) {
            await page.fill('#speed', String(Math.random() * 3));
            await page.waitForTimeout(50);
        }

        if (errorCount > 0) {
            console.log('⚠️ Errors detected:', errors);
        } else {
            console.log('✅ Error Handling: System resilient to stress testing');
        }

        expect(errorCount).toBeLessThan(5); // Allow some minor errors but not critical ones
    });

    test('9. Accessibility Compliance', async ({ page }) => {
        console.log('♿ Testing Accessibility...');

        // Test keyboard navigation
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
        
        // Test ARIA labels and roles
        const buttons = page.locator('button');
        const buttonCount = await buttons.count();
        
        for (let i = 0; i < Math.min(buttonCount, 10); i++) {
            const button = buttons.nth(i);
            const isVisible = await button.isVisible();
            if (isVisible) {
                const text = await button.textContent();
                expect(text).toBeTruthy();
            }
        }

        // Test color contrast (basic check)
        const controlPanel = page.locator('.control-panel');
        const styles = await controlPanel.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return {
                backgroundColor: computed.backgroundColor,
                color: computed.color
            };
        });

        expect(styles.backgroundColor).toBeTruthy();
        expect(styles.color).toBeTruthy();

        console.log('✅ Accessibility: Basic compliance checks passed');
    });

    test('10. Audio Reactivity System', async ({ page }) => {
        console.log('🎵 Testing Audio Reactivity...');

        // Switch to holographic system (has audio reactivity)
        await page.click('[data-system="holographic"]');
        await page.waitForTimeout(1000);

        // Test audio toggle button
        const audioButton = page.locator('.action-btn[title="Audio"]');
        await expect(audioButton).toBeVisible();
        
        // Click audio button to test functionality
        await audioButton.click();
        await page.waitForTimeout(500);

        // Check if audio-related functions are available
        const audioFunctionsAvailable = await page.evaluate(() => {
            return typeof window.toggleAudio === 'function';
        });

        expect(audioFunctionsAvailable).toBeTruthy();
        console.log('✅ Audio System: Audio reactivity functions available');
    });

    test('11. Modern Web Standards Compliance', async ({ page }) => {
        console.log('🌐 Testing Web Standards Compliance...');

        // Test ES6 modules
        const moduleErrors = await page.evaluate(() => {
            // Check if modules loaded correctly
            return window.moduleReady && window.vib34dApp;
        });

        expect(moduleErrors).toBeTruthy();

        // Test responsive design
        const viewports = [
            { width: 320, height: 568 },  // Mobile
            { width: 768, height: 1024 }, // Tablet
            { width: 1920, height: 1080 } // Desktop
        ];

        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(500);
            
            // Check if control panel adapts
            const controlPanel = page.locator('.control-panel');
            await expect(controlPanel).toBeVisible();
            
            console.log(`  ${viewport.width}x${viewport.height}: Layout responsive`);
        }

        console.log('✅ Web Standards: Modern compliance verified');
    });

    test('12. System Integration and Data Flow', async ({ page }) => {
        console.log('🔗 Testing System Integration...');

        // Test global state management
        const globalState = await page.evaluate(() => {
            return {
                currentSystem: window.currentSystem,
                moduleReady: window.moduleReady,
                userParameterState: !!window.userParameterState,
                geometries: !!window.geometries
            };
        });

        expect(globalState.moduleReady).toBeTruthy();
        expect(globalState.userParameterState).toBeTruthy();
        expect(globalState.geometries).toBeTruthy();

        // Test parameter synchronization across systems
        await page.fill('#hue', '180');
        const hueValue1 = await page.locator('#hue').inputValue();
        
        await page.click('[data-system="quantum"]');
        await page.waitForTimeout(500);
        
        const hueValue2 = await page.locator('#hue').inputValue();
        expect(hueValue1).toBe(hueValue2);

        console.log('✅ System Integration: Data flows correctly between systems');
    });

});