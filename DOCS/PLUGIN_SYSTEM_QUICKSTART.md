# Adaptive SDK Plugin System Quickstart

The Adaptive SDK now ships with a first-class plugin manager so you can extend the runtime with reusable commands, agents, hooks, and MCP-style servers. This guide mirrors the developer workflow teams follow when shipping Claude Code plug-ins while highlighting the SDK-specific helpers that make orchestration elegant, ubiquitous, and agent-friendly.

## Prerequisites
- `createAdaptiveSDK` available in your project
- Basic familiarity with JavaScript module systems
- Optional: existing plugin descriptors or marketplace manifests you want to install

## Bootstrap plugins during SDK creation
Register plugins as part of the factory configuration when you want descriptors available immediately. Each descriptor can expose commands, agents, hooks, and servers. Handlers receive rich context objects that include the SDK instance, engine references, and plugin metadata.

```js
import { createAdaptiveSDK } from './src/core/AdaptiveSDK.js';

const sdk = createAdaptiveSDK({
  plugins: [
    {
      name: 'greetings-plugin',
      version: '1.0.0',
      commands: {
        hello: ({ payload }) => `Hello ${payload?.name ?? 'world'}`
      },
      agents: {
        concierge: ({ payload }) => ({
          greet: () => `Welcome ${payload?.visitor ?? 'guest'}`
        })
      },
      hooks: {
        'demo:init': ({ payload }) => {
          payload.events?.push('greetings:init');
          return payload;
        }
      }
    }
  ]
});

await sdk.whenPluginsReady();
```

`whenPluginsReady()` resolves after all config-supplied descriptors (and marketplace auto-installs) finish registering so you can immediately invoke commands or agents.

## Runtime registration and waiters
Load additional plugins at runtime using `registerPlugin` or the underlying `sdk.plugins.register`. The watcher and waiter helpers replay existing matches and respect abort signals so orchestration flows remain robust.

```js
const events = [];
const stop = sdk.watchPlugins((event) => events.push(event));

const plugin = await sdk.registerPlugin(
  async () => ({
    name: 'metrics-plugin',
    commands: {
      ping: ({ manifest }) => manifest.name
    },
    hooks: {
      'metrics:flush': ({ metadata }) => console.info('flushed', metadata.source)
    }
  }),
  { source: 'runtime' }
);

const ready = await sdk.whenPluginRegistered('metrics-plugin');
console.log(ready.manifest); // -> plugin manifest

const result = await sdk.invokePluginCommand('ping');
stop();
```

## Marketplace support
Package multiple plugins into a marketplace descriptor and install them as needed. Marketplace entries can specify a descriptor inline or provide an async loader that returns a plugin descriptor.

```js
sdk.registerPluginMarketplace({
  name: 'dev-marketplace',
  plugins: [
    {
      name: 'insights-plugin',
      description: 'Stream usage insights',
      plugin: {
        version: '0.2.0',
        commands: {
          report: ({ payload }) => ({
            status: 'ok',
            payload
          })
        }
      }
    }
  ]
});

await sdk.installPluginFromMarketplace('dev-marketplace', 'insights-plugin');
```

## Invoke commands, agents, hooks, and servers
Every handler receives a context object that includes the plugin manifest, metadata, and the SDK instance. Convenience wrappers hang off the top-level SDK so automation flows stay terse.

```js
const greeting = await sdk.invokePluginCommand('hello', { name: 'Ada' });
const concierge = await sdk.createPluginAgent('concierge', { visitor: 'Beck' });
const events = await sdk.emitPluginHook('demo:init', { events: [] });
const server = await sdk.createPluginServer('insights-stream', { channel: 'usage' });
```

## Key APIs
- `sdk.plugins` – the plugin manager with `register`, `list`, `watch`, `whenRegistered`, and marketplace helpers
- `sdk.watchPlugins(listener, options)` – attach observers with include-existing replays and abort-aware cleanup
- `sdk.whenPluginsReady()` / `sdk.whenPluginRegistered(selector, options)` – coordinate async activation safely
- `sdk.invokePluginCommand`, `sdk.createPluginAgent`, `sdk.emitPluginHook`, `sdk.createPluginServer` – execute plugin capabilities with consistent context objects
- Marketplace helpers: `sdk.registerPluginMarketplace`, `sdk.installPluginFromMarketplace`, `sdk.listPluginMarketplaces`

## Next steps
1. Wrap common automation flows in descriptors so agents can reuse them across projects.
2. Publish marketplace manifests for team-wide plugin catalogs.
3. Add Vitest coverage using the helpers above to validate command/agent/hook lifecycles.
