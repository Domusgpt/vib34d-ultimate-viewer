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

    return {
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
        createConsentPanel(options = {}) {
            const consentOptions = options.consentOptions ?? defaultConsentOptions;
            return baseCreateConsentPanel({
                ...options,
                consentOptions
            });
        }
    };
}
