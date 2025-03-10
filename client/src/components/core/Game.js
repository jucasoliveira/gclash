import eventBus from './EventBus.js';
import renderer from './Renderer.js';
import inputManager from '../controls/InputManager.js';
import webSocketManager from '../network/WebSocketManager.js';
import entityManager from '../entities/EntityManager.js';
import grid from '../world/Grid.js';
import uiManager from '../ui/UIManager.js';
import CHARACTER_CLASSES from '../../config/classes.js';

/**
 * Game - Main game controller
 * Manages game state and coordinates systems
 */
class Game {
  constructor() {
    // Game state
    this.isInitialized = false;
    this.isRunning = false;
    this.state = 'idle'; // idle, loading, characterSelection, playing, gameover
    
    // Selected class
    this.selectedClass = null;
    
    // Expose managers for direct access
    this.networkManager = webSocketManager;
    this.entityManager = entityManager;
    this.renderer = renderer;
    this.inputManager = inputManager;
    this.uiManager = uiManager;
    
    // Event bindings
    this._boundHandleClassSelection = this._handleClassSelection.bind(this);
    this._boundHandleStartGame = this._handleStartGame.bind(this);
  }

  /**
   * Initialize the game
   * @param {HTMLCanvasElement} canvas - Canvas element for rendering
   * @returns {Game} - This instance for chaining
   */
  init(canvas) {
    if (this.isInitialized) return this;
    
    console.log('Initializing Guild Clash...');
    
    // Initialize systems
    renderer.init(canvas);
    inputManager.init();
    entityManager.init();
    grid.init();
    webSocketManager.configure();
    uiManager.init();
    
    // Set up UI event listeners
    this._setupUIEvents();
    
    // Listen for player health changes
    eventBus.on('network.playerHealthChanged', (data) => {
      if (this.player && data.id === this.player.id) {
        console.log(`Game received health change for player: ${data.health}/${data.maxHealth}`);
        this.updateHealthUI(data.health, data.maxHealth);
      }
    });
    
    // Listen for player attacks
    eventBus.on('network.playerAttacked', (data) => {
      if (this.player && data.targetId === this.player.id) {
        console.log(`Game received attack on player: ${data.damage} damage`);
        
        // Update health directly if we have the player reference
        if (this.player.health !== undefined) {
          // Calculate new health
          const newHealth = Math.max(0, this.player.health - data.damage);
          
          // Update UI immediately
          this.updateHealthUI(newHealth, this.player.stats.health);
          
          // Also update the player object's health
          this.player.health = newHealth;
          
          console.log(`Directly set player health to ${newHealth} from attack and updated UI`);
          
          // Force direct DOM update (bypass animation frames)
          const healthFill = document.getElementById('health-fill');
          if (healthFill) {
            const percentage = Math.max(0, Math.min(100, (newHealth / this.player.stats.health) * 100));
            healthFill.style.width = `${percentage}%`;
            
            // Change color based on health percentage
            if (percentage > 60) {
              healthFill.style.backgroundColor = '#2ecc71'; // Green for high health
            } else if (percentage > 30) {
              healthFill.style.backgroundColor = '#f39c12'; // Orange for medium health
            } else {
              healthFill.style.backgroundColor = '#e74c3c'; // Red for low health
            }
          }
        }
      }
    });
    
    // Set game state
    this.state = 'characterSelection';
    this._showCharacterSelection();
    
    this.isInitialized = true;
    
    return this;
  }

  /**
   * Set up UI event listeners
   * @private
   */
  _setupUIEvents() {
    // Character selection
    const clerkClass = document.getElementById('clerk-class');
    const warriorClass = document.getElementById('warrior-class');
    const rangerClass = document.getElementById('ranger-class');
    const startButton = document.getElementById('start-game');
    
    if (clerkClass) {
      clerkClass.addEventListener('click', () => this._handleClassSelection('CLERK'));
    }
    
    if (warriorClass) {
      warriorClass.addEventListener('click', () => this._handleClassSelection('WARRIOR'));
    }
    
    if (rangerClass) {
      rangerClass.addEventListener('click', () => this._handleClassSelection('RANGER'));
    }
    
    if (startButton) {
      startButton.addEventListener('click', this._boundHandleStartGame);
    }
  }

  /**
   * Handle character class selection
   * @param {string} classType - Selected class type
   * @private
   */
  _handleClassSelection(classType) {
    if (!CHARACTER_CLASSES[classType]) {
      console.error(`Invalid class type: ${classType}`);
      return;
    }
    
    this.selectedClass = classType;
    
    // Update UI
    const clerkClass = document.getElementById('clerk-class');
    const warriorClass = document.getElementById('warrior-class');
    const rangerClass = document.getElementById('ranger-class');
    const startButton = document.getElementById('start-game');
    
    // Remove selected class from all
    if (clerkClass) clerkClass.classList.remove('selected');
    if (warriorClass) warriorClass.classList.remove('selected');
    if (rangerClass) warriorClass.classList.remove('selected');
    
    // Add selected class to clicked element
    if (classType === 'CLERK' && clerkClass) {
      clerkClass.classList.add('selected');
    } else if (classType === 'WARRIOR' && warriorClass) {
      warriorClass.classList.add('selected');
    } else if (classType === 'RANGER' && rangerClass) {
      rangerClass.classList.add('selected');
    }
    
    // Show start button
    if (startButton) {
      startButton.classList.add('visible');
    }
    
    // Emit event
    eventBus.emit('game.classSelected', { classType });
  }

