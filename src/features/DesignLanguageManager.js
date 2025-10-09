import { InterfacePatternRegistry } from '../ui/adaptive/InterfacePatternRegistry.js';

/**
 * DesignLanguageManager
 * ------------------------------------------------------------
 * Binds the holographic variation system to adaptive interface patterns,
 * enabling UI-first workflows while preserving the expressive geometry core.
 */
export class DesignLanguageManager {
    constructor(engine, options = {}) {
        this.engine = engine;
        this.registry = new InterfacePatternRegistry(options.patterns);
        this.languages = new Map();
        this.activeLanguage = options.defaultLanguage || 'default';

        this.registerLanguage('default', {
            name: 'Default Adaptive UI',
            description: 'Base wearable-ready interface mapping built on VIB34D polytopes.',
            mappings: new Map([
                ['TETRAHEDRON LATTICE 1', 'neuro-glance-feed'],
                ['HYPERCUBE LATTICE 2', 'holo-command-ring'],
                ['SPHERE LATTICE 3', 'biometric-rituals']
            ])
        });
    }

    registerLanguage(id, descriptor) {
        this.languages.set(id, {
            name: descriptor.name,
            description: descriptor.description,
            mappings: descriptor.mappings instanceof Map ? descriptor.mappings : new Map(Object.entries(descriptor.mappings || {}))
        });
    }

    setActiveLanguage(id) {
        if (this.languages.has(id)) {
            this.activeLanguage = id;
        } else {
            throw new Error(`Design language ${id} not registered`);
        }
    }

    getActiveLanguage() {
        return this.languages.get(this.activeLanguage);
    }

    getDesignSpec(variationName) {
        const language = this.getActiveLanguage();
        const patternId = language?.mappings.get(variationName) || 'neuro-glance-feed';
        const pattern = this.registry.getPattern(patternId);
        return {
            pattern,
            monetization: this.buildMonetizationDescriptor(patternId),
            integration: this.buildIntegrationDescriptor(patternId)
        };
    }

    buildMonetizationDescriptor(patternId) {
        const pattern = this.registry.getPattern(patternId);
        if (!pattern) return { tier: 'starter', license: 'community' };
        return {
            tier: pattern.subscriptionTier,
            license: pattern.subscriptionTier === 'enterprise' ? 'floating-enterprise' : 'seat-based',
            upsell: pattern.subscriptionTier === 'starter' ? 'pro-upgrade' : null
        };
    }

    buildIntegrationDescriptor(patternId) {
        const pattern = this.registry.getPattern(patternId);
        const designTokens = {
            color: pattern?.components?.includes('glanceable-card') ? 'glance' : 'ambient',
            motion: pattern?.components?.includes('adaptive-controls') ? 'command' : 'flow'
        };
        return {
            figmaPlugin: `vib34d-${patternId}`,
            webflowPackage: `@vib34d/${patternId}`,
            designTokens
        };
    }

    exportMarketplaceCatalog() {
        return this.registry.exportForMarketplace();
    }
}

