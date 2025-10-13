import fs from 'fs/promises';
import path from 'path';
import { createAdaptiveSDK } from '../core/AdaptiveSDK.js';

const DEFAULT_CONFIG_FILES = [
    'adaptive-sdk.config.json',
    'adaptive-sdk.plugins.json'
];

function parseArguments(argv = []) {
    const flags = new Set();
    const values = new Map();
    const positionals = [];

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        if (!arg) {
            continue;
        }
        if (arg === '--') {
            for (let j = index + 1; j < argv.length; j++) {
                positionals.push(argv[j]);
            }
            break;
        }
        if (arg.startsWith('--')) {
            const [flag, rawValue] = arg.split('=', 2);
            if (rawValue !== undefined) {
                values.set(flag.slice(2), rawValue);
                continue;
            }
            const next = argv[index + 1];
            if (next && !next.startsWith('-')) {
                values.set(flag.slice(2), next);
                index += 1;
            } else {
                flags.add(flag.slice(2));
            }
            continue;
        }
        if (arg.startsWith('-') && arg.length > 1) {
            const compact = arg.slice(1);
            if (compact.length > 1) {
                for (const character of compact.slice(0, -1)) {
                    flags.add(character);
                }
                const last = compact.slice(-1);
                const next = argv[index + 1];
                if (next && !next.startsWith('-')) {
                    values.set(last, next);
                    index += 1;
                } else {
                    flags.add(last);
                }
            } else {
                const next = argv[index + 1];
                if (next && !next.startsWith('-')) {
                    values.set(compact, next);
                    index += 1;
                } else {
                    flags.add(compact);
                }
            }
            continue;
        }
        positionals.push(arg);
    }

    return { flags, values, positionals };
}

function createDemoConfig() {
    return {
        environment: {
            mode: 'headless'
        },
        plugins: [
            {
                id: 'demo-greeter',
                name: 'Demo Greeter',
                version: '1.0.0',
                description: 'Sample plugin that exposes onboarding-friendly commands and hooks.',
                tags: ['demo', 'onboarding'],
                capabilities: ['commands', 'hooks'],
                commands: [
                    {
                        name: 'hello',
                        description: 'Send a friendly greeting to showcase static command responses.',
                        response: '👋 Welcome to the Adaptive SDK demo environment!'
                    },
                    {
                        name: 'status',
                        description: 'Summarize the demo telemetry pipeline.',
                        response: 'Telemetry is simulated in demo mode; swap in your provider descriptors when ready.'
                    }
                ],
                hooks: [
                    {
                        event: 'session:start',
                        description: 'Report when a new design session begins.',
                        handler: () => {}
                    }
                ],
                mcpServers: [
                    {
                        id: 'demo-channel',
                        name: 'Demo Channel',
                        description: 'Represents a mocked MCP bridge that can be replaced with a real server.',
                        connect: () => ({ close() {} })
                    }
                ]
            }
        ]
    };
}

async function resolveConfigPath(cwd, providedPath) {
    if (providedPath) {
        return path.resolve(cwd, providedPath);
    }

    for (const candidate of DEFAULT_CONFIG_FILES) {
        const filePath = path.resolve(cwd, candidate);
        try {
            await fs.access(filePath);
            return filePath;
        } catch (error) {
            // ignore and continue searching
        }
    }

    return null;
}

async function loadConfig({ cwd, providedPath, useDemo, stdout, quiet }) {
    if (useDemo) {
        if (!quiet) {
            stdout?.write('⚙️  Using built-in demo configuration.\n');
        }
        return { config: createDemoConfig(), source: 'built-in demo' };
    }

    const resolvedPath = await resolveConfigPath(cwd, providedPath);
    if (!resolvedPath) {
        if (!quiet) {
            stdout?.write('⚙️  No configuration file found. Falling back to built-in demo descriptors.\n');
        }
        return { config: createDemoConfig(), source: 'built-in demo' };
    }

    const raw = await fs.readFile(resolvedPath, 'utf8');
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error(`Failed to parse configuration file at ${resolvedPath}: ${error.message}`);
    }

    if (!quiet) {
        stdout?.write(`⚙️  Loaded configuration from ${resolvedPath}.\n`);
    }
    return { config: parsed, source: resolvedPath };
}

