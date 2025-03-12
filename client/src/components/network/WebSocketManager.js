import eventBus from '../core/EventBus.js';

/**
 * WebSocketManager - Simple WebSocket implementation for multiplayer communication
 */
class WebSocketManager {
  /**
   * Create a new WebSocketManager
   */
  constructor() {
    // Connection state
    this.socket = null;
    this.playerId = null;
    this.connected = false;
    this.playerData = null;
    this.otherPlayers = {};
    this._hasJoined = false;
    this._connectionStatus = 'disconnected';
    this.messageHandlers = {};
    this.statusCallback = null;
    
    // Tournament-related properties
    this._currentTournament = null;
    this._availableTournaments = [];
    this._tournamentCallbacks = {
      onTournamentCreated: null,
      onTournamentJoined: null,
      onTournamentUpdated: null,
      onNewTournament: null,
      onActiveTournaments: null
    };
    
    // Bind methods
    this.connect = this.connect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.registerMessageHandler = this.registerMessageHandler.bind(this);
    this.unregisterMessageHandler = this.unregisterMessageHandler.bind(this);
    
    // Expose debug methods
    this._exposeDebugMethods();
  }
  
  /**
   * Register a handler for a specific message type
   * @param {string} messageType - The type of message to handle
   * @param {Function} callback - The callback function to execute when message is received
   * @returns {boolean} - Success status
   */
  registerMessageHandler(messageType, callback) {
    if (!messageType || typeof callback !== 'function') {
      console.error('[NETWORK] Invalid message handler registration:', messageType);
      return false;
    }
    
    console.log(`[NETWORK] Registering handler for message type: ${messageType}`);
    
    // Initialize array for this message type if it doesn't exist
    if (!this.messageHandlers[messageType]) {
      this.messageHandlers[messageType] = [];
    }
    
    // Add the callback to the handlers for this message type
    this.messageHandlers[messageType].push(callback);
    
    return true;
  }
  
  /**
   * Unregister a handler for a specific message type
   * @param {string} messageType - The type of message to handle
   * @param {Function} callback - The callback function to remove
   * @returns {boolean} - Success status
   */
  unregisterMessageHandler(messageType, callback) {
    // Check if we have handlers for this message type
    if (!this.messageHandlers[messageType] || !this.messageHandlers[messageType].length) {
      console.warn(`[NETWORK] No handlers registered for message type: ${messageType}`);
      return false;
    }
    
    // If callback is provided, remove only that specific callback
    if (callback && typeof callback === 'function') {
      const initialLength = this.messageHandlers[messageType].length;
      this.messageHandlers[messageType] = this.messageHandlers[messageType].filter(
        handler => handler !== callback
      );
      
      const removed = initialLength - this.messageHandlers[messageType].length;
      console.log(`[NETWORK] Removed ${removed} handler(s) for message type: ${messageType}`);
      
      return removed > 0;
    } 
    // If no callback provided, remove all handlers for this message type
    else {
      const count = this.messageHandlers[messageType].length;
      this.messageHandlers[messageType] = [];
      
      console.log(`[NETWORK] Removed all ${count} handler(s) for message type: ${messageType}`);
      return true;
    }
  }
  
  /**
   * Set up configuration
   * @param {Object} config - Configuration object
   */
  configure(config = {}) {
    if (config.serverUrl) {
      this.serverUrl = config.serverUrl;
    }
    
    console.log('WebSocketManager configured');
    return this;
  }
  
  /**
   * Connect to the server
   * @param {string} serverUrl - The server URL
   * @returns {Promise} - Resolves when connected
   */
  connect(serverUrl = 'ws://localhost:3000') {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Attempting to connect to WebSocket server at ${serverUrl}`);
        
        // Check if already connected
        if (this.socket && this.connected) {
          console.log('Already connected to WebSocket server');
          eventBus.emit('network.connected');
          resolve();
          return;
        }
        
        // If socket exists but is still connecting, wait for it
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
          console.log('WebSocket connection already in progress, waiting...');
          
          // Set up one-time event listeners for this connection attempt
          const onOpen = () => {
            console.log('WebSocket connection established after waiting');
            this.connected = true;
            this.socket.removeEventListener('open', onOpen);
            this.socket.removeEventListener('error', onError);
            eventBus.emit('network.connected');
            resolve();
          };
          
          const onError = (error) => {
            console.error('WebSocket connection error after waiting:', error);
            this.connected = false;
            this.socket.removeEventListener('open', onOpen);
            this.socket.removeEventListener('error', onError);
            reject(error);
          };
          
          this.socket.addEventListener('open', onOpen);
          this.socket.addEventListener('error', onError);
          return;
        }
        
        // Close existing socket if it exists
        if (this.socket) {
          console.log('Closing existing socket before creating a new one');
          this.socket.close();
          this.socket = null;
        }
        
        // Create WebSocket connection
        this.socket = new WebSocket(serverUrl);
        
        // Set up event handlers with proper binding
        this.socket.onopen = () => {
          console.log('WebSocket connection established successfully');
          this.connected = true;
          
          // Emit connection event for other components
          eventBus.emit('network.connected');
          
          // Send a ping to verify connection is working
          this.sendMessage({ type: 'ping', timestamp: Date.now() });
          
          resolve();
        };
        
        // Make sure handleMessage is bound to this instance
        this.socket.onmessage = this.handleMessage;
        
        this.socket.onerror = (error) => {
          console.error('WebSocket connection error:', error);
          this.connected = false;
          reject(error);
        };
        
        this.socket.onclose = (event) => {
          console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason || 'None provided'}`);
          this.connected = false;
          
          // Emit disconnection event for other components
          eventBus.emit('network.disconnected');
          
