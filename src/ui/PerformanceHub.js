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

    registerExtension(extension = {}) {
        const id = extension?.id;
        if (!id) {
            console.warn('PerformanceHub extension registration requires an "id" field.');
            return () => {};
        }

        if (this.extensions.has(id)) {
            this.unregisterExtension(id);
        }

        this.extensions.set(id, extension);

        try {
            extension.onRegister?.({
                hub: this,
                engine: this.engine,
                parameterManager: this.parameterManager,
                state: this.getState(),
                metadata: this.getParameterMetadata()
            });
        } catch (error) {
            console.warn(`PerformanceHub extension "${id}" onRegister failed:`, error);
        }

        this.emit('extension-registered', { id, extension });

        return () => this.unregisterExtension(id);
    }

    unregisterExtension(id) {
        if (!id || !this.extensions.has(id)) {
            return;
        }

        const extension = this.extensions.get(id);
        this.extensions.delete(id);

        try {
            extension?.onDestroy?.();
        } catch (error) {
            console.warn(`PerformanceHub extension "${id}" onDestroy failed:`, error);
        }

        this.emit('extension-unregistered', { id });
    }

    getParameterMetadata() {
        if (!this.parameterManager?.listParameterMetadata) {
            return [];
        }
        try {
            return this.clone(this.parameterManager.listParameterMetadata());
        } catch (error) {
            return [];
        }
    }

    publishParameterMetadata() {
        const metadata = this.getParameterMetadata();
        this.emit('parameter-metadata', { parameters: metadata });
        return metadata;
    }

    broadcastState() {
        const state = this.getState();
        this.emit('state-change', { state: this.clone(state) });
        return state;
    }

    registerTouchPadController(controller) {
        this.touchPadController = controller;
        this.emit('touchpad-registered', { controller });
        if (controller?.getMappings) {
            this.emit('touchpad-mapping-change', { mappings: this.clone(controller.getMappings()) });
        }
        this.broadcastState();
    }

    registerAudioPanel(panel) {
        this.audioPanel = panel;
        this.emit('audio-panel-registered', { panel });
        if (panel?.getSettings) {
            this.emit('audio-settings-change', { settings: this.clone(panel.getSettings()) });
        }
        this.broadcastState();
    }

    registerPresetManager(manager) {
        this.presetManager = manager;
        this.emit('preset-manager-registered', { manager });
        if (manager?.exportState) {
            const state = manager.exportState();
            this.emit('preset-list-changed', {
                presets: this.clone(state.presets),
                sequence: this.clone(state.sequence)
            });
        }
        this.broadcastState();
    }

    getState() {
        return {
            touchPads: this.clone(this.touchPadController?.getMappings?.()),
            audio: this.clone(this.audioPanel?.getSettings?.()),
            presets: this.presetManager?.exportState?.() || { presets: [], sequence: [] }
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

        const snapshot = this.getState();
        this.emit('state-applied', { state: this.clone(snapshot), input: this.clone(state) });
        this.broadcastState();
    }

    destroy() {
        this.listeners.clear();
        this.touchPadController = null;
        this.audioPanel = null;
        this.presetManager = null;
        this.extensions.forEach((extension, id) => {
            try {
                extension?.onDestroy?.();
            } catch (error) {
                console.warn(`PerformanceHub extension "${id}" onDestroy failed during cleanup:`, error);
            }
        });
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
