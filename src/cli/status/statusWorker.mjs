import { stdin, exit } from 'node:process';

async function readPayload() {
  return new Promise((resolve, reject) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', chunk => {
      data += chunk;
    });
    stdin.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    stdin.on('error', reject);
  });
}

async function main() {
  const payload = await readPayload();
  const { buildAdaptiveSdkConfig } = await import('../runAdaptiveSdkCli.mjs');
  const { createAdaptiveSDK } = await import('../../core/AdaptiveSDK.js');

  const config = await buildAdaptiveSdkConfig({
    environment: payload.environment,
    demo: payload.demo,
    configPath: payload.configPath
  });

  const sdk = createAdaptiveSDK(config);
  const report = {
    metadata: {
      environment: payload.environment,
      demo: Boolean(payload.demo),
      generatedAt: new Date().toISOString(),
      configSource: payload.configPath || 'embedded',
      version: payload.packageVersion || '0.0.0'
    }
  };

  try {
    const licenseManager = sdk.licenseManager || null;
    let licenseStatus = licenseManager ? licenseManager.getStatus() : { state: 'unconfigured', reason: 'NO_LICENSE' };

    if (licenseManager && payload.validate !== false) {
      licenseStatus = await licenseManager.validate({
        source: 'adaptive-sdk-cli',
        environment: payload.environment,
        demo: Boolean(payload.demo)
      });
    }

    const telemetry = sdk.telemetry;
    telemetry.track('cli.status.invoked', {
      environment: payload.environment,
      demo: Boolean(payload.demo),
      version: report.metadata.version
    }, { classification: 'system' });
    telemetry.identify('adaptive-sdk-cli', {
      environment: payload.environment,
      mode: payload.demo ? 'demo' : 'standard'
    }, { classification: 'system' });

    const consentEntries = telemetry.consent instanceof Map
      ? Object.fromEntries(telemetry.consent)
      : {};

    const providers = telemetry.providers instanceof Map
      ? Array.from(telemetry.providers.values()).map(provider => ({
          id: provider.id,
          metadata: provider.metadata || {}
        }))
      : [];

    const auditTrail = telemetry.getAuditTrail();

    if (telemetry.getCommercializationSnapshotStore()) {
      telemetry.captureCommercializationSnapshot({
        trigger: 'cli-status',
        environment: payload.environment,
        demo: Boolean(payload.demo)
      });
    }

    const commercializationSummary = telemetry.getCommercializationSummary();
    const snapshotStore = telemetry.getCommercializationSnapshotStore();
    const snapshots = snapshotStore ? snapshotStore.getSnapshots({ limit: 3 }) : [];
    const kpiReport = snapshotStore ? snapshotStore.getKpiReport({ limit: 2 }) : null;

    const attestationProfiles = telemetry.licenseAttestationProfiles?.getProfiles?.() || [];
    const defaultProfileId = telemetry.licenseAttestationProfiles?.getDefaultProfileId?.() || null;

    const sensoryBridge = sdk.sensoryBridge;
    const schemaRegistry = sensoryBridge.getSchemaRegistry();
    const registeredSchemas = schemaRegistry?.schemas instanceof Map
      ? Array.from(schemaRegistry.schemas.keys())
      : [];
    const registeredAdapters = sensoryBridge.adapters instanceof Map
      ? Array.from(sensoryBridge.adapters.entries()).map(([type, adapter]) => ({
          type,
          hasConnect: typeof adapter.connect === 'function',
          hasDisconnect: typeof adapter.disconnect === 'function',
          hasTest: typeof adapter.test === 'function'
        }))
      : [];

    const layoutStrategies = Array.isArray(sdk.layoutSynthesizer?.strategies)
      ? sdk.layoutSynthesizer.strategies.map(strategy => strategy.id || 'unknown')
      : [];
    const layoutAnnotations = Array.isArray(sdk.layoutSynthesizer?.annotations)
      ? sdk.layoutSynthesizer.annotations.map(annotation => annotation.id || 'unknown')
      : [];

    const designLanguages = sdk.designLanguageManager?.languages instanceof Map
      ? Array.from(sdk.designLanguageManager.languages.entries()).map(([id, descriptor]) => ({
          id,
          name: descriptor?.name || id
        }))
      : [];
    const activeDesignLanguage = sdk.designLanguageManager?.getActiveLanguage?.();

    const projectionScenarios = sdk.projectionSimulator?.listScenarios?.() || [];

    const telemetryBufferSize = Array.isArray(telemetry.buffer) ? telemetry.buffer.length : 0;

    report.environment = {
      mode: sdk.engine?.environment?.mode || 'headless',
      skipVisualization: Boolean(sdk.engine?.environment?.skipVisualization),
      skipUiBindings: Boolean(sdk.engine?.environment?.skipUiBindings),
      skipStatus: Boolean(sdk.engine?.environment?.skipStatus),
      skipGallery: Boolean(sdk.engine?.environment?.skipGallery),
      skipExport: Boolean(sdk.engine?.environment?.skipExport),
      autoStart: Boolean(sdk.engine?.environment?.autoStart)
    };

    report.license = {
      status: licenseStatus,
      details: licenseManager ? licenseManager.getLicense() : null,
      history: licenseManager ? licenseManager.getValidationHistory() : []
    };

    report.telemetry = {
      enabled: telemetry.enabled,
      consent: consentEntries,
      providers,
      bufferSize: telemetryBufferSize,
      auditTrail: {
        totalEntries: auditTrail.length,
        recent: auditTrail.slice(-5)
      },
      commercialization: {
        summary: commercializationSummary,
        snapshotCount: snapshots.length,
        snapshots,
        kpiReport
      },
      licenseAttestation: {
        defaultProfileId,
        profiles: attestationProfiles
      }
    };

    report.sensors = {
      autoConnect: Boolean(sensoryBridge.autoConnectAdapters),
      pollingIntervalMs: sensoryBridge.pollingInterval,
      confidenceThreshold: sensoryBridge.confidenceThreshold,
      registeredSchemas,
      adapters: registeredAdapters,
      snapshot: sensoryBridge.getSnapshot()
    };

    report.layout = {
      strategyCount: layoutStrategies.length,
      strategies: layoutStrategies,
      annotations: layoutAnnotations
    };

    report.design = {
      activeLanguage: activeDesignLanguage ? {
        id: sdk.designLanguageManager.activeLanguage,
        name: activeDesignLanguage.name,
        description: activeDesignLanguage.description
      } : null,
      languages: designLanguages
    };

    report.projection = {
      scenarioCount: projectionScenarios.length,
      scenarios: projectionScenarios
    };

    if (typeof telemetry.flush === 'function') {
      await telemetry.flush();
    }

    console.log(JSON.stringify(report));
  } finally {
    try {
      sdk.engine?.dispose?.();
    } catch (error) {
      // ignore disposal errors
    }
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  exit(1);
});
