#!/usr/bin/env node

const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  try {
    const modulePath = path.join(__dirname, '..', 'src', 'cli', 'runAdaptiveSdkCli.js');
    const moduleUrl = pathToFileURL(modulePath).href;
    const importedModule = await import(moduleUrl);
    const main =
      typeof importedModule.main === 'function'
        ? importedModule.main
        : typeof importedModule.default === 'function'
          ? importedModule.default
          : typeof importedModule.default?.main === 'function'
            ? importedModule.default.main
            : null;

    if (!main) {
      throw new TypeError('runAdaptiveSdkCli.js must export a callable main() function.');
    }

    await main(process.argv.slice(2));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
