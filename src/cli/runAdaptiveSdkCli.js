import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..', '..');
const packageJsonPath = path.join(workspaceRoot, 'package.json');

const execFileAsync = promisify(execFile);

const LONG_OPTION_ALIASES = new Map([
  ['env', 'environment'],
  ['environment', 'environment'],
  ['output', 'output'],
  ['demo', 'demo'],
  ['json', 'json'],
  ['help', 'help'],
  ['verbose', 'verbose'],
  ['ci', 'ci']
]);

const SHORT_FLAG_ALIASES = new Map([
  ['h', 'help'],
  ['d', 'demo'],
  ['j', 'json'],
  ['v', 'verbose']
]);

const SHORT_OPTION_ALIASES = new Map([
  ['e', 'environment'],
  ['o', 'output']
]);

const OPTIONS_REQUIRING_VALUE = new Set(['environment', 'output']);

export async function main(argv = []) {
  const parsed = parseArguments(argv);

  if (!parsed.command || parsed.flags.has('help') || parsed.command === 'help') {
    printHelp();
    return 0;
  }

  switch (parsed.command) {
    case 'status':
      return await runStatusCommand(parsed);
    default:
      console.error(`Unknown command: ${parsed.command}`);
      printHelp();
      return 1;
  }
}

async function runStatusCommand(parsed) {
  if (parsed.errors.length > 0) {
    for (const message of parsed.errors) {
      console.error(message);
    }
    return 1;
  }

  const unsupportedFlags = [...parsed.flags].filter(flag => !['demo', 'json', 'verbose', 'ci'].includes(flag));
  const unsupportedNamed = [...parsed.named.keys()].filter(name => !['environment', 'output'].includes(name));

  if (unsupportedFlags.length > 0 || unsupportedNamed.length > 0) {
    if (unsupportedFlags.length > 0) {
      const formatted = unsupportedFlags.map(flag => (flag.length === 1 ? `-${flag}` : `--${flag}`));
      console.error(`Unknown option${formatted.length > 1 ? 's' : ''}: ${formatted.join(', ')}`);
    }
    if (unsupportedNamed.length > 0) {
      console.error(`Unknown option${unsupportedNamed.length > 1 ? 's' : ''}: ${unsupportedNamed.map(name => `--${name}`).join(', ')}`);
    }
    return 1;
  }

  if (parsed.positionals.length > 0) {
    console.error(`Unexpected argument${parsed.positionals.length > 1 ? 's' : ''} for status command: ${parsed.positionals.join(', ')}`);
    return 1;
  }

  const status = await collectStatusSnapshot(parsed);
  const format = determineOutputFormat(parsed);
  const printOptions = {
    verbose: parsed.flags.has('verbose'),
    ci: parsed.flags.has('ci')
  };

  if (format === 'json') {
    console.log(JSON.stringify(status, null, 2));
  } else {
    printStatusSnapshot(status, printOptions);
  }

  return 0;
}

function determineOutputFormat(parsed) {
  const preferred = parsed.named.get('output');
  if (preferred) {
    const normalized = preferred.toLowerCase();
    if (normalized === 'json') {
      return 'json';
    }
    if (normalized === 'text') {
      return 'text';
    }
  }

  if (parsed.flags.has('ci')) {
    return 'json';
  }

  if (parsed.flags.has('json')) {
    return 'json';
  }

  return 'text';
}

async function collectStatusSnapshot(parsed) {
  const environmentOverride = parsed.flags.has('demo')
    ? 'demo'
    : parsed.named.get('environment')?.trim() || null;

  let environmentSource = 'default';
  let environment = 'production';

  if (environmentOverride) {
    environment = environmentOverride;
    environmentSource = parsed.flags.has('demo') ? 'flag:demo' : 'flag:environment';
  } else if (process.env.ADAPTIVE_SDK_ENV) {
    environment = process.env.ADAPTIVE_SDK_ENV;
    environmentSource = 'env:ADAPTIVE_SDK_ENV';
  }

  const packageMetadata = await readPackageMetadata();
  const git = await collectGitMetadata();
  const runtime = buildRuntimeSnapshot(packageMetadata);
  const diagnostics = buildDiagnostics({ runtime, git, packageMetadata });
  const cliFlags = {
    demo: parsed.flags.has('demo'),
    json: parsed.flags.has('json'),
    verbose: parsed.flags.has('verbose'),
    ci: parsed.flags.has('ci')
  };

  return {
    cli: {
      packageName: packageMetadata?.name ?? null,
      packageVersion: packageMetadata?.version ?? null,
      runnerPath: path.relative(workspaceRoot, path.join(__dirname, 'runAdaptiveSdkCli.js')),
      workspaceRoot,
      flags: cliFlags
    },
    environment: {
      current: environment,
      source: environmentSource,
      demoMode: environment.toLowerCase() === 'demo',
      nodeEnv: process.env.NODE_ENV ?? null
    },
    runtime,
    git,
    timestamp: new Date().toISOString(),
    workingDirectory: process.cwd(),
    warnings: diagnostics.warnings,
    notes: diagnostics.notes
  };
}

