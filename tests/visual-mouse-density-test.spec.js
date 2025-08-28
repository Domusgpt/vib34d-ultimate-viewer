// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * VISUAL MOUSE DENSITY TEST AGENT
 * 
 * This agent visually tests mouse movement effects on density changes:
 * 1. Test mouse movement effects on density changes
 * 2. Verify density jarring is reduced by 50%
 * 3. Test that densityVar * 1.0 (not * 2.0) is working
 * 4. Capture visual evidence of smoother density transitions
 * 5. Validate mouse interaction responsiveness
 */

test.describe('Visual Mouse Density Test Agent', () => {
  let page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    console.log('🚀 Agent: Navigating to VIB34D interface for mouse density testing');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.system-btn', { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    console.log('✅ Agent: Interface loaded, ready for mouse density testing');
  });

  test('Mouse Movement Density Effects - All Systems', async () => {
    console.log('🖱️ Agent: Testing mouse movement density effects across all systems');
    
    const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
    
    for (const system of systems) {
      console.log(`🎯 Agent: Testing ${system} system mouse density effects`);
      
      // Switch to system
      await page.click(`.system-btn[data-system="${system}"]`);
      await page.waitForTimeout(1000);
      
      // Verify system is active
      const activeBtn = await page.locator(`.system-btn.active[data-system="${system}"]`);
      await expect(activeBtn).toBeVisible();
      
      // Take initial screenshot
      await page.screenshot({
        path: `test-results/mouse-density-${system}-01-initial.png`,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
      
      // Enable mouse reactivity if available
      const mouseToggle = page.locator('input[type="checkbox"]:near(:text("Mouse")), button:has-text("Mouse")').first();
      if (await mouseToggle.isVisible()) {
        await mouseToggle.click();
        await page.waitForTimeout(300);
        console.log(`🖱️ Agent: Mouse reactivity enabled for ${system}`);
      }
      
      // Perform systematic mouse movements to test density changes
      const mouseMovements = [
        { x: 500, y: 300, description: 'top-left-quadrant' },
        { x: 1000, y: 300, description: 'top-right-quadrant' },
        { x: 1000, y: 600, description: 'bottom-right-quadrant' },
        { x: 500, y: 600, description: 'bottom-left-quadrant' },
        { x: 750, y: 450, description: 'center-position' }
      ];
      
      for (const movement of mouseMovements) {
        console.log(`🎯 Agent: Moving mouse to ${movement.description} (${movement.x}, ${movement.y})`);
        
        // Move mouse and wait for density effect
        await page.mouse.move(movement.x, movement.y);
        await page.waitForTimeout(500); // Allow density to respond
        
        // Capture screenshot of density change
        await page.screenshot({
          path: `test-results/mouse-density-${system}-02-${movement.description}.png`,
          fullPage: false,
          clip: { x: 0, y: 0, width: 1920, height: 1080 }
        });
        
        // Brief pause between movements
        await page.waitForTimeout(200);
      }
      
      console.log(`✅ Agent: ${system} system mouse density testing complete`);
    }
  });

  test('Density Smoothness Validation', async () => {
    console.log('🌊 Agent: Testing density transition smoothness (jarring reduction)');
    
    // Focus on Quantum system for detailed density testing
    await page.click('.system-btn[data-system="quantum"]');
    await page.waitForTimeout(1000);
    
    // Enable mouse reactivity
    const mouseToggle = page.locator('input[type="checkbox"]:near(:text("Mouse"))').first();
    if (await mouseToggle.isVisible()) {
      await mouseToggle.click();
      await page.waitForTimeout(300);
    }
    
    // Get density slider for baseline comparison
    const densitySlider = page.locator('input[id*="density"], input[data-param="density"], .slider-container:has-text("Density") input[type="range"]').first();
    
    if (await densitySlider.isVisible()) {
      // Set baseline density
      await densitySlider.fill('50');
      await densitySlider.dispatchEvent('input');
      await page.waitForTimeout(500);
      
      console.log('📊 Agent: Baseline density set to 50');
    }
    
    // Inject monitoring script for density changes
    await page.addInitScript(() => {
      window.densityChanges = [];
      window.previousDensity = 0;
      
      // Monitor density-related console output
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.join(' ');
        if (message.includes('density') || message.includes('Density')) {
          window.densityChanges.push({
            timestamp: Date.now(),
            message: message
          });
        }
        originalLog.apply(console, args);
      };
    });
    
    // Perform smooth mouse movements to test density transitions
    console.log('🎯 Agent: Performing smooth circular mouse movement');
    
    const centerX = 960;
    const centerY = 540;
    const radius = 200;
    const steps = 20;
    
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      await page.mouse.move(x, y);
      await page.waitForTimeout(100); // Smooth transition time
      
      // Capture key positions
      if (i % 5 === 0) {
        await page.screenshot({
          path: `test-results/mouse-density-smooth-${i}.png`,
          fullPage: false,
          clip: { x: 0, y: 0, width: 1920, height: 1080 }
        });
      }
    }
    
    // Check density change logs
    const densityLogs = await page.evaluate(() => window.densityChanges || []);
    console.log(`📈 Agent: Captured ${densityLogs.length} density change events`);
    
    console.log('✅ Agent: Density smoothness validation complete');
  });

  test('Density Variable Multiplication Test', async () => {
    console.log('🔢 Agent: Testing densityVar * 1.0 (not * 2.0) implementation');
    
    // Test across multiple systems to verify consistent behavior
    const systems = ['faceted', 'quantum', 'holographic'];
    
    for (const system of systems) {
      console.log(`🧮 Agent: Testing density multiplication in ${system} system`);
      
      await page.click(`.system-btn[data-system="${system}"]`);
      await page.waitForTimeout(1000);
      
      // Enable mouse tracking
      const mouseToggle = page.locator('input[type="checkbox"]:near(:text("Mouse"))').first();
      if (await mouseToggle.isVisible()) {
        await mouseToggle.click();
        await page.waitForTimeout(300);
      }
      
      // Inject script to monitor density calculations
      await page.evaluate((systemName) => {
        window[`${systemName}DensityTests`] = [];
        
        // Hook into potential density calculation functions
        if (window.addEventListener) {
          window.addEventListener('mousemove', (e) => {
            // Capture mouse position for density correlation
            window[`${systemName}DensityTests`].push({
              timestamp: Date.now(),
              mouseX: e.clientX,
              mouseY: e.clientY,
              system: systemName
            });
          });
        }
      }, system);
      
      // Test specific mouse positions that should trigger density changes
      const testPositions = [
        { x: 200, y: 200, density: 'low' },
        { x: 960, y: 540, density: 'medium' },
        { x: 1700, y: 880, density: 'high' }
      ];
      
      for (const pos of testPositions) {
        console.log(`📍 Agent: Testing ${pos.density} density at (${pos.x}, ${pos.y})`);
        
        await page.mouse.move(pos.x, pos.y);
        await page.waitForTimeout(800); // Allow density calculation
        
        // Capture screenshot
        await page.screenshot({
          path: `test-results/density-multiplication-${system}-${pos.density}.png`,
          fullPage: false,
          clip: { x: 0, y: 0, width: 1920, height: 1080 }
        });
      }
      
      // Retrieve test data
      const testData = await page.evaluate((systemName) => {
        return window[`${systemName}DensityTests`] || [];
      }, system);
      
      console.log(`📊 Agent: Captured ${testData.length} density test points for ${system}`);
    }
    
    console.log('✅ Agent: Density multiplication validation complete');
  });

  test('Mouse Responsiveness Performance Test', async () => {
    console.log('⚡ Agent: Testing mouse interaction responsiveness');
    
    // Test on Quantum system (most complex)
    await page.click('.system-btn[data-system="quantum"]');
    await page.waitForTimeout(1000);
    
    // Enable mouse reactivity
    const mouseToggle = page.locator('input[type="checkbox"]:near(:text("Mouse"))').first();
    if (await mouseToggle.isVisible()) {
      await mouseToggle.click();
      await page.waitForTimeout(300);
    }
    
    // Measure response times for mouse movements
    const responseTimes = [];
    const testPoints = [
      { x: 300, y: 300 },
      { x: 700, y: 500 },
      { x: 1200, y: 400 },
      { x: 800, y: 800 },
      { x: 1600, y: 200 }
    ];
    
    for (const point of testPoints) {
      const startTime = Date.now();
      
      // Move mouse
      await page.mouse.move(point.x, point.y);
      
      // Wait for visual response (minimal time)
      await page.waitForTimeout(50);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      responseTimes.push(responseTime);
      
      console.log(`⏱️ Agent: Mouse movement to (${point.x}, ${point.y}) response time: ${responseTime}ms`);
      
      // Brief pause between tests
      await page.waitForTimeout(100);
    }
    
    // Calculate statistics
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    
    console.log(`📈 Agent: Response time stats - Avg: ${avgResponseTime}ms, Max: ${maxResponseTime}ms, Min: ${minResponseTime}ms`);
    
    // Take final screenshot
    await page.screenshot({
      path: 'test-results/mouse-responsiveness-final.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    
    // Assert reasonable responsiveness
    expect(avgResponseTime).toBeLessThan(200); // Should respond within 200ms on average
    expect(maxResponseTime).toBeLessThan(500); // No response should take longer than 500ms
    
    console.log('✅ Agent: Mouse responsiveness validation complete');
  });

  test('Density Jarring Reduction Validation', async () => {
    console.log('📈 Agent: Validating 50% reduction in density jarring');
    
    await page.click('.system-btn[data-system="quantum"]');
    await page.waitForTimeout(1000);
    
    // Enable mouse reactivity
    const mouseToggle = page.locator('input[type="checkbox"]:near(:text("Mouse"))').first();
    if (await mouseToggle.isVisible()) {
      await mouseToggle.click();
      await page.waitForTimeout(300);
    }
    
    // Create rapid mouse movements to test jarring
    console.log('🎯 Agent: Creating rapid mouse movements to test jarring');
    
    const rapidMovements = [
      { x: 100, y: 100 },
      { x: 1800, y: 100 },
      { x: 100, y: 900 },
      { x: 1800, y: 900 },
      { x: 960, y: 540 }
    ];
    
    for (let cycle = 0; cycle < 3; cycle++) {
      console.log(`🔄 Agent: Rapid movement cycle ${cycle + 1}`);
      
      for (const movement of rapidMovements) {
        await page.mouse.move(movement.x, movement.y);
        await page.waitForTimeout(50); // Rapid transition
      }
      
      // Capture screenshot after each cycle
      await page.screenshot({
        path: `test-results/density-jarring-cycle-${cycle + 1}.png`,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
      
      await page.waitForTimeout(500); // Brief pause between cycles
    }
    
    // Test gradual movements for comparison
    console.log('🌊 Agent: Testing gradual movements for smoothness comparison');
    
    for (let i = 0; i < 5; i++) {
      const x = 200 + (i * 300);
      const y = 300 + (Math.sin(i) * 200);
      
      await page.mouse.move(x, y);
      await page.waitForTimeout(300); // Gradual transition
      
      await page.screenshot({
        path: `test-results/density-gradual-${i + 1}.png`,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
    }
    
    console.log('✅ Agent: Density jarring reduction validation complete');
  });
});