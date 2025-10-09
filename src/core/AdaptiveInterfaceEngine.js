import { VIB34DIntegratedEngine } from './Engine.js';
import { SensoryInputBridge } from '../ui/adaptive/SensoryInputBridge.js';
import { SpatialLayoutSynthesizer } from '../ui/adaptive/SpatialLayoutSynthesizer.js';
import { DesignLanguageManager } from '../features/DesignLanguageManager.js';
import { ProductTelemetryHarness } from '../product/ProductTelemetryHarness.js';
import { buildLayoutBlueprint } from '../ui/adaptive/renderers/LayoutBlueprintRenderer.js';
import { LayoutBlueprintInsightEngine } from '../ui/adaptive/renderers/LayoutBlueprintInsightEngine.js';
import { LayoutBlueprintScenarioSimulator } from '../ui/adaptive/renderers/LayoutBlueprintScenarioSimulator.js';
import { LayoutBlueprintCalibrationEngine } from '../ui/adaptive/renderers/LayoutBlueprintCalibrationEngine.js';
import { LayoutBlueprintEvolutionEngine } from '../ui/adaptive/renderers/LayoutBlueprintEvolutionEngine.js';

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
        this.telemetry = new ProductTelemetryHarness(options.telemetry);
        this.marketplaceHooks = options.marketplaceHooks || {};
        const blueprintInsightsOption = options.blueprintInsights;
        if (blueprintInsightsOption === false) {
            this.blueprintInsightEngine = null;
        } else if (blueprintInsightsOption && typeof blueprintInsightsOption.analyze === 'function') {
            this.blueprintInsightEngine = blueprintInsightsOption;
        } else {
            this.blueprintInsightEngine = new LayoutBlueprintInsightEngine(blueprintInsightsOption || {});
        }

        const scenarioOption = options.blueprintScenarios;
        if (scenarioOption === false) {
            this.blueprintScenarioSimulator = null;
        } else if (scenarioOption && typeof scenarioOption.runScenario === 'function') {
            this.blueprintScenarioSimulator = scenarioOption;
        } else {
            this.blueprintScenarioSimulator = new LayoutBlueprintScenarioSimulator({
                ...(scenarioOption || {}),
                insightEngine: this.blueprintInsightEngine || scenarioOption?.insightEngine
            });
        }

        const calibrationOption = options.blueprintCalibration;
        if (calibrationOption === false) {
            this.blueprintCalibrationEngine = null;
        } else if (calibrationOption && typeof calibrationOption.calibrate === 'function') {
            this.blueprintCalibrationEngine = calibrationOption;
        } else {
            this.blueprintCalibrationEngine = new LayoutBlueprintCalibrationEngine({
                ...(calibrationOption || {}),
                insightEngine: this.blueprintInsightEngine || calibrationOption?.insightEngine
            });
        }

        const evolutionOption = options.blueprintEvolution;
        if (evolutionOption === false) {
            this.blueprintEvolutionEngine = null;
        } else if (evolutionOption && typeof evolutionOption.evolve === 'function') {
            this.blueprintEvolutionEngine = evolutionOption;
        } else {
            this.blueprintEvolutionEngine = new LayoutBlueprintEvolutionEngine({
                ...(evolutionOption || {}),
                insightEngine: this.blueprintInsightEngine || evolutionOption?.insightEngine
            });
        }

        if (typeof this.sensoryBridge.setValidationReporter === 'function') {
            this.sensoryBridge.setValidationReporter(issue => {
                this.telemetry.recordSchemaIssue(issue);
            });
        }

        this.activeLayout = null;
        this.activeDesignSpec = null;
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
            this.emitAdaptiveUpdate(context, this.activeLayout);
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

    emitAdaptiveUpdate(context, layout) {
        if (typeof this.marketplaceHooks.onAdaptiveUpdate === 'function') {
            this.marketplaceHooks.onAdaptiveUpdate({ context, layout, design: this.activeDesignSpec });
        }
    }

    generateLayoutBlueprintSnapshot(options = {}) {
        const context = options.context || this.sensoryBridge.getSnapshot();
        let layout = options.layout;
        if (!layout) {
            if (options.useActiveLayout !== false && this.activeLayout) {
                layout = this.activeLayout;
            } else {
                layout = this.layoutSynthesizer.generateLayout(context);
            }
        }

        const design = options.design || this.activeDesignSpec || this.designLanguageManager.getDesignSpec(
            this.variationManager.getVariationName(this.currentVariation)
        );

        const blueprint = buildLayoutBlueprint(layout, design, context);
        if (options.analyze === false || !this.blueprintInsightEngine) {
            return { blueprint, insights: null };
        }

        const insights = this.blueprintInsightEngine.analyze(blueprint, {
            id: options.id,
            storeHistory: options.storeHistory
        });
        return { blueprint, insights };
    }

    getBlueprintInsightEngine() {
        return this.blueprintInsightEngine;
    }

    getBlueprintInsightHistory() {
        return this.blueprintInsightEngine?.getHistory?.() || [];
    }

    clearBlueprintInsightHistory() {
        this.blueprintInsightEngine?.clearHistory?.();
    }

    getBlueprintScenarioHistory() {
        return this.blueprintInsightEngine?.getScenarioHistory?.() || [];
    }

    clearBlueprintScenarioHistory() {
        this.blueprintInsightEngine?.clearScenarioHistory?.();
    }

    getBlueprintCalibrationHistory() {
        if (this.blueprintCalibrationEngine?.getHistory) {
            return this.blueprintCalibrationEngine.getHistory();
        }
        return this.blueprintInsightEngine?.getCalibrationHistory?.() || [];
    }

    clearBlueprintCalibrationHistory() {
        if (this.blueprintCalibrationEngine?.clearHistory) {
            this.blueprintCalibrationEngine.clearHistory();
        }
        this.blueprintInsightEngine?.clearCalibrationHistory?.();
    }

    getBlueprintEvolutionHistory() {
        if (this.blueprintEvolutionEngine?.getHistory) {
            return this.blueprintEvolutionEngine.getHistory();
        }
        return this.blueprintInsightEngine?.getEvolutionHistory?.() || [];
    }

    clearBlueprintEvolutionHistory() {
        if (this.blueprintEvolutionEngine?.clearHistory) {
            this.blueprintEvolutionEngine.clearHistory();
        }
        this.blueprintInsightEngine?.clearEvolutionHistory?.();
    }

    getBlueprintCalibrationEngine() {
        return this.blueprintCalibrationEngine;
    }

    generateLayoutBlueprintScenario(options = {}) {
        if (!this.blueprintScenarioSimulator) {
            throw new Error('Blueprint scenario simulator is not configured for this engine instance.');
        }

        const baseContext = options.contextDefaults || this.sensoryBridge.getSnapshot();
        const baseDesign = options.design || this.activeDesignSpec || this.designLanguageManager.getDesignSpec(
            this.variationManager.getVariationName(this.currentVariation)
        );

        let baseLayout = options.layout;
        if (!baseLayout) {
            if (options.useActiveLayout !== false && this.activeLayout) {
                baseLayout = this.activeLayout;
            } else {
                baseLayout = this.layoutSynthesizer.generateLayout(baseContext);
            }
        }

        const steps = Array.isArray(options.steps)
            ? options.steps.map((step, index) => {
                const context = {
                    ...baseContext,
                    ...(step?.context || {})
                };

                let layout = step?.layout;
                if (!layout) {
                    if (step?.useActiveLayout && this.activeLayout) {
                        layout = this.activeLayout;
                    } else {
                        layout = this.layoutSynthesizer.generateLayout(context);
                    }
                }
                if (!layout) {
                    layout = baseLayout;
                }

                let design = step?.design;
                if (!design) {
                    design = baseDesign;
                }

                return {
                    ...step,
                    id: step?.id || `step-${index + 1}`,
                    context,
                    layout,
                    design
                };
            })
            : [];

        return this.blueprintScenarioSimulator.runScenario({
            id: options.id,
            layout: baseLayout,
            design: baseDesign,
            contextDefaults: baseContext,
            steps,
            storeStepHistory: options.storeStepHistory
        });
    }

    runLayoutBlueprintEvolution(options = {}) {
        if (!this.blueprintEvolutionEngine) {
            throw new Error('Blueprint evolution engine is not configured for this engine instance.');
        }

        let blueprint = options.blueprint || null;
        if (!blueprint || options.refreshSnapshot) {
            const snapshot = this.generateLayoutBlueprintSnapshot({
                id: options.snapshotId,
                context: options.context,
                layout: options.layout,
                design: options.design,
                useActiveLayout: options.useActiveLayout,
                analyze: options.analyze ?? true,
                storeHistory: options.storeInsightHistory
            });
            blueprint = snapshot.blueprint;
        }

        return this.blueprintEvolutionEngine.evolve({
            id: options.id,
            blueprint,
            layout: options.layout,
            design: options.design,
            context: options.context || this.sensoryBridge.getSnapshot(),
            strategyOptions: options.strategyOptions
        });
    }

    calibrateLayoutBlueprint(options = {}) {
        if (!this.blueprintCalibrationEngine) {
            throw new Error('Blueprint calibration engine is not configured for this engine instance.');
        }

        let blueprint = options.blueprint || null;
        let insights = options.insights || null;

        if (!blueprint || options.refreshSnapshot) {
            const snapshot = this.generateLayoutBlueprintSnapshot({
                context: options.context,
                layout: options.layout,
                design: options.design,
                useActiveLayout: options.useActiveLayout,
                analyze: options.analyze ?? true,
                storeHistory: options.storeInsightHistory
            });
            blueprint = snapshot.blueprint;
            insights = snapshot.insights?.analytics || snapshot.insights || null;
        }

        return this.blueprintCalibrationEngine.calibrate({
            id: options.id,
            blueprint,
            insights,
            scenario: options.scenario || null,
            context: options.context || this.sensoryBridge.getSnapshot(),
            annotations: options.annotations,
            storeHistory: options.storeHistory
        });
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

    dispose() {
        this.telemetry.stop();
        this.sensoryBridge.stop();
    }
}