  /**
   * Handle start game button click
   * @private
   */
  _handleStartGame() {
    if (!this.selectedClass) {
      alert('Please select a character class before starting');
      return;
    }
    
    // Hide character selection
    this._hideCharacterSelection();
    
    // Show game UI
    this._showGameUI();
    
    // Start the game
    this.start();
  }

  /**
   * Show character selection UI
   * @private
   */
  _showCharacterSelection() {
    const characterSelection = document.getElementById('character-selection');
    if (characterSelection) {
      characterSelection.style.display = 'flex';
    }
  }

  /**
   * Hide character selection UI
   * @private
   */
  _hideCharacterSelection() {
    const characterSelection = document.getElementById('character-selection');
    if (characterSelection) {
      characterSelection.style.display = 'none';
    }
  }

  /**
   * Show game UI
   * @private
   */
  _showGameUI() {
    // We're transitioning away from the old UI, but we'll keep the function
    // for compatibility. Now we primarily use the HUD system.
    
    // Show the new HUD with health and mana orbs
    uiManager.showHUD();
    
    // The code below maintains compatibility with the old UI system,
    // but the elements are now hidden via CSS
    const gameUI = document.getElementById('game-ui');
    if (gameUI) {
      gameUI.classList.add('visible');
      
      // Update UI with player stats (for compatibility)
      const playerClass = document.getElementById('player-class');
      const playerStats = document.getElementById('player-stats');
      const playerColor = document.getElementById('player-color');
      const healthFill = document.getElementById('health-fill');
      const cooldownLabel = document.querySelector('.cooldown-label');
      const cooldownFill = document.getElementById('cooldown-fill');
      
      if (playerClass && this.selectedClass) {
        playerClass.textContent = `Class: ${CHARACTER_CLASSES[this.selectedClass].name}`;
      }
      
      if (playerStats && this.selectedClass) {
        playerStats.textContent = `Health: ${CHARACTER_CLASSES[this.selectedClass].health}`;
      }
      
      if (playerColor && this.selectedClass) {
        playerColor.style.backgroundColor = `#${CHARACTER_CLASSES[this.selectedClass].color.toString(16)}`;
      }
      
      if (healthFill) {
        healthFill.style.width = '100%';
      }
      
      // Update attack name in cooldown label
      if (cooldownLabel && this.selectedClass) {
        const attackName = CHARACTER_CLASSES[this.selectedClass].abilities.primary.name;
        cooldownLabel.textContent = `${attackName}:`;
      }
      
      // Set cooldown to ready
      if (cooldownFill) {
        cooldownFill.style.width = '100%';
        cooldownFill.style.backgroundColor = '#2ecc71'; // Green when ready
      }
    }
  }

  /**
   * Start the game
   * @returns {Game} - This instance for chaining
   */
  async start() {
    if (!this.isInitialized) {
      console.error('Game not initialized. Call init() first.');
      return this;
    }
    
    if (this.isRunning) return this;
    
    console.log('Starting Guild Clash...');
    
    // Update state
    this.state = 'loading';
    
    try {
      // Connect to server
      await webSocketManager.connect();
      
      // Create player with selected class and store reference
      this.player = entityManager.createPlayer(this.selectedClass);
      
      // Set player ID in the HUD
      if (this.player && uiManager.components.hud) {
        uiManager.components.hud.id = this.player.id;
        console.log(`Game: Set player ID in HUD: ${this.player.id}`);
      }
      
      // Listen for health changes on our own player
      eventBus.on(`entity.${this.player.id}.healthChanged`, (data) => {
        console.log(`Game received local player health change: ${data.health}/${data.maxHealth}`);
        this.updateHealthUI(data.health, data.maxHealth);
      });
      
      // Join the game with player data
      webSocketManager.joinGame({
        position: this.player.position,
        class: this.selectedClass,
        stats: this.player.stats,
        type: 'player'
      });
      
      // Listen for join failures
      const joinFailureHandler = (data) => {
        console.error('Failed to join game:', data.error);
        eventBus.off('network.joinFailed', joinFailureHandler);
        throw new Error('Failed to join game');
      };
      
      eventBus.once('network.joinFailed', joinFailureHandler);
      
      // Start rendering
      renderer.startRendering();
      
      // Update state
      this.state = 'playing';
      this.isRunning = true;
      
      // Emit event
      eventBus.emit('game.started');
      
      // Explicitly show HUD
      uiManager.showHUD();
      
      // Remove the join failure handler
      eventBus.off('network.joinFailed', joinFailureHandler);
    } catch (error) {
      console.error('Failed to start game:', error);
      
      // Update state
      this.state = 'characterSelection';
      
      // Show error to user
      alert('Failed to connect to server. Please try again.');
    }
    
    return this;
  }

