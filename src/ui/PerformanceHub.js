export class PerformanceHub {
    constructor(options = {}) {
        const { engine = null, parameterManager = null } = options;
        this.engine = engine;
        this.parameterManager = parameterManager;
        this.listeners = new Map();
        this.touchPadController = null;
        this.audioPanel = null;
        this.presetManager = null;
        this.extensions = new Map();
    }

    on(event, handler) {
        if (typeof handler !== 'function') {
            return () => {};
        }

        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        const handlers = this.listeners.get(event);
        handlers.add(handler);

        return () => this.off(event, handler);
    }

    off(event, handler) {
        const handlers = this.listeners.get(event);
        if (!handlers) return;
        handlers.delete(handler);
        if (handlers.size === 0) {
            this.listeners.delete(event);
        }
    }

    emit(event, payload = {}) {
        const handlers = this.listeners.get(event);
        if (!handlers || handlers.size === 0) {
            return;
        }

        const snapshot = Array.from(handlers);
        snapshot.forEach(handler => {
            try {
                handler(payload);
            } catch (error) {
                console.warn(`PerformanceHub listener for "${event}" failed:`, error);
            }
        });
    }

    registerTouchPadController(controller) {
        this.touchPadController = controller;
        this.emit('touchpad-registered', { controller });
        if (controller?.getMappings) {
            this.emit('touchpad-mapping-change', { mappings: this.clone(controller.getMappings()) });
        }
    }

    registerAudioPanel(panel) {
        this.audioPanel = panel;
        this.emit('audio-panel-registered', { panel });
        if (panel?.getSettings) {
            this.emit('audio-settings-change', { settings: this.clone(panel.getSettings()) });
        }
    }

    registerPresetManager(manager) {
        this.presetManager = manager;
        this.emit('preset-manager-registered', { manager });
        if (manager?.exportState) {
            const state = manager.exportState();
            this.emit('preset-list-changed', {
                presets: this.clone(state.presets),
                sequence: this.clone(state.sequence),
                sequenceSettings: this.clone(state.sequenceSettings)
            });
        }
    }

    getState() {
        return {
            touchPads: this.clone(this.touchPadController?.getMappings?.()),
            audio: this.clone(this.audioPanel?.getSettings?.()),
            presets: this.presetManager?.exportState?.() || { presets: [], sequence: [], sequenceSettings: {} },
            extensions: this.listExtensions()
        };
    }

    applyState(state = {}) {
        if (state.touchPads && this.touchPadController?.applyMappings) {
            this.touchPadController.applyMappings(this.clone(state.touchPads));
        }

        if (state.audio && this.audioPanel?.setSettings) {
            this.audioPanel.setSettings(this.clone(state.audio));
        }

        if (state.presets && this.presetManager?.importState) {
            this.presetManager.importState(this.clone(state.presets));
        }
    }

    registerExtension(name, api = {}) {
        if (!name) return () => {};
        this.extensions.set(name, api);
        this.emit('extension-registered', { name, api });
        return () => {
            const existing = this.extensions.get(name);
            if (existing === api) {
                this.extensions.delete(name);
                this.emit('extension-unregistered', { name, api });
            }
        };
    }

    unregisterExtension(name) {
        if (!this.extensions.has(name)) return;
        const api = this.extensions.get(name);
        this.extensions.delete(name);
        this.emit('extension-unregistered', { name, api });
    }

    getExtension(name) {
        return this.extensions.get(name);
    }

    listExtensions() {
        return Array.from(this.extensions.keys());
    }

    destroy() {
        this.listeners.clear();
        this.touchPadController = null;
        this.audioPanel = null;
        this.presetManager = null;
        this.extensions.clear();
    }

    clone(data) {
        if (data === null || data === undefined) return data;
        try {
            return JSON.parse(JSON.stringify(data));
        } catch (error) {
            return data;
        }
    }
}