async function ensureDomEnvironment() {
    if (typeof globalThis.window !== 'undefined' && typeof globalThis.document !== 'undefined') {
        return { cleanup: null };
    }

    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.navigator = dom.window.navigator;
    if (typeof globalThis.CustomEvent === 'undefined') {
        globalThis.CustomEvent = dom.window.CustomEvent;
    }

    const cleanup = () => {
        if (globalThis.window === dom.window) {
            dom.window.close();
            delete globalThis.window;
        }
        if (globalThis.document === dom.window.document) {
            delete globalThis.document;
        }
        if (globalThis.navigator === dom.window.navigator) {
            delete globalThis.navigator;
        }
        if (globalThis.CustomEvent === dom.window.CustomEvent) {
            delete globalThis.CustomEvent;
        }
    };

    return { cleanup };
}

function formatList(items) {
    if (!items || items.length === 0) {
        return '—';
    }
    return items.join(', ');
}

function toJson(output, stdout) {
    stdout.write(JSON.stringify(output, null, 2));
    stdout.write('\n');
}

function renderWelcome(stdout) {
    stdout.write('\nAdaptive SDK CLI Onboarding\n');
    stdout.write('=====================================\n');
    stdout.write('This assistant walks you through loading plugin descriptors,\n');
    stdout.write('inspecting ready commands, and mapping next steps for agents.\n\n');
    stdout.write('Get started:\n');
    stdout.write('  • Run `node bin/adaptive-sdk-cli.js init` to scaffold a config checklist.\n');
    stdout.write('  • Run `node bin/adaptive-sdk-cli.js status` to inspect plugin readiness.\n');
    stdout.write('  • Use `--config <path>` to point at your descriptor bundle.\n');
    stdout.write('  • Append `--json` to any command for machine-readable output.\n');
    stdout.write('  • Use `--demo` to explore with a built-in plugin sample.\n\n');
    stdout.write('Popular flows:\n');
    stdout.write('  • `plugins list` — overview of installed plugins, tags, and capabilities.\n');
    stdout.write('  • `plugins info <id>` — deep dive into a specific plugin.\n');
    stdout.write('  • `commands list` — enumerate available slash commands.\n');
    stdout.write('  • `agents list` — review helper agents exposed by plugins.\n');
    stdout.write('  • `hooks list` — confirm hook coverage before wiring automation.\n');
    stdout.write('  • `servers list` — inspect MCP server entry points.\n\n');
    stdout.write('Need full reference? Check DOCS/PLUGINS_QUICKSTART.md for hands-on guides.\n\n');
}

function renderInit(stdout) {
    stdout.write('\nAdaptive SDK CLI — Init Checklist\n');
    stdout.write('=================================\n');
    stdout.write('1. Create a configuration file (adaptive-sdk.config.json) with:\n');
    stdout.write('   • `plugins`: Array of plugin descriptors (id, commands, agents, hooks).\n');
    stdout.write('   • `telemetry`: Optional provider descriptors or bundles.\n');
    stdout.write('   • `environment`: Override defaults (defaults to headless for CLI).\n');
    stdout.write('2. Validate plugin manifests with `node bin/adaptive-sdk-cli.js status --config ./path.json`.\n');
    stdout.write('3. Share the config with your team or agents.\n');
    stdout.write('4. Re-run `plugins list` after runtime registration to verify activation.\n');
    stdout.write('5. Keep tests green with `npm test` to exercise CLI + SDK integration.\n\n');
    stdout.write('Tip: Run with `--demo` to see a working descriptor scaffold you can copy.\n\n');
}