async function readPackageMetadata() {
  try {
    const contents = await readFile(packageJsonPath, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    console.warn('[adaptive-sdk-cli] Unable to read package metadata:', error.message);
    return null;
  }
}

function buildRuntimeSnapshot(packageMetadata) {
  const engineRange = packageMetadata?.engines?.node ?? null;
  const engineEvaluation = evaluateNodeEngineRange(engineRange);

  return {
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid,
    execPath: process.execPath,
    uptimeSeconds: process.uptime(),
    engineRange,
    engineSatisfied: engineEvaluation?.satisfies ?? null,
    engineCheck: engineEvaluation?.detail ?? null
  };
}

async function collectGitMetadata() {
  try {
    const [branch, commit, status] = await Promise.all([
      runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD']),
      runGitCommand(['rev-parse', '--short', 'HEAD']),
      runGitCommand(['status', '--short'])
    ]);

    const changes = status
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    return {
      available: true,
      branch: branch || null,
      commit: commit || null,
      isClean: changes.length === 0,
      changedFiles: changes.length
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}

async function runGitCommand(args) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: workspaceRoot,
      env: process.env
    });
    return stdout.trim();
  } catch (error) {
    throw new Error(error.stderr?.toString().trim() || error.message || 'Failed to execute git command');
  }
}

function buildDiagnostics({ runtime, git, packageMetadata }) {
  const warnings = [];
  const notes = [];

  if (runtime.engineRange) {
    if (runtime.engineSatisfied === false) {
      warnings.push(
        `Current Node.js version ${runtime.nodeVersion} does not satisfy package engine requirement "${runtime.engineRange}".`
      );
    } else if (runtime.engineSatisfied === null) {
      notes.push(
        `Unable to fully evaluate Node.js engine requirement "${runtime.engineRange}". Detected Node.js version: ${runtime.nodeVersion}.`
      );
    }
  }

  if (git?.available === true && git.isClean === false) {
    notes.push(`Workspace has ${git.changedFiles} modified file${git.changedFiles === 1 ? '' : 's'}.`);
  }

  if (git?.available === false && git.error) {
    notes.push(`Git metadata unavailable: ${git.error}`);
  }

  if (!packageMetadata) {
    warnings.push('Package metadata could not be loaded; some status information may be incomplete.');
  }

  return { warnings, notes };
}

function evaluateNodeEngineRange(range) {
  if (!range || typeof range !== 'string') {
    return null;
  }

  const tokens = range.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  const current = parseSemver(process.version);
  let supported = true;

  for (const token of tokens) {
    const result = evaluateNodeEngineToken(token, current);
    if (result === null) {
      return { satisfies: null, detail: `Unable to evaluate token "${token}".` };
    }
    if (!result) {
      supported = false;
    }
  }

  return { satisfies: supported, detail: null };
}

