export class PerformanceHub {
    constructor({ engine = null, parameterManager = null } = {}) {
        this.engine = engine;
        this.parameterManager = parameterManager;
        this.listeners = new Map();
    }

    on(eventName, handler) {
        if (!eventName || typeof handler !== 'function') {
            return () => {};
        }

        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }

        const handlers = this.listeners.get(eventName);
        handlers.add(handler);

        return () => {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.listeners.delete(eventName);
            }
        };
    }

    emit(eventName, payload) {
        const handlers = this.listeners.get(eventName);
        if (!handlers) return;

        handlers.forEach(handler => {
            try {
                handler(payload);
            } catch (error) {
                console.warn(`PerformanceHub listener for "${eventName}" failed`, error);
            }
        });
    }
}
