import { describe, it, expect, vi } from 'vitest';
import { createAdaptiveSDK } from '../../src/core/AdaptiveSDK.js';

function createHeadlessAdaptiveSDK(config = {}) {
  const { environment, ...rest } = config;
  return createAdaptiveSDK({
    ...rest,
    environment: {
      mode: 'headless',
      ...(environment || {})
    }
  });
}

describe('createAdaptiveSDK', () => {
  it('creates a consent panel using default consent options', () => {
    const container = document.createElement('div');
    const sdk = createHeadlessAdaptiveSDK({
      consentOptions: [
        { classification: 'analytics', title: 'Analytics', description: 'Allow aggregated analytics' }
      ]
    });

    const onConsentToggle = vi.fn();

    const panel = sdk.createConsentPanel({
      container,
      getTelemetryConsent: () => ({ analytics: false }),
      onConsentToggle,
      getComplianceRecords: () => [],
      getTelemetryAuditTrail: () => []
    });

    panel.mount();

    const toggles = container.querySelectorAll('.consent-toggle');
    expect(toggles.length).toBe(1);
    expect(toggles[0].querySelector('span')?.textContent).toBe('Analytics');

    const input = toggles[0].querySelector('input');
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onConsentToggle).toHaveBeenCalledWith('analytics', true);

    panel.destroy();
  });

  it('forwards request middleware registration to telemetry providers', () => {
    const provider = {
      id: 'stub-provider',
      registerRequestMiddleware: vi.fn()
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [provider]
    });

    const middleware = () => {};
    sdk.registerTelemetryRequestMiddleware(middleware);

    expect(provider.registerRequestMiddleware).toHaveBeenCalledWith(middleware);
  });

  it('configures remote license attestation helpers', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.includes('attest')) {
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({ valid: true });
          }
        };
      }
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ revoked: false, entitlements: [] });
        }
      };
    });

    const sdk = createHeadlessAdaptiveSDK({
      license: {
        key: 'remote-license',
        expiresAt: '2025-12-31T00:00:00Z',
        autoValidate: false,
        attestor: {
          attestationUrl: 'https://licensing.example/attest',
          revocationUrl: 'https://licensing.example/revoke',
          entitlementsUrl: 'https://licensing.example/entitlements',
          fetch: fetchMock,
          pollIntervalMs: 1000,
          minimumPollIntervalMs: 50
        },
        attestorBinding: {
          bindToLicenseManager: true,
          attestorOptions: { immediate: false }
        }
      }
    });

    const status = await sdk.requestLicenseAttestation();

    expect(status.state).toBe('valid');
    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(sdk.getLicenseAttestationHistory())).toBe(true);
  });

  it('registers and applies license attestation profiles during bootstrap', () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ valid: true });
      }
    }));

    const sdk = createHeadlessAdaptiveSDK({
      licenseAttestationProfiles: [
        {
          id: 'profile-default',
          attestor: {
            attestationUrl: 'https://licensing.example/profile/attest',
            fetch: fetchMock
          },
          binding: { attestorOptions: { immediate: true } },
          sla: { failOpen: true }
        }
      ],
      defaultLicenseAttestationProfileId: 'profile-default',
      license: {
        key: 'profile-license',
        attestorProfileId: 'profile-default',
        autoValidate: false
      }
    });

    const profiles = sdk.getLicenseAttestationProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.id).toBe('profile-default');

    const applied = sdk.setLicenseAttestorFromProfile('profile-default', {
      binding: { attestorOptions: { immediate: false } }
    });

    expect(applied.binding.attestorOptions).toEqual({ immediate: false });
    expect(sdk.licenseAttestor).toBe(applied.attestor);
  });

  it('bootstraps license attestation profile packs via config', () => {
    const sdk = createHeadlessAdaptiveSDK({
      licenseAttestationProfilePackId: 'enterprise-saas',
      licenseAttestationProfilePackOptions: {
        regions: ['global', 'emea'],
        baseUrl: 'https://licensing.partner.example.com'
      }
    });

    const profiles = sdk.getLicenseAttestationProfiles();
    const ids = profiles.map(profile => profile.id);

    expect(ids).toContain('enterprise-saas/global');
    expect(ids).toContain('enterprise-saas/emea');
    expect(sdk.telemetry.getAuditTrail().some(entry => entry.event === 'system.license.attestation_profile_pack_registered')).toBe(true);
  });

  it('bootstraps without browser DOM when using headless mode', () => {
    const sdk = createHeadlessAdaptiveSDK();

    expect(sdk.engine.environment.mode).toBe('headless');
    expect(() => sdk.updateTelemetryConsent({ analytics: true })).not.toThrow();
    expect(Array.isArray(sdk.telemetry.getAuditTrail())).toBe(true);
  });

  it('supports telemetry provider factories and readiness tracking', async () => {
    const factoryProvider = {
      id: 'factory-provider',
      registerRequestMiddleware: vi.fn()
    };
    const asyncProvider = {
      id: 'async-provider',
      registerRequestMiddleware: vi.fn()
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [
        () => factoryProvider,
        {
          factory: async () => {
            await Promise.resolve();
            return asyncProvider;
          }
        }
      ]
    });

    await sdk.whenTelemetryProvidersReady();

    const middleware = () => {};
    sdk.registerTelemetryRequestMiddleware(middleware);

    expect(factoryProvider.registerRequestMiddleware).toHaveBeenCalledWith(middleware);
    expect(asyncProvider.registerRequestMiddleware).toHaveBeenCalledWith(middleware);
  });

  it('gates telemetry provider descriptors and broadcasts registration events', async () => {
    const eagerProvider = {
      id: 'eager-provider',
      registerRequestMiddleware: vi.fn()
    };
    const skippedProvider = {
      id: 'skipped-provider',
      registerRequestMiddleware: vi.fn()
    };
    const lateProvider = {
      id: 'late-provider',
      registerRequestMiddleware: vi.fn()
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [
        {
          guard: () => false,
          factory: () => skippedProvider
        },
        {
          when: () => Promise.resolve(true),
          resolve: async () => {
            await Promise.resolve();
            return eagerProvider;
          }
        }
      ]
    });

    await sdk.whenTelemetryProvidersReady();

    expect(sdk.telemetry.providers.has('eager-provider')).toBe(true);
    expect(sdk.telemetry.providers.has('skipped-provider')).toBe(false);

    const events = [];
    const unsubscribe = sdk.onTelemetryProviderRegistered(event => {
      events.push({ id: event.provider.id, source: event.source });
    });

    expect(events.some(event => event.id === 'eager-provider' && event.source === 'existing')).toBe(true);

    await sdk.registerTelemetryProviders(
      {
        when: () => new Promise(resolve => setTimeout(() => resolve(true), 0)),
        module: async () => ({ default: lateProvider }),
        timeoutMs: 50
      },
      { source: 'runtime' }
    );

    await sdk.whenTelemetryProvidersReady();

    expect(sdk.telemetry.providers.has('late-provider')).toBe(true);
    expect(events.some(event => event.id === 'late-provider' && event.source === 'runtime')).toBe(true);

    const middleware = () => {};
    sdk.registerTelemetryRequestMiddleware(middleware);

    expect(eagerProvider.registerRequestMiddleware).toHaveBeenCalledWith(middleware);
    expect(lateProvider.registerRequestMiddleware).toHaveBeenCalledWith(middleware);

    unsubscribe();
  });

  it('awaits telemetry provider readiness by id, array, or predicate', async () => {
    const immediateProvider = {
      id: 'immediate-provider',
      registerRequestMiddleware: vi.fn()
    };

    const lateProvider = {
      id: 'late-provider',
      registerRequestMiddleware: vi.fn()
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true
    });

    await sdk.registerTelemetryProviders(immediateProvider, { source: 'runtime' });

    const immediateEvent = await sdk.whenTelemetryProviderReady('immediate-provider');

    expect(immediateEvent.provider).toBe(immediateProvider);
    expect(immediateEvent.source).toBe('existing');
    expect(immediateEvent.registrationSource).toBe('runtime');

    const arrayPromise = sdk.whenTelemetryProviderReady([
      'immediate-provider',
      'late-provider'
    ]);

    const predicatePromise = sdk.whenTelemetryProviderReady(provider => provider?.id === 'late-provider');

    const registrationPromise = sdk.registerTelemetryProviders(
      {
        factory: async () => {
          await Promise.resolve();
          return lateProvider;
        }
      },
      { source: 'runtime' }
    );

    await registrationPromise;

    const [arrayEvents, predicateEvent] = await Promise.all([arrayPromise, predicatePromise]);

    expect(Array.isArray(arrayEvents)).toBe(true);
    expect(arrayEvents[0]?.provider).toBe(immediateProvider);
    expect(arrayEvents[0]?.source).toBe('existing');
    expect(arrayEvents[0]?.registrationSource).toBe('runtime');
    expect(arrayEvents[1]?.provider).toBe(lateProvider);
    expect(arrayEvents[1]?.source).toBe('runtime');
    expect(arrayEvents[1]?.registrationSource).toBe('runtime');

    expect(predicateEvent.provider).toBe(lateProvider);
    expect(predicateEvent.source).toBe('runtime');
    expect(predicateEvent.registrationSource).toBe('runtime');
  });

  it('matches telemetry provider readiness using metadata selectors', async () => {
    const taggedProvider = {
      id: 'tagged-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['stream']
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [
        {
          tags: ['analytics', 'streaming'],
          bundle: 'core/analytics',
          capabilities: ['async'],
          factory: () => taggedProvider
        }
      ]
    });

    const existingEvent = await sdk.whenTelemetryProviderReady({
      tags: ['analytics'],
      anyCapability: ['async', 'stream'],
      bundle: 'core/analytics'
    });

    expect(existingEvent.provider).toBe(taggedProvider);
    expect(existingEvent.source).toBe('existing');
    expect(existingEvent.registrationSource).toBe('config');
    expect(existingEvent.tags).toEqual(expect.arrayContaining(['analytics', 'streaming']));
    expect(existingEvent.capabilities).toEqual(expect.arrayContaining(['async', 'stream']));
    expect(existingEvent.bundle).toBe('core/analytics');

    const runtimeProvider = {
      id: 'runtime-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: { streaming: true }
    };

    const runtimeEventPromise = sdk.whenTelemetryProviderReady({
      id: 'runtime-provider',
      source: 'runtime',
      anyTag: ['runtime'],
      registrationSource: 'runtime'
    });

    await sdk.registerTelemetryProviders(runtimeProvider, {
      source: 'runtime',
      tags: ['runtime'],
      bundle: 'runtime/ingest',
      capabilities: ['on-demand']
    });

    const runtimeEvent = await runtimeEventPromise;

    expect(runtimeEvent.provider).toBe(runtimeProvider);
    expect(runtimeEvent.source).toBe('runtime');
    expect(runtimeEvent.registrationSource).toBe('runtime');
    expect(runtimeEvent.tags).toEqual(expect.arrayContaining(['runtime']));
    expect(runtimeEvent.bundle).toBe('runtime/ingest');
    expect(runtimeEvent.capabilities).toEqual(expect.arrayContaining(['on-demand', 'streaming']));
  });

  it('streams telemetry providers with selectors, includeExisting controls, and abort handling', async () => {
    const analyticsProvider = {
      id: 'analytics-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['ingest']
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [
        {
          tags: ['analytics', 'core'],
          bundle: 'core/analytics',
          capabilities: ['stream'],
          factory: () => analyticsProvider
        }
      ]
    });

    const projectedStream = sdk.streamTelemetryProviders(
      {
        tags: ['analytics'],
        project: (_provider, event) => ({
          id: event.provider.id,
          bundle: event.bundle,
          tags: event.tags,
          capabilities: event.capabilities
        })
      }
    );

    const projectedIterator = projectedStream[Symbol.asyncIterator]();
    const projectedResult = await projectedIterator.next();

    expect(projectedResult.done).toBe(false);
    expect(projectedResult.value.id).toBe('analytics-provider');
    expect(projectedResult.value.bundle).toBe('core/analytics');
    expect(projectedResult.value.tags).toEqual(
      expect.arrayContaining(['analytics', 'core'])
    );
    expect(projectedResult.value.capabilities).toEqual(
      expect.arrayContaining(['stream', 'ingest'])
    );

    await projectedIterator.return?.();

    const runtimeProvider = {
      id: 'runtime-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['live']
    };

    const runtimeStream = sdk.streamTelemetryProviders(
      { id: 'runtime-provider' },
      { includeExisting: false }
    );
    const runtimeIterator = runtimeStream[Symbol.asyncIterator]();
    const runtimeNextPromise = runtimeIterator.next();

    await sdk.registerTelemetryProviders(runtimeProvider, {
      source: 'runtime',
      tags: ['runtime'],
      bundle: 'runtime/ingest',
      capabilities: ['async']
    });

    const runtimeResult = await runtimeNextPromise;

    expect(runtimeResult.done).toBe(false);
    expect(runtimeResult.value.provider).toBe(runtimeProvider);
    expect(runtimeResult.value.source).toBe('runtime');
    expect(runtimeResult.value.registrationSource).toBe('runtime');
    expect(runtimeResult.value.tags).toEqual(expect.arrayContaining(['runtime']));
    expect(runtimeResult.value.bundle).toBe('runtime/ingest');
    expect(runtimeResult.value.capabilities).toEqual(
      expect.arrayContaining(['async', 'live'])
    );

    await runtimeIterator.return?.();

    const abortController = new AbortController();
    const abortStream = sdk.streamTelemetryProviders('never-provider', {
      signal: abortController.signal
    });
    const abortIterator = abortStream[Symbol.asyncIterator]();
    const abortPromise = abortIterator.next();

    abortController.abort(new Error('stop stream'));

    await expect(abortPromise).rejects.toThrow('stop stream');
  });

  it('creates readable telemetry provider streams with projections and abort handling', async () => {
    const analyticsProvider = {
      id: 'analytics-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['ingest']
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [
        {
          tags: ['analytics', 'core'],
          bundle: 'core/analytics',
          capabilities: ['stream'],
          factory: () => analyticsProvider
        }
      ]
    });

    const stream = sdk.createTelemetryProviderStream(
      {
        tags: ['analytics'],
        project: (_provider, event) => ({
          id: event.provider.id,
          tags: event.tags,
          bundle: event.bundle
        })
      }
    );

    const reader = stream.getReader();
    const first = await reader.read();

    expect(first.done).toBe(false);
    expect(first.value.id).toBe('analytics-provider');
    expect(first.value.tags).toEqual(expect.arrayContaining(['analytics', 'core']));
    expect(first.value.bundle).toBe('core/analytics');

    await reader.cancel();

    const runtimeProvider = {
      id: 'runtime-provider',
      registerRequestMiddleware: vi.fn()
    };

    const runtimeStream = sdk.createTelemetryProviderStream(
      { id: 'runtime-provider' },
      { includeExisting: false }
    );

    const runtimeReader = runtimeStream.getReader();
    const runtimePromise = runtimeReader.read();

    await sdk.registerTelemetryProviders(runtimeProvider, {
      source: 'runtime',
      tags: ['runtime'],
      bundle: 'runtime/ingest'
    });

    const runtimeValue = await runtimePromise;

    expect(runtimeValue.done).toBe(false);
    expect(runtimeValue.value.provider).toBe(runtimeProvider);
    expect(runtimeValue.value.source).toBe('runtime');
    expect(runtimeValue.value.bundle).toBe('runtime/ingest');

    await runtimeReader.cancel();

    const abortController = new AbortController();
    const abortStream = sdk.createTelemetryProviderStream('never-provider', {
      signal: abortController.signal
    });

    const abortReader = abortStream.getReader();
    const abortPromise = abortReader.read();

    abortController.abort(new Error('stop readable stream'));

    await expect(abortPromise).rejects.toThrow('stop readable stream');
  });

  it('collects telemetry providers with selectors, counts, and cancellation controls', async () => {
    const analyticsProvider = {
      id: 'analytics-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['ingest']
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [
        {
          tags: ['analytics', 'core'],
          bundle: 'core/analytics',
          capabilities: ['stream'],
          factory: () => analyticsProvider
        }
      ]
    });

    const existingCollection = await sdk.collectTelemetryProviders({ tags: ['analytics'] });

    expect(existingCollection).toHaveLength(1);
    expect(existingCollection[0]?.provider).toBe(analyticsProvider);
    expect(existingCollection[0]?.source).toBe('existing');
    expect(existingCollection[0]?.bundle).toBe('core/analytics');

    const runtimeProvider = {
      id: 'runtime-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['live']
    };

    const projectedPromise = sdk.collectTelemetryProviders(
      {
        anyTag: ['analytics', 'runtime'],
        project: (_provider, event) => ({
          id: event.provider.id,
          bundle: event.bundle,
          tags: event.tags,
          capabilities: event.capabilities
        })
      },
      { count: 2 }
    );

    await sdk.registerTelemetryProviders(runtimeProvider, {
      source: 'runtime',
      tags: ['runtime'],
      bundle: 'runtime/ingest',
      capabilities: ['async']
    });

    const projectedResults = await projectedPromise;

    expect(projectedResults).toHaveLength(2);
    expect(projectedResults[0]?.id).toBe('analytics-provider');
    expect(projectedResults[0]?.bundle).toBe('core/analytics');
    expect(projectedResults[1]?.id).toBe('runtime-provider');
    expect(projectedResults[1]?.bundle).toBe('runtime/ingest');
    expect(projectedResults[1]?.tags).toEqual(expect.arrayContaining(['runtime']));
    expect(projectedResults[1]?.capabilities).toEqual(
      expect.arrayContaining(['async', 'live'])
    );

    const timeoutPromise = sdk.collectTelemetryProviders('never-provider', { timeoutMs: 10 });
    await expect(timeoutPromise).rejects.toThrow('Timed out collecting telemetry providers.');

    const abortController = new AbortController();
    const abortPromise = sdk.collectTelemetryProviders('never-provider', {
      signal: abortController.signal
    });
    abortController.abort(new Error('stop collection'));

    await expect(abortPromise).rejects.toThrow('stop collection');
  });

  it('watches telemetry providers with selectors, replay, once, and abort controls', async () => {
    const analyticsProvider = {
      id: 'analytics-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['ingest']
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [
        {
          tags: ['analytics', 'core'],
          bundle: 'core/analytics',
          capabilities: ['stream'],
          factory: () => analyticsProvider
        }
      ]
    });

    const replayedEvents = [];
    const unsubscribe = sdk.watchTelemetryProviders(
      { tags: ['analytics'] },
      (value, event) => {
        replayedEvents.push({
          id: value?.provider?.id,
          source: event?.source,
          bundle: event?.bundle,
          capabilities: event?.capabilities
        });
      }
    );

    expect(replayedEvents).toHaveLength(1);
    expect(replayedEvents[0]?.id).toBe('analytics-provider');
    expect(replayedEvents[0]?.source).toBe('existing');
    expect(replayedEvents[0]?.bundle).toBe('core/analytics');
    expect(replayedEvents[0]?.capabilities).toEqual(
      expect.arrayContaining(['stream', 'ingest'])
    );

    const runtimeProvider = {
      id: 'runtime-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['live']
    };

    await sdk.registerTelemetryProviders(runtimeProvider, {
      source: 'runtime',
      tags: ['analytics'],
      bundle: 'runtime/analytics',
      capabilities: ['async']
    });

    expect(replayedEvents).toHaveLength(2);
    expect(replayedEvents[1]?.id).toBe('runtime-provider');
    expect(replayedEvents[1]?.source).toBe('runtime');
    expect(replayedEvents[1]?.capabilities).toEqual(
      expect.arrayContaining(['async', 'live'])
    );

    unsubscribe();

    const projectedEvents = [];
    const filteredUnsubscribe = sdk.watchTelemetryProviders(
      { tags: ['analytics'] },
      (value) => {
        projectedEvents.push(value);
      },
      { includeExisting: false, once: true }
    );

    expect(projectedEvents).toHaveLength(0);

    const abortController = new AbortController();
    const watchErrors = [];
    const abortUnsubscribe = sdk.watchTelemetryProviders(
      'never-provider',
      () => {
        watchErrors.push(new Error('listener should not fire'));
      },
      {
        signal: abortController.signal,
        onError: (error) => {
          watchErrors.push(error);
        }
      }
    );

    abortController.abort(new Error('stop watch'));

    const lateProvider = {
      id: 'late-analytics',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['batch']
    };

    await sdk.registerTelemetryProviders(lateProvider, {
      source: 'runtime',
      tags: ['analytics'],
      bundle: 'runtime/analytics',
      capabilities: ['projected']
    });

    expect(projectedEvents).toHaveLength(1);
    expect(projectedEvents[0]?.provider).toBe(lateProvider);
    expect(projectedEvents[0]?.source).toBe('runtime');

    filteredUnsubscribe();
    abortUnsubscribe();

    expect(watchErrors).toHaveLength(1);
    expect(watchErrors[0]).toBeInstanceOf(Error);
    expect(watchErrors[0]?.message).toBe('stop watch');
  });

  it('creates telemetry provider event targets with detail projection and lifecycle events', async () => {
    const analyticsProvider = {
      id: 'analytics-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['ingest'],
      tags: ['analytics']
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [
        {
          tags: ['analytics', 'core'],
          bundle: 'core/analytics',
          capabilities: ['stream'],
          factory: () => analyticsProvider
        }
      ]
    });

    const flushMicrotasks = async () => {
      await Promise.resolve();
      await Promise.resolve();
    };

    const defaultTarget = sdk.createTelemetryProviderEventTarget({ tags: ['analytics'] });
    const defaultEvents = [];
    defaultTarget.addEventListener('telemetryprovider', (event) => {
      defaultEvents.push(event.detail);
    });

    await flushMicrotasks();

    expect(defaultEvents).toHaveLength(1);
    expect(defaultEvents[0]?.value?.provider).toBe(analyticsProvider);
    expect(defaultEvents[0]?.metadata?.bundle).toBe('core/analytics');
    expect(defaultEvents[0]?.metadata?.tags).toEqual(
      expect.arrayContaining(['analytics', 'core'])
    );

    defaultTarget.dispose();
    await flushMicrotasks();

    const events = [];
    const errors = [];
    const disposals = [];

    const target = sdk.createTelemetryProviderEventTarget(
      { tags: ['analytics'] },
      {
        includeExisting: false,
        eventName: 'provider',
        errorEventName: 'providererror',
        disposeEventName: 'providerdispose',
        detail: (value, event) => ({
          id: event.provider.id,
          source: event.source,
          tags: event.tags,
          value
        })
      }
    );

    target.addEventListener('provider', (event) => {
      events.push(event.detail);
    });
    target.addEventListener('providererror', (event) => {
      errors.push(event.detail);
    });
    target.addEventListener('providerdispose', (event) => {
      disposals.push(event.detail);
    });

    await flushMicrotasks();

    expect(events).toHaveLength(0);

    const runtimeProvider = {
      id: 'runtime-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['live']
    };

    await sdk.registerTelemetryProviders(runtimeProvider, {
      source: 'runtime',
      tags: ['analytics'],
      bundle: 'runtime/analytics',
      capabilities: ['async']
    });

    await flushMicrotasks();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'runtime-provider',
      source: 'runtime'
    });
    expect(events[0]?.tags).toEqual(expect.arrayContaining(['analytics']));
    expect(target.active).toBe(true);

    target.abort(new Error('stop target'));

    await flushMicrotasks();

    expect(target.active).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.error).toBeInstanceOf(Error);
    expect(errors[0]?.error.message).toBe('stop target');
    expect(disposals).toHaveLength(1);
    expect(disposals[0]?.reason).toBeInstanceOf(Error);
    expect(disposals[0]?.active).toBe(false);
  });

  it('tracks telemetry providers with auto keys and change subscriptions', async () => {
    const analyticsProvider = {
      id: 'analytics-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['ingest']
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [
        {
          tags: ['analytics', 'core'],
          bundle: 'core/analytics',
          capabilities: ['stream'],
          factory: () => analyticsProvider
        }
      ]
    });

    const tracker = sdk.trackTelemetryProviders({ tags: ['analytics'] });

    expect(tracker.active).toBe(true);
    expect(tracker.size).toBe(1);

    const snapshot = tracker.snapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]?.provider).toBe(analyticsProvider);
    expect(snapshot[0]?.metadata?.bundle).toBe('core/analytics');
    expect(snapshot[0]?.metadata?.tags).toEqual(
      expect.arrayContaining(['analytics', 'core'])
    );

    const changes = [];
    const unsubscribe = tracker.subscribe((change) => {
      changes.push(change);
    });

    const runtimeProvider = {
      id: 'runtime-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['live']
    };

    await sdk.registerTelemetryProviders(runtimeProvider, {
      source: 'runtime',
      tags: ['analytics', 'runtime'],
      bundle: 'runtime/analytics',
      capabilities: ['live']
    });

    const replacementProvider = {
      id: 'analytics-provider',
      registerRequestMiddleware: vi.fn(),
      capabilities: ['stream', 'refresh']
    };

    await sdk.registerTelemetryProviders(replacementProvider, {
      source: 'runtime',
      tags: ['analytics', 'core'],
      bundle: 'core/analytics',
      capabilities: ['stream', 'refresh']
    });

    unsubscribe();

    expect(tracker.size).toBe(2);
    const runtimeRecord = tracker.get('runtime-provider');
    expect(runtimeRecord?.provider).toBe(runtimeProvider);
    expect(runtimeRecord?.metadata?.bundle).toBe('runtime/analytics');
    expect(runtimeRecord?.metadata?.tags).toEqual(
      expect.arrayContaining(['analytics', 'runtime'])
    );

    const updatedRecord = tracker.get('analytics-provider');
    expect(updatedRecord?.provider).toBe(replacementProvider);
    expect(updatedRecord?.metadata?.capabilities).toEqual(
      expect.arrayContaining(['stream', 'refresh'])
    );

    expect(changes.length).toBeGreaterThanOrEqual(3);
    expect(changes[0]?.type).toBe('add');
    expect(changes[0]?.replay).toBe(true);
    expect(changes[0]?.record.provider).toBe(analyticsProvider);
    expect(changes.find((change) => change.type === 'add' && !change.replay)?.record.provider).toBe(runtimeProvider);
    expect(changes.find((change) => change.type === 'update')?.record.provider).toBe(replacementProvider);
  });

  it('tracks telemetry providers with custom keys and abort handling', async () => {
    const alphaProvider = {
      id: 'alpha-provider',
      registerRequestMiddleware: vi.fn(),
      cluster: 'alpha'
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [
        {
          tags: ['analytics'],
          bundle: 'core/alpha',
          capabilities: ['stream'],
          factory: () => alphaProvider
        }
      ]
    });

    const abortController = new AbortController();
    const changes = [];

    const tracker = sdk.trackTelemetryProviders(
      () => true,
      {
        key: (provider) => provider?.cluster,
        signal: abortController.signal,
        onError: (error) => {
          changes.push({ type: 'error', error });
        }
      }
    );

    tracker.subscribe((change) => {
      changes.push(change);
    });

    expect(tracker.has('alpha')).toBe(true);
    expect(tracker.get('alpha')?.provider).toBe(alphaProvider);

    const replacementProvider = {
      id: 'replacement-provider',
      registerRequestMiddleware: vi.fn(),
      cluster: 'alpha'
    };

    await sdk.registerTelemetryProviders(replacementProvider, {
      source: 'runtime',
      tags: ['analytics'],
      bundle: 'runtime/alpha'
    });

    expect(tracker.get('alpha')?.provider).toBe(replacementProvider);
    expect(changes.find((change) => change.type === 'update')?.record.provider).toBe(replacementProvider);

    abortController.abort(new Error('stop tracker'));

    expect(tracker.active).toBe(false);
    const disposeChange = changes.find((change) => change.type === 'dispose');
    expect(disposeChange?.reason).toBeInstanceOf(Error);
    expect(disposeChange?.reason?.message).toBe('stop tracker');

    const lateProvider = {
      id: 'late-provider',
      registerRequestMiddleware: vi.fn(),
      cluster: 'alpha'
    };

    await sdk.registerTelemetryProviders(lateProvider, {
      source: 'runtime',
      tags: ['analytics'],
      bundle: 'runtime/late'
    });

    expect(tracker.get('alpha')?.provider).toBe(replacementProvider);
    expect(
      changes.some((change) =>
        change.type !== 'dispose' && 'record' in change && change.record.provider === lateProvider
      )
    ).toBe(false);
  });

  it('respects includeExisting flags and manual disposal when tracking providers', async () => {
    const analyticsProvider = {
      id: 'analytics-provider',
      registerRequestMiddleware: vi.fn()
    };

    const sdk = createHeadlessAdaptiveSDK({
      replaceDefaultProviders: true,
      telemetryProviders: [analyticsProvider]
    });

    const tracker = sdk.trackTelemetryProviders('analytics-provider', {
      includeExisting: false
    });

    expect(tracker.size).toBe(0);

    const listener = vi.fn();
    tracker.subscribe(listener);

    const runtimeProvider = {
      id: 'analytics-provider',
      registerRequestMiddleware: vi.fn()
    };

    await sdk.registerTelemetryProviders(runtimeProvider, {
      source: 'runtime'
    });

    expect(tracker.size).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(tracker.get('analytics-provider')?.provider).toBe(runtimeProvider);

    tracker.dispose();

    expect(tracker.active).toBe(false);

    await sdk.registerTelemetryProviders(
      {
        id: 'late-runtime',
        registerRequestMiddleware: vi.fn()
      },
      { source: 'runtime' }
    );

    expect(tracker.size).toBe(1);
    expect(
      tracker.snapshot().some((record) => record.provider?.id === 'late-runtime')
    ).toBe(false);
  });

  describe('plugin orchestration', () => {
    it('watches plugins with selectors, includeExisting replay, once, and abort controls', async () => {
      const sdk = createHeadlessAdaptiveSDK({
        plugins: [
          {
            id: 'existing-plugin',
            tags: ['greeting']
          }
        ]
      });

      await sdk.whenPluginsReady();

      const initialEvents = [];
      const unsubscribeExisting = sdk.watchPlugins(
        { tags: ['greeting'] },
        (plugin, event) => {
          initialEvents.push({
            id: plugin?.id,
            type: event.type,
            source: event.source
          });
        }
      );

      expect(initialEvents).toHaveLength(1);
      expect(initialEvents[0]).toEqual(
        expect.objectContaining({ id: 'existing-plugin', type: 'existing' })
      );

      const onceEvents = [];
      sdk.watchPlugins(
        'runtime-plugin',
        (plugin, event) => {
          onceEvents.push({ id: plugin?.id, type: event.type });
        },
        { includeExisting: false, once: true }
      );

      await sdk.registerPlugin({
        id: 'runtime-plugin',
        tags: ['runtime']
      });

      expect(onceEvents).toEqual([
        expect.objectContaining({ id: 'runtime-plugin', type: 'registered' })
      ]);

      const abortErrors = [];
      const abortController = new AbortController();
      const abortUnsubscribe = sdk.watchPlugins(
        () => {
          throw new Error('listener should not be invoked');
        },
        {
          includeExisting: false,
          signal: abortController.signal,
          onError: (error) => abortErrors.push(error)
        }
      );
      abortController.abort(new Error('abort watch'));
      abortUnsubscribe();

      expect(abortErrors).toHaveLength(1);
      expect(abortErrors[0]).toBeInstanceOf(Error);
      expect(abortErrors[0]?.message).toBe('abort watch');

      unsubscribeExisting();
    });

    it('diagnoses plugin metadata and activation gaps', async () => {
      const sdk = createHeadlessAdaptiveSDK({
        plugins: [
          {
            id: 'healthy-plugin',
            description: 'Reference descriptor for diagnostics.',
            tags: ['demo'],
            capabilities: ['commands'],
            commands: [
              {
                name: 'hello',
                description: 'Say hello to prove metadata is wired.',
                response: 'hi'
              }
            ]
          },
          {
            id: 'needs-attention',
            activate: false,
            commands: [
              { name: 'ping', response: 'pong' },
              { name: 'no-description', response: 'noop' }
            ]
          }
        ]
      });

      await sdk.whenPluginsReady();

      const diagnostics = sdk.diagnosePlugins();
      const healthy = diagnostics.find((entry) => entry.plugin.id === 'healthy-plugin');
      const needsHelp = diagnostics.find((entry) => entry.plugin.id === 'needs-attention');

      expect(healthy?.issues).toEqual([]);
      expect(needsHelp?.severity).toBe('warning');
      expect(needsHelp?.issues.some((issue) => issue.code === 'plugin-inactive')).toBe(true);
      expect(needsHelp?.issues.some((issue) => issue.code === 'missing-plugin-description')).toBe(true);
      expect(needsHelp?.issues.some((issue) => issue.code === 'missing-plugin-tags')).toBe(true);
      expect(needsHelp?.issues.some((issue) => issue.code === 'missing-commands-capability')).toBe(true);
      expect(needsHelp?.issues.some((issue) => issue.code === 'command-missing-description')).toBe(true);
    });

    it('builds plugin onboarding guides with highlights and next steps', async () => {
      const sdk = createHeadlessAdaptiveSDK({
        plugins: [
          {
            id: 'complete-plugin',
            name: 'Complete Plugin',
            description: 'Demonstrates fully documented metadata.',
            tags: ['complete'],
            capabilities: ['commands', 'agents', 'hooks', 'mcp'],
            commands: [
              {
                name: 'hello',
                description: 'Say hello from the complete plugin.',
                response: 'hello there'
              }
            ],
            agents: [
              {
                name: 'helper-agent',
                description: 'Assists with onboarding.',
                run: () => 'ok'
              }
            ],
            hooks: [
              {
                event: 'session:start',
                handler: () => {}
              }
            ],
            mcpServers: [
              {
                id: 'complete-server',
                description: 'Example MCP server.',
                connect: () => ({ close() {} })
              }
            ]
          },
          {
            id: 'needs-polish',
            activate: false,
            commands: [
              { name: 'ping', response: 'pong' }
            ]
          }
        ]
      });

      await sdk.whenPluginsReady();

      const guide = sdk.buildPluginOnboardingGuide();
      expect(guide.overview.pluginTotal).toBe(2);
      expect(guide.overview.activePlugins).toBe(1);
      expect(guide.overview.diagnosticTotals.warning).toBeGreaterThan(0);
      expect(guide.highlights).toHaveLength(2);

      const completeHighlight = guide.highlights.find((entry) => entry.plugin.id === 'complete-plugin');
      expect(completeHighlight?.counts).toEqual(
        expect.objectContaining({ commands: 1, agents: 1, hooks: 1, servers: 1 })
      );
      expect(completeHighlight?.issues).toEqual([]);

      const needsPolish = guide.highlights.find((entry) => entry.plugin.id === 'needs-polish');
      expect(needsPolish?.severity).toBe('warning');
      expect(needsPolish?.issues.some((issue) => issue.code === 'plugin-inactive')).toBe(true);

      expect(guide.recommendations.some((rec) => rec.pluginId === 'needs-polish')).toBe(true);
      expect(guide.nextSteps).toContain(
        'Use `node bin/adaptive-sdk-cli.js diagnostics --json` to export health reports for CI gates.'
      );
      expect(guide.nextSteps.some((step) => step.includes('/hello'))).toBe(true);
    });

  it('collects plugin events with includeExisting, distinct, abort, and timeout options', async () => {
    const sdk = createHeadlessAdaptiveSDK();

    const collectPromise = sdk.collectPlugins(
        'collector-plugin',
        { count: 2, distinct: false, includeExisting: false }
      );

      await sdk.registerPlugin({
        id: 'collector-plugin',
        tags: ['collect']
      });

      const collectedEvents = await collectPromise;
      expect(collectedEvents).toHaveLength(2);
      expect(collectedEvents[0]?.type).toBe('registered');
      expect(collectedEvents[1]?.type).toBe('activated');

      const controller = new AbortController();
      const aborting = sdk.collectPlugins('missing-plugin', {
        signal: controller.signal
      });
      controller.abort(new Error('stop collection'));
      await expect(aborting).rejects.toThrow('stop collection');

      const withExisting = createHeadlessAdaptiveSDK({
        plugins: [
          {
            id: 'existing-collector',
            tags: ['collect']
          }
        ]
      });
      await withExisting.whenPluginsReady();
      const existingMatches = await withExisting.collectPlugins('existing-collector');
      expect(existingMatches).toHaveLength(1);
      expect(existingMatches[0]?.type).toBe('existing');
    });

    it('tracks plugin lifecycle events and metadata with change notifications', async () => {
      const sdk = createHeadlessAdaptiveSDK();

      const changes = [];
      const tracker = sdk.trackPlugins(
        { tags: ['tracked'] },
        {
          includeExisting: false,
          key: 'id',
          onError: (error, event, context) => {
            changes.push({ type: 'error', error, event, context });
          }
        }
      );

      tracker.subscribe((change) => {
        changes.push(change);
      });

      await sdk.registerPlugin({
        id: 'tracked-plugin',
        tags: ['tracked']
      });

      const record = tracker.get('tracked-plugin');
      expect(record).not.toBeNull();
      expect(record?.plugin?.id).toBe('tracked-plugin');
      expect(record?.metadata?.tags).toEqual(expect.arrayContaining(['tracked']));

      await sdk.unregisterPlugin('tracked-plugin');

      tracker.dispose();

      expect(changes.some((change) => change.type === 'add')).toBe(true);
      expect(changes.some((change) => change.type === 'update')).toBe(true);
      expect(changes.find((change) => change.type === 'dispose')).toBeDefined();
    });

    it('creates plugin event targets with detail projection and disposal events', async () => {
      const sdk = createHeadlessAdaptiveSDK();

      const target = sdk.createPluginEventTarget(
        'event-target-plugin',
        {
          includeExisting: false,
          detail: (plugin, event) => ({
            summary: `${event.type}:${plugin?.id ?? 'unknown'}`
          })
        }
      );

      const summaries = [];
      const disposals = [];
      target.addEventListener('plugin', (event) => {
        summaries.push(event.detail.summary);
      });
      target.addEventListener('plugindispose', (event) => {
        disposals.push(event.detail);
      });

      await sdk.registerPlugin({
        id: 'event-target-plugin',
        tags: ['target']
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(summaries).toEqual([
        'registered:event-target-plugin',
        'activated:event-target-plugin'
      ]);

      target.abort(new Error('stop target'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(target.active).toBe(false);
      expect(disposals).toHaveLength(1);
      expect(disposals[0]?.reason).toBeInstanceOf(Error);
      expect(disposals[0]?.active).toBe(false);
    });

    it('creates plugin readable streams from plugin iterators', async () => {
      const sdk = createHeadlessAdaptiveSDK();

    const stream = sdk.createPluginStream('streamed-plugin', {
      includeExisting: false
    });

    const reader = stream.getReader();

      const registration = sdk.registerPlugin({
        id: 'streamed-plugin',
        tags: ['stream']
      });

      const first = await reader.read();
      expect(first.done).toBe(false);
      expect(first.value.plugin?.id).toBe('streamed-plugin');

      await registration;
      await reader.cancel();
    });

    it('registers plugins and executes commands, agents, hooks, and servers', async () => {
      const commandHandler = vi.fn(({ name }) => ({ greeting: `Hello ${name}!` }));
      const agentHandler = vi.fn(() => 'agent-result');
      const hookHandler = vi.fn();
      const connectHandler = vi.fn((options) => ({ connected: true, options }));

      const sdk = createHeadlessAdaptiveSDK();

      const pluginSnapshot = await sdk.registerPlugin({
        id: 'greeting-plugin',
        name: 'Greeting Plugin',
        tags: ['greeting'],
        capabilities: ['commands', 'agents'],
        commands: [
          {
            name: 'hello',
            description: 'Say hello',
            run: commandHandler
          }
        ],
        agents: [
          {
            name: 'helper',
            run: agentHandler
          }
        ],
        hooks: [
          {
            event: 'welcome',
            handler: hookHandler
          }
        ],
        mcpServers: [
          {
            id: 'greeting-server',
            connect: connectHandler
          }
        ]
      });

      expect(pluginSnapshot.id).toBe('greeting-plugin');
      expect(pluginSnapshot.status).toBe('active');

      const commandResult = await sdk.executePluginCommand('hello', { name: 'Ada' });
      expect(commandHandler).toHaveBeenCalledWith(
        { name: 'Ada' },
        expect.objectContaining({ plugin: expect.objectContaining({ id: 'greeting-plugin' }) })
      );
      expect(commandResult).toEqual({ greeting: 'Hello Ada!' });

      const agentResult = await sdk.invokePluginAgent('helper');
      expect(agentHandler).toHaveBeenCalled();
      expect(agentResult).toBe('agent-result');

      const hookResults = await sdk.dispatchPluginHook('welcome', { user: 'Ada' });
      expect(hookHandler).toHaveBeenCalledWith(
        { user: 'Ada' },
        expect.objectContaining({ event: 'welcome', plugin: expect.objectContaining({ id: 'greeting-plugin' }) })
      );
      expect(hookResults).toHaveLength(1);
      expect(hookResults[0]?.pluginId).toBe('greeting-plugin');

      const connectionResult = await sdk.connectPluginServer('greeting-server', { token: 'secret' });
      expect(connectHandler).toHaveBeenCalledWith(
        { token: 'secret' },
        expect.objectContaining({ plugin: expect.objectContaining({ id: 'greeting-plugin' }) })
      );
      expect(connectionResult).toEqual({ connected: true, options: { token: 'secret' } });

      expect(sdk.listPlugins()).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'greeting-plugin', status: 'active' })])
      );
      expect(sdk.listPluginCommands()).toEqual(
        expect.arrayContaining([expect.objectContaining({ pluginId: 'greeting-plugin', name: 'hello' })])
      );
      expect(sdk.listPluginAgents()).toEqual(
        expect.arrayContaining([expect.objectContaining({ pluginId: 'greeting-plugin', name: 'helper' })])
      );
      expect(sdk.listPluginServers()).toEqual(
        expect.arrayContaining([expect.objectContaining({ pluginId: 'greeting-plugin', id: 'greeting-server' })])
      );
    });

    it('supports static plugin command descriptors for quickstart workflows', async () => {
      const sdk = createHeadlessAdaptiveSDK();

      await sdk.registerPlugin({
        id: 'static-plugin',
        commands: [
          {
            name: 'hello',
            description: 'Render a greeting snippet',
            content: '# Hello Command\n\nBe welcoming and helpful.',
            format: 'markdown',
            title: 'Hello Command',
            metadata: { scope: 'demo' },
            response: {
              metadata: { variant: 'static' }
            }
          },
          {
            name: 'ping',
            response: 'pong'
          }
        ]
      });

      const helloFirst = await sdk.executePluginCommand('hello');
      expect(helloFirst).toEqual({
        type: 'static',
        format: 'markdown',
        content: '# Hello Command\n\nBe welcoming and helpful.',
        title: 'Hello Command',
        metadata: expect.objectContaining({ scope: 'demo', variant: 'static' })
      });

      helloFirst.metadata.variant = 'mutated';

      const helloSecond = await sdk.executePluginCommand('hello');
      expect(helloSecond).not.toBe(helloFirst);
      expect(helloSecond.metadata).toEqual(
        expect.objectContaining({ scope: 'demo', variant: 'static' })
      );

      const pingResult = await sdk.executePluginCommand('ping');
      expect(pingResult).toEqual({
        type: 'static',
        format: 'text',
        content: 'pong'
      });

      const commandInfo = sdk
        .listPluginCommands()
        .find((entry) => entry.pluginId === 'static-plugin' && entry.name === 'hello');

      expect(commandInfo?.metadata).toEqual(
        expect.objectContaining({ scope: 'demo', variant: 'static' })
      );
    });

    it('streams plugin events and resolves readiness promises', async () => {
      const sdk = createHeadlessAdaptiveSDK();

      const controller = new AbortController();
      const streamIterator = sdk.streamPlugins({ signal: controller.signal })[Symbol.asyncIterator]();
      const readiness = sdk.whenPluginReady({ id: 'async-plugin' });

      const registration = sdk.registerPlugin(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          id: 'async-plugin',
          tags: ['async', 'beta'],
          commands: [
            {
              name: 'ping',
              run: () => 'pong'
            }
          ]
        };
      });

      const firstEvent = await streamIterator.next();
      expect(firstEvent.done).toBe(false);
      expect(firstEvent.value.plugin?.id).toBe('async-plugin');

      const snapshot = await readiness;
      expect(snapshot.id).toBe('async-plugin');
      expect(snapshot.tags).toEqual(expect.arrayContaining(['async', 'beta']));

      const pingResult = await sdk.executePluginCommand('ping');
      expect(pingResult).toBe('pong');

      controller.abort(new Error('stop stream'));
      await streamIterator.return();
      await registration;
    });
  });
});