async function withSdk({ configPath, useDemo, stdout, env, quiet }, callback) {
    const cwd = env?.PWD ? path.resolve(env.PWD) : process.cwd();
    const { config, source } = await loadConfig({
        cwd,
        providedPath: configPath,
        useDemo,
        stdout,
        quiet: quiet ?? false
    });

    const { cleanup } = await ensureDomEnvironment();

    const sdkConfig = {
        ...config,
        environment: {
            mode: 'headless',
            ...(config.environment || {})
        }
    };

    const sdk = createAdaptiveSDK(sdkConfig);
    try {
        await sdk.whenPluginsReady();
        return await callback(sdk, { source });
    } finally {
        cleanup?.();
    }
}

async function handleStatus({ stdout, flags, values, env }) {
    const configPath = values.get('config') || values.get('c') || env?.ADAPTIVE_SDK_CONFIG;
    const useDemo = flags.has('demo');
    const quiet = flags.has('json');
    return withSdk({ configPath, useDemo, stdout, env, quiet }, async (sdk, context) => {
        const plugins = sdk.listPlugins({ includeInactive: true });
        const activeCount = plugins.filter(plugin => plugin.status === 'active').length;
        const commands = sdk.listPluginCommands({ includeInactive: true });
        const agents = sdk.listPluginAgents({ includeInactive: true });
        const hooks = sdk.listPluginHooks({ includeInactive: true });
        const servers = sdk.listPluginServers({ includeInactive: true });

        if (flags.has('json')) {
            toJson({
                source: context.source,
                plugins: {
                    total: plugins.length,
                    active: activeCount,
                    inactive: plugins.length - activeCount
                },
                commands: commands.length,
                agents: agents.length,
                hooks: hooks.length,
                servers: servers.length
            }, stdout);
            return 0;
        }

        stdout.write('\nAdaptive SDK Status\n');
        stdout.write('===================\n');
        stdout.write(`Configuration source: ${context.source}\n`);
        stdout.write(`Plugins registered : ${plugins.length} (active: ${activeCount})\n`);
        stdout.write(`Commands available  : ${commands.length}\n`);
        stdout.write(`Agents available    : ${agents.length}\n`);
        stdout.write(`Hooks registered    : ${hooks.length}\n`);
        stdout.write(`MCP servers         : ${servers.length}\n`);
        stdout.write('\nNext steps:\n');
        stdout.write('  • Run `plugins list` to review metadata-rich descriptors.\n');
        stdout.write('  • Use `commands list` to map command availability for your agents.\n');
        stdout.write('  • Attach to readiness helpers in code with `sdk.whenPluginReady(...)`.\n\n');
        return 0;
    });
}

