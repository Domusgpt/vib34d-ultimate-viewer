/**
 * VIB34D Parameter Management System
 * Unified parameter control for both holographic and polytopal systems
 */

const PARAMETER_GROUPS = {
    show: 'Show Control',
    rotation: '4D Rotation',
    structure: 'Structure',
    dynamics: 'Dynamics',
    color: 'Color'
};

export class ParameterManager {
    constructor() {
        // Default parameter set combining both systems
        this.params = {
            // Current variation
            variation: 0,

            // 4D Polytopal Mathematics
            rot4dXW: 0.0,      // X-W plane rotation (-2 to 2)
            rot4dYW: 0.0,      // Y-W plane rotation (-2 to 2)
            rot4dZW: 0.0,      // Z-W plane rotation (-2 to 2)
            dimension: 3.5,    // Dimensional level (3.0 to 4.5)

            // Holographic Visualization
            gridDensity: 15,   // Geometric detail (4 to 100)
            morphFactor: 1.0,  // Shape transformation (0 to 2)
            chaos: 0.2,        // Randomization level (0 to 1)
            speed: 1.0,        // Animation speed (0.1 to 3)
            hue: 200,          // Color rotation (0 to 360)
            intensity: 0.5,    // Visual intensity (0 to 1)
            saturation: 0.8,   // Color saturation (0 to 1)

            // Geometry selection
            geometry: 0        // Current geometry type (0-7)
        };

        // Parameter definitions for validation and UI
        this.parameterDefs = {
            variation: {
                min: 0,
                max: 99,
                step: 1,
                type: 'int',
                label: 'Variation Index',
                group: PARAMETER_GROUPS.show,
                tags: ['variation', 'preset']
            },
            rot4dXW: {
                min: -2,
                max: 2,
                step: 0.01,
                type: 'float',
                label: 'Rotation X↔W',
                group: PARAMETER_GROUPS.rotation,
                tags: ['rotation', 'performance']
            },
            rot4dYW: {
                min: -2,
                max: 2,
                step: 0.01,
                type: 'float',
                label: 'Rotation Y↔W',
                group: PARAMETER_GROUPS.rotation,
                tags: ['rotation', 'performance']
            },
            rot4dZW: {
                min: -2,
                max: 2,
                step: 0.01,
                type: 'float',
                label: 'Rotation Z↔W',
                group: PARAMETER_GROUPS.rotation,
                tags: ['rotation', 'performance']
            },
            dimension: {
                min: 3.0,
                max: 4.5,
                step: 0.01,
                type: 'float',
                label: 'Dimensional Blend',
                group: PARAMETER_GROUPS.rotation,
                tags: ['geometry', 'morph']
            },
            gridDensity: {
                min: 4,
                max: 100,
                step: 0.1,
                type: 'float',
                label: 'Grid Density',
                group: PARAMETER_GROUPS.structure,
                tags: ['structure', 'resolution', 'audio']
            },
            morphFactor: {
                min: 0,
                max: 2,
                step: 0.01,
                type: 'float',
                label: 'Morph Factor',
                group: PARAMETER_GROUPS.structure,
                tags: ['morph', 'performance']
            },
            chaos: {
                min: 0,
                max: 1,
                step: 0.01,
                type: 'float',
                label: 'Chaos',
                group: PARAMETER_GROUPS.dynamics,
                tags: ['randomness', 'audio']
            },
            speed: {
                min: 0.1,
                max: 3,
                step: 0.01,
                type: 'float',
                label: 'Animation Speed',
                group: PARAMETER_GROUPS.dynamics,
                tags: ['tempo', 'audio', 'performance']
            },
            hue: {
                min: 0,
                max: 360,
                step: 1,
                type: 'int',
                label: 'Hue Rotation',
                group: PARAMETER_GROUPS.color,
                tags: ['color', 'audio']
            },
            intensity: {
                min: 0,
                max: 1,
                step: 0.01,
                type: 'float',
                label: 'Light Intensity',
                group: PARAMETER_GROUPS.color,
                tags: ['color', 'dynamics', 'audio']
            },
            saturation: {
                min: 0,
                max: 1,
                step: 0.01,
                type: 'float',
                label: 'Saturation',
                group: PARAMETER_GROUPS.color,
                tags: ['color']
            },
            geometry: {
                min: 0,
                max: 7,
                step: 1,
                type: 'int',
                label: 'Geometry Index',
                group: PARAMETER_GROUPS.structure,
                tags: ['structure', 'preset']
            }
        };

        // Default parameter backup for reset
        this.defaults = { ...this.params };

        // Registered listeners for live control modules
        this.listeners = new Set();
    }

