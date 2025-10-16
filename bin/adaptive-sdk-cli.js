#!/usr/bin/env node

const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  try {
    const modulePath = path.join(__dirname, '..', 'src', 'cli', 'runAdaptiveSdkCli.js');
    const moduleUrl = pathToFileURL(modulePath).href;
    const { main } = await import(moduleUrl);

    if (typeof main !== 'function') {
      throw new TypeError('runAdaptiveSdkCli.js must export a callable main() function.');
    }

    const result = await main(process.argv.slice(2));
    if (typeof result === 'number' && Number.isFinite(result)) {
      const normalizedExitCode = Math.trunc(result);
      process.exitCode = normalizedExitCode;
      if (normalizedExitCode !== 0) {
        process.exit(normalizedExitCode);
      }
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