function evaluateNodeEngineToken(token, current) {
  if (!token || token === '*') {
    return true;
  }

  if (token.includes('||') || token.includes(',')) {
    return null;
  }

  const trimmed = token.trim();

  if (trimmed.startsWith('^')) {
    const base = parseSemver(trimmed.slice(1));
    if (!base) {
      return null;
    }
    const upper = { ...base, major: base.major + 1, minor: 0, patch: 0 };
    return compareSemver(current, base) >= 0 && compareSemver(current, upper) < 0;
  }

  if (trimmed.startsWith('~')) {
    const base = parseSemver(trimmed.slice(1));
    if (!base) {
      return null;
    }
    const upper = { ...base, minor: base.minor + 1, patch: 0 };
    return compareSemver(current, base) >= 0 && compareSemver(current, upper) < 0;
  }

  const operatorMatch = trimmed.match(/^(>=|<=|>|<|=)?\s*(.+)$/);
  if (!operatorMatch) {
    return null;
  }

  const [, operatorRaw, versionRaw] = operatorMatch;
  const operator = operatorRaw || '>=';
  const version = parseSemver(versionRaw);
  if (!version) {
    return null;
  }

  const comparison = compareSemver(current, version);

  switch (operator) {
    case '>':
      return comparison > 0;
    case '>=':
      return comparison >= 0;
    case '<':
      return comparison < 0;
    case '<=':
      return comparison <= 0;
    case '=':
      return comparison === 0;
    default:
      return null;
  }
}

function parseSemver(version) {
  if (!version) {
    return null;
  }

  const sanitized = version.replace(/^v/, '').trim();
  if (!sanitized) {
    return null;
  }

  const [majorRaw, minorRaw = '0', patchRaw = '0'] = sanitized.split('.');
  const major = Number.parseInt(majorRaw, 10);
  const minor = Number.parseInt(minorRaw, 10);
  const patch = Number.parseInt(patchRaw, 10);

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null;
  }

  return { major, minor, patch };
}

function compareSemver(a, b) {
  if (!a || !b) {
    return 0;
  }
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  if (a.patch !== b.patch) {
    return a.patch - b.patch;
  }
  return 0;
}

function printStatusSnapshot(snapshot, options = {}) {
  const { verbose = false, ci = false } = options;

  if (ci) {
    const gitState = snapshot.git?.available === false
      ? 'unavailable'
      : snapshot.git?.isClean === false
        ? `dirty(${snapshot.git.changedFiles})`
        : 'clean';
    console.log(
      [
        `environment=${snapshot.environment.current}`,
        `mode=${snapshot.environment.demoMode ? 'demo' : 'standard'}`,
        `node=${snapshot.runtime.nodeVersion}`,
        `git=${gitState}`,
        `timestamp=${snapshot.timestamp}`
      ].join(' ')
    );
    if (snapshot.warnings.length > 0) {
      for (const warning of snapshot.warnings) {
        console.warn(`WARNING: ${warning}`);
      }
    }
    return;
  }

  console.log('Adaptive SDK CLI');
  if (snapshot.cli.packageName || snapshot.cli.packageVersion) {
    const name = snapshot.cli.packageName ?? 'unknown-package';
    const version = snapshot.cli.packageVersion ? ` v${snapshot.cli.packageVersion}` : '';
    console.log(`Package: ${name}${version}`);
  }
  console.log(`Environment: ${snapshot.environment.current}`);
  const sourceDescription = describeEnvironmentSource(snapshot.environment.source);
  if (sourceDescription) {
    console.log(`Environment source: ${sourceDescription}`);
  }
  if (snapshot.environment.nodeEnv) {
    console.log(`NODE_ENV: ${snapshot.environment.nodeEnv}`);
  }
  console.log(`Mode: ${snapshot.environment.demoMode ? 'Demonstration / sandbox' : 'Production or custom environment'}`);
  console.log(`Node.js: ${snapshot.runtime.nodeVersion} (${snapshot.runtime.platform})`);
  if (snapshot.runtime.engineRange) {
    const message = snapshot.runtime.engineSatisfied === false
      ? `NOT satisfied (requires ${snapshot.runtime.engineRange})`
      : snapshot.runtime.engineSatisfied === true
        ? `Satisfied (requires ${snapshot.runtime.engineRange})`
        : `Requirement ${snapshot.runtime.engineRange}`;
    console.log(`Engine constraint: ${message}`);
  }
  if (verbose) {
    console.log(`Node executable: ${snapshot.runtime.execPath}`);
    console.log(`Process uptime: ${snapshot.runtime.uptimeSeconds.toFixed(2)}s`);
  }
  console.log(`Process ID: ${snapshot.runtime.pid}`);
  console.log(`Workspace root: ${snapshot.cli.workspaceRoot}`);
  console.log(`Working directory: ${snapshot.workingDirectory}`);
  console.log(`Runner: ${snapshot.cli.runnerPath}`);
  if (snapshot.git?.available === true) {
    console.log(`Git branch: ${snapshot.git.branch ?? 'unknown'} (${snapshot.git.commit ?? 'n/a'})`);
    console.log(`Git status: ${snapshot.git.isClean ? 'clean' : `dirty (${snapshot.git.changedFiles} changed)`}`);
  } else {
    console.log('Git status: unavailable');
  }
  console.log(`Timestamp: ${snapshot.timestamp}`);

  if (snapshot.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of snapshot.warnings) {
      console.log(`  • ${warning}`);
    }
  }

  if (verbose && snapshot.notes.length > 0) {
    console.log('Notes:');
    for (const note of snapshot.notes) {
      console.log(`  • ${note}`);
    }
  }
}

