#!/usr/bin/env node

/**
 * VIB34D Parameter Persistence Analysis Tool
 * Identifies current parameter sync behavior and issues
 */

const { chromium } = require('playwright');

async function analyzeParameterPersistence() {
    console.log('🔍 VIB34D Parameter Persistence Analysis');
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
        
        console.log('\n📊 ANALYZING PARAMETER PERSISTENCE BEHAVIOR');
        console.log('='*60);
        
        // Test 1: Set parameters on Faceted system
        console.log('\n🔷 TEST 1: Setting parameters on Faceted system');
        await page.click('button:has-text("Faceted")');
        await page.waitForTimeout(1500);
        
        const testParams = {
            gridDensity: '45',
            speed: '2.1',
            hue: '180',
            morphFactor: '1.3'
        };
        
        console.log('📝 Setting test parameters:');
        for (const [param, value] of Object.entries(testParams)) {
            console.log(`   ${param}: ${value}`);
            const slider = await page.locator(`input[id="${param}"]`);
            await slider.fill(value);
            await page.waitForTimeout(200);
            
            // Check if display updated
            const displayValue = await page.locator(`#${param.replace('gridDensity', 'density').replace('morphFactor', 'morph')}Value`).textContent();
            console.log(`   Display shows: ${displayValue}`);
        }
        
        // Test 2: Switch to Quantum and check parameters
        console.log('\n🌌 TEST 2: Switching to Quantum system');
        await page.click('button:has-text("Quantum")');
        await page.waitForTimeout(2000);
        
        console.log('📊 Checking parameter states after switch:');
        for (const [param] of Object.entries(testParams)) {
            const slider = await page.locator(`input[id="${param}"]`);
            const sliderValue = await slider.inputValue();
            const displayId = param.replace('gridDensity', 'density').replace('morphFactor', 'morph') + 'Value';
            const displayValue = await page.locator(`#${displayId}`).textContent();
            
            console.log(`   ${param}: slider=${sliderValue}, display=${displayValue}`);
            
            // Check if they match our test values
            const matches = sliderValue === testParams[param];
            console.log(`   ${matches ? '✅ PRESERVED' : '❌ RESET'}`);
        }
        
        // Test 3: Switch to Holographic and check
        console.log('\n✨ TEST 3: Switching to Holographic system');
        await page.click('button:has-text("Holographic")');
        await page.waitForTimeout(2000);
        
        console.log('📊 Checking parameter states after switch:');
        for (const [param] of Object.entries(testParams)) {
            const slider = await page.locator(`input[id="${param}"]`);
            const sliderValue = await slider.inputValue();
            const displayId = param.replace('gridDensity', 'density').replace('morphFactor', 'morph') + 'Value';
            const displayValue = await page.locator(`#${displayId}`).textContent();
            
            console.log(`   ${param}: slider=${sliderValue}, display=${displayValue}`);
            
            // Check if they match our test values
            const matches = sliderValue === testParams[param];
            console.log(`   ${matches ? '✅ PRESERVED' : '❌ RESET'}`);
        }
        
        // Test 4: Check actual visual responsiveness
        console.log('\n🎮 TEST 4: Testing parameter responsiveness');
        await page.click('button:has-text("Holographic")');
        await page.waitForTimeout(1000);
        
        console.log('🔧 Testing if parameter changes affect visuals...');
        
        // Change speed and observe
        const speedSlider = await page.locator('input[id="speed"]');
        await speedSlider.fill('0.2');
        await page.waitForTimeout(1000);
        console.log('   Speed set to 0.2 (very slow)');
        
        await speedSlider.fill('2.8');
        await page.waitForTimeout(1000);
        console.log('   Speed set to 2.8 (very fast)');
        
        // Change density and observe
        const densitySlider = await page.locator('input[id="gridDensity"]');
        await densitySlider.fill('15');
        await page.waitForTimeout(1000);
        console.log('   Density set to 15 (low)');
        
        await densitySlider.fill('75');
        await page.waitForTimeout(1000);
        console.log('   Density set to 75 (high)');
        
        console.log('\n📋 ANALYSIS COMPLETE');
        console.log('='*60);
        
        const recommendations = [
            '🎯 PERSISTENCE STRATEGY NEEDED:',
            '',
            'Option 1: UI CONTROLS MASTER (Recommended)',
            '  - UI sliders maintain their values across system switches',
            '  - When switching systems, sync visualizer to UI state',
            '  - Pro: Predictable UX, user intent preserved',
            '  - Con: Requires initialization sync code',
            '',
            'Option 2: SYSTEM-SPECIFIC PERSISTENCE',
            '  - Each system remembers its own parameter state',
            '  - UI updates to match system when switched',
            '  - Pro: Each system maintains independent settings',
            '  - Con: UI constantly changes, confusing UX',
            '',
            'Option 3: GLOBAL PARAMETER STATE',
            '  - All systems share same parameter values',
            '  - UI and all systems always synchronized',
            '  - Pro: Simple, consistent',
            '  - Con: May not suit different system needs',
            '',
            'RECOMMENDATION: Option 1 (UI CONTROLS MASTER)',
            'Users expect sliders to maintain their position.',
            'Systems should adapt to user-set parameters on switch.'
        ];
        
        recommendations.forEach(rec => console.log(rec));
        
        return true;
        
    } catch (error) {
        console.error('❌ Parameter persistence analysis failed:', error.message);
        return false;
        
    } finally {
        await browser.close();
        console.log('\n⏰ End Time:', new Date().toISOString());
    }
}

// Run analysis
if (require.main === module) {
    analyzeParameterPersistence().then(success => {
        if (success) {
            console.log('\n🎯 PARAMETER PERSISTENCE ANALYSIS COMPLETE');
            console.log('Review the recommendations above to design the persistence strategy.');
        } else {
            console.log('\n⚠️ Analysis encountered issues');
        }
        process.exit(success ? 0 : 1);
    });
}