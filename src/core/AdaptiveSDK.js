import { AdaptiveInterfaceEngine } from './AdaptiveInterfaceEngine.js';
import { createConsentPanel as baseCreateConsentPanel } from '../ui/components/ConsentPanel.js';
import { LicenseManager } from '../product/licensing/LicenseManager.js';
import { RemoteLicenseAttestor } from '../product/licensing/RemoteLicenseAttestor.js';

export function createAdaptiveSDK(config = {}) {
    const telemetryOptions = { ...(config.telemetry || {}) };
    if (config.replaceDefaultProviders) {
        telemetryOptions.useDefaultProvider = false;
    }

    if (Array.isArray(config.licenseAttestationProfilePacks)) {
        telemetryOptions.licenseAttestationProfilePacks = config.licenseAttestationProfilePacks;
    }
    if (config.licenseAttestationProfilePackId) {
        telemetryOptions.licenseAttestationProfilePackId = config.licenseAttestationProfilePackId;
    }
    if (config.licenseAttestationProfilePackOptions) {
        telemetryOptions.licenseAttestationProfilePackOptions = config.licenseAttestationProfilePackOptions;
    }

    if (config.commercialization) {
        telemetryOptions.commercialization = config.commercialization;
    }

    if (config.commercializationReporter) {
        telemetryOptions.commercializationReporter = config.commercializationReporter;
    }

    if (Array.isArray(config.licenseAttestationProfiles)) {
        telemetryOptions.licenseAttestationProfiles = config.licenseAttestationProfiles;
    }
    if (config.defaultLicenseAttestationProfileId) {
        telemetryOptions.defaultLicenseAttestationProfileId = config.defaultLicenseAttestationProfileId;
    }

    let pendingLicenseAttestorProfileId = config.licenseAttestorProfileId || null;
    let pendingLicenseAttestorProfileOverrides = { ...(config.licenseAttestorProfileOverrides || {}) };

    let licenseManager = config.licenseManager || null;
    let licenseAttestor = null;
    let licenseAttestorBindingOptions = {};
    if (!licenseManager && config.license) {
        const {
            validators,
            autoValidate = true,
            managerOptions = {},
            attestor,
            attestorBinding = {},
            attestorProfileId,
            attestorProfileOverrides = {},
            ...licenseDetails
        } = config.license;

        const options = { ...managerOptions };
        if (Array.isArray(validators)) {
            options.validators = validators;
        }
        licenseManager = new LicenseManager(options);
        if (licenseDetails.key) {
            licenseManager.setLicense(licenseDetails);
        }

        if (autoValidate !== false && licenseDetails.key) {
            licenseManager.validate().catch(error => {
                console.warn('[AdaptiveSDK] License validation failed', error);
            });
        }

        if (attestor) {
            if (typeof attestor.createValidator === 'function') {
                licenseAttestor = attestor;
            } else {
                licenseAttestor = new RemoteLicenseAttestor(attestor);
            }
            licenseAttestorBindingOptions = attestorBinding || {};
        } else if (attestorProfileId) {
            pendingLicenseAttestorProfileId = attestorProfileId;
            pendingLicenseAttestorProfileOverrides = {
                ...pendingLicenseAttestorProfileOverrides,
                ...(attestorProfileOverrides || {})
            };
        }
    }

    if (licenseManager) {
        telemetryOptions.licenseManager = licenseManager;
        if (!telemetryOptions.licenseKey && licenseManager.getLicense()?.key) {
            telemetryOptions.licenseKey = licenseManager.getLicense().key;
        }
    }

    if (!licenseAttestor && config.licenseAttestor) {
        if (typeof config.licenseAttestor.createValidator === 'function') {
            licenseAttestor = config.licenseAttestor;
        } else {
            licenseAttestor = new RemoteLicenseAttestor(config.licenseAttestor);
        }
        licenseAttestorBindingOptions = config.licenseAttestorBinding || {};
    } else if (!licenseAttestor && config.licenseAttestorProfileId) {
        pendingLicenseAttestorProfileId = config.licenseAttestorProfileId;
        pendingLicenseAttestorProfileOverrides = {
            ...pendingLicenseAttestorProfileOverrides,
            ...(config.licenseAttestorProfileOverrides || {})
        };
    }

    if (licenseAttestor) {
        telemetryOptions.licenseAttestor = licenseAttestor;
        telemetryOptions.licenseAttestorBinding = licenseAttestorBindingOptions;
    }

    const engine = new AdaptiveInterfaceEngine({
        sensory: config.sensory,
        layout: config.layout,
        design: config.design,
        telemetry: telemetryOptions,
        marketplaceHooks: config.marketplaceHooks,
        projection: config.projection,
        environment: config.environment
    });

    const telemetryProviderPromises = [];
    const telemetryProviderWatchers = new Set();
    const telemetryProviderWaiters = new Set();
    let telemetryProviderMetadataByProvider = new WeakMap();
    const telemetryProviderMetadataById = new Map();

    const pluginRecords = new Map();
    const pluginCommandsByPlugin = new Map();
    const pluginCommandsByName = new Map();
    const pluginAgentsByPlugin = new Map();
    const pluginAgentsByName = new Map();
    const pluginServersByPlugin = new Map();
    const pluginServersById = new Map();
    const pluginHooksByPlugin = new Map();
    const pluginHooksByEvent = new Map();
    const pluginEventWatchers = new Set();
    const pluginReadyWaiters = new Set();
    const pluginRegistrationTasks = new Set();
    let sdkInstance = null;

    const normalizeStringCollection = (value) => {
        if (!value) {
            return [];
        }

        const append = (entries, entry) => {
            if (typeof entry === 'string') {
                const trimmed = entry.trim();
                if (trimmed) {
                    entries.push(trimmed);
                }
            } else if (typeof entry === 'number' || typeof entry === 'boolean') {
                entries.push(String(entry));
            }
        };

        const values = [];

        if (Array.isArray(value)) {
            for (const entry of value) {
                append(values, entry);
            }
        } else if (value instanceof Set) {
            for (const entry of value.values()) {
                append(values, entry);
            }
        } else if (typeof value === 'object') {
            for (const [key, entry] of Object.entries(value)) {
                if (entry) {
                    append(values, key);
                }
            }
        } else {
            append(values, value);
        }

        if (values.length === 0) {
            return [];
        }

        return Array.from(new Set(values));
    };

    const mergeStringCollections = (...collections) => {
        if (!collections || collections.length === 0) {
            return [];
        }
        const merged = new Set();
        for (const collection of collections) {
            for (const entry of normalizeStringCollection(collection)) {
                merged.add(entry);
            }
        }
        return Array.from(merged);
    };

    const collectProviderCapabilities = (provider) => {
        if (!provider) {
            return [];
        }
        if (Array.isArray(provider.capabilities)) {
            return mergeStringCollections(provider.capabilities);
        }
        if (provider.capabilities && typeof provider.capabilities === 'object') {
            return mergeStringCollections(provider.capabilities);
        }
        return [];
    };

    const createTelemetryProviderEvent = (provider, meta = {}) => {
        const descriptorTags = meta.descriptor?.tags;
        const entryTags = meta.entry && typeof meta.entry === 'object' ? meta.entry.tags : undefined;
        const providerTags = provider && typeof provider === 'object' ? provider.tags : undefined;
        const tags = mergeStringCollections(meta.tags, descriptorTags, entryTags, providerTags);

        const descriptorCapabilities = meta.descriptor?.capabilities;
        const entryCapabilities = meta.entry && typeof meta.entry === 'object' ? meta.entry.capabilities : undefined;
        const providerCapabilities = collectProviderCapabilities(provider);
        const capabilities = mergeStringCollections(meta.capabilities, descriptorCapabilities, entryCapabilities, providerCapabilities);

        const bundle = meta.bundle ?? meta.descriptor?.bundle ?? (meta.entry && typeof meta.entry === 'object' ? meta.entry.bundle : null) ?? null;

        const registrationSource = meta.registrationSource ?? meta.source ?? 'config';

        const event = {
            provider,
            descriptor: meta.descriptor ?? null,
            entry: meta.entry ?? null,
            source: meta.source ?? 'config',
            registrationSource,
            options: meta.descriptor?.options ?? meta.options
        };

        if (tags.length > 0) {
            event.tags = tags;
        }
        if (capabilities.length > 0) {
            event.capabilities = capabilities;
        }
        if (bundle) {
            event.bundle = bundle;
        }

        return event;
    };

    const snapshotTelemetryProviderMeta = (event) => {
        if (!event || !event.provider) {
            return null;
        }
        return {
            descriptor: event.descriptor ?? null,
            entry: event.entry ?? null,
            source: event.source ?? 'config',
            registrationSource: event.registrationSource ?? event.source ?? 'config',
            options: event.options,
            tags: event.tags ? [...event.tags] : undefined,
            bundle: event.bundle ?? null,
            capabilities: event.capabilities ? [...event.capabilities] : undefined
        };
    };

    const recordTelemetryProviderMetadata = (event) => {
        if (!event || !event.provider) {
            return;
        }
        const snapshot = snapshotTelemetryProviderMeta(event);
        telemetryProviderMetadataByProvider.set(event.provider, snapshot);
        const providerId = event.provider?.id;
        if (typeof providerId === 'string' && providerId) {
            telemetryProviderMetadataById.set(providerId, snapshot);
        }
    };

    const getTelemetryProviderMetadata = (provider) => {
        if (!provider) {
            return null;
        }
        return telemetryProviderMetadataByProvider.get(provider) || null;
    };

    const createExistingTelemetryProviderEvent = (provider) => {
        const storedMeta = getTelemetryProviderMetadata(provider);
        return createTelemetryProviderEvent(provider, {
            descriptor: storedMeta?.descriptor ?? null,
            entry: storedMeta?.entry ?? null,
            source: 'existing',
            registrationSource: storedMeta?.registrationSource ?? storedMeta?.source ?? 'config',
            options: storedMeta?.options,
            tags: storedMeta?.tags,
            bundle: storedMeta?.bundle,
            capabilities: storedMeta?.capabilities
        });
    };

    const createTelemetryProviderMatcher = (selector) => {
        if (selector === undefined || selector === null) {
            return (event) => ({ matched: true, value: event });
        }

        if (selector instanceof RegExp) {
            const pattern = selector;
            return (event) => {
                const providerId = event.provider?.id;
                if (typeof providerId !== 'string') {
                    return { matched: false };
                }
                pattern.lastIndex = 0;
                if (pattern.test(providerId)) {
                    return { matched: true, value: event };
                }
                return { matched: false };
            };
        }

        if (typeof selector === 'function') {
            return (event) => {
                try {
                    const outcome = selector(event.provider, event);
                    if (!outcome) {
                        return { matched: false };
                    }
                    if (outcome === true) {
                        return { matched: true, value: event };
                    }
                    return { matched: true, value: outcome };
                } catch (error) {
                    return { matched: true, error: error instanceof Error ? error : new Error(String(error)) };
                }
            };
        }

        if (Array.isArray(selector)) {
            const expectedIds = mergeStringCollections(selector);
            if (expectedIds.length === 0) {
                return (event) => ({ matched: true, value: event });
            }
            const expectedSet = new Set(expectedIds);
            return (event) => {
                const providerId = event.provider?.id;
                if (providerId && expectedSet.has(providerId)) {
                    return { matched: true, value: event };
                }
                return { matched: false };
            };
        }

        if (typeof selector === 'object') {
            const criteria = selector;
            const expectedIds = mergeStringCollections(criteria.ids ?? criteria.id ?? criteria.providerId ?? criteria.providerIds);
            const requiredTags = mergeStringCollections(criteria.tags ?? criteria.tag ?? criteria.allTags ?? criteria.requireTags);
            const anyTags = mergeStringCollections(criteria.anyTag ?? criteria.anyTags ?? criteria.someTags);
            const excludedTags = mergeStringCollections(criteria.excludeTags ?? criteria.excludedTags);
            const requiredCapabilities = mergeStringCollections(criteria.capabilities ?? criteria.allCapabilities ?? criteria.requireCapabilities);
            const anyCapabilities = mergeStringCollections(criteria.anyCapability ?? criteria.anyCapabilities ?? criteria.someCapabilities);
            const excludedCapabilities = mergeStringCollections(criteria.excludeCapabilities ?? criteria.excludedCapabilities);
            const bundles = mergeStringCollections(criteria.bundle ?? criteria.bundles);
            const sources = mergeStringCollections(criteria.source ?? criteria.sources);
            const registrationSources = mergeStringCollections(criteria.registrationSource ?? criteria.registrationSources);
            const predicate = typeof criteria.match === 'function'
                ? criteria.match
                : typeof criteria.where === 'function'
                    ? criteria.where
                    : typeof criteria.filter === 'function'
                        ? criteria.filter
                        : null;
            const projector = typeof criteria.project === 'function'
                ? criteria.project
                : typeof criteria.select === 'function'
                    ? criteria.select
                    : typeof criteria.map === 'function'
                        ? criteria.map
                        : null;

            const expectedIdSet = expectedIds.length > 0 ? new Set(expectedIds) : null;
            const requiredTagSet = requiredTags.length > 0 ? new Set(requiredTags) : null;
            const anyTagSet = anyTags.length > 0 ? new Set(anyTags) : null;
            const excludedTagSet = excludedTags.length > 0 ? new Set(excludedTags) : null;
            const requiredCapabilitySet = requiredCapabilities.length > 0 ? new Set(requiredCapabilities) : null;
            const anyCapabilitySet = anyCapabilities.length > 0 ? new Set(anyCapabilities) : null;
            const excludedCapabilitySet = excludedCapabilities.length > 0 ? new Set(excludedCapabilities) : null;
            const bundleSet = bundles.length > 0 ? new Set(bundles) : null;
            const sourceSet = sources.length > 0 ? new Set(sources) : null;
            const registrationSourceSet = registrationSources.length > 0 ? new Set(registrationSources) : null;

            return (event) => {
                const providerId = event.provider?.id;
                if (expectedIdSet && (!providerId || !expectedIdSet.has(providerId))) {
                    return { matched: false };
                }

                if (bundleSet) {
                    if (!event.bundle || !bundleSet.has(event.bundle)) {
                        return { matched: false };
                    }
                }

                if (sourceSet && (!event.source || !sourceSet.has(event.source))) {
                    return { matched: false };
                }

                if (registrationSourceSet && (!event.registrationSource || !registrationSourceSet.has(event.registrationSource))) {
                    return { matched: false };
                }

                if (requiredTagSet || anyTagSet || excludedTagSet) {
                    const tagSet = new Set(mergeStringCollections(event.tags));
                    if (requiredTagSet) {
                        for (const tag of requiredTagSet) {
                            if (!tagSet.has(tag)) {
                                return { matched: false };
                            }
                        }
                    }
                    if (anyTagSet) {
                        let hasAny = false;
                        for (const tag of anyTagSet) {
                            if (tagSet.has(tag)) {
                                hasAny = true;
                                break;
                            }
                        }
                        if (!hasAny) {
                            return { matched: false };
                        }
                    }
                    if (excludedTagSet) {
                        for (const tag of excludedTagSet) {
                            if (tagSet.has(tag)) {
                                return { matched: false };
                            }
                        }
                    }
                }

                if (requiredCapabilitySet || anyCapabilitySet || excludedCapabilitySet) {
                    const capabilitySet = new Set(mergeStringCollections(event.capabilities));
                    if (requiredCapabilitySet) {
                        for (const capability of requiredCapabilitySet) {
                            if (!capabilitySet.has(capability)) {
                                return { matched: false };
                            }
                        }
                    }
                    if (anyCapabilitySet) {
                        let hasCapability = false;
                        for (const capability of anyCapabilitySet) {
                            if (capabilitySet.has(capability)) {
                                hasCapability = true;
                                break;
                            }
                        }
                        if (!hasCapability) {
                            return { matched: false };
                        }
                    }
                    if (excludedCapabilitySet) {
                        for (const capability of excludedCapabilitySet) {
                            if (capabilitySet.has(capability)) {
                                return { matched: false };
                            }
                        }
                    }
                }

                if (predicate) {
                    try {
                        const outcome = predicate(event.provider, event);
                        if (!outcome) {
                            return { matched: false };
                        }
                        if (outcome !== true) {
                            return { matched: true, value: outcome };
                        }
                    } catch (error) {
                        return { matched: true, error: error instanceof Error ? error : new Error(String(error)) };
                    }
                }

                if (projector) {
                    try {
                        return { matched: true, value: projector(event.provider, event) };
                    } catch (error) {
                        return { matched: true, error: error instanceof Error ? error : new Error(String(error)) };
                    }
                }

                if (!expectedIdSet && !requiredTagSet && !anyTagSet && !excludedTagSet && !requiredCapabilitySet && !anyCapabilitySet && !excludedCapabilitySet && !bundleSet && !sourceSet && !registrationSourceSet && !predicate && !projector) {
                    return { matched: true, value: event };
                }

                return { matched: true, value: event };
            };
        }

        if (typeof selector === 'string') {
            const expected = selector;
            return (event) => (event.provider?.id === expected ? { matched: true, value: event } : { matched: false });
        }

        return () => ({ matched: false });
    };

    const createTelemetryProviderWaiterState = (selector) => {
        if (Array.isArray(selector)) {
            const matchers = selector.map(entry => createTelemetryProviderMatcher(entry));
            const results = new Map();
            return {
                handle(event) {
                    let resolved = false;
                    for (let index = 0; index < matchers.length; index++) {
                        if (results.has(index)) {
                            continue;
                        }
                        const matcher = matchers[index];
                        const outcome = matcher(event);
                        if (!outcome) {
                            continue;
                        }
                        if (outcome.error) {
                            return { matched: true, error: outcome.error };
                        }
                        if (outcome.matched) {
                            results.set(index, outcome.value ?? event);
                            resolved = true;
                        }
                    }
                    if (results.size === matchers.length) {
                        return { matched: true, value: selector.map((_, index) => results.get(index) ?? null) };
                    }
                    if (resolved) {
                        return { matched: false };
                    }
                    return { matched: false };
                }
            };
        }

        const matcher = createTelemetryProviderMatcher(selector);
        return {
            handle(event) {
                const outcome = matcher(event);
                if (!outcome) {
                    return { matched: false };
                }
                return outcome;
            }
        };
    };

    function whenTelemetryProvidersReady() {
        if (telemetryProviderPromises.length === 0) {
            return Promise.resolve();
        }
        return Promise.allSettled(telemetryProviderPromises).then(() => undefined);
    }

    function whenTelemetryProviderReady(selector, options = {}) {
        const waiterState = createTelemetryProviderWaiterState(selector);

        return new Promise((resolve, reject) => {
            let entry = null;

            const cleanup = () => {
                if (!entry) {
                    return;
                }
                telemetryProviderWaiters.delete(entry);
                if (entry.timeoutId) {
                    clearTimeout(entry.timeoutId);
                    entry.timeoutId = null;
                }
                if (entry.abortListener && options.signal) {
                    options.signal.removeEventListener('abort', entry.abortListener);
                    entry.abortListener = null;
                }
                entry = null;
            };

            const resolveWith = (value) => {
                cleanup();
                resolve(value);
            };

            const rejectWith = (error) => {
                cleanup();
                reject(error);
            };

            const attempt = (event) => {
                const result = waiterState.handle(event);
                if (!result) {
                    return false;
                }
                if (result.error) {
                    const error = result.error instanceof Error
                        ? result.error
                        : new Error(String(result.error));
                    rejectWith(error);
                    return true;
                }
                if (result.matched) {
                    resolveWith(result.value);
                    return true;
                }
                return false;
            };

            const existingProviders = Array.from(engine.telemetry.providers.values());
            for (const provider of existingProviders) {
                const event = createExistingTelemetryProviderEvent(provider);
                if (attempt(event)) {
                    return;
                }
            }

            if (options.signal?.aborted) {
                const reason = options.signal.reason instanceof Error
                    ? options.signal.reason
                    : new Error(options.signal.reason || 'Aborted waiting for telemetry provider readiness.');
                rejectWith(reason);
                return;
            }

            entry = {
                state: waiterState,
                attempt,
                cleanup: () => cleanup(),
                timeoutId: null,
                abortListener: null,
                reject: rejectWith,
                resolve: resolveWith
            };

            if (options.signal) {
                entry.abortListener = () => {
                    const reason = options.signal.reason instanceof Error
                        ? options.signal.reason
                        : new Error(options.signal.reason || 'Aborted waiting for telemetry provider readiness.');
                    rejectWith(reason);
                };
                options.signal.addEventListener('abort', entry.abortListener, { once: true });
            }

            if (typeof options.timeoutMs === 'number' && options.timeoutMs > 0) {
                entry.timeoutId = setTimeout(() => {
                    rejectWith(new Error('Timed out waiting for telemetry provider readiness.'));
                }, options.timeoutMs);
            }

            telemetryProviderWaiters.add(entry);
        });
    }

    function streamTelemetryProviders(selector, options = {}) {
        const includeExisting = options.includeExisting !== false;
        const matcher = createTelemetryProviderMatcher(selector);

        return {
            [Symbol.asyncIterator]() {
                const queue = [];
                let ended = false;
                let error = null;
                let notify = null;
                let cleaned = false;

                const wake = () => {
                    if (notify) {
                        const pending = notify;
                        notify = null;
                        pending();
                    }
                };

                const cleanup = () => {
                    if (cleaned) {
                        return;
                    }
                    cleaned = true;
                    telemetryProviderWatchers.delete(listener);
                    if (options.signal && abortListener) {
                        options.signal.removeEventListener('abort', abortListener);
                    }
                };

                const finish = (reason) => {
                    if (ended) {
                        return;
                    }
                    ended = true;
                    if (reason !== undefined && reason !== null) {
                        error = reason instanceof Error ? reason : new Error(String(reason));
                    }
                    wake();
                };

                const listener = (event) => {
                    if (ended) {
                        return;
                    }
                    if (!includeExisting && event.source === 'existing') {
                        return;
                    }

                    let outcome;
                    try {
                        outcome = matcher(event);
                    } catch (listenerError) {
                        const failure = listenerError instanceof Error
                            ? listenerError
                            : new Error(String(listenerError));
                        finish(failure);
                        return;
                    }

                    if (!outcome) {
                        return;
                    }

                    if (outcome.error) {
                        const failure = outcome.error instanceof Error
                            ? outcome.error
                            : new Error(String(outcome.error));
                        finish(failure);
                        return;
                    }

                    if (!outcome.matched) {
                        return;
                    }

                    queue.push(outcome.value ?? event);
                    wake();
                };

                telemetryProviderWatchers.add(listener);

                let abortListener = null;
                if (options.signal) {
                    abortListener = () => {
                        const reason = options.signal.reason instanceof Error
                            ? options.signal.reason
                            : new Error(options.signal.reason || 'Telemetry provider stream aborted.');
                        finish(reason);
                    };
                    if (options.signal.aborted) {
                        abortListener();
                    } else {
                        options.signal.addEventListener('abort', abortListener, { once: true });
                    }
                }

                if (includeExisting) {
                    for (const provider of engine.telemetry.providers.values()) {
                        if (ended) {
                            break;
                        }
                        const event = createExistingTelemetryProviderEvent(provider);
                        listener(event);
                        if (ended) {
                            break;
                        }
                    }
                }

                const readNext = async () => {
                    while (queue.length === 0) {
                        if (ended) {
                            cleanup();
                            if (error) {
                                throw error;
                            }
                            return { done: true, value: undefined };
                        }
                        await new Promise(resolve => {
                            notify = resolve;
                        });
                    }

                    const value = queue.shift();
                    return { done: false, value };
                };

                return {
                    async next() {
                        try {
                            return await readNext();
                        } catch (err) {
                            finish(err);
                            cleanup();
                            throw err;
                        }
                    },
                    async return(reason) {
                        finish(reason);
                        cleanup();
                        return { done: true, value: undefined };
                    },
                    async throw(err) {
                        const failure = err instanceof Error ? err : new Error(String(err));
                        finish(failure);
                        cleanup();
                        throw failure;
                    }
                };
            }
        };
    }

    const scheduleMicrotask = (fn) => {
        if (typeof queueMicrotask === 'function') {
            queueMicrotask(fn);
            return;
        }
        Promise.resolve().then(fn).catch(error => {
            console.warn('[AdaptiveSDK] Telemetry provider microtask failed', error);
        });
    };

    const createFallbackEventTarget = () => {
        const listeners = new Map();
        return {
            addEventListener(type, listener) {
                if (typeof listener !== 'function' || !type) {
                    return;
                }
                let entries = listeners.get(type);
                if (!entries) {
                    entries = new Set();
                    listeners.set(type, entries);
                }
                entries.add(listener);
            },
            removeEventListener(type, listener) {
                if (!type) {
                    return;
                }
                const entries = listeners.get(type);
                if (!entries) {
                    return;
                }
                if (listener) {
                    entries.delete(listener);
                } else {
                    entries.clear();
                }
                if (entries.size === 0) {
                    listeners.delete(type);
                }
            },
            dispatchEvent(event) {
                if (!event || typeof event.type !== 'string') {
                    throw new Error('Event object must specify a type.');
                }
                const entries = listeners.get(event.type);
                if (!entries || entries.size === 0) {
                    return true;
                }
                const snapshot = Array.from(entries);
                for (const listener of snapshot) {
                    try {
                        listener.call(this, event);
                    } catch (error) {
                        console.warn('[AdaptiveSDK] Telemetry provider event target listener failed', error);
                    }
                }
                return !event.defaultPrevented;
            }
        };
    };

    function watchTelemetryProviders(selector, listener, options = {}) {
        if (typeof listener !== 'function') {
            throw new Error('Telemetry provider watcher must supply a listener function.');
        }

        const includeExisting = options.includeExisting !== false;
        const once = options.once === true;
        const matcher = createTelemetryProviderMatcher(selector);
        const errorHandler = typeof options.onError === 'function' ? options.onError : null;

        let active = true;
        let abortListener = null;
        let listenerWrapper = null;
        let deliveredAbortError = false;

        const handleError = (error, event) => {
            const failure = error instanceof Error ? error : new Error(String(error));
            if (!active && event === null && options.signal?.aborted) {
                if (deliveredAbortError) {
                    return;
                }
                deliveredAbortError = true;
            }
            if (errorHandler) {
                try {
                    errorHandler(failure, event ?? null);
                } catch (handlerError) {
                    console.warn('[AdaptiveSDK] Telemetry provider watch error handler failed', handlerError);
                }
            } else {
                console.warn('[AdaptiveSDK] Telemetry provider watch listener failed', failure);
            }
        };

        const unsubscribe = () => {
            if (!active) {
                return;
            }
            active = false;
            if (listenerWrapper) {
                telemetryProviderWatchers.delete(listenerWrapper);
            }
            if (abortListener && options.signal) {
                options.signal.removeEventListener('abort', abortListener);
                abortListener = null;
            }
        };

        listenerWrapper = (event) => {
            if (!active) {
                return;
            }
            if (!includeExisting && event.source === 'existing') {
                return;
            }

            let outcome;
            try {
                outcome = matcher(event);
            } catch (error) {
                handleError(error, event);
                return;
            }

            if (!outcome) {
                return;
            }

            if (outcome.error) {
                handleError(outcome.error, event);
                return;
            }

            if (!outcome.matched) {
                return;
            }

            const hasValue = Object.prototype.hasOwnProperty.call(outcome, 'value');
            const value = hasValue ? outcome.value : event;

            try {
                listener(value, event);
            } catch (error) {
                handleError(error, event);
            }

            if (once) {
                unsubscribe();
            }
        };

        if (options.signal?.aborted) {
            active = false;
            const reason = options.signal.reason;
            if (reason !== undefined && reason !== null) {
                handleError(reason, null);
            }
            return unsubscribe;
        }

        telemetryProviderWatchers.add(listenerWrapper);

        if (options.signal) {
            abortListener = () => {
                const reason = options.signal.reason;
                unsubscribe();
                if (reason !== undefined && reason !== null) {
                    handleError(reason, null);
                }
            };
            options.signal.addEventListener('abort', abortListener, { once: true });
        }

        if (includeExisting) {
            for (const provider of engine.telemetry.providers.values()) {
                if (!active) {
                    break;
                }
                const event = createExistingTelemetryProviderEvent(provider);
                listenerWrapper(event);
            }
        }

        return unsubscribe;
    }

    function createTelemetryProviderEventTarget(selector, options = {}) {
        const includeExisting = options.includeExisting !== false;
        const once = options.once === true;
        const eventName = typeof options.eventName === 'string' && options.eventName.trim()
            ? options.eventName.trim()
            : 'telemetryprovider';
        const errorEventName = typeof options.errorEventName === 'string' && options.errorEventName.trim()
            ? options.errorEventName.trim()
            : 'telemetryprovidererror';
        const disposeEventName = typeof options.disposeEventName === 'string' && options.disposeEventName.trim()
            ? options.disposeEventName.trim()
            : 'telemetryproviderdispose';
        const projectDetail = typeof options.detail === 'function'
            ? options.detail
            : (value, event) => ({
                value,
                event,
                metadata: event ? snapshotTelemetryProviderMeta(event) : null
            });
        const userErrorHandler = typeof options.onError === 'function' ? options.onError : null;

        const rawTarget = typeof EventTarget === 'function'
            ? new EventTarget()
            : createFallbackEventTarget();

        const addEventListenerToTarget = rawTarget.addEventListener
            ? rawTarget.addEventListener.bind(rawTarget)
            : rawTarget.addEventListener;
        const removeEventListenerFromTarget = rawTarget.removeEventListener
            ? rawTarget.removeEventListener.bind(rawTarget)
            : rawTarget.removeEventListener;
        const dispatchEventFromTarget = rawTarget.dispatchEvent
            ? rawTarget.dispatchEvent.bind(rawTarget)
            : rawTarget.dispatchEvent;

        const abortController = new AbortController();
        let externalAbortListener = null;
        let unsubscribe = null;
        let listenerRegistered = false;
        let disposed = false;

        const emit = (type, detail, allowWhenDisposed = false) => {
            if (!allowWhenDisposed && disposed) {
                return;
            }
            const eventInit = { detail };
            let event;
            if (typeof CustomEvent === 'function') {
                try {
                    event = new CustomEvent(type, eventInit);
                } catch (error) {
                    console.warn('[AdaptiveSDK] Failed to create telemetry provider CustomEvent', error);
                }
            }
            if (!event) {
                event = {
                    type,
                    detail,
                    target: rawTarget,
                    currentTarget: rawTarget,
                    defaultPrevented: false,
                    preventDefault() {
                        this.defaultPrevented = true;
                    }
                };
            }
            try {
                dispatchEventFromTarget(event);
            } catch (error) {
                console.warn('[AdaptiveSDK] Telemetry provider event target dispatch failed', error);
            }
        };

        const scheduleEmit = (type, detail, allowWhenDisposed = false) => {
            scheduleMicrotask(() => emit(type, detail, allowWhenDisposed));
        };

        const handleError = (error, event) => {
            const failure = error instanceof Error ? error : new Error(String(error));
            const detail = {
                error: failure,
                event: event ?? null,
                metadata: event ? snapshotTelemetryProviderMeta(event) : null
            };
            scheduleEmit(errorEventName, detail, true);
            if (userErrorHandler) {
                try {
                    userErrorHandler(failure, event ?? null);
                } catch (handlerError) {
                    console.warn('[AdaptiveSDK] Telemetry provider event target error handler failed', handlerError);
                }
            }
        };

        const stop = (reason) => {
            if (disposed) {
                return;
            }
            disposed = true;

            const wasRegistered = listenerRegistered;

            if (!abortController.signal.aborted) {
                if (reason !== undefined && reason !== null) {
                    abortController.abort(reason);
                } else {
                    abortController.abort();
                }
            }

            if (listenerRegistered && typeof unsubscribe === 'function') {
                try {
                    unsubscribe();
                } catch (error) {
                    console.warn('[AdaptiveSDK] Telemetry provider event target cleanup failed', error);
                }
            }
            listenerRegistered = false;
            unsubscribe = null;

            if (externalAbortListener && options.signal) {
                options.signal.removeEventListener('abort', externalAbortListener);
                externalAbortListener = null;
            }

            scheduleEmit(disposeEventName, {
                reason: reason ?? null,
                active: false
            }, true);

            if (!wasRegistered && reason !== undefined && reason !== null) {
                handleError(reason, null);
            }
        };

        const deliverMatch = (value, event) => {
            if (disposed) {
                return;
            }

            const metadata = event ? snapshotTelemetryProviderMeta(event) : null;
            let detail;
            try {
                detail = projectDetail(value, event);
            } catch (error) {
                handleError(error, event);
                return;
            }

            const payload = detail === undefined
                ? { value, event, metadata }
                : detail;

            scheduleEmit(eventName, payload);

            if (once) {
                scheduleMicrotask(() => stop());
            }
        };

        const watcherOptions = {
            includeExisting,
            signal: abortController.signal,
            onError: handleError
        };

        if (options.signal) {
            if (options.signal.aborted) {
                const reason = options.signal.reason;
                stop(reason);
            } else {
                externalAbortListener = () => {
                    const reason = options.signal.reason;
                    stop(reason);
                };
                options.signal.addEventListener('abort', externalAbortListener, { once: true });
            }
        }

        if (!disposed) {
            unsubscribe = watchTelemetryProviders(
                selector,
                (value, event) => {
                    deliverMatch(value, event);
                },
                watcherOptions
            );
            listenerRegistered = true;
        }

        const facade = {
            target: rawTarget,
            signal: abortController.signal,
            get active() {
                return !disposed;
            },
            addEventListener(type, listener, options) {
                addEventListenerToTarget(type, listener, options);
            },
            removeEventListener(type, listener, options) {
                removeEventListenerFromTarget(type, listener, options);
            },
            dispatchEvent(event) {
                return dispatchEventFromTarget(event);
            },
            dispose(reason) {
                stop(reason);
            },
            abort(reason) {
                stop(reason ?? new Error('Telemetry provider event target aborted.'));
            }
        };

        return Object.freeze(facade);
    }

    function collectTelemetryProviders(selector, options = {}) {
        const matcher = createTelemetryProviderMatcher(selector);
        const includeExisting = options.includeExisting !== false;
        const distinct = options.distinct !== false;
        const targetCountRaw = typeof options.count === 'number' ? options.count : undefined;
        const targetCount = Number.isFinite(targetCountRaw)
            ? Math.max(0, Math.floor(targetCountRaw))
            : 1;

        return new Promise((resolve, reject) => {
            const results = [];
            const seenProviders = distinct ? new Set() : null;
            let listenerRegistered = false;
            let timeoutId = null;
            let completed = false;
            let abortListener = null;

            const cleanup = () => {
                if (listenerRegistered) {
                    telemetryProviderWatchers.delete(listener);
                    listenerRegistered = false;
                }
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (abortListener && options.signal) {
                    options.signal.removeEventListener('abort', abortListener);
                }
            };

            const finishWith = (value, error = null) => {
                if (completed) {
                    return;
                }
                completed = true;
                cleanup();
                if (error) {
                    const failure = error instanceof Error ? error : new Error(String(error));
                    reject(failure);
                } else {
                    resolve(Array.isArray(value) ? value.slice() : value);
                }
            };

            const fail = (reason) => {
                const failure = reason instanceof Error ? reason : new Error(String(reason));
                finishWith(null, failure);
            };

            const deliverMatch = (event) => {
                if (completed) {
                    return;
                }

                let outcome;
                try {
                    outcome = matcher(event);
                } catch (error) {
                    fail(error);
                    return;
                }

                if (!outcome) {
                    return;
                }

                if (outcome.error) {
                    fail(outcome.error);
                    return;
                }

                if (!outcome.matched) {
                    return;
                }

                if (distinct && event?.provider) {
                    if (seenProviders.has(event.provider)) {
                        return;
                    }
                    seenProviders.add(event.provider);
                }

                results.push(outcome.value ?? event);

                if (results.length >= targetCount) {
                    finishWith(results);
                }
            };

            const listener = (event) => {
                deliverMatch(event);
            };

            if (targetCount === 0) {
                if (options.signal?.aborted) {
                    fail(options.signal.reason || new Error('Telemetry provider collection aborted.'));
                    return;
                }
                finishWith([]);
                return;
            }

            if (options.signal) {
                if (options.signal.aborted) {
                    fail(options.signal.reason || new Error('Telemetry provider collection aborted.'));
                    return;
                }
                abortListener = () => {
                    fail(options.signal.reason || new Error('Telemetry provider collection aborted.'));
                };
                options.signal.addEventListener('abort', abortListener, { once: true });
            }

            if (typeof options.timeoutMs === 'number' && options.timeoutMs > 0) {
                timeoutId = setTimeout(() => {
                    fail(new Error('Timed out collecting telemetry providers.'));
                }, options.timeoutMs);
            }

            if (includeExisting) {
                for (const provider of engine.telemetry.providers.values()) {
                    if (completed) {
                        break;
                    }
                    const event = createExistingTelemetryProviderEvent(provider);
                    deliverMatch(event);
                }
            }

            if (completed) {
                return;
            }

            telemetryProviderWatchers.add(listener);
            listenerRegistered = true;
        });
    }

    function trackTelemetryProviders(selector, options = {}) {
        const includeExisting = options.includeExisting !== false;
        const matcher = createTelemetryProviderMatcher(selector);
        const keyStrategy = options.key ?? 'auto';
        const records = new Map();
        const changeListeners = new Set();
        let active = true;
        let abortListener = null;

        const toError = (reason, fallbackMessage) => {
            if (reason instanceof Error) {
                return reason;
            }
            if (reason === undefined || reason === null) {
                return new Error(fallbackMessage);
            }
            return new Error(String(reason));
        };

        const detachSignal = () => {
            if (abortListener && options.signal) {
                options.signal.removeEventListener('abort', abortListener);
                abortListener = null;
            }
        };

        const emitChange = (change) => {
            if (changeListeners.size === 0) {
                return;
            }
            const detail = Object.freeze({
                ...change,
                active
            });
            for (const listener of changeListeners) {
                try {
                    listener(detail);
                } catch (error) {
                    console.warn('[AdaptiveSDK] Telemetry provider tracker listener failed', error);
                }
            }
        };

        const notifyError = (reason, event, context) => {
            const failure = toError(reason, 'Telemetry provider tracking failed.');
            if (typeof options.onError === 'function') {
                try {
                    options.onError(failure, event ?? null, context ?? null);
                } catch (handlerError) {
                    console.warn('[AdaptiveSDK] Telemetry provider tracker error handler failed', handlerError);
                }
            } else {
                console.warn('[AdaptiveSDK] Telemetry provider tracker encountered an error', failure);
            }
            emitChange({
                type: 'error',
                error: failure,
                event: event ?? null,
                context: context ?? null
            });
        };

        const deriveKey = (event) => {
            if (typeof options.key === 'function') {
                try {
                    return options.key(event.provider, event);
                } catch (error) {
                    notifyError(error, event, 'key');
                    return undefined;
                }
            }
            switch (keyStrategy) {
                case 'id':
                case 'providerId':
                    return event.provider?.id ?? null;
                case 'provider':
                case 'instance':
                    return event.provider ?? null;
                case 'event':
                    return event;
                case 'auto':
                default:
                    return event.provider?.id ?? event.provider ?? null;
            }
        };

        const storeMatch = (event) => {
            if (!active) {
                return;
            }
            if (!includeExisting && event.source === 'existing') {
                return;
            }

            let outcome;
            try {
                outcome = matcher(event);
            } catch (error) {
                notifyError(error, event, 'matcher');
                return;
            }

            if (!outcome) {
                return;
            }

            if (outcome.error) {
                notifyError(outcome.error, event, 'matcher');
                return;
            }

            if (!outcome.matched) {
                return;
            }

            const hasValue = Object.prototype.hasOwnProperty.call(outcome, 'value');
            const value = hasValue ? outcome.value : event;
            const key = deriveKey(event);

            if (key === undefined || key === null) {
                notifyError(new Error('Telemetry provider tracker could not derive a key for the matched provider.'), event, 'key');
                return;
            }

            const previous = records.get(key) || null;
            const timestamp = Date.now();
            const record = Object.freeze({
                key,
                provider: event.provider ?? null,
                event,
                value,
                metadata: snapshotTelemetryProviderMeta(event),
                seenAt: previous?.seenAt ?? timestamp,
                updatedAt: timestamp
            });

            records.set(key, record);

            emitChange({
                type: previous ? 'update' : 'add',
                key,
                record,
                previous,
                value,
                event,
                replay: false
            });
        };

        const listener = (event) => {
            storeMatch(event);
        };

        const stop = (reason) => {
            if (!active) {
                return;
            }
            active = false;
            telemetryProviderWatchers.delete(listener);
            detachSignal();
            const change = reason === undefined
                ? { type: 'dispose', reason: null }
                : { type: 'dispose', reason: toError(reason, 'Telemetry provider tracking disposed.') };
            emitChange(change);
            changeListeners.clear();
        };

        const tracker = {
            get active() {
                return active;
            },
            get size() {
                return records.size;
            },
            has(key) {
                return records.has(key);
            },
            get(key) {
                return records.get(key) || null;
            },
            keys() {
                return Array.from(records.keys());
            },
            values() {
                return Array.from(records.values());
            },
            entries() {
                return Array.from(records.entries());
            },
            snapshot() {
                return Array.from(records.values());
            },
            forEach(callback) {
                if (typeof callback !== 'function') {
                    throw new Error('Telemetry provider tracker forEach callback must be a function.');
                }
                for (const [key, record] of records.entries()) {
                    callback(record, key, this);
                }
            },
            subscribe(listener, subscribeOptions = {}) {
                if (typeof listener !== 'function') {
                    throw new Error('Telemetry provider tracker subscriber must be a function.');
                }
                changeListeners.add(listener);
                if (subscribeOptions.replay !== false) {
                    for (const record of records.values()) {
                        const change = Object.freeze({
                            type: 'add',
                            key: record.key,
                            record,
                            previous: null,
                            value: record.value,
                            event: record.event,
                            replay: true,
                            active
                        });
                        try {
                            listener(change);
                        } catch (error) {
                            console.warn('[AdaptiveSDK] Telemetry provider tracker subscriber replay failed', error);
                        }
                    }
                }
                return () => {
                    changeListeners.delete(listener);
                };
            },
            dispose(reason) {
                stop(reason);
            }
        };

        Object.defineProperty(tracker, Symbol.iterator, {
            value: function* () {
                for (const record of records.values()) {
                    yield record;
                }
            }
        });

        if (options.signal?.aborted) {
            stop(options.signal.reason);
            return Object.freeze(tracker);
        }

        telemetryProviderWatchers.add(listener);

        if (includeExisting) {
            for (const provider of engine.telemetry.providers.values()) {
                if (!active) {
                    break;
                }
                const event = createExistingTelemetryProviderEvent(provider);
                storeMatch(event);
                if (!active) {
                    break;
                }
            }
        }

        if (options.signal) {
            abortListener = () => {
                const reason = toError(options.signal.reason, 'Telemetry provider tracking aborted.');
                stop(reason);
            };
            options.signal.addEventListener('abort', abortListener, { once: true });
        }

        return Object.freeze(tracker);
    }

    function createTelemetryProviderStream(selector, options = {}) {
        const streamConstructor = options.ReadableStream
            || options.streamConstructor
            || (typeof ReadableStream === 'function' ? ReadableStream : null);

        if (typeof streamConstructor !== 'function') {
            throw new Error(
                'ReadableStream constructor is not available. Provide one via options.ReadableStream.'
            );
        }

        const includeExisting = options.includeExisting !== false;
        const abortController = new AbortController();

        const toError = (reason, fallbackMessage) => {
            if (reason instanceof Error) {
                return reason;
            }
            if (reason === undefined || reason === null) {
                return new Error(fallbackMessage);
            }
            return new Error(String(reason));
        };

        let externalAbortListener = null;

        const detachExternalAbort = () => {
            if (externalAbortListener && options.signal) {
                options.signal.removeEventListener('abort', externalAbortListener);
                externalAbortListener = null;
            }
        };

        const abortUpstream = (reason, fallbackMessage) => {
            if (!abortController.signal.aborted) {
                abortController.abort(toError(reason, fallbackMessage));
            }
            detachExternalAbort();
        };

        const createIterable = () => streamTelemetryProviders(selector, {
            includeExisting,
            signal: abortController.signal
        });

        if (options.signal) {
            if (options.signal.aborted) {
                abortUpstream(options.signal.reason, 'Telemetry provider readable stream aborted.');
            } else {
                externalAbortListener = () => {
                    abortUpstream(options.signal.reason, 'Telemetry provider readable stream aborted.');
                };
                options.signal.addEventListener('abort', externalAbortListener, { once: true });
            }
        }

        let iterator = null;
        let finalized = false;

        const ensureIterator = () => {
            if (!iterator) {
                iterator = createIterable()[Symbol.asyncIterator]();
            }
            return iterator;
        };

        const finalizeIterator = async () => {
            if (finalized) {
                return;
            }
            finalized = true;
            detachExternalAbort();
            const current = iterator;
            iterator = null;
            if (current && typeof current.return === 'function') {
                try {
                    await current.return();
                } catch (error) {
                    console.warn('[AdaptiveSDK] Telemetry provider readable stream cleanup failed', error);
                }
            }
        };

        return new streamConstructor({
            async start() {
                ensureIterator();
            },
            async pull(controller) {
                const current = ensureIterator();
                try {
                    const { value, done } = await current.next();
                    if (done) {
                        await finalizeIterator();
                        controller.close();
                        return;
                    }
                    controller.enqueue(value);
                } catch (error) {
                    const failure = error instanceof Error ? error : new Error(String(error));
                    abortUpstream(failure, 'Telemetry provider readable stream aborted.');
                    await finalizeIterator();
                    controller.error(failure);
                }
            },
            async cancel(reason) {
                const failure = toError(reason, 'Telemetry provider readable stream cancelled.');
                abortUpstream(failure, 'Telemetry provider readable stream cancelled.');
                await finalizeIterator();
            }
        }, options.queuingStrategy);
    }

    const telemetryDescriptorContext = {
        engine,
        telemetry: engine.telemetry,
        config,
        environment: engine.environment,
        whenProvidersReady: whenTelemetryProvidersReady,
        whenProviderReady: whenTelemetryProviderReady,
        streamTelemetryProviders,
        watchTelemetryProviders,
        collectTelemetryProviders,
        createTelemetryProviderEventTarget,
        createTelemetryProviderStream,
        trackTelemetryProviders
    };

    const trackTelemetryPromise = promise => {
        if (!promise || typeof promise.then !== 'function') {
            return Promise.resolve();
        }
        const tracked = promise.catch(error => {
            console.warn('[AdaptiveSDK] Telemetry provider pipeline rejected', error);
        });
        telemetryProviderPromises.push(tracked);
        return tracked;
    };

    const isTelemetryDescriptor = entry => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            return false;
        }
        if (typeof entry.factory === 'function' || typeof entry.resolve === 'function') {
            return true;
        }
        if (typeof entry.module === 'function' || (entry.module && typeof entry.module.then === 'function')) {
            return true;
        }
        if (typeof entry.guard === 'function' || typeof entry.when === 'function') {
            return true;
        }
        if (entry.guard === true || entry.when === true) {
            return true;
        }
        if (Array.isArray(entry.providers)) {
            return true;
        }
        if (typeof entry.timeoutMs === 'number') {
            return true;
        }
        if ('use' in entry) {
            return true;
        }
        return false;
    };

    const notifyTelemetryProviderWaiters = (event) => {
        if (telemetryProviderWaiters.size === 0) {
            return;
        }
        const waiters = Array.from(telemetryProviderWaiters);
        for (const waiter of waiters) {
            try {
                if (waiter.attempt(event)) {
                    // waiter.attempt handles resolution and cleanup
                }
            } catch (error) {
                const failure = error instanceof Error ? error : new Error(String(error));
                if (typeof waiter.reject === 'function') {
                    waiter.reject(failure);
                } else if (waiter.cleanup) {
                    waiter.cleanup();
                }
                console.warn('[AdaptiveSDK] Telemetry provider waiter failed', failure);
            }
        }
    };

    const notifyTelemetryProviderListeners = (event) => {
        if (telemetryProviderWatchers.size === 0) {
            return;
        }
        for (const listener of telemetryProviderWatchers) {
            try {
                listener(event);
            } catch (listenerError) {
                console.warn('[AdaptiveSDK] Telemetry provider listener failed', listenerError);
            }
        }
    };

    const registerResolvedTelemetryProvider = (resolved, meta = {}) => {
        if (!resolved) {
            return;
        }

        if (Array.isArray(resolved)) {
            for (const entry of resolved) {
                registerResolvedTelemetryProvider(entry, meta);
            }
            return;
        }

        if (resolved && typeof resolved === 'object' && 'default' in resolved && resolved.default) {
            registerResolvedTelemetryProvider(resolved.default, meta);
            return;
        }

        let event;

        try {
            engine.registerTelemetryProvider(resolved);
            event = createTelemetryProviderEvent(resolved, meta);
        } catch (error) {
            console.warn('[AdaptiveSDK] Failed to register telemetry provider', error);
            return;
        }

        recordTelemetryProviderMetadata(event);
        notifyTelemetryProviderWaiters(event);
        notifyTelemetryProviderListeners(event);
    };

    const processTelemetryProviderCandidate = async (candidate, meta = {}) => {
        if (!candidate) {
            return;
        }

        if (Array.isArray(candidate)) {
            for (const entry of candidate) {
                await processTelemetryProviderCandidate(entry, meta);
            }
            return;
        }

        if (isTelemetryDescriptor(candidate)) {
            await resolveTelemetryDescriptor(candidate, meta);
            return;
        }

        if (candidate && typeof candidate === 'object' && 'default' in candidate && candidate.default) {
            await processTelemetryProviderCandidate(candidate.default, meta);
            return;
        }

        if (typeof candidate.then === 'function') {
            await candidate.then(
                resolved => processTelemetryProviderCandidate(resolved, meta),
                error => {
                    console.warn('[AdaptiveSDK] Telemetry provider factory rejected', error);
                }
            );
            return;
        }

        registerResolvedTelemetryProvider(candidate, meta);
    };

    const resolveTelemetryDescriptor = async (descriptor, meta = {}) => {
        const descriptorMeta = {
            ...meta,
            descriptor,
            entry: meta.entry ?? descriptor,
            source: meta.source ?? 'config',
            registrationSource: meta.registrationSource ?? meta.source ?? 'config',
            options: descriptor.options ?? meta.options,
            tags: mergeStringCollections(meta.tags, descriptor.tags),
            bundle: descriptor.bundle ?? meta.bundle ?? null,
            capabilities: mergeStringCollections(meta.capabilities, descriptor.capabilities)
        };

        if (descriptor.guard !== undefined) {
            try {
                const guardResult = typeof descriptor.guard === 'function'
                    ? descriptor.guard({ ...telemetryDescriptorContext, descriptor })
                    : descriptor.guard;
                const allowed = await Promise.resolve(guardResult);
                if (!allowed) {
                    return;
                }
            } catch (error) {
                console.warn('[AdaptiveSDK] Telemetry provider guard threw an error', error);
                return;
            }
        }

        if (descriptor.when !== undefined) {
            try {
                const whenResult = typeof descriptor.when === 'function'
                    ? descriptor.when({ ...telemetryDescriptorContext, descriptor })
                    : descriptor.when;
                const ready = await Promise.resolve(whenResult);
                if (ready === false) {
                    return;
                }
            } catch (error) {
                console.warn('[AdaptiveSDK] Telemetry provider readiness condition rejected', error);
                return;
            }
        }

        if (Array.isArray(descriptor.providers)) {
            for (const nested of descriptor.providers) {
                await processTelemetryProviderEntry(nested, descriptorMeta);
            }
            return;
        }

        let candidate;
        try {
            if (typeof descriptor.resolve === 'function') {
                candidate = descriptor.resolve({
                    ...telemetryDescriptorContext,
                    descriptor,
                    options: descriptor.options
                });
            } else if (descriptor.module) {
                const loader = typeof descriptor.module === 'function'
                    ? descriptor.module
                    : () => descriptor.module;
                candidate = loader({
                    ...telemetryDescriptorContext,
                    descriptor,
                    options: descriptor.options
                });
            } else if (typeof descriptor.factory === 'function') {
                candidate = descriptor.factory({
                    engine,
                    telemetry: engine.telemetry,
                    config,
                    options: descriptor.options,
                    environment: engine.environment
                });
            } else if ('use' in descriptor) {
                candidate = descriptor.use;
            }
        } catch (error) {
            console.warn('[AdaptiveSDK] Telemetry provider descriptor failed to resolve', error);
            return;
        }

        if (descriptor.timeoutMs && candidate && typeof candidate.then === 'function') {
            let timeoutId;
            candidate = Promise.race([
                candidate,
                new Promise((_, reject) => {
                    timeoutId = setTimeout(() => {
                        reject(new Error('Timed out resolving telemetry provider descriptor'));
                    }, descriptor.timeoutMs);
                })
            ]).finally(() => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            });
        }

        await processTelemetryProviderCandidate(candidate, descriptorMeta);
    };

    const processTelemetryProviderEntry = async (entry, meta = {}) => {
        if (!entry) {
            return;
        }

        if (Array.isArray(entry)) {
            for (const candidate of entry) {
                await processTelemetryProviderEntry(candidate, meta);
            }
            return;
        }

        if (isTelemetryDescriptor(entry)) {
            await resolveTelemetryDescriptor(entry, { ...meta, entry });
            return;
        }

        if (typeof entry === 'function') {
            let candidate;
            try {
                candidate = entry({
                    engine,
                    telemetry: engine.telemetry,
                    config,
                    options: meta.options,
                    environment: engine.environment
                });
            } catch (error) {
                console.warn('[AdaptiveSDK] Telemetry provider factory threw an error', error);
                return;
            }
            await processTelemetryProviderCandidate(candidate, { ...meta, entry });
            return;
        }

        await processTelemetryProviderCandidate(entry, meta);
    };

    const instantiateTelemetryProviderEntry = (entry, meta = {}) => {
        const promise = (async () => {
            await processTelemetryProviderEntry(entry, { ...meta, source: meta.source ?? 'config', entry });
        })();
        return trackTelemetryPromise(promise);
    };

    if (licenseManager) {
        engine.telemetry.setLicenseManager(licenseManager);
    }

    if (licenseAttestor) {
        engine.telemetry.setLicenseAttestor(licenseAttestor, licenseAttestorBindingOptions);
    } else if (pendingLicenseAttestorProfileId) {
        const profileResult = engine.telemetry.setLicenseAttestorFromProfile(
            pendingLicenseAttestorProfileId,
            pendingLicenseAttestorProfileOverrides
        );
        if (profileResult?.attestor) {
            licenseAttestor = profileResult.attestor;
            licenseAttestorBindingOptions = profileResult.binding || {};
        }
    }

    if (Array.isArray(config.layoutStrategies)) {
        engine.layoutSynthesizer.clearStrategies();
        for (const strategy of config.layoutStrategies) {
            engine.registerLayoutStrategy(strategy);
        }
    }

    if (Array.isArray(config.layoutAnnotations)) {
        engine.layoutSynthesizer.clearAnnotations();
        for (const annotation of config.layoutAnnotations) {
            engine.registerLayoutAnnotation(annotation);
        }
    }

    if (Array.isArray(config.telemetryProviders)) {
        if (config.replaceDefaultProviders ?? false) {
            engine.telemetry.providers = new Map();
            telemetryProviderMetadataByProvider = new WeakMap();
            telemetryProviderMetadataById.clear();
        }
        for (const providerEntry of config.telemetryProviders) {
            instantiateTelemetryProviderEntry(providerEntry, { source: 'config' });
        }
    }

    if (config.sensorSchemas) {
        if (Array.isArray(config.sensorSchemas)) {
            for (const entry of config.sensorSchemas) {
                if (entry && typeof entry === 'object' && entry.type && entry.schema) {
                    engine.registerSensorSchema(entry.type, entry.schema);
                }
            }
        } else if (typeof config.sensorSchemas === 'object') {
            for (const [type, schema] of Object.entries(config.sensorSchemas)) {
                engine.registerSensorSchema(type, schema);
            }
        }
    }

    if (Array.isArray(config.sensorAdapters)) {
        for (const adapter of config.sensorAdapters) {
            if (adapter && adapter.type && adapter.instance) {
                engine.registerSensorAdapter(adapter.type, adapter.instance, { autoConnect: adapter.autoConnect });
            }
        }
    }

    if (config.telemetryConsent) {
        engine.telemetry.updateConsent(config.telemetryConsent, { source: 'sdk-bootstrap' });
    }

    const defaultConsentOptions = Array.isArray(config.consentOptions) ? config.consentOptions : undefined;

    const createPluginSnapshot = (record) => {
        if (!record) {
            return null;
        }
        const commands = pluginCommandsByPlugin.get(record.id) || new Map();
        const hooks = pluginHooksByPlugin.get(record.id) || new Map();
        const agents = pluginAgentsByPlugin.get(record.id) || new Map();
        const servers = pluginServersByPlugin.get(record.id) || new Map();

        return {
            id: record.id,
            name: record.name,
            version: record.version,
            description: record.description,
            status: record.status,
            tags: record.tags ? [...record.tags] : [],
            capabilities: record.capabilities ? [...record.capabilities] : [],
            source: record.source,
            registrationSource: record.registrationSource,
            manifest: record.manifest ? { ...record.manifest } : undefined,
            commands: Array.from(commands.values()).map(entry => ({
                pluginId: entry.pluginId,
                name: entry.name,
                description: entry.description,
                metadata: entry.metadata ? { ...entry.metadata } : undefined
            })),
            hooks: Array.from(hooks.keys()),
            agents: Array.from(agents.values()).map(entry => ({
                pluginId: entry.pluginId,
                name: entry.name,
                description: entry.description,
                metadata: entry.metadata ? { ...entry.metadata } : undefined
            })),
            servers: Array.from(servers.values()).map(entry => ({
                pluginId: entry.pluginId,
                id: entry.id,
                name: entry.name,
                description: entry.description,
                metadata: entry.metadata ? { ...entry.metadata } : undefined
            }))
        };
    };

    const createPluginContext = (record) => ({
        plugin: { id: record.id, name: record.name, version: record.version },
        get sdk() {
            if (!sdkInstance) {
                throw new Error('Adaptive SDK is not yet initialized for plugin interaction.');
            }
            return sdkInstance;
        },
        registerCommand(descriptor) {
            return registerPluginCommand(record, descriptor);
        },
        registerAgent(descriptor) {
            return registerPluginAgent(record, descriptor);
        },
        registerHook(descriptor) {
            return registerPluginHook(record, descriptor);
        },
        registerServer(descriptor) {
            return registerPluginServer(record, descriptor);
        }
    });

    const emitPluginEvent = (type, record, extra = {}) => {
        if (!record) {
            return;
        }
        const event = {
            type,
            plugin: createPluginSnapshot(record),
            instance: record.instance ?? null,
            ...extra
        };

        for (const listener of pluginEventWatchers) {
            try {
                listener(event);
            } catch (error) {
                console.warn('[AdaptiveSDK] Plugin event listener failed', error);
            }
        }
    };

    const createExistingPluginEvent = (record, extra = {}) => {
        if (!record) {
            return null;
        }
        return {
            type: 'existing',
            plugin: createPluginSnapshot(record),
            instance: record.instance ?? null,
            source: extra.source ?? 'existing',
            registrationSource: extra.registrationSource
                ?? record.registrationSource
                ?? record.source
                ?? 'config',
            ...extra
        };
    };

    const snapshotPluginEventMeta = (event) => {
        if (!event || !event.plugin) {
            return null;
        }
        return {
            id: event.plugin.id ?? null,
            name: event.plugin.name ?? null,
            version: event.plugin.version ?? null,
            status: event.plugin.status ?? null,
            source: event.source ?? null,
            registrationSource: event.registrationSource ?? event.source ?? null,
            tags: Array.isArray(event.plugin.tags) ? [...event.plugin.tags] : undefined,
            capabilities: Array.isArray(event.plugin.capabilities)
                ? [...event.plugin.capabilities]
                : undefined
        };
    };

    const matchPluginEvent = (matcher, event) => {
        if (typeof matcher !== 'function') {
            return {
                matched: true,
                snapshot: event?.plugin ?? null,
                record: event?.plugin?.id ? pluginRecords.get(event.plugin.id) || null : null
            };
        }

        const record = event?.plugin?.id ? pluginRecords.get(event.plugin.id) || null : null;
        const candidate = record ?? event?.plugin ?? null;
        if (!candidate) {
            return { matched: false, record: record ?? null, snapshot: event?.plugin ?? null };
        }

        let outcome;
        try {
            outcome = matcher(candidate);
        } catch (error) {
            return {
                matched: true,
                error: error instanceof Error ? error : new Error(String(error)),
                record,
                snapshot: record ? createPluginSnapshot(record) : (event?.plugin ?? null)
            };
        }

        if (!outcome) {
            return { matched: false, record, snapshot: event?.plugin ?? null };
        }

        if (outcome.error) {
            return {
                matched: Boolean(outcome.matched),
                error: outcome.error,
                record,
                snapshot: record ? createPluginSnapshot(record) : (event?.plugin ?? null)
            };
        }

        if (!outcome.matched) {
            return { matched: false, record, snapshot: event?.plugin ?? null };
        }

        const snapshot = record ? createPluginSnapshot(record) : (event?.plugin ?? null);
        const result = {
            matched: true,
            record,
            snapshot
        };

        if (Object.prototype.hasOwnProperty.call(outcome, 'value')) {
            result.value = outcome.value;
        }

        return result;
    };

    const resolveStaticPluginCommandResponse = (descriptor) => {
        if (!descriptor || typeof descriptor !== 'object') {
            return null;
        }

        const toNonEmptyString = (value) => {
            if (typeof value !== 'string') {
                return null;
            }
            const trimmed = value.trim();
            return trimmed ? trimmed : null;
        };

        const source = descriptor.response;
        let responseContent = null;
        let responseFormat = typeof descriptor.format === 'string' ? descriptor.format : undefined;
        let responseType = typeof descriptor.type === 'string' ? descriptor.type : undefined;
        let responseTitle = typeof descriptor.title === 'string' ? descriptor.title : undefined;
        let responseMetadata = null;

        if (typeof source === 'string') {
            responseContent = toNonEmptyString(source);
        } else if (source && typeof source === 'object') {
            if (typeof source.content === 'string') {
                responseContent = toNonEmptyString(source.content);
            }
            if (!responseContent && typeof source.text === 'string') {
                responseContent = toNonEmptyString(source.text);
            }
            if (!responseContent && typeof source.markdown === 'string') {
                responseContent = toNonEmptyString(source.markdown);
                if (responseContent && !responseFormat) {
                    responseFormat = 'markdown';
                }
            }
            if (!responseContent && typeof source.prompt === 'string') {
                responseContent = toNonEmptyString(source.prompt);
            }
            if (!responseContent && typeof source.body === 'string') {
                responseContent = toNonEmptyString(source.body);
            }

            if (typeof source.format === 'string') {
                responseFormat = source.format;
            }
            if (typeof source.type === 'string') {
                responseType = source.type;
            }
            if (typeof source.title === 'string') {
                responseTitle = source.title;
            }
            if (source.metadata && typeof source.metadata === 'object') {
                responseMetadata = { ...source.metadata };
            }
        }

        if (!responseContent && typeof descriptor.content === 'string') {
            responseContent = toNonEmptyString(descriptor.content);
        }
        if (!responseContent && typeof descriptor.markdown === 'string') {
            responseContent = toNonEmptyString(descriptor.markdown);
            if (responseContent && !responseFormat) {
                responseFormat = 'markdown';
            }
        }
        if (!responseContent && typeof descriptor.prompt === 'string') {
            responseContent = toNonEmptyString(descriptor.prompt);
        }
        if (!responseContent && typeof descriptor.text === 'string') {
            responseContent = toNonEmptyString(descriptor.text);
        }
        if (!responseContent && typeof descriptor.body === 'string') {
            responseContent = toNonEmptyString(descriptor.body);
        }

        if (!responseContent) {
            return null;
        }

        const format = responseFormat
            || (typeof descriptor.markdown === 'string' ? 'markdown' : undefined)
            || 'text';
        const type = responseType || 'static';
        const title = responseTitle || (typeof descriptor.title === 'string' ? descriptor.title : undefined);

        const result = {
            type,
            format,
            content: responseContent
        };

        if (title) {
            result.title = title;
        }
        if (responseMetadata) {
            result.metadata = responseMetadata;
        }

        return result;
    };

    const createStaticPluginCommandHandler = (staticResponse) => {
        const base = {
            type: staticResponse.type || 'static',
            format: staticResponse.format || 'text',
            content: staticResponse.content
        };
        if (staticResponse.title) {
            base.title = staticResponse.title;
        }
        const baseMetadata = staticResponse.metadata && typeof staticResponse.metadata === 'object'
            ? Object.freeze({ ...staticResponse.metadata })
            : undefined;

        const frozen = Object.freeze({ ...base, metadata: baseMetadata });

        return () => ({
            ...frozen,
            metadata: baseMetadata ? { ...baseMetadata } : undefined
        });
    };

    const registerPluginCommand = (record, descriptor) => {
        if (!descriptor || typeof descriptor !== 'object') {
            throw new Error('Plugin command descriptor must be an object.');
        }
        const name = typeof descriptor.name === 'string'
            ? descriptor.name.trim()
            : typeof descriptor.command === 'string'
                ? descriptor.command.trim()
                : '';
        if (!name) {
            throw new Error('Plugin command requires a name.');
        }
        let handler = descriptor.run || descriptor.execute || descriptor.handler;
        let staticResponse = null;
        if (typeof handler !== 'function') {
            staticResponse = resolveStaticPluginCommandResponse(descriptor);
        }

        let metadata = null;
        if (staticResponse?.metadata && typeof staticResponse.metadata === 'object') {
            metadata = { ...staticResponse.metadata };
        }
        if (descriptor.metadata && typeof descriptor.metadata === 'object') {
            metadata = metadata ? { ...metadata, ...descriptor.metadata } : { ...descriptor.metadata };
        }
        if (metadata && staticResponse) {
            staticResponse = { ...staticResponse, metadata };
        }

        if (typeof handler !== 'function') {
            if (!staticResponse) {
                throw new Error(`Plugin command "${name}" must provide a function handler.`);
            }
            handler = createStaticPluginCommandHandler(staticResponse);
        }

        const commandRecord = {
            pluginId: record.id,
            name,
            description: descriptor.description || '',
            handler
        };

        if (metadata) {
            commandRecord.metadata = metadata;
        }

        let pluginCommands = pluginCommandsByPlugin.get(record.id);
        if (!pluginCommands) {
            pluginCommands = new Map();
            pluginCommandsByPlugin.set(record.id, pluginCommands);
        }
        pluginCommands.set(name, commandRecord);

        let commandsForName = pluginCommandsByName.get(name);
        if (!commandsForName) {
            commandsForName = new Map();
            pluginCommandsByName.set(name, commandsForName);
        }
        commandsForName.set(record.id, commandRecord);

        return commandRecord;
    };

    const registerPluginAgent = (record, descriptor) => {
        if (!descriptor || typeof descriptor !== 'object') {
            throw new Error('Plugin agent descriptor must be an object.');
        }
        const name = typeof descriptor.name === 'string'
            ? descriptor.name.trim()
            : typeof descriptor.id === 'string'
                ? descriptor.id.trim()
                : '';
        if (!name) {
            throw new Error('Plugin agent requires a name.');
        }
        const handler = descriptor.run || descriptor.handle || descriptor.execute;
        if (typeof handler !== 'function') {
            throw new Error(`Plugin agent "${name}" must provide a function handler.`);
        }

        const agentRecord = {
            pluginId: record.id,
            name,
            description: descriptor.description || '',
            handler,
            metadata: descriptor.metadata && typeof descriptor.metadata === 'object'
                ? { ...descriptor.metadata }
                : undefined
        };

        let pluginAgents = pluginAgentsByPlugin.get(record.id);
        if (!pluginAgents) {
            pluginAgents = new Map();
            pluginAgentsByPlugin.set(record.id, pluginAgents);
        }
        pluginAgents.set(name, agentRecord);

        let agentsForName = pluginAgentsByName.get(name);
        if (!agentsForName) {
            agentsForName = new Map();
            pluginAgentsByName.set(name, agentsForName);
        }
        agentsForName.set(record.id, agentRecord);

        return agentRecord;
    };

    const registerPluginHook = (record, descriptor) => {
        if (!descriptor) {
            throw new Error('Plugin hook descriptor is required.');
        }
        const event = typeof descriptor === 'string'
            ? descriptor.trim()
            : typeof descriptor.event === 'string'
                ? descriptor.event.trim()
                : typeof descriptor.name === 'string'
                    ? descriptor.name.trim()
                    : '';
        if (!event) {
            throw new Error('Plugin hook requires an event name.');
        }
        const handler = typeof descriptor === 'object'
            ? descriptor.handler || descriptor.handle || descriptor.run
            : null;
        if (typeof handler !== 'function') {
            throw new Error(`Plugin hook "${event}" must provide a function handler.`);
        }

        const hookRecord = {
            pluginId: record.id,
            event,
            handler,
            description: descriptor.description || '',
            metadata: descriptor.metadata && typeof descriptor.metadata === 'object'
                ? { ...descriptor.metadata }
                : undefined
        };

        let pluginHooks = pluginHooksByPlugin.get(record.id);
        if (!pluginHooks) {
            pluginHooks = new Map();
            pluginHooksByPlugin.set(record.id, pluginHooks);
        }
        let hookSet = pluginHooks.get(event);
        if (!hookSet) {
            hookSet = new Set();
            pluginHooks.set(event, hookSet);
        }
        hookSet.add(hookRecord);

        let hooksForEvent = pluginHooksByEvent.get(event);
        if (!hooksForEvent) {
            hooksForEvent = new Set();
            pluginHooksByEvent.set(event, hooksForEvent);
        }
        hooksForEvent.add(hookRecord);

        return hookRecord;
    };

    const registerPluginServer = (record, descriptor) => {
        if (!descriptor || typeof descriptor !== 'object') {
            throw new Error('Plugin MCP server descriptor must be an object.');
        }
        const id = typeof descriptor.id === 'string'
            ? descriptor.id.trim()
            : typeof descriptor.name === 'string'
                ? descriptor.name.trim()
                : '';
        if (!id) {
            throw new Error('Plugin MCP server requires an id or name.');
        }
        const connect = descriptor.connect || descriptor.create || descriptor.createConnection;
        if (typeof connect !== 'function') {
            throw new Error(`Plugin MCP server "${id}" must provide a connect function.`);
        }

        const serverRecord = {
            pluginId: record.id,
            id,
            name: descriptor.name || id,
            description: descriptor.description || '',
            connect,
            metadata: descriptor.metadata && typeof descriptor.metadata === 'object'
                ? { ...descriptor.metadata }
                : undefined
        };

        let pluginServers = pluginServersByPlugin.get(record.id);
        if (!pluginServers) {
            pluginServers = new Map();
            pluginServersByPlugin.set(record.id, pluginServers);
        }
        pluginServers.set(id, serverRecord);
        pluginServersById.set(id, serverRecord);

        return serverRecord;
    };

    const removePluginIndexes = (record) => {
        const commands = pluginCommandsByPlugin.get(record.id);
        if (commands) {
            for (const [name] of commands) {
                const byName = pluginCommandsByName.get(name);
                if (byName) {
                    byName.delete(record.id);
                    if (byName.size === 0) {
                        pluginCommandsByName.delete(name);
                    }
                }
            }
            pluginCommandsByPlugin.delete(record.id);
        }

        const agents = pluginAgentsByPlugin.get(record.id);
        if (agents) {
            for (const [name] of agents) {
                const byName = pluginAgentsByName.get(name);
                if (byName) {
                    byName.delete(record.id);
                    if (byName.size === 0) {
                        pluginAgentsByName.delete(name);
                    }
                }
            }
            pluginAgentsByPlugin.delete(record.id);
        }

        const servers = pluginServersByPlugin.get(record.id);
        if (servers) {
            for (const [serverId] of servers) {
                const current = pluginServersById.get(serverId);
                if (current && current.pluginId === record.id) {
                    pluginServersById.delete(serverId);
                }
            }
            pluginServersByPlugin.delete(record.id);
        }

        const hooks = pluginHooksByPlugin.get(record.id);
        if (hooks) {
            for (const [event, hookSet] of hooks) {
                const globalSet = pluginHooksByEvent.get(event);
                if (globalSet) {
                    for (const hookRecord of hookSet) {
                        globalSet.delete(hookRecord);
                    }
                    if (globalSet.size === 0) {
                        pluginHooksByEvent.delete(event);
                    }
                }
            }
            pluginHooksByPlugin.delete(record.id);
        }
    };

    const resolvePluginEntry = async (entry, meta = {}) => {
        if (!entry) {
            return null;
        }

        if (typeof entry === 'function') {
            const result = entry({
                engine,
                sdk: () => sdkInstance,
                config,
                environment: engine.environment,
                options: meta.options
            });
            return resolvePluginEntry(await Promise.resolve(result), meta);
        }

        if (entry && typeof entry.then === 'function') {
            return resolvePluginEntry(await entry, meta);
        }

        if (entry && typeof entry === 'object' && 'default' in entry && entry.default) {
            return resolvePluginEntry(entry.default, meta);
        }

        return entry;
    };

    const normalizePluginDescriptor = (descriptor, meta = {}) => {
        if (!descriptor || typeof descriptor !== 'object') {
            throw new Error('Invalid plugin descriptor provided.');
        }

        const manifest = descriptor.manifest && typeof descriptor.manifest === 'object'
            ? { ...descriptor.manifest }
            : {};
        const id = typeof descriptor.id === 'string'
            ? descriptor.id.trim()
            : typeof manifest.id === 'string'
                ? manifest.id.trim()
                : typeof manifest.name === 'string'
                    ? manifest.name.trim()
                    : typeof descriptor.name === 'string'
                        ? descriptor.name.trim()
                        : '';

        if (!id) {
            throw new Error('Plugin descriptor must include an id or name.');
        }

        const name = descriptor.name || manifest.name || id;
        const version = descriptor.version || manifest.version || '0.0.0';
        const description = descriptor.description || manifest.description || '';
        const tags = mergeStringCollections(meta.tags, descriptor.tags, manifest.tags);
        const capabilities = mergeStringCollections(meta.capabilities, descriptor.capabilities, manifest.capabilities);

        return {
            id,
            name,
            version,
            description,
            manifest: Object.keys(manifest).length > 0 ? manifest : undefined,
            tags,
            capabilities,
            source: meta.source ?? 'runtime',
            registrationSource: meta.registrationSource ?? meta.source ?? 'runtime'
        };
    };

    const getAbortReason = (signal, fallbackMessage) => {
        if (!signal) {
            return new Error(fallbackMessage);
        }
        if (signal.reason instanceof Error) {
            return signal.reason;
        }
        return new Error(signal.reason || fallbackMessage);
    };

    const notifyPluginWaiters = (record) => {
        if (!record || record.status !== 'active' || pluginReadyWaiters.size === 0) {
            return;
        }
        for (const waiter of Array.from(pluginReadyWaiters)) {
            try {
                if (waiter.attempt(record)) {
                    if (typeof waiter.cleanup === 'function') {
                        waiter.cleanup();
                    }
                }
            } catch (error) {
                if (typeof waiter.cleanup === 'function') {
                    waiter.cleanup();
                }
                if (typeof waiter.reject === 'function') {
                    waiter.reject(error instanceof Error ? error : new Error(String(error)));
                }
            }
        }
    };

    const activatePluginRecord = async (record, meta = {}) => {
        if (!record) {
            return null;
        }
        if (record.status === 'active') {
            return record;
        }
        record.status = 'activating';
        const context = createPluginContext(record);

        try {
            if (record.instance) {
                if (typeof record.instance.activate === 'function') {
                    await record.instance.activate(context);
                } else if (typeof record.instance.onActivate === 'function') {
                    await record.instance.onActivate(context);
                }
            }
            record.status = 'active';
            emitPluginEvent('activated', record, { source: meta.source ?? record.source });
            notifyPluginWaiters(record);
            return record;
        } catch (error) {
            record.status = 'error';
            emitPluginEvent('activationFailed', record, {
                source: meta.source ?? record.source,
                error: error instanceof Error ? error : new Error(String(error))
            });
            throw error;
        }
    };

    const deactivatePluginRecord = async (record, meta = {}) => {
        if (!record) {
            return null;
        }
        if (record.status !== 'active') {
            return record;
        }
        record.status = 'deactivating';
        const context = createPluginContext(record);

        try {
            if (record.instance) {
                if (typeof record.instance.deactivate === 'function') {
                    await record.instance.deactivate(context);
                } else if (typeof record.instance.onDeactivate === 'function') {
                    await record.instance.onDeactivate(context);
                }
            }
            record.status = 'inactive';
            emitPluginEvent('deactivated', record, { source: meta.source ?? record.source });
            return record;
        } catch (error) {
            record.status = 'error';
            emitPluginEvent('deactivationFailed', record, {
                source: meta.source ?? record.source,
                error: error instanceof Error ? error : new Error(String(error))
            });
            throw error;
        }
    };

    const registerPlugin = (entry, options = {}) => {
        const meta = {
            source: options.source ?? 'runtime',
            registrationSource: options.registrationSource ?? options.source ?? 'runtime',
            tags: options.tags,
            capabilities: options.capabilities,
            options: options.options
        };

        const task = (async () => {
            const resolved = await resolvePluginEntry(entry, meta);
            if (!resolved) {
                throw new Error('Plugin entry resolved to an empty descriptor.');
            }

            const normalized = normalizePluginDescriptor(resolved, meta);

            if (pluginRecords.has(normalized.id)) {
                if (options.replace ?? false) {
                    await unregisterPlugin(normalized.id, { source: 'plugin-replacement' });
                } else {
                    throw new Error(`Plugin with id "${normalized.id}" is already registered.`);
                }
            }

            const record = {
                id: normalized.id,
                name: normalized.name,
                version: normalized.version,
                description: normalized.description,
                manifest: normalized.manifest,
                tags: normalized.tags,
                capabilities: normalized.capabilities,
                source: normalized.source,
                registrationSource: normalized.registrationSource,
                status: 'inactive',
                instance: resolved
            };

            pluginRecords.set(record.id, record);
            pluginCommandsByPlugin.set(record.id, new Map());
            pluginAgentsByPlugin.set(record.id, new Map());
            pluginServersByPlugin.set(record.id, new Map());
            pluginHooksByPlugin.set(record.id, new Map());

            try {
                if (Array.isArray(resolved.commands)) {
                    for (const commandDescriptor of resolved.commands) {
                        registerPluginCommand(record, commandDescriptor);
                    }
                }
                if (Array.isArray(resolved.agents)) {
                    for (const agentDescriptor of resolved.agents) {
                        registerPluginAgent(record, agentDescriptor);
                    }
                }
                if (Array.isArray(resolved.hooks)) {
                    for (const hookDescriptor of resolved.hooks) {
                        registerPluginHook(record, hookDescriptor);
                    }
                } else if (resolved.hooks && typeof resolved.hooks === 'object') {
                    for (const [event, handler] of Object.entries(resolved.hooks)) {
                        registerPluginHook(record, { event, handler });
                    }
                }
                if (Array.isArray(resolved.mcpServers)) {
                    for (const serverDescriptor of resolved.mcpServers) {
                        registerPluginServer(record, serverDescriptor);
                    }
                }

                if (typeof resolved.setup === 'function') {
                    const setupResult = await resolved.setup(createPluginContext(record));
                    if (setupResult && typeof setupResult === 'object') {
                        if (Array.isArray(setupResult.commands)) {
                            for (const commandDescriptor of setupResult.commands) {
                                registerPluginCommand(record, commandDescriptor);
                            }
                        }
                        if (Array.isArray(setupResult.agents)) {
                            for (const agentDescriptor of setupResult.agents) {
                                registerPluginAgent(record, agentDescriptor);
                            }
                        }
                        if (Array.isArray(setupResult.hooks)) {
                            for (const hookDescriptor of setupResult.hooks) {
                                registerPluginHook(record, hookDescriptor);
                            }
                        }
                        if (Array.isArray(setupResult.mcpServers)) {
                            for (const serverDescriptor of setupResult.mcpServers) {
                                registerPluginServer(record, serverDescriptor);
                            }
                        }
                    }
                }
            } catch (error) {
                removePluginIndexes(record);
                pluginRecords.delete(record.id);
                throw error;
            }

            emitPluginEvent('registered', record, {
                source: record.source,
                registrationSource: record.registrationSource
            });

            if (options.activate === false || resolved.activate === false) {
                return createPluginSnapshot(record);
            }

            await activatePluginRecord(record, { source: record.source });
            return createPluginSnapshot(record);
        })();

        pluginRegistrationTasks.add(task);
        task.finally(() => {
            pluginRegistrationTasks.delete(task);
        });

        return task;
    };

    const registerPlugins = (entries, options = {}) => {
        const list = Array.isArray(entries) ? entries : [entries];
        const tasks = [];
        for (const entry of list) {
            if (!entry) {
                continue;
            }
            tasks.push(registerPlugin(entry, options));
        }
        if (tasks.length === 0) {
            return Promise.resolve([]);
        }
        return Promise.all(tasks);
    };

    const activatePlugin = async (id, options = {}) => {
        const record = typeof id === 'string' ? pluginRecords.get(id) : null;
        if (!record) {
            throw new Error(`Plugin "${id}" is not registered.`);
        }
        await activatePluginRecord(record, { source: options.source ?? 'runtime' });
        return createPluginSnapshot(record);
    };

    const deactivatePlugin = async (id, options = {}) => {
        const record = typeof id === 'string' ? pluginRecords.get(id) : null;
        if (!record) {
            throw new Error(`Plugin "${id}" is not registered.`);
        }
        await deactivatePluginRecord(record, { source: options.source ?? 'runtime' });
        return createPluginSnapshot(record);
    };

    const unregisterPlugin = async (id, options = {}) => {
        const record = typeof id === 'string' ? pluginRecords.get(id) : null;
        if (!record) {
            return false;
        }

        if (record.status === 'active') {
            await deactivatePluginRecord(record, { source: options.source ?? 'runtime' });
        }

        try {
            if (record.instance && typeof record.instance.teardown === 'function') {
                await record.instance.teardown(createPluginContext(record));
            }
        } catch (error) {
            console.warn('[AdaptiveSDK] Plugin teardown failed', error);
        }

        removePluginIndexes(record);
        pluginRecords.delete(record.id);
        emitPluginEvent('unregistered', record, { source: options.source ?? record.source });
        return true;
    };

    const listPlugins = (options = {}) => {
        const includeInactive = options.includeInactive !== false;
        const plugins = [];
        for (const record of pluginRecords.values()) {
            if (!includeInactive && record.status !== 'active') {
                continue;
            }
            plugins.push(createPluginSnapshot(record));
        }
        return plugins;
    };

    const getPlugin = (id) => {
        const record = typeof id === 'string' ? pluginRecords.get(id) : null;
        return record ? createPluginSnapshot(record) : null;
    };

    const listPluginCommands = (options = {}) => {
        const includeInactive = options.includeInactive ?? false;
        const commands = [];
        for (const [pluginId, entries] of pluginCommandsByPlugin.entries()) {
            const record = pluginRecords.get(pluginId);
            if (!record) {
                continue;
            }
            if (!includeInactive && record.status !== 'active') {
                continue;
            }
            for (const entry of entries.values()) {
                commands.push({
                    pluginId,
                    name: entry.name,
                    description: entry.description,
                    metadata: entry.metadata ? { ...entry.metadata } : undefined
                });
            }
        }
        return commands;
    };

    const listPluginAgents = (options = {}) => {
        const includeInactive = options.includeInactive ?? false;
        const agents = [];
        for (const [pluginId, entries] of pluginAgentsByPlugin.entries()) {
            const record = pluginRecords.get(pluginId);
            if (!record) {
                continue;
            }
            if (!includeInactive && record.status !== 'active') {
                continue;
            }
            for (const entry of entries.values()) {
                agents.push({
                    pluginId,
                    name: entry.name,
                    description: entry.description,
                    metadata: entry.metadata ? { ...entry.metadata } : undefined
                });
            }
        }
        return agents;
    };

    const listPluginHooks = (options = {}) => {
        const includeInactive = options.includeInactive ?? false;
        const hooks = [];
        for (const [pluginId, hookMap] of pluginHooksByPlugin.entries()) {
            const record = pluginRecords.get(pluginId);
            if (!record) {
                continue;
            }
            if (!includeInactive && record.status !== 'active') {
                continue;
            }
            for (const [event, hookSet] of hookMap.entries()) {
                hooks.push({
                    pluginId,
                    event,
                    count: hookSet.size
                });
            }
        }
        return hooks;
    };

    const listPluginServers = (options = {}) => {
        const includeInactive = options.includeInactive ?? false;
        const servers = [];
        for (const [pluginId, entries] of pluginServersByPlugin.entries()) {
            const record = pluginRecords.get(pluginId);
            if (!record) {
                continue;
            }
            if (!includeInactive && record.status !== 'active') {
                continue;
            }
            for (const entry of entries.values()) {
                servers.push({
                    pluginId,
                    id: entry.id,
                    name: entry.name,
                    description: entry.description,
                    metadata: entry.metadata ? { ...entry.metadata } : undefined
                });
            }
        }
        return servers;
    };

    const resolveCommandRecord = (name, options = {}) => {
        const commandName = typeof name === 'string' ? name.trim() : '';
        if (!commandName) {
            throw new Error('Plugin command name is required.');
        }
        const pluginId = options.pluginId || options.id;
        if (pluginId) {
            const commands = pluginCommandsByPlugin.get(pluginId);
            if (!commands || !commands.has(commandName)) {
                throw new Error(`Plugin "${pluginId}" does not provide command "${commandName}".`);
            }
            return commands.get(commandName);
        }
        const byName = pluginCommandsByName.get(commandName);
        if (!byName || byName.size === 0) {
            throw new Error(`No plugin provides command "${commandName}".`);
        }
        if (byName.size > 1) {
            throw new Error(`Multiple plugins provide command "${commandName}". Specify a pluginId.`);
        }
        return byName.values().next().value;
    };

    const resolveAgentRecord = (name, options = {}) => {
        const agentName = typeof name === 'string' ? name.trim() : '';
        if (!agentName) {
            throw new Error('Plugin agent name is required.');
        }
        const pluginId = options.pluginId || options.id;
        if (pluginId) {
            const agents = pluginAgentsByPlugin.get(pluginId);
            if (!agents || !agents.has(agentName)) {
                throw new Error(`Plugin "${pluginId}" does not provide agent "${agentName}".`);
            }
            return agents.get(agentName);
        }
        const byName = pluginAgentsByName.get(agentName);
        if (!byName || byName.size === 0) {
            throw new Error(`No plugin provides agent "${agentName}".`);
        }
        if (byName.size > 1) {
            throw new Error(`Multiple plugins provide agent "${agentName}". Specify a pluginId.`);
        }
        return byName.values().next().value;
    };

    const executePluginCommand = async (commandName, payload, options = {}) => {
        const record = resolveCommandRecord(commandName, options);
        const pluginRecord = pluginRecords.get(record.pluginId);
        if (!pluginRecord) {
            throw new Error(`Plugin "${record.pluginId}" is not registered.`);
        }
        if (pluginRecord.status !== 'active') {
            throw new Error(`Plugin "${pluginRecord.id}" is not active.`);
        }
        const context = {
            plugin: createPluginSnapshot(pluginRecord),
            get sdk() {
                if (!sdkInstance) {
                    throw new Error('Adaptive SDK is not initialized for command execution.');
                }
                return sdkInstance;
            },
            signal: options.signal
        };
        return Promise.resolve(record.handler(payload, context));
    };

    const invokePluginAgent = async (agentName, payload, options = {}) => {
        const record = resolveAgentRecord(agentName, options);
        const pluginRecord = pluginRecords.get(record.pluginId);
        if (!pluginRecord) {
            throw new Error(`Plugin "${record.pluginId}" is not registered.`);
        }
        if (pluginRecord.status !== 'active') {
            throw new Error(`Plugin "${pluginRecord.id}" is not active.`);
        }
        const context = {
            plugin: createPluginSnapshot(pluginRecord),
            get sdk() {
                if (!sdkInstance) {
                    throw new Error('Adaptive SDK is not initialized for agent invocation.');
                }
                return sdkInstance;
            },
            signal: options.signal
        };
        return Promise.resolve(record.handler(payload, context));
    };

    const dispatchPluginHook = async (eventName, payload, options = {}) => {
        const event = typeof eventName === 'string' ? eventName.trim() : '';
        if (!event) {
            throw new Error('Hook event name must be provided.');
        }
        const hookSet = pluginHooksByEvent.get(event);
        if (!hookSet || hookSet.size === 0) {
            return [];
        }
        const rejectOnError = options.rejectOnError ?? false;
        const tasks = [];
        const results = [];
        for (const hookRecord of hookSet) {
            const pluginRecord = pluginRecords.get(hookRecord.pluginId);
            if (!pluginRecord || pluginRecord.status !== 'active') {
                continue;
            }
            const context = {
                plugin: createPluginSnapshot(pluginRecord),
                get sdk() {
                    if (!sdkInstance) {
                        throw new Error('Adaptive SDK is not initialized for hook dispatch.');
                    }
                    return sdkInstance;
                },
                signal: options.signal,
                event
            };
            const task = Promise.resolve().then(() => hookRecord.handler(payload, context));
            if (rejectOnError) {
                tasks.push(task.then(value => {
                    results.push({ pluginId: pluginRecord.id, value });
                }));
            } else {
                tasks.push(task.then(value => {
                    results.push({ pluginId: pluginRecord.id, value });
                }).catch(error => {
                    results.push({ pluginId: pluginRecord.id, error });
                }));
            }
        }
        if (tasks.length === 0) {
            return [];
        }
        if (rejectOnError) {
            await Promise.all(tasks);
        } else {
            await Promise.allSettled(tasks);
        }
        return results;
    };

    const connectPluginServer = async (serverId, options = {}) => {
        const id = typeof serverId === 'string' ? serverId.trim() : '';
        if (!id) {
            throw new Error('Plugin MCP server id must be provided.');
        }
        const serverRecord = pluginServersById.get(id);
        if (!serverRecord) {
            throw new Error(`No plugin MCP server registered with id "${id}".`);
        }
        const pluginRecord = pluginRecords.get(serverRecord.pluginId);
        if (!pluginRecord) {
            throw new Error(`Plugin "${serverRecord.pluginId}" is not registered.`);
        }
        if (pluginRecord.status !== 'active') {
            throw new Error(`Plugin "${pluginRecord.id}" is not active.`);
        }
        const context = {
            plugin: createPluginSnapshot(pluginRecord),
            get sdk() {
                if (!sdkInstance) {
                    throw new Error('Adaptive SDK is not initialized for MCP server connections.');
                }
                return sdkInstance;
            },
            signal: options.signal
        };
        return Promise.resolve(serverRecord.connect(options.connection ?? options, context));
    };

    const whenPluginsReady = () => {
        const tasks = Array.from(pluginRegistrationTasks);
        if (tasks.length === 0) {
            return Promise.resolve(listPlugins({ includeInactive: true }));
        }
        return Promise.allSettled(tasks).then(() => listPlugins({ includeInactive: true }));
    };

    const createPluginMatcher = (selector) => {
        if (!selector) {
            return () => ({ matched: true });
        }
        if (typeof selector === 'function') {
            return (record) => {
                try {
                    const outcome = selector(record);
                    if (!outcome) {
                        return { matched: false };
                    }
                    if (outcome !== true) {
                        return { matched: true, value: outcome };
                    }
                    return { matched: true };
                } catch (error) {
                    return { matched: true, error: error instanceof Error ? error : new Error(String(error)) };
                }
            };
        }
        if (typeof selector === 'string') {
            const expected = selector.trim();
            return (record) => (record.id === expected || record.name === expected)
                ? { matched: true }
                : { matched: false };
        }
        if (typeof selector === 'object') {
            const expectedId = selector.id ? String(selector.id).trim() : null;
            const expectedName = selector.name ? String(selector.name).trim() : null;
            const requiredTags = selector.tags ? new Set(mergeStringCollections(selector.tags)) : null;
            const requiredCapabilities = selector.capabilities ? new Set(mergeStringCollections(selector.capabilities)) : null;
            const predicate = typeof selector.predicate === 'function' ? selector.predicate : null;
            return (record) => {
                if (expectedId && record.id !== expectedId) {
                    return { matched: false };
                }
                if (expectedName && record.name !== expectedName) {
                    return { matched: false };
                }
                if (requiredTags) {
                    const tagSet = new Set(record.tags || []);
                    for (const tag of requiredTags) {
                        if (!tagSet.has(tag)) {
                            return { matched: false };
                        }
                    }
                }
                if (requiredCapabilities) {
                    const capabilitySet = new Set(record.capabilities || []);
                    for (const capability of requiredCapabilities) {
                        if (!capabilitySet.has(capability)) {
                            return { matched: false };
                        }
                    }
                }
                if (predicate) {
                    try {
                        const outcome = predicate(record);
                        if (!outcome) {
                            return { matched: false };
                        }
                        if (outcome !== true) {
                            return { matched: true, value: outcome };
                        }
                    } catch (error) {
                        return { matched: true, error: error instanceof Error ? error : new Error(String(error)) };
                    }
                }
                return { matched: true };
            };
        }
        return () => ({ matched: false });
    };

    const whenPluginReady = (selector, options = {}) => {
        if (Array.isArray(selector)) {
            const matchers = selector.map(entry => createPluginMatcher(entry));
            const results = new Array(matchers.length);
            const resolved = new Set();

            return new Promise((resolve, reject) => {
                const attempt = (record) => {
                    if (record.status !== 'active') {
                        return false;
                    }
                    let progressed = false;
                    for (let index = 0; index < matchers.length; index++) {
                        if (resolved.has(index)) {
                            continue;
                        }
                        const outcome = matchers[index](record);
                        if (!outcome) {
                            continue;
                        }
                        if (outcome.error) {
                            reject(outcome.error instanceof Error ? outcome.error : new Error(String(outcome.error)));
                            return true;
                        }
                        if (outcome.matched) {
                            resolved.add(index);
                            results[index] = outcome.value ?? createPluginSnapshot(record);
                            progressed = true;
                        }
                    }
                    if (resolved.size === matchers.length) {
                        resolve(results);
                        return true;
                    }
                    return progressed;
                };

                const waiter = {
                    attempt,
                    cleanup: null,
                    reject
                };

                const cleanup = () => {
                    if (waiter.timeoutId) {
                        clearTimeout(waiter.timeoutId);
                        waiter.timeoutId = null;
                    }
                    if (waiter.abortListener && options.signal) {
                        options.signal.removeEventListener('abort', waiter.abortListener);
                    }
                    pluginReadyWaiters.delete(waiter);
                };
                waiter.cleanup = cleanup;

                for (const record of pluginRecords.values()) {
                    if (attempt(record)) {
                        cleanup();
                        return;
                    }
                }

                if (options.signal?.aborted) {
                    reject(getAbortReason(options.signal, 'Aborted waiting for plugin readiness.'));
                    return;
                }

                if (typeof options.timeoutMs === 'number' && options.timeoutMs > 0) {
                    waiter.timeoutId = setTimeout(() => {
                        cleanup();
                        reject(new Error('Timed out waiting for plugin readiness.'));
                    }, options.timeoutMs);
                }

                if (options.signal) {
                    waiter.abortListener = () => {
                        cleanup();
                        reject(getAbortReason(options.signal, 'Aborted waiting for plugin readiness.'));
                    };
                    options.signal.addEventListener('abort', waiter.abortListener, { once: true });
                }

                pluginReadyWaiters.add(waiter);
            });
        }

        const matcher = createPluginMatcher(selector);

        return new Promise((resolve, reject) => {
            const waiter = {
                attempt(record) {
                    if (record.status !== 'active') {
                        return false;
                    }
                    const outcome = matcher(record);
                    if (!outcome) {
                        return false;
                    }
                    if (outcome.error) {
                        reject(outcome.error instanceof Error ? outcome.error : new Error(String(outcome.error)));
                        return true;
                    }
                    if (outcome.matched) {
                        resolve(outcome.value ?? createPluginSnapshot(record));
                        return true;
                    }
                    return false;
                },
                cleanup: null,
                reject
            };

            const cleanup = () => {
                if (waiter.timeoutId) {
                    clearTimeout(waiter.timeoutId);
                    waiter.timeoutId = null;
                }
                if (waiter.abortListener && options.signal) {
                    options.signal.removeEventListener('abort', waiter.abortListener);
                }
                pluginReadyWaiters.delete(waiter);
            };
            waiter.cleanup = cleanup;

            for (const record of pluginRecords.values()) {
                if (waiter.attempt(record)) {
                    cleanup();
                    return;
                }
            }

            if (options.signal?.aborted) {
                reject(getAbortReason(options.signal, 'Aborted waiting for plugin readiness.'));
                return;
            }

            if (typeof options.timeoutMs === 'number' && options.timeoutMs > 0) {
                waiter.timeoutId = setTimeout(() => {
                    cleanup();
                    reject(new Error('Timed out waiting for plugin readiness.'));
                }, options.timeoutMs);
            }

            if (options.signal) {
                waiter.abortListener = () => {
                    cleanup();
                    reject(getAbortReason(options.signal, 'Aborted waiting for plugin readiness.'));
                };
                options.signal.addEventListener('abort', waiter.abortListener, { once: true });
            }

            pluginReadyWaiters.add(waiter);
        });
    };


    const watchPlugins = (selectorOrListener, maybeListenerOrOptions, maybeOptions) => {
        let selector = selectorOrListener;
        let listener = maybeListenerOrOptions;
        let options = maybeOptions;

        if (typeof selectorOrListener === 'function' && typeof maybeListenerOrOptions !== 'function') {
            listener = selectorOrListener;
            options = maybeListenerOrOptions || {};
            selector = options.selector;
        } else {
            options = options || {};
        }

        if (options && options.selector !== undefined && selector === undefined) {
            selector = options.selector;
        }

        if (typeof listener !== 'function') {
            throw new Error('Plugin watcher must supply a listener function.');
        }

        const includeExisting = options.includeExisting !== false;
        const once = options.once === true;
        const matcher = createPluginMatcher(selector);
        const errorHandler = typeof options.onError === 'function' ? options.onError : null;

        let active = true;
        let abortListener = null;
        let deliveredAbortError = false;

        const toError = (reason, fallbackMessage) => {
            if (reason instanceof Error) {
                return reason;
            }
            if (reason === undefined || reason === null) {
                return new Error(fallbackMessage);
            }
            return new Error(String(reason));
        };

        const handleError = (reason, event) => {
            const failure = toError(reason, 'Plugin watcher encountered an error.');
            if (!active && event === null && options.signal?.aborted) {
                if (deliveredAbortError) {
                    return;
                }
                deliveredAbortError = true;
            }
            if (errorHandler) {
                try {
                    errorHandler(failure, event ?? null);
                } catch (handlerError) {
                    console.warn('[AdaptiveSDK] Plugin watch error handler failed', handlerError);
                }
            } else {
                console.warn('[AdaptiveSDK] Plugin watcher listener failed', failure);
            }
        };

        const unsubscribe = () => {
            if (!active) {
                return;
            }
            active = false;
            if (listenerWrapper) {
                pluginEventWatchers.delete(listenerWrapper);
            }
            if (abortListener && options.signal) {
                options.signal.removeEventListener('abort', abortListener);
                abortListener = null;
            }
        };

        const listenerWrapper = (event) => {
            if (!active) {
                return;
            }
            if (!includeExisting && event?.type === 'existing') {
                return;
            }

            const outcome = matchPluginEvent(matcher, event);
            if (!outcome) {
                return;
            }

            if (outcome.error) {
                handleError(outcome.error, event);
                return;
            }

            if (!outcome.matched) {
                return;
            }

            const pluginEvent = outcome.snapshot
                ? { ...event, plugin: outcome.snapshot }
                : event;

            const value = Object.prototype.hasOwnProperty.call(outcome, 'value')
                ? outcome.value
                : outcome.snapshot ?? pluginEvent?.plugin ?? null;

            try {
                listener(value, pluginEvent);
            } catch (error) {
                handleError(error, pluginEvent);
            }

            if (once) {
                unsubscribe();
            }
        };

        if (options.signal?.aborted) {
            active = false;
            const reason = options.signal.reason;
            if (reason !== undefined && reason !== null) {
                handleError(reason, null);
            }
            return () => {};
        }

        pluginEventWatchers.add(listenerWrapper);

        if (options.signal) {
            abortListener = () => {
                const reason = options.signal.reason;
                unsubscribe();
                if (reason !== undefined && reason !== null) {
                    handleError(reason, null);
                }
            };
            options.signal.addEventListener('abort', abortListener, { once: true });
        }

        if (includeExisting) {
            for (const record of pluginRecords.values()) {
                if (!active) {
                    break;
                }
                const existingEvent = createExistingPluginEvent(record);
                if (existingEvent) {
                    listenerWrapper(existingEvent);
                }
            }
        }

        return unsubscribe;
    };


    const streamPlugins = (selectorOrOptions, maybeOptions) => {
        let selector = selectorOrOptions;
        let options = maybeOptions;

        if ((selectorOrOptions === undefined || (typeof selectorOrOptions === 'object' && selectorOrOptions !== null && !Array.isArray(selectorOrOptions)))
            && maybeOptions === undefined) {
            const potentialOptions = selectorOrOptions || {};
            if ('includeExisting' in potentialOptions || 'signal' in potentialOptions || 'selector' in potentialOptions) {
                options = potentialOptions;
                selector = options.selector;
            }
        }

        options = options || {};

        if (options.selector !== undefined && selector === undefined) {
            selector = options.selector;
        }

        const includeExisting = options.includeExisting !== false;
        const matcher = createPluginMatcher(selector);

        return {
            [Symbol.asyncIterator]() {
                const queue = [];
                let ended = false;
                let error = null;
                let notify = null;
                let cleaned = false;
                let abortListener = null;

                const wake = () => {
                    if (notify) {
                        const callback = notify;
                        notify = null;
                        callback();
                    }
                };

                const cleanup = () => {
                    if (cleaned) {
                        return;
                    }
                    cleaned = true;
                    pluginEventWatchers.delete(listener);
                    if (options.signal && abortListener) {
                        options.signal.removeEventListener('abort', abortListener);
                    }
                };

                const pushEvent = (event) => {
                    if (ended) {
                        return;
                    }

                    const outcome = matchPluginEvent(matcher, event);
                    if (!outcome) {
                        return;
                    }
                    if (outcome.error) {
                        ended = true;
                        error = outcome.error instanceof Error
                            ? outcome.error
                            : new Error(String(outcome.error));
                        wake();
                        return;
                    }
                    if (!outcome.matched) {
                        return;
                    }

                    const pluginEvent = outcome.snapshot
                        ? { ...event, plugin: outcome.snapshot }
                        : event;
                    queue.push(pluginEvent);
                    wake();
                };

                const listener = (event) => {
                    pushEvent(event);
                };

                if (includeExisting) {
                    for (const record of pluginRecords.values()) {
                        const existingEvent = createExistingPluginEvent(record);
                        if (existingEvent) {
                            pushEvent(existingEvent);
                        }
                    }
                }

                pluginEventWatchers.add(listener);

                if (options.signal) {
                    if (options.signal.aborted) {
                        ended = true;
                        error = getAbortReason(options.signal, 'Plugin stream aborted.');
                    } else {
                        abortListener = () => {
                            ended = true;
                            error = getAbortReason(options.signal, 'Plugin stream aborted.');
                            wake();
                        };
                        options.signal.addEventListener('abort', abortListener, { once: true });
                    }
                }

                return {
                    async next() {
                        if (queue.length === 0) {
                            if (ended) {
                                cleanup();
                                if (error) {
                                    throw error;
                                }
                                return { done: true, value: undefined };
                            }
                            await new Promise(resolve => {
                                notify = resolve;
                            });
                            if (queue.length === 0) {
                                cleanup();
                                if (error) {
                                    throw error;
                                }
                                return { done: true, value: undefined };
                            }
                        }
                        const value = queue.shift();
                        return { done: false, value };
                    },
                    async return() {
                        cleanup();
                        return { done: true, value: undefined };
                    },
                    async throw(err) {
                        cleanup();
                        throw err;
                    }
                };
            }
        };
    };

    const collectPlugins = (selector, options = {}) => {
        const matcher = createPluginMatcher(selector);
        const includeExisting = options.includeExisting !== false;
        const distinct = options.distinct !== false;
        const targetCountRaw = typeof options.count === 'number' ? options.count : undefined;
        const targetCount = Number.isFinite(targetCountRaw)
            ? Math.max(0, Math.floor(targetCountRaw))
            : 1;

        return new Promise((resolve, reject) => {
            const results = [];
            const seenPlugins = distinct ? new Set() : null;
            let listenerRegistered = false;
            let timeoutId = null;
            let completed = false;
            let abortListener = null;

            const cleanup = () => {
                if (listenerRegistered) {
                    pluginEventWatchers.delete(listener);
                    listenerRegistered = false;
                }
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (abortListener && options.signal) {
                    options.signal.removeEventListener('abort', abortListener);
                    abortListener = null;
                }
            };

            const finishWith = (value, error = null) => {
                if (completed) {
                    return;
                }
                completed = true;
                cleanup();
                if (error) {
                    const failure = error instanceof Error ? error : new Error(String(error));
                    reject(failure);
                } else {
                    resolve(Array.isArray(value) ? value.slice() : value);
                }
            };

            const fail = (reason) => {
                const failure = reason instanceof Error ? reason : new Error(String(reason ?? 'Plugin collection failed.'));
                finishWith(null, failure);
            };

            const deliverMatch = (event) => {
                if (completed) {
                    return;
                }

                const outcome = matchPluginEvent(matcher, event);
                if (!outcome) {
                    return;
                }

                if (outcome.error) {
                    fail(outcome.error);
                    return;
                }

                if (!outcome.matched) {
                    return;
                }

                const pluginEvent = outcome.snapshot
                    ? { ...event, plugin: outcome.snapshot }
                    : event;

                if (distinct && pluginEvent?.plugin) {
                    const key = pluginEvent.plugin.id ?? pluginEvent.plugin.name ?? null;
                    if (key) {
                        if (seenPlugins.has(key)) {
                            return;
                        }
                        seenPlugins.add(key);
                    }
                }

                const value = Object.prototype.hasOwnProperty.call(outcome, 'value')
                    ? outcome.value
                    : pluginEvent;

                results.push(value);

                if (results.length >= targetCount) {
                    finishWith(results);
                }
            };

            const listener = (event) => {
                deliverMatch(event);
            };

            if (targetCount === 0) {
                if (options.signal?.aborted) {
                    fail(options.signal.reason || new Error('Plugin collection aborted.'));
                    return;
                }
                finishWith([]);
                return;
            }

            if (options.signal) {
                if (options.signal.aborted) {
                    fail(options.signal.reason || new Error('Plugin collection aborted.'));
                    return;
                }
                abortListener = () => {
                    fail(options.signal.reason || new Error('Plugin collection aborted.'));
                };
                options.signal.addEventListener('abort', abortListener, { once: true });
            }

            if (typeof options.timeoutMs === 'number' && options.timeoutMs > 0) {
                timeoutId = setTimeout(() => {
                    fail(new Error('Timed out collecting plugins.'));
                }, options.timeoutMs);
            }

            if (includeExisting) {
                for (const record of pluginRecords.values()) {
                    if (completed) {
                        break;
                    }
                    const existingEvent = createExistingPluginEvent(record);
                    if (existingEvent) {
                        deliverMatch(existingEvent);
                    }
                }
            }

            if (completed) {
                return;
            }

            pluginEventWatchers.add(listener);
            listenerRegistered = true;
        });
    };

    const trackPlugins = (selector, options = {}) => {
        const includeExisting = options.includeExisting !== false;
        const matcher = createPluginMatcher(selector);
        const keyStrategy = options.key ?? 'auto';
        const records = new Map();
        const changeListeners = new Set();
        let active = true;
        let abortListener = null;

        const toError = (reason, fallbackMessage) => {
            if (reason instanceof Error) {
                return reason;
            }
            if (reason === undefined || reason === null) {
                return new Error(fallbackMessage);
            }
            return new Error(String(reason));
        };

        const detachSignal = () => {
            if (abortListener && options.signal) {
                options.signal.removeEventListener('abort', abortListener);
                abortListener = null;
            }
        };

        const emitChange = (change) => {
            if (changeListeners.size === 0) {
                return;
            }
            const detail = Object.freeze({
                ...change,
                active
            });
            for (const listener of changeListeners) {
                try {
                    listener(detail);
                } catch (error) {
                    console.warn('[AdaptiveSDK] Plugin tracker listener failed', error);
                }
            }
        };

        const notifyError = (reason, event, context) => {
            const failure = toError(reason, 'Plugin tracking failed.');
            if (typeof options.onError === 'function') {
                try {
                    options.onError(failure, event ?? null, context ?? null);
                } catch (handlerError) {
                    console.warn('[AdaptiveSDK] Plugin tracker error handler failed', handlerError);
                }
            } else {
                console.warn('[AdaptiveSDK] Plugin tracker encountered an error', failure);
            }
            emitChange({
                type: 'error',
                error: failure,
                event: event ?? null,
                context: context ?? null
            });
        };

        const deriveKey = (event) => {
            if (typeof options.key === 'function') {
                try {
                    return options.key(event.plugin ?? null, event);
                } catch (error) {
                    notifyError(error, event, 'key');
                    return undefined;
                }
            }
            switch (keyStrategy) {
                case 'id':
                case 'pluginId':
                    return event.plugin?.id ?? null;
                case 'plugin':
                    return event.plugin ?? null;
                case 'event':
                    return event;
                case 'auto':
                default:
                    return event.plugin?.id ?? event.plugin ?? null;
            }
        };

        const storeMatch = (event) => {
            if (!active) {
                return;
            }
            if (!includeExisting && event?.type === 'existing') {
                return;
            }

            const outcome = matchPluginEvent(matcher, event);
            if (!outcome) {
                return;
            }

            if (outcome.error) {
                notifyError(outcome.error, event, 'matcher');
                return;
            }

            if (!outcome.matched) {
                return;
            }

            const pluginEvent = outcome.snapshot
                ? { ...event, plugin: outcome.snapshot }
                : event;

            const hasValue = Object.prototype.hasOwnProperty.call(outcome, 'value');
            const value = hasValue ? outcome.value : pluginEvent;

            const key = deriveKey(pluginEvent);
            if (key === undefined || key === null) {
                notifyError(new Error('Plugin tracker could not derive a key for the matched plugin.'), pluginEvent, 'key');
                return;
            }

            const previous = records.get(key) || null;
            const timestamp = Date.now();
            const record = Object.freeze({
                key,
                plugin: pluginEvent.plugin ?? null,
                event: pluginEvent,
                value,
                metadata: snapshotPluginEventMeta(pluginEvent),
                seenAt: previous?.seenAt ?? timestamp,
                updatedAt: timestamp
            });

            records.set(key, record);

            emitChange({
                type: previous ? 'update' : 'add',
                key,
                record,
                previous,
                value,
                event: pluginEvent,
                replay: false
            });
        };

        const listener = (event) => {
            storeMatch(event);
        };

        const stop = (reason) => {
            if (!active) {
                return;
            }
            active = false;
            pluginEventWatchers.delete(listener);
            detachSignal();
            emitChange({
                type: 'dispose',
                reason: reason === undefined ? null : toError(reason, 'Plugin tracking disposed.')
            });
            changeListeners.clear();
        };

        const tracker = {
            get active() {
                return active;
            },
            get size() {
                return records.size;
            },
            has(key) {
                return records.has(key);
            },
            get(key) {
                return records.get(key) || null;
            },
            keys() {
                return Array.from(records.keys());
            },
            values() {
                return Array.from(records.values());
            },
            entries() {
                return Array.from(records.entries());
            },
            snapshot() {
                return Array.from(records.values());
            },
            forEach(callback) {
                if (typeof callback !== 'function') {
                    throw new Error('Plugin tracker forEach callback must be a function.');
                }
                for (const [key, record] of records.entries()) {
                    callback(record, key, this);
                }
            },
            subscribe(listener, subscribeOptions = {}) {
                if (typeof listener !== 'function') {
                    throw new Error('Plugin tracker subscriber must be a function.');
                }
                changeListeners.add(listener);
                if (subscribeOptions.replay !== false) {
                    for (const record of records.values()) {
                        const change = Object.freeze({
                            type: 'add',
                            key: record.key,
                            record,
                            previous: null,
                            value: record.value,
                            event: record.event,
                            replay: true,
                            active
                        });
                        try {
                            listener(change);
                        } catch (error) {
                            console.warn('[AdaptiveSDK] Plugin tracker subscriber replay failed', error);
                        }
                    }
                }
                return () => {
                    changeListeners.delete(listener);
                };
            },
            dispose(reason) {
                stop(reason);
            }
        };

        Object.defineProperty(tracker, Symbol.iterator, {
            value: function* () {
                for (const record of records.values()) {
                    yield record;
                }
            }
        });

        if (options.signal?.aborted) {
            stop(options.signal.reason);
            return Object.freeze(tracker);
        }

        pluginEventWatchers.add(listener);

        if (includeExisting) {
            for (const record of pluginRecords.values()) {
                if (!active) {
                    break;
                }
                const existingEvent = createExistingPluginEvent(record);
                if (existingEvent) {
                    storeMatch(existingEvent);
                }
            }
        }

        if (options.signal) {
            abortListener = () => {
                const reason = options.signal.reason;
                stop(reason);
            };
            options.signal.addEventListener('abort', abortListener, { once: true });
        }

        return Object.freeze(tracker);
    };

    const createPluginEventTarget = (selector, options = {}) => {
        const includeExisting = options.includeExisting !== false;
        const once = options.once === true;
        const eventName = typeof options.eventName === 'string' && options.eventName.trim()
            ? options.eventName.trim()
            : 'plugin';
        const errorEventName = typeof options.errorEventName === 'string' && options.errorEventName.trim()
            ? options.errorEventName.trim()
            : 'pluginerror';
        const disposeEventName = typeof options.disposeEventName === 'string' && options.disposeEventName.trim()
            ? options.disposeEventName.trim()
            : 'plugindispose';
        const projectDetail = typeof options.detail === 'function'
            ? options.detail
            : (value, event) => ({
                value,
                event,
                metadata: snapshotPluginEventMeta(event)
            });
        const userErrorHandler = typeof options.onError === 'function' ? options.onError : null;

        const rawTarget = typeof EventTarget === 'function'
            ? new EventTarget()
            : createFallbackEventTarget();

        const addEventListenerToTarget = rawTarget.addEventListener
            ? rawTarget.addEventListener.bind(rawTarget)
            : rawTarget.addEventListener;
        const removeEventListenerFromTarget = rawTarget.removeEventListener
            ? rawTarget.removeEventListener.bind(rawTarget)
            : rawTarget.removeEventListener;
        const dispatchEventFromTarget = rawTarget.dispatchEvent
            ? rawTarget.dispatchEvent.bind(rawTarget)
            : rawTarget.dispatchEvent;

        const abortController = new AbortController();
        let externalAbortListener = null;
        let unsubscribe = null;
        let listenerRegistered = false;
        let disposed = false;

        const emit = (type, detail, allowWhenDisposed = false) => {
            if (!allowWhenDisposed && disposed) {
                return;
            }
            const eventInit = { detail };
            let event;
            if (typeof CustomEvent === 'function') {
                try {
                    event = new CustomEvent(type, eventInit);
                } catch (error) {
                    console.warn('[AdaptiveSDK] Failed to create plugin CustomEvent', error);
                }
            }
            if (!event) {
                event = {
                    type,
                    detail,
                    target: rawTarget,
                    currentTarget: rawTarget,
                    defaultPrevented: false,
                    preventDefault() {
                        this.defaultPrevented = true;
                    }
                };
            }
            try {
                dispatchEventFromTarget(event);
            } catch (error) {
                console.warn('[AdaptiveSDK] Plugin event target dispatch failed', error);
            }
        };

        const scheduleEmit = (type, detail, allowWhenDisposed = false) => {
            scheduleMicrotask(() => emit(type, detail, allowWhenDisposed));
        };

        const handleError = (error, event) => {
            const failure = error instanceof Error ? error : new Error(String(error));
            const detail = {
                error: failure,
                event: event ?? null,
                metadata: event ? snapshotPluginEventMeta(event) : null
            };
            scheduleEmit(errorEventName, detail, true);
            if (userErrorHandler) {
                try {
                    userErrorHandler(failure, event ?? null);
                } catch (handlerError) {
                    console.warn('[AdaptiveSDK] Plugin event target error handler failed', handlerError);
                }
            }
        };

        const stop = (reason) => {
            if (disposed) {
                return;
            }
            disposed = true;

            const wasRegistered = listenerRegistered;

            if (!abortController.signal.aborted) {
                if (reason !== undefined && reason !== null) {
                    abortController.abort(reason);
                } else {
                    abortController.abort();
                }
            }

            if (listenerRegistered && typeof unsubscribe === 'function') {
                try {
                    unsubscribe();
                } catch (error) {
                    console.warn('[AdaptiveSDK] Plugin event target cleanup failed', error);
                }
            }
            listenerRegistered = false;
            unsubscribe = null;

            if (externalAbortListener && options.signal) {
                options.signal.removeEventListener('abort', externalAbortListener);
                externalAbortListener = null;
            }

            scheduleEmit(disposeEventName, {
                reason: reason ?? null,
                active: false
            }, true);

            if (!wasRegistered && reason !== undefined && reason !== null) {
                handleError(reason, null);
            }
        };

        const deliverMatch = (value, event) => {
            if (disposed) {
                return;
            }

            let detail;
            try {
                detail = projectDetail(value, event);
            } catch (error) {
                handleError(error, event);
                return;
            }

            const payload = detail === undefined
                ? { value, event, metadata: snapshotPluginEventMeta(event) }
                : detail;

            scheduleEmit(eventName, payload);

            if (once) {
                scheduleMicrotask(() => stop());
            }
        };

        const watcherOptions = {
            includeExisting,
            signal: abortController.signal,
            onError: handleError
        };

        unsubscribe = watchPlugins(selector, (value, event) => {
            deliverMatch(value, event);
        }, watcherOptions);
        listenerRegistered = typeof unsubscribe === 'function';

        if (options.signal) {
            if (options.signal.aborted) {
                stop(options.signal.reason);
            } else {
                externalAbortListener = () => {
                    stop(options.signal.reason ?? new Error('Plugin event target aborted.'));
                };
                options.signal.addEventListener('abort', externalAbortListener, { once: true });
            }
        }

        const facade = {
            get target() {
                return rawTarget;
            },
            get signal() {
                return abortController.signal;
            },
            get active() {
                return !disposed;
            },
            addEventListener(type, listener, options) {
                addEventListenerToTarget(type, listener, options);
            },
            removeEventListener(type, listener, options) {
                removeEventListenerFromTarget(type, listener, options);
            },
            dispatchEvent(event) {
                return dispatchEventFromTarget(event);
            },
            dispose(reason) {
                stop(reason);
            },
            abort(reason) {
                stop(reason ?? new Error('Plugin event target aborted.'));
            }
        };

        return Object.freeze(facade);
    };

    const createPluginStream = (selector, options = {}) => {
        const streamConstructor = options.ReadableStream
            || options.streamConstructor
            || (typeof ReadableStream === 'function' ? ReadableStream : null);

        if (typeof streamConstructor !== 'function') {
            throw new Error(
                'ReadableStream constructor is not available. Provide one via options.ReadableStream.'
            );
        }

        const includeExisting = options.includeExisting !== false;
        const abortController = new AbortController();

        const toError = (reason, fallbackMessage) => {
            if (reason instanceof Error) {
                return reason;
            }
            if (reason === undefined || reason === null) {
                return new Error(fallbackMessage);
            }
            return new Error(String(reason));
        };

        let externalAbortListener = null;

        const detachExternalAbort = () => {
            if (externalAbortListener && options.signal) {
                options.signal.removeEventListener('abort', externalAbortListener);
                externalAbortListener = null;
            }
        };

        const abortUpstream = (reason, fallbackMessage) => {
            if (!abortController.signal.aborted) {
                abortController.abort(toError(reason, fallbackMessage));
            }
            detachExternalAbort();
        };

        const createIterable = () => streamPlugins(selector, {
            includeExisting,
            signal: abortController.signal
        });

        if (options.signal) {
            if (options.signal.aborted) {
                abortUpstream(options.signal.reason, 'Plugin readable stream aborted.');
            } else {
                externalAbortListener = () => {
                    abortUpstream(options.signal.reason, 'Plugin readable stream aborted.');
                };
                options.signal.addEventListener('abort', externalAbortListener, { once: true });
            }
        }

        let iterator = null;
        let finalized = false;

        const ensureIterator = () => {
            if (!iterator) {
                iterator = createIterable()[Symbol.asyncIterator]();
            }
            return iterator;
        };

        const finalizeIterator = async () => {
            if (finalized) {
                return;
            }
            finalized = true;
            detachExternalAbort();
            const current = iterator;
            iterator = null;
            if (current && typeof current.return === 'function') {
                try {
                    await current.return();
                } catch (error) {
                    console.warn('[AdaptiveSDK] Plugin stream iterator finalization failed', error);
                }
            }
        };

        return new streamConstructor({
            async pull(controller) {
                try {
                    const result = await ensureIterator().next();
                    if (result.done) {
                        controller.close();
                        await finalizeIterator();
                        return;
                    }
                    controller.enqueue(result.value);
                } catch (error) {
                    controller.error(error);
                    await finalizeIterator();
                }
            },
            async cancel(reason) {
                abortUpstream(reason, 'Plugin readable stream cancelled.');
                await finalizeIterator();
            }
        }, options.queuingStrategy);
    };

    const sdk = {
        engine,
        sensoryBridge: engine.sensoryBridge,
        layoutSynthesizer: engine.layoutSynthesizer,
        telemetry: engine.telemetry,
        projectionComposer: engine.projectionComposer,
        projectionSimulator: engine.projectionSimulator,
        licenseManager,
        licenseAttestor,
        registerLayoutStrategy: engine.registerLayoutStrategy.bind(engine),
        registerLayoutAnnotation: engine.registerLayoutAnnotation.bind(engine),
        registerTelemetryProvider: engine.registerTelemetryProvider.bind(engine),
        registerTelemetryProviders(entries, options = {}) {
            const list = Array.isArray(entries) ? entries : [entries];
            if (options.replace ?? false) {
                engine.telemetry.providers = new Map();
                telemetryProviderMetadataByProvider = new WeakMap();
                telemetryProviderMetadataById.clear();
            }
            const source = options.source ?? 'runtime';
            const tasks = [];
            const registrationMeta = {
                source,
                registrationSource: options.registrationSource ?? source,
                tags: options.tags,
                bundle: options.bundle,
                capabilities: options.capabilities
            };
            for (const entry of list) {
                const result = instantiateTelemetryProviderEntry(entry, registrationMeta);
                if (result && typeof result.then === 'function') {
                    tasks.push(result);
                }
            }
            if (tasks.length === 0) {
                return Promise.resolve();
            }
            return Promise.allSettled(tasks).then(() => undefined);
        },
        registerTelemetryRequestMiddleware: engine.registerTelemetryRequestMiddleware.bind(engine),
        clearTelemetryRequestMiddleware: engine.clearTelemetryRequestMiddleware.bind(engine),
        whenTelemetryProvidersReady,
        whenTelemetryProviderReady,
        streamTelemetryProviders,
        watchTelemetryProviders,
        collectTelemetryProviders,
        createTelemetryProviderEventTarget,
        trackTelemetryProviders,
        createTelemetryProviderStream,
        onTelemetryProviderRegistered(listener) {
            if (typeof listener !== 'function') {
                throw new Error('Telemetry provider listener must be a function.');
            }
            telemetryProviderWatchers.add(listener);
            for (const provider of engine.telemetry.providers.values()) {
                try {
                    const event = createExistingTelemetryProviderEvent(provider);
                    listener(event);
                } catch (error) {
                    console.warn('[AdaptiveSDK] Telemetry provider listener failed', error);
                }
            }
            return () => {
                telemetryProviderWatchers.delete(listener);
            };
        },
        registerLicenseAttestationProfile: engine.registerLicenseAttestationProfile.bind(engine),
        registerLicenseAttestationProfilePack: engine.registerLicenseAttestationProfilePack.bind(engine),
        getLicenseAttestationProfiles: engine.telemetry.getLicenseAttestationProfiles.bind(engine.telemetry),
        getLicenseAttestationProfile: engine.telemetry.getLicenseAttestationProfile.bind(engine.telemetry),
        setDefaultLicenseAttestationProfile: engine.setDefaultLicenseAttestationProfile.bind(engine),
        setLicenseAttestorFromProfile(profileId, overrides = {}) {
            const result = engine.applyLicenseAttestationProfile(profileId, overrides);
            if (result?.attestor) {
                licenseAttestor = result.attestor;
                licenseAttestorBindingOptions = result.binding || {};
                this.licenseAttestor = licenseAttestor;
            }
            return result;
        },
        registerSensorSchema: engine.registerSensorSchema.bind(engine),
        registerSensorAdapter: engine.registerSensorAdapter.bind(engine),
        connectSensorAdapter: engine.connectSensorAdapter.bind(engine),
        disconnectSensorAdapter: engine.disconnectSensorAdapter.bind(engine),
        testSensorAdapter: engine.testSensorAdapter.bind(engine),
        updateTelemetryConsent: engine.telemetry.updateConsent.bind(engine.telemetry),
        getTelemetryConsent: engine.telemetry.getConsentSnapshot.bind(engine.telemetry),
        getTelemetryAuditTrail: engine.getTelemetryAuditTrail.bind(engine),
        getLicenseCommercializationSummary: engine.getLicenseCommercializationSummary.bind(engine),
        getLicenseCommercializationReporter: engine.getLicenseCommercializationReporter.bind(engine),
        getLicenseCommercializationSnapshotStore: engine.getLicenseCommercializationSnapshotStore.bind(engine),
        captureLicenseCommercializationSnapshot: engine.captureLicenseCommercializationSnapshot.bind(engine),
        getLicenseCommercializationSnapshots: engine.getLicenseCommercializationSnapshots.bind(engine),
        getLicenseCommercializationKpiReport: engine.getLicenseCommercializationKpiReport.bind(engine),
        exportLicenseCommercializationSnapshots: engine.exportLicenseCommercializationSnapshots.bind(engine),
        startLicenseCommercializationSnapshotSchedule: engine.startLicenseCommercializationSnapshotSchedule.bind(engine),
        stopLicenseCommercializationSnapshotSchedule: engine.stopLicenseCommercializationSnapshotSchedule.bind(engine),
        setLicense(license) {
            if (!licenseManager) {
                throw new Error('No license manager configured for this SDK instance.');
            }
            licenseManager.setLicense(license);
        },
        validateLicense(context) {
            if (!licenseManager) {
                throw new Error('No license manager configured for this SDK instance.');
            }
            return licenseManager.validate(context);
        },
        getLicenseStatus() {
            if (!licenseManager) {
                throw new Error('No license manager configured for this SDK instance.');
            }
            return licenseManager.getStatus();
        },
        getLicenseHistory() {
            if (!licenseManager) {
                throw new Error('No license manager configured for this SDK instance.');
            }
            return licenseManager.getValidationHistory();
        },
        getLicenseAttestationHistory() {
            if (!licenseAttestor || typeof licenseAttestor.getHistory !== 'function') {
                return [];
            }
            return licenseAttestor.getHistory();
        },
        composeProjectionField(blueprintOrLayout, design, context, options) {
            return engine.composeProjectionField(blueprintOrLayout, design, context, options);
        },
        getProjectionFrame() {
            return engine.getProjectionFrame();
        },
        stepProjectionSimulation(options) {
            return engine.stepProjectionSimulation(options);
        },
        registerProjectionScenario(descriptor) {
            return engine.registerProjectionScenario(descriptor);
        },
        removeProjectionScenario(id) {
            return engine.removeProjectionScenario(id);
        },
        listProjectionScenarios() {
            return engine.listProjectionScenarios();
        },
        getProjectionScenario(id) {
            return engine.getProjectionScenario(id);
        },
        setActiveProjectionScenario(id) {
            return engine.setActiveProjectionScenario(id);
        },
        getActiveProjectionScenario() {
            return engine.getActiveProjectionScenario();
        },
        setLicenseAttestor(attestor, options = {}) {
            if (attestor && typeof attestor.createValidator !== 'function' && typeof attestor.bindToLicenseManager !== 'function') {
                throw new Error('Invalid license attestor provided.');
            }
            if (attestor && typeof attestor.createValidator !== 'function') {
                attestor = new RemoteLicenseAttestor(attestor);
            }
            licenseAttestor = attestor;
            licenseAttestorBindingOptions = options;
            engine.telemetry.setLicenseAttestor(licenseAttestor, licenseAttestorBindingOptions);
            this.licenseAttestor = licenseAttestor;
        },
        requestLicenseAttestation(context = {}) {
            if (!licenseManager) {
                throw new Error('No license manager configured for this SDK instance.');
            }
            return licenseManager.validate({ ...context, trigger: 'manual-attestation' });
        },
        onLicenseStatusChange(listener) {
            if (!licenseManager || typeof licenseManager.onStatusChange !== 'function') {
                throw new Error('No license manager configured for this SDK instance.');
            }
            return licenseManager.onStatusChange(listener);
        },
        registerPlugin,
        registerPlugins,
        unregisterPlugin,
        activatePlugin,
        deactivatePlugin,
        listPlugins,
        getPlugin,
        listPluginCommands,
        listPluginAgents,
        listPluginHooks,
        listPluginServers,
        executePluginCommand,
        invokePluginAgent,
        dispatchPluginHook,
        connectPluginServer,
        whenPluginsReady,
        whenPluginReady,
        watchPlugins,
        streamPlugins,
        collectPlugins,
        trackPlugins,
        createPluginEventTarget,
        createPluginStream,
        createConsentPanel(options = {}) {
            const consentOptions = options.consentOptions ?? defaultConsentOptions;
            return baseCreateConsentPanel({
                ...options,
                consentOptions
            });
        }
    };

    sdkInstance = sdk;

    if (Array.isArray(config.plugins)) {
        registerPlugins(config.plugins, { source: 'config' }).catch(error => {
            console.warn('[AdaptiveSDK] Failed to register configured plugins', error);
        });
    }

    return sdk;
}