function describeEnvironmentSource(source) {
  switch (source) {
    case 'flag:demo':
      return '--demo flag';
    case 'flag:environment':
      return '--environment option';
    case 'env:ADAPTIVE_SDK_ENV':
      return 'ADAPTIVE_SDK_ENV environment variable';
    case 'default':
    default:
      return '';
  }
}

function parseArguments(argv) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  const flags = new Set();
  const named = new Map();
  const positionals = [];
  const errors = [];
  let command;
  let parsingOptions = true;

  while (tokens.length > 0) {
    const token = tokens.shift();

    if (parsingOptions && token === '--') {
      parsingOptions = false;
      continue;
    }

    if (!command && parsingOptions && !token.startsWith('-')) {
      command = token;
      continue;
    }

    if (parsingOptions && token.startsWith('--')) {
      const body = token.slice(2);
      if (!body) {
        continue;
      }
      const [namePart, valuePart] = body.split('=', 2);
      const normalizedName = normalizeLongOption(namePart);
      if (valuePart !== undefined) {
        named.set(normalizedName, valuePart);
      } else if (OPTIONS_REQUIRING_VALUE.has(normalizedName)) {
        if (tokens[0] && !tokens[0].startsWith('-')) {
          named.set(normalizedName, tokens.shift());
        } else {
          errors.push(`Option --${normalizedName} requires a value.`);
        }
      } else if (tokens[0] && !tokens[0].startsWith('-')) {
        named.set(normalizedName, tokens.shift());
      } else {
        flags.add(normalizedName);
      }
      continue;
    }

    if (parsingOptions && token.startsWith('-') && token.length > 1) {
      const body = token.slice(1);

      if (body.includes('=')) {
        const [flagPart, valuePart] = body.split('=', 2);
        const normalizedName = normalizeShortOption(flagPart);
        if (normalizedName) {
          named.set(normalizedName, valuePart);
        } else {
          flags.add(flagPart);
        }
        continue;
      }

      for (let index = 0; index < body.length; index += 1) {
        const symbol = body[index];
        const optionName = normalizeShortOption(symbol);

        if (optionName) {
          const remainder = body.slice(index + 1);
          if (remainder) {
            named.set(optionName, remainder);
            break;
          }

          if (tokens[0] && !tokens[0].startsWith('-')) {
            named.set(optionName, tokens.shift());
          } else {
            errors.push(`Option -${symbol} requires a value.`);
          }
          break;
        }

        const flagName = normalizeShortFlag(symbol);
        flags.add(flagName);
      }
      continue;
    }

    parsingOptions = false;
    positionals.push(token);
  }

  return { command, flags, named, positionals, errors };
}

function normalizeLongOption(name) {
  return LONG_OPTION_ALIASES.get(name) ?? name;
}

function normalizeShortFlag(symbol) {
  return SHORT_FLAG_ALIASES.get(symbol) ?? symbol;
}

function normalizeShortOption(symbol) {
  return SHORT_OPTION_ALIASES.get(symbol) ?? null;
}

export function printHelp() {
  console.log('Usage: adaptive-sdk-cli <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  status             Display the current Adaptive SDK status snapshot');
  console.log('  help               Show this help output');
  console.log('');
  console.log('Global options:');
  console.log('  -h, --help         Show help information');
  console.log('');
  console.log('Status options:');
  console.log('  -d, --demo         Force demo environment mode');
  console.log('  -e, --environment <name>  Override the reported environment');
  console.log('  -j, --json         Output the status snapshot as JSON');
  console.log('  -v, --verbose      Display extended runtime and diagnostics data');
  console.log('      --ci           Emit machine-readable output for CI pipelines');
  console.log('      --output <format>     Explicitly set output format (json|text)');
}
