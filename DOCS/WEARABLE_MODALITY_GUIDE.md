# Adaptive Modality & Extension Guide

This guide summarizes the new wearable-focused architecture introduced for the VIB34D productization effort. It outlines how to work with adaptive modalities, map them to engine parameters, and commercialize extensions.

## 1. Core Components
- **AdaptiveModalityManager** (`src/core/adaptive/AdaptiveModalityManager.js`)
  - Registers modality profiles and normalizes sensor input.
  - Emits aggregated parameter states to subscribers.
- **ModalityProfiles** (`src/core/adaptive/ModalityProfiles.js`)
  - Contains default profiles for eye focus, neural gestures, and ambient signals.
  - Extendable with custom schema/transform definitions.
- **AdaptiveParameterBridge** (`src/product/AdaptiveParameterBridge.js`)
  - Bridges modality outputs to render-loop parameter requests.
  - Supports per-system transforms and exposes convenience ingestion helpers.
- **DesignSystemBridge** (`src/product/DesignSystemBridge.js`)
  - Generates wearable UI blueprints (layout + gesture semantics).
  - Integrates with plugin registry for downstream exports.
- **PluginRegistry** (`src/product/PluginRegistry.js`)
  - Manages marketplace-ready extension descriptors, activation, and pricing tiers.

## 2. Modality Lifecycle
1. **Profile Definition**
   ```js
   const profile = {
     id: 'bioSignals',
     label: 'Bio-signal Harmonizer',
     inputSchema: {
       pulseVariance: { min: 0, max: 1, defaultValue: 0.2 },
       rhythmLock: { options: ['relaxed', 'focused', 'stressed'], defaultValue: 'relaxed' }
     },
     parameterTargets: {
       intensity: input => 0.4 + input.pulseVariance * 0.5,
       morphFactor: (input, params) => input.rhythmLock === 'focused' ? params.morphFactor + 0.3 : params.morphFactor
     }
   };
   ```
2. **Registration**
   ```js
   const modalityManager = wearableEngine.getAdaptiveModalityManager();
   modalityManager.registerModality(profile);
   ```
3. **Signal Ingestion**
   ```js
   wearableEngine.ingestAdaptiveSignal('bioSignals', { pulseVariance: 0.6, rhythmLock: 'focused' });
   ```
4. **Blueprint Generation**
   ```js
   const bridge = new DesignSystemBridge({ parameterBridge: wearableEngine.parameterBridge });
   const blueprint = bridge.generateBlueprint({ systemName: 'holographic' });
   ```

## 3. Extension Strategy
- **Community Tier** – Free extensions that add new modality profiles or blueprint templates.
- **Studio Tier** – Paid bundles that export to Figma, Adobe XD, Framer, or 3D prototyping suites.
- **Enterprise Tier** – Custom signal integrations (EEG headsets, LiDAR, vehicle HUDs) with SLA-backed support.

To register monetizable plugins:
```js
pluginRegistry.registerPlugin({
  id: 'export-figma',
  name: 'Figma Exporter',
  tier: 'studio',
  pricing: { model: 'subscription', monthly: 29 },
  capabilities: ['export', 'vector', 'collaboration'],
  exporter: blueprint => convertBlueprintToFigmaJSON(blueprint)
});
```

## 4. Support & Licensing Hooks
- **Telemetry** – Use `PluginRegistry.getCommercialSummary()` to track tier adoption.
- **Licensing** – Wrap premium features behind plugin activation to enforce entitlements.
- **Support Plans** – Attach SLA metadata to plugin descriptors (e.g., `support: { responseTimeHours: 4 }`).

## 5. Roadmap Considerations
- Expand modality profiles to cover biometrics, environment-aware signage, and XR spatial anchors.
- Build official exporters for Unity XR Interaction Toolkit, Apple VisionOS spatial UI, and Wear OS Tiles.
- Launch partner program with certification badges for premium plugin providers.

For deeper technical details, consult the inline documentation within each new module.
