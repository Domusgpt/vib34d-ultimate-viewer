import { VIB34DIntegratedEngine } from './Engine.js';
import { SensoryInputBridge } from '../ui/adaptive/SensoryInputBridge.js';
import { SpatialLayoutSynthesizer } from '../ui/adaptive/SpatialLayoutSynthesizer.js';
import { DesignLanguageManager } from '../features/DesignLanguageManager.js';
import { ProjectionFieldComposer } from '../ui/adaptive/ProjectionFieldComposer.js';
import { ProjectionScenarioSimulator } from '../ui/adaptive/ProjectionScenarioSimulator.js';
import { ProductTelemetryHarness } from '../product/ProductTelemetryHarness.js';

/**
 * AdaptiveInterfaceEngine
 * ------------------------------------------------------------
 * Productized variant of the VIB34D engine tailored for wearable and ambient
 * UI design. Introduces adaptive sensory input, layout synthesis, and
 * monetization scaffolding.
 */
export class AdaptiveInterfaceEngine extends VIB34DIntegratedEngine {
    constructor(options = {}) {
        super();

        this.sensoryBridge = new SensoryInputBridge(options.sensory);
        this.layoutSynthesizer = new SpatialLayoutSynthesizer(options.layout);
        this.designLanguageManager = new DesignLanguageManager(this, options.design);
        const projectionOptions = options.projection || {};
        this.projectionComposer = new ProjectionFieldComposer(projectionOptions);
        this.projectionScenarioSimulator = new ProjectionScenarioSimulator({
            composer: this.projectionComposer,
            scenarios: projectionOptions.scenarios,
            useDefaultScenarios: projectionOptions.useDefaultScenarios !== false
        });
        this.telemetry = new ProductTelemetryHarness(options.telemetry);
        this.marketplaceHooks = options.marketplaceHooks || {};

        if (typeof this.sensoryBridge.setValidationReporter === 'function') {
            this.sensoryBridge.setValidationReporter(issue => {
                this.telemetry.recordSchemaIssue(issue);
            });
        }

        this.activeLayout = null;
        this.activeDesignSpec = null;
        this.activeProjection = null;
        this.adaptiveUpdateNeeded = true;

        this.initializeAdaptivePipeline();
    }

    initializeAdaptivePipeline() {
        const markDirty = () => {
            this.adaptiveUpdateNeeded = true;
        };

        ['focus', 'intention', 'biometrics', 'environment', 'gesture'].forEach(channel => {
            this.sensoryBridge.subscribe(channel, markDirty);
        });

        this.sensoryBridge.subscribe('focus', vector => {
            this.telemetry.track('adaptive.focus', { x: vector.x, y: vector.y, depth: vector.depth });
        });

        this.sensoryBridge.subscribe('gesture', gesture => {
            if (gesture?.intent) {
                this.telemetry.track('adaptive.gesture', { intent: gesture.intent });
            }
        });

        this.telemetry.start();
        this.sensoryBridge.start();
        this.syncDesignSpec();
    }

    registerLayoutStrategy(strategy) {
        this.layoutSynthesizer.registerStrategy(strategy);
        this.telemetry.track('design.layout.strategy_registered', { id: strategy.id });
        return this;
    }

    registerLayoutAnnotation(annotation) {
        this.layoutSynthesizer.registerAnnotation(annotation);
        this.telemetry.track('design.layout.annotation_registered', { id: annotation.id });
        return this;
    }

    registerSensorSchema(type, schema) {
        this.sensoryBridge.registerSchema(type, schema);
        this.telemetry.track('sensors.schema_registered', { type });
        return this;
    }

    registerTelemetryProvider(provider) {
        this.telemetry.registerProvider(provider);
        this.telemetry.track('design.telemetry.provider_registered', { id: provider.id });
        return this;
    }

    registerProjectionChannel(channel) {
        this.projectionComposer.registerChannel(channel);
        this.telemetry.track('design.projection.channel_registered', { id: channel?.id });
        return this;
    }

