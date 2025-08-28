#!/usr/bin/env node

/**
 * VIB34D VISUAL TESTING FRAMEWORK - COMPREHENSIVE AGENT RUNNER
 * 
 * This script orchestrates the execution of all visual testing agents:
 * 1. Visual Holographic Speed Test Agent
 * 2. Visual Mouse Density Test Agent  
 * 3. Visual System Integration Agent
 * 4. Visual Parameter Override Agent
 * 
 * Features:
 * - Sequential or parallel test execution
 * - Detailed logging and reporting
 * - Screenshot organization
 * - Performance metrics
 * - Error aggregation and analysis
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class VIB34DVisualTestRunner {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
    this.testResultsDir = 'test-results';
    this.reportDir = 'visual-test-reports';
    
    this.agents = [
      {
        name: 'Visual Holographic Speed Test Agent',
        file: 'visual-holographic-speed-test.spec.js',
        description: 'Tests holographic system speed controls and audio interaction',
        icon: '⚡'
      },
      {
        name: 'Visual Mouse Density Test Agent',
        file: 'visual-mouse-density-test.spec.js',
        description: 'Tests mouse movement effects on density and smoothness',
        icon: '🖱️'
      },
      {
        name: 'Visual System Integration Agent',
        file: 'visual-system-integration-test.spec.js',
        description: 'Tests system switching and integration functionality',
        icon: '🔄'
      },
      {
        name: 'Visual Parameter Override Agent',
        file: 'visual-parameter-override-test.spec.js',
        description: 'Tests parameter control priority and override behavior',
        icon: '⚖️'
      }
    ];
    
    this.setupDirectories();
  }

  setupDirectories() {
    // Ensure test results directory exists
    if (!fs.existsSync(this.testResultsDir)) {
      fs.mkdirSync(this.testResultsDir, { recursive: true });
      console.log(`📁 Created test results directory: ${this.testResultsDir}`);
    }
    
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
      console.log(`📁 Created reports directory: ${this.reportDir}`);
    }
  }

  async runAgent(agent, options = {}) {
    console.log(`\n${agent.icon} Starting ${agent.name}`);
    console.log(`📝 ${agent.description}`);
    
    const startTime = Date.now();
    
    try {
      // Build Playwright command
      const cmd = [
        'npx', 'playwright', 'test',
        `tests/${agent.file}`,
        '--reporter=json'
      ];
      
      if (options.headed) cmd.push('--headed');
      if (options.debug) cmd.push('--debug');
      if (options.browser) cmd.push(`--project=${options.browser}`);
      
      console.log(`🚀 Executing: ${cmd.join(' ')}`);
      
      // Run the test
      const result = execSync(cmd.join(' '), { 
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ ${agent.name} completed successfully in ${duration}ms`);
      
      return {
        agent: agent.name,
        status: 'success',
        duration,
        output: result,
        screenshots: this.getAgentScreenshots(agent.file),
        errors: []
      };
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error(`❌ ${agent.name} failed after ${duration}ms`);
      console.error(`Error: ${error.message}`);
      
      return {
        agent: agent.name,
        status: 'failed',
        duration,
        output: error.stdout || '',
        error: error.message,
        screenshots: this.getAgentScreenshots(agent.file),
        errors: [error.message]
      };
    }
  }

  getAgentScreenshots(agentFile) {
    try {
      const screenshots = fs.readdirSync(this.testResultsDir)
        .filter(file => file.endsWith('.png'))
        .filter(file => {
          const agentPrefix = agentFile.replace('.spec.js', '').replace('visual-', '').replace('-test', '');
          return file.includes(agentPrefix) || 
                 file.includes('holographic') || 
                 file.includes('mouse') || 
                 file.includes('system') || 
                 file.includes('parameter');
        })
        .map(file => ({
          name: file,
          path: path.join(this.testResultsDir, file),
          size: fs.statSync(path.join(this.testResultsDir, file)).size,
          created: fs.statSync(path.join(this.testResultsDir, file)).mtime
        }));
      
      return screenshots;
    } catch (error) {
      console.warn(`⚠️ Could not retrieve screenshots: ${error.message}`);
      return [];
    }
  }

  async runAllAgents(options = {}) {
    console.log('\n🚀 VIB34D VISUAL TESTING FRAMEWORK STARTING');
    console.log('=' * 60);
    console.log(`📅 Start Time: ${new Date().toISOString()}`);
    console.log(`🎯 Target: http://localhost:8146`);
    console.log(`🔧 Mode: ${options.parallel ? 'Parallel' : 'Sequential'}`);
    console.log(`🌐 Browser: ${options.browser || 'chromium'}`);
    
    // Check if server is running
    try {
      const response = await fetch('http://localhost:8146');
      if (response.ok) {
        console.log('✅ VIB34D server is running on localhost:8146');
      } else {
        console.warn('⚠️ VIB34D server responded with error');
      }
    } catch (error) {
      console.error('❌ VIB34D server is not responding on localhost:8146');
      console.error('   Please start the server with: python3 -m http.server 8146');
      process.exit(1);
    }
    
    if (options.parallel) {
      // Run agents in parallel
      console.log('\n🔄 Running agents in parallel...');
      const promises = this.agents.map(agent => this.runAgent(agent, options));
      this.testResults = await Promise.all(promises);
    } else {
      // Run agents sequentially
      console.log('\n🔄 Running agents sequentially...');
      for (const agent of this.agents) {
        const result = await this.runAgent(agent, options);
        this.testResults.push(result);
        
        // Brief pause between agents
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    
    this.generateReport(totalDuration);
  }

  generateReport(totalDuration) {
    console.log('\n📊 GENERATING COMPREHENSIVE VISUAL TEST REPORT');
    console.log('=' * 60);
    
    const successful = this.testResults.filter(r => r.status === 'success').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    
    console.log(`✅ Successful Agents: ${successful}`);
    console.log(`❌ Failed Agents: ${failed}`);
    console.log(`⏱️ Total Duration: ${totalDuration}ms`);
    
    // Generate detailed report
    const report = {
      framework: 'VIB34D Visual Testing Framework',
      timestamp: new Date().toISOString(),
      totalDuration,
      summary: {
        total: this.testResults.length,
        successful,
        failed,
        successRate: ((successful / this.testResults.length) * 100).toFixed(1)
      },
      agents: this.testResults.map(result => ({
        name: result.agent,
        status: result.status,
        duration: result.duration,
        screenshots: result.screenshots.length,
        screenshotFiles: result.screenshots.map(s => s.name),
        errors: result.errors || []
      })),
      screenshots: {
        total: this.testResults.reduce((sum, r) => sum + r.screenshots.length, 0),
        totalSize: this.testResults.reduce((sum, r) => 
          sum + r.screenshots.reduce((s, img) => s + img.size, 0), 0
        )
      }
    };
    
    // Write JSON report
    const reportFile = path.join(this.reportDir, `visual-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // Write HTML report
    this.generateHTMLReport(report);
    
    console.log(`📄 JSON Report saved: ${reportFile}`);
    console.log(`🌐 HTML Report saved: ${this.reportDir}/visual-test-report.html`);
    
    // Print summary
    this.printSummary(report);
  }

  generateHTMLReport(report) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VIB34D Visual Testing Report</title>
    <style>
        body { 
            font-family: 'Consolas', 'Monaco', monospace; 
            background: #000; 
            color: #0ff; 
            margin: 0; 
            padding: 20px; 
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
            text-align: center; 
            border-bottom: 2px solid #0ff; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
        }
        .summary { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .stat-card { 
            background: rgba(0, 255, 255, 0.1); 
            border: 1px solid #0ff; 
            padding: 20px; 
            text-align: center; 
        }
        .agent { 
            background: rgba(0, 255, 255, 0.05); 
            border-left: 4px solid #0ff; 
            margin-bottom: 20px; 
            padding: 20px; 
        }
        .success { border-left-color: #0f0; }
        .failed { border-left-color: #f00; }
        .screenshots { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); 
            gap: 10px; 
            margin-top: 10px; 
        }
        .screenshot { 
            background: rgba(255, 255, 255, 0.1); 
            padding: 10px; 
            border: 1px solid rgba(255, 255, 255, 0.2); 
            font-size: 0.8em; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 VIB34D Visual Testing Framework Report</h1>
            <p>Generated: ${report.timestamp}</p>
        </div>
        
        <div class="summary">
            <div class="stat-card">
                <h3>Total Tests</h3>
                <div style="font-size: 2em;">${report.summary.total}</div>
            </div>
            <div class="stat-card">
                <h3>Success Rate</h3>
                <div style="font-size: 2em; color: #0f0;">${report.summary.successRate}%</div>
            </div>
            <div class="stat-card">
                <h3>Total Duration</h3>
                <div style="font-size: 2em;">${(report.totalDuration / 1000).toFixed(1)}s</div>
            </div>
            <div class="stat-card">
                <h3>Screenshots</h3>
                <div style="font-size: 2em;">${report.screenshots.total}</div>
            </div>
        </div>
        
        ${report.agents.map(agent => `
            <div class="agent ${agent.status}">
                <h2>${agent.name}</h2>
                <p><strong>Status:</strong> ${agent.status.toUpperCase()}</p>
                <p><strong>Duration:</strong> ${agent.duration}ms</p>
                <p><strong>Screenshots:</strong> ${agent.screenshots}</p>
                
                ${agent.screenshotFiles.length > 0 ? `
                    <div class="screenshots">
                        ${agent.screenshotFiles.map(file => `
                            <div class="screenshot">${file}</div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${agent.errors.length > 0 ? `
                    <div style="color: #f00; margin-top: 10px;">
                        <strong>Errors:</strong>
                        <ul>
                            ${agent.errors.map(error => `<li>${error}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>
    `;
    
    fs.writeFileSync(path.join(this.reportDir, 'visual-test-report.html'), html);
  }

  printSummary(report) {
    console.log('\n🎯 FINAL SUMMARY');
    console.log('=' * 40);
    
    for (const agent of report.agents) {
      const status = agent.status === 'success' ? '✅' : '❌';
      const duration = `${agent.duration}ms`;
      const screenshots = `${agent.screenshots} screenshots`;
      
      console.log(`${status} ${agent.name}: ${duration}, ${screenshots}`);
      
      if (agent.errors.length > 0) {
        for (const error of agent.errors) {
          console.log(`   ⚠️ ${error}`);
        }
      }
    }
    
    console.log('\n📈 OVERALL METRICS');
    console.log(`Success Rate: ${report.summary.successRate}%`);
    console.log(`Total Screenshots: ${report.screenshots.total}`);
    console.log(`Total Size: ${(report.screenshots.totalSize / 1024 / 1024).toFixed(2)}MB`);
    
    if (report.summary.successRate === '100.0') {
      console.log('\n🎉 ALL VISUAL TESTING AGENTS COMPLETED SUCCESSFULLY!');
    } else {
      console.log('\n⚠️ Some agents encountered issues - check the detailed report');
    }
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    parallel: args.includes('--parallel'),
    headed: args.includes('--headed'),
    debug: args.includes('--debug'),
    browser: args.find(arg => arg.startsWith('--browser='))?.split('=')[1]
  };
  
  console.log('🧪 VIB34D VISUAL TESTING FRAMEWORK');
  console.log('Sophisticated browser automation agents for VIB34D holographic interface testing');
  console.log();
  
  if (args.includes('--help')) {
    console.log('Usage: node visual-test-runner.js [options]');
    console.log();
    console.log('Options:');
    console.log('  --parallel      Run all agents in parallel (faster)');
    console.log('  --headed        Run tests in headed mode (visible browser)');
    console.log('  --debug         Run tests in debug mode');
    console.log('  --browser=name  Specify browser (chromium, firefox, webkit)');
    console.log('  --help          Show this help message');
    process.exit(0);
  }
  
  const runner = new VIB34DVisualTestRunner();
  runner.runAllAgents(options).catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = VIB34DVisualTestRunner;