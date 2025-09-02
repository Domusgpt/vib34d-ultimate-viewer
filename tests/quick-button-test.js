const { test, expect } = require('@playwright/test');

test('Quick Button Count Test', async ({ page }) => {
  await page.goto('http://localhost:8145/index-clean.html');
  await page.waitForTimeout(3000);
  
  // Count buttons
  const buttons = await page.locator('#geometryGrid .geom-btn');
  const count = await buttons.count();
  
  console.log(`🔍 Found ${count} geometry buttons`);
  
  // Get all button texts
  const texts = await buttons.allTextContents();
  texts.forEach((text, i) => {
    console.log(`🔍 Button ${i}: "${text}"`);
  });
  
  // Check for HYPERTETRAHEDRON specifically
  const hasHypertetrahedron = texts.some(text => text.includes('HYPERTETRAHEDRON'));
  console.log(`🎯 HYPERTETRAHEDRON found: ${hasHypertetrahedron}`);
  
  // Report results
  console.log(`✅ Expected: 9 buttons, Found: ${count} buttons`);
  if (count === 9 && hasHypertetrahedron) {
    console.log('🎉 SUCCESS: All 9 buttons including HYPERTETRAHEDRON are present!');
  } else {
    console.log('❌ ISSUE: Missing buttons or HYPERTETRAHEDRON not found');
  }
});