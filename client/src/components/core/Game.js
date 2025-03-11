import eventBus from './EventBus.js';
import renderer from './Renderer.js';
import inputManager from '../controls/InputManager.js';
import webSocketManager from '../network/WebSocketManager.js';
import entityManager from '../entities/EntityManager.js';
import grid from '../world/Grid.js';
import uiManager from '../ui/UIManager.js';
import CHARACTER_CLASSES from '../../config/classes.js';
import tournamentMap from '../world/TournamentMap.js';

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
    
    // Track current map
    this.currentMap = null;
    
    // Initialize standard grid
    grid.init();
    this.currentMap = grid;
    
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
      // Process attacks that have been confirmed by the server or for backward compatibility
      const shouldProcessAttack = data.inRange !== false;
      
      if (shouldProcessAttack) {
        if (this.player && data.targetId === this.player.id) {
          console.log(`Game received attack on player: ${data.damage} damage (inRange: ${data.inRange})`);
          
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
            
            // Create a damage effect
            if (typeof this.player._playDamageEffect === 'function') {
              this.player._playDamageEffect();
            }
          }
        }
      } else {
        console.log('Received attack event with inRange=false - not applying damage');
      }
    });
    
    // Listen for missed attacks
    eventBus.on('network.playerAttackMissed', (data) => {
      // If we're the attacker, show feedback
      if (this.player && data.id === this.player.id) {
        console.log(`Game received attack missed notification: ${data.reason}`);
        this.showAttackMissedFeedback(data.reason, data.distance, data.maxRange);
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
    
    // Game mode selection
    const standardModeBtn = document.getElementById('standard-mode');
    const tournamentModeBtn = document.getElementById('tournament-mode');
    
    // Set default game mode
    this.gameMode = 'standard';
    
    // Set up class selection listeners
    if (clerkClass) {
      clerkClass.addEventListener('click', () => this._handleClassSelection('CLERK'));
    }
    
    if (warriorClass) {
      warriorClass.addEventListener('click', () => this._handleClassSelection('WARRIOR'));
    }
    
    if (rangerClass) {
      rangerClass.addEventListener('click', () => this._handleClassSelection('RANGER'));
    }
    
    // Set up start game button
    if (startButton) {
      startButton.addEventListener('click', () => this._handleStartGame());
    }
    
    // Set up game mode selection
    if (standardModeBtn) {
      standardModeBtn.addEventListener('click', () => {
        standardModeBtn.classList.add('selected');
        tournamentModeBtn.classList.remove('selected');
        this.gameMode = 'standard';
        console.log('Standard mode selected');
      });
    }
    
    if (tournamentModeBtn) {
      tournamentModeBtn.addEventListener('click', () => {
        tournamentModeBtn.classList.add('selected');
        standardModeBtn.classList.remove('selected');
        this.gameMode = 'tournament';
        console.log('Tournament mode selected');
      });
    }
    
    // Hide character selection initially
    this._hideCharacterSelection();
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
      console.warn('Please select a class first');
      return;
    }
    
    // Hide character selection
    this._hideCharacterSelection();
    
    // Load the appropriate map based on game mode
    this._loadMap(this.gameMode);
    
    // Start the game
    this.start(this.selectedClass);
    
    // Show game UI
    this._showGameUI();
    
    console.log(`Started game with ${this.selectedClass} class in ${this.gameMode} mode`);
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
   * Start the game with a selected class
   * @param {string} classType - Selected character class
   * @returns {Promise} - Resolves when game starts
   */
  async start(classType) {
    if (this.isRunning) {
      console.warn('Game is already running');
      return;
    }
    
    console.log(`Starting game with class: ${classType}`);
    
    // Set up initialization
    this.isRunning = true;
    
    // Show loading feedback
    const loadingElement = document.createElement('div');
    loadingElement.textContent = 'Connecting to server...';
    loadingElement.style.position = 'absolute';
    loadingElement.style.top = '50%';
    loadingElement.style.left = '50%';
    loadingElement.style.transform = 'translate(-50%, -50%)';
    loadingElement.style.color = 'white';
    loadingElement.style.fontSize = '24px';
    loadingElement.style.zIndex = '1000';
    loadingElement.setAttribute('id', 'loading-element');
    document.body.appendChild(loadingElement);
    
    if (!this.isInitialized) {
      console.error('Game not initialized. Call init() first.');
      return this;
    }
    
    try {
      // Connect to server with timeout
      console.log('Connecting to server...');
      await webSocketManager.connect();
      console.log('Connection successful');
      const getLoadingElement = document.getElementById('loading-element');
      if (getLoadingElement) {
        getLoadingElement.remove();
      }
      // Wait for player ID assignment
      if (!webSocketManager.playerId) {
        console.log('Waiting for player ID assignment...');
        await new Promise((resolve, reject) => {
          // Set a timeout for ID assignment
          const timeout = setTimeout(() => {
            eventBus.off('network.idAssigned');
            reject(new Error('Timeout waiting for player ID'));
          }, 5000);
          
          // Listen for ID assignment
          eventBus.once('network.idAssigned', (id) => {
            console.log(`Player ID assigned: ${id}`);
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      
      // Create player with selected class and store reference
      console.log(`Creating player with class: ${classType}`);
      this.player = entityManager.createPlayer(classType);
      
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
      console.log('Joining game with player data');
      webSocketManager.joinGame({
        position: this.player.position,
        class: classType,
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
      
      // Emit event
      eventBus.emit('game.started');
      
      // Explicitly show HUD
      uiManager.showHUD();
      
      // Remove the join failure handler
      eventBus.off('network.joinFailed', joinFailureHandler);
    } catch (error) {
      console.error('Failed to start game:', error);
      
      // Clean up any partial initialization
      if (this.player) {
        entityManager.removeEntity(this.player.id);
        this.player = null;
      }
      
      // Disconnect from server if connected
      if (webSocketManager.connected) {
        webSocketManager.disconnect();
      }
      
      // Update state
      this.state = 'characterSelection';
      this.isRunning = false;
      
      // Show error to user
      alert(`Failed to connect to server: ${error.message || 'Unknown error'}. Please try again.`);
      
      // Show character selection again
      this._showCharacterSelection();
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
   * Show visual feedback for a missed attack
   * @param {string} reason - Reason for miss (e.g., 'outOfRange')
   * @param {number} distance - Distance to target
   * @param {number} maxRange - Maximum attack range
   */
  showAttackMissedFeedback(reason, distance, maxRange) {
    console.log(`Attack missed: ${reason}, distance: ${distance?.toFixed(2) || 'unknown'}, max range: ${maxRange}`);
    
    // Create a missed attack message element
    let missElement = document.getElementById('miss-feedback');
    
    if (!missElement) {
      missElement = document.createElement('div');
      missElement.id = 'miss-feedback';
      missElement.style.position = 'absolute';
      missElement.style.top = '30%';
      missElement.style.left = '50%';
      missElement.style.transform = 'translate(-50%, -50%)';
      missElement.style.color = '#ff3300';
      missElement.style.fontWeight = 'bold';
      missElement.style.fontSize = '24px';
      missElement.style.fontFamily = 'Arial, sans-serif';
      missElement.style.textShadow = '1px 1px 2px black';
      missElement.style.opacity = '0';
      missElement.style.transition = 'opacity 0.2s ease-in-out';
      missElement.style.zIndex = '1000';
      document.body.appendChild(missElement);
    }
    
    // Set message content based on reason
    let message = 'Attack Missed!';
    
    if (reason === 'outOfRange') {
      message = `Out of Range (${distance.toFixed(1)} > ${maxRange})`;
    }
    
    // Display message
    missElement.textContent = message;
    missElement.style.opacity = '1';
    
    // Play sound effect if available
    if (window.playSound) {
      window.playSound('miss');
    }
    
    // Add miss indicator
    this._createMissIndicator();
    
    // Fade out after a moment
    setTimeout(() => {
      missElement.style.opacity = '0';
    }, 1500);
  }

  /**
   * Create a temporary visual miss indicator on the screen
   * @private
   */
  _createMissIndicator() {
    // Create element
    const indicator = document.createElement('div');
    indicator.style.position = 'absolute';
    indicator.style.top = '50%';
    indicator.style.left = '50%';
    indicator.style.width = '60px';
    indicator.style.height = '60px';
    indicator.style.borderRadius = '50%';
    indicator.style.border = '3px solid #ff3300';
    indicator.style.transform = 'translate(-50%, -50%)';
    indicator.style.opacity = '0.8';
    indicator.style.zIndex = '900';
    indicator.style.pointerEvents = 'none'; // Don't capture mouse events
    document.body.appendChild(indicator);
    
    // Animate
    let size = 1.0;
    const animate = () => {
      size += 0.1;
      indicator.style.transform = `translate(-50%, -50%) scale(${size})`;
      indicator.style.opacity = Math.max(0, 0.8 - (size - 1) * 0.8);
      
      if (size < 2.0) {
        requestAnimationFrame(animate);
      } else {
        // Remove when animation complete
        document.body.removeChild(indicator);
      }
    };
    
    requestAnimationFrame(animate);
  }

  /**
   * Clean up resources
   */
  dispose() {
    console.log('Disposing game resources...');
    
    // Stop game loop
    this.stop();
    
    // Clean up systems
    entityManager.dispose();
    inputManager.dispose();
    
    // Clean up active map
    if (this.currentMap === grid) {
      grid.dispose();
    } else if (this.currentMap === tournamentMap) {
      tournamentMap.dispose();
    }
    
    renderer.dispose();
    uiManager.dispose();
    
    // Remove combat event listeners
    eventBus.off('network.playerHealthChanged');
    eventBus.off('network.playerAttacked');
    eventBus.off('network.playerAttackMissed');

    // Remove player-specific health event listener
    if (this.player) {
      eventBus.off(`entity.${this.player.id}.healthChanged`);
    }

    // Clean up any missed attack UI elements
    const missElement = document.getElementById('miss-feedback');
    if (missElement && missElement.parentNode) {
      missElement.parentNode.removeChild(missElement);
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

  /**
   * Get an entity by ID
   * @param {string} id - Entity ID
   * @returns {Entity|null} - Entity or null if not found
   */
  getEntityById(id) {
    if (!id) return null;
    return this.entityManager.getEntity(id);
  }
  
  /**
   * Get all entities of a specific type
   * @param {string} type - Entity type
   * @returns {Array} - Array of entities
   */
  getEntitiesByType(type) {
    if (!type) return [];
    return this.entityManager.getEntitiesByType(type);
  }

  /**
   * Load the appropriate map based on game mode
   * @param {string} mode - Game mode ('standard' or 'tournament')
   * @private
   */
  _loadMap(mode = 'standard') {
    // Clean up existing map if any
    if (this.currentMap) {
      if (this.currentMap === grid) {
        grid.dispose();
      } else if (this.currentMap === tournamentMap) {
        tournamentMap.dispose();
      }
    }
    
    // Load the appropriate map
    if (mode === 'tournament') {
      console.log('Loading tournament map...');
      tournamentMap.init();
      this.currentMap = tournamentMap;
    } else {
      console.log('Loading standard map...');
      grid.init();
      this.currentMap = grid;
    }
  }

  /**
   * Start tournament mode
   * @returns {Promise} Promise that resolves when tournament starts
   */
  async startTournamentMode() {
    if (this.isRunning) {
      console.warn('Cannot start tournament mode while game is running');
      return;
    }
    
    console.log('Starting tournament mode...');
    
    // Set game mode
    this.gameMode = 'tournament';
    
    // Show character selection
    this._showCharacterSelection();
    
    // When character is selected and game starts, load tournament map
    const originalStartGame = this._handleStartGame;
    this._handleStartGame = () => {
      // Restore original handler
      this._handleStartGame = originalStartGame;
      
      // Hide character selection
      this._hideCharacterSelection();
      
      // Load tournament map
      this._loadMap('tournament');
      
      // Continue with original start game logic
      originalStartGame.call(this);
    };
    
    return new Promise((resolve) => {
      eventBus.once('map.ready', (data) => {
        if (data.type === 'tournament') {
          console.log('Tournament map ready');
          resolve();
        }
      });
    });
  }
}

// Create singleton instance
const game = new Game();

export default game;