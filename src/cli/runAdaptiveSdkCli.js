const path = require('path');
const { pathToFileURL } = require('url');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    const moduleUrl = pathToFileURL(path.resolve(__dirname, './runAdaptiveSdkCli.mjs')).href;
    modulePromise = import(moduleUrl);
  }
  return modulePromise;
}

async function main(argv = process.argv.slice(2), streams) {
  const moduleNamespace = await loadModule();
  if (typeof moduleNamespace.main !== 'function') {
    throw new Error('runAdaptiveSdkCli.mjs must export a main function.');
  }
  return moduleNamespace.main(argv, streams);
}

module.exports = { main };
module.exports.default = main;
