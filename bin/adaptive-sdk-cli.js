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

    await main(process.argv.slice(2));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
