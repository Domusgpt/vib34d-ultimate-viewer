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

  it('scaffolds plugin quickstart files with init command', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adaptive-cli-init-'));
    const stdout = createBuffer();
    const exitCode = await runAdaptiveSdkCli({
      argv: ['init', '--dir', tempDir, '--plugin', 'hello-world', '--marketplace', 'dev-market'],
      stdout,
      stderr: createBuffer(),
      exitOnError: false
    });
    expect(exitCode).toBe(0);
    const config = JSON.parse(await fs.readFile(path.join(tempDir, 'adaptive-sdk.config.json'), 'utf8'));
    expect(config.plugins).toHaveLength(1);
    expect(config.plugins[0].id).toBe('hello-world');
    const marketplaceManifest = JSON.parse(
      await fs.readFile(path.join(tempDir, 'dev-market/.claude-plugin/marketplace.json'), 'utf8')
    );
    expect(marketplaceManifest.plugins[0].source).toBe('./hello-world');
    const commandMarkdown = await fs.readFile(
      path.join(tempDir, 'dev-market/hello-world/commands/hello.md'),
      'utf8'
    );
    expect(commandMarkdown).toContain('# Hello Command');
    expect(stdout.toString()).toContain('Scaffold complete');
  });

  it('skips overwriting existing files without force flag', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adaptive-cli-skip-'));
    const configPath = path.join(tempDir, 'adaptive-sdk.config.json');
    await fs.writeFile(configPath, JSON.stringify({ plugins: [] }, null, 2));

    const stdout = createBuffer();
    const exitCode = await runAdaptiveSdkCli({
      argv: ['init', '--dir', tempDir],
      stdout,
      stderr: createBuffer(),
      exitOnError: false
    });

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toContain('⚠️  Skipped Adaptive SDK config');
    const persisted = JSON.parse(await fs.readFile(configPath, 'utf8'));
    expect(persisted.plugins).toHaveLength(0);
  });
});
