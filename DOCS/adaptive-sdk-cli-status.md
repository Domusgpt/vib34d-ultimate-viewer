# Adaptive SDK CLI Status Command

The Adaptive SDK CLI provides a `status` command that reports runtime, environment, and repository diagnostics.

## Usage

```bash
node bin/adaptive-sdk-cli.js status [options]
```

### Core options

| Option | Description |
| --- | --- |
| `-d`, `--demo` | Force the status snapshot to report the `demo` environment. |
| `-e`, `--environment <name>` | Override the detected environment with a custom label. |
| `-j`, `--json` | Emit the snapshot as formatted JSON. |
| `-v`, `--verbose` | Include extended runtime diagnostics (process uptime, Node.js executable path, Git notes). |
| `--ci` | Produce machine-readable output optimised for CI runs (defaults to JSON unless overridden with `--output text`). |
| `--output <text|json>` | Explicitly select an output format. |

### Example commands

```bash
# Default status summary
node bin/adaptive-sdk-cli.js status

# Verbose diagnostics and repository insights
node bin/adaptive-sdk-cli.js status --verbose

# CI-friendly JSON snapshot
node bin/adaptive-sdk-cli.js status --ci

# Minimal CI text output
node bin/adaptive-sdk-cli.js status --ci --output text
```

The JSON payload exposes `cli`, `environment`, `runtime`, `git`, `warnings`, and `notes` sections for downstream tooling. When run in verbose mode, human-readable output additionally surfaces Git cleanliness, process uptime, and other helpful cues for troubleshooting.
