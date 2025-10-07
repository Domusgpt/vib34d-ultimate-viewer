import { VIB34DIntegratedEngine } from './Engine.js';
import { SensoryInputBridge } from '../ui/adaptive/SensoryInputBridge.js';
import { SpatialLayoutSynthesizer } from '../ui/adaptive/SpatialLayoutSynthesizer.js';
import { DesignLanguageManager } from '../features/DesignLanguageManager.js';
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
        this.telemetry = new ProductTelemetryHarness(options.telemetry);
        this.marketplaceHooks = options.marketplaceHooks || {};

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

