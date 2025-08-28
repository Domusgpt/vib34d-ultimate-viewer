import { test, expect, devices } from '@playwright/test';

test.use(devices['iPhone 13']);

test('Mobile WebGL System Test', async ({ page }) => {
  console.log('📱 Testing on mobile viewport...');
  
  await page.goto('/');
  await page.waitForFunction(() => window.moduleReady === true, { timeout: 10000 });
  
  // Capture mobile-specific console messages
  page.on('console', msg => {
    if (msg.text().includes('Mobile') || msg.text().includes('📱')) {
      console.log(`[MOBILE] ${msg.text()}`);
    }
  });
  
  // Test initial faceted system
  console.log('\n1. Testing faceted system on mobile...');
  await page.waitForTimeout(3000);
  
  const facetedCanvasInfo = await page.evaluate(() => {
    const canvas = document.getElementById('background-canvas');
    if (!canvas) return { error: 'Canvas not found' };
    
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    return {
      canvas: {
        id: canvas.id,
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        style: {
          width: canvas.style.width,
          height: canvas.style.height
        }
      },
      gl: gl ? {
        contextLost: gl.isContextLost(),
        viewport: gl.getParameter(gl.VIEWPORT)
      } : null,
      engine: window.engine ? {
        hasVisualizers: !!window.engine.visualizers,
        visualizerCount: window.engine.visualizers?.length
      } : null
    };
  });
  
  console.log('Faceted Canvas Info:', JSON.stringify(facetedCanvasInfo, null, 2));
  
  // Test parameter changes
  console.log('\n2. Testing parameter changes on mobile...');
  await page.evaluate(() => {
    const slider = document.getElementById('gridDensity');
    if (slider) {
      slider.value = 50;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  
  await page.waitForTimeout(1000);
  
  // Check if visualizers are rendering
  const renderCheck = await page.evaluate(() => {
    if (window.engine && window.engine.visualizers) {
      const viz = window.engine.visualizers[0];
      if (viz) {
        return {
          hasProgram: !!viz.program,
          hasGL: !!viz.gl,
          params: viz.params
        };
      }
    }
    return null;
  });
  
  console.log('Render Check:', JSON.stringify(renderCheck, null, 2));
  
  // Test switching to quantum
  console.log('\n3. Testing quantum system on mobile...');
  await page.click('[data-system="quantum"]');
  await page.waitForTimeout(3000);
  
  const quantumCanvasInfo = await page.evaluate(() => {
    const canvas = document.getElementById('quantum-background-canvas');
    if (!canvas) return { error: 'Canvas not found' };
    
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    return {
      canvas: {
        id: canvas.id,
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight
      },
      gl: gl ? {
        contextLost: gl.isContextLost()
      } : null,
      engine: window.quantumEngine ? {
        hasVisualizers: !!window.quantumEngine.visualizers,
        visualizerCount: window.quantumEngine.visualizers?.length,
        isActive: window.quantumEngine.isActive
      } : null
    };
  });
  
  console.log('Quantum Canvas Info:', JSON.stringify(quantumCanvasInfo, null, 2));
  
  // Test holographic system
  console.log('\n4. Testing holographic system on mobile...');
  await page.click('[data-system="holographic"]');
  await page.waitForTimeout(3000);
  
  const holographicCanvasInfo = await page.evaluate(() => {
    const canvas = document.getElementById('holo-background-canvas');
    if (!canvas) return { error: 'Canvas not found' };
    
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    return {
      canvas: {
        id: canvas.id,
        width: canvas.width,
        height: canvas.height
      },
      gl: gl ? {
        contextLost: gl.isContextLost()
      } : null,
      engine: window.holographicSystem ? {
        hasVisualizers: !!window.holographicSystem.visualizers,
        visualizerCount: window.holographicSystem.visualizers?.length,
        isActive: window.holographicSystem.isActive
      } : null
    };
  });
  
  console.log('Holographic Canvas Info:', JSON.stringify(holographicCanvasInfo, null, 2));
  
  // Final check on SmartCanvasPool
  const poolStats = await page.evaluate(() => {
    if (window.canvasPool) {
      return window.canvasPool.getStats();
    }
    return null;
  });
  
  console.log('\nSmartCanvasPool Stats:', JSON.stringify(poolStats, null, 2));
  
  // Validate mobile rendering is working
  expect(facetedCanvasInfo.canvas.width).toBeGreaterThan(0);
  expect(facetedCanvasInfo.canvas.height).toBeGreaterThan(0);
  expect(quantumCanvasInfo.engine?.isActive).toBe(false); // Should be inactive after switch
  expect(holographicCanvasInfo.engine?.isActive).toBe(true); // Should be active
});