async function handlePlugins({ stdout, flags, values, positionals, env }) {
    const subcommand = positionals.shift() || 'list';
    const configPath = values.get('config') || values.get('c') || env?.ADAPTIVE_SDK_CONFIG;
    const useDemo = flags.has('demo');

    const quiet = flags.has('json');
    return withSdk({ configPath, useDemo, stdout, env, quiet }, async (sdk, context) => {
        if (subcommand === 'list') {
            const plugins = sdk.listPlugins({ includeInactive: true });
            if (flags.has('json')) {
                toJson({ source: context.source, plugins }, stdout);
                return 0;
            }
            stdout.write('\nRegistered Plugins\n');
            stdout.write('===================\n');
            for (const plugin of plugins) {
                stdout.write(`- [${plugin.status}] ${plugin.id}`);
                if (plugin.name && plugin.name !== plugin.id) {
                    stdout.write(` — ${plugin.name}`);
                }
                stdout.write('\n');
                if (plugin.description) {
                    stdout.write(`    ${plugin.description}\n`);
                }
                if (plugin.tags?.length) {
                    stdout.write(`    tags         : ${formatList(plugin.tags)}\n`);
                }
                if (plugin.capabilities?.length) {
                    stdout.write(`    capabilities : ${formatList(plugin.capabilities)}\n`);
                }
            }
            if (plugins.length === 0) {
                stdout.write('No plugins registered yet. Use `--config` or `--demo` to load descriptors.\n');
            }
            stdout.write('\n');
            return 0;
        }

        if (subcommand === 'info') {
            const pluginId = positionals.shift();
            if (!pluginId) {
                throw new Error('Plugin id is required for `plugins info`.');
            }
            const plugin = sdk.getPlugin(pluginId);
            if (!plugin) {
                throw new Error(`Plugin "${pluginId}" is not registered.`);
            }
            const commands = sdk.listPluginCommands({ includeInactive: true }).filter(entry => entry.pluginId === pluginId);
            const agents = sdk.listPluginAgents({ includeInactive: true }).filter(entry => entry.pluginId === pluginId);
            const hooks = sdk.listPluginHooks({ includeInactive: true }).filter(entry => entry.pluginId === pluginId);
            const servers = sdk.listPluginServers({ includeInactive: true }).filter(entry => entry.pluginId === pluginId);

            const summary = {
                source: context.source,
                plugin,
                commands,
                agents,
                hooks,
                servers
            };

            if (flags.has('json')) {
                toJson(summary, stdout);
                return 0;
            }

            stdout.write(`\nPlugin: ${plugin.id}\n`);
            stdout.write('====================\n');
            stdout.write(`Name        : ${plugin.name}\n`);
            stdout.write(`Version     : ${plugin.version}\n`);
            stdout.write(`Status      : ${plugin.status}\n`);
            stdout.write(`Source      : ${plugin.source}\n`);
            stdout.write(`Registered  : ${plugin.registrationSource}\n`);
            stdout.write(`Tags        : ${formatList(plugin.tags || [])}\n`);
            stdout.write(`Capabilities: ${formatList(plugin.capabilities || [])}\n`);
            if (plugin.description) {
                stdout.write(`\n${plugin.description}\n`);
            }
            if (commands.length) {
                stdout.write('\nCommands:\n');
                for (const command of commands) {
                    stdout.write(`  • ${command.name}`);
                    if (command.description) {
                        stdout.write(` — ${command.description}`);
                    }
                    stdout.write('\n');
                }
            }
            if (agents.length) {
                stdout.write('\nAgents:\n');
                for (const agent of agents) {
                    stdout.write(`  • ${agent.name}`);
                    if (agent.description) {
                        stdout.write(` — ${agent.description}`);
                    }
                    stdout.write('\n');
                }
            }
            if (hooks.length) {
                stdout.write('\nHooks:\n');
                for (const hook of hooks) {
                    stdout.write(`  • ${hook.event} (${hook.count} handler${hook.count === 1 ? '' : 's'})\n`);
                }
            }
            if (servers.length) {
                stdout.write('\nMCP Servers:\n');
                for (const server of servers) {
                    stdout.write(`  • ${server.id}`);
                    if (server.description) {
                        stdout.write(` — ${server.description}`);
                    }
                    stdout.write('\n');
                }
            }
            stdout.write('\n');
            return 0;
        }

        throw new Error(`Unknown plugins subcommand: ${subcommand}`);
    });
}

async function handleCommands({ stdout, flags, values, env }) {
    const configPath = values.get('config') || values.get('c') || env?.ADAPTIVE_SDK_CONFIG;
    const useDemo = flags.has('demo');

    const quiet = flags.has('json');
    return withSdk({ configPath, useDemo, stdout, env, quiet }, async (sdk, context) => {
        const commands = sdk.listPluginCommands({ includeInactive: true });
        if (flags.has('json')) {
            toJson({ source: context.source, commands }, stdout);
            return 0;
        }
        stdout.write('\nPlugin Commands\n');
        stdout.write('================\n');
        for (const command of commands) {
            stdout.write(`- ${command.name} (plugin: ${command.pluginId})`);
            if (command.description) {
                stdout.write(` — ${command.description}`);
            }
            stdout.write('\n');
        }
        if (commands.length === 0) {
            stdout.write('No commands registered. Add descriptors with `commands` definitions.\n');
        }
        stdout.write('\n');
        return 0;
    });
}

