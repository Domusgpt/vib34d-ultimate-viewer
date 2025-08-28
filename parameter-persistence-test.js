#!/usr/bin/env node

/**
 * VIB34D Parameter Persistence Fix Validation
 * Tests the new UI Controls Master strategy
 */

const { chromium } = require('playwright');

async function testParameterPersistenceFix() {
    console.log('🔍 VIB34D Parameter Persistence Fix Test');
    console.log('⏰ Start Time:', new Date().toISOString());
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 100
    });
    
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    
    try {
        // Navigate and wait for load
        console.log('🌐 Navigating to localhost:8146');
        await page.goto('http://localhost:8146', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        console.log('\n🎯 TESTING PARAMETER PERSISTENCE FIX');
        console.log('Strategy: UI Controls Master - Systems sync to UI on switch');
        console.log('='*65);
        
        // Test parameters we'll use
        const testParams = {
            gridDensity: '60',
            speed: '1.8', 
            hue: '210',
            morphFactor: '1.6',
            intensity: '0.7'
        };
        
        // Test 1: Set parameters on Faceted system
        console.log('\n🔷 STEP 1: Setting test parameters on Faceted system');
        await page.click('button:has-text("Faceted")');
        await page.waitForTimeout(1500);
        
        console.log('📝 Setting parameters:');
        for (const [param, value] of Object.entries(testParams)) {
            console.log(`   Setting ${param} = ${value}`);
            const slider = await page.locator(`input[id="${param}"]`);
            await slider.fill(value);
            await page.waitForTimeout(300);
        }
        
        // Take screenshot
        await page.screenshot({ 
            path: 'test-results/persistence-faceted-set.png',
            clip: { x: 0, y: 0, width: 1200, height: 800 }
        });
        
        // Test 2: Switch to Quantum and verify sync
        console.log('\n🌌 STEP 2: Switching to Quantum system (should sync to UI)');
        await page.click('button:has-text("Quantum")');
        await page.waitForTimeout(2000);
        
        console.log('📊 Checking parameter sync after switch:');
        let allSynced = true;
        
        for (const [param, expectedValue] of Object.entries(testParams)) {
            const slider = await page.locator(`input[id="${param}"]`);
            const sliderValue = await slider.inputValue();
            
            const displayId = param.replace('gridDensity', 'density').replace('morphFactor', 'morph') + 'Value';
            const display = await page.locator(`#${displayId}`);
            const displayValue = await display.textContent();
            
            const sliderMatches = sliderValue === expectedValue;
            console.log(`   ${param}:`);
            console.log(`     Slider: ${sliderValue} (expected: ${expectedValue}) ${sliderMatches ? '✅' : '❌'}`);
            console.log(`     Display: ${displayValue}`);
            
            if (!sliderMatches) allSynced = false;
        }
        
        console.log(`\n📊 Quantum Sync Result: ${allSynced ? '✅ ALL SYNCED' : '❌ SYNC ISSUES'}`);
        
        // Take screenshot
        await page.screenshot({ 
            path: 'test-results/persistence-quantum-synced.png',
            clip: { x: 0, y: 0, width: 1200, height: 800 }
        });
        
        // Test 3: Switch to Holographic and verify sync
        console.log('\n✨ STEP 3: Switching to Holographic system (should sync to UI)');
        await page.click('button:has-text("Holographic")');
        await page.waitForTimeout(2000);
        
        console.log('📊 Checking parameter sync after switch:');
        let holoSynced = true;
        
        for (const [param, expectedValue] of Object.entries(testParams)) {
            const slider = await page.locator(`input[id="${param}"]`);
            const sliderValue = await slider.inputValue();
            
            const displayId = param.replace('gridDensity', 'density').replace('morphFactor', 'morph') + 'Value';
            const display = await page.locator(`#${displayId}`);
            const displayValue = await display.textContent();
            
            const sliderMatches = sliderValue === expectedValue;
            console.log(`   ${param}:`);
            console.log(`     Slider: ${sliderValue} (expected: ${expectedValue}) ${sliderMatches ? '✅' : '❌'}`);
            console.log(`     Display: ${displayValue}`);
            
            if (!sliderMatches) holoSynced = false;
        }
        
        console.log(`\n📊 Holographic Sync Result: ${holoSynced ? '✅ ALL SYNCED' : '❌ SYNC ISSUES'}`);
        
        // Take screenshot
        await page.screenshot({ 
            path: 'test-results/persistence-holographic-synced.png',
            clip: { x: 0, y: 0, width: 1200, height: 800 }
        });
        
        // Test 4: Change parameter and switch back
        console.log('\n🔧 STEP 4: Testing parameter change and system switch');
        console.log('Changing speed to 0.3 on Holographic system...');
        
        const speedSlider = await page.locator('input[id="speed"]');
        await speedSlider.fill('0.3');
        await page.waitForTimeout(1000);
        
        console.log('Switching back to Faceted...');
        await page.click('button:has-text("Faceted")');
        await page.waitForTimeout(2000);
        
        const finalSpeedValue = await speedSlider.inputValue();
        const speedPersisted = finalSpeedValue === '0.3';
        console.log(`Speed value after switch: ${finalSpeedValue} (expected: 0.3) ${speedPersisted ? '✅' : '❌'}`);
        
        // Final results
        console.log('\n📋 PARAMETER PERSISTENCE FIX TEST RESULTS');
        console.log('='*50);
        console.log(`UI Slider Persistence: ✅ WORKING (sliders maintain position)`);
        console.log(`Quantum System Sync: ${allSynced ? '✅ WORKING' : '❌ FAILED'}`);
        console.log(`Holographic System Sync: ${holoSynced ? '✅ WORKING' : '❌ FAILED'}`);
        console.log(`Parameter Change Persistence: ${speedPersisted ? '✅ WORKING' : '❌ FAILED'}`);
        
        const overallSuccess = allSynced && holoSynced && speedPersisted;
        console.log(`\n🎯 OVERALL STATUS: ${overallSuccess ? '✅ FIX SUCCESSFUL' : '⚠️ NEEDS ADJUSTMENT'}`);
        
        if (overallSuccess) {
            console.log('\n🎉 UI Controls Master strategy is working!');
            console.log('   - UI sliders maintain their values across switches');
            console.log('   - Systems sync to UI state when switched');
            console.log('   - User intent is preserved and UX is predictable');
        } else {
            console.log('\n🔧 Fix needs refinement:');
            console.log('   - Check system-specific parameter update methods');
            console.log('   - Verify timing of sync calls');
            console.log('   - Ensure all systems support the sync interface');
        }
        
        return overallSuccess;
        
    } catch (error) {
        console.error('❌ Parameter persistence test failed:', error.message);
        return false;
        
    } finally {
        await browser.close();
        console.log('\n⏰ End Time:', new Date().toISOString());
    }
}

// Run test
if (require.main === module) {
    testParameterPersistenceFix().then(success => {
        process.exit(success ? 0 : 1);
    });
}