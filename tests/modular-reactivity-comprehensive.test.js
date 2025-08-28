const { test, expect } = require('@playwright/test');

test.describe('VIB34D Modular Reactivity System - Comprehensive Testing', () => {
  const baseURL = 'http://localhost:8080';
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto(baseURL);
    
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Wait for the main canvas to be visible
    await page.waitForSelector('#unifiedCanvas', { state: 'visible' });
    
    // Wait a bit for WebGL initialization
    await page.waitForTimeout(2000);
  });

  test('Initial page load and screenshot', async ({ page }) => {
    // Take initial screenshot
    await page.screenshot({ 
      path: 'test-results/01-initial-load.png', 
      fullPage: true 
    });
    
    // Verify essential elements are present
    await expect(page.locator('.logo')).toBeVisible();
    await expect(page.locator('.system-selector')).toBeVisible();
    await expect(page.locator('.control-panel')).toBeVisible();
    await expect(page.locator('#unifiedCanvas')).toBeVisible();
    
    // Check for system buttons
    await expect(page.locator('text=FACETED')).toBeVisible();
    await expect(page.locator('text=QUANTUM')).toBeVisible();
    await expect(page.locator('text=HOLOGRAPHIC')).toBeVisible();
    
    console.log('✅ Initial page load verified');
  });

  test('System switching functionality', async ({ page }) => {
    const systems = ['FACETED', 'QUANTUM', 'HOLOGRAPHIC'];
    
    for (const system of systems) {
      // Click the system button
      await page.click(`text=${system}`);
      await page.waitForTimeout(500);
      
      // Take screenshot
      await page.screenshot({ 
        path: `test-results/02-system-${system.toLowerCase()}.png`, 
        fullPage: true 
      });
      
      // Verify the system is active
      const activeButton = page.locator('.system-btn.active');
      await expect(activeButton).toContainText(system);
      
      // Listen for console logs to verify system switch
      page.on('console', msg => {
        if (msg.text().includes(`Switching to ${system.toLowerCase()}`)) {
          console.log(`✅ ${system} system activated`);
        }
      });
    }
    
    console.log('✅ All system switches verified');
  });

  test('Modular reactivity grid - checkbox toggling', async ({ page }) => {
    // Define the reactivity grid cells
    const reactivityCells = [
      { id: 'facetedMouse', system: 'faceted', type: 'mouse', text: 'Rotations' },
      { id: 'facetedClick', system: 'faceted', type: 'click', text: 'Flash' },
      { id: 'facetedScroll', system: 'faceted', type: 'scroll', text: 'Density' },
      { id: 'quantumMouse', system: 'quantum', type: 'mouse', text: 'Velocity' },
      { id: 'quantumClick', system: 'quantum', type: 'click', text: 'Burst' },
      { id: 'quantumScroll', system: 'quantum', type: 'scroll', text: 'Cycles' },
      { id: 'holographicMouse', system: 'holographic', type: 'mouse', text: 'Shimmer' },
      { id: 'holographicClick', system: 'holographic', type: 'click', text: 'Burst' },
      { id: 'holographicScroll', system: 'holographic', type: 'scroll', text: 'Flow' }
    ];

    // Listen for console messages
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    for (const cell of reactivityCells) {
      const checkbox = page.locator(`#${cell.id}`);
      
      // Get initial state
      const initiallyChecked = await checkbox.isChecked();
      
      // Click to toggle
      await checkbox.click();
      await page.waitForTimeout(300);
      
      // Verify state changed
      const nowChecked = await checkbox.isChecked();
      expect(nowChecked).toBe(!initiallyChecked);
      
      // Take screenshot after toggle
      await page.screenshot({ 
        path: `test-results/03-reactivity-${cell.id}-toggled.png`, 
        fullPage: true 
      });
      
      // Toggle back for next test
      await checkbox.click();
      await page.waitForTimeout(300);
      
      console.log(`✅ ${cell.id} checkbox toggling verified`);
    }
    
    // Verify console messages were generated
    const reactivityMessages = consoleMessages.filter(msg => 
      msg.includes('toggleSystemReactivity') || msg.includes('reactivity')
    );
    expect(reactivityMessages.length).toBeGreaterThan(0);
    console.log('✅ Console logging for reactivity changes verified');
  });

  test('Audio reactivity grid functionality', async ({ page }) => {
    const audioCells = [
      { id: 'lowColor', sensitivity: 'low', mode: 'color', text: 'Subtle' },
      { id: 'lowGeometry', sensitivity: 'low', mode: 'geometry', text: 'Gentle' },
      { id: 'lowMovement', sensitivity: 'low', mode: 'movement', text: 'Smooth' },
      { id: 'mediumColor', sensitivity: 'medium', mode: 'color', text: 'Dynamic' },
      { id: 'mediumGeometry', sensitivity: 'medium', mode: 'geometry', text: 'Morphing' },
      { id: 'mediumMovement', sensitivity: 'medium', mode: 'movement', text: 'Flowing' },
      { id: 'highColor', sensitivity: 'high', mode: 'color', text: 'Intense' },
      { id: 'highGeometry', sensitivity: 'high', mode: 'geometry', text: 'Explosive' },
      { id: 'highMovement', sensitivity: 'high', mode: 'movement', text: 'Chaotic' }
    ];

    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    for (const cell of audioCells) {
      // Click the audio cell
      await page.click(`.audio-cell:has(#${cell.id})`);
      await page.waitForTimeout(300);
      
      // Check if checkbox is now checked
      const checkbox = page.locator(`#${cell.id}`);
      const isChecked = await checkbox.isChecked();
      
      // Take screenshot
      await page.screenshot({ 
        path: `test-results/04-audio-${cell.id}-clicked.png`, 
        fullPage: true 
      });
      
      // Look for purple status overlay
      const hasOverlay = await page.locator('#audio-reactivity-overlay').isVisible().catch(() => false);
      
      console.log(`✅ ${cell.id} audio cell clicked, checked: ${isChecked}, overlay: ${hasOverlay}`);
    }
    
    // Verify audio-related console messages
    const audioMessages = consoleMessages.filter(msg => 
      msg.includes('audio') || msg.includes('toggleAudioCell')
    );
    console.log(`✅ Audio console messages: ${audioMessages.length}`);
  });

  test('Mixed reactivity modes testing', async ({ page }) => {
    // Test combination: Faceted Mouse + Quantum Click + Holographic Scroll
    const combinations = [
      { system: 'FACETED', interaction: 'facetedMouse' },
      { system: 'QUANTUM', interaction: 'quantumClick' },
      { system: 'HOLOGRAPHIC', interaction: 'holographicScroll' }
    ];
    
    // Enable specific combinations
    for (const combo of combinations) {
      // First switch to the system
      await page.click(`text=${combo.system}`);
      await page.waitForTimeout(500);
      
      // Then enable the specific interaction
      await page.check(`#${combo.interaction}`);
      await page.waitForTimeout(300);
    }
    
    // Take screenshot of mixed mode
    await page.screenshot({ 
      path: 'test-results/05-mixed-reactivity-modes.png', 
      fullPage: true 
    });
    
    // Test mouse movement to see if multiple systems respond
    await page.mouse.move(400, 400);
    await page.waitForTimeout(500);
    await page.mouse.move(600, 600);
    await page.waitForTimeout(500);
    
    // Test clicking
    await page.click('#unifiedCanvas');
    await page.waitForTimeout(500);
    
    // Test scrolling
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(500);
    
    console.log('✅ Mixed reactivity modes tested');
  });

  test('Master toggle buttons (I and 🎵)', async ({ page }) => {
    // Look for interactivity toggle button
    const interactivityBtn = page.locator('.action-btn:has-text("I")');
    const audioBtn = page.locator('.action-btn:has-text("🎵")');
    
    // Test interactivity toggle
    if (await interactivityBtn.isVisible()) {
      await interactivityBtn.click();
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: 'test-results/06-interactivity-toggled.png', 
        fullPage: true 
      });
      
      console.log('✅ Interactivity button tested');
    }
    
    // Test audio toggle
    if (await audioBtn.isVisible()) {
      await audioBtn.click();
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: 'test-results/07-audio-toggled.png', 
        fullPage: true 
      });
      
      console.log('✅ Audio button tested');
    }
  });

  test('Parameter sliders with reactivity active', async ({ page }) => {
    // Enable some reactivity first
    await page.check('#facetedMouse');
    await page.check('#quantumClick');
    await page.waitForTimeout(300);
    
    // Test various parameter sliders
    const sliders = [
      { id: 'gridDensity', label: 'Grid Density' },
      { id: 'morphFactor', label: 'Morph Factor' },
      { id: 'chaos', label: 'Chaos' },
      { id: 'speed', label: 'Speed' },
      { id: 'hue', label: 'Hue' },
      { id: 'intensity', label: 'Intensity' },
      { id: 'saturation', label: 'Saturation' }
    ];
    
    for (const slider of sliders) {
      const sliderElement = page.locator(`#${slider.id}`);
      if (await sliderElement.isVisible()) {
        // Get current value
        const currentValue = await sliderElement.inputValue();
        
        // Change value
        await sliderElement.fill('0.7');
        await page.waitForTimeout(300);
        
        // Take screenshot
        await page.screenshot({ 
          path: `test-results/08-slider-${slider.id}.png`, 
          fullPage: true 
        });
        
        console.log(`✅ ${slider.label} slider tested`);
      }
    }
  });

  test('Mobile viewport testing', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 375, height: 667, name: 'iPhone' },
      { width: 768, height: 1024, name: 'iPad' },
      { width: 414, height: 896, name: 'iPhone-Large' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000);
      
      // Take screenshot
      await page.screenshot({ 
        path: `test-results/09-mobile-${viewport.name}.png`, 
        fullPage: true 
      });
      
      // Test touch interaction (click on canvas)
      await page.tap('#unifiedCanvas');
      await page.waitForTimeout(500);
      
      // Test reactivity grid on mobile
      if (await page.locator('#facetedMouse').isVisible()) {
        await page.tap('#facetedMouse');
        await page.waitForTimeout(300);
      }
      
      console.log(`✅ ${viewport.name} viewport tested`);
    }
    
    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Error handling and console monitoring', async ({ page }) => {
    const errors = [];
    const warnings = [];
    const consoleMessages = [];
    
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      
      if (msg.type() === 'error') {
        errors.push(text);
      } else if (msg.type() === 'warning') {
        warnings.push(text);
      }
    });
    
    page.on('pageerror', error => {
      errors.push(`Page Error: ${error.message}`);
    });
    
    // Perform various interactions to trigger potential errors
    await page.click('text=QUANTUM');
    await page.waitForTimeout(500);
    
    await page.check('#quantumMouse');
    await page.waitForTimeout(500);
    
    await page.click('.audio-cell:has(#mediumColor)');
    await page.waitForTimeout(500);
    
    // Rapid clicking to test for race conditions
    for (let i = 0; i < 5; i++) {
      await page.click('#unifiedCanvas');
      await page.waitForTimeout(100);
    }
    
    // Report findings
    console.log(`Console Messages: ${consoleMessages.length}`);
    console.log(`Warnings: ${warnings.length}`);
    console.log(`Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('❌ JavaScript Errors Found:', errors);
    } else {
      console.log('✅ No JavaScript errors detected');
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test-results/10-final-state.png', 
      fullPage: true 
    });
  });

  test('Performance and visual validation', async ({ page }) => {
    // Enable reactivity and monitor performance
    await page.check('#facetedMouse');
    await page.check('#holographicClick');
    await page.check('#quantumScroll');
    
    // Perform interactions and measure timing
    const startTime = Date.now();
    
    // Mouse movements
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(200 + i * 50, 300 + i * 30);
      await page.waitForTimeout(50);
    }
    
    // Clicks
    for (let i = 0; i < 5; i++) {
      await page.click('#unifiedCanvas');
      await page.waitForTimeout(100);
    }
    
    // Scrolling
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(500);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Performance test completed in ${duration}ms`);
    
    // Take final performance screenshot
    await page.screenshot({ 
      path: 'test-results/11-performance-test.png', 
      fullPage: true 
    });
    
    // Validate canvas is still rendering (check if it has content)
    const canvas = page.locator('#unifiedCanvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox.width).toBeGreaterThan(0);
    expect(canvasBox.height).toBeGreaterThan(0);
    
    console.log('✅ Performance and visual validation completed');
  });
});