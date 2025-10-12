import { RemoteLicenseAttestor } from '../../product/licensing/RemoteLicenseAttestor.js';

function normalizeStringList(value) {
    if (!value) {
        return [];
    }
    const result = [];
    const append = (entry) => {
        if (typeof entry === 'string') {
            const trimmed = entry.trim();
            if (trimmed) {
                result.push(trimmed);
            }
        } else if (typeof entry === 'number' || typeof entry === 'boolean') {
            result.push(String(entry));
        }
    };
    if (Array.isArray(value)) {
        for (const entry of value) {
            append(entry);
        }
    } else if (value instanceof Set) {
        for (const entry of value.values()) {
            append(entry);
        }
    } else if (typeof value === 'object') {
        for (const [key, enabled] of Object.entries(value)) {
            if (enabled) {
                append(key);
            }
        }
    } else {
        append(value);
    }
    return Array.from(new Set(result));
}

function normalizeCommandEntry(entry, fallbackName) {
    if (!entry) {
        return null;
    }
    if (entry.disabled) {
        return null;
    }
    let name = fallbackName || null;
    let description = '';
    let metadata = {};
    let handler = entry;

    if (typeof entry === 'object' && !(entry instanceof Function)) {
        name = entry.name || entry.id || name || null;
        description = entry.description || entry.summary || '';
        metadata = { ...(entry.metadata || {}) };
        handler = entry.handler || entry.run || entry.execute || entry.invoke || entry.fn || entry;
        if (typeof handler === 'string') {
            const response = handler;
            handler = () => response;
        }
        if (typeof handler === 'object' && handler !== null) {
            if (typeof handler.handle === 'function') {
                handler = handler.handle.bind(handler);
            } else if (typeof handler.run === 'function') {
                handler = handler.run.bind(handler);
            } else if (typeof handler.execute === 'function') {
                handler = handler.execute.bind(handler);
            }
        }
    } else if (typeof entry === 'string') {
        const response = entry;
        handler = () => response;
    }

    if (typeof entry === 'function') {
        handler = entry;
        name = entry.name || name;
    }

    if (typeof handler !== 'function') {
        return null;
    }

    if (!name) {
        throw new Error('Plugin command is missing a name.');
    }

    return { name, description, handler, metadata };
}

function normalizeAgentEntry(entry, fallbackName) {
    if (!entry) {
        return null;
    }
    if (entry.disabled) {
        return null;
    }
    let name = fallbackName || null;
    let description = '';
    let metadata = {};
    let factory = entry;

    if (typeof entry === 'object' && !(entry instanceof Function)) {
        name = entry.name || entry.id || name || null;
        description = entry.description || entry.summary || '';
        metadata = { ...(entry.metadata || {}) };
        factory = entry.create || entry.factory || entry.instantiate || entry.build || entry;
        if (typeof factory === 'object' && factory !== null) {
            if (typeof factory.create === 'function') {
                factory = factory.create.bind(factory);
            } else if (typeof factory.build === 'function') {
                factory = factory.build.bind(factory);
            }
        }
    }

    if (typeof entry === 'function') {
        factory = entry;
        name = entry.name || name;
    }

    if (typeof factory !== 'function') {
        return null;
    }

    if (!name) {
        throw new Error('Plugin agent is missing a name.');
    }

    return { name, description, factory, metadata };
}

function normalizeHookEntry(entry, fallbackEvent) {
    if (!entry) {
        return null;
    }
    if (entry.disabled) {
        return null;
    }
    let event = fallbackEvent || null;
    let metadata = {};
    let handler = entry;
    let once = false;

    if (typeof entry === 'object' && !(entry instanceof Function)) {
        event = entry.event || entry.name || event || null;
        metadata = { ...(entry.metadata || {}) };
        handler = entry.handler || entry.run || entry.execute || entry.invoke || entry.fn || entry;
        once = Boolean(entry.once);
        if (typeof handler === 'object' && handler !== null) {
            if (typeof handler.handle === 'function') {
                handler = handler.handle.bind(handler);
            } else if (typeof handler.run === 'function') {
                handler = handler.run.bind(handler);
            } else if (typeof handler.execute === 'function') {
                handler = handler.execute.bind(handler);
            }
        }
    }

    if (typeof entry === 'function') {
        handler = entry;
        event = entry.name || event;
    }

    if (typeof handler !== 'function') {
        return null;
    }

    if (!event) {
        throw new Error('Plugin hook is missing an event name.');
    }

    return { event, handler, metadata, once };
}

