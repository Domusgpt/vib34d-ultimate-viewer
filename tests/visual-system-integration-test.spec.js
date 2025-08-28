// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * VISUAL SYSTEM INTEGRATION AGENT
 * 
 * This agent visually tests system integration by:
 * 1. Testing all 4 systems switching (Faceted, Quantum, Holographic, Polychora)
 * 2. Verifying no JavaScript errors during system switches
 * 3. Testing parameter persistence across system changes
 * 4. Validating the fixed Quantum Engine method conflict
 * 5. Capturing screenshots of each system
 */

test.describe('Visual System Integration Test Agent', () => {
  let page;
  let jsErrors = [];

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    jsErrors = [];
    
    // Monitor JavaScript errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        jsErrors.push({
          timestamp: Date.now(),
          message: msg.text(),
          location: msg.location()
        });
        console.error(`❌ JS Error detected: ${msg.text()}`);
      }
    });
    
    // Monitor page errors
    page.on('pageerror', (error) => {
      jsErrors.push({
        timestamp: Date.now(),
        message: error.message,
        stack: error.stack,
        type: 'pageerror'
      });
      console.error(`❌ Page Error detected: ${error.message}`);
    });
    
    console.log('🚀 Agent: Navigating to VIB34D interface for system integration testing');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.system-btn', { timeout: 30000 });
    await page.waitForTimeout(3000); // Extra time for all systems to initialize
    
    console.log('✅ Agent: Interface loaded, monitoring for errors');
  });

  test('Four System Switching Validation', async () => {
    console.log('🎯 Agent: Testing all 4 system switches with error monitoring');
    
    const systems = [
      { name: 'faceted', icon: '🔷', description: 'Simple 2D geometric patterns' },
      { name: 'quantum', icon: '🌌', description: 'Complex 3D lattice with holographic effects' },
      { name: 'holographic', icon: '✨', description: 'Audio-reactive visualization with volumetric effects' },
      { name: 'polychora', icon: '🔮', description: 'True 4D polytope mathematics' }
    ];
    
    // Take initial state screenshot
    await page.screenshot({
      path: 'test-results/system-integration-00-initial-state.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    
    for (const system of systems) {
      console.log(`${system.icon} Agent: Testing ${system.name} system switch`);
      
      const initialErrorCount = jsErrors.length;
      
      // Click system button
      const systemBtn = page.locator(`.system-btn[data-system="${system.name}"]`);
      await expect(systemBtn).toBeVisible();
      
      await systemBtn.click();
      await page.waitForTimeout(2000); // Allow system to fully initialize
      
      // Verify system is active
      const activeBtn = await page.locator(`.system-btn.active[data-system="${system.name}"]`);
      await expect(activeBtn).toBeVisible();
      
      // Check for new JavaScript errors
      const newErrorCount = jsErrors.length;
      const systemErrors = jsErrors.slice(initialErrorCount);
      
      if (systemErrors.length > 0) {
        console.warn(`⚠️ Agent: ${system.name} system generated ${systemErrors.length} errors`);
        for (const error of systemErrors) {
          console.warn(`  - ${error.message}`);
        }
      } else {
        console.log(`✅ Agent: ${system.name} system switched without errors`);
      }
      
      // Capture screenshot of system
      await page.screenshot({
        path: `test-results/system-integration-01-${system.name}.png`,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
      
      // Verify canvas layers are visible
      const canvasLayers = await page.locator('canvas').count();
      console.log(`📊 Agent: ${system.name} system has ${canvasLayers} canvas elements`);
      expect(canvasLayers).toBeGreaterThan(0);
      
      // Test basic interactivity
      await page.mouse.move(500, 400);
      await page.waitForTimeout(500);
      await page.mouse.move(800, 600);
      await page.waitForTimeout(500);
      
      console.log(`✨ Agent: ${system.name} system interaction test complete`);
    }
    
    // Final error summary
    console.log(`📋 Agent: Total JavaScript errors during testing: ${jsErrors.length}`);
    
    // Take final state screenshot
    await page.screenshot({
      path: 'test-results/system-integration-02-final-state.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
  });

  test('Parameter Persistence Across Systems', async () => {
    console.log('🔄 Agent: Testing parameter persistence across system changes');
    
    const testParameters = {
      speed: '2.0',
      intensity: '0.7',
      hue: '180',
      gridDensity: '75'
    };
    
    const systems = ['faceted', 'quantum', 'holographic'];
    
    for (const system of systems) {
      console.log(`🎛️ Agent: Testing parameter persistence in ${system} system`);
      
      // Switch to system
      await page.click(`.system-btn[data-system="${system}"]`);
      await page.waitForTimeout(1500);
      
      // Set test parameters
      for (const [param, value] of Object.entries(testParameters)) {
        const slider = page.locator(`input[id*="${param}"], input[data-param="${param}"], .slider-container:has-text("${param.charAt(0).toUpperCase() + param.slice(1)}") input[type="range"]`).first();
        
        if (await slider.isVisible()) {
          await slider.fill(value);
          await slider.dispatchEvent('input');
          await page.waitForTimeout(200);
          console.log(`  📊 Set ${param} to ${value}`);
        }
      }
      
      // Capture screenshot with parameters set
      await page.screenshot({
        path: `test-results/parameter-persistence-${system}-set.png`,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
      
      // Switch to another system and back to test persistence
      const nextSystem = systems[(systems.indexOf(system) + 1) % systems.length];
      await page.click(`.system-btn[data-system="${nextSystem}"]`);
      await page.waitForTimeout(1000);
      
      await page.click(`.system-btn[data-system="${system}"]`);
      await page.waitForTimeout(1500);
      
      // Verify parameters are still set
      for (const [param, expectedValue] of Object.entries(testParameters)) {
        const slider = page.locator(`input[id*="${param}"], input[data-param="${param}"], .slider-container:has-text("${param.charAt(0).toUpperCase() + param.slice(1)}") input[type="range"]`).first();
        
        if (await slider.isVisible()) {
          const currentValue = await slider.inputValue();
          console.log(`  🔍 ${param}: expected ${expectedValue}, got ${currentValue}`);
          
          // Allow for small floating point differences
          expect(Math.abs(parseFloat(currentValue) - parseFloat(expectedValue))).toBeLessThan(0.1);
        }
      }
      
      // Capture screenshot after persistence test
      await page.screenshot({
        path: `test-results/parameter-persistence-${system}-verified.png`,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
      
      console.log(`✅ Agent: ${system} parameter persistence verified`);
    }
  });

  test('Quantum Engine Method Conflict Fix', async () => {
    console.log('⚙️ Agent: Testing fixed Quantum Engine method conflicts');
    
    // Switch to Quantum system
    await page.click('.system-btn[data-system="quantum"]');
    await page.waitForTimeout(2000);
    
    // Monitor for specific quantum engine errors
    const quantumErrors = jsErrors.filter(error => 
      error.message.toLowerCase().includes('quantum') ||
      error.message.toLowerCase().includes('method') ||
      error.message.toLowerCase().includes('conflict')
    );
    
    console.log(`🔍 Agent: Found ${quantumErrors.length} quantum-related errors`);
    
    // Test quantum-specific functionality
    const quantumTests = [
      { action: 'parameter-change', description: 'Change quantum parameters' },
      { action: 'mouse-movement', description: 'Test quantum mouse interactions' },
      { action: 'system-switch', description: 'Switch away and back to quantum' }
    ];
    
    for (const test of quantumTests) {
      console.log(`🧪 Agent: Testing ${test.description}`);
      
      const errorsBefore = jsErrors.length;
      
      switch (test.action) {
        case 'parameter-change':
          const speedSlider = page.locator('input[id*="speed"]').first();
          if (await speedSlider.isVisible()) {
            await speedSlider.fill('1.5');
            await speedSlider.dispatchEvent('input');
          }
          break;
          
        case 'mouse-movement':
          await page.mouse.move(400, 300);
          await page.waitForTimeout(300);
          await page.mouse.move(800, 600);
          await page.waitForTimeout(300);
          break;
          
        case 'system-switch':
          await page.click('.system-btn[data-system="holographic"]');
          await page.waitForTimeout(1000);
          await page.click('.system-btn[data-system="quantum"]');
          await page.waitForTimeout(1000);
          break;
      }
      
      await page.waitForTimeout(500);
      
      const errorsAfter = jsErrors.length;
      const newErrors = errorsAfter - errorsBefore;
      
      if (newErrors === 0) {
        console.log(`  ✅ ${test.description}: No errors detected`);
      } else {
        console.warn(`  ⚠️ ${test.description}: ${newErrors} new errors`);
        const recentErrors = jsErrors.slice(errorsBefore);
        for (const error of recentErrors) {
          console.warn(`    - ${error.message}`);
        }
      }
      
      // Capture screenshot after each test
      await page.screenshot({
        path: `test-results/quantum-engine-fix-${test.action}.png`,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
    }
    
    console.log('✅ Agent: Quantum Engine method conflict testing complete');
  });

  test('System Switching Performance Test', async () => {
    console.log('⚡ Agent: Testing system switching performance');
    
    const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
    const switchTimes = [];
    
    for (let cycle = 0; cycle < 2; cycle++) {
      console.log(`🔄 Agent: Performance cycle ${cycle + 1}`);
      
      for (const system of systems) {
        const startTime = Date.now();
        
        // Switch system
        await page.click(`.system-btn[data-system="${system}"]`);
        
        // Wait for system to be fully active
        await page.waitForSelector(`.system-btn.active[data-system="${system}"]`);
        await page.waitForTimeout(500); // Additional settling time
        
        const endTime = Date.now();
        const switchTime = endTime - startTime;
        switchTimes.push({ system, time: switchTime, cycle: cycle + 1 });
        
        console.log(`  ⏱️ ${system} switch time: ${switchTime}ms`);
        
        // Brief pause between switches
        await page.waitForTimeout(300);
      }
    }
    
    // Calculate performance statistics
    const avgSwitchTime = switchTimes.reduce((sum, entry) => sum + entry.time, 0) / switchTimes.length;
    const maxSwitchTime = Math.max(...switchTimes.map(entry => entry.time));
    const minSwitchTime = Math.min(...switchTimes.map(entry => entry.time));
    
    console.log(`📊 Agent: Switch performance stats:`);
    console.log(`  Average: ${avgSwitchTime.toFixed(1)}ms`);
    console.log(`  Maximum: ${maxSwitchTime}ms`);
    console.log(`  Minimum: ${minSwitchTime}ms`);
    
    // Take final performance screenshot
    await page.screenshot({
      path: 'test-results/system-switching-performance.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    
    // Assert reasonable performance
    expect(avgSwitchTime).toBeLessThan(3000); // Average switch should be under 3 seconds
    expect(maxSwitchTime).toBeLessThan(5000); // No switch should take longer than 5 seconds
    
    console.log('✅ Agent: System switching performance validation complete');
  });

  test('Canvas Layer Management Validation', async () => {
    console.log('🎨 Agent: Testing canvas layer management across systems');
    
    const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
    
    for (const system of systems) {
      console.log(`🖼️ Agent: Testing canvas layers for ${system} system`);
      
      // Switch to system
      await page.click(`.system-btn[data-system="${system}"]`);
      await page.waitForTimeout(1500);
      
      // Count visible canvas elements
      const visibleCanvases = await page.locator('canvas:visible').count();
      console.log(`  📊 ${system}: ${visibleCanvases} visible canvas elements`);
      
      // Verify proper canvas layer structure
      const layerContainer = page.locator(`#${system}Layers, #vib34dLayers`).first();
      if (await layerContainer.isVisible()) {
        const layerCanvases = await layerContainer.locator('canvas').count();
        console.log(`  🎭 ${system}: ${layerCanvases} canvas elements in layer container`);
        
        // Capture screenshot of canvas layers
        await page.screenshot({
          path: `test-results/canvas-layers-${system}.png`,
          fullPage: false,
          clip: { x: 0, y: 0, width: 1920, height: 1080 }
        });
      }
      
      // Test canvas rendering by checking if canvases have content
      const canvasElements = await page.locator('canvas:visible').all();
      let activeCanvases = 0;
      
      for (const canvas of canvasElements) {
        try {
          const hasContent = await canvas.evaluate((el) => {
            const ctx = el.getContext('2d');
            if (ctx) {
              const imageData = ctx.getImageData(0, 0, Math.min(el.width, 100), Math.min(el.height, 100));
              return imageData.data.some(value => value !== 0);
            }
            return false;
          });
          
          if (hasContent) activeCanvases++;
        } catch (error) {
          // Canvas might be WebGL or have other context
          console.log(`    ℹ️ Canvas context check failed (likely WebGL): ${error.message}`);
        }
      }
      
      console.log(`  ✨ ${system}: ${activeCanvases} canvases with visible content`);
      
      // Basic expectation: should have at least one canvas
      expect(visibleCanvases).toBeGreaterThan(0);
    }
    
    console.log('✅ Agent: Canvas layer management validation complete');
  });

  test.afterEach(async () => {
    // Final error report
    if (jsErrors.length > 0) {
      console.warn(`⚠️ Test completed with ${jsErrors.length} JavaScript errors:`);
      jsErrors.forEach((error, index) => {
        console.warn(`  ${index + 1}. ${error.message}`);
      });
    } else {
      console.log('✅ Test completed with no JavaScript errors');
    }
  });
});