  /**
   * Stop the game
   * @returns {Game} - This instance for chaining
   */
  stop() {
    if (!this.isRunning) return this;
    
    console.log('Stopping Guild Clash...');
    
    // Stop rendering
    renderer.stopRendering();
    
    // Disconnect from server
    webSocketManager.disconnect();
    
    // Update state
    this.state = 'idle';
    this.isRunning = false;
    
    // Emit event
    eventBus.emit('game.stopped');
    
    return this;
  }

  /**
   * Update UI with player health
   * @param {number} health - Current health
   * @param {number} maxHealth - Maximum health
   */
  updateHealthUI(health, maxHealth) {
    const healthFill = document.getElementById('health-fill');
    const playerStats = document.getElementById('player-stats');
    
    console.log(`CRITICAL: Game.updateHealthUI called with health=${health}, maxHealth=${maxHealth}`);
    
    // DIRECT DOM MANIPULATION - forced update without any animation frames
    if (healthFill) {
      // Ensure health is valid
      health = Math.max(0, Math.min(maxHealth, health));
      const percentage = Math.max(0, Math.min(100, (health / maxHealth) * 100));
      
      // Force immediate update without transition
      healthFill.style.transition = 'none';
      healthFill.style.width = `${percentage}%`;
      healthFill.offsetHeight; // Force reflow
      
      // Change color based on health percentage
      if (percentage > 60) {
        healthFill.style.backgroundColor = '#2ecc71'; // Green for high health
      } else if (percentage > 30) {
        healthFill.style.backgroundColor = '#f39c12'; // Orange for medium health
      } else {
        healthFill.style.backgroundColor = '#e74c3c'; // Red for low health
      }
      
      // Re-enable transition after a small delay
      setTimeout(() => {
        healthFill.style.transition = 'width 0.3s ease-out, background-color 0.3s ease-out';
      }, 50);
      
      console.log(`CRITICAL: Game directly updated health bar to ${percentage}% width`);
    } else {
      // Try to recreate the health fill element if it's missing
      console.error('CRITICAL ERROR: Health fill element not found in Game.updateHealthUI!');
      const gameUI = document.getElementById('game-ui');
      const healthBar = document.querySelector('.health-bar');
      
      if (healthBar) {
        console.log('Recreating missing health fill element');
        const newHealthFill = document.createElement('div');
        newHealthFill.id = 'health-fill';
        newHealthFill.className = 'health-fill';
        
        // Set initial properties
        const percentage = Math.max(0, Math.min(100, (health / maxHealth) * 100));
        newHealthFill.style.width = `${percentage}%`;
        
        if (percentage > 60) {
          newHealthFill.style.backgroundColor = '#2ecc71';
        } else if (percentage > 30) {
          newHealthFill.style.backgroundColor = '#f39c12';
        } else {
          newHealthFill.style.backgroundColor = '#e74c3c';
        }
        
        healthBar.innerHTML = '';
        healthBar.appendChild(newHealthFill);
        console.log('Created new health fill element with width: ' + percentage + '%');
      }
    }
    
    // Update the health text
    if (playerStats) {
      playerStats.textContent = `Health: ${Math.round(health)}/${maxHealth}`;
      console.log(`CRITICAL: Game updated player stats text to "${playerStats.textContent}"`);
    } else {
      console.warn('Game: Player stats element not found!');
    }
    
    // Also update the new HUD orb for synchronization
    // Only update if we have a local player and this is for our player
    if (this.player) {
      eventBus.emit('player.healthChanged', {
        id: this.player.id, // Include player ID for filtering
        health: health,
        maxHealth: maxHealth
      });
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Stop the game
    this.stop();
    
    // Clean up systems
    entityManager.dispose();
    inputManager.dispose();
    grid.dispose();
    renderer.dispose();
    uiManager.dispose();
    
    // Remove combat event listeners
    eventBus.off('network.playerHealthChanged');
    eventBus.off('network.playerAttacked');
    
    // Remove player-specific health event listener
    if (this.player) {
      eventBus.off(`entity.${this.player.id}.healthChanged`);
    }
    
    // Remove UI event listeners
    const clerkClass = document.getElementById('clerk-class');
    const warriorClass = document.getElementById('warrior-class');
    const rangerClass = document.getElementById('ranger-class');
    const startButton = document.getElementById('start-game');
    
    if (clerkClass) {
      clerkClass.removeEventListener('click', () => this._handleClassSelection('CLERK'));
    }
    
    if (warriorClass) {
      warriorClass.removeEventListener('click', () => this._handleClassSelection('WARRIOR'));
    }
    
    if (rangerClass) {
      rangerClass.removeEventListener('click', () => this._handleClassSelection('RANGER'));
    }
    
    if (startButton) {
      startButton.removeEventListener('click', this._boundHandleStartGame);
    }
    
    this.isInitialized = false;
    this.isRunning = false;
    this.state = 'idle';
  }
}

// Create singleton instance
const game = new Game();

export default game;