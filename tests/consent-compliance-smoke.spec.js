// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Consent & Compliance Smoke @smoke', () => {
  test('@smoke toggles consent and exports compliance log', async ({ page }) => {
    await page.goto('/wearable-designer.html');

    const analyticsToggle = page.locator('#telemetryConsentPanel input[data-consent="analytics"]');
    await expect(analyticsToggle).toBeVisible();
    await expect(analyticsToggle).not.toBeChecked();

    const status = page.locator('#telemetryConsentPanel .consent-status');
    await expect(status).toContainText('Audit Entries');

    await analyticsToggle.check();

    await expect(status).toContainText('ANALYTICS', { timeout: 10000 });
    const statusText = await status.textContent();
    const auditMatch = statusText.match(/Audit Entries:\s*(\d+)/i);
    expect(auditMatch).toBeTruthy();
    expect(Number(auditMatch[1])).toBeGreaterThan(0);

    const logItem = page.locator('#telemetryConsentPanel .compliance-log li').first();
    await expect(logItem).toContainText('privacy.consent');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Compliance Log' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/vib34d-compliance-log/);
  });
});
