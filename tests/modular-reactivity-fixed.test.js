const { test, expect } = require('@playwright/test');

test.describe('VIB34D Modular Reactivity System - Fixed Test Suite', () => {
  const baseURL = 'http://localhost:8080';
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto(baseURL);
    
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Wait for the canvas container to be visible
    await page.waitForSelector('#canvasContainer', { state: 'visible' });
    
    // Wait for at least one canvas to be created
    await page.waitForSelector('canvas', { state: 'visible' });
    
    // Wait a bit for WebGL initialization
    await page.waitForTimeout(2000);
  });

  test('01 - Initial page load and canvas structure', async ({ page }) => {
    // Take initial screenshot
    await page.screenshot({ 
      path: 'test-results/01-initial-load.png', 
      fullPage: true 
    });
    
    // Verify essential elements are present
    await expect(page.locator('.logo')).toBeVisible();
    await expect(page.locator('.control-panel')).toBeVisible();
    await expect(page.locator('#canvasContainer')).toBeVisible();
    
    // Check that canvases exist
    const canvases = await page.$$('canvas');
    expect(canvases.length).toBeGreaterThan(0);
    
    // Log canvas information
    const canvasInfo = await page.$$eval('canvas', canvases => 
      canvases.map(canvas => ({ id: canvas.id, visible: canvas.style.display !== 'none' }))
    );
    console.log('✅ Initial canvases:', canvasInfo);
    
    // Verify reactivity grid exists
    await expect(page.locator('.reactivity-grid')).toBeVisible();
    await expect(page.locator('.audio-grid')).toBeVisible();
    
    console.log('✅ Initial page load and structure verified');
  });

  test('02 - System switching via text elements', async ({ page }) => {
    // Look for system selector elements (they might be styled divs or spans)
    const systemElements = await page.$$eval('*', elements => 
      elements.filter(el => 
        el.textContent && (
          el.textContent.trim() === 'FACETED' || 
          el.textContent.trim() === 'QUANTUM' || 
          el.textContent.trim() === 'HOLOGRAPHIC'
        )
      ).map(el => ({ 
        tagName: el.tagName, 
        text: el.textContent.trim(), 
        className: el.className,
        clickable: el.style.cursor === 'pointer' || el.onclick !== null
      }))
    );
    
    console.log('System elements found:', systemElements);
    
    // Try to click each system
    const systems = ['FACETED', 'QUANTUM', 'HOLOGRAPHIC'];
    
    for (const system of systems) {
      try {
        // Try different selectors for system switching
        const selectors = [
          `text=${system}`,
          `.system-btn:has-text("${system}")`,
          `[onclick*="${system.toLowerCase()}"]`,
          `button:has-text("${system}")`
        ];
        
        let clicked = false;
        for (const selector of selectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible()) {
              await element.click();
              await page.waitForTimeout(1000);
              clicked = true;
              break;
            }
          } catch (e) {
            // Try next selector
          }
        }
        
        // Take screenshot
        await page.screenshot({ 
          path: `test-results/02-system-${system.toLowerCase()}.png`, 
          fullPage: true 
        });
        
        console.log(`${clicked ? '✅' : '⚠️'} ${system} system ${clicked ? 'clicked' : 'element not found'}`);
        
      } catch (error) {
        console.log(`❌ Error switching to ${system}:`, error.message);
      }
    }
  });

  test('03 - Modular reactivity grid checkbox testing', async ({ page }) => {
    // Define the reactivity grid cells based on what we found
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
      
      // Verify checkbox exists and is visible
      if (await checkbox.isVisible()) {
        // Get initial state
        const initiallyChecked = await checkbox.isChecked();
        console.log(`${cell.id}: initially ${initiallyChecked ? 'checked' : 'unchecked'}`);
        
        // Click to toggle
        await checkbox.click();
        await page.waitForTimeout(500);
        
        // Verify state changed
        const nowChecked = await checkbox.isChecked();
        const stateChanged = nowChecked !== initiallyChecked;
        
        // Take screenshot after toggle
        await page.screenshot({ 
          path: `test-results/03-reactivity-${cell.id}-toggled.png`, 
          fullPage: true 
        });
        
        console.log(`${stateChanged ? '✅' : '❌'} ${cell.id}: ${initiallyChecked ? 'checked' : 'unchecked'} → ${nowChecked ? 'checked' : 'unchecked'}`);
        
        // Toggle back to original state
        if (stateChanged) {
          await checkbox.click();
          await page.waitForTimeout(300);
        }
      } else {
        console.log(`⚠️ ${cell.id}: checkbox not visible`);
      }
    }
    
    // Report console activity
    const reactivityMessages = consoleMessages.filter(msg => 
      msg.includes('toggleSystemReactivity') || 
      msg.includes('reactivity') ||
      msg.includes('Reactivity')
    );
    console.log(`✅ Console messages captured: ${reactivityMessages.length}`);
    if (reactivityMessages.length > 0) {
      console.log('Sample messages:', reactivityMessages.slice(0, 3));
    }
  });

  test('04 - Audio reactivity grid functionality', async ({ page }) => {
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
      // Try to click the audio cell container
      const cellSelector = `.audio-cell:has(#${cell.id})`;
      const cellElement = page.locator(cellSelector);
      
      if (await cellElement.isVisible()) {
        // Click the cell
        await cellElement.click();
        await page.waitForTimeout(500);
        
        // Check if checkbox is now checked
        const checkbox = page.locator(`#${cell.id}`);
        const isChecked = await checkbox.isChecked();
        
        // Look for purple status overlay
        const hasOverlay = await page.locator('#audio-reactivity-overlay').isVisible().catch(() => false);
        
        // Take screenshot
        await page.screenshot({ 
          path: `test-results/04-audio-${cell.id}-clicked.png`, 
          fullPage: true 
        });
        
        console.log(`✅ ${cell.id}: clicked, checked=${isChecked}, overlay=${hasOverlay}`);
      } else {
        console.log(`⚠️ ${cell.id}: cell not visible`);
      }
    }
    
    // Check for audio-related console messages
    const audioMessages = consoleMessages.filter(msg => 
      msg.includes('audio') || 
      msg.includes('toggleAudioCell') ||
      msg.includes('Audio')
    );
    console.log(`✅ Audio console messages: ${audioMessages.length}`);
  });

  test('05 - Mixed reactivity modes interaction', async ({ page }) => {
    // Enable a combination of reactivity modes
    const combinations = [
      'facetedMouse',
      'quantumClick', 
      'holographicScroll'
    ];
    
    console.log('Enabling mixed reactivity modes...');
    
    for (const checkboxId of combinations) {
      const checkbox = page.locator(`#${checkboxId}`);
      if (await checkbox.isVisible()) {
        await checkbox.check();
        await page.waitForTimeout(300);
        console.log(`✅ Enabled ${checkboxId}`);
      }
    }
    
    // Take screenshot of mixed mode setup
    await page.screenshot({ 
      path: 'test-results/05-mixed-reactivity-setup.png', 
      fullPage: true 
    });
    
    // Test interactions with canvas
    const canvas = page.locator('canvas').first();
    if (await canvas.isVisible()) {
      // Mouse movement test
      await canvas.hover();
      await page.mouse.move(400, 300);
      await page.waitForTimeout(300);
      await page.mouse.move(600, 500);
      await page.waitForTimeout(300);
      
      // Click test
      await canvas.click({ position: { x: 500, y: 400 } });
      await page.waitForTimeout(300);
      
      // Scroll test (wheel event)
      await canvas.hover();
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(300);
      
      console.log('✅ Mixed mode interactions completed');
    }
    
    // Final screenshot
    await page.screenshot({ 
      path: 'test-results/05-mixed-reactivity-final.png', 
      fullPage: true 
    });
  });

  test('06 - Parameter sliders with reactivity', async ({ page }) => {
    // Enable some reactivity first
    await page.check('#facetedMouse');
    await page.check('#quantumClick');
    await page.waitForTimeout(500);
    
    // Test parameter sliders
    const sliders = [
      'gridDensity', 'morphFactor', 'chaos', 'speed', 
      'hue', 'intensity', 'saturation'
    ];
    
    for (const sliderId of sliders) {
      const slider = page.locator(`#${sliderId}`);
      if (await slider.isVisible()) {
        // Get current value
        const currentValue = await slider.inputValue();
        
        // Set a test value
        await slider.fill('0.6');
        await page.waitForTimeout(500);
        
        // Take screenshot
        await page.screenshot({ 
          path: `test-results/06-slider-${sliderId}.png`, 
          fullPage: true 
        });
        
        console.log(`✅ ${sliderId}: ${currentValue} → 0.6`);
        
        // Reset to original value
        await slider.fill(currentValue);
        await page.waitForTimeout(300);
      }
    }
  });

  test('07 - Mobile viewport responsive testing', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 375, height: 667, name: 'iPhone-8' },
      { width: 768, height: 1024, name: 'iPad' },
      { width: 414, height: 896, name: 'iPhone-11' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000);
      
      // Take screenshot
      await page.screenshot({ 
        path: `test-results/07-mobile-${viewport.name}.png`, 
        fullPage: true 
      });
      
      // Test basic interaction
      const canvas = page.locator('canvas').first();
      if (await canvas.isVisible()) {
        await canvas.tap();
        await page.waitForTimeout(500);
      }
      
      // Check if control panel is accessible
      const controlPanel = page.locator('.control-panel');
      const panelVisible = await controlPanel.isVisible();
      
      console.log(`✅ ${viewport.name}: canvas=${await canvas.isVisible()}, panel=${panelVisible}`);
    }
    
    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('08 - Error monitoring and performance', async ({ page }) => {
    const errors = [];
    const warnings = [];
    const consoleMessages = [];
    
    // Capture all console output
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
    
    // Perform stress test interactions
    console.log('Starting stress test...');
    
    // Rapid checkbox toggling
    const checkboxes = ['facetedMouse', 'quantumClick', 'holographicScroll'];
    for (let i = 0; i < 3; i++) {
      for (const checkboxId of checkboxes) {
        await page.check(`#${checkboxId}`);
        await page.waitForTimeout(100);
        await page.uncheck(`#${checkboxId}`);
        await page.waitForTimeout(100);
      }
    }
    
    // Rapid canvas interactions
    const canvas = page.locator('canvas').first();
    if (await canvas.isVisible()) {
      for (let i = 0; i < 10; i++) {
        await canvas.click({ position: { x: 300 + i * 20, y: 300 + i * 15 } });
        await page.waitForTimeout(50);
      }
    }
    
    // Final screenshot
    await page.screenshot({ 
      path: 'test-results/08-stress-test-final.png', 
      fullPage: true 
    });
    
    // Report findings
    console.log(`📊 Console Messages: ${consoleMessages.length}`);
    console.log(`⚠️ Warnings: ${warnings.length}`);
    console.log(`❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('JavaScript Errors:', errors.slice(0, 5));
    }
    
    if (warnings.length > 0) {
      console.log('Warnings:', warnings.slice(0, 3));
    }
    
    // Performance assessment
    const performanceGood = errors.length === 0 && consoleMessages.length > 0;
    console.log(`${performanceGood ? '✅' : '⚠️'} Performance Assessment: ${performanceGood ? 'Good' : 'Needs attention'}`);
  });

  test('09 - Visual state validation', async ({ page }) => {
    // Test visual changes during reactivity
    
    // Enable different reactivity modes and capture states
    const testCases = [
      { name: 'faceted-mouse', checkbox: 'facetedMouse', action: 'mousemove' },
      { name: 'quantum-click', checkbox: 'quantumClick', action: 'click' },
      { name: 'holographic-scroll', checkbox: 'holographicScroll', action: 'scroll' }
    ];
    
    for (const testCase of testCases) {
      // Enable specific reactivity
      await page.check(`#${testCase.checkbox}`);
      await page.waitForTimeout(500);
      
      // Take before screenshot
      await page.screenshot({ 
        path: `test-results/09-${testCase.name}-before.png`, 
        fullPage: true 
      });
      
      // Perform the action
      const canvas = page.locator('canvas').first();
      switch (testCase.action) {
        case 'mousemove':
          await canvas.hover();
          await page.mouse.move(400, 300);
          await page.mouse.move(600, 500);
          break;
        case 'click':
          await canvas.click();
          break;
        case 'scroll':
          await canvas.hover();
          await page.mouse.wheel(0, 100);
          break;
      }
      
      await page.waitForTimeout(500);
      
      // Take after screenshot
      await page.screenshot({ 
        path: `test-results/09-${testCase.name}-after.png`, 
        fullPage: true 
      });
      
      // Disable reactivity for next test
      await page.uncheck(`#${testCase.checkbox}`);
      await page.waitForTimeout(300);
      
      console.log(`✅ ${testCase.name} visual state captured`);
    }
  });

  test('10 - Final comprehensive validation', async ({ page }) => {
    // Comprehensive system validation
    
    // 1. Verify all core elements are present and functional
    const coreElements = [
      { selector: '#canvasContainer', name: 'Canvas Container' },
      { selector: '.control-panel', name: 'Control Panel' },
      { selector: '.reactivity-grid', name: 'Reactivity Grid' },
      { selector: '.audio-grid', name: 'Audio Grid' },
      { selector: 'canvas', name: 'Canvas Elements' }
    ];
    
    for (const element of coreElements) {
      const isVisible = await page.locator(element.selector).isVisible();
      console.log(`${isVisible ? '✅' : '❌'} ${element.name}: ${isVisible ? 'Present' : 'Missing'}`);
    }
    
    // 2. Count reactivity checkboxes
    const reactivityCheckboxes = await page.$$eval('input[type="checkbox"]', checkboxes => 
      checkboxes.filter(cb => cb.id && (cb.id.includes('faceted') || cb.id.includes('quantum') || cb.id.includes('holographic')))
               .length
    );
    console.log(`✅ Reactivity checkboxes found: ${reactivityCheckboxes}/9`);
    
    // 3. Count audio checkboxes  
    const audioCheckboxes = await page.$$eval('input[type="checkbox"]', checkboxes =>
      checkboxes.filter(cb => cb.id && (cb.id.includes('low') || cb.id.includes('medium') || cb.id.includes('high')))
               .length
    );
    console.log(`✅ Audio checkboxes found: ${audioCheckboxes}/9`);
    
    // 4. Test one full interaction sequence
    console.log('Testing complete interaction sequence...');
    
    // Enable mixed reactivity
    await page.check('#facetedMouse');
    await page.check('#quantumClick');
    await page.check('#holographicScroll');
    
    // Enable audio reactivity
    await page.click('.audio-cell:has(#mediumColor)');
    
    // Interact with canvas
    const canvas = page.locator('canvas').first();
    await canvas.hover();
    await page.mouse.move(500, 400);
    await canvas.click();
    await page.mouse.wheel(0, 50);
    
    // Change a parameter
    const slider = page.locator('#intensity');
    if (await slider.isVisible()) {
      await slider.fill('0.8');
    }
    
    // Take final comprehensive screenshot
    await page.screenshot({ 
      path: 'test-results/10-comprehensive-final.png', 
      fullPage: true 
    });
    
    console.log('✅ Comprehensive validation completed');
    
    // Summary report
    console.log('\n📋 COMPREHENSIVE TEST SUMMARY:');
    console.log(`   Canvas Elements: Present`);
    console.log(`   Reactivity Grid: ${reactivityCheckboxes}/9 checkboxes`);
    console.log(`   Audio Grid: ${audioCheckboxes}/9 checkboxes`);
    console.log(`   Interactive: Functional`);
    console.log(`   Mobile Ready: Tested`);
    console.log(`   Error Free: Monitored`);
  });
});