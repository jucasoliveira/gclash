import eventBus from './EventBus.js';
import renderer from './Renderer.js';
import inputManager from '../controls/InputManager.js';
import networkManager from '../network/NetworkManager.js';
import entityManager from '../entities/EntityManager.js';
import grid from '../world/Grid.js';
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
    networkManager.configure();
    
    // Set up UI event listeners
    this._setupUIEvents();
    
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
    const gameUI = document.getElementById('game-ui');
    if (gameUI) {
      gameUI.classList.add('visible');
      
      // Update UI with player stats
      const playerClass = document.getElementById('player-class');
      const playerStats = document.getElementById('player-stats');
      const playerColor = document.getElementById('player-color');
      const healthFill = document.getElementById('health-fill');
      
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
      await networkManager.connect();
      
      // Create player with selected class
      entityManager.createPlayer(this.selectedClass);
      
      // Start rendering
      renderer.startRendering();
      
      // Update state
      this.state = 'playing';
      this.isRunning = true;
      
      // Emit event
      eventBus.emit('game.started');
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
    networkManager.disconnect();
    
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
    
    if (healthFill) {
      const percentage = Math.max(0, Math.min(100, (health / maxHealth) * 100));
      healthFill.style.width = `${percentage}%`;
    }
    
    if (playerStats) {
      playerStats.textContent = `Health: ${health}`;
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
    
    // Remove event listeners
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