function normalizeServerEntry(entry, fallbackName) {
    if (!entry) {
        return null;
    }
    if (entry.disabled) {
        return null;
    }
    let name = fallbackName || null;
    let description = '';
    let metadata = {};
    let factory = entry;

    if (typeof entry === 'object' && !(entry instanceof Function)) {
        name = entry.name || entry.id || name || null;
        description = entry.description || entry.summary || '';
        metadata = { ...(entry.metadata || {}) };
        factory = entry.create || entry.factory || entry.instantiate || entry.start || entry;
        if (typeof factory === 'object' && factory !== null) {
            if (typeof factory.create === 'function') {
                factory = factory.create.bind(factory);
            } else if (typeof factory.start === 'function') {
                factory = factory.start.bind(factory);
            }
        }
    }

    if (typeof entry === 'function') {
        factory = entry;
        name = entry.name || name;
    }

    if (typeof factory !== 'function') {
        return null;
    }

    if (!name) {
        throw new Error('Plugin MCP/server entry is missing a name.');
    }

    return { name, description, factory, metadata };
}

function normalizeCommandCollection(commands) {
    if (!commands) {
        return [];
    }
    const list = [];
    if (Array.isArray(commands)) {
        for (const entry of commands) {
            const command = normalizeCommandEntry(entry);
            if (command) {
                list.push(command);
            }
        }
    } else if (typeof commands === 'object') {
        for (const [key, entry] of Object.entries(commands)) {
            const command = normalizeCommandEntry(entry, key);
            if (command) {
                list.push(command);
            }
        }
    } else {
        const command = normalizeCommandEntry(commands);
        if (command) {
            list.push(command);
        }
    }
    return list;
}

function normalizeAgentCollection(agents) {
    if (!agents) {
        return [];
    }
    const list = [];
    if (Array.isArray(agents)) {
        for (const entry of agents) {
            const agent = normalizeAgentEntry(entry);
            if (agent) {
                list.push(agent);
            }
        }
    } else if (typeof agents === 'object') {
        for (const [key, entry] of Object.entries(agents)) {
            const agent = normalizeAgentEntry(entry, key);
            if (agent) {
                list.push(agent);
            }
        }
    } else {
        const agent = normalizeAgentEntry(agents);
        if (agent) {
            list.push(agent);
        }
    }
    return list;
}

function normalizeHookCollection(hooks) {
    if (!hooks) {
        return [];
    }
    const list = [];
    if (Array.isArray(hooks)) {
        for (const entry of hooks) {
            const hook = normalizeHookEntry(entry);
            if (hook) {
                list.push(hook);
            }
        }
    } else if (typeof hooks === 'object') {
        for (const [key, entry] of Object.entries(hooks)) {
            const hook = normalizeHookEntry(entry, key);
            if (hook) {
                list.push(hook);
            }
        }
    } else {
        const hook = normalizeHookEntry(hooks);
        if (hook) {
            list.push(hook);
        }
    }
    return list;
}

function normalizeServerCollection(servers) {
    if (!servers) {
        return [];
    }
    const list = [];
    if (Array.isArray(servers)) {
        for (const entry of servers) {
            const server = normalizeServerEntry(entry);
            if (server) {
                list.push(server);
            }
        }
    } else if (typeof servers === 'object') {
        for (const [key, entry] of Object.entries(servers)) {
            const server = normalizeServerEntry(entry, key);
            if (server) {
                list.push(server);
            }
        }
    } else {
        const server = normalizeServerEntry(servers);
        if (server) {
            list.push(server);
        }
    }
    return list;
}

