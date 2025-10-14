function main() {
  const args = process.argv.slice(2);
  const [command, ...commandArgs] = args;

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }

  if (command !== 'status') {
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 1;
  }

  const { demoMode, environment, error } = parseStatusOptions(commandArgs);
  if (error) {
    console.error(error);
    return 1;
  }

  printStatus({ demoMode, environment });
  return 0;
}

function parseStatusOptions(args) {
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
        return { error: 'Missing value for --env option.' };
      }
      environment = envName;
      index += 1;
      continue;
    }

    return { error: `Unknown option: ${arg}` };
  }

  return { demoMode, environment };
}

function printStatus({ demoMode, environment }) {
  const timestamp = new Date().toISOString();

  console.log('Adaptive SDK status');
  console.log(`  Mode: ${demoMode ? 'demo' : 'standard'}`);
  console.log(`  Environment: ${environment}`);
  console.log(`  Timestamp: ${timestamp}`);
}

function printHelp() {
  console.log('Adaptive SDK CLI');
  console.log('Usage: adaptive-sdk-cli <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  status [--demo] [--env <name>]  Display the SDK service status summary.');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help                      Show this message.');
}

module.exports = { main };
module.exports.default = main;
