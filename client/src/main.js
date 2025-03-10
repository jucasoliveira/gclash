import game from './components/core/Game.js';

// Expose game globally so Player.js can access it directly for health updates
window.game = game;

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (canvas) {
    // Initialize game with the canvas element
    game.init(canvas);
    
    // Set up direct health update monitoring
    // This event listener will monitor all health changes and force UI updates
    document.addEventListener('player-health-changed', (event) => {
      if (event.detail && event.detail.health !== undefined) {
        console.log('GLOBAL HEALTH EVENT: Forcing UI update from global event');
        game.updateHealthUI(event.detail.health, event.detail.maxHealth);
      }
    });
    
    console.log('Game setup complete - health bar system initialized');
  } else {
    console.error('Game canvas not found');
  }
});