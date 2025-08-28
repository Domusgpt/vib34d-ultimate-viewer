const { test, expect } = require('@playwright/test');

test('Debug canvas structure', async ({ page }) => {
  await page.goto('http://localhost:8080');
  await page.waitForLoadState('networkidle');
  
  // Wait for the page to load
  await page.waitForTimeout(3000);
  
  // Take initial screenshot
  await page.screenshot({ path: 'test-results/debug-initial-load.png', fullPage: true });
  
  // Check what canvas elements exist
  const canvases = await page.$$eval('canvas', canvases => 
    canvases.map(canvas => ({ id: canvas.id, className: canvas.className, visible: canvas.style.display !== 'none' }))
  );
  
  console.log('Available canvases:', canvases);
  
  // Check main containers
  const containers = await page.$$eval('div', divs => 
    divs.filter(div => div.className && (div.className.includes('canvas') || div.className.includes('container')))
        .map(div => ({ id: div.id, className: div.className }))
  );
  
  console.log('Canvas containers:', containers);
  
  // Check if canvas container exists
  const canvasContainer = await page.locator('#canvasContainer').isVisible();
  console.log('Canvas container visible:', canvasContainer);
  
  // Check system buttons
  const systemButtons = await page.$$eval('button', buttons => 
    buttons.filter(btn => btn.textContent && (btn.textContent.includes('FACETED') || btn.textContent.includes('QUANTUM') || btn.textContent.includes('HOLOGRAPHIC')))
           .map(btn => ({ text: btn.textContent.trim(), className: btn.className }))
  );
  
  console.log('System buttons:', systemButtons);
  
  // Check reactivity grid
  const reactivityCells = await page.$$eval('input[type="checkbox"]', checkboxes => 
    checkboxes.filter(cb => cb.id && (cb.id.includes('faceted') || cb.id.includes('quantum') || cb.id.includes('holographic')))
             .map(cb => ({ id: cb.id, checked: cb.checked }))
  );
  
  console.log('Reactivity checkboxes:', reactivityCells);
});