          // Try to reconnect after a delay
          setTimeout(() => {
            console.log('Attempting to reconnect to WebSocket server...');
            this.connect(serverUrl)
              .then(() => console.log('Reconnected to WebSocket server successfully'))
              .catch(err => console.error('Failed to reconnect to WebSocket server:', err));
          }, 5000);
        };
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Handle incoming WebSocket message
   * @param {Object} event - WebSocket message event
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      // Skip processing if no type
      if (!message.type) {
        console.warn('[NETWORK] Received message with no type:', message);
        return;
      }
      
      // Log message (except for high-frequency messages)
      if (message.type !== 'ping' && message.type !== 'pong') {
        console.log('[NETWORK] Received message:', message);
      }
      
      // Check for registered handler
      if (this.messageHandlers[message.type]) {
        this.messageHandlers[message.type].forEach(handler => {
          try {
            handler(message);
          } catch (handlerError) {
            console.error(`[NETWORK] Error in handler for ${message.type}:`, handlerError);
          }
        });
      }
      
      // Handle message based on type
      switch (message.type) {
        case 'id':
          console.log('[NETWORK] Assigned ID:', message.id);
          this.playerId = message.id;
          
          // If we have pending player data, join the game now
          if (this.pendingPlayerData) {
            this.joinGame({
              ...this.pendingPlayerData,
              id: this.playerId
            });
            this.pendingPlayerData = null;
          }
          break;
          
        case 'joinConfirmed':
          console.log('[NETWORK] Joined game with ID:', message.id);
          this.playerId = message.id;
          
          // Emit event for other systems
          eventBus.emit('network.joinConfirmed', { id: message.id });
          break;
          
        case 'existingPlayers':
          console.log('[NETWORK] Received existing players:', message.players);
          console.log('[NETWORK DEBUG] Current game mode:', window.game?.gameMode);
          console.log('[NETWORK DEBUG] Current tournament ID:', this._currentTournament?.id);
          
          // Validate players array
          if (!message.players || !Array.isArray(message.players)) {
            console.warn('[NETWORK] Invalid existing players data:', message);
            break;
          }
          
          // Clear existing players to prevent duplicates
          this.otherPlayers = {};
          
          // Process each player
          message.players.forEach(player => {
            // Skip if no ID
            if (!player.id) {
              console.warn('[NETWORK] Player has no ID:', player);
              return;
            }
            
            // Skip if this is our own player
            if (player.id === this.playerId) {
              console.log(`[NETWORK] Skipping own player in existing players: ${player.id}`);
              return;
            }
            
            // Ensure player has position data
            if (!player.position) {
              player.position = { x: 0, y: 0.8, z: 0 };
              console.log(`[NETWORK] Added default position for player ${player.id}`);
            }
            
            // Ensure player has class data
            if (!player.class && player.characterClass) {
              player.class = player.characterClass;
            } else if (!player.characterClass && player.class) {
              player.characterClass = player.class;
            } else if (!player.class && !player.characterClass) {
              player.class = 'WARRIOR';
              player.characterClass = 'WARRIOR';
              console.log(`[NETWORK] Added default class for player ${player.id}`);
            }
            
            // Ensure player has stats data
            if (!player.stats) {
              // Default stats based on class
              const classType = player.class || 'WARRIOR';
              player.stats = this._getDefaultStatsForClass(classType);
              console.log(`[NETWORK] Added default stats for player ${player.id} based on class ${classType}`);
            }
            
            // Ensure player has health data
            if (player.stats && !player.health) {
              player.health = player.stats.health;
              console.log(`[NETWORK] Added health data for player ${player.id}: ${player.health}`);
            }
            
            // Store player data
            this.otherPlayers[player.id] = player;
          });
          
          console.log('[NETWORK] Processed existing players:', Object.keys(this.otherPlayers));
          
          // Emit event for entity manager to create the players
          eventBus.emit('network.existingPlayers', {
            players: Object.values(this.otherPlayers)
          });
          
          // Force refresh player meshes after a short delay if in tournament mode
          if (window.game?.gameMode === 'tournament') {
            console.log('[NETWORK] Scheduling player mesh refresh for tournament mode');
            
            setTimeout(() => {
              console.log('[NETWORK] Forcing refresh of player meshes after receiving tournament player data');
              
              // Try to use the entity manager's refresh method
              if (window.entityManager && window.entityManager.forceRefreshPlayerMeshes) {
                const count = window.entityManager.forceRefreshPlayerMeshes();
                console.log(`[NETWORK] Refreshed ${count} player meshes via EntityManager`);
              } 
              // Fallback to global function if available
              else if (window.forceRefreshPlayerMeshes) {
                const count = window.forceRefreshPlayerMeshes();
                console.log(`[NETWORK] Refreshed ${count} player meshes via global function`);
              }
            }, 1000); // Wait for entities to be created
          }
          
          break;
          
        case 'playerJoined':
          // Extract player data from the message
          // The server sends player data directly in the message, not in a player property
          const playerData = {
            id: message.id,
            username: message.username,
            characterClass: message.characterClass,
            class: message.characterClass, // Ensure both formats are available
            position: message.position || { x: 0, y: 0.8, z: 0 },
            stats: message.stats || this._getDefaultStatsForClass(message.characterClass || 'WARRIOR'),
            health: message.health || (message.stats ? message.stats.health : null)
          };
          
          console.log('[NETWORK] Player joined:', playerData);
          
          // Skip if no player ID
          if (!playerData.id) {
            console.warn('[NETWORK] Invalid player joined message - missing ID:', message);
            break;
          }
          
          // Skip if this is our own player
          if (playerData.id === this.playerId) {
            console.log(`[NETWORK] Skipping own player join event: ${playerData.id}`);
            break;
          }
          
          // Ensure player has health data if not provided
          if (!playerData.health && playerData.stats) {
            playerData.health = playerData.stats.health;
            console.log(`[NETWORK] Added health data for player ${playerData.id}: ${playerData.health}`);
          }
          
          // Store player data
          this.otherPlayers[playerData.id] = playerData;
          
          // Emit event for entity manager to create the player
          console.log(`[NETWORK] Emitting player joined event for ${playerData.id}`);
          eventBus.emit('network.playerJoined', playerData);
          
          // In tournament mode, ensure player mesh is added to scene after a short delay
          if (window.game?.gameMode === 'tournament') {
            console.log('[NETWORK] Tournament mode detected, ensuring player mesh is added to scene');
            
            setTimeout(() => {
              try {
                // Try to find the player entity
                if (window.entityManager) {
                  const entity = window.entityManager.getEntity(playerData.id);
                  
                  if (entity) {
                    console.log(`[NETWORK] Found entity for player ${playerData.id}, checking mesh`);
                    
                    // Check if mesh exists and is in scene
                    if (entity.mesh) {
                      const objectId = `player-${entity.id}`;
                      const isInScene = window.renderer.getObject(objectId);
                      
                      if (!isInScene) {
                        console.log(`[NETWORK] Adding mesh for player ${entity.id} to scene`);
                        window.renderer.addObject(objectId, entity.mesh);
                      }
                      
                      // Ensure mesh is visible
                      entity.mesh.visible = true;
                      console.log(`[NETWORK] Ensured player ${entity.id} is visible`);
                    } else {
                      console.warn(`[NETWORK] Player ${entity.id} has no mesh, attempting to recreate`);
                      
                      // Try to recreate mesh if player has the method
                      if (entity._createPlayerMesh) {
                        entity._createPlayerMesh();
                        
                        if (entity.mesh) {
                          console.log(`[NETWORK] Created mesh for player ${entity.id}, adding to scene`);
                          window.renderer.addObject(`player-${entity.id}`, entity.mesh);
                          entity.mesh.visible = true;
                        }
                      }
                    }
                  } else {
                    console.log(`[NETWORK] Entity not found for player ${playerData.id}, forcing refresh`);
                    
                    // Force refresh all player meshes as a fallback
                    if (window.forceRefreshPlayerMeshes) {
                      window.forceRefreshPlayerMeshes();
                    }
                  }
                }
              } catch (error) {
                console.error('[NETWORK] Error ensuring player mesh visibility:', error);
              }
            }, 500);
          }
          
          break;
          
        case 'playerLeft':
          console.log('Player left:', message.id);
          
          // Remove player data
          if (message.id && this.otherPlayers[message.id]) {
            delete this.otherPlayers[message.id];
            
            // Notify about player leaving
            eventBus.emit('network.playerLeft', { id: message.id });
          }
          break;
          
        case 'playerMoved':
          // Skip logging for position updates to reduce spam
          
          // Update player position
          if (message.id && message.id !== this.playerId) {
            // Update stored position
            if (this.otherPlayers[message.id]) {
              this.otherPlayers[message.id].position = message.position;
            }
            
            // Notify about player movement
            eventBus.emit('network.playerMoved', {
              id: message.id,
              position: message.position
            });
          }
          break;
          
        case 'playerAttacked':
          console.log('Player attacked:', message);
          
          // Check if we are the target
          const isTargetSelf = message.targetId === this.playerId;
          
          // Determine if we should process this attack
          const shouldProcess = isTargetSelf || 
                               (message.inRange !== false); // Process if in range or if range not specified
          
          console.log('Processing attack:', shouldProcess ? 'YES' : 'NO', '- inRange:', message.inRange);
          
          // Emit event for entity manager to handle the attack visuals
          eventBus.emit('network.playerAttacked', message);
          
          // If we are the target, apply damage directly to our player
          if (isTargetSelf) {
            console.log('We are the target of attack - applying damage');
            
            // Get our player entity
            const player = window.game?.player;
            
            // Apply damage if player exists and has takeDamage method
            if (player && typeof player.takeDamage === 'function') {
              player.takeDamage(message.damage, true); // true = from network
            } else {
              console.warn('Cannot apply damage: player not found or missing takeDamage method');
            }
          }
          break;
          
        case 'playerAttackMissed':
          console.log('Attack missed:', message);
          
          // Notify about missed attack
          eventBus.emit('network.playerAttackMissed', {
            id: message.id,
            targetId: message.targetId,
            attackType: message.attackType,
            attackId: message.attackId,
            reason: message.reason,
            distance: message.distance,
            maxRange: message.maxRange
          });
          
          // If we are the attacker, show feedback
          if (message.id === this.playerId) {
            console.log(`Your attack missed: Target out of range (${message.distance.toFixed(2)} > ${message.maxRange})`);
            
            // Show visual feedback
            if (window.game && window.game.showAttackMissedFeedback) {
              window.game.showAttackMissedFeedback(message.reason, message.distance, message.maxRange);
            }
            
            // Show message in UI
            const missMessage = `Attack missed: Target out of range (${message.distance.toFixed(2)} > ${message.maxRange})`;
            this._showNotification(missMessage);
          }
          break;
          
        case 'playerHealth':
          console.log('Player health update received:', message);
          
          // Emit event for entity manager to handle
          eventBus.emit('network.playerHealthChanged', message);
          
          // If this is our player, update our health directly
          if (message.id === this.playerId) {
            console.log('Our health changed:', message.health);
            
            // Update health in Game.js if available
            if (window.game && typeof window.game.updateHealthUI === 'function') {
              window.game.updateHealthUI(message.health, message.maxHealth);
            }
            
            // Update our player data
            if (this.playerData) {
              this.playerData.health = message.health;
              this.playerData.maxHealth = message.maxHealth;
            }
          }
          break;
          
        case 'playerHealthChanged':
          console.log('Legacy playerHealthChanged message received:', message);
          
          // Update stored health for other players
          if (message.id && message.id !== this.playerId && this.otherPlayers[message.id]) {
            this.otherPlayers[message.id].health = message.health;
          }
          
          // Notify about health change with all details
          eventBus.emit('network.playerHealthChanged', {
            id: message.id,
            health: message.health,
            maxHealth: message.maxHealth,
            damage: message.damage,
            attackerId: message.attackerId,
            attackId: message.attackId
          });
          
          // If this is our player, ensure the health is updated in the UI
          if (message.id === this.playerId) {
            console.log('Our health changed:', message.health);
            
            // Update player health directly if available
            if (window.game && window.game.player) {
              window.game.player.health = message.health;
              
              // Update UI
              if (typeof window.game.updateHealthUI === 'function') {
                window.game.updateHealthUI(message.health, message.maxHealth || window.game.player.stats.health);
              }
            }
            
            // Dispatch DOM event for any other listeners
            const healthChangedEvent = new CustomEvent('player-health-changed', {
              detail: {
                id: this.playerId,
                health: message.health,
                maxHealth: message.maxHealth,
                damage: message.damage || 0
              }
            });
            document.dispatchEvent(healthChangedEvent);
          }
          break;
          
        case 'playerDied':
          console.log('Player died:', message);
          
          // Notify about player death
          eventBus.emit('network.playerDied', {
            id: message.id,
            attackerId: message.attackerId
          });
          
          // If we are the target, show death screen
          if (message.id === this.playerId) {
            if (window.showDeathScreen) {
              window.showDeathScreen(message.attackerId);
            }
          }
          break;
          
        case 'playerRespawned':
          console.log('Player respawned:', message);
          
          // Update stored position and health
          if (message.id && this.otherPlayers[message.id]) {
            this.otherPlayers[message.id].position = message.position;
            this.otherPlayers[message.id].health = message.health;
          }
          
          // Notify about player respawn
          eventBus.emit('network.playerRespawned', {
            id: message.id,
            position: message.position,
            health: message.health,
            maxHealth: message.maxHealth
          });
          break;
          
        // Tournament-related messages
        case 'tournamentCreated':
          console.log('Tournament created:', message.tournament);
          
          // Store current tournament
          this._currentTournament = message.tournament;
          
          // Emit tournament created event
          eventBus.emit('tournament.created', message);
          break;
          
        case 'tournamentAvailable':
          console.log('Tournament available:', message.tournamentId);
          eventBus.emit('tournament.available', {
            tournamentId: message.tournamentId,
            name: message.name,
            playerCount: message.playerCount,
            status: message.status
          });
          this._showNotification(`Tournament "${message.name}" is available to join!`);
          break;
          
        case 'tournamentJoined':
          console.log('Joined tournament:', message.tournament);
          
          // Store current tournament
          this._currentTournament = message.tournament;
          
          // Emit tournament joined event
          eventBus.emit('tournament.joined', message);
          
          // Request tournament players to ensure visibility
          if (message.tournament && message.tournament.id) {
            console.log('[NETWORK] Automatically requesting tournament players after joining');
            
            // Wait a short delay to ensure server has processed the join
            setTimeout(() => {
              this.requestTournamentPlayers(message.tournament.id);
              
              // Also request existing players as a fallback
              this.forceGetExistingPlayers();
            }, 500);
          }
          break;
          
        case 'tournamentPlayerCount':
          console.log('Tournament player count updated:', message.playerCount);
          eventBus.emit('tournament.playerCountUpdated', {
            tournamentId: message.tournamentId,
            playerCount: message.playerCount
          });
          break;
          
        case 'tournamentReady':
          console.log('Tournament ready to start:', message.tournamentId);
          eventBus.emit('tournament.ready', {
            tournamentId: message.tournamentId
          });
          this._showNotification('Tournament is ready to start!');
          break;
          
        case 'tournamentStarted':
          console.log('Tournament started:', message.tournamentId);
          eventBus.emit('tournamentStarted', {
            tournamentId: message.tournamentId,
            name: message.name,
            brackets: message.brackets
          });
          this._showNotification(`Tournament "${message.name}" has started!`);
          break;
          
        case 'tournamentBracketUpdate':
          console.log('Tournament bracket updated:', message.tournamentId);
          eventBus.emit('tournamentBracketUpdate', {
            tournamentId: message.tournamentId,
            brackets: message.brackets
          });
          break;
          
        case 'tournamentMatchReady':
          console.log('Tournament match ready:', message.matchId);
          eventBus.emit('tournament.matchReady', {
            tournamentId: message.tournamentId,
            matchId: message.matchId,
            opponent: message.opponent
          });
          this._showNotification(`Your tournament match is ready! Opponent: ${message.opponent.name}`);
          break;
          
        case 'tournamentComplete':
          console.log('Tournament completed:', message.tournamentId);
          eventBus.emit('tournamentComplete', {
            tournamentId: message.tournamentId,
            winner: message.winner
          });
          this._showNotification(`Tournament completed! Winner: ${message.winner.name}`);
          break;
          
        case 'tournamentBracket':
          console.log('Tournament bracket received:', message.tournamentId);
          eventBus.emit('tournament.bracketReceived', {
            tournamentId: message.tournamentId,
            name: message.name,
            status: message.status,
            brackets: message.brackets,
            winner: message.winner
          });
          break;
          
        case 'newTournament':
          console.log('New tournament available:', message.tournament);
          
          // Add to available tournaments
          if (!this._availableTournaments) {
            this._availableTournaments = [];
          }
          
          // Check if tournament already exists in the list
          const existingIndex = this._availableTournaments.findIndex(t => t.id === message.tournament.id);
          if (existingIndex >= 0) {
            // Update existing tournament
            this._availableTournaments[existingIndex] = message.tournament;
          } else {
            // Add new tournament
            this._availableTournaments.push(message.tournament);
          }
          
          // Emit new tournament event
          eventBus.emit('tournament.new', message);
          break;
          
        case 'tournamentUpdated':
          console.log('Tournament updated:', message.tournament);
          
          // Update tournament in available tournaments list
          if (this._availableTournaments) {
            const index = this._availableTournaments.findIndex(t => t.id === message.tournament.id);
            if (index >= 0) {
              this._availableTournaments[index] = {
                ...this._availableTournaments[index],
                ...message.tournament
              };
            }
          }
          
          // Update current tournament if it's the same one
          if (this._currentTournament && this._currentTournament.id === message.tournament.id) {
            this._currentTournament = {
              ...this._currentTournament,
              ...message.tournament
            };
          }
          
          // Emit tournament updated event
          eventBus.emit('tournament.playerCount', message);
          break;
          
        case 'activeTournaments':
          console.log('Received active tournaments list:', message.tournaments);
          
          // Store available tournaments
          this._availableTournaments = message.tournaments;
          
          // Emit tournaments list event
          eventBus.emit('tournament.list', message);
          break;
          
        case 'error':
          console.error('Server error:', message.message);
          
          // Show error notification
          this._showNotification(`Error: ${message.message}`);
          
          // Emit error event
          eventBus.emit('network.error', message);
          break;
          
        case 'battleRoyaleEvent':
          console.log('Battle Royale event notification received:', message);
          eventBus.emit('network.battleRoyaleEvent', message);
          break;
          
        case 'battleRoyaleInvitation':
          console.log('Battle Royale invitation received:', message);
          eventBus.emit('network.battleRoyaleInvitation', message);
          break;
          
        case 'battleRoyaleCreated':
          console.log('Battle Royale created:', message);
          eventBus.emit('network.battleRoyaleCreated', message.battleRoyale);
          break;
          
        case 'battleRoyaleJoined':
          console.log('Joined Battle Royale:', message);
          eventBus.emit('network.battleRoyaleJoined', message.battleRoyale);
          break;
      }
    } catch (error) {
      console.error('[NETWORK] Error handling message:', error);
    }
  }
  
  /**
   * Send a message to the server
   * @param {Object} message - The message to send
   */
  sendMessage(message) {
    // Check if socket exists
    if (!this.socket) {
      console.error('Cannot send message: No WebSocket connection');
      return false;
    }
    
    // Check socket state
    if (this.socket.readyState === WebSocket.CONNECTING) {
      console.log('Socket is still connecting, queueing message:', message.type);
      
      // Initialize message queue if it doesn't exist
      if (!this._messageQueue) {
        this._messageQueue = [];
        
        // Set up one-time open handler to send queued messages
        const sendQueuedMessages = () => {
          console.log(`Sending ${this._messageQueue.length} queued messages`);
          
          while (this._messageQueue.length > 0) {
            const queuedMessage = this._messageQueue.shift();
            try {
              const messageStr = JSON.stringify(queuedMessage);
              console.log('Sending queued message:', queuedMessage.type);
              this.socket.send(messageStr);
            } catch (error) {
              console.error('Error sending queued message:', error);
            }
          }
          
          // Remove the event listener
          this.socket.removeEventListener('open', sendQueuedMessages);
        };
        
        this.socket.addEventListener('open', sendQueuedMessages);
      }
      
      // Add message to queue
      this._messageQueue.push(message);
      return true;
    }
    
    // Check if socket is open
    if (this.socket.readyState !== WebSocket.OPEN) {
      console.error(`Cannot send message: Socket not open (state: ${this.socket.readyState})`);
      return false;
    }
    
    try {
      const messageStr = JSON.stringify(message);
      console.log('Sending message to server:', message.type, message);
      this.socket.send(messageStr);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }
  
  /**
   * Join a game with player data
   * @param {Object} playerData - Player data to send to server
   */
  joinGame(playerData) {
    console.log('[NETWORK] Joining game with player data:', playerData);
    
    // Ensure we have a valid player data object
    if (!playerData) {
      console.error('[NETWORK] Cannot join game: No player data provided');
      return;
    }
    
    // Store player data for later use
    this.playerData = { ...playerData };
    
    // Include authentication data if available
    if (window.authData && window.authData.username) {
      console.log('[NETWORK] Including authentication data for user:', window.authData.username);
      this.playerData.auth = {
        username: window.authData.username,
        userId: window.authData.userId || null
      };
    }
    
    // Ensure player has class data
    if (!this.playerData.class && this.playerData.characterClass) {
      this.playerData.class = this.playerData.characterClass;
    } else if (!this.playerData.characterClass && this.playerData.class) {
      this.playerData.characterClass = this.playerData.class;
    } else if (!this.playerData.class && !this.playerData.characterClass) {
      this.playerData.class = 'WARRIOR';
      this.playerData.characterClass = 'WARRIOR';
      console.log('[NETWORK] Added default class for player');
    }
    
    // Ensure player has stats data
    if (!this.playerData.stats) {
      // Default stats based on class
      const classType = this.playerData.class || 'WARRIOR';
      this.playerData.stats = this._getDefaultStatsForClass(classType);
      console.log(`[NETWORK] Added default stats for player based on class ${classType}`);
    }
    
    // Ensure player has health data
    if (this.playerData.stats && !this.playerData.health) {
      this.playerData.health = this.playerData.stats.health;
      console.log(`[NETWORK] Added health data for player: ${this.playerData.health}`);
    }
    
    // Use the assigned ID if we have one
    if (this.playerId) {
      this.playerData.id = this.playerId;
    }
    
    console.log('[NETWORK] Sending join with final player data:', this.playerData);
    
    // Send join message to server
    const joinSent = this.sendMessage({
      type: 'join',
      playerData: this.playerData
    });
    
    // If join message was sent successfully, request existing players after a short delay
    if (joinSent) {
      this._hasJoined = true;
      
      // Request existing players immediately after joining
      setTimeout(() => {
        console.log('[NETWORK] Requesting existing players');
        console.log('[NETWORK DEBUG] Current game mode:', window.game?.gameMode);
        console.log('[NETWORK DEBUG] Current tournament ID:', this._currentTournament?.id);
        
        const getExistingPlayersMsg = {
          type: 'getExistingPlayers'
        };
        
        // If in a tournament, include the tournament ID
        if (this._currentTournament && this._currentTournament.id) {
          getExistingPlayersMsg.tournamentId = this._currentTournament.id;
          console.log(`[NETWORK DEBUG] Including tournament ID in request: ${this._currentTournament.id}`);
        }
        
        const requestSent = this.sendMessage(getExistingPlayersMsg);
        console.log('[NETWORK DEBUG] getExistingPlayers request sent:', requestSent);
      }, 500);
    } else {
      console.error('[NETWORK] Failed to send join message');
      
      // If we couldn't send the join message now, store the player data for later
      this.pendingPlayerData = this.playerData;
    }
  }
  
  /**
   * Get default stats for a character class
   * @param {string} classType - The character class
   * @returns {Object} - The default stats
   * @private
   */
  _getDefaultStatsForClass(classType) {
    const defaultStats = {
      'CLERK': {
        id: 'CLERK',
        name: 'Clerk',
        color: 0x428CD5,
        health: 80,
        speed: 0.15,
        description: 'High speed, lower health. Uses magic attacks.'
      },
      'WARRIOR': {
        id: 'WARRIOR',
        name: 'Warrior',
        color: 0xD54242,
        health: 120,
        speed: 0.1,
        description: 'High health, lower speed. Uses melee attacks.'
      },
      'RANGER': {
        id: 'RANGER',
        name: 'Ranger',
        color: 0x42D54C,
        health: 100,
        speed: 0.125,
        description: 'Balanced health and speed. Uses ranged attacks.'
      }
    };
    
    return defaultStats[classType] || defaultStats['WARRIOR'];
  }
  
  /**
   * Join a tournament
   * @param {string} tournamentId - Tournament ID
   */
  joinTournament(tournamentId) {
    if (!this.connected || !this.socket) {
      console.error('[NETWORK] Cannot join tournament: Not connected to server');
      return false;
    }
    
    console.log(`[NETWORK] Joining tournament: ${tournamentId}`);
    
    // Set current tournament ID
    this._currentTournament = { id: tournamentId };
    
    // Send join tournament message
    this.sendMessage({
      type: 'joinTournament',
      tournamentId
    });
    
    // Request tournament players after a short delay to ensure server has processed the join
    setTimeout(() => {
      console.log('[NETWORK] Requesting tournament players after joining tournament');
      this.requestTournamentPlayers(tournamentId);
      
      // Also request existing players with tournament ID
      console.log('[NETWORK] Requesting existing players with tournament ID');
      this.sendMessage({
        type: 'getExistingPlayers',
        tournamentId: tournamentId
      });
      
      // Finally, request all existing players as a fallback
      console.log('[NETWORK] Requesting all existing players as fallback');
      this.getExistingPlayers();
    }, 1000);
    
    return true;
  }
  
  /**
   * Get existing players
   */
  getExistingPlayers() {
    if (!this.connected || !this.socket) {
      console.error('[NETWORK] Cannot get existing players: Not connected to server');
      return false;
    }
    
    console.log('[NETWORK] Requesting existing players');
    console.log('[NETWORK DEBUG] Current game mode:', window.game?.gameMode);
    console.log('[NETWORK DEBUG] Current tournament ID:', this._currentTournament?.id);
    
    const getExistingPlayersMsg = {
      type: 'getExistingPlayers'
    };
    
    // If in a tournament, include the tournament ID
    if (this._currentTournament && this._currentTournament.id) {
      getExistingPlayersMsg.tournamentId = this._currentTournament.id;
      console.log(`[NETWORK DEBUG] Including tournament ID in request: ${this._currentTournament.id}`);
    }
    
    const requestSent = this.sendMessage(getExistingPlayersMsg);
    console.log('[NETWORK DEBUG] getExistingPlayers request sent:', requestSent);
    
    return requestSent;
  }
  
  /**
   * Force a request for existing players
   * This can be called from the console to try to fix visibility issues
   * Usage: window.webSocketManager.forceGetExistingPlayers()
   */
  forceGetExistingPlayers() {
    console.log('[NETWORK] Forcing request for existing players');
    console.log('[NETWORK] Current player ID:', this.playerId);
    console.log('[NETWORK] Current game mode:', window.game?.gameMode);
    console.log('[NETWORK] Current tournament:', this._currentTournament);
    
    // Create request message
    const getExistingPlayersMsg = {
      type: 'getExistingPlayers'
    };
    
    // If in a tournament, include the tournament ID
    if (this._currentTournament && this._currentTournament.id) {
      getExistingPlayersMsg.tournamentId = this._currentTournament.id;
      console.log(`[NETWORK] Including tournament ID in request: ${this._currentTournament.id}`);
    }
    
    // Send the request
    const requestSent = this.sendMessage(getExistingPlayersMsg);
    console.log('[NETWORK] Force getExistingPlayers request sent:', requestSent);
    
    // Also try to clear and re-initialize other players
    console.log('[NETWORK] Clearing other players cache to force refresh');
    this.otherPlayers = {};
    
    return requestSent;
  }
  
  /**
   * Show notification message
   * @param {string} message - The message to show
   * @private
   */
  _showNotification(message) {
    // Try to find or create notification element
    let notificationEl = document.getElementById('game-notifications');
    
    if (!notificationEl) {
      notificationEl = document.createElement('div');
      notificationEl.id = 'game-notifications';
      notificationEl.style.position = 'absolute';
      notificationEl.style.bottom = '10%';
      notificationEl.style.left = '50%';
      notificationEl.style.transform = 'translateX(-50%)';
      notificationEl.style.color = '#ff3300';
      notificationEl.style.fontWeight = 'bold';
      notificationEl.style.textShadow = '1px 1px 2px black';
      notificationEl.style.fontSize = '18px';
      notificationEl.style.zIndex = '1000';
      document.body.appendChild(notificationEl);
    }
    
    // Show message
    notificationEl.textContent = message;
    
    // Clear after 3 seconds
    setTimeout(() => {
      notificationEl.textContent = '';
    }, 3000);
  }
  
  /**
   * Update player position
   * @param {Object} position - The new position
   */
  updatePosition(position) {
    // Update local player data
    if (this.playerData) {
      this.playerData.position = position;
    }
    
    // Send position update
    this.sendMessage({
      type: 'playerMove',
      position: {
        x: parseFloat(position.x.toFixed(2)),
        y: parseFloat(position.y.toFixed(2)),
        z: parseFloat(position.z.toFixed(2))
      }
    });
  }
  
  /**
   * Send an attack
   * @param {Object} attackData - The attack data
   */
  sendAttack(attackData) {
    console.log('[NETWORK] Sending attack to server:', JSON.stringify(attackData, null, 2));
    
    try {
      // Ensure the socket exists and is connected
      if (!this.socket || !this.connected) {
        console.error('[NETWORK] Cannot send attack: WebSocket not connected!');
        return;
      }
      
      // Validate required fields
      if (!attackData.targetId) {
        console.error('[NETWORK] Cannot send attack: missing targetId');
        return;
      }
      
      if (!attackData.damage || isNaN(attackData.damage)) {
        console.error('[NETWORK] Cannot send attack: invalid damage value');
        return;
      }
      
      // Add current position data to attack if not already included
      let positionData = attackData.debug?.myPosition || this.playerData?.position || { x: 0, y: 0, z: 0 };
      
      // Construct the attack message
      const attackMessage = {
        type: 'playerAttack',
        targetId: attackData.targetId,
        damage: attackData.damage,
        attackType: attackData.attackType || 'primary',
        position: positionData,
        attackId: attackData.attackId || `client-${Date.now()}`
      };
      
      // Log the exact message being sent
      console.log('[NETWORK] Sending WebSocket message:', JSON.stringify(attackMessage, null, 2));
      
      // Send attack with position
      this.socket.send(JSON.stringify(attackMessage));
      
      // Log success
      console.log('[NETWORK] Attack message sent successfully');
      
      // Emit local event for immediate visual feedback only
      // NOTE: This DOES NOT actually apply damage - the server will do that
      eventBus.emit('network.playerAttacked', {
        id: this.playerId,
        targetId: attackData.targetId,
        damage: attackData.damage,
        attackType: attackData.attackType || 'primary',
        inRange: true, // Assume in range for visual feedback
        attackId: attackData.attackId || `client-${Date.now()}`,
        isLocalVisualOnly: true // Flag to indicate this is just for visual feedback
      });
    } catch (error) {
      console.error('[NETWORK] Error sending attack:', error);
    }
  }
  
  /**
   * Update player health
   * @param {Object} data - Health data
   */
  updateHealth(data) {
    console.log('[NETWORK] Updating health:', data);
    
    // Ensure we have the required data
    if (!data) {
      console.error('[NETWORK] Invalid health update data');
      return;
    }
    
    // Ensure ID is set
    const id = data.id || this.playerId;
    
    // Ensure health is a valid number
    let health = data.health;
    if (typeof health !== 'number' || isNaN(health)) {
      console.warn('[NETWORK] Invalid health value in update, using default');
      health = 0;
    }
    
    // Ensure maxHealth is set
    let maxHealth = data.maxHealth;
    if (!maxHealth || typeof maxHealth !== 'number' || isNaN(maxHealth)) {
      console.warn('[NETWORK] Invalid maxHealth value in update, using default based on class');
      
      // Get class from player data
      const classType = this.playerData?.class || this.playerData?.characterClass || 'WARRIOR';
      
      // Set default health values based on class
      const defaultHealthByClass = {
        'CLERK': 80,
        'WARRIOR': 120,
        'RANGER': 100
      };
      
      maxHealth = defaultHealthByClass[classType] || 100;
    }
    
    // Ensure damage is a valid number
    const damage = typeof data.damage === 'number' ? data.damage : 0;
    
    // Create message object
    const message = {
      type: 'playerHealth',
      id: id,
      health: health,
      maxHealth: maxHealth,
      damage: damage
    };
    
    // Add attacker ID if provided
    if (data.attackerId) {
      message.attackerId = data.attackerId;
    }
    
    // Send the message
    this.sendMessage(message);
    
    // Update our local player data
    if (id === this.playerId && this.playerData) {
      this.playerData.health = health;
      this.playerData.maxHealth = maxHealth;
    }
  }
  
  /**
   * Send player death
   * @param {Object} deathData - The death data
   */
  sendDeath(deathData) {
    // Send death notification
    this.sendMessage({
      type: 'playerDeath',
      attackerId: deathData.attackerId
    });
  }
  
  /**
   * Send player respawn
   * @param {Object} respawnData - The respawn data
   */
  sendRespawn(respawnData) {
    // Update local player data
    if (this.playerData) {
      this.playerData.position = respawnData.position;
    }
    
    // Send respawn notification
    this.sendMessage({
      type: 'playerRespawn',
      position: respawnData.position,
      health: respawnData.health
    });
  }
  
  /**
   * Disconnect from the server
   */
  disconnect() {
    // Close WebSocket connection
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.connected = false;
  }
  
  /**
   * Debug method to test WebSocket connection
   * @returns {Object} - Connection status information
   */
  debugConnection() {
    const status = {
      connected: this.connected,
      socketExists: !!this.socket,
      playerId: this.playerId,
      readyState: this.socket ? this.socket.readyState : 'no socket',
      otherPlayerCount: Object.keys(this.otherPlayers).length,
      otherPlayerIds: Object.keys(this.otherPlayers)
    };
    
    console.log('[NETWORK DEBUG] Connection status:', status);
    
    // Test sending a simple message
    if (this.connected && this.socket) {
      try {
        this.socket.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));
        console.log('[NETWORK DEBUG] Test ping message sent successfully');
      } catch (error) {
        console.error('[NETWORK DEBUG] Error sending test message:', error);
      }
    }
    
    return status;
  }
  
  /**
   * Create a new tournament
   * @param {Object} tournamentData - Tournament data
   * @param {string} tournamentData.name - Tournament name
   * @param {string} tournamentData.tier - Tournament tier (optional)
   * @returns {boolean} - Success status
   */
  createTournament(tournamentData) {
    if (!this.connected || !this.socket) {
      console.error('Cannot create tournament: Not connected to server');
      return false;
    }
    
    console.log('Creating tournament:', tournamentData.name);
    
    // Make sure player has joined the game
    if (!this.playerId) {
      console.warn('Player ID not set, joining game first');
      // If we have player data, use it, otherwise use a default
      const playerData = this.playerData || {
        username: `Player_${Date.now().toString().slice(-6)}`,
        characterClass: 'clerk' // Default class if none selected
      };
      
      // Join the game first
      this.sendMessage({
        type: 'join',
        playerData: playerData
      });
      
      // Store player data for later use
      this.playerData = playerData;
    }
    
    // Create tournament message
    const message = {
      type: 'createTournament',
      name: tournamentData.name,
      tier: tournamentData.tier || 'ALL'
    };
    
    // Send message and return result
    const success = this.sendMessage(message);
    
    if (success) {
      console.log('Tournament creation message sent successfully');
    } else {
      console.error('Failed to send tournament creation message');
    }
    
    return success;
  }
  
  /**
   * Request tournament players
   * This is called automatically when joining a tournament
   * @param {string} tournamentId - Tournament ID
   * @returns {boolean} - Whether the request was sent
   */
  requestTournamentPlayers(tournamentId) {
    if (!this.connected || !this.socket) {
      console.error('[NETWORK] Cannot request tournament players: Not connected to server');
      return false;
    }
    
    console.log('[NETWORK] Requesting tournament players for tournament:', tournamentId);
    
    // Create request message
    const message = {
      type: 'getTournamentPlayers',
      tournamentId: tournamentId
    };
    
    // Send the request
    const requestSent = this.sendMessage(message);
    console.log('[NETWORK] Tournament players request sent:', requestSent);
    
    return requestSent;
  }
  
  /**
   * Debug method to refresh tournament players
   * This can be called from the console: window.webSocketManager.debugRefreshTournamentPlayers()
   */
  debugRefreshTournamentPlayers() {
    console.log('[NETWORK DEBUG] Manual refresh of tournament players requested');
    
    if (!this._currentTournament || !this._currentTournament.id) {
      console.error('[NETWORK DEBUG] No active tournament found');
      return false;
    }
    
    console.log('[NETWORK DEBUG] Current tournament ID:', this._currentTournament.id);
    
    // Request tournament players
    const requestSent = this.requestTournamentPlayers(this._currentTournament.id);
    
    // Also request existing players as a fallback
    this.forceGetExistingPlayers();
    
    return requestSent;
  }
  
  /**
   * Force a refresh of tournament players
   * This can be called from the console to try to fix visibility issues in tournaments
   * Usage: window.forceTournamentPlayersRefresh()
   */
  forceTournamentPlayersRefresh() {
    console.log('[NETWORK] Forcing refresh of tournament players');
    
    // Check if we're in a tournament
    if (!this._currentTournament || !this._currentTournament.id) {
      console.warn('[NETWORK] Not in a tournament, cannot refresh tournament players');
      return false;
    }
    
    const tournamentId = this._currentTournament.id;
    console.log(`[NETWORK] Current tournament ID: ${tournamentId}`);
    
    // First request tournament players
    console.log('[NETWORK] Requesting tournament players');
    this.requestTournamentPlayers(tournamentId);
    
    // Then request existing players with tournament ID
    console.log('[NETWORK] Requesting existing players with tournament ID');
    this.sendMessage({
      type: 'getExistingPlayers',
      tournamentId: tournamentId
    });
    
    // Finally, request all existing players as a fallback
    console.log('[NETWORK] Requesting all existing players as fallback');
    this.forceGetExistingPlayers();
    
    return true;
  }
  
  /**
   * Make this method available globally for console debugging
   * @private
   */
  _exposeDebugMethods() {
    if (typeof window !== 'undefined') {
      // Expose the WebSocketManager instance
      window.webSocketManager = this;
      
      // Expose specific debug methods
      window.forceGetExistingPlayers = this.forceGetExistingPlayers.bind(this);
      window.debugNetwork = this.debugConnection.bind(this);
      window.debugPlayerVisibility = this.debugPlayerVisibility.bind(this);
      window.forceTournamentPlayersRefresh = this.forceTournamentPlayersRefresh.bind(this);
      
      console.log('[NETWORK DEBUG] Debug methods exposed to window object');
    }
  }
  
  /**
   * Debug function to help troubleshoot player visibility issues
   * Usage: window.debugPlayerVisibility()
   */
  debugPlayerVisibility() {
    console.log('=== PLAYER VISIBILITY DEBUG ===');
    console.log('Current player ID:', this.playerId);
    console.log('Game mode:', window.game?.gameMode);
    console.log('Current tournament:', this._currentTournament);
    console.log('Other players:', this.otherPlayers);
    
    // Check if EntityManager has the players
    if (window.entityManager) {
      console.log('EntityManager entities:', window.entityManager.entities);
      
      // Check if other players are in the scene
      Object.values(this.otherPlayers).forEach(player => {
        const entity = window.entityManager.getEntity(player.id);
        console.log(`Player ${player.id} in EntityManager:`, !!entity);
        
        if (entity) {
          console.log(`Player ${player.id} mesh in scene:`, entity.mesh?.parent === window.renderer?.scene);
          console.log(`Player ${player.id} position:`, entity.position);
          console.log(`Player ${player.id} visible:`, entity.mesh?.visible);
        }
      });
    }
    
    // Force refresh of existing players
    console.log('Forcing refresh of existing players...');
    this.forceGetExistingPlayers();
    
    return 'Player visibility debug complete. Check console for details.';
  }
}

// Create and export singleton instance
const webSocketManager = new WebSocketManager();
export default webSocketManager;