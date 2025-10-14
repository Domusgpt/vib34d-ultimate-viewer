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
| `init` | Scaffold plugin + marketplace files or preview plans for new bundles. |
| `status` | Summarize plugin registration, activation counts, and integration tips. |
| `guide` | Generate a curated summary with plugin highlights, diagnostics, and next steps. |
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

## Scaffolding plugin bundles

Run `init` to bootstrap a plugin marketplace, manifest, sample command, and
Adaptive SDK config without hand-editing JSON. The command defaults to a
quickstart-friendly greeter plugin but exposes flags for customizing names,
directories, tags, and command copy.

### Preview a scaffold

```bash
node bin/adaptive-sdk-cli.js init --dry-run --json
```

* `--dry-run` previews directories and files without writing to disk.
* `--json` emits the full plan for scripting, CI, or documentation.

### Generate files locally

```bash
node bin/adaptive-sdk-cli.js init ./test-marketplace \
  --marketplace team-market \
  --plugin helper-bot \
  --plugin-name "Helper Bot" \
  --author "Dev Team"
```

Key options:

* `--marketplace`, `--plugin`, `--plugin-name`, and `--author` customize manifest metadata.
* `--plugin-only` skips marketplace files if you already have one.
* `--no-config` or `--no-command` remove optional outputs.
* `--force` overwrites existing files and `--config-name` renames the generated config.

Review the CLI output for created paths and next steps, then run `status` or
`guide` to verify your new descriptors.

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

## Onboarding guide

Run the `guide` command whenever you need a shareable briefing for teammates or
automations. The CLI calls `sdk.buildPluginOnboardingGuide()` under the hood and
summarizes totals, diagnostic recommendations, and plugin highlights with the
top commands, agents, hooks, and MCP servers for each descriptor.

```bash
node bin/adaptive-sdk-cli.js guide --config ./adaptive-sdk.config.json
```

The output includes:

* Overall counts for plugins, commands, agents, hooks, and MCP servers
* Diagnostic totals grouped by severity with actionable recommendations
* Up to five plugin highlights detailing metadata, command slugs, and hook
  coverage (use `--json` for the full list)
* A curated set of next steps to unblock your MVP rollout

Export the same information in JSON for CI checks or agent onboarding portals:

```bash
node bin/adaptive-sdk-cli.js guide --config ./adaptive-sdk.config.json --json
```

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

1. Bootstrap descriptor bundles with `node bin/adaptive-sdk-cli.js init` (or craft them manually) to match your agent workflows.
2. Use `status`, `plugins list`, and `commands list` after each change to verify
   activation.
3. Run `guide` to brief agents on highlights, diagnostic suggestions, and next
   steps.
4. Run `check` (with `--json` in CI) to confirm plugin metadata and readiness.
5. Review `DOCS/PLUGINS_QUICKSTART.md` for deep dives into the descriptor model
   and marketplace integration.
6. Share your config and onboarding notes with your agents to ensure consistent
   setup across environments.
