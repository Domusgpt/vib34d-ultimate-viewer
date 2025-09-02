import { test, expect } from '@playwright/test';

test('Polychora system initializes with 4D canvas setup', async ({ page }) => {
  await page.goto('/index-fixed.html');

  const result = await page.evaluate(async () => {
    const module = await import('/systems/polychora/PolychoraSystem.js');
    const system = new module.PolychoraSystem();
    const initSuccess = await system.initialize();
    const info = system.getInfo();
    return { initSuccess, info };
  });

  expect(result.initSuccess).toBe(true);
  expect(result.info.isInitialized).toBe(true);
  expect(result.info.fourDimensional).toBe(true);
  expect(result.info.polytopes).toBeGreaterThan(0);
});
