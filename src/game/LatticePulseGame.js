/**
 * Lattice Pulse Game controller
 * Handles the user flow for unlocking audio playback and starting the loop.
 */
export class LatticePulseGame {
    constructor({ audioService, gameLoop, hud } = {}) {
        this.audioService = audioService;
        this.gameLoop = gameLoop;
        this.hud = hud;
        this.awaitingStart = true;
        this.startScreenSelector = '#lp-start-screen';
    }

    /**
     * Get the start screen overlay element.
     */
    get startScreen() {
        return document.querySelector(this.startScreenSelector);
    }

    /**
     * Handle the start button interaction. Unlocks audio playback and kicks off the game loop.
     */
    async startButtonAction() {
        if (!this.awaitingStart) return;

        this.awaitingStart = false;
        const startScreen = this.startScreen;
        if (startScreen) {
            startScreen.classList.add('hidden');
        }

        try {
            if (!this.audioService || typeof this.audioService.start !== 'function') {
                throw new Error('Audio service unavailable');
            }

            await this.audioService.start();
        } catch (error) {
            this.awaitingStart = true;
            if (startScreen) {
                startScreen.classList.remove('hidden');
            }

            const errorMessage = error?.message ? error.message : 'Unknown audio error';
            const message = `Audio failed to initialize: ${errorMessage}. Please check your audio settings and try again.`;
            if (this.hud?.error) {
                this.hud.error(message);
            } else if (this.hud?.setStatus) {
                this.hud.setStatus(message, 'error');
            }

            console.error('LatticePulseGame audio start failed:', error);
            return;
        }

        this.gameLoop?.start?.();
    }
}