async function handleAgents({ stdout, flags, values, env }) {
    const configPath = values.get('config') || values.get('c') || env?.ADAPTIVE_SDK_CONFIG;
    const useDemo = flags.has('demo');

    const quiet = flags.has('json');
    return withSdk({ configPath, useDemo, stdout, env, quiet }, async (sdk, context) => {
        const agents = sdk.listPluginAgents({ includeInactive: true });
        if (flags.has('json')) {
            toJson({ source: context.source, agents }, stdout);
            return 0;
        }
        stdout.write('\nPlugin Agents\n');
        stdout.write('==============\n');
        for (const agent of agents) {
            stdout.write(`- ${agent.name} (plugin: ${agent.pluginId})`);
            if (agent.description) {
                stdout.write(` — ${agent.description}`);
            }
            stdout.write('\n');
        }
        if (agents.length === 0) {
            stdout.write('No agents registered yet. Use plugin descriptors with `agents` entries.\n');
        }
        stdout.write('\n');
        return 0;
    });
}

async function handleHooks({ stdout, flags, values, env }) {
    const configPath = values.get('config') || values.get('c') || env?.ADAPTIVE_SDK_CONFIG;
    const useDemo = flags.has('demo');

    const quiet = flags.has('json');
    return withSdk({ configPath, useDemo, stdout, env, quiet }, async (sdk, context) => {
        const hooks = sdk.listPluginHooks({ includeInactive: true });
        if (flags.has('json')) {
            toJson({ source: context.source, hooks }, stdout);
            return 0;
        }
        stdout.write('\nPlugin Hooks\n');
        stdout.write('============\n');
        for (const hook of hooks) {
            stdout.write(`- ${hook.event} (plugin: ${hook.pluginId}, handlers: ${hook.count})\n`);
        }
        if (hooks.length === 0) {
            stdout.write('No hooks registered. Add hook descriptors to your plugins.\n');
        }
        stdout.write('\n');
        return 0;
    });
}

async function handleServers({ stdout, flags, values, env }) {
    const configPath = values.get('config') || values.get('c') || env?.ADAPTIVE_SDK_CONFIG;
    const useDemo = flags.has('demo');

    return withSdk({ configPath, useDemo, stdout, env }, async (sdk, context) => {
        const servers = sdk.listPluginServers({ includeInactive: true });
        if (flags.has('json')) {
            toJson({ source: context.source, servers }, stdout);
            return 0;
        }
        stdout.write('\nPlugin MCP Servers\n');
        stdout.write('===================\n');
        for (const server of servers) {
            stdout.write(`- ${server.id} (plugin: ${server.pluginId})`);
            if (server.description) {
                stdout.write(` — ${server.description}`);
            }
            stdout.write('\n');
        }
        if (servers.length === 0) {
            stdout.write('No MCP servers registered. Provide `mcpServers` in plugin descriptors.\n');
        }
        stdout.write('\n');
        return 0;
    });
}

