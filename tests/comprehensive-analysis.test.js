const { test, expect } = require('@playwright/test');

test('VIB34D Comprehensive System Analysis', async ({ page }) => {
  console.log('🎯 VIB34D MODULAR REACTIVITY SYSTEM COMPREHENSIVE ANALYSIS');
  console.log('='.repeat(65));
  
  await page.goto('http://localhost:8080');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(4000); // Extended wait for full initialization
  
  // ========== STRUCTURE ANALYSIS ==========
  console.log('\n📋 1. SYSTEM STRUCTURE ANALYSIS');
  
  // Canvas analysis
  const canvases = await page.$$eval('canvas', canvases => 
    canvases.map(canvas => ({
      id: canvas.id,
      width: canvas.width,
      height: canvas.height,
      visible: canvas.style.display !== 'none',
      zIndex: window.getComputedStyle(canvas).zIndex
    }))
  );
  
  console.log(`   Canvas Elements: ${canvases.length} total`);
  canvases.forEach(canvas => {
    console.log(`   - ${canvas.id}: ${canvas.width}x${canvas.height} (z:${canvas.zIndex})`);
  });
  
  // UI Components
  const uiComponents = {
    controlPanel: await page.locator('.control-panel').isVisible(),
    reactivityGrid: await page.locator('.reactivity-grid').isVisible(),
    audioGrid: await page.locator('.audio-grid').isVisible(),
    logo: await page.locator('.logo').isVisible(),
    canvasContainer: await page.locator('#canvasContainer').isVisible()
  };
  
  console.log(`\n   UI Components:`);
  Object.entries(uiComponents).forEach(([name, visible]) => {
    console.log(`   - ${name}: ${visible ? '✅ Present' : '❌ Missing'}`);
  });
  
  // Take initial screenshot
  await page.screenshot({ 
    path: 'test-results/analysis-01-structure.png', 
    fullPage: true 
  });
  
  // ========== REACTIVITY GRID ANALYSIS ==========
  console.log('\n🎮 2. MODULAR REACTIVITY GRID ANALYSIS');
  
  const reactivityCells = [
    { id: 'facetedMouse', system: 'faceted', type: 'mouse', expected: 'Rotations' },
    { id: 'facetedClick', system: 'faceted', type: 'click', expected: 'Flash' },
    { id: 'facetedScroll', system: 'faceted', type: 'scroll', expected: 'Density' },
    { id: 'quantumMouse', system: 'quantum', type: 'mouse', expected: 'Velocity' },
    { id: 'quantumClick', system: 'quantum', type: 'click', expected: 'Burst' },
    { id: 'quantumScroll', system: 'quantum', type: 'scroll', expected: 'Cycles' },
    { id: 'holographicMouse', system: 'holographic', type: 'mouse', expected: 'Shimmer' },
    { id: 'holographicClick', system: 'holographic', type: 'click', expected: 'Burst' },
    { id: 'holographicScroll', system: 'holographic', type: 'scroll', expected: 'Flow' }
  ];
  
  let reactivityResults = [];
  for (const cell of reactivityCells) {
    try {
      const checkbox = page.locator(`#${cell.id}`);
      const isVisible = await checkbox.isVisible({ timeout: 1000 });
      let isChecked = false;
      let canToggle = false;
      
      if (isVisible) {
        isChecked = await checkbox.isChecked();
        // Test toggling with timeout
        try {
          await checkbox.click({ timeout: 2000 });
          await page.waitForTimeout(300);
          const newState = await checkbox.isChecked();
          canToggle = newState !== isChecked;
          // Reset
          if (canToggle) {
            await checkbox.click({ timeout: 1000 });
          }
        } catch (e) {
          canToggle = false;
        }
      }
      
      reactivityResults.push({
        ...cell,
        visible: isVisible,
        checked: isChecked,
        functional: canToggle
      });
      
    } catch (error) {
      reactivityResults.push({
        ...cell,
        visible: false,
        checked: false,
        functional: false,
        error: error.message
      });
    }
  }
  
  console.log('   Reactivity Grid Status:');
  reactivityResults.forEach(result => {
    const status = result.functional ? '✅' : (result.visible ? '⚠️' : '❌');
    console.log(`   ${status} ${result.id}: ${result.system}/${result.type} (${result.expected})`);
    if (result.error) console.log(`      Error: ${result.error}`);
  });
  
  const functionalReactivity = reactivityResults.filter(r => r.functional).length;
  console.log(`\n   Summary: ${functionalReactivity}/9 reactivity cells functional`);
  
  // Take reactivity screenshot
  await page.screenshot({ 
    path: 'test-results/analysis-02-reactivity.png', 
    fullPage: true 
  });
  
  // ========== AUDIO GRID ANALYSIS ==========
  console.log('\n🎵 3. AUDIO REACTIVITY GRID ANALYSIS');
  
  const audioCells = [
    { id: 'lowColor', sensitivity: 'low', mode: 'color', expected: 'Subtle' },
    { id: 'lowGeometry', sensitivity: 'low', mode: 'geometry', expected: 'Gentle' },
    { id: 'lowMovement', sensitivity: 'low', mode: 'movement', expected: 'Smooth' },
    { id: 'mediumColor', sensitivity: 'medium', mode: 'color', expected: 'Dynamic' },
    { id: 'mediumGeometry', sensitivity: 'medium', mode: 'geometry', expected: 'Morphing' },
    { id: 'mediumMovement', sensitivity: 'medium', mode: 'movement', expected: 'Flowing' },
    { id: 'highColor', sensitivity: 'high', mode: 'color', expected: 'Intense' },
    { id: 'highGeometry', sensitivity: 'high', mode: 'geometry', expected: 'Explosive' },
    { id: 'highMovement', sensitivity: 'high', mode: 'movement', expected: 'Chaotic' }
  ];
  
  let audioResults = [];
  for (const cell of audioCells) {
    try {
      const cellElement = page.locator(`.audio-cell:has(#${cell.id})`);
      const isVisible = await cellElement.isVisible({ timeout: 1000 });
      let canClick = false;
      
      if (isVisible) {
        try {
          await cellElement.click({ timeout: 2000 });
          await page.waitForTimeout(300);
          canClick = true;
        } catch (e) {
          canClick = false;
        }
      }
      
      audioResults.push({
        ...cell,
        visible: isVisible,
        functional: canClick
      });
      
    } catch (error) {
      audioResults.push({
        ...cell,
        visible: false,
        functional: false,
        error: error.message
      });
    }
  }
  
  console.log('   Audio Grid Status:');
  audioResults.forEach(result => {
    const status = result.functional ? '✅' : (result.visible ? '⚠️' : '❌');
    console.log(`   ${status} ${result.id}: ${result.sensitivity}/${result.mode} (${result.expected})`);
  });
  
  const functionalAudio = audioResults.filter(r => r.functional).length;
  console.log(`\n   Summary: ${functionalAudio}/9 audio cells functional`);
  
  // Take audio screenshot
  await page.screenshot({ 
    path: 'test-results/analysis-03-audio.png', 
    fullPage: true 
  });
  
  // ========== SYSTEM SWITCHING ANALYSIS ==========
  console.log('\n🔄 4. SYSTEM SWITCHING ANALYSIS');
  
  // Look for system selectors
  const systemElements = await page.$$eval('*', elements => 
    elements.filter(el => 
      el.textContent && /^(FACETED|QUANTUM|HOLOGRAPHIC)$/i.test(el.textContent.trim())
    ).map(el => ({
      text: el.textContent.trim(),
      tagName: el.tagName,
      className: el.className,
      onclick: !!el.onclick
    }))
  );
  
  console.log(`   System selector elements found: ${systemElements.length}`);
  systemElements.forEach(el => {
    console.log(`   - ${el.text}: ${el.tagName}.${el.className} (clickable: ${el.onclick})`);
  });
  
  // ========== PARAMETER CONTROL ANALYSIS ==========
  console.log('\n🎛️ 5. PARAMETER CONTROL ANALYSIS');
  
  const parameterSliders = ['gridDensity', 'morphFactor', 'chaos', 'speed', 'hue', 'intensity', 'saturation'];
  let sliderResults = [];
  
  for (const sliderId of parameterSliders) {
    try {
      const slider = page.locator(`#${sliderId}`);
      const isVisible = await slider.isVisible({ timeout: 1000 });
      let canControl = false;
      let currentValue = '';
      
      if (isVisible) {
        try {
          currentValue = await slider.inputValue();
          await slider.fill('0.5');
          await page.waitForTimeout(200);
          canControl = true;
          // Reset
          await slider.fill(currentValue);
        } catch (e) {
          canControl = false;
        }
      }
      
      sliderResults.push({
        id: sliderId,
        visible: isVisible,
        functional: canControl,
        value: currentValue
      });
      
    } catch (error) {
      sliderResults.push({
        id: sliderId,
        visible: false,
        functional: false,
        error: error.message
      });
    }
  }
  
  console.log('   Parameter Sliders:');
  sliderResults.forEach(result => {
    const status = result.functional ? '✅' : (result.visible ? '⚠️' : '❌');
    console.log(`   ${status} ${result.id}: ${result.value || 'N/A'}`);
  });
  
  const functionalSliders = sliderResults.filter(r => r.functional).length;
  console.log(`\n   Summary: ${functionalSliders}/7 parameter sliders functional`);
  
  // ========== CANVAS INTERACTION TESTING ==========
  console.log('\n🖼️ 6. CANVAS INTERACTION TESTING');
  
  try {
    // Get the top-most canvas (accent layer)
    const topCanvas = page.locator('#accent-canvas');
    const boundingBox = await topCanvas.boundingBox();
    
    if (boundingBox) {
      // Test basic mouse movement (without problematic hover)
      await page.mouse.move(boundingBox.x + 100, boundingBox.y + 100);
      await page.waitForTimeout(200);
      
      // Test click
      await page.mouse.click(boundingBox.x + boundingBox.width/2, boundingBox.y + boundingBox.height/2);
      await page.waitForTimeout(200);
      
      console.log(`   ✅ Canvas interaction: Functional (${boundingBox.width}x${boundingBox.height})`);
    } else {
      console.log(`   ❌ Canvas interaction: No bounding box available`);
    }
  } catch (error) {
    console.log(`   ❌ Canvas interaction: ${error.message}`);
  }
  
  // ========== MOBILE RESPONSIVENESS CHECK ==========
  console.log('\n📱 7. MOBILE RESPONSIVENESS CHECK');
  
  // Test mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  
  const mobileComponents = {
    panel: await page.locator('.control-panel').isVisible(),
    reactivity: await page.locator('.reactivity-grid').isVisible(),
    audio: await page.locator('.audio-grid').isVisible(),
    canvas: await page.locator('#accent-canvas').isVisible()
  };
  
  console.log('   Mobile Layout (375x667):');
  Object.entries(mobileComponents).forEach(([name, visible]) => {
    console.log(`   - ${name}: ${visible ? '✅ Visible' : '❌ Hidden'}`);
  });
  
  // Take mobile screenshot
  await page.screenshot({ 
    path: 'test-results/analysis-04-mobile.png', 
    fullPage: true 
  });
  
  // Reset to desktop
  await page.setViewportSize({ width: 1280, height: 720 });
  
  // ========== ERROR MONITORING ==========
  console.log('\n🚨 8. ERROR MONITORING & CONSOLE ANALYSIS');
  
  const consoleMessages = [];
  const errors = [];
  const warnings = [];
  
  // Monitor for 3 seconds
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  
  // Trigger some interactions to generate console activity
  try {
    await page.click('#facetedMouse', { timeout: 2000 });
    await page.waitForTimeout(500);
    await page.click('#mediumColor', { timeout: 2000 });  
    await page.waitForTimeout(500);
  } catch (e) {
    console.log(`   Interaction test error: ${e.message}`);
  }
  
  await page.waitForTimeout(2000); // Wait for console messages
  
  console.log(`   Console Activity: ${consoleMessages.length} messages`);
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Warnings: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('   Error samples:');
    errors.slice(0, 3).forEach(error => console.log(`   - ${error}`));
  }
  
  // ========== FINAL COMPREHENSIVE SCREENSHOT ==========
  await page.screenshot({ 
    path: 'test-results/analysis-05-comprehensive-final.png', 
    fullPage: true 
  });
  
  // ========== OVERALL ASSESSMENT ==========
  console.log('\n📊 COMPREHENSIVE SYSTEM ASSESSMENT');
  console.log('='.repeat(50));
  
  const scores = {
    structure: Object.values(uiComponents).filter(Boolean).length / Object.keys(uiComponents).length,
    reactivity: functionalReactivity / 9,
    audio: functionalAudio / 9,
    parameters: functionalSliders / 7,
    mobile: Object.values(mobileComponents).filter(Boolean).length / Object.keys(mobileComponents).length,
    stability: errors.length === 0 ? 1 : Math.max(0, 1 - errors.length * 0.1)
  };
  
  const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
  
  console.log('📈 Component Scores:');
  Object.entries(scores).forEach(([component, score]) => {
    const percentage = Math.round(score * 100);
    const status = score >= 0.8 ? '✅' : score >= 0.6 ? '⚠️' : '❌';
    console.log(`   ${status} ${component.padEnd(12)}: ${percentage}%`);
  });
  
  console.log(`\n🎯 Overall System Health: ${Math.round(overallScore * 100)}%`);
  
  // Status assessment
  if (overallScore >= 0.8) {
    console.log('✅ STATUS: EXCELLENT - System is performing very well');
  } else if (overallScore >= 0.6) {
    console.log('⚠️ STATUS: GOOD - System is functional with minor issues');
  } else {
    console.log('❌ STATUS: NEEDS ATTENTION - Several components require fixes');
  }
  
  // ========== RECOMMENDATIONS ==========
  console.log('\n💡 RECOMMENDATIONS');
  console.log('-'.repeat(30));
  
  if (scores.reactivity < 0.8) {
    console.log('• Fix reactivity checkbox functionality - some cells not responding');
  }
  if (scores.audio < 0.8) {
    console.log('• Debug audio grid cell interactions');
  }
  if (scores.parameters < 0.8) {
    console.log('• Check parameter slider responsiveness');
  }
  if (systemElements.length === 0) {
    console.log('• System switching buttons may need to be identified/fixed');
  }
  if (errors.length > 0) {
    console.log('• Investigate JavaScript console errors');
  }
  if (scores.mobile < 0.8) {
    console.log('• Improve mobile layout responsiveness');
  }
  
  if (overallScore >= 0.8) {
    console.log('• System is ready for advanced feature development');
    console.log('• Consider adding automated testing for regression prevention');
    console.log('• Focus on performance optimization and user experience enhancements');
  }
  
  console.log('\n🏁 ANALYSIS COMPLETE');
  console.log(`📸 Screenshots saved: 5 analysis images in test-results/`);
  console.log('='.repeat(65));
});