    clearProjectionChannels() {
        this.projectionComposer.clearChannels();
        this.telemetry.track('design.projection.channels_cleared', {});
        return this;
    }

    registerProjectionScenario(scenario) {
        this.projectionScenarioSimulator.registerScenario(scenario);
        this.telemetry.track('design.projection.scenario_registered', { id: scenario?.id });
        return this;
    }

    clearProjectionScenarios() {
        this.projectionScenarioSimulator.clearScenarios();
        this.telemetry.track('design.projection.scenarios_cleared', {});
        return this;
    }

    listProjectionScenarios() {
        return this.projectionScenarioSimulator.listScenarios();
    }

    simulateProjectionScenario(id, options = {}) {
        const context = options.context || this.sensoryBridge.getSnapshot();
        const layout = options.layout || this.activeLayout || this.layoutSynthesizer.generateLayout(context);
        const design = options.design || this.activeDesignSpec;

        const result = this.projectionScenarioSimulator.simulateScenario(id, { context, layout, design });
        this.telemetry.track('design.projection.scenario_simulated', {
            scenarioId: id,
            channels: result.metrics.channelCount,
            coherence: result.metrics.coherence
        });
        return result;
    }

    registerTelemetryRequestMiddleware(middleware) {
        this.telemetry.registerRequestMiddleware(middleware);
        return this;
    }

    clearTelemetryRequestMiddleware() {
        this.telemetry.clearRequestMiddleware();
        return this;
    }

    registerLicenseAttestationProfile(profileOrId, maybeProfile) {
        return this.telemetry.registerLicenseAttestationProfile(profileOrId, maybeProfile);
    }

    registerLicenseAttestationProfilePack(packOrId, options = {}) {
        return this.telemetry.registerLicenseAttestationProfilePack(packOrId, options);
    }

    setDefaultLicenseAttestationProfile(id) {
        this.telemetry.setDefaultLicenseAttestationProfile(id);
        return this;
    }

    applyLicenseAttestationProfile(id, overrides = {}) {
        return this.telemetry.setLicenseAttestorFromProfile(id, overrides);
    }

    removeTelemetryProvider(id) {
        this.telemetry.removeProvider(id);
        this.telemetry.track('design.telemetry.provider_removed', { id });
        return this;
    }

    getTelemetryAuditTrail() {
        return this.telemetry.getAuditTrail();
    }

    getLicenseCommercializationSummary() {
        return this.telemetry.getCommercializationSummary();
    }

    getLicenseCommercializationReporter() {
        return this.telemetry.getCommercializationReporter();
    }

    getLicenseCommercializationSnapshotStore() {
        return this.telemetry.getCommercializationSnapshotStore();
    }

    captureLicenseCommercializationSnapshot(context = {}) {
        return this.telemetry.captureCommercializationSnapshot(context);
    }

    getLicenseCommercializationSnapshots(options = {}) {
        return this.telemetry.getCommercializationSnapshots(options);
    }

    getLicenseCommercializationKpiReport(options = {}) {
        return this.telemetry.getCommercializationKpiReport(options);
    }

    exportLicenseCommercializationSnapshots(options = {}) {
        return this.telemetry.exportCommercializationSnapshots(options);
    }

    startLicenseCommercializationSnapshotSchedule(intervalMs, context = {}) {
        return this.telemetry.startCommercializationSnapshotSchedule(intervalMs, context);
    }

    stopLicenseCommercializationSnapshotSchedule() {
        this.telemetry.stopCommercializationSnapshotSchedule();
        return this;
    }

    registerSensorAdapter(type, adapter, options = {}) {
        this.sensoryBridge.registerAdapter(type, adapter);
        this.telemetry.track('sensors.adapter.registered', {
            type,
            lifecycle: {
                connect: typeof adapter.connect === 'function',
                disconnect: typeof adapter.disconnect === 'function',
                test: typeof adapter.test === 'function'
            }
        });

        if (options.autoConnect ?? true) {
            this.connectSensorAdapter(type).catch(error => {
                this.telemetry.track('sensors.adapter.connect_failed', {
                    type,
                    message: error?.message || 'Unknown error'
                }, { classification: 'compliance' });
            });
        }
        return this;
    }