function matchesPluginSelector(pluginRecord, selector) {
    if (!selector) {
        return true;
    }
    if (typeof selector === 'function') {
        try {
            return Boolean(selector(pluginRecord));
        } catch (error) {
            console.warn('[AdaptiveSDK] Plugin selector threw an error', error);
            return false;
        }
    }
    if (typeof selector === 'string') {
        return pluginRecord.manifest.name === selector || pluginRecord.manifest.id === selector;
    }
    if (Array.isArray(selector)) {
        return selector.includes(pluginRecord.manifest.name) || selector.includes(pluginRecord.manifest.id);
    }
    if (typeof selector === 'object') {
        if (selector.name && selector.name !== pluginRecord.manifest.name && selector.name !== pluginRecord.manifest.id) {
            return false;
        }
        if (selector.marketplace && selector.marketplace !== pluginRecord.metadata.marketplace) {
            return false;
        }
        if (selector.source && selector.source !== pluginRecord.metadata.source) {
            return false;
        }
        if (selector.tags) {
            const targetTags = normalizeStringList(selector.tags);
            if (targetTags.length > 0) {
                const pluginTags = pluginRecord.manifest.tags || [];
                for (const tag of targetTags) {
                    if (!pluginTags.includes(tag)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    return false;
}

function createPluginFactoryContext(meta, getSdk, { engine, telemetry, licenseManager }) {
    return {
        metadata: {
            source: meta.source || 'runtime',
            marketplace: meta.marketplace || null,
            installSource: meta.installSource || meta.source || 'runtime'
        },
        engine,
        telemetry,
        licenseManager,
        get sdk() {
            const sdk = getSdk();
            if (!sdk) {
                throw new Error('Adaptive SDK is not ready yet.');
            }
            return sdk;
        }
    };
}

function createPluginLifecycleContext(pluginRecord, getSdk, base) {
    const sdk = getSdk();
    if (!sdk) {
        throw new Error('Adaptive SDK is not ready yet.');
    }
    return {
        sdk,
        engine: base.engine,
        telemetry: base.telemetry,
        licenseManager: base.licenseManager,
        manifest: pluginRecord.manifest,
        metadata: pluginRecord.metadata,
        plugin: pluginRecord,
        commands: pluginRecord.commands,
        agents: pluginRecord.agents,
        hooks: pluginRecord.hooks,
        servers: pluginRecord.servers,
        exports: pluginRecord.exports
    };
}

function createPluginHandlerContext(pluginRecord, getSdk, base, extension = {}) {
    return {
        ...createPluginLifecycleContext(pluginRecord, getSdk, base),
        ...extension
    };
}

function finalizePluginDescriptor(descriptor, meta, getSdk, baseContext) {
    if (!descriptor) {
        throw new Error('Invalid plugin descriptor.');
    }
    if (descriptor instanceof RemoteLicenseAttestor) {
        throw new Error('License attestors cannot be registered as plugins.');
    }
    if (typeof descriptor === 'function') {
        descriptor = { setup: descriptor };
    }
    if (typeof descriptor !== 'object') {
        throw new Error('Plugin descriptor must be an object or factory result.');
    }

    const manifestSource = (descriptor.manifest && typeof descriptor.manifest === 'object') ? descriptor.manifest : descriptor;
    const name = manifestSource.name || manifestSource.id || meta.fallbackName;
    if (!name) {
        throw new Error('Plugin descriptor is missing a name.');
    }

    const manifest = {
        id: manifestSource.id || name,
        name,
        version: manifestSource.version || '0.0.0',
        description: manifestSource.description || descriptor.description || '',
        author: manifestSource.author || descriptor.author || null,
        homepage: manifestSource.homepage || descriptor.homepage || null,
        tags: normalizeStringList(manifestSource.tags || descriptor.tags)
    };

    const commands = normalizeCommandCollection(descriptor.commands || manifestSource.commands);
    const agents = normalizeAgentCollection(descriptor.agents || manifestSource.agents);
    const hooks = normalizeHookCollection(descriptor.hooks || manifestSource.hooks);
    const servers = normalizeServerCollection(
        descriptor.mcpServers || descriptor.servers || manifestSource.mcpServers || manifestSource.servers
    );

    const exports = descriptor.exports || descriptor.api || descriptor.runtime || null;
    const dispose = typeof descriptor.dispose === 'function' ? descriptor.dispose.bind(descriptor) : null;
    const setup = typeof descriptor.setup === 'function' ? descriptor.setup.bind(descriptor) : null;

    const combinedTags = normalizeStringList([...(manifest.tags || []), ...(normalizeStringList(meta.tags || []))]);
    manifest.tags = combinedTags;

    const metadata = {
        source: meta.source || 'runtime',
        marketplace: meta.marketplace || null,
        installSource: meta.installSource || meta.source || 'runtime',
        registeredAt: new Date().toISOString(),
        tags: combinedTags,
        notes: descriptor.notes || meta.notes || null,
        descriptorMetadata: descriptor.metadata || {},
        marketplaceEntry: meta.marketplaceEntry || null
    };

    const pluginRecord = {
        manifest,
        metadata,
        commands: new Map(),
        agents: new Map(),
        hooks: new Map(),
        servers: new Map(),
        exports,
        dispose,
        setup,
        descriptor
    };

    for (const command of commands) {
        const record = {
            ...command,
            plugin: pluginRecord,
            manifest,
            metadata: {
                ...command.metadata,
                source: metadata.source,
                marketplace: metadata.marketplace
            }
        };
        pluginRecord.commands.set(record.name, record);
    }

    for (const agent of agents) {
        const record = {
            ...agent,
            plugin: pluginRecord,
            manifest,
            metadata: {
                ...agent.metadata,
                source: metadata.source,
                marketplace: metadata.marketplace
            }
        };
        pluginRecord.agents.set(record.name, record);
    }

    for (const hook of hooks) {
        const record = {
            ...hook,
            plugin: pluginRecord,
            manifest,
            metadata: {
                ...hook.metadata,
                source: metadata.source,
                marketplace: metadata.marketplace
            }
        };
        if (!pluginRecord.hooks.has(record.event)) {
            pluginRecord.hooks.set(record.event, new Set());
        }
        pluginRecord.hooks.get(record.event).add(record);
    }

    for (const server of servers) {
        const record = {
            ...server,
            plugin: pluginRecord,
            manifest,
            metadata: {
                ...server.metadata,
                source: metadata.source,
                marketplace: metadata.marketplace
            }
        };
        pluginRecord.servers.set(record.name, record);
    }

    if (setup) {
        try {
            const context = createPluginLifecycleContext(pluginRecord, getSdk, baseContext);
            const result = setup(context);
            if (result && typeof result.then === 'function') {
                result.catch((error) => {
                    console.warn(`[AdaptiveSDK] Plugin setup failed for "${manifest.name}"`, error);
                });
            }
        } catch (error) {
            console.warn(`[AdaptiveSDK] Plugin setup failed for "${manifest.name}"`, error);
        }
    }

    return pluginRecord;
}

function instantiatePluginEntry(entry, meta, getSdk, baseContext) {
    try {
        let descriptor = entry;
        if (descriptor && typeof descriptor === 'function') {
            const context = createPluginFactoryContext(meta, getSdk, baseContext);
            descriptor = descriptor(context);
        } else if (descriptor && typeof descriptor === 'object' && typeof descriptor.factory === 'function') {
            const context = createPluginFactoryContext(meta, getSdk, baseContext);
            descriptor = descriptor.factory(context);
        }
        if (descriptor && typeof descriptor.then === 'function') {
            return descriptor.then((resolved) => finalizePluginDescriptor(resolved, meta, getSdk, baseContext));
        }
        return Promise.resolve(finalizePluginDescriptor(descriptor, meta, getSdk, baseContext));
    } catch (error) {
        return Promise.reject(error);
    }
}

function normalizeMarketplacePluginEntry(entry, fallbackName) {
    if (!entry) {
        return null;
    }
    const name = entry.name || entry.id || fallbackName;
    if (!name) {
        throw new Error('Marketplace plugin entry is missing a name.');
    }
    return {
        name,
        description: entry.description || '',
        version: entry.version || null,
        source: entry.source || entry.repository || null,
        tags: normalizeStringList(entry.tags),
        metadata: entry.metadata || {},
        autoInstall: Boolean(entry.autoInstall),
        plugin: entry.plugin || entry.descriptor || null,
        loader: entry.loader || entry.load || null
    };
}

function finalizeMarketplaceDescriptor(descriptor, fallbackName) {
    if (!descriptor) {
        throw new Error('Invalid marketplace descriptor.');
    }
    if (typeof descriptor === 'function') {
        descriptor = descriptor();
    }
    if (descriptor && typeof descriptor.then === 'function') {
        throw new Error('Async marketplace factories are not supported directly.');
    }
    if (typeof descriptor !== 'object') {
        throw new Error('Marketplace descriptor must be an object.');
    }

    const name = descriptor.name || descriptor.id || fallbackName;
    if (!name) {
        throw new Error('Marketplace descriptor is missing a name.');
    }

    const record = {
        name,
        description: descriptor.description || '',
        owner: descriptor.owner || null,
        source: descriptor.source || descriptor.repository || null,
        plugins: new Map(),
        metadata: descriptor.metadata || {}
    };

    const entries = descriptor.plugins || {};
    if (Array.isArray(entries)) {
        for (const entry of entries) {
            const normalized = normalizeMarketplacePluginEntry(entry);
            if (normalized) {
                record.plugins.set(normalized.name, normalized);
            }
        }
    } else if (typeof entries === 'object') {
        for (const [key, entry] of Object.entries(entries)) {
            const normalized = normalizeMarketplacePluginEntry(entry, key);
            if (normalized) {
                record.plugins.set(normalized.name, normalized);
            }
        }
    }

    return record;
}

export function createPluginManager(baseContext) {
    const { engine, telemetry, licenseManager, getSdk } = baseContext;

    const pluginsByName = new Map();
    const commandIndex = new Map();
    const agentIndex = new Map();
    const hookIndex = new Map();
    const serverIndex = new Map();
    const watchers = new Set();
    const waiters = new Set();
    const pendingRegistrations = new Set();
    const marketplacesByName = new Map();

    const trackPromise = (promise) => {
        pendingRegistrations.add(promise);
        promise.finally(() => {
            pendingRegistrations.delete(promise);
        });
        return promise;
    };

    const notifyWatchers = (event) => {
        for (const watcher of watchers) {
            try {
                watcher(event);
            } catch (error) {
                console.warn('[AdaptiveSDK] Plugin watcher failed', error);
            }
        }
    };

    const fulfillWaiters = (pluginRecord) => {
        for (const waiter of Array.from(waiters)) {
            if (matchesPluginSelector(pluginRecord, waiter.selector)) {
                waiters.delete(waiter);
                if (waiter.abortHandler && waiter.signal) {
                    waiter.signal.removeEventListener('abort', waiter.abortHandler);
                }
                waiter.resolve(pluginRecord);
            }
        }
    };

    const indexPlugin = (pluginRecord) => {
        for (const command of pluginRecord.commands.values()) {
            commandIndex.set(command.name, command);
        }
        for (const agent of pluginRecord.agents.values()) {
            agentIndex.set(agent.name, agent);
        }
        for (const [event, entries] of pluginRecord.hooks.entries()) {
            if (!hookIndex.has(event)) {
                hookIndex.set(event, new Set());
            }
            for (const hook of entries) {
                hookIndex.get(event).add(hook);
            }
        }
        for (const server of pluginRecord.servers.values()) {
            serverIndex.set(server.name, server);
        }
    };

    const unindexPlugin = (pluginRecord) => {
        for (const command of pluginRecord.commands.values()) {
            if (commandIndex.get(command.name)?.plugin === pluginRecord) {
                commandIndex.delete(command.name);
            }
        }
        for (const agent of pluginRecord.agents.values()) {
            if (agentIndex.get(agent.name)?.plugin === pluginRecord) {
                agentIndex.delete(agent.name);
            }
        }
        for (const [event, hooks] of pluginRecord.hooks.entries()) {
            const registry = hookIndex.get(event);
            if (registry) {
                for (const hook of hooks) {
                    if (registry.has(hook)) {
                        registry.delete(hook);
                    }
                }
                if (registry.size === 0) {
                    hookIndex.delete(event);
                }
            }
        }
        for (const server of pluginRecord.servers.values()) {
            if (serverIndex.get(server.name)?.plugin === pluginRecord) {
                serverIndex.delete(server.name);
            }
        }
    };

    const registerPlugin = (entry, options = {}) => {
        const meta = {
            source: options.source || 'runtime',
            marketplace: options.marketplace || null,
            installSource: options.installSource || options.source || 'runtime',
            notes: options.notes || null,
            tags: normalizeStringList(options.tags),
            fallbackName: options.name || options.fallbackName || null,
            marketplaceEntry: options.marketplaceEntry || null
        };
        const promise = instantiatePluginEntry(entry, meta, getSdk, { engine, telemetry, licenseManager })
            .then((pluginRecord) => {
                const existing = pluginsByName.get(pluginRecord.manifest.name);
                if (existing) {
                    if (!options.replace && !options.overwrite) {
                        throw new Error(`Plugin "${pluginRecord.manifest.name}" is already registered.`);
                    }
                    unregisterPlugin(pluginRecord.manifest.name, { reason: 'replace', suppressWatcher: true });
                }
                pluginsByName.set(pluginRecord.manifest.name, pluginRecord);
                indexPlugin(pluginRecord);
                notifyWatchers({
                    type: existing ? 'replaced' : 'registered',
                    plugin: pluginRecord,
                    manifest: pluginRecord.manifest,
                    metadata: pluginRecord.metadata,
                    replaced: Boolean(existing)
                });
                fulfillWaiters(pluginRecord);
                return pluginRecord;
            })
            .catch((error) => {
                console.warn('[AdaptiveSDK] Failed to register plugin', error);
                throw error;
            });
        return trackPromise(promise);
    };

    const registerPlugins = (entries, options = {}) => {
        const list = Array.isArray(entries) ? entries : [entries];
        return trackPromise(Promise.all(list.map((entry) => registerPlugin(entry, options))));
    };

    const unregisterPlugin = (name, options = {}) => {
        const pluginRecord = pluginsByName.get(name);
        if (!pluginRecord) {
            return false;
        }
        pluginsByName.delete(name);
        unindexPlugin(pluginRecord);
        if (typeof pluginRecord.dispose === 'function') {
            try {
                const context = createPluginLifecycleContext(pluginRecord, getSdk, { engine, telemetry, licenseManager });
                const result = pluginRecord.dispose(context, options.reason);
                if (result && typeof result.then === 'function') {
                    result.catch((error) => {
                        console.warn(`[AdaptiveSDK] Plugin dispose failed for "${name}"`, error);
                    });
                }
            } catch (error) {
                console.warn(`[AdaptiveSDK] Plugin dispose failed for "${name}"`, error);
            }
        }
        if (!options.suppressWatcher) {
            notifyWatchers({
                type: 'unregistered',
                plugin: pluginRecord,
                manifest: pluginRecord.manifest,
                metadata: pluginRecord.metadata,
                reason: options.reason || null
            });
        }
        return true;
    };

    const getPlugin = (name) => pluginsByName.get(name) || null;
    const listPlugins = () => Array.from(pluginsByName.values());

    const watchPlugins = (listener, options = {}) => {
        if (typeof listener !== 'function') {
            throw new Error('Plugin watcher must be a function.');
        }
        watchers.add(listener);
        if (options.includeExisting !== false) {
            for (const pluginRecord of pluginsByName.values()) {
                try {
                    listener({
                        type: 'registered',
                        plugin: pluginRecord,
                        manifest: pluginRecord.manifest,
                        metadata: pluginRecord.metadata,
                        replay: true
                    });
                } catch (error) {
                    console.warn('[AdaptiveSDK] Plugin watcher failed during replay', error);
                }
            }
        }
        return () => {
            watchers.delete(listener);
        };
    };

    const whenPluginRegistered = (selector, options = {}) => {
        for (const pluginRecord of pluginsByName.values()) {
            if (matchesPluginSelector(pluginRecord, selector)) {
                return Promise.resolve(pluginRecord);
            }
        }
        if (options?.signal?.aborted) {
            return Promise.reject(options.signal.reason || new Error('Plugin wait aborted.'));
        }
        return new Promise((resolve, reject) => {
            const waiter = {
                selector,
                resolve,
                reject,
                signal: options?.signal,
                abortHandler: null
            };
            if (options?.signal) {
                waiter.abortHandler = () => {
                    waiters.delete(waiter);
                    reject(options.signal.reason || new Error('Plugin wait aborted.'));
                };
                options.signal.addEventListener('abort', waiter.abortHandler);
            }
            waiters.add(waiter);
        });
    };

    const whenPluginsReady = () => {
        if (pendingRegistrations.size === 0) {
            return Promise.resolve();
        }
        return Promise.allSettled(Array.from(pendingRegistrations)).then(() => undefined);
    };

    const listCommands = (selector) => {
        const commands = Array.from(commandIndex.values());
        if (!selector) {
            return commands;
        }
        if (typeof selector === 'function') {
            return commands.filter((command) => {
                try {
                    return Boolean(selector(command));
                } catch (error) {
                    console.warn('[AdaptiveSDK] Command selector failed', error);
                    return false;
                }
            });
        }
        return commands.filter((command) => matchesPluginSelector(command.plugin, selector));
    };

    const getCommand = (name) => commandIndex.get(name) || null;

    const invokeCommand = async (name, payload, options = {}) => {
        const command = commandIndex.get(name);
        if (!command) {
            throw new Error(`Plugin command "${name}" is not registered.`);
        }
        const context = createPluginHandlerContext(command.plugin, getSdk, { engine, telemetry, licenseManager }, {
            command,
            payload,
            options
        });
        return command.handler(context, payload, options);
    };

    const listAgents = (selector) => {
        const agents = Array.from(agentIndex.values());
        if (!selector) {
            return agents;
        }
        if (typeof selector === 'function') {
            return agents.filter((agent) => {
                try {
                    return Boolean(selector(agent));
                } catch (error) {
                    console.warn('[AdaptiveSDK] Agent selector failed', error);
                    return false;
                }
            });
        }
        return agents.filter((agent) => matchesPluginSelector(agent.plugin, selector));
    };

    const getAgent = (name) => agentIndex.get(name) || null;

    const createAgent = async (name, payload, options = {}) => {
        const agent = agentIndex.get(name);
        if (!agent) {
            throw new Error(`Plugin agent "${name}" is not registered.`);
        }
        const context = createPluginHandlerContext(agent.plugin, getSdk, { engine, telemetry, licenseManager }, {
            agent,
            payload,
            options
        });
        return agent.factory(context, payload, options);
    };

    const emitHook = async (event, payload, options = {}) => {
        const hooks = hookIndex.get(event);
        if (!hooks || hooks.size === 0) {
            return [];
        }
        const results = [];
        for (const hook of Array.from(hooks)) {
            const context = createPluginHandlerContext(hook.plugin, getSdk, { engine, telemetry, licenseManager }, {
                hook,
                event,
                payload,
                options
            });
            try {
                const result = hook.handler(context, payload, options);
                results.push(Promise.resolve(result));
            } catch (error) {
                console.warn(`[AdaptiveSDK] Plugin hook "${event}" failed`, error);
                results.push(Promise.reject(error));
            }
            if (hook.once) {
                hooks.delete(hook);
                if (hooks.size === 0) {
                    hookIndex.delete(event);
                }
            }
        }
        const settled = await Promise.allSettled(results);
        const values = [];
        for (const item of settled) {
            if (item.status === 'fulfilled') {
                values.push(item.value);
            } else {
                console.warn(`[AdaptiveSDK] Plugin hook "${event}" rejected`, item.reason);
            }
        }
        return values;
    };

    const listHooks = (event) => {
        if (event) {
            return Array.from(hookIndex.get(event) || []);
        }
        const all = [];
        for (const hooks of hookIndex.values()) {
            all.push(...hooks.values());
        }
        return all;
    };

    const listServers = (selector) => {
        const servers = Array.from(serverIndex.values());
        if (!selector) {
            return servers;
        }
        if (typeof selector === 'function') {
            return servers.filter((server) => {
                try {
                    return Boolean(selector(server));
                } catch (error) {
                    console.warn('[AdaptiveSDK] Server selector failed', error);
                    return false;
                }
            });
        }
        return servers.filter((server) => matchesPluginSelector(server.plugin, selector));
    };

    const getServer = (name) => serverIndex.get(name) || null;

    const createServer = async (name, payload, options = {}) => {
        const server = serverIndex.get(name);
        if (!server) {
            throw new Error(`Plugin server "${name}" is not registered.`);
        }
        const context = createPluginHandlerContext(server.plugin, getSdk, { engine, telemetry, licenseManager }, {
            server,
            payload,
            options
        });
        return server.factory(context, payload, options);
    };

    const registerMarketplace = (descriptor, options = {}) => {
        const fallbackName = typeof options?.name === 'string' ? options.name : null;
        const marketplaceRecord = finalizeMarketplaceDescriptor(descriptor, fallbackName);
        const existing = marketplacesByName.get(marketplaceRecord.name);
        if (existing) {
            marketplacesByName.delete(marketplaceRecord.name);
        }
        marketplacesByName.set(marketplaceRecord.name, marketplaceRecord);
        if (options.autoInstall !== false) {
            for (const entry of marketplaceRecord.plugins.values()) {
                if (entry.autoInstall && (entry.plugin || entry.loader)) {
                    installFromMarketplace(marketplaceRecord.name, entry.name, {
                        replace: true
                    }).catch((error) => {
                        console.warn(`[AdaptiveSDK] Failed to auto-install plugin "${entry.name}" from marketplace "${marketplaceRecord.name}"`, error);
                    });
                }
            }
        }
        return marketplaceRecord;
    };

    const unregisterMarketplace = (name) => marketplacesByName.delete(name);
    const getMarketplace = (name) => marketplacesByName.get(name) || null;
    const listMarketplaces = () => Array.from(marketplacesByName.values());

    const installFromMarketplace = async (marketplaceName, pluginName, options = {}) => {
        const marketplace = marketplacesByName.get(marketplaceName);
        if (!marketplace) {
            throw new Error(`Marketplace "${marketplaceName}" is not registered.`);
        }
        const entry = marketplace.plugins.get(pluginName);
        if (!entry) {
            throw new Error(`Plugin "${pluginName}" is not available in marketplace "${marketplaceName}".`);
        }
        let descriptor = entry.plugin;
        if (!descriptor && typeof entry.loader === 'function') {
            descriptor = await entry.loader({ marketplace: marketplaceName, plugin: pluginName });
        }
        if (!descriptor) {
            throw new Error(`Marketplace plugin "${pluginName}" is missing a descriptor or loader.`);
        }
        if (descriptor && typeof descriptor === 'object' && !descriptor.name && !descriptor.id) {
            descriptor = { ...descriptor, name: pluginName };
        }
        return registerPlugin(descriptor, {
            source: `marketplace:${marketplaceName}`,
            marketplace: marketplaceName,
            installSource: entry.source || marketplace.source || options.installSource,
            tags: entry.tags,
            metadata: entry.metadata,
            marketplaceEntry: entry,
            replace: options.replace
        });
    };

    const registerFromConfig = (entries) => {
        if (!entries) {
            return Promise.resolve();
        }
        const list = [];
        if (Array.isArray(entries)) {
            list.push(...entries);
        } else if (typeof entries === 'object') {
            for (const [key, entry] of Object.entries(entries)) {
                if (entry && typeof entry === 'object' && !entry.name) {
                    list.push({ ...entry, name: entry.name || key });
                } else {
                    list.push(entry);
                }
            }
        } else {
            list.push(entries);
        }
        if (list.length === 0) {
            return Promise.resolve();
        }
        return registerPlugins(list, { source: 'config', replace: true });
    };

    const registerMarketplacesFromConfig = (entries) => {
        if (!entries) {
            return;
        }
        if (Array.isArray(entries)) {
            for (const entry of entries) {
                registerMarketplace(entry);
            }
        } else if (typeof entries === 'object') {
            for (const entry of Object.values(entries)) {
                registerMarketplace(entry);
            }
        }
    };

    return {
        register: registerPlugin,
        registerMany: registerPlugins,
        unregister: unregisterPlugin,
        get: getPlugin,
        list: listPlugins,
        watch: watchPlugins,
        whenRegistered: whenPluginRegistered,
        whenReady: whenPluginsReady,
        listCommands,
        getCommand,
        invokeCommand,
        listAgents,
        getAgent,
        createAgent,
        emitHook,
        listHooks,
        listServers,
        getServer,
        createServer,
        registerMarketplace,
        unregisterMarketplace,
        getMarketplace,
        listMarketplaces,
        installFromMarketplace,
        registerFromConfig,
        registerMarketplacesFromConfig
    };
}
