import { test, expect } from '@playwright/test';

test('Debug WebGL Program Issues', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.moduleReady === true, { timeout: 10000 });
  
  // Get detailed WebGL state
  const webglInfo = await page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const info = {
      totalCanvases: canvases.length,
      canvasInfo: []
    };
    
    canvases.forEach((canvas, i) => {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      info.canvasInfo.push({
        id: canvas.id,
        hasContext: !!gl,
        contextLost: gl ? gl.isContextLost() : 'no context',
        dimensions: `${canvas.width}x${canvas.height}`,
        visible: canvas.style.display !== 'none'
      });
    });
    
    return info;
  });
  
  console.log('WebGL Canvas Analysis:', JSON.stringify(webglInfo, null, 2));
  
  // Test system switch and check WebGL state after
  await page.click('[data-system="quantum"]');
  await page.waitForTimeout(2000);
  
  const afterSwitchInfo = await page.evaluate(() => {
    if (window.canvasPool) {
      return {
        activeSystem: window.canvasPool.activeSystem,
        stats: window.canvasPool.getStats(),
        quantumEngine: {
          exists: !!window.quantumEngine,
          visualizers: window.quantumEngine ? window.quantumEngine.visualizers?.length : 0
        }
      };
    }
    return null;
  });
  
  console.log('After Switch Analysis:', JSON.stringify(afterSwitchInfo, null, 2));
});