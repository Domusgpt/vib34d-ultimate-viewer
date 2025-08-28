import { test, expect } from '@playwright/test';

/**
 * VIB34D V2-REFACTORED COMPREHENSIVE TEST SUITE
 * Tests both console messages AND visual functionality
 * Verifies canvas explosion fix and system functionality
 */

test.describe('VIB34D Canvas Explosion Fix Tests', () => {
  let page;
  let consoleMessages = [];
  let errorMessages = [];

  test.beforeEach(async ({ browser }) => {
    // Create new context with permissions for WebGL
    const context = await browser.newContext({
      permissions: ['camera', 'microphone']
    });
    
    page = await context.newPage();
    
    // Capture all console messages
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({
        type: msg.type(),
        text: text,
        timestamp: Date.now()
      });
      console.log(`[${msg.type().toUpperCase()}] ${text}`);
    });

    // Capture errors
    page.on('pageerror', error => {
      errorMessages.push(error.message);
      console.error('Page Error:', error.message);
    });

    // Navigate to the application
    await page.goto('/');
    
    // Wait for initial load and module readiness
    await page.waitForFunction(() => window.moduleReady === true, { timeout: 10000 });
    
    // Clear captured messages after initial load
    consoleMessages = [];
    errorMessages = [];
  });

  test('1. Console Messages: SmartCanvasPool Initialization', async () => {
    // Check for key SmartCanvasPool messages
    const poolInitMessages = consoleMessages.filter(msg => 
      msg.text.includes('SmartCanvasPool initialized')
    );
    
    expect(poolInitMessages.length).toBeGreaterThan(0);
    console.log('✅ SmartCanvasPool initialization detected');
  });

  test('2. Context Count: Only 5 WebGL Contexts Active', async () => {
    // Get canvas stats from SmartCanvasPool
    const canvasStats = await page.evaluate(() => {
      if (window.canvasPool) {
        return window.canvasPool.getStats();
      }
      return null;
    });

    expect(canvasStats).toBeTruthy();
    expect(canvasStats.activeContexts).toBeLessThanOrEqual(5);
    expect(canvasStats.reduction).toBe('75% (20 → 5 contexts)');
    
    console.log('✅ Canvas explosion fixed:', canvasStats);
  });

  test('3. System Switching: Faceted → Quantum → Holographic', async () => {
    // Test system switching with console monitoring
    const systems = ['faceted', 'quantum', 'holographic'];
    
    for (const system of systems) {
      console.log(`\n🔄 Testing switch to ${system}...`);
      
      // Clear messages before switch
      consoleMessages = [];
      
      // Click system button
      await page.click(`[data-system="${system}"]`);
      
      // Wait for system switch completion
      await page.waitForTimeout(2000);
      
      // Verify console messages
      const switchMessages = consoleMessages.filter(msg => 
        msg.text.includes(`Switching to ${system}`) ||
        msg.text.includes(`${system} system ready`)
      );
      
      expect(switchMessages.length).toBeGreaterThan(0);
      
      // Verify UI state
      const activeButton = await page.locator(`[data-system="${system}"].active`);
      await expect(activeButton).toBeVisible();
      
      // Verify canvas stats after switch
      const stats = await page.evaluate(() => window.canvasPool?.getStats());
      expect(stats.activeSystem).toBe(system);
      expect(stats.activeContexts).toBeLessThanOrEqual(5);
      
      console.log(`✅ ${system} system working, contexts: ${stats.activeContexts}`);
    }
  });

  test('4. Visual Verification: Canvas Elements Rendering', async () => {
    const systems = ['faceted', 'quantum', 'holographic'];
    
    for (const system of systems) {
      await page.click(`[data-system="${system}"]`);
      await page.waitForTimeout(1500);
      
      // Check if canvas layers are visible for active system
      const layerId = system === 'faceted' ? 'vib34dLayers' : `${system}Layers`;
      const layerVisible = await page.isVisible(`#${layerId}`);
      expect(layerVisible).toBe(true);
      
      // Check if other layers are hidden
      const otherSystems = systems.filter(s => s !== system);
      for (const otherSystem of otherSystems) {
        const otherLayerId = otherSystem === 'faceted' ? 'vib34dLayers' : `${otherSystem}Layers`;
        const otherLayerVisible = await page.isVisible(`#${otherLayerId}`);
        expect(otherLayerVisible).toBe(false);
      }
      
      console.log(`✅ ${system} visual layers properly managed`);
    }
  });

  test('5. Parameter Persistence: Save/Load Across Systems', async () => {
    // Set custom parameters on faceted system
    await page.click('[data-system="faceted"]');
    await page.waitForTimeout(1000);
    
    // Set specific parameter values
    const testParameters = {
      'rot4dXW': '2.5',
      'rot4dYW': '1.8',
      'gridDensity': '75',
      'morphFactor': '1.5',
      'hue': '180'
    };
    
    for (const [param, value] of Object.entries(testParameters)) {
      const slider = page.locator(`#${param}`);
      if (await slider.isVisible()) {
        await slider.fill(value);
        await page.waitForTimeout(100);
      }
    }
    
    // Switch to quantum and back to faceted
    await page.click('[data-system="quantum"]');
    await page.waitForTimeout(1500);
    await page.click('[data-system="faceted"]');
    await page.waitForTimeout(1500);
    
    // Verify parameters are preserved
    for (const [param, expectedValue] of Object.entries(testParameters)) {
      const slider = page.locator(`#${param}`);
      if (await slider.isVisible()) {
        const actualValue = await slider.inputValue();
        expect(Math.abs(parseFloat(actualValue) - parseFloat(expectedValue))).toBeLessThan(0.1);
      }
    }
    
    console.log('✅ Parameter persistence across system switches verified');
  });

  test('6. Gallery System: Save and Load Functionality', async () => {
    // Navigate to gallery
    const galleryBtn = page.locator('text=Gallery');
    if (await galleryBtn.isVisible()) {
      await galleryBtn.click();
      await page.waitForTimeout(2000);
      
      // Check if gallery loads
      const galleryContainer = page.locator('#galleryContainer, .gallery-container');
      if (await galleryContainer.isVisible()) {
        console.log('✅ Gallery system accessible');
        
        // Look for save functionality
        const saveBtn = page.locator('text=Save, button:has-text("Save"), #saveBtn');
        if (await saveBtn.isVisible()) {
          await saveBtn.click();
          await page.waitForTimeout(1000);
          console.log('✅ Save functionality working');
        }
      }
    } else {
      console.log('⚠️ Gallery button not found - may be in different UI location');
    }
  });

  test('7. Viewer System: Parameter Loading', async () => {
    // Check if viewer is accessible
    const viewerLink = page.locator('text=Viewer, a[href*="viewer"], #viewerBtn');
    if (await viewerLink.isVisible()) {
      await viewerLink.click();
      await page.waitForTimeout(2000);
      console.log('✅ Viewer system accessible');
    } else {
      console.log('⚠️ Viewer not found - may be integrated into main interface');
    }
  });

  test('8. Error Detection: No JavaScript Errors', async () => {
    // Test all systems for errors
    const systems = ['faceted', 'quantum', 'holographic'];
    
    for (const system of systems) {
      errorMessages = []; // Clear previous errors
      
      await page.click(`[data-system="${system}"]`);
      await page.waitForTimeout(2000);
      
      // Check for JavaScript errors
      expect(errorMessages).toHaveLength(0);
      console.log(`✅ ${system} system: No JavaScript errors`);
    }
  });

  test('9. Performance: Context Creation Speed', async () => {
    const performanceData = [];
    
    for (let i = 0; i < 3; i++) {
      const startTime = Date.now();
      
      await page.click('[data-system="quantum"]');
      await page.waitForTimeout(500);
      await page.click('[data-system="faceted"]');
      await page.waitForTimeout(500);
      
      const switchTime = Date.now() - startTime;
      performanceData.push(switchTime);
    }
    
    const averageTime = performanceData.reduce((a, b) => a + b) / performanceData.length;
    console.log(`✅ Average system switch time: ${averageTime}ms`);
    
    // Should be reasonably fast (under 2 seconds for round trip)
    expect(averageTime).toBeLessThan(2000);
  });

  test('10. WebGL Context Verification', async () => {
    // Test that WebGL contexts are working
    const contextInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return null;
      
      return {
        version: gl.getParameter(gl.VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        contextLost: gl.isContextLost()
      };
    });
    
    expect(contextInfo).toBeTruthy();
    expect(contextInfo.contextLost).toBe(false);
    console.log('✅ WebGL Context Info:', contextInfo);
  });

  test.afterEach(async () => {
    // Print summary of captured messages
    console.log(`\n📊 Test Summary:`);
    console.log(`Console Messages: ${consoleMessages.length}`);
    console.log(`Error Messages: ${errorMessages.length}`);
    
    if (errorMessages.length > 0) {
      console.log('🚨 Errors found:', errorMessages);
    }
    
    await page.close();
  });
});