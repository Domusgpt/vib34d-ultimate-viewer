const { test } = require('@playwright/test');

test('Visual Documentation Capture', async ({ page }) => {
  console.log('📸 Capturing Visual Documentation for VIB34D System');
  
  await page.goto('http://localhost:8080');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // 1. Initial system state
  console.log('Capturing initial system state...');
  await page.screenshot({ 
    path: 'test-results/visual-01-initial-system.png', 
    fullPage: true 
  });
  
  // 2. Reactivity grid focus
  console.log('Capturing reactivity grid...');
  await page.screenshot({ 
    path: 'test-results/visual-02-reactivity-grid.png',
    clip: { x: 0, y: 400, width: 400, height: 400 }
  });
  
  // 3. Audio grid focus  
  console.log('Capturing audio grid...');
  await page.screenshot({ 
    path: 'test-results/visual-03-audio-grid.png',
    clip: { x: 0, y: 800, width: 400, height: 400 }
  });
  
  // 4. Enable mixed reactivity mode
  console.log('Testing mixed reactivity mode...');
  try {
    await page.check('#facetedMouse', { timeout: 2000 });
    await page.check('#quantumClick', { timeout: 2000 });
    await page.check('#holographicScroll', { timeout: 2000 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'test-results/visual-04-mixed-reactivity.png', 
      fullPage: true 
    });
    console.log('✅ Mixed reactivity mode captured');
  } catch (e) {
    console.log('⚠️ Mixed reactivity issue:', e.message);
    await page.screenshot({ 
      path: 'test-results/visual-04-mixed-reactivity-error.png', 
      fullPage: true 
    });
  }
  
  // 5. Audio interactions
  console.log('Testing audio cell interactions...');
  try {
    await page.click('.audio-cell:has(#lowColor)', { timeout: 2000 });
    await page.waitForTimeout(500);
    await page.click('.audio-cell:has(#mediumGeometry)', { timeout: 2000 });
    await page.waitForTimeout(500);
    await page.click('.audio-cell:has(#highMovement)', { timeout: 2000 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'test-results/visual-05-audio-interactions.png', 
      fullPage: true 
    });
    console.log('✅ Audio interactions captured');
  } catch (e) {
    console.log('⚠️ Audio interaction issue:', e.message);
  }
  
  // 6. Canvas interaction demo
  console.log('Demonstrating canvas interactions...');
  try {
    const canvas = await page.locator('#accent-canvas').boundingBox();
    if (canvas) {
      // Move mouse to different positions  
      await page.mouse.move(canvas.x + 200, canvas.y + 200);
      await page.waitForTimeout(300);
      await page.mouse.move(canvas.x + 400, canvas.y + 300);
      await page.waitForTimeout(300);
      
      // Click on canvas
      await page.mouse.click(canvas.x + 300, canvas.y + 250);
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: 'test-results/visual-06-canvas-interaction.png', 
        fullPage: true 
      });
      console.log('✅ Canvas interactions captured');
    }
  } catch (e) {
    console.log('⚠️ Canvas interaction issue:', e.message);
  }
  
  // 7. Mobile view
  console.log('Testing mobile responsive layout...');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  
  await page.screenshot({ 
    path: 'test-results/visual-07-mobile-layout.png', 
    fullPage: true 
  });
  
  // 8. Parameter control demonstration
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(1000);
  
  console.log('Testing parameter controls...');
  try {
    // Adjust some parameters
    await page.fill('#intensity', '0.8');
    await page.waitForTimeout(300);
    await page.fill('#hue', '180');
    await page.waitForTimeout(300);
    await page.fill('#gridDensity', '75');
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'test-results/visual-08-parameter-changes.png', 
      fullPage: true 
    });
    console.log('✅ Parameter changes captured');
  } catch (e) {
    console.log('⚠️ Parameter control issue:', e.message);
  }
  
  // 9. Final system state
  console.log('Capturing final system state...');
  await page.screenshot({ 
    path: 'test-results/visual-09-final-state.png', 
    fullPage: true 
  });
  
  console.log('📸 Visual documentation complete!');
  console.log('Generated 9 screenshots in test-results/');
});