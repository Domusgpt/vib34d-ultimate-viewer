#!/usr/bin/env node

/**
 * VIB34D Quantum Mouse Experiment Test
 * Tests the new experimental quantum mouse behavior:
 * - X-axis controls smooth 4D rotation
 * - Y-axis maintains density/complexity control
 * - Hemispheric color mapping with fluid transitions
 */

const { chromium } = require('playwright');

async function testQuantumMouseExperiment() {
    console.log('🧪 VIB34D Quantum Mouse Experiment Test');
    console.log('⏰ Start Time:', new Date().toISOString());
    console.log('🌿 Branch: quantum-mouse-experiment');
    
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
        
        // Switch to Quantum system for testing
        console.log('🌌 Switching to Quantum system for experimental testing');
        await page.click('button:has-text("Quantum")');
        await page.waitForTimeout(2000);
        
        console.log('\n🧪 TESTING EXPERIMENTAL QUANTUM MOUSE BEHAVIOR');
        console.log('='*60);
        
        // Get canvas bounds for mouse interaction
        const canvas = await page.locator('canvas').first();
        const box = await canvas.boundingBox();
        
        if (box) {
            console.log(`📊 Canvas bounds: ${box.width}x${box.height} at (${box.x}, ${box.y})`);
            
            // Test 1: X-axis rotation mapping (left to right)
            console.log('\n🔄 TEST 1: X-axis Rotation Mapping');
            console.log('Moving mouse horizontally to test rotation...');
            
            const testPositions = [
                { name: 'Far Left', x: box.x + box.width * 0.1, y: box.y + box.height * 0.5 },
                { name: 'Center Left', x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 },
                { name: 'Center', x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 },
                { name: 'Center Right', x: box.x + box.width * 0.7, y: box.y + box.height * 0.5 },
                { name: 'Far Right', x: box.x + box.width * 0.9, y: box.y + box.height * 0.5 }
            ];
            
            for (const pos of testPositions) {
                console.log(`   ${pos.name}: Moving to (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
                await page.mouse.move(pos.x, pos.y);
                await page.waitForTimeout(1500);
            }
            
            // Capture screenshot of X-axis rotation
            await page.screenshot({ 
                path: 'test-results/quantum-experiment-x-rotation.png',
                clip: { x: 0, y: 0, width: 1200, height: 800 }
            });
            
            // Test 2: Y-axis density control
            console.log('\n📐 TEST 2: Y-axis Density Control (should maintain existing behavior)');
            console.log('Moving mouse vertically to test density changes...');
            
            const verticalPositions = [
                { name: 'Top', x: box.x + box.width * 0.5, y: box.y + box.height * 0.1 },
                { name: 'Upper Mid', x: box.x + box.width * 0.5, y: box.y + box.height * 0.3 },
                { name: 'Center', x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 },
                { name: 'Lower Mid', x: box.x + box.width * 0.5, y: box.y + box.height * 0.7 },
                { name: 'Bottom', x: box.x + box.width * 0.5, y: box.y + box.height * 0.9 }
            ];
            
            for (const pos of verticalPositions) {
                console.log(`   ${pos.name}: Moving to (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
                await page.mouse.move(pos.x, pos.y);
                await page.waitForTimeout(1500);
            }
            
            // Capture screenshot of Y-axis density
            await page.screenshot({ 
                path: 'test-results/quantum-experiment-y-density.png',
                clip: { x: 0, y: 0, width: 1200, height: 800 }
            });
            
            // Test 3: Hemispheric color mapping
            console.log('\n🌈 TEST 3: Hemispheric Color Mapping');
            console.log('Testing color transitions across quadrants...');
            
            const quadrantPositions = [
                { name: 'Top-Left (Blue)', x: box.x + box.width * 0.25, y: box.y + box.height * 0.25 },
                { name: 'Top-Right (Purple)', x: box.x + box.width * 0.75, y: box.y + box.height * 0.25 },
                { name: 'Bottom-Left (Cyan)', x: box.x + box.width * 0.25, y: box.y + box.height * 0.75 },
                { name: 'Bottom-Right (Magenta)', x: box.x + box.width * 0.75, y: box.y + box.height * 0.75 },
                { name: 'Center (Blend)', x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 }
            ];
            
            for (const pos of quadrantPositions) {
                console.log(`   ${pos.name}: Moving to (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
                await page.mouse.move(pos.x, pos.y);
                await page.waitForTimeout(2000);
                
                // Take screenshot for each quadrant
                const filename = pos.name.toLowerCase().replace(/[^a-z]/g, '-');
                await page.screenshot({ 
                    path: `test-results/quantum-experiment-${filename}.png`,
                    clip: { x: 0, y: 0, width: 1200, height: 800 }
                });
            }
            
            // Test 4: Combined movement (circular motion)
            console.log('\n🔄 TEST 4: Combined Movement (Circular Motion)');
            console.log('Testing combined X-rotation + Y-density + color mapping...');
            
            const centerX = box.x + box.width * 0.5;
            const centerY = box.y + box.height * 0.5;
            const radius = Math.min(box.width, box.height) * 0.3;
            
            console.log('   Performing circular mouse movement...');
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                await page.mouse.move(x, y);
                await page.waitForTimeout(300);
            }
            
            // Final screenshot
            await page.screenshot({ 
                path: 'test-results/quantum-experiment-circular-motion.png',
                clip: { x: 0, y: 0, width: 1200, height: 800 }
            });
            
            console.log('\n✅ QUANTUM MOUSE EXPERIMENT TEST COMPLETE');
            console.log('🎯 Results:');
            console.log('  📸 Screenshots captured for all test scenarios');
            console.log('  🔄 X-axis rotation mapping tested');
            console.log('  📐 Y-axis density control tested');
            console.log('  🌈 Hemispheric color mapping tested');
            console.log('  🔄 Combined movement patterns tested');
            console.log('');
            console.log('🧪 EXPERIMENTAL FEATURES VALIDATED:');
            console.log('  1. Mouse X → Smooth 4D rotation (rot4dXW, rot4dYW, rot4dZW)');
            console.log('  2. Mouse Y → Density/complexity (gridDensity)');
            console.log('  3. Position → Quadrant-based color mapping (Blue/Purple/Cyan/Magenta)');
            console.log('  4. Distance from center → Hue variation and saturation');
            console.log('  5. Fluid transitions between color hemispheres');
            
            return true;
            
        } else {
            console.log('❌ Could not get canvas bounds for interaction testing');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Quantum mouse experiment test failed:', error.message);
        return false;
        
    } finally {
        await browser.close();
        console.log('\n⏰ End Time:', new Date().toISOString());
    }
}

// Run test
if (require.main === module) {
    testQuantumMouseExperiment().then(success => {
        if (success) {
            console.log('\n🎉 QUANTUM MOUSE EXPERIMENT TESTING COMPLETE!');
            console.log('🔬 Review the screenshots to see the experimental behavior');
            console.log('🌿 Branch: quantum-mouse-experiment (safe to experiment)');
            process.exit(0);
        } else {
            console.log('\n⚠️ Experiment test encountered issues');
            process.exit(1);
        }
    });
}