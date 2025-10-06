/**
 * PluginRegistry provides a commercialization-friendly extension system that
 * can back premium packs, marketplace distribution, or enterprise integrations.
 */
export default class PluginRegistry {
    constructor({ logger = console } = {}) {
        this.logger = logger;
        this.plugins = new Map();
        this.activated = new Set();
    }

    registerPlugin(pluginDescriptor) {
        const descriptor = { ...pluginDescriptor };
        if (!descriptor.id) {
            throw new Error('Plugin descriptor requires an id');
        }
        if (this.plugins.has(descriptor.id)) {
            this.logger.warn?.(`⚠️ Plugin with id ${descriptor.id} already registered. Overwriting.`);
        }
        descriptor.createdAt = descriptor.createdAt || new Date().toISOString();
        descriptor.tier = descriptor.tier || 'community';
        descriptor.capabilities = descriptor.capabilities || [];
        descriptor.pricing = descriptor.pricing || { model: 'free' };
        descriptor.entryPoint = descriptor.entryPoint || (() => this.logger.info?.(`No entry point for ${descriptor.id}`));

        this.plugins.set(descriptor.id, descriptor);
        this.logger.info?.(`🧩 Registered plugin ${descriptor.name || descriptor.id}`);
        return descriptor;
    }

    listPlugins(filter = {}) {
        const results = [];
        this.plugins.forEach(plugin => {
            if (filter.tier && plugin.tier !== filter.tier) return;
            if (filter.capability && !plugin.capabilities.includes(filter.capability)) return;
            results.push(plugin);
        });
        return results;
    }

    activatePlugin(id, context = {}) {
        const plugin = this.plugins.get(id);
        if (!plugin) {
            throw new Error(`Plugin ${id} not found`);
        }
        if (this.activated.has(id)) {
            this.logger.info?.(`🔁 Plugin ${id} already active`);
            return plugin;
        }
        try {
            plugin.entryPoint?.(context);
            this.activated.add(id);
            this.logger.info?.(`🚀 Activated plugin ${id}`);
        } catch (error) {
            this.logger.error?.(`❌ Failed to activate plugin ${id}:`, error);
            throw error;
        }
        return plugin;
    }

    getPlugin(id) {
        return this.plugins.get(id) || null;
    }

    getCommercialSummary() {
        const summary = { tiers: {}, capabilities: {} };
        this.plugins.forEach(plugin => {
            summary.tiers[plugin.tier] = (summary.tiers[plugin.tier] || 0) + 1;
            plugin.capabilities.forEach(cap => {
                summary.capabilities[cap] = (summary.capabilities[cap] || 0) + 1;
            });
        });
        return summary;
    }
}
