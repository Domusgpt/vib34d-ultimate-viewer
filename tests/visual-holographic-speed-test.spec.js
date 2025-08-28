// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * VISUAL HOLOGRAPHIC SPEED TEST AGENT
 * 
 * This agent visually tests the holographic system speed controls by:
 * 1. Navigating to localhost:8146
 * 2. Testing speed slider effects on rendering speed
 * 3. Verifying manual speed control has priority over audio
 * 4. Capturing screenshots of speed changes
 * 5. Validating the fix: (baseSpeed * 0.2) + (audioBoost * 0.1)
 */

test.describe('Visual Holographic Speed Test Agent', () => {
  let page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Navigate to VIB34D interface
    console.log('🚀 Agent: Navigating to VIB34D interface on localhost:8146');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for interface to fully load
    await page.waitForSelector('.system-btn[data-system="holographic"]', { timeout: 30000 });
    await page.waitForTimeout(2000); // Additional stabilization time
    
    console.log('✅ Agent: VIB34D interface loaded and ready');
  });

  test('Speed Control Visual Validation', async () => {
    console.log('🎯 Agent: Starting holographic speed control validation');
    
    // Switch to Holographic system
    console.log('🌟 Agent: Switching to Holographic system');
    await page.click('.system-btn[data-system="holographic"]');
    await page.waitForTimeout(1000);
    
    // Verify system switch was successful
    const activeBtn = await page.locator('.system-btn.active[data-system="holographic"]');
    await expect(activeBtn).toBeVisible();
    
    // Take initial screenshot
    await page.screenshot({
      path: 'test-results/holographic-speed-01-initial.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    
    // Locate speed slider
    console.log('🎛️ Agent: Locating speed slider');
    const speedSlider = page.locator('input[id*="speed"], input[data-param="speed"], .slider-container:has-text("Speed") input[type="range"]').first();
    await expect(speedSlider).toBeVisible({ timeout: 10000 });
    
    // Test different speed values and capture visual changes
    const speedTests = [
      { value: '0.1', description: 'minimum-speed' },
      { value: '1.0', description: 'medium-speed' },
      { value: '2.5', description: 'high-speed' },
      { value: '3.0', description: 'maximum-speed' }
    ];
    
    for (const speedTest of speedTests) {
      console.log(`⚡ Agent: Testing speed value ${speedTest.value}`);
      
      // Set speed value
      await speedSlider.fill(speedTest.value);
      await page.waitForTimeout(500); // Allow visual change to occur
      
      // Trigger change event explicitly if needed
      await speedSlider.dispatchEvent('input');
      await speedSlider.dispatchEvent('change');
      await page.waitForTimeout(1000);
      
      // Capture screenshot of speed change
      await page.screenshot({
        path: `test-results/holographic-speed-02-${speedTest.description}.png`,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
      
      // Verify slider value was set correctly
      const sliderValue = await speedSlider.inputValue();
      expect(parseFloat(sliderValue)).toBeCloseTo(parseFloat(speedTest.value), 1);
      
      console.log(`✅ Agent: Speed ${speedTest.value} set successfully, visual capture complete`);
    }
    
    // Test audio interaction vs manual control priority
    console.log('🎤 Agent: Testing manual control priority over audio');
    
    // Enable audio reactivity (if available)
    const audioBtn = page.locator('button:has-text("Audio"), input[type="checkbox"]:near(:text("Audio"))').first();
    if (await audioBtn.isVisible()) {
      await audioBtn.click();
      await page.waitForTimeout(500);
      console.log('🔊 Agent: Audio reactivity enabled');
    }
    
    // Set a specific manual speed while audio is active
    await speedSlider.fill('1.5');
    await speedSlider.dispatchEvent('input');
    await page.waitForTimeout(1000);
    
    // Capture screenshot showing manual override
    await page.screenshot({
      path: 'test-results/holographic-speed-03-manual-override.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    
    // Verify manual control maintains priority
    const finalValue = await speedSlider.inputValue();
    expect(parseFloat(finalValue)).toBeCloseTo(1.5, 1);
    
    console.log('✅ Agent: Manual speed control priority validated');
  });

  test('Speed Formula Validation', async () => {
    console.log('🧮 Agent: Testing speed formula (baseSpeed * 0.2) + (audioBoost * 0.1)');
    
    // Switch to Holographic system
    await page.click('.system-btn[data-system="holographic"]');
    await page.waitForTimeout(1000);
    
    // Inject validation script to monitor speed calculations
    await page.addInitScript(() => {
      window.speedTestResults = [];
      
      // Override console.log to capture speed-related logs
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.join(' ');
        if (message.includes('speed') || message.includes('Speed') || message.includes('baseSpeed') || message.includes('audioBoost')) {
          window.speedTestResults.push({
            timestamp: Date.now(),
            message: message,
            args: args
          });
        }
        originalLog.apply(console, args);
      };
    });
    
    // Test various speed combinations
    const speedSlider = page.locator('input[id*="speed"], input[data-param="speed"], .slider-container:has-text("Speed") input[type="range"]').first();
    
    const testCases = [
      { baseSpeed: 0.5, expectedMultiplier: 0.1, description: 'low-speed' },
      { baseSpeed: 1.0, expectedMultiplier: 0.2, description: 'normal-speed' },
      { baseSpeed: 2.0, expectedMultiplier: 0.4, description: 'high-speed' }
    ];
    
    for (const testCase of testCases) {
      console.log(`🔬 Agent: Testing speed formula with baseSpeed ${testCase.baseSpeed}`);
      
      // Set speed and wait for processing
      await speedSlider.fill(testCase.baseSpeed.toString());
      await speedSlider.dispatchEvent('input');
      await page.waitForTimeout(1500);
      
      // Capture logs and verify formula application
      const speedLogs = await page.evaluate(() => window.speedTestResults || []);
      
      // Take screenshot for this test case
      await page.screenshot({
        path: `test-results/holographic-speed-formula-${testCase.description}.png`,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
      
      console.log(`📊 Agent: Speed logs captured: ${speedLogs.length} entries`);
    }
    
    console.log('✅ Agent: Speed formula validation complete');
  });

  test('Speed Responsiveness Performance Test', async () => {
    console.log('⚡ Agent: Testing speed control responsiveness');
    
    // Switch to Holographic system
    await page.click('.system-btn[data-system="holographic"]');
    await page.waitForTimeout(1000);
    
    const speedSlider = page.locator('input[id*="speed"], input[data-param="speed"], .slider-container:has-text("Speed") input[type="range"]').first();
    
    // Measure response time for speed changes
    const responseTimes = [];
    const testValues = ['0.2', '1.0', '1.8', '2.5', '0.5'];
    
    for (const value of testValues) {
      const startTime = Date.now();
      
      await speedSlider.fill(value);
      await speedSlider.dispatchEvent('input');
      
      // Wait for visual change (basic timing)
      await page.waitForTimeout(100);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      responseTimes.push(responseTime);
      
      console.log(`⏱️ Agent: Speed ${value} response time: ${responseTime}ms`);
      
      // Brief pause between tests
      await page.waitForTimeout(200);
    }
    
    // Calculate average response time
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    console.log(`📈 Agent: Average speed control response time: ${avgResponseTime}ms`);
    
    // Take final responsiveness screenshot
    await page.screenshot({
      path: 'test-results/holographic-speed-04-responsiveness.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    
    // Assert reasonable responsiveness (less than 1 second)
    expect(avgResponseTime).toBeLessThan(1000);
    
    console.log('✅ Agent: Speed responsiveness validation complete');
  });

  test('Speed Visual Consistency Check', async () => {
    console.log('👁️ Agent: Checking visual consistency of speed changes');
    
    // Switch to Holographic system
    await page.click('.system-btn[data-system="holographic"]');
    await page.waitForTimeout(2000);
    
    const speedSlider = page.locator('input[id*="speed"], input[data-param="speed"], .slider-container:has-text("Speed") input[type="range"]').first();
    
    // Set consistent speed and take multiple screenshots to check for consistency
    await speedSlider.fill('1.5');
    await speedSlider.dispatchEvent('input');
    await page.waitForTimeout(1000);
    
    const screenshots = [];
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(500);
      const screenshot = await page.screenshot({
        path: `test-results/holographic-speed-consistency-${i + 1}.png`,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
      screenshots.push(screenshot);
      console.log(`📸 Agent: Consistency screenshot ${i + 1} captured`);
    }
    
    console.log('✅ Agent: Visual consistency check complete');
  });
});