// Import polyfills first
import './webrtc-polyfills.js';

// Then import the game
import game from './components/core/Game.js';

// Expose game globally so Player.js can access it directly for health updates
window.game = game;

// Add global debug function to test WebSocket connection
window.testConnection = () => {
  if (!window.game) {
    console.error('Game not initialized');
    return;
  }
  
  const networkManager = window.game.networkManager;
  if (!networkManager) {
    console.error('NetworkManager not available');
    return;
  }
  
  console.log('Testing WebSocket connection...');
  console.log('Player ID:', networkManager.playerId);
  console.log('Connected:', networkManager.connected);
  console.log('Other players:', Object.keys(networkManager.otherPlayers));
};

// Global function to show death screen
window.showDeathScreen = (attackerId) => {
  console.log('Global showDeathScreen called with attacker:', attackerId);
  
  // Create death screen if it doesn't exist
  let deathScreen = document.getElementById('death-screen');
  if (!deathScreen) {
    deathScreen = document.createElement('div');
    deathScreen.id = 'death-screen';
    deathScreen.style.position = 'fixed';
    deathScreen.style.top = '0';
    deathScreen.style.left = '0';
    deathScreen.style.width = '100%';
    deathScreen.style.height = '100%';
    deathScreen.style.backgroundColor = 'rgba(139, 0, 0, 0.7)';
    deathScreen.style.color = 'white';
    deathScreen.style.display = 'flex';
    deathScreen.style.flexDirection = 'column';
    deathScreen.style.justifyContent = 'center';
    deathScreen.style.alignItems = 'center';
    deathScreen.style.zIndex = '1000';
    deathScreen.style.fontFamily = 'Arial, sans-serif';
    deathScreen.style.transition = 'opacity 0.5s ease-in-out';
    deathScreen.style.opacity = '0';
    document.body.appendChild(deathScreen);
  }
  
  // Get attacker name or ID
  const attackerName = attackerId || 'Unknown';
  
  // Set content
  deathScreen.innerHTML = `
    <h1 style="font-size: 72px; margin-bottom: 20px; text-shadow: 0 0 10px #ff0000;">YOU DIED</h1>
    <p style="font-size: 24px; margin-bottom: 40px;">Killed by: ${attackerName}</p>
    <p style="font-size: 18px;">Respawning in <span id="respawn-countdown">5</span> seconds...</p>
  `;
  
  // Show death screen with fade-in
  deathScreen.style.display = 'flex';
  setTimeout(() => {
    deathScreen.style.opacity = '1';
  }, 10);
  
  // Start countdown
  let countdown = 5;
  const countdownElement = document.getElementById('respawn-countdown');
  
  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdownElement) {
      countdownElement.textContent = countdown;
    }
    
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      
      // Hide death screen with fade-out
      deathScreen.style.opacity = '0';
      setTimeout(() => {
        deathScreen.style.display = 'none';
        
        // Respawn player
        if (game.player && typeof game.player._respawn === 'function') {
          game.player._respawn();
        }
      }, 500);
    }
  }, 1000);
};

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
    
    // Listen for player death events
    document.addEventListener('player-died', (event) => {
      console.log('GLOBAL DEATH EVENT:', event.detail);
      if (window.showDeathScreen && event.detail && event.detail.attackerId) {
        window.showDeathScreen(event.detail.attackerId);
      }
    });
    
    console.log('Game setup complete - health bar system initialized');
  } else {
    console.error('Game canvas not found');
  }
});