async function handleCheck({ stdout, flags, values, env }) {
    const configPath = values.get('config') || values.get('c') || env?.ADAPTIVE_SDK_CONFIG;
    const useDemo = flags.has('demo');
    const quiet = flags.has('json');

    return withSdk({ configPath, useDemo, stdout, env, quiet }, async (sdk, context) => {
        const diagnostics = sdk.diagnosePlugins({ includeInactive: true });
        const totals = { error: 0, warning: 0, info: 0 };
        for (const result of diagnostics) {
            for (const issue of result.issues) {
                if (issue.severity === 'error') {
                    totals.error += 1;
                } else if (issue.severity === 'warning') {
                    totals.warning += 1;
                } else {
                    totals.info += 1;
                }
            }
        }

        if (flags.has('json')) {
            toJson({ source: context.source, totals, diagnostics }, stdout);
            return totals.error > 0 ? 1 : 0;
        }

        stdout.write('\nPlugin Diagnostics\n');
        stdout.write('===================\n');
        stdout.write(`Configuration source: ${context.source}\n`);
        if (diagnostics.length === 0) {
            stdout.write('No plugins registered. Supply descriptors with `--config` or use `--demo`.\n');
            return 0;
        }

        for (const result of diagnostics) {
            const { plugin, issues } = result;
            if (!issues.length) {
                stdout.write(`✅ ${plugin.id} — no issues detected (status: ${plugin.status}).\n`);
                continue;
            }
            const indicator = result.severity === 'error' ? '❌' : result.severity === 'warning' ? '⚠️ ' : 'ℹ️ ';
            stdout.write(`${indicator}${plugin.id} (status: ${plugin.status}) — ${issues.length} issue${issues.length === 1 ? '' : 's'}\n`);
            for (const issue of issues) {
                const icon = issue.severity === 'error' ? '   ❌ ' : issue.severity === 'warning' ? '   ⚠️  ' : '   ℹ️  ';
                stdout.write(`${icon}[${issue.code}] ${issue.message}\n`);
                if (issue.suggestion) {
                    stdout.write(`       ↳ Suggestion: ${issue.suggestion}\n`);
                }
            }
        }

        const totalIssues = totals.error + totals.warning + totals.info;
        if (totalIssues === 0) {
            stdout.write('\nAll plugins look great! ✨\n\n');
        } else {
            stdout.write('\nSummary:\n');
            stdout.write(`  • Errors  : ${totals.error}\n`);
            stdout.write(`  • Warnings: ${totals.warning}\n`);
            stdout.write(`  • Info    : ${totals.info}\n\n`);
            stdout.write('Use `--json` for machine-readable reports or rerun after addressing the suggestions.\n\n');
        }

        return totals.error > 0 ? 1 : 0;
    });
}

export async function runAdaptiveSdkCli(options = {}) {
    const argv = Array.isArray(options.argv) ? [...options.argv] : process.argv.slice(2);
    const stdout = options.stdout || process.stdout;
    const stderr = options.stderr || process.stderr;
    const env = options.env || process.env;

    const { flags, values, positionals } = parseArguments(argv);

    if (flags.has('help') || flags.has('h')) {
        renderWelcome(stdout);
        return 0;
    }

    const command = (positionals.shift() || 'welcome').toLowerCase();

    try {
        switch (command) {
            case 'welcome':
            case 'help':
                renderWelcome(stdout);
                return 0;
            case 'init':
                renderInit(stdout);
                return 0;
            case 'status':
                return await handleStatus({ stdout, flags, values, env });
            case 'plugins':
                return await handlePlugins({ stdout, flags, values, positionals, env });
            case 'commands':
                return await handleCommands({ stdout, flags, values, env });
            case 'agents':
                return await handleAgents({ stdout, flags, values, env });
            case 'hooks':
                return await handleHooks({ stdout, flags, values, env });
            case 'servers':
                return await handleServers({ stdout, flags, values, env });
            case 'check':
            case 'diagnostics':
                return await handleCheck({ stdout, flags, values, env });
            default:
                throw new Error(`Unknown command: ${command}`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stderr.write(`Error: ${message}\n`);
        if (options.exitOnError !== false) {
            return 1;
        }
        return 1;
    }
}

export async function main(argv = process.argv.slice(2)) {
    const exitCode = await runAdaptiveSdkCli({ argv });
    if (typeof process !== 'undefined') {
        process.exitCode = exitCode;
    }
    return exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