    async connectSensorAdapter(type) {
        try {
            await this.sensoryBridge.connectAdapter(type);
            this.telemetry.track('sensors.adapter.connected', { type });
        } catch (error) {
            this.telemetry.track('sensors.adapter.connect_failed', {
                type,
                message: error?.message || 'Unknown error'
            }, { classification: 'compliance' });
            throw error;
        }
    }

    async disconnectSensorAdapter(type) {
        try {
            await this.sensoryBridge.disconnectAdapter(type);
            this.telemetry.track('sensors.adapter.disconnected', { type });
        } catch (error) {
            this.telemetry.track('sensors.adapter.disconnect_failed', {
                type,
                message: error?.message || 'Unknown error'
            }, { classification: 'compliance' });
            throw error;
        }
    }

    async testSensorAdapter(type) {
        const result = await this.sensoryBridge.testAdapter(type);
        this.telemetry.track('sensors.adapter.tested', { type, result: result ?? null });
        return result;
    }

    updateVisualizers() {
        if (this.adaptiveUpdateNeeded) {
            const context = this.sensoryBridge.getSnapshot();
            this.activeLayout = this.layoutSynthesizer.generateLayout(context);
            this.applyLayoutToParameters(this.activeLayout);
            this.activeProjection = this.projectionComposer.composeBlueprint({
                context,
                layout: this.activeLayout,
                design: this.activeDesignSpec
            });
            this.telemetry.track('design.projection.updated', {
                channels: this.activeProjection.projectionChannels.length,
                coherence: this.activeProjection.modulation.coherence
            });
            this.emitAdaptiveUpdate(context, this.activeLayout, this.activeProjection);
            this.adaptiveUpdateNeeded = false;
        }

        super.updateVisualizers();
    }

    applyLayoutToParameters(layout) {
        if (!layout) return;
        this.parameterManager.setParameter('intensity', layout.intensity);
        this.parameterManager.setParameter('speed', 0.5 + layout.motion.velocity * 1.5);
        this.parameterManager.setParameter('hue', layout.colorAdaptation.hueShift);
        this.parameterManager.setParameter('saturation', layout.colorAdaptation.saturation / 100);

        const geometryBias = layout.zones.find(zone => zone.id === 'primary')?.occupancy || 0.6;
        const geometryIndex = Math.round(geometryBias * 7);
        this.parameterManager.setParameter('geometry', geometryIndex);
    }

    emitAdaptiveUpdate(context, layout, projection) {
        if (typeof this.marketplaceHooks.onAdaptiveUpdate === 'function') {
            this.marketplaceHooks.onAdaptiveUpdate({
                context,
                layout,
                design: this.activeDesignSpec,
                projection
            });
        }
    }

    setVariation(index) {
        super.setVariation(index);
        this.syncDesignSpec();
    }

    syncDesignSpec() {
        const variationName = this.variationManager.getVariationName(this.currentVariation);
        this.activeDesignSpec = this.designLanguageManager.getDesignSpec(variationName);
        this.telemetry.track('design.spec.activated', {
            variation: variationName,
            pattern: this.activeDesignSpec.pattern?.id,
            tier: this.activeDesignSpec.monetization.tier
        });

        if (typeof this.marketplaceHooks.onPatternChange === 'function') {
            this.marketplaceHooks.onPatternChange(this.activeDesignSpec);
        }
    }

    exportMarketplaceCatalog() {
        return this.designLanguageManager.exportMarketplaceCatalog();
    }

    getProjectionBlueprint() {
        return this.activeProjection;
    }

    getAdaptiveContextSnapshot() {
        return this.sensoryBridge.getSnapshot();
    }

    getActiveLayout() {
        return this.activeLayout;
    }

    dispose() {
        this.telemetry.stop();
        this.sensoryBridge.stop();
    }
}

