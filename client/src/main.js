// Import polyfills first
import './webrtc-polyfills.js';

// Then import the game
import game from './components/core/Game.js';

// Expose game globally so Player.js can access it directly for health updates
window.game = game;

// Add global function for attack miss feedback
window.showAttackMissedFeedback = (reason, distance, maxRange) => {
  console.log('Global showAttackMissedFeedback called:', reason, distance, maxRange);
  if (window.game && typeof window.game.showAttackMissedFeedback === 'function') {
    window.game.showAttackMissedFeedback(reason, distance, maxRange);
  } else {
    // Fallback if game function is not available
    console.warn(`Attack missed: ${reason}. Distance: ${distance}, Max Range: ${maxRange}`);
    
    // Create a temporary DOM element for feedback
    const missIndicator = document.createElement('div');
    missIndicator.textContent = 'MISS!';
    missIndicator.style.position = 'absolute';
    missIndicator.style.top = '50%';
    missIndicator.style.left = '50%';
    missIndicator.style.transform = 'translate(-50%, -50%)';
    missIndicator.style.color = 'red';
    missIndicator.style.fontSize = '24px';
    missIndicator.style.fontWeight = 'bold';
    missIndicator.style.textShadow = '0 0 5px black';
    missIndicator.style.zIndex = '1000';
    
    document.body.appendChild(missIndicator);
    
    // Remove after 1 second
    setTimeout(() => {
      document.body.removeChild(missIndicator);
    }, 1000);
  }
};

// Add global debug function for network testing
window.debugNetwork = () => {
  console.log("=== NETWORK DEBUG ===");
  
  // Check if WebSocket is connected
  if (window.game && window.game.networkManager) {
    const connected = window.game.networkManager.connected;
    console.log(`WebSocket connected: ${connected}`);
    
    // Show player ID
    console.log(`Local player ID: ${window.game.networkManager.playerId}`);
    
    // Show other players
    const otherPlayers = window.game.networkManager.otherPlayers;
    console.log(`Connected players: ${Object.keys(otherPlayers).length}`);
    Object.keys(otherPlayers).forEach(id => {
      console.log(`- Player ${id} (${otherPlayers[id].class})`);
    });
    
    // Send a ping to test connection
    console.log("Sending ping to server...");
    window.game.networkManager.sendMessage({
      type: 'ping',
      timestamp: Date.now()
    });
  } else {
    console.log("Game or NetworkManager not initialized");
  }
};

// Add global function to test attack functionality
window.testAttack = (targetId = null) => {
  console.log("=== ATTACK TEST ===");
  
  if (!window.game || !window.game.player) {
    console.error("Game or player not initialized");
    return;
  }
  
  try {
    // If no target ID provided, find the nearest player
    if (!targetId) {
      console.log("No target ID provided, finding nearest player...");
      
      // Get all player entities
      const players = window.game.getEntitiesByType('player');
      console.log(`Found ${players.length} players`);
      
      // Filter out the local player
      const otherPlayers = players.filter(p => p.id !== window.game.player.id);
      console.log(`Found ${otherPlayers.length} other players`);
      
      if (otherPlayers.length === 0) {
        console.error("No other players found to attack");
        return;
      }
      
      // Find the nearest player
      let nearestPlayer = null;
      let nearestDistance = Infinity;
      
      otherPlayers.forEach(player => {
        const distance = window.game.player.position.distanceTo(player.position);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPlayer = player;
        }
      });
      
      if (nearestPlayer) {
        targetId = nearestPlayer.id;
        console.log(`Selected nearest player: ${targetId} at distance ${nearestDistance.toFixed(2)}`);
      }
    }
    
    if (!targetId) {
      console.error("No target ID available");
      return;
    }
    
    // Get the target entity
    const target = window.game.getEntityById(targetId);
    if (!target) {
      console.error(`Target entity ${targetId} not found`);
      return;
    }
    
    console.log(`Attacking target: ${targetId}`);
    console.log(`Target position: ${JSON.stringify(target.position)}`);
    console.log(`Player position: ${JSON.stringify(window.game.player.position)}`);
    
    // Calculate distance
    const distance = window.game.player.position.distanceTo(target.position);
    console.log(`Distance to target: ${distance.toFixed(2)}`);
    
    // Execute attack
    const damage = window.game.player.primaryAttack.damage;
    window.game.player._executeAttack(targetId, damage, distance);
    
    console.log(`Attack executed with damage: ${damage}`);
  } catch (error) {
    console.error("Error in testAttack:", error);
  }
};

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