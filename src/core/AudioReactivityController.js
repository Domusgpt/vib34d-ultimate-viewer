/**
 * AudioReactivityController
 * Centralizes access to filtered audio-reactive bands and
 * respects live performance band toggles.
 */
export class AudioReactivityController {
    static defaultBands = {
        bass: true,
        mid: true,
        high: true,
        energy: true
    };

    static getBandValue(band) {
        if (!window.audioEnabled || !window.audioReactive) {
            return 0;
        }

        const bands = window.audioReactivityBands || AudioReactivityController.defaultBands;
        if (bands && bands[band] === false) {
            return 0;
        }

        return window.audioReactive?.[band] || 0;
    }

    static getFilteredBands() {
        if (!window.audioEnabled || !window.audioReactive) {
            return null;
        }

        const bands = window.audioReactivityBands || AudioReactivityController.defaultBands;
        return {
            bass: bands.bass === false ? 0 : (window.audioReactive?.bass || 0),
            mid: bands.mid === false ? 0 : (window.audioReactive?.mid || 0),
            high: bands.high === false ? 0 : (window.audioReactive?.high || 0),
            energy: bands.energy === false ? 0 : (window.audioReactive?.energy || 0)
        };
    }

    static setBandEnabled(band, enabled) {
        const next = {
            ...AudioReactivityController.defaultBands,
            ...(window.audioReactivityBands || {})
        };

        next[band] = enabled;
        window.audioReactivityBands = next;
        window.dispatchEvent(new CustomEvent('audio-reactivity-bands-changed', {
            detail: { bands: next, band, enabled }
        }));
        return next;
    }

    static setBands(bands) {
        window.audioReactivityBands = {
            ...AudioReactivityController.defaultBands,
            ...bands
        };
        window.dispatchEvent(new CustomEvent('audio-reactivity-bands-changed', {
            detail: { bands: window.audioReactivityBands }
        }));
        return window.audioReactivityBands;
    }
}

window.AudioReactivityController = AudioReactivityController;
