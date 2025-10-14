#!/usr/bin/env node

const path = require('path');
const { pathToFileURL } = require('url');

const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/cli/runAdaptiveSdkCli.js'));

function resolveMainExport(moduleNamespace) {
  if (!moduleNamespace) {
    return null;
  }

  if (typeof moduleNamespace === 'function') {
    return moduleNamespace;
  }

  if (typeof moduleNamespace.main === 'function') {
    return moduleNamespace.main;
  }

  if (typeof moduleNamespace.default === 'function') {
    return moduleNamespace.default;
  }

  if (moduleNamespace.default && typeof moduleNamespace.default.main === 'function') {
    return moduleNamespace.default.main;
  }

  return null;
}

(async () => {
  try {
    const importedModule = await import(moduleUrl.href);
    const main = resolveMainExport(importedModule);

    if (typeof main !== 'function') {
      throw new Error('runAdaptiveSdkCli.js does not export a main function');
    }

    const result = await main();

    if (result && typeof result.exitCode === 'number') {
      process.exitCode = result.exitCode;
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
