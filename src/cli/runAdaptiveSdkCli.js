class CliUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CliUsageError';
  }
}

function writeLine(stream, message = '') {
  stream.write(`${message}\n`);
}

async function main(options = {}) {
  const {
    argv = process.argv.slice(2),
    stdout = process.stdout,
    stderr = process.stderr,
    now = () => new Date()
  } = options;

  const [command, ...args] = argv;

  if (!command || command === '--help' || command === '-h') {
    printHelp(stdout);
    return { exitCode: 0 };
  }

  switch (command) {
    case 'status':
      try {
        const report = await handleStatus(args, stdout, now);
        return { exitCode: 0, report };
      } catch (error) {
        if (error instanceof CliUsageError) {
          writeLine(stderr, error.message);
          return { exitCode: 1 };
        }
        throw error;
      }
    default:
      writeLine(stderr, `Unknown command: ${command}`);
      printHelp(stdout);
      return { exitCode: 1 };
  }
}

async function handleStatus(args, stdout, now) {
  const { demoMode, environment } = parseStatusArguments(args);

  const statusReport = {
    mode: demoMode ? 'demo' : 'standard',
    environment,
    timestamp: now().toISOString(),
    services: {
      holographicRenderer: 'operational',
      adaptiveLayoutEngine: 'operational',
      commercializationTelemetry: 'operational'
    }
  };

  writeLine(stdout, 'Adaptive SDK status report');
  writeLine(stdout, JSON.stringify(statusReport, null, 2));

  return statusReport;
}

function parseStatusArguments(args) {
  let demoMode = false;
  let environment = 'production';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--demo') {
      demoMode = true;
      continue;
    }

    if (arg === '--env') {
      const envName = args[index + 1];
      if (!envName) {
        throw new CliUsageError('Missing value for --env option.');
      }
      environment = envName;
      index += 1;
      continue;
    }

    throw new CliUsageError(`Unknown option for status command: ${arg}`);
  }

  return { demoMode, environment };
}

function printHelp(stdout) {
  writeLine(stdout, 'Adaptive SDK CLI');
  writeLine(stdout, 'Usage: adaptive-sdk-cli <command> [options]');
  writeLine(stdout);
  writeLine(stdout, 'Commands:');
  writeLine(stdout, '  status [--demo] [--env <name>]  Display the SDK service status summary.');
  writeLine(stdout);
  writeLine(stdout, 'Options:');
  writeLine(stdout, '  -h, --help                      Show this message.');
}

module.exports = { main };
module.exports.default = main;
