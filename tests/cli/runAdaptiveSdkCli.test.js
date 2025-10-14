import { describe, expect, it } from 'vitest';
import { main } from '../../src/cli/runAdaptiveSdkCli.js';

function createWritableBuffer() {
  let buffer = '';
  return {
    write(chunk = '') {
      buffer += chunk;
    },
    toString() {
      return buffer;
    }
  };
}

describe('runAdaptiveSdkCli', () => {
  it('prints a demo status report and returns exit code 0', async () => {
    const stdout = createWritableBuffer();
    const stderr = createWritableBuffer();

    const { exitCode, report } = await main({
      argv: ['status', '--demo', '--env', 'staging'],
      stdout,
      stderr,
      now: () => new Date('2025-01-02T03:04:05.678Z')
    });

    expect(exitCode).toBe(0);
    expect(stderr.toString()).toBe('');
    expect(report).toEqual({
      mode: 'demo',
      environment: 'staging',
      timestamp: '2025-01-02T03:04:05.678Z',
      services: {
        holographicRenderer: 'operational',
        adaptiveLayoutEngine: 'operational',
        commercializationTelemetry: 'operational'
      }
    });

    const output = stdout.toString();
    expect(output).toContain('Adaptive SDK status report');

    const [, ...jsonLines] = output.trim().split('\n');
    const parsedReport = JSON.parse(jsonLines.join('\n'));
    expect(parsedReport).toEqual(report);
  });

  it('prints help when no command is provided', async () => {
    const stdout = createWritableBuffer();
    const stderr = createWritableBuffer();

    const { exitCode } = await main({ argv: [], stdout, stderr });

    expect(exitCode).toBe(0);
    expect(stderr.toString()).toBe('');
    expect(stdout.toString()).toContain('Usage: adaptive-sdk-cli <command> [options]');
  });

  it('reports an error when using an unknown command', async () => {
    const stdout = createWritableBuffer();
    const stderr = createWritableBuffer();

    const { exitCode } = await main({ argv: ['unknown'], stdout, stderr });

    expect(exitCode).toBe(1);
    expect(stderr.toString()).toContain('Unknown command: unknown');
    expect(stdout.toString()).toContain('Commands:');
  });

  it('reports an error when the env option is missing a value', async () => {
    const stdout = createWritableBuffer();
    const stderr = createWritableBuffer();

    const { exitCode } = await main({ argv: ['status', '--env'], stdout, stderr });

    expect(exitCode).toBe(1);
    expect(stderr.toString()).toContain('Missing value for --env option.');
  });
});
