const { test, expect } = require('@playwright/test');

test('Geometry buttons detective test', async ({ page }) => {
  // Start a simple server
  await page.goto('file:///mnt/c/Users/millz/v2-refactored-quantum-extreme-color-layers%20-%20Copy/test-geometry-immediate.html');
  
  // Wait for page to load
  await page.waitForTimeout(1000);
  
  // Count geometry buttons
  const buttons = await page.locator('.geom-btn').all();
  const buttonCount = buttons.length;
  
  console.log(`🔍 PLAYWRIGHT: Found ${buttonCount} geometry buttons`);
  
  // Get button texts
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent();
    console.log(`🔍 Button ${i}: "${text}"`);
  }
  
  // Check if we have 9 buttons
  expect(buttonCount).toBe(9);
  
  // Check if HYPERTETRAHEDRON is the 9th button (index 8)
  if (buttonCount >= 9) {
    const lastButton = buttons[8];
    const lastButtonText = await lastButton.textContent();
    console.log(`🔍 Last button text: "${lastButtonText}"`);
    expect(lastButtonText.trim()).toBe('HYPERTETRAHEDRON');
  }
});

test('Real index-clean.html button test', async ({ page }) => {
  // Test the real application
  await page.goto('file:///mnt/c/Users/millz/v2-refactored-quantum-extreme-color-layers%20-%20Copy/index-clean.html');
  
  // Wait for modules to load
  await page.waitForTimeout(3000);
  
  // Look for console logs
  const logs = [];
  page.on('console', msg => {
    if (msg.text().includes('setupGeometry') || msg.text().includes('geometry')) {
      logs.push(msg.text());
    }
  });
  
  // Wait a bit more for setup to complete
  await page.waitForTimeout(2000);
  
  // Count geometry buttons in real app
  const buttons = await page.locator('#geometryGrid .geom-btn').all();
  const buttonCount = buttons.length;
  
  console.log(`🔍 REAL APP: Found ${buttonCount} geometry buttons`);
  console.log(`🔍 Console logs:`, logs);
  
  // Get button texts
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent();
    console.log(`🔍 Real Button ${i}: "${text}"`);
  }
  
  // This should be 9 but let's see what we actually get
  console.log(`🚨 EXPECTED: 9 buttons, ACTUAL: ${buttonCount} buttons`);
  
  if (buttonCount !== 9) {
    console.error(`🚨 BUG CONFIRMED: Missing ${9 - buttonCount} buttons!`);
    
    // Check if the grid element exists
    const grid = await page.locator('#geometryGrid').first();
    const gridHTML = await grid.innerHTML();
    console.log(`🔍 Grid HTML:`, gridHTML.substring(0, 500));
  }
});