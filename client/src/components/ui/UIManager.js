import eventBus from '../core/EventBus.js';
import HUD from './HUD.js';
import tournamentBracket from './TournamentBracket.js';

/**
 * UIManager - Manages all UI elements and screens
 * Handles UI transitions, state, and coordinates UI input and events
 */
class UIManager {
  constructor() {
    this.isInitialized = false;
    this.components = {
      hud: null,
      tournamentBracket: tournamentBracket
    };
  }

  /**
   * Initialize the UI Manager
   * @returns {UIManager} This instance for chaining
   */
  init() {
    if (this.isInitialized) return this;

    console.log('Initializing UI Manager...');

    // Initialize HUD component
    this.components.hud = new HUD().init();

    // TournamentBracket is already initialized in its module

    // Set up event listeners
    this._setupEventListeners();

    this.isInitialized = true;
    return this;
  }

  /**
   * Set up event listeners for UI-related events
   * @private
   */
  _setupEventListeners() {
    // Listen for player health changes to update HUD
    eventBus.on('player.healthChanged', (data) => {
      if (this.components.hud) {
        this.components.hud.updateHealth(data.health, data.maxHealth);
      }
    });

    // Listen for player mana changes to update HUD (will be implemented later)
    eventBus.on('player.manaChanged', (data) => {
      if (this.components.hud) {
        this.components.hud.updateMana(data.mana, data.maxMana);
      }
    });

    // Listen for skill cooldown updates
    eventBus.on('player.cooldownUpdate', (data) => {
      if (this.components.hud) {
        this.components.hud.updateCooldown(data.skillIndex, data.remainingTime, data.totalTime);
      }
    });

    // Listen for game state changes
    eventBus.on('game.started', () => {
      if (this.components.hud) {
        this.components.hud.show();
      }
    });

    eventBus.on('game.stopped', () => {
      if (this.components.hud) {
        this.components.hud.hide();
      }
    });
    
    // Listen for death screen event
    eventBus.on('ui.showDeathScreen', (data = {}) => {
      this.showDeathScreen(data.attackerId);
    });
    
    // Listen for WebSocket tournament messages and relay to eventBus
    eventBus.on('websocket.message', (data) => {
      if (data.type === 'tournamentStarted') {
        eventBus.emit('tournamentStarted', data);
      } else if (data.type === 'tournamentBracketUpdate') {
        eventBus.emit('tournamentBracketUpdate', data);
      } else if (data.type === 'tournamentComplete') {
        eventBus.emit('tournamentComplete', data);
      }
    });
  }

  /**
   * Show the HUD
   */
  showHUD() {
    if (this.components.hud) {
      console.log('UIManager: Showing HUD');
      this.components.hud.show();
    } else {
      console.error('UIManager: Cannot show HUD - component not initialized');
      // Try to initialize it if it's not already
      if (!this.isInitialized) {
        console.log('UIManager: Attempting to initialize on demand');
        this.init();
      }
      if (this.components.hud) {
        this.components.hud.show();
      }
    }
  }

  /**
   * Hide the HUD
   */
  hideHUD() {
    if (this.components.hud) {
      this.components.hud.hide();
    }
  }
  
  /**
   * Show the tournament bracket
   */
  showTournamentBracket() {
    if (this.components.tournamentBracket) {
      this.components.tournamentBracket.show();
    }
  }
  
  /**
   * Hide the tournament bracket
   */
  hideTournamentBracket() {
    if (this.components.tournamentBracket) {
      this.components.tournamentBracket.hide();
    }
  }
  
  /**
   * Toggle the tournament bracket visibility
   */
  toggleTournamentBracket() {
    if (this.components.tournamentBracket) {
      this.components.tournamentBracket.toggle();
    }
  }

  /**
   * Show the death screen when player dies
   * @param {string} attackerId - ID of the player who killed the local player
   */
  showDeathScreen(attackerId) {
    console.log('UIManager: Showing death screen, killed by:', attackerId);
    
    // Prevent showing multiple death screens
    const existingDeathScreen = document.getElementById('death-screen');
    if (existingDeathScreen && existingDeathScreen.style.display === 'flex') {
      console.log('Death screen already visible, not showing another one');
      return;
    }
    
    // Get player reference
    const player = window.game?.player;
    
    // Mark that death screen has been shown if player exists
    if (player) {
      player.deathScreenShown = true;
    }
    
    // Create or get death screen element
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
    
    // Store interval ID so we can clear it if needed
    if (this._respawnCountdownInterval) {
      clearInterval(this._respawnCountdownInterval);
    }
    
    this._respawnCountdownInterval = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = countdown;
      }
      
      if (countdown <= 0) {
        clearInterval(this._respawnCountdownInterval);
        this._respawnCountdownInterval = null;
        
        // Hide death screen with fade-out
        deathScreen.style.opacity = '0';
        setTimeout(() => {
          deathScreen.style.display = 'none';
          
          // Respawn player
          if (window.game && window.game.player && typeof window.game.player._respawn === 'function' && 
              window.game.player.isDead) { // Only respawn if player is actually dead
            console.log('UIManager: Triggering player respawn');
            window.game.player._respawn();
          } else {
            console.log('UIManager: Player already respawned or respawn function not available');
          }
        }, 500);
      }
    }, 1000);
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Clean up event listeners
    eventBus.off('player.healthChanged');
    eventBus.off('player.manaChanged');
    eventBus.off('player.cooldownUpdate');
    eventBus.off('game.started');
    eventBus.off('game.stopped');
    eventBus.off('ui.showDeathScreen');
    eventBus.off('websocket.message');

    // Dispose components
    if (this.components.hud) {
      this.components.hud.dispose();
    }
    
    if (this.components.tournamentBracket) {
      this.components.tournamentBracket.dispose();
    }

    this.isInitialized = false;
  }
}

// Create singleton instance
const uiManager = new UIManager();

export default uiManager;