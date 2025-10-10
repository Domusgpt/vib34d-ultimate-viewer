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
});
