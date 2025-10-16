import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..', '..');
const packageJsonPath = path.join(workspaceRoot, 'package.json');

const LONG_OPTION_ALIASES = new Map([
  ['env', 'environment'],
  ['environment', 'environment'],
  ['output', 'output'],
  ['demo', 'demo'],
  ['json', 'json'],
  ['help', 'help']
]);

const SHORT_FLAG_ALIASES = new Map([
  ['h', 'help'],
  ['d', 'demo'],
  ['j', 'json']
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

  const unsupportedFlags = [...parsed.flags].filter(flag => !['demo', 'json'].includes(flag));
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

  if (format === 'json') {
    console.log(JSON.stringify(status, null, 2));
  } else {
    printStatusSnapshot(status);
  }

  return 0;
}

function determineOutputFormat(parsed) {
  const preferred = parsed.named.get('output');
  if (preferred && preferred.toLowerCase() === 'json') {
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

  return {
    cli: {
      packageName: packageMetadata?.name ?? null,
      packageVersion: packageMetadata?.version ?? null,
      runnerPath: path.relative(workspaceRoot, path.join(__dirname, 'runAdaptiveSdkCli.js')),
      workspaceRoot
    },
    environment,
    environmentSource,
    demoMode: environment.toLowerCase() === 'demo',
    node: {
      version: process.version,
      platform: process.platform,
      pid: process.pid
    },
    timestamp: new Date().toISOString(),
    workingDirectory: process.cwd()
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

function printStatusSnapshot(snapshot) {
  console.log('Adaptive SDK CLI');
  if (snapshot.cli.packageName || snapshot.cli.packageVersion) {
    const name = snapshot.cli.packageName ?? 'unknown-package';
    const version = snapshot.cli.packageVersion ? ` v${snapshot.cli.packageVersion}` : '';
    console.log(`Package: ${name}${version}`);
  }
  console.log(`Environment: ${snapshot.environment}`);
  const sourceDescription = describeEnvironmentSource(snapshot.environmentSource);
  if (sourceDescription) {
    console.log(`Environment source: ${sourceDescription}`);
  }
  console.log(`Mode: ${snapshot.demoMode ? 'Demonstration / sandbox' : 'Production or custom environment'}`);
  console.log(`Node.js: ${snapshot.node.version} (${snapshot.node.platform})`);
  console.log(`Process ID: ${snapshot.node.pid}`);
  console.log(`Workspace root: ${snapshot.cli.workspaceRoot}`);
  console.log(`Working directory: ${snapshot.workingDirectory}`);
  console.log(`Runner: ${snapshot.cli.runnerPath}`);
  console.log(`Timestamp: ${snapshot.timestamp}`);
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
  console.log('      --output <format>     Explicitly set output format (json|text)');
}
