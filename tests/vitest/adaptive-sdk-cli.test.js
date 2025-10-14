import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { runAdaptiveSdkCli } from '../../src/cli/runAdaptiveSdkCli.js';

function createBuffer() {
  const chunks = [];
  return {
    write(chunk) {
      if (chunk === undefined || chunk === null) {
        return;
      }
      chunks.push(typeof chunk === 'string' ? chunk : String(chunk));
    },
    toString() {
      return chunks.join('');
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, '../fixtures/adaptive-sdk/cli-sample.json');
const diagnosticsFixturePath = path.resolve(
  __dirname,
  '../fixtures/adaptive-sdk/cli-diagnostics.json'
);

describe('Adaptive SDK CLI', () => {
  it('renders welcome overview by default', async () => {
    const stdout = createBuffer();
    const exitCode = await runAdaptiveSdkCli({ argv: [], stdout, stderr: createBuffer(), exitOnError: false });
    expect(exitCode).toBe(0);
    expect(stdout.toString()).toContain('Adaptive SDK CLI Onboarding');
  });

  it('shows status for demo configuration', async () => {
    const stdout = createBuffer();
    const exitCode = await runAdaptiveSdkCli({
      argv: ['status', '--demo'],
      stdout,
      stderr: createBuffer(),
      exitOnError: false
    });
    expect(exitCode).toBe(0);
    const output = stdout.toString();
    expect(output).toContain('Adaptive SDK Status');
    expect(output).toContain('Configuration source: built-in demo');
    expect(output).toContain('Plugins registered : 1');
  });

  it('lists plugins from a config file in JSON format', async () => {
    const stdout = createBuffer();
    const exitCode = await runAdaptiveSdkCli({
      argv: ['plugins', 'list', '--config', fixturePath, '--json'],
      stdout,
      stderr: createBuffer(),
      exitOnError: false
    });
    expect(exitCode).toBe(0);
    const payload = JSON.parse(stdout.toString());
    expect(payload.plugins).toHaveLength(1);
    expect(payload.plugins[0].id).toBe('sample-plugin');
  });

  it('provides detailed plugin info', async () => {
    const stdout = createBuffer();
    const exitCode = await runAdaptiveSdkCli({
      argv: ['plugins', 'info', 'sample-plugin', '--config', fixturePath],
      stdout,
      stderr: createBuffer(),
      exitOnError: false
    });
    expect(exitCode).toBe(0);
    const output = stdout.toString();
    expect(output).toContain('Plugin: sample-plugin');
    expect(output).toContain('Commands:');
  });

  it('reports diagnostics in human-readable mode', async () => {
    const stdout = createBuffer();
    const exitCode = await runAdaptiveSdkCli({
      argv: ['check', '--config', diagnosticsFixturePath],
      stdout,
      stderr: createBuffer(),
      exitOnError: false
    });
    expect(exitCode).toBe(0);
    const output = stdout.toString();
    expect(output).toContain('Plugin Diagnostics');
    expect(output).toContain('needs-attention');
    expect(output).toContain('missing-plugin-description');
    expect(output).toContain('plugin-inactive');
  });

  it('emits diagnostic JSON payloads with counts', async () => {
    const stdout = createBuffer();
    const exitCode = await runAdaptiveSdkCli({
      argv: ['diagnostics', '--config', diagnosticsFixturePath, '--json'],
      stdout,
      stderr: createBuffer(),
      exitOnError: false
    });
    expect(exitCode).toBe(0);
    const payload = JSON.parse(stdout.toString());
    expect(payload.totals.warning).toBeGreaterThan(0);
    const needsAttention = payload.diagnostics.find(
      (entry) => entry.plugin.id === 'needs-attention'
    );
    expect(needsAttention.issues.some((issue) => issue.code === 'plugin-inactive')).toBe(true);
  });

  it('summarizes onboarding guides in text mode', async () => {
    const stdout = createBuffer();
    const exitCode = await runAdaptiveSdkCli({
      argv: ['guide', '--config', diagnosticsFixturePath],
      stdout,
      stderr: createBuffer(),
      exitOnError: false
    });
    expect(exitCode).toBe(0);
    const output = stdout.toString();
    expect(output).toContain('Adaptive SDK Onboarding Guide');
    expect(output).toContain('Recommendations:');
    expect(output).toContain('needs-attention');
    expect(output).toContain('Next Steps:');
    expect(output).toContain('Use `node bin/adaptive-sdk-cli.js diagnostics --json`');
  });

  it('emits onboarding guide JSON payloads', async () => {
    const stdout = createBuffer();
    const exitCode = await runAdaptiveSdkCli({
      argv: ['guide', '--config', diagnosticsFixturePath, '--json'],
      stdout,
      stderr: createBuffer(),
      exitOnError: false
    });
    expect(exitCode).toBe(0);
    const payload = JSON.parse(stdout.toString());
    expect(payload.source).toContain('cli-diagnostics.json');
    expect(payload.guide.overview.pluginTotal).toBe(2);
    expect(payload.guide.highlights).toHaveLength(2);
    expect(payload.guide.recommendations.length).toBeGreaterThan(0);
  });

  it('previews plugin scaffolds with dry-run JSON output', async () => {
    const stdout = createBuffer();
    const exitCode = await runAdaptiveSdkCli({
      argv: [
        'init',
        '--dry-run',
        '--json',
        '--marketplace',
        'team-market',
        '--plugin',
        'team-helper',
        '--plugin-name',
        'Team Helper'
      ],
      stdout,
      stderr: createBuffer(),
      exitOnError: false
    });
    expect(exitCode).toBe(0);
    const payload = JSON.parse(stdout.toString());
    expect(payload.plan.marketplace?.name).toBe('team-market');
    expect(payload.plan.plugin.id).toBe('team-helper');
    expect(payload.dryRun).toBe(true);
    expect(payload.files.some((file) => file.status === 'planned')).toBe(true);
  });

  it('materializes scaffold files to the filesystem', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adaptive-sdk-cli-'));
    const stdout = createBuffer();
    const exitCode = await runAdaptiveSdkCli({
      argv: [
        'init',
        tempDir,
        '--marketplace',
        'scaffold-market',
        '--plugin',
        'scaffold-plugin',
        '--author',
        'Test Author'
      ],
      stdout,
      stderr: createBuffer(),
      exitOnError: false,
      env: { PWD: tempDir }
    });
    expect(exitCode).toBe(0);

    const manifestPath = path.join(
      tempDir,
      'scaffold-market',
      'scaffold-plugin',
      '.claude-plugin',
      'plugin.json'
    );
    const commandPath = path.join(tempDir, 'scaffold-market', 'scaffold-plugin', 'commands', 'hello.md');
    const configPath = path.join(tempDir, 'adaptive-sdk.config.json');

    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    expect(manifest.author.name).toBe('Test Author');
    expect(await fs.readFile(commandPath, 'utf8')).toContain('# Hello');
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    expect(config.plugins[0].id).toBe('scaffold-plugin');

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
