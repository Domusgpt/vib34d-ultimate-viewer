export async function main(args = process.argv.slice(2)) {
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  switch (command) {
    case 'status':
      handleStatusCommand(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
  }
}

function handleStatusCommand(flags) {
  const isDemo = flags.includes('--demo');
  const environment = isDemo ? 'demo' : 'production';

  console.log('Adaptive SDK CLI');
  console.log(`Status: running in ${environment} mode.`);
}

function printHelp() {
  console.log('Usage: adaptive-sdk-cli <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  status [--demo]     Show the current Adaptive SDK status');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help          Display this help message');
}
