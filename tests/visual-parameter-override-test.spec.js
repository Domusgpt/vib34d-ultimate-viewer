// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * VISUAL PARAMETER OVERRIDE AGENT
 * 
 * This agent visually tests parameter override scenarios by:
 * 1. Testing manual parameter controls vs automatic systems
 * 2. Identifying where automatic systems override manual controls
 * 3. Testing parameter slider responsiveness in real-time
 * 4. Validating parameter changes are reflected visually
 */

test.describe('Visual Parameter Override Test Agent', () => {
  let page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    console.log('🚀 Agent: Navigating to VIB34D interface for parameter override testing');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.system-btn', { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    console.log('✅ Agent: Interface loaded, ready for parameter override testing');
  });

  test('Manual vs Automatic Parameter Control Priority', async () => {
    console.log('⚖️ Agent: Testing manual parameter control priority over automatic systems');
    
    const systems = ['faceted', 'quantum', 'holographic'];
    const testParameters = [
      { name: 'speed', values: ['0.5', '1.5', '2.5'], type: 'slider' },
      { name: 'intensity', values: ['0.2', '0.7', '0.9'], type: 'slider' },
      { name: 'hue', values: ['60', '180', '300'], type: 'slider' },
      { name: 'gridDensity', values: ['25', '50', '80'], type: 'slider' }
    ];
    
    for (const system of systems) {
      console.log(`🎯 Agent: Testing parameter priority in ${system} system`);
      
      // Switch to system
      await page.click(`.system-btn[data-system="${system}"]`);
      await page.waitForTimeout(1500);
      
      // Enable any automatic systems that might interfere
      const audioToggle = page.locator('input[type="checkbox"]:near(:text("Audio"))').first();
      if (await audioToggle.isVisible()) {
        await audioToggle.click();
        await page.waitForTimeout(500);
        console.log(`  🎵 Audio reactivity enabled for ${system}`);
      }
      
      const mouseToggle = page.locator('input[type="checkbox"]:near(:text("Mouse"))').first();
      if (await mouseToggle.isVisible()) {
        await mouseToggle.click();
        await page.waitForTimeout(500);
        console.log(`  🖱️ Mouse reactivity enabled for ${system}`);
      }
      
      for (const param of testParameters) {
        console.log(`    🎛️ Testing ${param.name} parameter priority`);
        
        const slider = page.locator(`input[id*="${param.name}"], input[data-param="${param.name}"], .slider-container:has-text("${param.name.charAt(0).toUpperCase() + param.name.slice(1)}") input[type="range"]`).first();
        
        if (await slider.isVisible()) {
          for (const value of param.values) {
            console.log(`      📊 Setting ${param.name} to ${value}`);
            
            // Set manual value
            await slider.fill(value);
            await slider.dispatchEvent('input');
            await slider.dispatchEvent('change');
            await page.waitForTimeout(300);
            
            // Create automatic system activity (mouse movement, audio simulation)
            await page.mouse.move(Math.random() * 1000 + 200, Math.random() * 600 + 200);
            await page.waitForTimeout(200);
            
            // Check if manual value is maintained
            const currentValue = await slider.inputValue();
            const valueMatch = Math.abs(parseFloat(currentValue) - parseFloat(value)) < 0.1;
            
            console.log(`        🔍 Expected: ${value}, Got: ${currentValue}, Match: ${valueMatch ? '✅' : '❌'}`);
            
            // Capture screenshot of parameter state
            await page.screenshot({
              path: `test-results/parameter-override-${system}-${param.name}-${value}.png`,
              fullPage: false,
              clip: { x: 0, y: 0, width: 1920, height: 1080 }
            });
            
            if (!valueMatch) {
              console.warn(`      ⚠️ Manual control override detected for ${param.name}`);
            }
          }
        }
      }
      
      console.log(`✅ Agent: ${system} parameter priority testing complete`);
    }
  });

  test('Real-Time Parameter Slider Responsiveness', async () => {
    console.log('⚡ Agent: Testing real-time parameter slider responsiveness');
    
    const systems = ['quantum', 'holographic']; // Most complex systems
    
    for (const system of systems) {
      console.log(`🎯 Agent: Testing slider responsiveness in ${system} system`);
      
      await page.click(`.system-btn[data-system="${system}"]`);
      await page.waitForTimeout(1500);
      
      // Test major visual parameters
      const visualParameters = [
        { name: 'speed', min: 0.1, max: 3.0, step: 0.5 },
        { name: 'intensity', min: 0.0, max: 1.0, step: 0.2 },
        { name: 'hue', min: 0, max: 360, step: 60 },
        { name: 'gridDensity', min: 10, max: 100, step: 20 }
      ];
      
      for (const param of visualParameters) {
        console.log(`    📊 Testing ${param.name} slider responsiveness`);
        
        const slider = page.locator(`input[id*="${param.name}"], input[data-param="${param.name}"], .slider-container:has-text("${param.name.charAt(0).toUpperCase() + param.name.slice(1)}") input[type="range"]`).first();
        
        if (await slider.isVisible()) {
          const responseTimes = [];
          
          // Test slider at different values
          for (let value = param.min; value <= param.max; value += param.step) {
            const startTime = Date.now();
            
            // Set slider value
            await slider.fill(value.toString());
            await slider.dispatchEvent('input');
            
            // Wait for minimal response time
            await page.waitForTimeout(50);
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            responseTimes.push(responseTime);
            
            console.log(`      ⏱️ ${param.name}=${value}: ${responseTime}ms`);
            
            // Capture key positions
            if (value === param.min || value === param.max || value === (param.min + param.max) / 2) {
              await page.screenshot({
                path: `test-results/slider-responsiveness-${system}-${param.name}-${value}.png`,
                fullPage: false,
                clip: { x: 0, y: 0, width: 1920, height: 1080 }
              });
            }
            
            await page.waitForTimeout(200); // Brief pause between tests
          }
          
          const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
          console.log(`    📈 ${param.name} average response time: ${avgResponseTime.toFixed(1)}ms`);
          
          // Assert reasonable responsiveness
          expect(avgResponseTime).toBeLessThan(300);
        }
      }
      
      console.log(`✅ Agent: ${system} slider responsiveness testing complete`);
    }
  });

  test('Parameter Visual Reflection Validation', async () => {
    console.log('👁️ Agent: Validating parameter changes are reflected visually');
    
    const systems = ['faceted', 'quantum', 'holographic'];
    
    for (const system of systems) {
      console.log(`🎨 Agent: Testing visual parameter reflection in ${system} system`);
      
      await page.click(`.system-btn[data-system="${system}"]`);
      await page.waitForTimeout(1500);
      
      // Test highly visual parameters
      const visualTests = [
        {
          param: 'hue',
          values: ['0', '120', '240'], // Red, Green, Blue
          description: 'color-change'
        },
        {
          param: 'intensity',
          values: ['0.1', '0.5', '1.0'], // Dim, Medium, Bright
          description: 'brightness-change'
        },
        {
          param: 'gridDensity',
          values: ['20', '50', '90'], // Sparse, Medium, Dense
          description: 'density-change'
        },
        {
          param: 'speed',
          values: ['0.2', '1.0', '2.5'], // Slow, Normal, Fast
          description: 'animation-speed-change'
        }
      ];
      
      for (const test of visualTests) {
        console.log(`    🎭 Testing ${test.param} visual reflection`);
        
        const slider = page.locator(`input[id*="${test.param}"], input[data-param="${test.param}"], .slider-container:has-text("${test.param.charAt(0).toUpperCase() + test.param.slice(1)}") input[type="range"]`).first();
        
        if (await slider.isVisible()) {
          // Capture baseline
          await page.screenshot({
            path: `test-results/visual-reflection-${system}-${test.param}-baseline.png`,
            fullPage: false,
            clip: { x: 0, y: 0, width: 1920, height: 1080 }
          });
          
          for (let i = 0; i < test.values.length; i++) {
            const value = test.values[i];
            console.log(`      📊 Setting ${test.param} to ${value}`);
            
            // Set parameter value
            await slider.fill(value);
            await slider.dispatchEvent('input');
            await page.waitForTimeout(800); // Allow visual change to occur
            
            // Capture visual result
            await page.screenshot({
              path: `test-results/visual-reflection-${system}-${test.param}-${i + 1}-${value}.png`,
              fullPage: false,
              clip: { x: 0, y: 0, width: 1920, height: 1080 }
            });
            
            // For animation parameters, capture multiple frames
            if (test.param === 'speed') {
              for (let frame = 1; frame <= 3; frame++) {
                await page.waitForTimeout(500);
                await page.screenshot({
                  path: `test-results/visual-reflection-${system}-${test.param}-${i + 1}-${value}-frame${frame}.png`,
                  fullPage: false,
                  clip: { x: 0, y: 0, width: 1920, height: 1080 }
                });
              }
            }
            
            // Verify slider value was set correctly
            const currentValue = await slider.inputValue();
            expect(Math.abs(parseFloat(currentValue) - parseFloat(value))).toBeLessThan(0.1);
          }
        }
        
        console.log(`    ✅ ${test.param} visual reflection test complete`);
      }
      
      console.log(`✅ Agent: ${system} visual reflection testing complete`);
    }
  });

  test('Automatic System Override Detection', async () => {
    console.log('🔍 Agent: Detecting where automatic systems override manual controls');
    
    const systems = ['quantum', 'holographic']; // Systems with most automatic features
    
    for (const system of systems) {
      console.log(`🎯 Agent: Testing automatic overrides in ${system} system`);
      
      await page.click(`.system-btn[data-system="${system}"]`);
      await page.waitForTimeout(1500);
      
      // Parameters that might be affected by automatic systems
      const testParams = [
        { name: 'speed', baseline: '1.0' },
        { name: 'intensity', baseline: '0.5' },
        { name: 'hue', baseline: '180' },
        { name: 'morphFactor', baseline: '0.5' }
      ];
      
      // Set baseline values
      console.log(`  📊 Setting baseline parameter values`);
      for (const param of testParams) {
        const slider = page.locator(`input[id*="${param.name}"], input[data-param="${param.name}"], .slider-container:has-text("${param.name.charAt(0).toUpperCase() + param.name.slice(1)}") input[type="range"]`).first();
        
        if (await slider.isVisible()) {
          await slider.fill(param.baseline);
          await slider.dispatchEvent('input');
          await page.waitForTimeout(200);
        }
      }
      
      // Capture baseline state
      await page.screenshot({
        path: `test-results/override-detection-${system}-baseline.png`,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
      
      // Enable automatic systems one by one
      const automaticSystems = [
        { name: 'audio', selector: 'input[type="checkbox"]:near(:text("Audio"))' },
        { name: 'mouse', selector: 'input[type="checkbox"]:near(:text("Mouse"))' },
        { name: 'scroll', selector: 'input[type="checkbox"]:near(:text("Scroll"))' }
      ];
      
      for (const autoSystem of automaticSystems) {
        console.log(`  🤖 Testing ${autoSystem.name} system overrides`);
        
        const toggle = page.locator(autoSystem.selector).first();
        if (await toggle.isVisible()) {
          // Enable automatic system
          await toggle.click();
          await page.waitForTimeout(500);
          
          // Create activity for the automatic system
          if (autoSystem.name === 'mouse') {
            await page.mouse.move(400, 300);
            await page.waitForTimeout(300);
            await page.mouse.move(800, 600);
            await page.waitForTimeout(300);
          } else if (autoSystem.name === 'scroll') {
            await page.mouse.wheel(0, 100);
            await page.waitForTimeout(300);
            await page.mouse.wheel(0, -100);
            await page.waitForTimeout(300);
          }
          // Audio would require microphone simulation which is complex
          
          await page.waitForTimeout(1000);
          
          // Check if parameters changed from baseline
          const overrides = [];
          for (const param of testParams) {
            const slider = page.locator(`input[id*="${param.name}"], input[data-param="${param.name}"], .slider-container:has-text("${param.name.charAt(0).toUpperCase() + param.name.slice(1)}") input[type="range"]`).first();
            
            if (await slider.isVisible()) {
              const currentValue = await slider.inputValue();
              const baselineValue = parseFloat(param.baseline);
              const currentFloat = parseFloat(currentValue);
              
              if (Math.abs(currentFloat - baselineValue) > 0.1) {
                overrides.push({
                  param: param.name,
                  baseline: baselineValue,
                  current: currentFloat,
                  system: autoSystem.name
                });
                console.log(`    ⚠️ ${autoSystem.name} overrode ${param.name}: ${baselineValue} → ${currentFloat}`);
              }
            }
          }
          
          // Capture state with automatic system active
          await page.screenshot({
            path: `test-results/override-detection-${system}-${autoSystem.name}-active.png`,
            fullPage: false,
            clip: { x: 0, y: 0, width: 1920, height: 1080 }
          });
          
          // Reset baseline values to test manual control priority
          console.log(`    🔄 Testing manual control restoration`);
          for (const param of testParams) {
            const slider = page.locator(`input[id*="${param.name}"], input[data-param="${param.name}"], .slider-container:has-text("${param.name.charAt(0).toUpperCase() + param.name.slice(1)}") input[type="range"]`).first();
            
            if (await slider.isVisible()) {
              await slider.fill(param.baseline);
              await slider.dispatchEvent('input');
              await slider.dispatchEvent('change');
              await page.waitForTimeout(200);
              
              const restoredValue = await slider.inputValue();
              const restored = Math.abs(parseFloat(restoredValue) - parseFloat(param.baseline)) < 0.1;
              console.log(`    🎛️ ${param.name} manual restore: ${restored ? '✅' : '❌'}`);
            }
          }
          
          // Disable automatic system for next test
          await toggle.click();
          await page.waitForTimeout(300);
        }
      }
      
      console.log(`✅ Agent: ${system} automatic override detection complete`);
    }
  });

  test('Parameter Conflict Resolution Test', async () => {
    console.log('⚔️ Agent: Testing parameter conflict resolution');
    
    // Test on the most complex system
    await page.click('.system-btn[data-system="holographic"]');
    await page.waitForTimeout(1500);
    
    // Enable multiple automatic systems simultaneously
    const systems = ['audio', 'mouse'];
    
    console.log('  🤖 Enabling multiple automatic systems');
    for (const systemName of systems) {
      const toggle = page.locator(`input[type="checkbox"]:near(:text("${systemName.charAt(0).toUpperCase() + systemName.slice(1)}"))`).first();
      if (await toggle.isVisible()) {
        await toggle.click();
        await page.waitForTimeout(200);
        console.log(`    ✅ ${systemName} enabled`);
      }
    }
    
    // Set manual parameters while automatic systems are active
    const conflictTests = [
      { param: 'speed', manual: '2.0', description: 'high-speed-manual' },
      { param: 'intensity', manual: '0.3', description: 'low-intensity-manual' },
      { param: 'hue', manual: '45', description: 'orange-hue-manual' }
    ];
    
    for (const test of conflictTests) {
      console.log(`  ⚖️ Testing ${test.param} conflict resolution`);
      
      const slider = page.locator(`input[id*="${test.param}"], input[data-param="${test.param}"], .slider-container:has-text("${test.param.charAt(0).toUpperCase() + test.param.slice(1)}") input[type="range"]`).first();
      
      if (await slider.isVisible()) {
        // Set manual value
        await slider.fill(test.manual);
        await slider.dispatchEvent('input');
        await page.waitForTimeout(300);
        
        // Create automatic system activity
        await page.mouse.move(Math.random() * 800 + 200, Math.random() * 600 + 200);
        await page.waitForTimeout(500);
        
        // Check final value after conflict
        const finalValue = await slider.inputValue();
        const manualPreserved = Math.abs(parseFloat(finalValue) - parseFloat(test.manual)) < 0.2;
        
        console.log(`    🎛️ ${test.param}: Manual=${test.manual}, Final=${finalValue}, Preserved=${manualPreserved ? '✅' : '❌'}`);
        
        // Capture conflict resolution state
        await page.screenshot({
          path: `test-results/parameter-conflict-${test.param}-${test.description}.png`,
          fullPage: false,
          clip: { x: 0, y: 0, width: 1920, height: 1080 }
        });
      }
    }
    
    console.log('✅ Agent: Parameter conflict resolution testing complete');
  });
});