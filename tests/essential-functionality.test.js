// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * VIB34D Essential Functionality Test - Production Readiness Verification
 * Focused tests for core functionality without timeout issues
 */

test.describe('VIB34D Essential Functionality - Production Ready', () => {
    
    test.setTimeout(30000); // Shorter timeout for focused tests

    let testResults = {
        systemArchitecture: { status: 'pending', details: [] },
        parameterSystem: { status: 'pending', details: [] },
        webglPerformance: { status: 'pending', details: [] },
        mobileCompatibility: { status: 'pending', details: [] },
        errorHandling: { status: 'pending', details: [] },
        accessibility: { status: 'pending', details: [] }
    };

    test.beforeEach(async ({ page }) => {
        // Enable detailed console logging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`Browser error: ${msg.text()}`);
            }
        });

        await page.goto('/index-clean.html');
        await page.waitForFunction(() => window.moduleReady === true, { timeout: 20000 });
        await page.waitForTimeout(1000); // Allow initialization to complete
    });

    test('Essential System Architecture Validation', async ({ page }) => {
        console.log('🏗️ Testing Core System Architecture...');
        
        try {
            // Test 1: All 4 system buttons exist and are clickable
            const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
            let systemButtonsWorking = 0;
            
            for (const system of systems) {
                const button = page.locator(`[data-system="${system}"]`);
                if (await button.isVisible()) {
                    systemButtonsWorking++;
                    testResults.systemArchitecture.details.push(`✅ ${system} button found`);
                } else {
                    testResults.systemArchitecture.details.push(`❌ ${system} button missing`);
                }
            }
            
            // Test 2: System switching functionality
            let systemSwitchingWorks = true;
            let jsErrors = 0;
            
            page.on('pageerror', () => jsErrors++);
            
            // Test switching to each system
            for (const system of systems) {
                await page.click(`[data-system="${system}"]`);
                await page.waitForTimeout(500);
                
                const activeButton = await page.locator('.system-btn.active').getAttribute('data-system');
                if (activeButton === system) {
                    testResults.systemArchitecture.details.push(`✅ ${system} system activated`);
                } else {
                    systemSwitchingWorks = false;
                    testResults.systemArchitecture.details.push(`❌ ${system} system failed to activate`);
                }
            }
            
            // Test 3: Essential DOM elements
            const essentialElements = [
                '#canvasContainer',
                '#controlPanel',
                '.control-panel',
                '.system-selector'
            ];
            
            let elementsPresent = 0;
            for (const selector of essentialElements) {
                if (await page.locator(selector).isVisible()) {
                    elementsPresent++;
                    testResults.systemArchitecture.details.push(`✅ ${selector} present`);
                } else {
                    testResults.systemArchitecture.details.push(`❌ ${selector} missing`);
                }
            }
            
            // Calculate architecture score
            const architectureScore = (
                (systemButtonsWorking / 4) * 40 +
                (systemSwitchingWorks ? 30 : 0) +
                (elementsPresent / essentialElements.length) * 20 +
                (jsErrors === 0 ? 10 : 0)
            );
            
            testResults.systemArchitecture.status = architectureScore >= 80 ? 'pass' : 'fail';
            testResults.systemArchitecture.score = architectureScore;
            testResults.systemArchitecture.details.push(`Final Score: ${architectureScore}/100`);
            
            expect(architectureScore).toBeGreaterThanOrEqual(80);
            console.log(`✅ System Architecture: ${architectureScore}/100`);
            
        } catch (error) {
            testResults.systemArchitecture.status = 'error';
            testResults.systemArchitecture.details.push(`Error: ${error.message}`);
            throw error;
        }
    });

    test('Parameter System Comprehensive Test', async ({ page }) => {
        console.log('🎛️ Testing Parameter System...');
        
        try {
            const parameters = [
                { name: 'rot4dXW', testValue: '3.14' },
                { name: 'rot4dYW', testValue: '1.57' },
                { name: 'gridDensity', testValue: '25' },
                { name: 'speed', testValue: '2.5' },
                { name: 'hue', testValue: '180' },
                { name: 'intensity', testValue: '0.75' }
            ];
            
            let workingParameters = 0;
            let responsiveParameters = 0;
            
            // Test parameter existence and responsiveness
            for (const param of parameters) {
                const slider = page.locator(`#${param.name}`);
                const display = page.locator(`#${param.name}-display`);
                
                // Test existence
                if (await slider.isVisible() && await display.isVisible()) {
                    workingParameters++;
                    testResults.parameterSystem.details.push(`✅ ${param.name} controls present`);
                    
                    // Test responsiveness
                    await slider.fill(param.testValue);
                    await page.waitForTimeout(200);
                    
                    const displayValue = await display.textContent();
                    if (displayValue && displayValue.includes(param.testValue.substring(0, 3))) {
                        responsiveParameters++;
                        testResults.parameterSystem.details.push(`✅ ${param.name} responsive`);
                    } else {
                        testResults.parameterSystem.details.push(`⚠️ ${param.name} display may not be updating`);
                    }
                } else {
                    testResults.parameterSystem.details.push(`❌ ${param.name} controls missing`);
                }
            }
            
            // Test parameter persistence across system switches
            await page.fill('#gridDensity', '50');
            await page.click('[data-system="quantum"]');
            await page.waitForTimeout(500);
            
            const persistedValue = await page.locator('#gridDensity').inputValue();
            const persistenceWorks = persistedValue === '50';
            
            if (persistenceWorks) {
                testResults.parameterSystem.details.push('✅ Parameter persistence works');
            } else {
                testResults.parameterSystem.details.push('❌ Parameter persistence failed');
            }
            
            // Calculate parameter score
            const parameterScore = (
                (workingParameters / parameters.length) * 40 +
                (responsiveParameters / parameters.length) * 40 +
                (persistenceWorks ? 20 : 0)
            );
            
            testResults.parameterSystem.status = parameterScore >= 75 ? 'pass' : 'fail';
            testResults.parameterSystem.score = parameterScore;
            testResults.parameterSystem.details.push(`Final Score: ${parameterScore}/100`);
            
            expect(parameterScore).toBeGreaterThanOrEqual(75);
            console.log(`✅ Parameter System: ${parameterScore}/100`);
            
        } catch (error) {
            testResults.parameterSystem.status = 'error';
            testResults.parameterSystem.details.push(`Error: ${error.message}`);
            throw error;
        }
    });

    test('WebGL Performance and Context Management', async ({ page }) => {
        console.log('🎨 Testing WebGL Performance...');
        
        try {
            // Test WebGL context availability
            const webglInfo = await page.evaluate(() => {
                const canvases = document.querySelectorAll('canvas');
                let webglContexts = 0;
                let totalCanvases = canvases.length;
                let webglSupported = !!(window.WebGLRenderingContext || window.WebGL2RenderingContext);
                
                canvases.forEach(canvas => {
                    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
                    if (gl) webglContexts++;
                });
                
                return {
                    totalCanvases,
                    webglContexts,
                    webglSupported,
                    ratio: webglContexts / totalCanvases
                };
            });
            
            testResults.webglPerformance.details.push(`Canvas elements: ${webglInfo.totalCanvases}`);
            testResults.webglPerformance.details.push(`WebGL contexts: ${webglInfo.webglContexts}`);
            testResults.webglPerformance.details.push(`WebGL supported: ${webglInfo.webglSupported}`);
            
            // Test system switching WebGL management
            const systems = ['faceted', 'quantum', 'holographic'];
            let contextManagementWorks = true;
            
            for (const system of systems) {
                await page.click(`[data-system="${system}"]`);
                await page.waitForTimeout(1000);
                
                const activeContexts = await page.evaluate(() => {
                    const canvases = document.querySelectorAll('canvas');
                    let activeCount = 0;
                    canvases.forEach(canvas => {
                        if (canvas.style.display !== 'none' && canvas.offsetParent !== null) {
                            activeCount++;
                        }
                    });
                    return activeCount;
                });
                
                if (activeContexts > 0) {
                    testResults.webglPerformance.details.push(`✅ ${system}: ${activeContexts} active contexts`);
                } else {
                    contextManagementWorks = false;
                    testResults.webglPerformance.details.push(`❌ ${system}: No active contexts`);
                }
            }
            
            // Calculate WebGL score
            const webglScore = (
                (webglInfo.webglSupported ? 30 : 0) +
                (webglInfo.webglContexts > 0 ? 30 : 0) +
                (contextManagementWorks ? 30 : 0) +
                (webglInfo.totalCanvases < 20 ? 10 : 0) // Reasonable context limit
            );
            
            testResults.webglPerformance.status = webglScore >= 70 ? 'pass' : 'fail';
            testResults.webglPerformance.score = webglScore;
            testResults.webglPerformance.details.push(`Final Score: ${webglScore}/100`);
            
            expect(webglScore).toBeGreaterThanOrEqual(70);
            console.log(`✅ WebGL Performance: ${webglScore}/100`);
            
        } catch (error) {
            testResults.webglPerformance.status = 'error';
            testResults.webglPerformance.details.push(`Error: ${error.message}`);
            throw error;
        }
    });

    test('Mobile Compatibility Check', async ({ page }) => {
        console.log('📱 Testing Mobile Compatibility...');
        
        try {
            // Test mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });
            await page.waitForTimeout(1000);
            
            // Test mobile-specific elements and interactions
            const mobileChecks = {
                touchTargets: 0,
                responsiveLayout: false,
                mobileOptimizations: 0
            };
            
            // Check button sizes (should be touch-friendly)
            const buttons = page.locator('button');
            const buttonCount = await buttons.count();
            
            for (let i = 0; i < Math.min(buttonCount, 10); i++) {
                const button = buttons.nth(i);
                const box = await button.boundingBox();
                
                if (box && (box.width >= 44 && box.height >= 32)) {
                    mobileChecks.touchTargets++;
                }
            }
            
            testResults.mobileCompatibility.details.push(`Touch targets: ${mobileChecks.touchTargets}/${Math.min(buttonCount, 10)}`);
            
            // Test responsive layout
            const controlPanel = page.locator('.control-panel');
            const isVisible = await controlPanel.isVisible();
            if (isVisible) {
                mobileChecks.responsiveLayout = true;
                testResults.mobileCompatibility.details.push('✅ Control panel responsive');
            } else {
                testResults.mobileCompatibility.details.push('❌ Control panel not visible on mobile');
            }
            
            // Test touch interactions
            try {
                await page.tap('.system-btn[data-system="quantum"]');
                await page.waitForTimeout(500);
                const activeSystem = await page.locator('.system-btn.active').getAttribute('data-system');
                
                if (activeSystem === 'quantum') {
                    mobileChecks.mobileOptimizations++;
                    testResults.mobileCompatibility.details.push('✅ Touch system switching works');
                } else {
                    testResults.mobileCompatibility.details.push('❌ Touch system switching failed');
                }
            } catch (e) {
                testResults.mobileCompatibility.details.push('❌ Touch interaction error');
            }
            
            // Calculate mobile score
            const mobileScore = (
                (mobileChecks.touchTargets / Math.min(buttonCount, 10)) * 40 +
                (mobileChecks.responsiveLayout ? 30 : 0) +
                (mobileChecks.mobileOptimizations > 0 ? 30 : 0)
            );
            
            testResults.mobileCompatibility.status = mobileScore >= 60 ? 'pass' : 'fail';
            testResults.mobileCompatibility.score = mobileScore;
            testResults.mobileCompatibility.details.push(`Final Score: ${mobileScore}/100`);
            
            // Reset viewport
            await page.setViewportSize({ width: 1920, height: 1080 });
            
            expect(mobileScore).toBeGreaterThanOrEqual(60);
            console.log(`✅ Mobile Compatibility: ${mobileScore}/100`);
            
        } catch (error) {
            testResults.mobileCompatibility.status = 'error';
            testResults.mobileCompatibility.details.push(`Error: ${error.message}`);
            throw error;
        }
    });

    test('Error Handling and Resilience', async ({ page }) => {
        console.log('🛡️ Testing Error Handling...');
        
        try {
            let errorCount = 0;
            const errors = [];
            
            page.on('pageerror', (error) => {
                errorCount++;
                errors.push(error.message);
            });
            
            // Test rapid system switching (stress test)
            const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
            for (let i = 0; i < 2; i++) {
                for (const system of systems) {
                    await page.click(`[data-system="${system}"]`);
                    await page.waitForTimeout(200);
                }
            }
            
            testResults.errorHandling.details.push(`Errors during stress test: ${errorCount}`);
            
            // Test invalid parameter values
            try {
                await page.evaluate(() => {
                    const slider = document.getElementById('speed');
                    if (slider) {
                        slider.value = 'invalid';
                        slider.dispatchEvent(new Event('input'));
                    }
                });
                
                await page.waitForTimeout(500);
                testResults.errorHandling.details.push('✅ Invalid parameter handling tested');
            } catch (e) {
                testResults.errorHandling.details.push('⚠️ Parameter validation test failed');
            }
            
            // Test function availability
            const functionsExist = await page.evaluate(() => {
                return {
                    switchSystem: typeof window.switchSystem === 'function',
                    updateParameter: typeof window.updateParameter === 'function',
                    randomizeAll: typeof window.randomizeAll === 'function'
                };
            });
            
            let functionsWorking = 0;
            Object.entries(functionsExist).forEach(([func, exists]) => {
                if (exists) {
                    functionsWorking++;
                    testResults.errorHandling.details.push(`✅ ${func} function available`);
                } else {
                    testResults.errorHandling.details.push(`❌ ${func} function missing`);
                }
            });
            
            // Calculate error handling score
            const errorScore = (
                (errorCount < 3 ? 40 : errorCount < 5 ? 20 : 0) +
                (functionsWorking / Object.keys(functionsExist).length) * 40 +
                20 // Base resilience score
            );
            
            testResults.errorHandling.status = errorScore >= 70 ? 'pass' : 'fail';
            testResults.errorHandling.score = errorScore;
            testResults.errorHandling.details.push(`Final Score: ${errorScore}/100`);
            
            if (errors.length > 0) {
                testResults.errorHandling.details.push(`Errors: ${errors.slice(0, 3).join(', ')}`);
            }
            
            expect(errorScore).toBeGreaterThanOrEqual(70);
            console.log(`✅ Error Handling: ${errorScore}/100`);
            
        } catch (error) {
            testResults.errorHandling.status = 'error';
            testResults.errorHandling.details.push(`Error: ${error.message}`);
            throw error;
        }
    });

    test('Basic Accessibility Check', async ({ page }) => {
        console.log('♿ Testing Basic Accessibility...');
        
        try {
            // Test keyboard navigation
            await page.keyboard.press('Tab');
            await page.waitForTimeout(200);
            
            let focusableElements = 0;
            for (let i = 0; i < 10; i++) {
                await page.keyboard.press('Tab');
                await page.waitForTimeout(100);
                
                const focused = await page.evaluate(() => {
                    const el = document.activeElement;
                    return el && el.tagName !== 'BODY';
                });
                
                if (focused) focusableElements++;
            }
            
            testResults.accessibility.details.push(`Focusable elements found: ${focusableElements}/10`);
            
            // Test button text content
            const buttons = page.locator('button');
            const buttonCount = await buttons.count();
            let buttonsWithText = 0;
            
            for (let i = 0; i < Math.min(buttonCount, 8); i++) {
                const button = buttons.nth(i);
                const text = await button.textContent();
                const title = await button.getAttribute('title');
                
                if ((text && text.trim()) || (title && title.trim())) {
                    buttonsWithText++;
                }
            }
            
            testResults.accessibility.details.push(`Buttons with labels: ${buttonsWithText}/${Math.min(buttonCount, 8)}`);
            
            // Test semantic HTML
            const semanticElements = await page.evaluate(() => {
                return {
                    buttons: document.querySelectorAll('button').length,
                    inputs: document.querySelectorAll('input').length,
                    labels: document.querySelectorAll('label, .control-label').length
                };
            });
            
            testResults.accessibility.details.push(`Semantic elements - Buttons: ${semanticElements.buttons}, Inputs: ${semanticElements.inputs}, Labels: ${semanticElements.labels}`);
            
            // Calculate accessibility score
            const accessibilityScore = (
                (focusableElements > 5 ? 30 : focusableElements * 6) +
                (buttonsWithText / Math.min(buttonCount, 8)) * 40 +
                (semanticElements.inputs > 0 && semanticElements.labels > 0 ? 30 : 0)
            );
            
            testResults.accessibility.status = accessibilityScore >= 60 ? 'pass' : 'fail';
            testResults.accessibility.score = accessibilityScore;
            testResults.accessibility.details.push(`Final Score: ${accessibilityScore}/100`);
            
            expect(accessibilityScore).toBeGreaterThanOrEqual(60);
            console.log(`✅ Accessibility: ${accessibilityScore}/100`);
            
        } catch (error) {
            testResults.accessibility.status = 'error';
            testResults.accessibility.details.push(`Error: ${error.message}`);
            throw error;
        }
    });

    test.afterAll(async () => {
        // Generate comprehensive test report
        console.log('\n📊 COMPREHENSIVE TEST SUMMARY:');
        console.log('=' .repeat(50));
        
        let totalScore = 0;
        let testCount = 0;
        let passedTests = 0;
        
        Object.entries(testResults).forEach(([testName, result]) => {
            if (result.score !== undefined) {
                totalScore += result.score;
                testCount++;
                if (result.status === 'pass') passedTests++;
                
                console.log(`${testName}: ${result.status.toUpperCase()} (${result.score}/100)`);
                result.details.forEach(detail => console.log(`  ${detail}`));
            }
        });
        
        const averageScore = testCount > 0 ? (totalScore / testCount).toFixed(1) : 0;
        const passRate = testCount > 0 ? ((passedTests / testCount) * 100).toFixed(1) : 0;
        
        console.log('=' .repeat(50));
        console.log(`OVERALL SCORE: ${averageScore}/100`);
        console.log(`PASS RATE: ${passRate}% (${passedTests}/${testCount})`);
        console.log(`STATUS: ${averageScore >= 75 ? '✅ PRODUCTION READY' : averageScore >= 60 ? '⚠️ NEEDS MINOR FIXES' : '❌ NEEDS MAJOR WORK'}`);
        console.log('=' .repeat(50));
        
        // Write detailed report to file
        const reportData = {
            timestamp: new Date().toISOString(),
            overallScore: averageScore,
            passRate: passRate,
            status: averageScore >= 75 ? 'PRODUCTION_READY' : averageScore >= 60 ? 'MINOR_ISSUES' : 'MAJOR_ISSUES',
            testResults: testResults
        };
        
        // This would typically write to a file, but we'll output to console for now
        console.log('\n📝 Detailed Report JSON:');
        console.log(JSON.stringify(reportData, null, 2));
    });

});