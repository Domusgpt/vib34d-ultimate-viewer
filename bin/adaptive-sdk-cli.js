#!/usr/bin/env node

const path = require('path');
const { pathToFileURL } = require('url');

const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/cli/runAdaptiveSdkCli.js')).href;

(async () => {
  try {
    const moduleNamespace = await import(moduleUrl);
    const main = typeof moduleNamespace.main === 'function'
      ? moduleNamespace.main
      : typeof moduleNamespace.default === 'function'
        ? moduleNamespace.default
        : null;

    if (!main) {
      throw new Error('runAdaptiveSdkCli.js must export a main function.');
    }

    const exitCode = await main();
    if (typeof exitCode === 'number') {
      process.exitCode = exitCode;
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