    /**
     * Get all current parameters
     */
    getAllParameters() {
        return { ...this.params };
    }

    /**
     * Get a specific parameter value
     */
    getParameter(name) {
        return this.params[name];
    }

    /**
     * Retrieve the definition for a parameter
     */
    getParameterDefinition(name) {
        return this.parameterDefs[name] || null;
    }

    /**
     * Set a specific parameter with validation
     */
    setParameter(name, value, source = 'manual') {
        if (!this.parameterDefs[name]) {
            console.warn(`Unknown parameter: ${name}`);
            return false;
        }

        const def = this.parameterDefs[name];
        const clampedValue = this.clampToDefinition(def, value);
        const previousValue = this.params[name];

        if (!this.hasMeaningfulChange(previousValue, clampedValue, def)) {
            return false;
        }

        this.params[name] = clampedValue;
        this.emitChange(name, clampedValue, source);
        return true;
    }

    /**
     * Set multiple parameters at once
     */
    setParameters(paramObj, options = {}) {
        if (!paramObj || typeof paramObj !== 'object') return;
        const { source = 'manual' } = options;

        Object.entries(paramObj).forEach(([name, value]) => {
            this.setParameter(name, value, source);
        });
    }

    /**
     * Helper used by geometry button controls
     */
    setGeometry(geometryType, source = 'manual') {
        this.setParameter('geometry', geometryType, source);
    }

    /**
     * Update parameters from UI controls
     */
    updateFromControls() {
        const controlIds = [
            'variationSlider', 'rot4dXW', 'rot4dYW', 'rot4dZW', 'dimension',
            'gridDensity', 'morphFactor', 'chaos', 'speed', 'hue',
            'intensity', 'saturation'
        ];

        controlIds.forEach(id => {
            const element = document.getElementById(id);
            if (!element) return;

            const value = parseFloat(element.value);
            const paramName = id === 'variationSlider' ? 'variation' : id;
            this.setParameter(paramName, value, 'ui');
        });
    }

    /**
     * Update UI display values from current parameters
     */
    updateDisplayValues() {
        // Update slider values
        this.updateSliderValue('variationSlider', this.params.variation);
        this.updateSliderValue('rot4dXW', this.params.rot4dXW);
        this.updateSliderValue('rot4dYW', this.params.rot4dYW);
        this.updateSliderValue('rot4dZW', this.params.rot4dZW);
        this.updateSliderValue('dimension', this.params.dimension);
        this.updateSliderValue('gridDensity', this.params.gridDensity);
        this.updateSliderValue('morphFactor', this.params.morphFactor);
        this.updateSliderValue('chaos', this.params.chaos);
        this.updateSliderValue('speed', this.params.speed);
        this.updateSliderValue('hue', this.params.hue);
        this.updateSliderValue('intensity', this.params.intensity);
        this.updateSliderValue('saturation', this.params.saturation);

        // Update display texts
        this.updateDisplayText('rot4dXWDisplay', this.params.rot4dXW.toFixed(2));
        this.updateDisplayText('rot4dYWDisplay', this.params.rot4dYW.toFixed(2));
        this.updateDisplayText('rot4dZWDisplay', this.params.rot4dZW.toFixed(2));
        this.updateDisplayText('dimensionDisplay', this.params.dimension.toFixed(2));
        this.updateDisplayText('gridDensityDisplay', this.params.gridDensity.toFixed(1));
        this.updateDisplayText('morphFactorDisplay', this.params.morphFactor.toFixed(2));
        this.updateDisplayText('chaosDisplay', this.params.chaos.toFixed(2));
        this.updateDisplayText('speedDisplay', this.params.speed.toFixed(2));
        this.updateDisplayText('hueDisplay', `${this.params.hue}°`);

        // Update variation info
        this.updateVariationInfo();

        // Update geometry preset buttons
        this.updateGeometryButtons();
    }

    updateSliderValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }

    updateDisplayText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    updateVariationInfo() {
        const variationDisplay = document.getElementById('currentVariationDisplay');
        if (!variationDisplay) return;

        const geometryNames = [
            'TETRAHEDRON LATTICE', 'HYPERCUBE LATTICE', 'SPHERE LATTICE', 'TORUS LATTICE',
            'KLEIN BOTTLE LATTICE', 'FRACTAL LATTICE', 'WAVE LATTICE', 'CRYSTAL LATTICE'
        ];

        const geometryType = Math.floor(this.params.variation / 4);
        const geometryLevel = (this.params.variation % 4) + 1;
        const geometryName = geometryNames[geometryType] || 'CUSTOM VARIATION';

        variationDisplay.textContent = `${this.params.variation + 1} - ${geometryName}`;

        if (this.params.variation < 30) {
            variationDisplay.textContent += ` ${geometryLevel}`;
        }
    }

    updateGeometryButtons() {
        document.querySelectorAll('[data-geometry]').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.geometry, 10) === this.params.geometry);
        });
    }

    /**
     * Randomize all parameters
     */
    randomizeAll() {
        this.setParameter('rot4dXW', Math.random() * 4 - 2, 'randomize');
        this.setParameter('rot4dYW', Math.random() * 4 - 2, 'randomize');
        this.setParameter('rot4dZW', Math.random() * 4 - 2, 'randomize');
        this.setParameter('dimension', 3.0 + Math.random() * 1.5, 'randomize');
        this.setParameter('gridDensity', 4 + Math.random() * 96, 'randomize');
        this.setParameter('morphFactor', Math.random() * 2, 'randomize');
        this.setParameter('chaos', Math.random(), 'randomize');
        this.setParameter('speed', 0.1 + Math.random() * 2.9, 'randomize');
        this.setParameter('hue', Math.random() * 360, 'randomize');
        this.setParameter('geometry', Math.floor(Math.random() * 8), 'randomize');
    }

    /**
     * Reset to default parameters
     */
    resetToDefaults() {
        this.setParameters(this.defaults, { source: 'reset' });
    }

    /**
     * Load parameter configuration
     */
    loadConfiguration(config, options = {}) {
        if (!config || typeof config !== 'object') {
            return false;
        }

        const { source = 'import' } = options;
        Object.entries(config).forEach(([key, value]) => {
            if (this.parameterDefs[key]) {
                this.setParameter(key, value, source);
            }
        });
        return true;
    }

    /**
     * Register a listener that fires whenever a parameter changes.
     */
    addChangeListener(listener) {
        if (typeof listener !== 'function') {
            return () => {};
        }
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emitChange(name, value, source) {
        const payload = { name, value, source };
        this.listeners.forEach(listener => {
            try {
                listener(payload);
            } catch (error) {
                console.warn('Parameter listener error', error);
            }
        });
    }

    /**
     * List parameter keys for UI builders
     */
    listParameters() {
        return Object.keys(this.parameterDefs);
    }

    /**
     * Retrieve metadata for a parameter key
     */
    getParameterMetadata(name) {
        const def = this.parameterDefs[name];
        if (!def) return null;

        return {
            id: name,
            key: name,
            label: def.label || this.formatParameterLabel(name),
            group: def.group || 'General',
            min: def.min,
            max: def.max,
            step: def.step,
            type: def.type,
            tags: Array.isArray(def.tags) ? [...def.tags] : []
        };
    }

    /**
     * List parameter metadata for UI builders with optional filtering
     */
    listParameterMetadata(filter = {}) {
        const { groups = null, tags = null } = filter;
        const groupFilter = Array.isArray(groups) && groups.length ? new Set(groups) : null;
        const tagFilter = Array.isArray(tags) && tags.length ? new Set(tags) : null;

        return Object.keys(this.parameterDefs)
            .map(name => this.getParameterMetadata(name))
            .filter(meta => {
                if (!meta) return false;
                if (groupFilter && !groupFilter.has(meta.group)) return false;
                if (tagFilter) {
                    const hasTag = meta.tags.some(tag => tagFilter.has(tag));
                    if (!hasTag) return false;
                }
                return true;
            })
            .sort((a, b) => {
                if (a.group === b.group) {
                    return a.label.localeCompare(b.label);
                }
                return a.group.localeCompare(b.group);
            });
    }

    /**
     * Format a readable parameter label from its key
     */
    formatParameterLabel(name) {
        if (!name) return '';
        return name
            .replace(/rot4d/gi, '4D ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^./, char => char.toUpperCase());
    }

    /**
     * Clamp a value according to its parameter definition
     */
    clampToDefinition(def, value) {
        if (!def) return value;

        let clampedValue = Math.max(def.min, Math.min(def.max, value));
        if (def.type === 'int') {
            clampedValue = Math.round(clampedValue);
        }
        return clampedValue;
    }

    /**
     * Determine if a change is meaningful (prevents micro-noise)
     */
    hasMeaningfulChange(previousValue, nextValue, def) {
        if (previousValue === undefined) return true;
        if (def?.type === 'int') {
            return previousValue !== nextValue;
        }
        const epsilon = def?.step ? def.step / 10 : 1e-4;
        return Math.abs(previousValue - nextValue) > epsilon;
    }
}
