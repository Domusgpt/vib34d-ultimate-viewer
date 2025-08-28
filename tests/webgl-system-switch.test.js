import { test, expect } from '@playwright/test';

test('WebGL System Switch and Visualizer Reinitialization Test', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.moduleReady === true, { timeout: 10000 });
  
  let consoleMessages = [];
  
  // Capture console messages for system switching
  page.on('console', msg => {
    consoleMessages.push(msg.text());
    console.log(`[BROWSER] ${msg.text()}`);
  });
  
  console.log('\n🔄 Testing system switches with WebGL context recreation...\n');
  
  // Test switching from faceted to quantum
  console.log('1. Switching from faceted to quantum...');
  consoleMessages = [];
  await page.click('[data-system="quantum"]');
  await page.waitForTimeout(3000);
  
  // Check for key console messages
  const quantumSwitch = consoleMessages.filter(msg => 
    msg.includes('Switching to quantum') ||
    msg.includes('quantum system ready') ||
    msg.includes('Reinitializing') ||
    msg.includes('WebGL context reinitialized')
  );
  
  console.log(`✅ Quantum switch messages: ${quantumSwitch.length}`);
  expect(quantumSwitch.length).toBeGreaterThan(0);
  
  // Test quantum WebGL context
  const quantumWebGL = await page.evaluate(() => {
    const canvas = document.getElementById('quantum-background-canvas');
    if (!canvas) return { error: 'Quantum canvas not found' };
    
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { error: 'Quantum WebGL context not available' };
    
    return {
      success: true,
      contextLost: gl.isContextLost(),
      version: gl.getParameter(gl.VERSION),
      canvas: {
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight
      }
    };
  });
  
  console.log('Quantum WebGL Context:', JSON.stringify(quantumWebGL, null, 2));
  expect(quantumWebGL.success).toBe(true);
  expect(quantumWebGL.contextLost).toBe(false);
  
  // Test switching back to faceted
  console.log('\n2. Switching back to faceted...');
  consoleMessages = [];
  await page.click('[data-system="faceted"]');
  await page.waitForTimeout(3000);
  
  const facetedSwitch = consoleMessages.filter(msg => 
    msg.includes('Switching to faceted') ||
    msg.includes('faceted system ready') ||
    msg.includes('Reinitializing') ||
    msg.includes('WebGL context reinitialized')
  );
  
  console.log(`✅ Faceted switch messages: ${facetedSwitch.length}`);
  expect(facetedSwitch.length).toBeGreaterThan(0);
  
  // Test faceted WebGL context
  const facetedWebGL = await page.evaluate(() => {
    const canvas = document.getElementById('background-canvas');
    if (!canvas) return { error: 'Faceted canvas not found' };
    
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { error: 'Faceted WebGL context not available' };
    
    return {
      success: true,
      contextLost: gl.isContextLost(),
      version: gl.getParameter(gl.VERSION),
      canvas: {
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight
      }
    };
  });
  
  console.log('Faceted WebGL Context:', JSON.stringify(facetedWebGL, null, 2));
  expect(facetedWebGL.success).toBe(true);
  expect(facetedWebGL.contextLost).toBe(false);
  
  // Test holographic system
  console.log('\n3. Testing holographic system...');
  consoleMessages = [];
  await page.click('[data-system="holographic"]');
  await page.waitForTimeout(3000);
  
  const holographicSwitch = consoleMessages.filter(msg => 
    msg.includes('Switching to holographic') ||
    msg.includes('holographic system ready')
  );
  
  console.log(`✅ Holographic switch messages: ${holographicSwitch.length}`);
  expect(holographicSwitch.length).toBeGreaterThan(0);
  
  // Test holographic WebGL context
  const holographicWebGL = await page.evaluate(() => {
    const canvas = document.getElementById('holo-background-canvas');
    if (!canvas) return { error: 'Holographic canvas not found' };
    
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { error: 'Holographic WebGL context not available' };
    
    return {
      success: true,
      contextLost: gl.isContextLost(),
      version: gl.getParameter(gl.VERSION),
      canvas: {
        width: canvas.width,
        height: canvas.height
      }
    };
  });
  
  console.log('Holographic WebGL Context:', JSON.stringify(holographicWebGL, null, 2));
  expect(holographicWebGL.success).toBe(true);
  expect(holographicWebGL.contextLost).toBe(false);
  
  // Check SmartCanvasPool stats
  const poolStats = await page.evaluate(() => {
    if (window.canvasPool) {
      return window.canvasPool.getStats();
    }
    return null;
  });
  
  console.log('\nSmartCanvasPool Stats:', JSON.stringify(poolStats, null, 2));
  expect(poolStats.activeContexts).toBeLessThanOrEqual(5);
  expect(poolStats.activeSystem).toBe('holographic');
  
  console.log('\n✅ All WebGL system switches working correctly!');
});