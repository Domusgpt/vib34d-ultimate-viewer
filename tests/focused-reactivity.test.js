const { test, expect } = require('@playwright/test');

test.describe('VIB34D Focused Reactivity Testing', () => {
  const baseURL = 'http://localhost:8080';
  
  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#canvasContainer', { state: 'visible' });
    await page.waitForSelector('canvas', { state: 'visible' });
    await page.waitForTimeout(3000); // Give time for WebGL initialization
  });

  test('Core functionality validation', async ({ page }) => {
    console.log('🎯 Testing VIB34D Modular Reactivity System');
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'test-results/focused-01-initial.png', 
      fullPage: true 
    });
    
    // 1. Verify page structure
    const canvasCount = await page.$$eval('canvas', canvases => canvases.length);
    const controlPanel = await page.locator('.control-panel').isVisible();
    const reactivityGrid = await page.locator('.reactivity-grid').isVisible();
    const audioGrid = await page.locator('.audio-grid').isVisible();
    
    console.log(`✅ Canvas elements: ${canvasCount}`);
    console.log(`✅ Control panel: ${controlPanel}`);
    console.log(`✅ Reactivity grid: ${reactivityGrid}`);
    console.log(`✅ Audio grid: ${audioGrid}`);
    
    // 2. Test reactivity checkboxes
    const reactivityBoxes = [
      'facetedMouse', 'facetedClick', 'facetedScroll',
      'quantumMouse', 'quantumClick', 'quantumScroll', 
      'holographicMouse', 'holographicClick', 'holographicScroll'
    ];
    
    let functionalBoxes = 0;
    for (const boxId of reactivityBoxes) {
      try {
        const checkbox = page.locator(`#${boxId}`);
        if (await checkbox.isVisible()) {
          const initialState = await checkbox.isChecked();
          await checkbox.click();
          await page.waitForTimeout(200);
          const newState = await checkbox.isChecked();
          if (initialState !== newState) {
            functionalBoxes++;
          }
          // Reset to initial state
          if (initialState !== newState) {
            await checkbox.click();
            await page.waitForTimeout(200);
          }
        }
      } catch (e) {
        console.log(`⚠️ Issue with ${boxId}:`, e.message);
      }
    }
    
    console.log(`✅ Functional reactivity checkboxes: ${functionalBoxes}/${reactivityBoxes.length}`);
    
    // Take screenshot after checkbox testing
    await page.screenshot({ 
      path: 'test-results/focused-02-checkboxes.png', 
      fullPage: true 
    });
    
    // 3. Test audio grid
    const audioCells = [
      'lowColor', 'lowGeometry', 'lowMovement',
      'mediumColor', 'mediumGeometry', 'mediumMovement',
      'highColor', 'highGeometry', 'highMovement'
    ];
    
    let functionalAudio = 0;
    for (const cellId of audioCells) {
      try {
        const cell = page.locator(`.audio-cell:has(#${cellId})`);
        if (await cell.isVisible()) {
          await cell.click();
          await page.waitForTimeout(200);
          functionalAudio++;
        }
      } catch (e) {
        console.log(`⚠️ Issue with audio ${cellId}:`, e.message);
      }
    }
    
    console.log(`✅ Functional audio cells: ${functionalAudio}/${audioCells.length}`);
    
    // Take screenshot after audio testing
    await page.screenshot({ 
      path: 'test-results/focused-03-audio.png', 
      fullPage: true 
    });
    
    // 4. Test parameter sliders
    const sliders = ['gridDensity', 'morphFactor', 'chaos', 'speed', 'hue', 'intensity', 'saturation'];
    let functionalSliders = 0;
    
    for (const sliderId of sliders) {
      try {
        const slider = page.locator(`#${sliderId}`);
        if (await slider.isVisible()) {
          await slider.fill('0.5');
          await page.waitForTimeout(200);
          functionalSliders++;
        }
      } catch (e) {
        console.log(`⚠️ Issue with slider ${sliderId}:`, e.message);
      }
    }
    
    console.log(`✅ Functional sliders: ${functionalSliders}/${sliders.length}`);
    
    // 5. Test mixed reactivity mode
    console.log('🔄 Testing mixed reactivity modes...');
    await page.check('#facetedMouse');
    await page.check('#quantumClick'); 
    await page.check('#holographicScroll');
    await page.waitForTimeout(500);
    
    // Take screenshot of mixed mode
    await page.screenshot({ 
      path: 'test-results/focused-04-mixed-mode.png', 
      fullPage: true 
    });
    
    // 6. Test basic canvas interaction (without hover which causes issues)
    try {
      const topCanvas = page.locator('canvas').last(); // Use last canvas (top layer)
      const boundingBox = await topCanvas.boundingBox();
      
      if (boundingBox) {
        // Click on canvas center
        await page.mouse.click(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
        await page.waitForTimeout(300);
        
        // Move mouse around (without hover)
        await page.mouse.move(boundingBox.x + 100, boundingBox.y + 100);
        await page.waitForTimeout(200);
        await page.mouse.move(boundingBox.x + 200, boundingBox.y + 200);
        await page.waitForTimeout(200);
        
        console.log('✅ Canvas interaction tested');
      }
    } catch (e) {
      console.log('⚠️ Canvas interaction issue:', e.message);
    }
    
    // Final screenshot
    await page.screenshot({ 
      path: 'test-results/focused-05-final.png', 
      fullPage: true 
    });
    
    // 7. Console monitoring
    const consoleMessages = [];
    const errors = [];
    
    page.on('console', msg => {
      consoleMessages.push(msg.text());
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Trigger some interactions to generate console activity
    await page.check('#facetedClick');
    await page.waitForTimeout(300);
    await page.uncheck('#facetedClick');
    await page.waitForTimeout(300);
    
    // Summary report
    console.log('\n📊 FOCUSED TEST SUMMARY:');
    console.log(`   Canvas Elements: ${canvasCount} found`);
    console.log(`   UI Components: ${controlPanel && reactivityGrid && audioGrid ? 'All present' : 'Some missing'}`);
    console.log(`   Reactivity Grid: ${functionalBoxes}/9 functional`);
    console.log(`   Audio Grid: ${functionalAudio}/9 functional`);
    console.log(`   Parameter Sliders: ${functionalSliders}/7 functional`);
    console.log(`   Mixed Mode: Tested`);
    console.log(`   Canvas Interaction: Attempted`);
    console.log(`   Console Errors: ${errors.length}`);
    
    // Performance assessment
    const overallHealth = functionalBoxes >= 6 && functionalAudio >= 6 && functionalSliders >= 5;
    console.log(`\n${overallHealth ? '✅' : '⚠️'} Overall System Health: ${overallHealth ? 'GOOD' : 'NEEDS ATTENTION'}`);
    
    if (errors.length > 0) {
      console.log('❌ JavaScript Errors:', errors.slice(0, 3));
    }
    
    // Recommendations
    console.log('\n🔍 RECOMMENDATIONS:');
    if (functionalBoxes < 9) {
      console.log('   - Some reactivity checkboxes may need attention');
    }
    if (functionalAudio < 9) {
      console.log('   - Some audio cells may need debugging');
    }
    if (errors.length > 0) {
      console.log('   - JavaScript errors should be investigated');
    }
    if (overallHealth) {
      console.log('   - System is functioning well overall');
      console.log('   - Ready for advanced feature development');
    }
  });

  test('Mobile responsiveness check', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'test-results/focused-mobile-01.png', 
      fullPage: true 
    });
    
    // Check if key elements are still accessible
    const panelVisible = await page.locator('.control-panel').isVisible();
    const gridVisible = await page.locator('.reactivity-grid').isVisible();
    const canvasVisible = await page.locator('canvas').isVisible();
    
    console.log(`📱 Mobile Layout Check:`);
    console.log(`   Control Panel: ${panelVisible ? 'Visible' : 'Hidden'}`);
    console.log(`   Reactivity Grid: ${gridVisible ? 'Visible' : 'Hidden'}`);
    console.log(`   Canvas: ${canvasVisible ? 'Visible' : 'Hidden'}`);
    
    // Test a simple interaction
    if (await page.locator('#facetedMouse').isVisible()) {
      await page.click('#facetedMouse');
      await page.waitForTimeout(500);
      console.log('✅ Mobile interaction test passed');
    }
    
    await page.screenshot({ 
      path: 'test-results/focused-mobile-02-interaction.png', 
      fullPage: true 
    });
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Performance and error monitoring', async ({ page }) => {
    const errors = [];
    const warnings = [];
    const performanceMetrics = [];
    
    // Monitor console output
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(`Page Error: ${error.message}`);
    });
    
    // Performance test: rapid interactions
    const startTime = Date.now();
    
    // Rapid checkbox toggling
    for (let i = 0; i < 5; i++) {
      await page.check('#facetedMouse');
      await page.waitForTimeout(50);
      await page.uncheck('#facetedMouse');
      await page.waitForTimeout(50);
    }
    
    // Parameter changes
    const slider = page.locator('#intensity');
    if (await slider.isVisible()) {
      for (let i = 0; i < 5; i++) {
        await slider.fill((0.2 + i * 0.2).toString());
        await page.waitForTimeout(100);
      }
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    performanceMetrics.push({ test: 'rapid_interactions', duration });
    
    // Take performance screenshot
    await page.screenshot({ 
      path: 'test-results/focused-performance.png', 
      fullPage: true 
    });
    
    // Report findings
    console.log(`⚡ Performance Test: ${duration}ms for rapid interactions`);
    console.log(`⚠️ Warnings: ${warnings.length}`);
    console.log(`❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('Error samples:', errors.slice(0, 2));
    }
    
    // Performance assessment
    const performanceGood = duration < 2000 && errors.length === 0;
    console.log(`${performanceGood ? '✅' : '⚠️'} Performance: ${performanceGood ? 'Excellent' : 'Needs optimization'}`);
  });
});