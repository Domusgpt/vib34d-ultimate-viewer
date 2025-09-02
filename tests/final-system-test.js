const { test, expect } = require('@playwright/test');

test('Final HyperTetrahedron System Test - All 4 Systems', async ({ page }) => {
  await page.goto('http://localhost:8145/index-clean.html');
  await page.waitForTimeout(3000);
  
  console.log('🔍 FINAL TEST: Starting comprehensive 9-button verification');
  
  const systems = ['faceted', 'quantum', 'holographic', 'polychora'];
  
  for (const system of systems) {
    console.log(`\n=== TESTING ${system.toUpperCase()} SYSTEM ===`);
    
    // Click system button
    await page.click(`[data-system="${system}"]`);
    await page.waitForTimeout(2000); // Wait for system to load
    
    // Count buttons
    const buttons = await page.locator('#geometryGrid .geom-btn');
    const count = await buttons.count();
    
    console.log(`🔍 ${system}: Found ${count} geometry buttons`);
    
    // Get all button texts
    const texts = await buttons.allTextContents();
    texts.forEach((text, i) => {
      console.log(`  Button ${i}: "${text}"`);
    });
    
    // Check for HyperTetrahedron variants
    const hasHyperTetLike = texts.some(text => 
      text.includes('HyperTetra') || 
      text.includes('HYPERTETRAHEDRON') || 
      text.includes('HyperTetrahedron')
    );
    
    console.log(`🎯 ${system}: HyperTetrahedron variant found: ${hasHyperTetLike}`);
    console.log(`🎯 ${system}: Button count: ${count} (expected: 9)`);
    
    if (count === 9 && hasHyperTetLike) {
      console.log(`✅ ${system}: SUCCESS - All 9 buttons including HyperTetrahedron!`);
    } else {
      console.log(`❌ ${system}: ISSUE - Expected 9 buttons with HyperTetrahedron`);
    }
    
    // Small pause between systems
    await page.waitForTimeout(500);
  }
  
  console.log('\n🎉 FINAL TEST COMPLETE');
});