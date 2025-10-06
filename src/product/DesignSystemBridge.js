import AdaptiveParameterBridge from './AdaptiveParameterBridge.js';
import PluginRegistry from './PluginRegistry.js';

/**
 * DesignSystemBridge turns parameter states into wearable-first UI blueprints.
 */
export default class DesignSystemBridge {
    constructor({
        parameterBridge = null,
        pluginRegistry = null,
        logger = console
    } = {}) {
        this.logger = logger;
        this.parameterBridge = parameterBridge || new AdaptiveParameterBridge({ logger });
        this.pluginRegistry = pluginRegistry || new PluginRegistry({ logger });
    }

    generateBlueprint({ systemName, viewport = { width: 320, height: 320 }, metadata = {} } = {}) {
        const parameters = this.parameterBridge.getParametersForSystem(systemName, {
            time: 0,
            gridDensity: 12,
            morphFactor: 1,
            intensity: 0.6
        });

        const blueprint = {
            systemName,
            viewport,
            parameters,
            metadata: {
                createdAt: new Date().toISOString(),
                modalityState: this.parameterBridge.getModalityManager().getStateSnapshot(),
                ...metadata
            },
            layout: this.createWearableLayout(parameters, viewport)
        };

        this.logger.info?.(`📐 Generated wearable blueprint for ${systemName}`);
        return blueprint;
    }

    createWearableLayout(parameters, viewport) {
        const radius = Math.min(viewport.width, viewport.height) / 2;
        const layers = [
            {
                id: 'background',
                role: 'ambient',
                intensity: parameters.intensity * 0.6,
                radius: radius,
                accessibility: { contrast: parameters.contrast ?? 0.7 }
            },
            {
                id: 'primary',
                role: 'interaction',
                radius: radius * (0.65 + (parameters.morphFactor - 1) * 0.1),
                highlights: parameters.hue ?? 0.5
            },
            {
                id: 'focus',
                role: 'attention',
                radius: radius * 0.4,
                animation: { speed: parameters.speed ?? 0.8, type: 'pulse' }
            }
        ];

        return {
            formFactor: radius < 200 ? 'watch-face' : 'spatial-disc',
            layers,
            gestures: this.deriveGestures(parameters)
        };
    }

    deriveGestures(parameters) {
        return [
            {
                id: 'focus-shift',
                type: 'gaze',
                trigger: 'dwell>450ms',
                outcome: `increase-contrast-${Math.round((parameters.contrast ?? 0.7) * 100)}`
            },
            {
                id: 'neural-highlight',
                type: 'neural',
                trigger: 'intent:highlight',
                outcome: `accent-hue-${(parameters.hue ?? 0.5).toFixed(2)}`
            }
        ];
    }

    exportBlueprint(format, blueprint, options = {}) {
        const pluginId = options.pluginId || `export-${format}`;
        const plugin = this.pluginRegistry.getPlugin(pluginId);
        if (!plugin) {
            this.logger.warn?.(`⚠️ No plugin found for ${format} export. Returning JSON.`);
            return JSON.stringify(blueprint, null, 2);
        }
        if (!this.pluginRegistry.activated.has(pluginId)) {
            this.pluginRegistry.activatePlugin(pluginId, { format, options });
        }
        return plugin.exporter ? plugin.exporter(blueprint, options) : JSON.stringify(blueprint);
    }
}
