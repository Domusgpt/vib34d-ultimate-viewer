#!/usr/bin/env node

/**
 * VIB34D Visual Testing Framework - Setup Validation
 * 
 * This script validates that the visual testing framework is properly set up
 * and can connect to the VIB34D interface.
 */

const { chromium } = require('playwright');
const http = require('http');

async function validateSetup() {
  console.log('🧪 VIB34D Visual Testing Framework - Setup Validation');
  console.log('=' * 60);
  
  let validationsPassed = 0;
  let totalValidations = 0;
  
  const validate = (condition, message) => {
    totalValidations++;
    if (condition) {
      console.log(`✅ ${message}`);
      validationsPassed++;
    } else {
      console.log(`❌ ${message}`);
    }
    return condition;
  };
  
  // 1. Check Node.js version
  const nodeVersion = process.version;
  validate(nodeVersion, `Node.js version: ${nodeVersion}`);
  
  // 2. Check if Playwright is available
  let playwrightAvailable = false;
  try {
    require('@playwright/test');
    playwrightAvailable = true;
  } catch (error) {
    // Playwright not available
  }
  validate(playwrightAvailable, 'Playwright is installed and available');
  
  if (!playwrightAvailable) {
    console.log('❌ Setup validation failed - Playwright is required');
    console.log('💡 Run: npm install && npx playwright install');
    process.exit(1);
  }
  
  // 3. Check if VIB34D server is running
  const serverRunning = await new Promise((resolve) => {
    const req = http.get('http://localhost:8146', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
  });
  
  validate(serverRunning, 'VIB34D server is running on localhost:8146');
  
  if (!serverRunning) {
    console.log('💡 Start server with: python3 -m http.server 8146');
    console.log('⚠️  Some validations will be skipped without the server');
  }
  
  // 4. Test basic browser automation
  let browserTestPassed = false;
  if (serverRunning) {
    try {
      console.log('🌐 Testing browser automation...');
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.goto('http://localhost:8146');
      await page.waitForLoadState('networkidle');
      
      // Check if we can find system buttons
      const systemButtons = await page.locator('.system-btn').count();
      browserTestPassed = systemButtons >= 4;
      
      await browser.close();
    } catch (error) {
      console.log(`   Browser test error: ${error.message}`);
    }
  }
  
  validate(browserTestPassed, `Browser can connect and find VIB34D interface elements (${browserTestPassed ? 'found system buttons' : 'failed'})`);
  
  // 5. Check test files exist
  const fs = require('fs');
  const testFiles = [
    'tests/visual-holographic-speed-test.spec.js',
    'tests/visual-mouse-density-test.spec.js', 
    'tests/visual-system-integration-test.spec.js',
    'tests/visual-parameter-override-test.spec.js'
  ];
  
  let allTestFilesExist = true;
  for (const file of testFiles) {
    const exists = fs.existsSync(file);
    if (!exists) allTestFilesExist = false;
    validate(exists, `Test file exists: ${file}`);
  }
  
  // 6. Check runner scripts exist
  const runnerFiles = [
    'visual-test-runner.js',
    'run-visual-tests.sh'
  ];
  
  let allRunnerFilesExist = true;
  for (const file of runnerFiles) {
    const exists = fs.existsSync(file);
    if (!exists) allRunnerFilesExist = false;
    validate(exists, `Runner file exists: ${file}`);
  }
  
  // 7. Check directories
  const dirs = ['test-results', 'visual-test-reports'];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    validate(fs.existsSync(dir), `Directory exists: ${dir}`);
  }
  
  console.log('');
  console.log('📊 VALIDATION SUMMARY');
  console.log(`Passed: ${validationsPassed}/${totalValidations} validations`);
  
  if (validationsPassed === totalValidations) {
    console.log('');
    console.log('🎉 SETUP VALIDATION SUCCESSFUL!');
    console.log('');
    console.log('🚀 Ready to run visual tests:');
    console.log('   ./run-visual-tests.sh --headed');
    console.log('   ./run-visual-tests.sh --agent=speed');
    console.log('   node visual-test-runner.js');
    console.log('');
    process.exit(0);
  } else {
    console.log('');
    console.log('❌ Setup validation failed');
    console.log('💡 Fix the issues above before running visual tests');
    console.log('');
    process.exit(1);
  }
}

validateSetup().catch(error => {
  console.error('❌ Validation failed with error:', error);
  process.exit(1);
});