// Direct test of Engine.js import
import { VIB34DIntegratedEngine } from './src/core/Engine.js';

console.log('✅ VIB34DIntegratedEngine imported successfully');
console.log('Constructor available:', typeof VIB34DIntegratedEngine);

// Try to create an instance
try {
    const engine = new VIB34DIntegratedEngine();
    console.log('✅ Engine instance created successfully');
} catch (error) {
    console.log('❌ Engine creation failed:', error.message);
}