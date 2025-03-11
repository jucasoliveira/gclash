/**
 * Utility functions for the game that need to be globally accessible
 * These functions are attached to the window object for compatibility with existing code
 */

// Update health UI
export const updateHealthUI = (health, maxHealth) => {
  const healthFill = document.getElementById('health-fill');
  const playerStats = document.getElementById('player-stats');
  const gameUI = document.getElementById('game-ui');
  
  // Make sure UI is visible
  if (gameUI && gameUI.style.display === 'none') {
    gameUI.style.display = 'flex';
  }
  
  if (healthFill) {
    // Calculate percentage
    const percentage = Math.max(0, Math.min(100, (health / maxHealth) * 100));
    
    // Force immediate update
    healthFill.style.transition = 'none';
    healthFill.style.width = percentage + '%';
    
    // Set color based on health percentage
    if (percentage > 60) {
      healthFill.style.backgroundColor = '#2ecc71'; // Green
    } else if (percentage > 30) {
      healthFill.style.backgroundColor = '#f39c12'; // Orange
    } else {
      healthFill.style.backgroundColor = '#e74c3c'; // Red
    }
    
    // Force browser reflow
    healthFill.offsetHeight;
    
    // Re-enable transition after a small delay
    setTimeout(() => {
      healthFill.style.transition = 'width 0.3s ease-out, background-color 0.3s ease-out';
    }, 50);
  }
  
  if (playerStats) {
    playerStats.textContent = `Health: ${Math.round(health)}/${maxHealth}`;
  }
};

// Show death screen
export const showDeathScreen = (attackerId) => {
  console.log('Showing death screen');
  
  // Get death overlay
  const deathOverlay = document.getElementById('death-overlay');
  const respawnTimer = document.getElementById('respawn-timer');
  const deathMessage = document.querySelector('.death-message');
  
  if (!deathOverlay) {
    console.error('Death overlay not found in DOM!');
    return;
  }
  
  // Update death message if attacker info is available
  if (attackerId) {
    deathMessage.textContent = `You were defeated by player ${attackerId}!`;
  } else {
    deathMessage.textContent = 'You were defeated in battle!';
  }
  
  // Show death overlay
  deathOverlay.style.display = 'flex';
  
  // Start respawn countdown
  let countdown = 3;
  respawnTimer.textContent = `Respawning in ${countdown}...`;
  
  const interval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      respawnTimer.textContent = `Respawning in ${countdown}...`;
    } else {
      respawnTimer.textContent = 'Respawning...';
      clearInterval(interval);
      
      // Hide death overlay after a short delay
      setTimeout(() => {
        deathOverlay.style.display = 'none';
      }, 500);
    }
  }, 1000);
};

// Initialize global functions
export const initGlobalFunctions = () => {
  // Attach functions to window object for compatibility with existing code
  window.updateHealthUI = updateHealthUI;
  window.showDeathScreen = showDeathScreen;
  
  // Set up event listeners for custom events
  document.addEventListener('player-health-changed', (event) => {
    if (event.detail && event.detail.health !== undefined) {
      console.log('GLOBAL HEALTH EVENT: Forcing UI update from global event');
      updateHealthUI(event.detail.health, event.detail.maxHealth);
    }
  });
  
  document.addEventListener('player-died', (event) => {
    console.log('GLOBAL DEATH EVENT:', event.detail);
    if (event.detail && event.detail.attackerId) {
      showDeathScreen(event.detail.attackerId);
    }
  });
  
  document.addEventListener('socket-health-update', (event) => {
    if (event.detail) {
      updateHealthUI(event.detail.health, event.detail.maxHealth);
    }
  });
}; 