import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageManifest = safeReadPackageManifest();

function createIo(streams = {}) {
  return {
    stdout: streams.stdout || process.stdout,
    stderr: streams.stderr || process.stderr
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, overrides) {
  if (!isPlainObject(overrides)) {
    return overrides === undefined ? base : overrides;
  }

  const result = { ...(isPlainObject(base) ? base : {}) };

  for (const [key, value] of Object.entries(overrides)) {
    if (Array.isArray(value)) {
      const baseArray = Array.isArray(result[key]) ? result[key] : [];
      result[key] = [...baseArray, ...value];
      continue;
    }

    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

function parseArguments(argv = []) {
  const result = {
    command: null,
    options: {},
    positionals: [],
    errors: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!result.command && !token.startsWith('-')) {
      result.command = token;
      continue;
    }

    switch (token) {
      case '--help':
      case '-h':
        result.options.help = true;
        continue;
      case '--demo':
        result.options.demo = true;
        continue;
      case '--no-demo':
        result.options.demo = false;
        continue;
      case '--env':
        index += 1;
        if (index >= argv.length) {
          result.errors.push('Missing value for --env option.');
        } else {
          result.options.environment = argv[index];
        }
        continue;
      case '--format':
        index += 1;
        if (index >= argv.length) {
          result.errors.push('Missing value for --format option.');
        } else {
          result.options.format = argv[index];
        }
        continue;
      case '--config':
        index += 1;
        if (index >= argv.length) {
          result.errors.push('Missing value for --config option.');
        } else {
          result.options.configPath = argv[index];
        }
        continue;
      case '--verbose':
      case '-v':
        result.options.verbose = true;
        continue;
      case '--no-validate':
        result.options.validate = false;
        continue;
      case '--validate':
        result.options.validate = true;
        continue;
      case '--strict-license':
        result.options.strictLicense = true;
        continue;
      case '--no-strict-license':
        result.options.strictLicense = false;
        continue;
      default:
        if (token.startsWith('-')) {
          result.errors.push(`Unknown option: ${token}`);
        } else {
          result.positionals.push(token);
        }
    }
  }

  return result;
}

async function main(argv = process.argv.slice(2), streams) {
  const io = createIo(streams);
  const { command, options, positionals, errors } = parseArguments(argv);

  if (errors.length > 0) {
    for (const message of errors) {
      io.stderr.write(`${message}\n`);
    }
    printHelp(io.stdout);
    return 1;
  }

  if (!command || options.help) {
    printHelp(io.stdout);
    return 0;
  }

  switch (command) {
    case 'status':
      return runStatusCommand({ ...options, args: positionals }, io);
    default:
      io.stderr.write(`Unknown command: ${command}\n`);
      printHelp(io.stdout);
      return 1;
  }
}

async function runStatusCommand(options, io) {
  if (options.args && options.args.length > 0) {
    io.stderr.write(`Unexpected arguments for status command: ${options.args.join(' ')}\n`);
    return 1;
  }

  const format = (options.format || 'text').toLowerCase();
  if (!['text', 'json'].includes(format)) {
    io.stderr.write(`Unsupported format: ${options.format}. Use "text" or "json".\n`);
    return 1;
  }

  try {
    const report = await buildStatusReport({
      environment: options.environment,
      demo: options.demo,
      configPath: options.configPath,
      validate: options.validate,
      strictLicense: options.strictLicense,
      verbose: options.verbose
    });

    if (format === 'json') {
      io.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      formatTextReport(report, options, io.stdout, io.stderr);
    }

    const licenseState = report.license?.status?.state;
    const licenseValid = licenseState === 'valid';
    if (options.strictLicense && !licenseValid) {
      io.stderr.write('License validation failed while --strict-license is enabled.\n');
      return 3;
    }

    return 0;
  } catch (error) {
    io.stderr.write(`[adaptive-sdk-cli] ${error.message}\n`);
    if (options.verbose && error.stack) {
      io.stderr.write(`${error.stack}\n`);
    }
    return 1;
  }
}

async function buildStatusReport(options = {}) {
  const environmentName = String(options.environment || 'production');
  const payload = {
    environment: environmentName,
    demo: Boolean(options.demo),
    configPath: options.configPath ? path.resolve(options.configPath) : null,
    validate: options.validate !== false,
    packageVersion: packageManifest.version || '0.0.0'
  };

  return runStatusWorker(payload);
}

async function runStatusWorker(payload) {
  const loaderPath = path.resolve(moduleDirectory, './loaders/srcModuleLoader.mjs');
  const workerPath = path.resolve(moduleDirectory, './status/statusWorker.mjs');

  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--experimental-loader', loaderPath, workerPath],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });

    child.on('error', reject);

    child.on('close', code => {
      if (code !== 0) {
        const error = new Error(stderr.trim() || `Status worker exited with code ${code}`);
        error.code = code;
        reject(error);
        return;
      }

      try {
        const result = stdout.trim() ? JSON.parse(stdout) : {};
        resolve(result);
      } catch (parseError) {
        parseError.message = `Failed to parse status worker output: ${parseError.message}`;
        reject(parseError);
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

async function buildAdaptiveSdkConfig(options = {}) {
  const environmentName = String(options.environment || 'production');
  const baseConfig = {
    environment: {
      mode: 'headless',
      skipVisualization: true,
      skipUiBindings: true,
      skipGallery: true,
      skipExport: true,
      skipStatus: true,
      autoStart: false
    },
    sensory: {
      autoConnectAdapters: false,
      pollingInterval: 120000,
      confidenceThreshold: 0.35
    },
    telemetry: {
      enabled: true,
      auditLogLimit: 400,
      classificationRules: [
        { prefix: 'adaptive.', classification: 'interaction' },
        { prefix: 'design.', classification: 'analytics' },
        { prefix: 'sensors.', classification: 'system' },
        { prefix: 'privacy.', classification: 'compliance' }
      ],
      defaultConsent: {
        system: true,
        compliance: true,
        interaction: true,
        analytics: false,
        biometric: false
      },
      commercialization: {
        captureInitialSnapshot: true,
        snapshotStore: {
          maxSnapshots: 24
        },
        snapshotIntervalMs: undefined
      },
      licenseAttestationProfilePacks: [
        { id: 'enterprise-saas', options: { applyDefault: false } },
        { id: 'studio-collab', options: { applyDefault: false } },
        'indie-lab'
      ]
    },
    sensorAdapters: createDemoSensorAdapters(environmentName),
    consentOptions: createConsentOptions(environmentName)
  };

  if (options.demo) {
    baseConfig.license = createDemoLicenseConfig(environmentName);
    baseConfig.telemetry.defaultConsent.analytics = true;
    baseConfig.telemetry.defaultConsent.biometric = true;
    baseConfig.telemetry.defaultConsent.interaction = true;
  }

  if (options.configPath) {
    const overrides = await readConfigOverrides(options.configPath);
    if (overrides) {
      return deepMerge(baseConfig, overrides);
    }
  }

  return baseConfig;
}

function createConsentOptions(environmentName) {
  const tier = environmentName.toLowerCase();
  return [
    {
      id: 'analytics',
      label: 'Share anonymized adaptive analytics',
      defaultState: tier === 'production'
    },
    {
      id: 'biometric',
      label: 'Allow biometric-derived insights for personalization',
      defaultState: tier !== 'production'
    },
    {
      id: 'interaction',
      label: 'Record adaptive interaction gestures',
      defaultState: true
    }
  ];
}

function createDemoLicenseConfig(environmentName) {
  const now = new Date();
  const expiry = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const normalizedEnv = environmentName.toLowerCase();
  const seats = normalizedEnv === 'production' ? 500 : 75;

  return {
    key: `DEMO-${normalizedEnv.toUpperCase()}-ADAPTIVE-${now.getUTCFullYear()}`,
    tenantId: normalizedEnv === 'production' ? 'wearable-enterprise' : `demo-${normalizedEnv}`,
    features: [
      'adaptive-layout',
      'projection-scenarios',
      'telemetry-hardened',
      'commercialization-reports'
    ],
    issuedAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    managerOptions: {
      logger: console
    },
    validators: [async license => {
      const valid = typeof license.key === 'string' && license.key.startsWith('DEMO-');
      if (!valid) {
        return { valid: false, reason: 'DEMO_KEY_REQUIRED' };
      }
      return {
        valid: true,
        metadata: {
          tier: normalizedEnv === 'production' ? 'enterprise-evaluation' : 'sandbox',
          seats,
          entitlements: ['adaptive-layout', 'telemetry-hardened', 'commercialization-reports'],
          lastValidatedBy: 'adaptive-sdk-cli'
        }
      };
    }],
    attestor: createDemoLicenseAttestor(environmentName),
    autoValidate: true
  };
}

function createDemoLicenseAttestor(environmentName) {
  const normalizedEnv = environmentName.toLowerCase();
  return {
    id: `demo-attestor-${normalizedEnv}`,
    createValidator() {
      return async (license, context = {}) => {
        const valid = typeof license.key === 'string' && license.key.startsWith('DEMO-');
        if (!valid) {
          return { valid: false, reason: 'ATTESTATION_KEY_MISMATCH' };
        }
        return {
          valid: true,
          metadata: {
            remote: {
              attestedAt: new Date().toISOString(),
              region: normalizedEnv,
              entitlements: ['adaptive-layout', 'projection-scenarios'],
              context
            }
          }
        };
      };
    },
    bindToLicenseManager(manager) {
      const validator = this.createValidator();
      const detach = manager.registerValidator(async (license, context) => validator(license, context));
      return () => {
        if (typeof detach === 'function') {
          detach();
        }
      };
    }
  };
}

function createDemoSensorAdapters(environmentName) {
  const adapters = [
    {
      type: 'eye-tracking',
      instance: createStaticSensorAdapter(() => ({
        confidence: 0.92,
        payload: { x: 0.48, y: 0.52, depth: 0.31 }
      }))
    },
    {
      type: 'neural-intent',
      instance: createStaticSensorAdapter(() => ({
        confidence: 0.88,
        payload: { x: 0.04, y: -0.03, z: 0.02, w: 0.15, engagement: 0.62 }
      }))
    },
    {
      type: 'biometric',
      instance: createStaticSensorAdapter(() => ({
        confidence: 0.9,
        payload: { stress: 0.22, heartRate: 72, temperature: 36.6 }
      }))
    },
    {
      type: 'ambient',
      instance: createStaticSensorAdapter(() => ({
        confidence: 0.86,
        payload: { luminance: 0.58, noiseLevel: 0.18, motion: 0.14 }
      }))
    },
    {
      type: 'gesture',
      instance: createStaticSensorAdapter(() => ({
        confidence: 0.83,
        payload: { intent: 'focus-hold', vector: { x: 0.42, y: 0.38, z: 0.21 } }
      }))
    }
  ];

  return adapters.map(entry => ({
    type: entry.type,
    instance: entry.instance,
    autoConnect: false
  }));
}

function createStaticSensorAdapter(sampleFactory) {
  let connected = false;
  return {
    async connect() {
      connected = true;
    },
    async disconnect() {
      connected = false;
    },
    async read() {
      if (!connected) {
        return { confidence: 0, payload: {} };
      }
      const sample = sampleFactory();
      return {
        confidence: sample.confidence ?? 1,
        payload: sample.payload || {}
      };
    },
    async test() {
      return { ok: true, latencyMs: 8 };
    }
  };
}

async function readConfigOverrides(configPath) {
  try {
    const absolutePath = path.resolve(configPath);
    const content = await fs.readFile(absolutePath, 'utf8');
    const parsed = JSON.parse(content);
    if (!isPlainObject(parsed)) {
      throw new Error('Configuration override must be a JSON object.');
    }
    return parsed;
  } catch (error) {
    throw new Error(`Failed to load configuration from ${configPath}: ${error.message}`);
  }
}

function formatTextReport(report, options, stdout, stderr) {
  const header = `Adaptive SDK CLI ${report.metadata.version} — Status (${report.metadata.environment})`;
  stdout.write(`${header}\n`);
  stdout.write(`${'-'.repeat(header.length)}\n`);
  stdout.write(`Generated: ${report.metadata.generatedAt}\n`);
  stdout.write(`Demo mode: ${report.metadata.demo ? 'enabled' : 'disabled'}\n`);
  stdout.write(`Configuration: ${report.metadata.configSource}\n`);
  stdout.write(`Strict license check: ${options.strictLicense ? 'enabled' : 'disabled'}\n`);
  stdout.write('\n');

  stdout.write('Environment\n');
  stdout.write(`  Mode: ${report.environment.mode}\n`);
  stdout.write(`  Visualization skipped: ${report.environment.skipVisualization ? 'yes' : 'no'}\n`);
  stdout.write(`  UI bindings skipped: ${report.environment.skipUiBindings ? 'yes' : 'no'}\n`);
  stdout.write(`  Gallery disabled: ${report.environment.skipGallery ? 'yes' : 'no'}\n`);
  stdout.write(`  Export disabled: ${report.environment.skipExport ? 'yes' : 'no'}\n`);
  stdout.write('\n');

  stdout.write('License\n');
  const licenseStatus = report.license.status || {};
  stdout.write(`  State: ${licenseStatus.state || 'unknown'}\n`);
  stdout.write(`  Reason: ${licenseStatus.reason || 'n/a'}\n`);
  if (licenseStatus.validatedAt) {
    stdout.write(`  Validated at: ${licenseStatus.validatedAt}\n`);
  }
  const licenseDetails = report.license.details || {};
  if (licenseDetails.key) {
    stdout.write(`  License key: ${licenseDetails.key}\n`);
  }
  if (Array.isArray(licenseDetails.features)) {
    stdout.write(`  Features: ${licenseDetails.features.join(', ')}\n`);
  }
  if (licenseDetails.expiresAt) {
    stdout.write(`  Expires at: ${licenseDetails.expiresAt}\n`);
  }
  if (licenseStatus.metadata) {
    stdout.write(`  Metadata: ${JSON.stringify(licenseStatus.metadata)}\n`);
  }
  stdout.write('\n');

  stdout.write('Telemetry\n');
  stdout.write(`  Enabled: ${report.telemetry.enabled ? 'yes' : 'no'}\n`);
  stdout.write(`  Providers: ${report.telemetry.providers.map(provider => provider.id).join(', ') || 'none'}\n`);
  stdout.write(`  Consent: ${formatConsent(report.telemetry.consent)}\n`);
  stdout.write(`  Audit entries: ${report.telemetry.auditTrail.totalEntries}\n`);
  stdout.write(`  Buffer size: ${report.telemetry.bufferSize}\n`);
  stdout.write(`  Attestation profiles: ${report.telemetry.licenseAttestation.profiles.length}\n`);
  if (report.telemetry.licenseAttestation.defaultProfileId) {
    stdout.write(`  Default profile: ${report.telemetry.licenseAttestation.defaultProfileId}\n`);
  }
  const commercialization = report.telemetry.commercialization;
  stdout.write(`  Commercialization packs: ${commercialization.summary.packs?.length || 0}\n`);
  stdout.write(`  Commercialization snapshots: ${commercialization.snapshotCount}\n`);
  stdout.write('\n');

  stdout.write('Sensors\n');
  stdout.write(`  Auto-connect adapters: ${report.sensors.autoConnect ? 'yes' : 'no'}\n`);
  stdout.write(`  Polling interval: ${report.sensors.pollingIntervalMs} ms\n`);
  stdout.write(`  Registered schemas: ${report.sensors.registeredSchemas.join(', ') || 'none'}\n`);
  stdout.write(`  Registered adapters: ${report.sensors.adapters.map(adapter => adapter.type).join(', ') || 'none'}\n`);
  stdout.write('\n');

  stdout.write('Layout & Design\n');
  stdout.write(`  Layout strategies (${report.layout.strategyCount}): ${report.layout.strategies.join(', ') || 'none'}\n`);
  stdout.write(`  Layout annotations: ${report.layout.annotations.join(', ') || 'none'}\n`);
  stdout.write(`  Active design language: ${report.design.activeLanguage ? report.design.activeLanguage.name : 'none'}\n`);
  stdout.write(`  Available design languages: ${report.design.languages.map(language => language.name).join(', ') || 'none'}\n`);
  stdout.write('\n');

  stdout.write('Projection\n');
  stdout.write(`  Registered scenarios: ${report.projection.scenarioCount}\n`);
  if (report.projection.scenarioCount > 0) {
    stdout.write(`  Scenario ids: ${report.projection.scenarios.map(scenario => scenario.id).join(', ')}\n`);
  }

  if (options.verbose && report.telemetry.auditTrail.recent.length > 0) {
    stdout.write('\nRecent audit trail entries:\n');
    for (const entry of report.telemetry.auditTrail.recent) {
      stdout.write(`  • ${entry.event || entry.type || 'event'} at ${entry.timestamp}\n`);
    }
  }

  if (options.strictLicense && licenseStatus.state !== 'valid') {
    stderr.write('\nLicense is not valid. Enable a valid key or disable --strict-license to continue.\n');
  }
}

function formatConsent(consentMap) {
  const entries = Object.entries(consentMap);
  if (entries.length === 0) {
    return 'none';
  }
  return entries.map(([key, value]) => `${key}=${value ? 'granted' : 'revoked'}`).join(', ');
}

function printHelp(stdout = process.stdout) {
  const lines = [
    'Adaptive SDK CLI',
    '',
    'Usage:',
    '  adaptive-sdk-cli <command> [options]',
    '',
    'Commands:',
    '  status             Display a synthesized Adaptive SDK runtime report.',
    '',
    'Status options:',
    '  --demo                 Bootstrap using demo instrumentation and license.',
    '  --env <name>           Label the target environment (default: production).',
    '  --format <text|json>   Output the report as formatted text or JSON.',
    '  --config <path>        Merge additional SDK configuration overrides (JSON).',
    '  --strict-license       Exit with a non-zero code when the license is not valid.',
    '  --no-validate          Skip license validation before reporting.',
    '  --verbose              Include expanded diagnostics on failure.',
    '',
    'Global options:',
    '  -h, --help             Show this help message.'
  ];

  for (const line of lines) {
    stdout.write(`${line}\n`);
  }
}

function safeReadPackageManifest() {
  try {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line import/no-dynamic-require
    return require('../../package.json');
  } catch (error) {
    return { name: 'adaptive-sdk-cli', version: '0.0.0' };
  }
}

export {
  main,
  parseArguments,
  buildStatusReport,
  buildAdaptiveSdkConfig
};

export default main;
