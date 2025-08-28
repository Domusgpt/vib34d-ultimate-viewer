// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * VIB34D Performance Benchmarking Suite
 * Focus on frame rates, memory usage, and performance optimization
 */

test.describe('VIB34D Performance Benchmarks', () => {
    
    test.setTimeout(180000); // Extended timeout for performance tests

    test.beforeEach(async ({ page }) => {
        await page.goto('/index-clean.html');
        await page.waitForFunction(() => window.moduleReady === true, { timeout: 30000 });
    });

    test('Frame Rate Analysis Across All Systems', async ({ page }) => {
        console.log('📊 Analyzing Frame Rates...');

        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
        const frameRateResults = {};

        for (const system of systems) {
            console.log(`Testing ${system} system frame rates...`);
            
            await page.click(`[data-system="${system}"]`);
            await page.waitForTimeout(1000);

            // Measure frame rate over 5 seconds
            const frameRateData = await page.evaluate(async () => {
                return new Promise((resolve) => {
                    let frameCount = 0;
                    let startTime = performance.now();
                    let lastTime = startTime;

                    function countFrame() {
                        frameCount++;
                        const currentTime = performance.now();
                        
                        if (currentTime - startTime >= 5000) { // 5 seconds
                            const totalTime = currentTime - startTime;
                            const fps = (frameCount / totalTime) * 1000;
                            resolve({
                                fps: Math.round(fps * 100) / 100,
                                frameCount: frameCount,
                                duration: Math.round(totalTime)
                            });
                        } else {
                            requestAnimationFrame(countFrame);
                        }
                    }
                    
                    requestAnimationFrame(countFrame);
                });
            });

            frameRateResults[system] = frameRateData;
            console.log(`  ${system}: ${frameRateData.fps} FPS (${frameRateData.frameCount} frames in ${frameRateData.duration}ms)`);
            
            // Expect minimum 30 FPS for good performance
            expect(frameRateData.fps).toBeGreaterThan(30);
        }

        console.log('✅ Frame Rate Analysis Complete');
        console.log('Results:', frameRateResults);
    });

    test('Memory Usage Monitoring', async ({ page }) => {
        console.log('🧠 Monitoring Memory Usage...');

        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
        const memoryResults = {};

        // Get initial memory baseline
        const initialMemory = await page.evaluate(() => {
            if (performance.memory) {
                return {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                };
            }
            return null;
        });

        if (initialMemory) {
            console.log(`Initial Memory: ${Math.round(initialMemory.usedJSHeapSize / 1024 / 1024)} MB`);
        }

        for (const system of systems) {
            await page.click(`[data-system="${system}"]`);
            await page.waitForTimeout(2000); // Let system stabilize

            const memoryInfo = await page.evaluate(() => {
                if (performance.memory) {
                    return {
                        usedJSHeapSize: performance.memory.usedJSHeapSize,
                        totalJSHeapSize: performance.memory.totalJSHeapSize
                    };
                }
                return null;
            });

            if (memoryInfo) {
                const usedMB = Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024);
                memoryResults[system] = usedMB;
                console.log(`  ${system}: ${usedMB} MB`);
                
                // Expect memory usage to be reasonable (under 500MB)
                expect(memoryInfo.usedJSHeapSize).toBeLessThan(500 * 1024 * 1024);
            }
        }

        console.log('✅ Memory Usage Analysis Complete');
    });

    test('System Switching Performance', async ({ page }) => {
        console.log('⚡ Testing System Switching Speed...');

        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
        const switchingResults = [];

        for (let iteration = 0; iteration < 3; iteration++) {
            console.log(`Iteration ${iteration + 1}/3`);
            
            for (const system of systems) {
                const startTime = performance.now();
                
                await page.click(`[data-system="${system}"]`);
                
                // Wait for system to be fully active
                await page.waitForFunction((systemName) => {
                    const activeBtn = document.querySelector('.system-btn.active');
                    return activeBtn && activeBtn.getAttribute('data-system') === systemName;
                }, system);

                const endTime = performance.now();
                const switchTime = endTime - startTime;
                
                switchingResults.push({
                    system: system,
                    iteration: iteration + 1,
                    switchTime: Math.round(switchTime)
                });

                console.log(`  ${system}: ${Math.round(switchTime)}ms`);
                
                // Expect system switches to be under 1 second
                expect(switchTime).toBeLessThan(1000);
            }
        }

        // Calculate averages
        const averages = {};
        systems.forEach(system => {
            const systemTimes = switchingResults.filter(r => r.system === system);
            const average = systemTimes.reduce((sum, r) => sum + r.switchTime, 0) / systemTimes.length;
            averages[system] = Math.round(average);
        });

        console.log('Average switching times:', averages);
        console.log('✅ System Switching Performance Complete');
    });

    test('Parameter Response Time Analysis', async ({ page }) => {
        console.log('🎛️ Analyzing Parameter Response Times...');

        const parameters = ['speed', 'gridDensity', 'hue', 'intensity'];
        const responseResults = {};

        for (const param of parameters) {
            console.log(`Testing ${param} response time...`);
            
            const responseTimes = [];
            
            // Test parameter changes multiple times
            for (let i = 0; i < 10; i++) {
                const startTime = performance.now();
                const randomValue = Math.random();
                
                await page.evaluate((paramName, value) => {
                    const slider = document.getElementById(paramName);
                    const event = new Event('input', { bubbles: true });
                    slider.value = value;
                    slider.dispatchEvent(event);
                }, param, randomValue);

                // Wait for a short time to allow processing
                await page.waitForTimeout(50);
                
                const endTime = performance.now();
                responseTimes.push(endTime - startTime);
            }

            const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            responseResults[param] = Math.round(avgResponseTime);
            
            console.log(`  ${param}: ${Math.round(avgResponseTime)}ms average`);
            
            // Expect parameter responses to be very fast (under 100ms)
            expect(avgResponseTime).toBeLessThan(100);
        }

        console.log('✅ Parameter Response Analysis Complete');
    });

    test('WebGL Context Performance', async ({ page }) => {
        console.log('🎨 Testing WebGL Context Performance...');

        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
        
        for (const system of systems) {
            await page.click(`[data-system="${system}"]`);
            await page.waitForTimeout(1000);

            const webglInfo = await page.evaluate(() => {
                const canvases = document.querySelectorAll('canvas');
                let webglContexts = 0;
                let totalPixels = 0;
                let maxTexSize = 0;

                canvases.forEach(canvas => {
                    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
                    if (gl) {
                        webglContexts++;
                        totalPixels += canvas.width * canvas.height;
                        
                        const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
                        maxTexSize = Math.max(maxTexSize, maxTexture);
                    }
                });

                return {
                    contexts: webglContexts,
                    totalPixels: totalPixels,
                    maxTextureSize: maxTexSize,
                    canvasCount: canvases.length
                };
            });

            console.log(`  ${system}: ${webglInfo.contexts} WebGL contexts, ${webglInfo.canvasCount} canvases`);
            console.log(`    Total pixels: ${webglInfo.totalPixels.toLocaleString()}`);
            console.log(`    Max texture size: ${webglInfo.maxTextureSize}`);
            
            // Reasonable limits for WebGL contexts
            expect(webglInfo.contexts).toBeLessThan(20);
            expect(webglInfo.contexts).toBeGreaterThan(0);
        }

        console.log('✅ WebGL Context Performance Complete');
    });

    test('Load Time Optimization', async ({ page }) => {
        console.log('⏱️ Testing Load Time Optimization...');

        const loadMetrics = [];
        
        // Test multiple load scenarios
        for (let i = 0; i < 3; i++) {
            console.log(`Load test ${i + 1}/3`);
            
            const startTime = performance.now();
            
            await page.goto('/index-clean.html');
            await page.waitForFunction(() => window.moduleReady === true, { timeout: 30000 });
            
            const loadComplete = performance.now();
            const loadTime = loadComplete - startTime;
            
            loadMetrics.push(loadTime);
            console.log(`  Load ${i + 1}: ${Math.round(loadTime)}ms`);
        }

        const avgLoadTime = loadMetrics.reduce((a, b) => a + b, 0) / loadMetrics.length;
        console.log(`Average load time: ${Math.round(avgLoadTime)}ms`);

        // Expect average load time under 8 seconds
        expect(avgLoadTime).toBeLessThan(8000);

        console.log('✅ Load Time Optimization Complete');
    });

});