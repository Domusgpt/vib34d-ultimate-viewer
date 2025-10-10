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

    const createTelemetryProviderEvent = (provider, meta = {}) => ({
        provider,
        descriptor: meta.descriptor ?? null,
        entry: meta.entry ?? null,
        source: meta.source ?? 'config',
        options: meta.descriptor?.options ?? meta.options
    });

    const createTelemetryProviderWaiterState = (selector) => {
        if (Array.isArray(selector)) {
            const order = [...selector];
            const pending = new Set(order);
            const collected = new Map();
            return {
                handle(event) {
                    const providerId = event.provider?.id;
                    if (providerId && pending.has(providerId)) {
                        pending.delete(providerId);
                        collected.set(providerId, event);
                    }
                    if (pending.size === 0) {
                        return { matched: true, value: order.map(id => collected.get(id) ?? null) };
                    }
                    return { matched: false };
                }
            };
        }

        if (selector instanceof RegExp) {
            const pattern = selector;
            return {
                handle(event) {
                    const providerId = event.provider?.id;
                    if (typeof providerId !== 'string') {
                        return { matched: false };
                    }
                    pattern.lastIndex = 0;
                    if (pattern.test(providerId)) {
                        return { matched: true, value: event };
                    }
                    return { matched: false };
                }
            };
        }

        if (typeof selector === 'function') {
            return {
                handle(event) {
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
                        return { matched: true, error };
                    }
                }
            };
        }

        const expectedId = typeof selector === 'object' && selector !== null && 'id' in selector
            ? selector.id
            : selector;

        return {
            handle(event) {
                if (expectedId === undefined || expectedId === null || expectedId === '') {
                    return { matched: true, value: event };
                }
                if (event.provider?.id === expectedId) {
                    return { matched: true, value: event };
                }
                return { matched: false };
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
                const event = createTelemetryProviderEvent(provider, { source: 'existing' });
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

    const telemetryDescriptorContext = {
        engine,
        telemetry: engine.telemetry,
        config,
        environment: engine.environment,
        whenProvidersReady: whenTelemetryProvidersReady,
        whenProviderReady: whenTelemetryProviderReady
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
            options: descriptor.options ?? meta.options
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
            }
            const source = options.source ?? 'runtime';
            const tasks = [];
            for (const entry of list) {
                const result = instantiateTelemetryProviderEntry(entry, { source });
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
        onTelemetryProviderRegistered(listener) {
            if (typeof listener !== 'function') {
                throw new Error('Telemetry provider listener must be a function.');
            }
            telemetryProviderWatchers.add(listener);
            for (const provider of engine.telemetry.providers.values()) {
                try {
                    listener({
                        provider,
                        descriptor: null,
                        entry: null,
                        source: 'existing',
                        options: undefined
                    });
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
