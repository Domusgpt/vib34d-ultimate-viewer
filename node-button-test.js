#!/usr/bin/env node

// Simulate the exact button creation logic from the app
const { JSDOM } = require('jsdom');

// Create a DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head><title>Button Test</title></head>
<body>
    <div class="geometry-grid" id="geometryGrid"></div>
</body>
</html>
`);

global.window = dom.window;
global.document = dom.window.document;

// Simulate the exact geometry arrays from index-clean.html
const geometries = {
    faceted: ['TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS', 'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL', 'HYPERTETRAHEDRON'],
    quantum: ['TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS', 'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL', 'HYPERTETRAHEDRON'],
    holographic: ['HOLOGRAPHIC'],
    polychora: ['5-CELL', 'TESSERACT', '16-CELL', '24-CELL', '600-CELL', '120-CELL']
};

// Set up window.geometries exactly like index-clean.html
global.window.geometries = geometries;

console.log('🧪 NODE TEST: Starting geometry button simulation...');
console.log('🧪 Geometries object:', geometries);

// Simulate the setupGeometry function exactly
function setupGeometry(system) {
    console.log(`🎯 setupGeometry called for system: ${system}`);
    const grid = document.getElementById('geometryGrid');
    if (!grid) {
        console.error('❌ geometryGrid element not found!');
        return;
    }
    
    console.log(`📊 window.geometries exists:`, !!window.geometries);
    console.log(`📊 window.geometries.${system}:`, window.geometries?.[system]);
    console.log(`📊 window.geometries.faceted:`, window.geometries?.faceted);
    
    const geoList = window.geometries?.[system] || window.geometries?.faceted || [
        'TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS', 
        'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL', 'HYPERTETRAHEDRON'
    ];
    console.log(`🎯 FINAL geometry list for ${system}: ${geoList.length} items:`, geoList);
    
    grid.innerHTML = geoList.map((name, i) => 
        `<button class="geom-btn ${i === 0 ? 'active' : ''}" 
                 data-index="${i}" onclick="selectGeometry(${i})">
            ${name}
        </button>`
    ).join('');
    
    console.log(`✅ Created ${grid.children.length} geometry buttons`);
    
    // List each button
    Array.from(grid.children).forEach((btn, i) => {
        console.log(`  Button ${i}: "${btn.textContent.trim()}"`);
    });
    
    return grid.children.length;
}

// Test each system
console.log('\n=== TESTING FACETED SYSTEM ===');
const facetedCount = setupGeometry('faceted');

console.log('\n=== TESTING QUANTUM SYSTEM ===');
const quantumCount = setupGeometry('quantum');

console.log('\n=== TESTING HOLOGRAPHIC SYSTEM ===');
const holographicCount = setupGeometry('holographic');

console.log('\n=== TESTING POLYCHORA SYSTEM ===');
const polychoraCount = setupGeometry('polychora');

console.log('\n=== FINAL RESULTS ===');
console.log(`Faceted: ${facetedCount} buttons (expected: 9)`);
console.log(`Quantum: ${quantumCount} buttons (expected: 9)`);  
console.log(`Holographic: ${holographicCount} buttons (expected: 1)`);
console.log(`Polychora: ${polychoraCount} buttons (expected: 6)`);

if (facetedCount === 9 && quantumCount === 9) {
    console.log('✅ NODE TEST: Button creation logic works correctly!');
    console.log('🔍 The bug must be in the browser environment, CSS, or timing.');
} else {
    console.log('❌ NODE TEST: Button creation logic is broken!');
    console.log('🔍 The bug is in the setupGeometry function itself.');
}