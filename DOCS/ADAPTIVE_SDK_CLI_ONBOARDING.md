# Adaptive SDK CLI Onboarding

The Adaptive SDK ships with an onboarding-friendly CLI that surfaces plugin
status, command availability, and runtime orchestration tips from the comfort of
the terminal. The CLI complements the plugin quickstart by giving agents and
integrators live feedback while they iterate on descriptor bundles.

## Installation

The CLI is bundled with the repository. After installing dependencies with
`npm install`, invoke the helper directly:

```bash
node bin/adaptive-sdk-cli.js
```

The default invocation displays a welcome tour with the most common commands and
links to further documentation.

## Commands

| Command | Description |
| ------- | ----------- |
| `welcome` | Show the onboarding overview, usage tips, and documentation links. |
| `init` | Print the configuration checklist for new plugin bundles. |
| `status` | Summarize plugin registration, activation counts, and integration tips. |
| `plugins list` | Enumerate every registered plugin with tags and capability metadata. |
| `plugins info <id>` | Inspect a single plugin, including commands, agents, hooks, and MCP servers. |
| `commands list` | List every registered command with the owning plugin. |
| `agents list` | List agents that plugins have exposed. |
| `hooks list` | Display hook coverage with handler counts. |
| `servers list` | Review registered MCP server descriptors. |
| `check` | Run diagnostics against loaded plugins and surface activation or metadata gaps. |

All commands accept the following flags:

- `--config <path>` or `-c <path>` — Load descriptors from a custom JSON config.
- `--demo` — Use the built-in demo configuration if you just want to explore.
- `--json` — Emit JSON payloads instead of human-readable text for scripting.

Set the `ADAPTIVE_SDK_CONFIG` environment variable to make the config path
implicit:

```bash
ADAPTIVE_SDK_CONFIG=./configs/plugins.json node bin/adaptive-sdk-cli.js status
```

## Configuration format

The CLI expects a JSON file compatible with `createAdaptiveSDK`. The minimal
structure looks like:

```json
{
  "plugins": [
    {
      "id": "greeter",
      "name": "Greeter Plugin",
      "description": "Adds a hello command",
      "commands": [
        {
          "name": "hello",
          "description": "Say hello",
          "response": "Hello from the CLI!"
        }
      ]
    }
  ]
}
```

Add agents, hooks, MCP servers, telemetry providers, and metadata as needed. The
CLI sets the environment to `headless` automatically so descriptors can be
validated without a browser runtime.

## Diagnostics workflow

Use the `check` command to validate plugin readiness and metadata before
shipping a bundle to other agents. The command aggregates activation issues,
missing descriptions, and capability mismatches so you can resolve gaps quickly:

```bash
node bin/adaptive-sdk-cli.js check --config ./adaptive-sdk.config.json
```

Pipe the output to JSON for CI pipelines or scripted validation:

```bash
node bin/adaptive-sdk-cli.js check --config ./adaptive-sdk.config.json --json
```

The CLI exits with code `1` when any diagnostic error is detected, making it
easy to gate releases in your automation.

## Demo mode

When no configuration is supplied the CLI falls back to a demo plugin that
registers commands, hooks, and a mock MCP server. Run the following to explore
without writing any files:

```bash
node bin/adaptive-sdk-cli.js status --demo
node bin/adaptive-sdk-cli.js plugins list --demo
node bin/adaptive-sdk-cli.js plugins info demo-greeter --demo
```

Use the demo output as a scaffold for your own plugin descriptors.

## Testing workflow

Keep the CLI and SDK in sync by running the repository tests:

```bash
npm test
```

The Vitest suite exercises the CLI’s parsing, demo descriptors, and reporting
paths so regressions are caught early during development.

## Next steps

1. Craft plugin descriptor bundles that align with your agent workflows.
2. Use `status`, `plugins list`, and `commands list` after each change to verify
   activation.
3. Run `check` (with `--json` in CI) to confirm plugin metadata and readiness.
4. Review `DOCS/PLUGINS_QUICKSTART.md` for deep dives into the descriptor model
   and marketplace integration.
5. Share your config and onboarding notes with your agents to ensure consistent
   setup across environments.
