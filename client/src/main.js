import game from './components/core/Game.js';

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (canvas) {
    // Initialize game with the canvas element
    game.init(canvas);
  } else {
    console.error('Game canvas not found');
  }
});