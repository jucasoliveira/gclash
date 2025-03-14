import eventBus from './EventBus.js';
import renderer from './Renderer.js';
import inputManager from '../controls/InputManager.js';
import webSocketManager from '../network/WebSocketManager.js';
import entityManager from '../entities/EntityManager.js';
import grid from '../world/Grid.js';
import uiManager from '../ui/UIManager.js';
import CHARACTER_CLASSES from '../../config/classes.js';
import tournamentMap from '../world/TournamentMap.js';
import battleRoyaleMap from '../world/BattleRoyaleMap.js';
import BattleRoyaleNotification from '../ui/BattleRoyaleNotification.js';

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
    
    // Initialize UI components
    this.battleRoyaleNotification = null;
  }

  /**
   * Initialize the game
   * @param {HTMLCanvasElement} canvas - Canvas element for rendering
   * @returns {Game} - This instance for chaining
   */
  init(canvas) {
    console.log('[GAME] Initializing game');
    
    // If already initialized, just return
    if (this.isInitialized) return this;
    
    try {
      // Initialize Rapier physics engine
      this._initPhysics();
      
      // Safe initialization of renderer
      if (this.renderer) {
        this.renderer.init(canvas);
        
        // Make renderer and camera globally accessible
        window.renderer = this.renderer;
        window.currentCamera = this.renderer && this.renderer.camera;
        
        // Make key functions globally accessible
        window.updateCameraPosition = (position) => {
          if (this.renderer) {
            this.renderer.updateCameraPosition(position);
          }
        };
      } else {
        console.error('[GAME] Renderer not available during initialization');
      }
      
      // Initialize user interface with null check
      if (this.uiManager && typeof this.uiManager.init === 'function') {
        this.uiManager.init();
      } else {
        console.error('[GAME] UI Manager not available or missing init method');
      }
      
      // Initialize websocket connection with null check
      if (this.networkManager && typeof this.networkManager.init === 'function') {
        this.networkManager.init();
      } else {
        console.error('[GAME] Network Manager not available or missing init method');
      }
      
      // Create a EntityManager for handling game entities
      if (!entityManager) {
        console.error('[GAME] Entity Manager not available');
      } else {
        this.entityManager = entityManager;
        if (this.entityManager && typeof this.entityManager.init === 'function') {
          this.entityManager.init();
        }
        window.entityManager = this.entityManager; // Make globally accessible
      }
      
      console.log('Initializing Guild Clash...');
      
      // Initialize input manager if available
      if (inputManager && typeof inputManager.init === 'function') {
        inputManager.init();
      } else {
        console.warn('[GAME] Input Manager not available or missing init method');
      }
      
      // Track current map
      this.currentMap = null;
      
      // Initialize standard grid if available
      if (grid && typeof grid.init === 'function') {
        grid.init();
        this.currentMap = grid;
      } else {
        console.warn('[GAME] Grid not available or missing init method');
      }
      
      // Configure websocket if available
      if (webSocketManager && typeof webSocketManager.configure === 'function') {
        webSocketManager.configure();
      } else {
        console.warn('[GAME] WebSocket Manager not available or missing configure method');
      }
      
      // Set up UI event listeners
      this._setupUIEvents();
      
      // Set up tournament events
      this._setupTournamentEvents();
      
      // Set up event handlers for tournament events
      this._setupTournamentEventHandlers();
      
      // Set up battle royale event handlers
      this._setupBattleRoyaleEventHandlers();
      
      // Set up health pickup handler
      this._setupHealthPickupHandler();
      
      // Set up event listeners with null checks
      this._setupEventListeners();
      
      this.isInitialized = true;
      console.log('[GAME] Game initialized successfully');
    } catch (error) {
      console.error('[GAME] Error during initialization:', error);
    }
    
    return this;
  }

  /**
   * Initialize the Rapier physics engine and create the physics world
   * @private
   */
  async _initPhysics() {
    try {
      console.log('[GAME] Initializing Rapier physics engine...');
      
      // Import Rapier
      const RAPIER = await import('@dimforge/rapier3d');
      
      // Make RAPIER available globally
      window.RAPIER = RAPIER;
      
      // Create physics world with gravity
      const gravity = { x: 0.0, y: -9.81, z: 0.0 };
      const world = new RAPIER.World(gravity);
      
      // Make physics world available globally
      window.physicsWorld = world;
      
      // Store reference locally
      this.physicsWorld = world;
      
      // Set up physics stepping in the game loop
      this._setupPhysicsLoop();
      
      // Expose a helper method to toggle all physics debug visualizations
      window.toggleAllPhysicsDebug = (visible = true) => {
        console.log(`[GAME] Setting all physics debug visualizations to ${visible ? 'visible' : 'hidden'}`);
        
        let successCount = 0;
        
        // Toggle terrain physics visualization
        if (typeof window.togglePhysicsDebug === 'function') {
          try {
            window.togglePhysicsDebug(visible);
            successCount++;
          } catch (error) {
            console.error('[GAME] Error toggling terrain physics visualization:', error);
          }
        } else {
          console.warn('[GAME] togglePhysicsDebug function not available');
          
          // Try to directly find and toggle physics objects in the scene
          if (window.renderer && window.renderer.scene) {
            ['physicsHexGroup', 'physicsBoundaryMesh', 'physicsWallMesh'].forEach(objName => {
              const obj = window.renderer.scene.getObjectByName(objName);
              if (obj) {
                obj.visible = visible;
                console.log(`[GAME] Found ${objName} and set visibility to ${visible}`);
                successCount++;
              }
            });
          }
        }
        
        // Toggle player physics visualization
        if (typeof window.togglePlayerPhysicsDebug === 'function') {
          try {
            window.togglePlayerPhysicsDebug(visible);
            successCount++;
          } catch (error) {
            console.error('[GAME] Error toggling player physics visualization:', error);
          }
        } else {
          console.warn('[GAME] togglePlayerPhysicsDebug function not available');
          
          // Attempt to find character physics debug object directly
          if (window.renderer && window.renderer.scene) {
            const charDebug = window.renderer.scene.getObjectByName('characterPhysicsDebug');
            if (charDebug) {
              charDebug.visible = visible;
              charDebug.renderOrder = 9999; // Ensure it renders above other objects
              console.log('[GAME] Found character physics debug object, set visibility to', visible);
              successCount++;
            }
          }
        }
        
        // As a last resort, traverse the entire scene looking for debug objects
        if (successCount === 0 && window.renderer && window.renderer.scene) {
          console.log('[GAME] No toggle functions worked, traversing scene to find physics debug objects...');
          
          window.renderer.scene.traverse(object => {
            const name = object.name || '';
            if (name.includes('physics') || name.includes('Physics')) {
              object.visible = visible;
              if (name.includes('character') || name.includes('Character')) {
                object.renderOrder = 9999; // Ensure character physics renders on top
              }
              console.log(`[GAME] Found ${name} and set visibility to ${visible}`);
              successCount++;
            }
          });
        }
        
        if (successCount > 0) {
          console.log(`[GAME] Successfully toggled ${successCount} physics debug visualizations`);
        } else {
          console.warn('[GAME] Failed to toggle any physics debug visualizations. Make sure the player and map are loaded first.');
        }
        
        // Force render to update visibility changes
        if (window.renderer && typeof window.renderer.render === 'function') {
          window.renderer.render();
        }
        
        return `Physics debug visualization set to ${visible ? 'visible' : 'hidden'} (${successCount} objects affected)`;
      };
      
      console.log('[GAME] Physics debug helper exposed as window.toggleAllPhysicsDebug(true/false)');
      console.log('[GAME] Rapier physics engine initialized successfully');
      
      // Emit event to notify other components that physics is initialized
      eventBus.emit('physics.initialized');
    } catch (error) {
      console.error('[GAME] Error initializing Rapier physics engine:', error);
    }
  }

  /**
   * Set up the physics world to update in the render loop
   * @private
   */
  _setupPhysicsLoop() {
    if (!this.physicsWorld) {
      console.error('[GAME] Cannot set up physics loop - physics world not initialized');
      return;
    }
    
    // Create a physics update method
    const updatePhysics = (data) => {
      if (!this.physicsWorld) return;
      
      const { deltaTime } = data;
      // Use fixed timestep for physics (1/60 seconds)
      // For very small or large deltaTime, use a reasonable default
      const fixedTimestep = Math.min(Math.max(deltaTime, 1/120), 1/30);
      
      // Step the physics world forward
      this.physicsWorld.step();
      
      // Log physics steps at a low frequency to avoid console spam
      if (Math.random() < 0.01) { // Log roughly once every 100 frames
        console.log(`[GAME] Physics world stepped forward (deltaTime: ${fixedTimestep.toFixed(4)})`);
      }
    };
    
    // Subscribe to the render loop's update event
    eventBus.on('renderer.beforeRender', updatePhysics);
    
    console.log('[GAME] Physics update loop initialized');
  }

  /**
   * Set up additional event listeners with null checks
   * @private
   */
  _setupEventListeners() {
    // Listen for player health changes
    if (eventBus) {
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
    } else {
      console.error('[GAME] Event bus not available during initialization');
    }
  }

  /**
   * Initialize UI components
   * @private
   */
  _initializeUIComponents() {
    // Initialize battle royale notification
    this.battleRoyaleNotification = new BattleRoyaleNotification();
    
    // ... any other UI component initialization ...
  }

  /**
   * Set up UI event listeners
   * @private
   */
  _setupUIEvents() {
    console.log('Setting up UI event listeners...');
    
    // Character selection
    const clerkClass = document.getElementById('clerk-class');
    const warriorClass = document.getElementById('warrior-class');
    const rangerClass = document.getElementById('ranger-class');
    const startButton = document.getElementById('start-game');
    
    // Log whether we found the elements
    console.log('Found UI elements:', {
      clerkClass: !!clerkClass,
      warriorClass: !!warriorClass,
      rangerClass: !!rangerClass,
      startButton: !!startButton
    });
    
    // Game mode selection
    const standardModeBtn = document.getElementById('standard-mode');
    const tournamentModeBtn = document.getElementById('tournament-mode');
    const battleRoyaleModeBtn = document.getElementById('battle-royale-mode');
    
    // Set default game mode
    this.gameMode = 'standard';
    
    // Set up class selection listeners
    if (clerkClass) {
      clerkClass.addEventListener('click', () => {
        console.log('Clerk class clicked');
        this._handleClassSelection('CLERK');
      });
    }
    
    if (warriorClass) {
      warriorClass.addEventListener('click', () => {
        console.log('Warrior class clicked');
        this._handleClassSelection('WARRIOR');
      });
    }
    
    if (rangerClass) {
      rangerClass.addEventListener('click', () => {
        console.log('Ranger class clicked');
        this._handleClassSelection('RANGER');
      });
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
        battleRoyaleModeBtn.classList.remove('selected');
        this.gameMode = 'standard';
        console.log('Standard mode selected');
        
        // Hide tournament options
        this._hideTournamentOptions();
      });
    }
    
    if (tournamentModeBtn) {
      tournamentModeBtn.addEventListener('click', () => {
        tournamentModeBtn.classList.add('selected');
        standardModeBtn.classList.remove('selected');
        battleRoyaleModeBtn.classList.remove('selected');
        this.gameMode = 'tournament';
        console.log('Tournament mode selected');
        
        // Show tournament options
        this._showTournamentOptions();
      });
    }
    
    if (battleRoyaleModeBtn) {
      battleRoyaleModeBtn.addEventListener('click', () => {
        battleRoyaleModeBtn.classList.add('selected');
        standardModeBtn.classList.remove('selected');
        tournamentModeBtn.classList.remove('selected');
        this.gameMode = 'battleRoyale';
        console.log('Battle Royale mode selected');
        
        // Hide tournament options
        this._hideTournamentOptions();
      });
    }
    
    // Set up tournament UI events
    this._setupTournamentEvents();
    
    // Hide character selection initially
    this._hideCharacterSelection();
  }

  /**
   * Handle character class selection
   * @param {string} classType - Selected class type
   * @private
   */
  _handleClassSelection(classType) {
    console.log(`_handleClassSelection called with class: ${classType}`);
    
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
    
    console.log('Starting game with selected class:', this.selectedClass);
    
    // If we're in tournament mode and have joined a tournament, make sure player data is set correctly
    if (this.gameMode === 'tournament' && this.currentTournamentId) {
      console.log('Starting game in tournament mode with tournament ID:', this.currentTournamentId);
      
      // Make sure the network manager has the correct player data
      if (this.networkManager) {
        // Update player data with selected class
        const playerData = {
          username: window.playerUsername || `Player_${Date.now()}`,
          characterClass: this.selectedClass,
          tournamentId: this.currentTournamentId
        };
        
        // Store player data in network manager
        this.networkManager.playerData = playerData;
      }
    }
    
    // Start the game with selected class
    this.start(this.selectedClass);
  }

  /**
   * Show character selection UI
   * @private
   */
  _showCharacterSelection() {
    const characterSelection = document.getElementById('character-selection');
    if (characterSelection) {
      characterSelection.style.display = 'flex';
      
      // Connect to the WebSocket server when character selection is shown
      if (webSocketManager && !webSocketManager.connected) {
        console.log('Connecting to WebSocket server from character selection...');
        
        // Show connection status in the tournament status area
        const tournamentStatus = document.getElementById('tournament-status');
        if (tournamentStatus) {
          tournamentStatus.innerHTML = 'Connecting to server...';
        }
        
        webSocketManager.connect()
          .then(() => {
            console.log('Connected to WebSocket server from character selection');
            
            // Update tournament status
            if (tournamentStatus) {
              tournamentStatus.innerHTML = 'Connected to server. You can now create or join tournaments.';
            }
            
            // Enable tournament creation button
            const createTournamentBtn = document.getElementById('create-tournament-btn');
            if (createTournamentBtn) {
              createTournamentBtn.disabled = false;
            }
          })
          .catch(error => {
            console.error('Failed to connect to WebSocket server:', error);
            
            // Update tournament status
            if (tournamentStatus) {
              tournamentStatus.innerHTML = 'Failed to connect to server. Tournament features may not work.';
            }
          });
      }
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
   * @param {string} classType - Selected character class
   */
  async start(classType) {
    if (!classType && !this.selectedClass) {
      console.error('[GAME] No class selected');
      return;
    }
    
    // Use provided class type or fallback to selected class
    const selectedClass = classType || this.selectedClass;
    
    console.log(`[GAME] Starting game with class: ${selectedClass}, mode: ${this.gameMode}`);
    
    // Hide character selection UI
    this._hideCharacterSelection();
    
    // Show game UI
    this._showGameUI();
    
    // Ensure game mode is set
    if (!this.gameMode) {
      console.warn('[GAME] Game mode not set, defaulting to standard');
      this.gameMode = 'standard';
    }
    
    // Log the game mode for debugging
    console.log(`[GAME] Game mode: ${this.gameMode}`);
    
    // Load appropriate map based on game mode
    try {
      console.log(`[GAME] Loading map for mode: ${this.gameMode}`);
      await this._loadMap(this.gameMode);
      console.log(`[GAME] Map loaded successfully for mode: ${this.gameMode}`);
    } catch (error) {
      console.error(`[GAME] Error loading map: ${error.message}`);
    }
    
    // Set state to playing
    this.state = 'playing';
    
    // Generate a unique player ID
    const playerId = `player_${Date.now()}`;
    
    // Get class stats
    const classStats = CHARACTER_CLASSES[selectedClass];
    if (!classStats) {
      console.error(`[GAME] Invalid class type: ${selectedClass}`);
      return;
    }
    
    // Create player entity - use createPlayer instead of createEntity
    console.log('[GAME] Creating player entity...');
    this.player = entityManager.createPlayer(selectedClass, playerId);
    
    // Enable camera follow mode (Diablo-style)
    this.renderer.setFollowTarget(this.player, true);
    console.log('[GAME] Camera follow mode enabled - Diablo-style');
    
    // Start game systems
    this.isRunning = true;
    renderer.startRendering();
    
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
    document.body.appendChild(loadingElement);
    
    // Connect to server
    try {
      await webSocketManager.connect();
      console.log('[GAME] Connected to server');
      
      // Join game with player data
      webSocketManager.joinGame({
        position: this.player.position,
        class: selectedClass,
        stats: classStats,
        gameMode: this.gameMode
      });
      
      // Remove loading element
      document.body.removeChild(loadingElement);
      
      // Set up event listeners
      this._setupTournamentEventHandlers();
      
      // Set up health pickup handler
      this._setupHealthPickupHandler();
      
      // Set up tournament events if in tournament mode
      if (this.gameMode === 'tournament') {
        this._setupTournamentEvents();
      }
      
      // Set up battle royale events if in battle royale mode
      if (this.gameMode === 'battleRoyale') {
        this._setupBattleRoyaleEventHandlers();
      }
      
      console.log('[GAME] Game started successfully');
      
      // Make game globally available for debugging
      window.game = this;
      
      // Return the player entity
      return this.player;
    } catch (error) {
      console.error('[GAME] Error connecting to server:', error);
      
      // Show error message
      loadingElement.textContent = 'Error connecting to server. Please try again.';
      loadingElement.style.color = 'red';
      
      // Remove loading element after a delay
      setTimeout(() => {
        if (document.body.contains(loadingElement)) {
          document.body.removeChild(loadingElement);
        }
      }, 3000);
      
      return null;
    }
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
    
    // Clean up physics world
    if (this.physicsWorld) {
      // Destroy all colliders and rigid bodies
      this.physicsWorld = null;
      window.physicsWorld = null;
    }
    
    // Clean up RAPIER reference
    window.RAPIER = null;
    
    // Clean up systems
    entityManager.dispose();
    inputManager.dispose();
    
    // Clean up active map
    if (this.currentMap === grid) {
      grid.dispose();
    } else if (this.currentMap === tournamentMap) {
      tournamentMap.dispose();
    } else if (this.currentMap === battleRoyaleMap) {
      battleRoyaleMap.dispose();
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
   * Load the appropriate map for the given game mode
   * @param {string} mode - Game mode (standard, tournament, battleRoyale)
   * @returns {Promise} - Promise that resolves when map is loaded
   * @private
   */
  _loadMap(mode = 'standard') {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[MAP] Loading map for mode: ${mode}`);
        
        // Store the game mode
        this.gameMode = mode;
        
        // Clean up existing map if any
        if (this.currentMap) {
          console.log(`[MAP] Disposing of current map: ${this.currentMap === grid ? 'grid' : 
                                                        this.currentMap === tournamentMap ? 'tournament' : 
                                                        this.currentMap === battleRoyaleMap ? 'battle royale' : 'unknown'}`);
          try {
            if (this.currentMap === grid) {
              grid.dispose();
            } else if (this.currentMap === tournamentMap) {
              tournamentMap.dispose();
            } else if (this.currentMap === battleRoyaleMap) {
              battleRoyaleMap.dispose();
            }
          } catch (error) {
            console.error(`[MAP] Error disposing current map: ${error.message}`);
          }
        }
        
        // Load the appropriate map
        if (mode === 'tournament') {
          console.log('[MAP] Initializing tournament map...');
          
          // Set up event listener for map ready
          const onMapReady = () => {
            console.log('[MAP] Tournament map ready event received');
            eventBus.off('tournamentMap.ready', onMapReady);
            this.currentMap = tournamentMap;
            console.log('[MAP] Tournament map loaded successfully');
            
            // Emit map loaded event
            eventBus.emit('map.loaded', { mode: mode, map: this.currentMap });
            resolve();
          };
          
          // Listen for map ready event
          eventBus.once('tournamentMap.ready', onMapReady);
          
          // Initialize tournament map
          tournamentMap.init();
          
          // Set a timeout in case the ready event doesn't fire
          setTimeout(() => {
            if (this.currentMap !== tournamentMap) {
              console.warn('[MAP] Tournament map ready event not received, resolving anyway');
              eventBus.off('tournamentMap.ready', onMapReady);
              this.currentMap = tournamentMap;
              
              // Emit map loaded event
              eventBus.emit('map.loaded', { mode: mode, map: this.currentMap });
              resolve();
            }
          }, 2000);
        } else if (mode === 'battleRoyale') {
          console.log('[MAP] Initializing battle royale map...');
          
          // Set up event listener for map ready
          const onMapReady = () => {
            console.log('[MAP] Battle royale map ready event received');
            eventBus.off('battleRoyaleMap.ready', onMapReady);
            this.currentMap = battleRoyaleMap;
            console.log('[MAP] Battle royale map loaded successfully');
            
            // Emit map loaded event
            eventBus.emit('map.loaded', { mode: mode, map: this.currentMap });
            resolve();
          };
          
          // Listen for map ready event
          eventBus.once('battleRoyaleMap.ready', onMapReady);
          
          // Initialize battle royale map
          battleRoyaleMap.init();
          
          // Set a timeout in case the ready event doesn't fire
          setTimeout(() => {
            if (this.currentMap !== battleRoyaleMap) {
              console.warn('[MAP] Battle royale map ready event not received, resolving anyway');
              eventBus.off('battleRoyaleMap.ready', onMapReady);
              this.currentMap = battleRoyaleMap;
              
              // Emit map loaded event
              eventBus.emit('map.loaded', { mode: mode, map: this.currentMap });
              resolve();
            }
          }, 2000);
        } else {
          console.log('[MAP] Initializing standard grid map...');
          grid.init();
          this.currentMap = grid;
          console.log('[MAP] Standard grid map loaded successfully');
          
          // Emit map loaded event
          eventBus.emit('map.loaded', { mode: mode, map: this.currentMap });
          resolve();
        }
      } catch (error) {
        console.error(`[MAP] Error loading map for mode ${mode}: ${error.message}`);
        reject(error);
      }
    });
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

  /**
   * Start battle royale mode
   * @returns {Promise} Promise that resolves when battle royale starts
   */
  async startBattleRoyaleMode() {
    if (this.isRunning) {
      console.warn('Cannot start battle royale mode while game is running');
      return;
    }
    
    console.log('Starting battle royale mode...');
    
    // Set game mode
    this.gameMode = 'battleRoyale';
    
    // Show character selection
    this.state = 'characterSelection';
    this._showCharacterSelection();
  }

  // Add player health pickup handler
  _setupHealthPickupHandler() {
    eventBus.on('player.healthPickup', (data) => {
      if (this.player && this.player.health !== undefined) {
        // Calculate new health (don't exceed max)
        const newHealth = Math.min(
          this.player.stats.health, 
          this.player.health + data.healAmount
        );
        
        // Update player health
        this.player.health = newHealth;
        
        // Update UI
        this.updateHealthUI(newHealth, this.player.stats.health);
        
        // Play heal effect
        this._playHealEffect();
        
        console.log(`Player healed for ${data.healAmount}. New health: ${newHealth}/${this.player.stats.health}`);
      }
    });
  }

  /**
   * Play heal effect
   * @private
   */
  _playHealEffect() {
    // Create a green flash effect
    const flashElement = document.createElement('div');
    flashElement.style.position = 'absolute';
    flashElement.style.top = '0';
    flashElement.style.left = '0';
    flashElement.style.width = '100%';
    flashElement.style.height = '100%';
    flashElement.style.backgroundColor = 'rgba(46, 204, 113, 0.3)';
    flashElement.style.pointerEvents = 'none';
    flashElement.style.zIndex = '1000';
    flashElement.style.transition = 'opacity 0.5s ease-out';
    
    document.body.appendChild(flashElement);
    
    // Fade out and remove
    setTimeout(() => {
      flashElement.style.opacity = '0';
      setTimeout(() => {
        flashElement.remove();
      }, 500);
    }, 100);
    
    // Play heal sound (if we had audio)
    // audioManager.play('heal');
  }

  /**
   * Set up tournament-related event listeners
   * @private
   */
  _setupTournamentEvents() {
    console.log('Setting up tournament events');
    
    // Get UI elements
    const tournamentModeBtn = document.getElementById('tournament-mode');
    const standardModeBtn = document.getElementById('standard-mode');
    const battleRoyaleModeBtn = document.getElementById('battle-royale-mode');
    const tournamentOptions = document.getElementById('tournament-options');
    const createTournamentBtn = document.getElementById('create-tournament-btn');
    const tournamentNameInput = document.getElementById('tournament-name');
    
    // Set up mode selection
    if (tournamentModeBtn) {
      tournamentModeBtn.addEventListener('click', () => {
        console.log('Tournament mode selected');
        
        // Update button states
        tournamentModeBtn.classList.add('selected');
        if (standardModeBtn) standardModeBtn.classList.remove('selected');
        if (battleRoyaleModeBtn) battleRoyaleModeBtn.classList.remove('selected');
        
        // Show tournament options
        this._showTournamentOptions();
        
        // Set game mode
        this.gameMode = 'tournament';
      });
    }
    
    // Set up tournament creation
    if (createTournamentBtn && tournamentNameInput) {
      createTournamentBtn.addEventListener('click', () => {
        const tournamentName = tournamentNameInput.value.trim();
        
        if (!tournamentName) {
          this._updateTournamentStatus('Please enter a tournament name');
          return;
        }
        
        this._createTournament(tournamentName);
        
        // Clear input field after creating tournament
        tournamentNameInput.value = '';
      });
    }
    
    // Listen for network connection events
    eventBus.on('network.connected', () => {
      console.log('Network connected, enabling tournament creation');
      
      // Enable the create tournament button when connection is established
      if (createTournamentBtn) {
        createTournamentBtn.disabled = false;
        createTournamentBtn.textContent = 'Create';
      }
      
      // Show connected status in the tournament status area
      const tournamentStatus = document.getElementById('tournament-status');
      if (tournamentStatus) {
        tournamentStatus.innerHTML = 'Connected to server. You can now create or join tournaments.';
      }
      
      // Request active tournaments list
      if (this.networkManager) {
        // Register handler for active tournaments
        this.networkManager.registerMessageHandler('activeTournaments', (data) => {
          console.log('Active tournaments received:', data);
          eventBus.emit('tournament.list', data);
        });
      }
    });
    
    // Register WebSocket message handlers
    if (this.networkManager) {
      // Tournament created handler
      this.networkManager.registerMessageHandler('tournamentCreated', (data) => {
        console.log('Tournament created message received:', data);
        eventBus.emit('tournament.created', data);
      });
      
      // Tournament joined handler
      this.networkManager.registerMessageHandler('tournamentJoined', (data) => {
        console.log('Tournament joined message received:', data);
        eventBus.emit('tournament.joined', data);
      });
      
      // New tournament handler
      this.networkManager.registerMessageHandler('newTournament', (data) => {
        console.log('New tournament message received:', data);
        eventBus.emit('tournament.new', data);
      });
      
      // Tournament updated handler
      this.networkManager.registerMessageHandler('tournamentUpdated', (data) => {
        console.log('Tournament updated message received:', data);
        eventBus.emit('tournament.playerCount', data);
      });
    }
  }
  
  /**
   * Show tournament options UI
   * @private
   */
  _showTournamentOptions() {
    const tournamentOptions = document.getElementById('tournament-options');
    if (tournamentOptions) {
      tournamentOptions.style.display = 'block';
      
      // Check if already connected and enable the create tournament button
      const createTournamentBtn = document.getElementById('create-tournament-btn');
      if (createTournamentBtn) {
        if (webSocketManager && webSocketManager.connected) {
          createTournamentBtn.disabled = false;
          
          // Update tournament status
          const tournamentStatus = document.getElementById('tournament-status');
          if (tournamentStatus) {
            tournamentStatus.innerHTML = 'Connected to server. You can now create or join tournaments.';
          }
        } else {
          createTournamentBtn.disabled = true;
          
          // Update tournament status
          const tournamentStatus = document.getElementById('tournament-status');
          if (tournamentStatus) {
            tournamentStatus.innerHTML = 'Connecting to server...';
          }
        }
      }
    }
  }
  
  /**
   * Hide tournament options UI
   * @private
   */
  _hideTournamentOptions() {
    const tournamentOptions = document.getElementById('tournament-options');
    if (tournamentOptions) {
      tournamentOptions.style.display = 'none';
    }
  }
  
  /**
   * Create a new tournament
   * @param {string} tournamentName - The name of the tournament
   * @private
   */
  _createTournament(tournamentName) {
    console.log('Creating tournament:', tournamentName);
    
    // Make sure we have a network manager
    if (!this.networkManager) {
      console.error('Cannot create tournament: Network manager not initialized');
      this._updateTournamentStatus('Error: Cannot connect to server. Please refresh and try again.');
      return;
    }
    
    // Make sure we have a character class selected
    if (!this.selectedClass) {
      console.warn('No character class selected. Highlighting character selection area...');
      
      // Update tournament status
      this._updateTournamentStatus('Please select a character class first!');
      
      // Highlight the character selection area
      const characterClasses = document.querySelector('.classes');
      if (characterClasses) {
        characterClasses.style.border = '2px solid #f1c40f';
        characterClasses.style.boxShadow = '0 0 10px rgba(241, 196, 15, 0.7)';
        
        // Reset highlight after a few seconds
        setTimeout(() => {
          characterClasses.style.border = '';
          characterClasses.style.boxShadow = '';
        }, 3000);
      }
      
      return;
    }
    
    // Disable the create button while we're creating the tournament
    const createTournamentBtn = document.getElementById('create-tournament-btn');
    if (createTournamentBtn) {
      createTournamentBtn.disabled = true;
      createTournamentBtn.textContent = 'Creating...';
    }
    
    // Update status
    this._updateTournamentStatus('Creating tournament...');
    
    // Create tournament data
    const tournamentData = {
      name: tournamentName,
      tier: 'ALL' // Default tier
    };
    
    // Register a one-time handler for tournament created event
    const tournamentCreatedHandler = (data) => {
      console.log('Tournament created response received:', data);
      
      // Get tournament data from the response
      const tournamentData = data.tournament || data;
      
      // Emit tournament.created event for our UI to handle
      eventBus.emit('tournament.created', {
        tournament: tournamentData
      });
      
      // Remove this one-time handler
      this.networkManager.unregisterMessageHandler('tournamentCreated', tournamentCreatedHandler);
    };
    
    // Register handler for tournament created response
    this.networkManager.registerMessageHandler('tournamentCreated', tournamentCreatedHandler);
    
    // Send tournament creation request
    const success = this.networkManager.createTournament(tournamentData);
    
    if (!success) {
      console.error('Failed to send tournament creation request');
      this._updateTournamentStatus('Error creating tournament. Please try again.');
      
      // Re-enable the create button
      if (createTournamentBtn) {
        createTournamentBtn.disabled = false;
        createTournamentBtn.textContent = 'Create';
      }
    }
  }
  
  /**
   * Join an existing tournament
   * @param {string} tournamentId - ID of the tournament to join
   * @private
   */
  _joinTournament(tournamentId) {
    console.log('Joining tournament:', tournamentId);
    
    // Make sure we have a network manager
    if (!this.networkManager) {
      console.error('Cannot join tournament: Network manager not initialized');
      this._updateTournamentStatus('Error: Cannot connect to server. Please refresh and try again.');
      return;
    }
    
    // Make sure we have a character class selected
    if (!this.selectedClass) {
      console.warn('No character class selected. Highlighting character selection area...');
      
      // Update tournament status
      this._updateTournamentStatus('Please select a character class first!');
      
      // Highlight the character selection area
      const characterClasses = document.querySelector('.classes');
      if (characterClasses) {
        characterClasses.style.border = '2px solid #f1c40f';
        characterClasses.style.boxShadow = '0 0 10px rgba(241, 196, 15, 0.7)';
        
        // Reset highlight after a few seconds
        setTimeout(() => {
          characterClasses.style.border = '';
          characterClasses.style.boxShadow = '';
        }, 3000);
      }
      
      return;
    }
    
    // Update status
    this._updateTournamentStatus('Joining tournament...');
    
    // Disable all join buttons while we're joining
    const joinButtons = document.querySelectorAll('.tournament-item button');
    joinButtons.forEach(button => {
      button.disabled = true;
    });
    
    // Register a one-time handler for tournament joined event
    const tournamentJoinedHandler = (data) => {
      console.log('Tournament joined response received:', data);
      
      // Get tournament data from the response
      const tournamentData = data.tournament || data;
      
      // Emit tournament.joined event for our UI to handle
      eventBus.emit('tournament.joined', {
        tournament: tournamentData
      });
      
      // Remove this one-time handler
      this.networkManager.unregisterMessageHandler('tournamentJoined', tournamentJoinedHandler);
    };
    
    // Register handler for tournament joined response
    this.networkManager.registerMessageHandler('tournamentJoined', tournamentJoinedHandler);
    
    // Send tournament join request
    const success = this.networkManager.joinTournament(tournamentId);
    
    if (!success) {
      console.error('Failed to send tournament join request');
      this._updateTournamentStatus('Error joining tournament. Please try again.');
      
      // Re-enable join buttons
      joinButtons.forEach(button => {
        button.disabled = false;
      });
    }
  }
  
  /**
   * Start a tournament
   * @param {string} tournamentId - ID of the tournament to start
   * @private
   */
  _startTournament(tournamentId) {
    if (!this.networkManager) {
      console.error('Cannot start tournament: Network manager not initialized');
      return;
    }
    
    console.log('Starting tournament:', tournamentId);
    
    // Update status
    this._updateTournamentStatus('Starting tournament...');
    
    // Send start tournament request
    this.networkManager.startTournament(tournamentId);
  }
  
  /**
   * Update the tournament status display
   * @param {string} message - Status message to display
   * @private
   */
  _updateTournamentStatus(message) {
    const tournamentStatus = document.getElementById('tournament-status');
    if (tournamentStatus) {
      // Keep the start button if it exists
      const startBtn = tournamentStatus.querySelector('#start-tournament-btn');
      
      tournamentStatus.innerHTML = message;
      
      // Re-add the start button if it existed
      if (startBtn) {
        tournamentStatus.appendChild(startBtn);
      }
    }
  }
  
  /**
   * Add a tournament to the available tournaments list
   * @param {Object} tournament - Tournament data
   * @private
   */
  _addTournamentToList(tournament) {
    console.log('Adding tournament to list:', tournament);
    
    // Get tournaments list element
    const tournamentsList = document.getElementById('tournaments-list');
    if (!tournamentsList) {
      console.error('Tournaments list element not found');
      return;
    }
    
    // Check if we already have a "no tournaments" message
    const noTournamentsMsg = tournamentsList.querySelector('.no-tournaments');
    if (noTournamentsMsg) {
      // Remove the message
      noTournamentsMsg.remove();
    }
    
    // Check if this tournament is already in the list
    const existingTournament = tournamentsList.querySelector(`[data-tournament-id="${tournament.id}"]`);
    if (existingTournament) {
      // Update existing tournament
      const playerCountEl = existingTournament.querySelector('.tournament-players');
      if (playerCountEl) {
        playerCountEl.textContent = `Players: ${tournament.playerCount}/${tournament.maxPlayers || 16}`;
      }
      return;
    }
    
    // Create tournament item
    const tournamentItem = document.createElement('div');
    tournamentItem.className = 'tournament-item';
    tournamentItem.dataset.tournamentId = tournament.id;
    
    // Create tournament info
    const tournamentInfo = document.createElement('div');
    tournamentInfo.className = 'tournament-info';
    
    // Create tournament name
    const tournamentName = document.createElement('div');
    tournamentName.className = 'tournament-name';
    tournamentName.textContent = tournament.name;
    
    // Create tournament players count
    const tournamentPlayers = document.createElement('div');
    tournamentPlayers.className = 'tournament-players';
    tournamentPlayers.textContent = `Players: ${tournament.playerCount}/${tournament.maxPlayers || 16}`;
    
    // Add name and players to info
    tournamentInfo.appendChild(tournamentName);
    tournamentInfo.appendChild(tournamentPlayers);
    
    // Create join button
    const joinButton = document.createElement('button');
    joinButton.textContent = 'Join';
    joinButton.addEventListener('click', () => {
      this._joinTournament(tournament.id);
    });
    
    // Disable join button if tournament is full or not in WAITING status
    if (tournament.status !== 'WAITING' || tournament.playerCount >= (tournament.maxPlayers || 16)) {
      joinButton.disabled = true;
      joinButton.title = tournament.status !== 'WAITING' 
        ? 'Tournament already started' 
        : 'Tournament is full';
    }
    
    // Add info and button to item
    tournamentItem.appendChild(tournamentInfo);
    tournamentItem.appendChild(joinButton);
    
    // Add item to list
    tournamentsList.appendChild(tournamentItem);
  }
  
  /**
   * Update the player count for a tournament in the list
   * @param {string} tournamentId - ID of the tournament
   * @param {number} playerCount - New player count
   * @private
   */
  _updateTournamentPlayerCount(tournamentId, playerCount) {
    const tournamentsList = document.getElementById('tournaments-list');
    if (!tournamentsList) return;
    
    const tournamentItem = tournamentsList.querySelector(`[data-tournament-id="${tournamentId}"]`);
    if (!tournamentItem) return;
    
    const playersElement = tournamentItem.querySelector('.tournament-players');
    if (playersElement) {
      playersElement.textContent = `Players: ${playerCount}`;
    }
  }
  
  /**
   * Clear the tournaments list
   * @private
   */
  _clearTournamentsList() {
    const tournamentsList = document.getElementById('tournaments-list');
    if (!tournamentsList) return;
    
    tournamentsList.innerHTML = '<div class="no-tournaments">No tournaments available</div>';
  }

  /**
   * Set up event handlers for tournament events
   * @private
   */
  _setupTournamentEventHandlers() {
    console.log('Setting up tournament event handlers');
    
    // Tournament created handler
    eventBus.on('tournament.created', (data) => {
      console.log('Tournament created event received:', data);
      
      // Check if data has tournament property (new format) or direct properties (old format)
      const tournamentData = data.tournament || data;
      
      this._updateTournamentStatus(`Tournament "${tournamentData.name}" created! Waiting for players to join...`);
      this.currentTournamentId = tournamentData.id;
      
      // Show the character selection classes to make sure the player selects one
      const characterClasses = document.querySelector('.classes');
      if (characterClasses) {
        characterClasses.style.display = 'flex';
      }
      
      // Make the start button visible if it's not already
      const startBtn = document.getElementById('start-game');
      if (startBtn) {
        startBtn.classList.add('visible');
      }
      
      // Disable the create tournament button
      const createTournamentBtn = document.getElementById('create-tournament-btn');
      if (createTournamentBtn) {
        createTournamentBtn.disabled = true;
        createTournamentBtn.textContent = 'Tournament Created';
      }
    });
    
    // Tournament joined handler
    eventBus.on('tournament.joined', (data) => {
      console.log('Tournament joined event received:', data);
      
      // Check if data has tournament property (new format) or direct properties (old format)
      const tournamentData = data.tournament || data;
      
      this._updateTournamentStatus(`Joined tournament "${tournamentData.name}" with ${tournamentData.playerCount} players`);
      this.currentTournamentId = tournamentData.id;
      
      // Make the start button visible
      const startBtn = document.getElementById('start-game');
      if (startBtn) {
        startBtn.classList.add('visible');
      }
    });
    
    // Tournament player count update handler
    eventBus.on('tournament.playerCount', (data) => {
      console.log('Tournament player count update received:', data);
      
      // Check if data has tournament property (new format) or direct properties (old format)
      const tournamentData = data.tournament || data;
      
      this._updateTournamentPlayerCount(tournamentData.id, tournamentData.playerCount);
      
      if (this.currentTournamentId === tournamentData.id) {
        this._updateTournamentStatus(`Tournament "${tournamentData.name}" - ${tournamentData.playerCount} players joined`);
      }
    });
    
    // New tournament handler
    eventBus.on('tournament.new', (data) => {
      console.log('New tournament available:', data);
      
      // Check if data has tournament property (new format) or direct properties (old format)
      const tournamentData = data.tournament || data;
      
      this._addTournamentToList(tournamentData);
    });
    
    // Tournament list handler
    eventBus.on('tournament.list', (data) => {
      console.log('Active tournaments list received:', data);
      
      // Clear existing tournaments
      this._clearTournamentsList();
      
      // Add each tournament to the list
      if (data.tournaments && Array.isArray(data.tournaments)) {
        data.tournaments.forEach(tournament => {
          this._addTournamentToList(tournament);
        });
      }
    });
  }

  /**
   * Set up battle royale event handlers
   * @private
   */
  _setupBattleRoyaleEventHandlers() {
    console.log('Setting up battle royale event handlers');
    
    // Handle join battle royale request
    eventBus.on('game.joinBattleRoyale', (data) => {
      console.log('Join battle royale request:', data);
      
      if (!this.networkManager) {
        console.error('Cannot join battle royale: Network manager not initialized');
        return;
      }
      
      // Make sure we have a character class selected
      if (!this.selectedClass) {
        console.warn('No character class selected. Cannot join battle royale.');
        return;
      }
      
      // Join the battle royale
      this.networkManager.joinBattleRoyale(data.battleRoyaleId);
    });
    
    // Handle battle royale joined event
    eventBus.on('network.battleRoyaleJoined', (battleRoyale) => {
      console.log('Joined battle royale:', battleRoyale);
      
      // Start the battle royale mode
      this.startBattleRoyaleMode();
    });
  }
}

// Create singleton instance
const game = new Game();

export default game;