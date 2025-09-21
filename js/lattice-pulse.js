import { LatticePulseGame } from '../src/game/LatticePulseGame.js';

const registerServiceWorker = () => {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw-lattice-pulse.js').catch(err => {
                console.warn('Service worker registration failed', err);
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('visualizer');
    const hudElement = document.getElementById('hud');
    if (!container || !hudElement) {
        throw new Error('Missing required DOM nodes for Lattice Pulse');
    }

    const game = new LatticePulseGame({ container, hudElement });
    window.latticePulseGame = game;
    await game.start();

    const modeBtn = document.getElementById('modeButton');
    const geometryBtn = document.getElementById('geometryButton');
    const levelBtn = document.getElementById('nextLevelButton');

    modeBtn?.addEventListener('click', () => {
        game.modeController.cycleMode();
        const mode = game.modeController.activeMode;
        game.hud.setMode(mode);
        game.hud.showToast(`${mode.toUpperCase()} MODE`);
    });

    geometryBtn?.addEventListener('click', () => {
        const nextIndex = game.geometryController.cycleGeometry();
        game.modeController.setGeometry(nextIndex);
        const name = game.geometryController.getGeometryName(nextIndex);
        game.hud.setGeometry(name);
        game.hud.showToast(name);
    });

    levelBtn?.addEventListener('click', () => {
        game.nextLevel();
        game.hud.showToast('Level Advance');
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            game.audioService?.pause?.();
        }
    });

    registerServiceWorker();
});
