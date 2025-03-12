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
      
      // Handle different message types
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
          console.log('[NETWORK DEBUG] Message tournament ID:', message.tournamentId);
          
          // Validate players array
          if (!Array.isArray(message.players)) {
            console.warn('[NETWORK] Invalid existing players data:', message);
            return;
          }
          
          // Clear other players first to prevent duplicates
          this.otherPlayers = {};
          
          // Tournament-specific logging
          if (window.game?.gameMode === 'tournament' || message.tournamentId) {
            console.log('[NETWORK] Tournament mode detected for existing players');
            console.log('[NETWORK] Tournament ID in message:', message.tournamentId);
            console.log('[NETWORK] Current tournament:', this._currentTournament?.id);
            console.log('[NETWORK] Player count in message:', message.players.length);
          }
          
          // Track processed players for logging
          const processedPlayers = [];
          
          // Process each player separately
          message.players.forEach(player => {
            // Skip if player has no ID
            if (!player.id) {
              console.warn('[NETWORK] Player data missing ID, skipping:', player);
              return;
            }
            
            // Skip if this is our own player
            if (player.id === this.playerId) {
              console.log(`[NETWORK] Skipping own player in existing players: ${player.id}`);
              return;
            }
            
            console.log(`[NETWORK] Processing existing player: ${player.id}`);
            
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
              
              player.stats = defaultStats[classType] || defaultStats['WARRIOR'];
              console.log(`[NETWORK] Added default stats for player ${player.id} based on class ${classType}`);
            }
            
            // Ensure player has health data
            if (player.stats && !player.health) {
              player.health = player.stats.health;
              console.log(`[NETWORK] Added health data for player ${player.id}: ${player.health}`);
            }
            
            // Store other player data
            this.otherPlayers[player.id] = player;
            processedPlayers.push(player.id);
          });
          
          // Log the processed players
          console.log(`[NETWORK] Processed ${processedPlayers.length} existing players: ${processedPlayers.join(', ')}`);
          
          // Emit event for entity manager to create the players
          console.log('[NETWORK] Emitting network.existingPlayers event with:', Object.values(this.otherPlayers));
          eventBus.emit('network.existingPlayers', Object.values(this.otherPlayers));
          break;
          
        case 'playerJoined':
          // Check which format the message is in - either direct properties or nested in player object
          let playerData;
          
          // Log tournament-specific information
          console.log('[NETWORK DEBUG] Player joined - Current game mode:', window.game?.gameMode);
          console.log('[NETWORK DEBUG] Player joined - Current tournament ID:', this._currentTournament?.id);
          console.log('[NETWORK DEBUG] Player joined - Message tournament ID:', message.tournamentId);
          
          if (message.player && message.player.id) {
            // Format: {type: 'playerJoined', player: {id: '...', ...}}
            console.log('[NETWORK] Player joined (player object format):', message.player);
            playerData = message.player;
            
            // Check for tournament ID in the message
            if (message.tournamentId && !playerData.tournamentId) {
              playerData.tournamentId = message.tournamentId;
              console.log('[NETWORK] Added tournament ID to player data:', message.tournamentId);
            }
          } else if (message.id) {
            // Format: {type: 'playerJoined', id: '...', ...}
            console.log('[NETWORK] Player joined (direct properties format):', message.id);
            playerData = {
              id: message.id,
              username: message.username || `Player_${message.id.substring(0, 6)}`,
              characterClass: message.characterClass || message.class || 'WARRIOR',
              class: message.class || message.characterClass || 'WARRIOR',
              position: message.position || { x: 0, y: 0.8, z: 0 },
              stats: message.stats || null,
              health: message.health || null,
              tournamentId: message.tournamentId || this._currentTournament?.id
            };
            
            if (playerData.tournamentId) {
              console.log('[NETWORK] Set tournament ID in player data:', playerData.tournamentId);
            }
          } else {
            // Invalid format - no id found
            console.warn('[NETWORK] Received invalid player joined data (no ID):', message);
            return;
          }
          
          // Skip if this is our own player
          if (playerData.id === this.playerId) {
            console.log('[NETWORK] Skipping own player join event');
            return;
          }
          
          // Ensure player has position data
          if (!playerData.position) {
            playerData.position = { x: 0, y: 0.8, z: 0 };
            console.log(`[NETWORK] Added default position for joined player ${playerData.id}`);
          }
          
          // Ensure player has class data
          if (!playerData.class && playerData.characterClass) {
            playerData.class = playerData.characterClass;
          } else if (!playerData.characterClass && playerData.class) {
            playerData.characterClass = playerData.class;
          } else if (!playerData.class && !playerData.characterClass) {
            playerData.class = 'WARRIOR';
            playerData.characterClass = 'WARRIOR';
            console.log(`[NETWORK] Added default class for joined player ${playerData.id}`);
          }
          
          // Ensure player has stats data
          if (!playerData.stats) {
            // Default stats based on class
            const classType = playerData.class || 'WARRIOR';
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
            
            playerData.stats = defaultStats[classType] || defaultStats['WARRIOR'];
            console.log(`[NETWORK] Added default stats for joined player ${playerData.id} based on class ${classType}`);
          }
          
          // Ensure player has health data
          if (playerData.stats && !playerData.health) {
            playerData.health = playerData.stats.health;
            console.log(`[NETWORK] Added health data for joined player ${playerData.id}: ${playerData.health}`);
          }
          
          // Store player data
          this.otherPlayers[playerData.id] = playerData;
          
          // Emit event for entity manager
          console.log(`[NETWORK] Emitting player joined event for ${playerData.id}`);
          eventBus.emit('network.playerJoined', playerData);
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
      
      // Call registered handlers for this message type
      if (this.messageHandlers[message.type]) {
        this.messageHandlers[message.type].forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error(`[NETWORK] Error in handler for ${message.type}:`, error);
          }
        });
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
      
      this.playerData.stats = defaultStats[classType] || defaultStats['WARRIOR'];
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
   * Join an existing tournament
   * @param {string} tournamentId - Tournament ID
   * @returns {boolean} - Success status
   */
  joinTournament(tournamentId) {
    if (!this.connected || !this.socket) {
      console.error('Cannot join tournament: Not connected to server');
      return false;
    }
    
    console.log('Joining tournament:', tournamentId);
    
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
    
    // Send join tournament message
    const success = this.sendMessage({
      type: 'joinTournament',
      tournamentId
    });
    
    if (success) {
      console.log('Tournament join message sent successfully');
    } else {
      console.error('Failed to send tournament join message');
    }
    
    return success;
  }
  
  /**
   * Start a tournament (creator only)
   * @param {string} tournamentId - Tournament ID
   */
  startTournament(tournamentId) {
    if (!this.connected || !this.socket) {
      console.error('Cannot start tournament: Not connected to server');
      return;
    }
    
    console.log('Starting tournament:', tournamentId);
    
    this.sendMessage({
      type: 'tournamentStart',
      tournamentId
    });
  }
  
  /**
   * Report a tournament match result
   * @param {Object} resultData - Match result data
   * @param {string} resultData.tournamentId - Tournament ID
   * @param {string} resultData.matchId - Match ID
   * @param {string} resultData.winnerId - Winner ID
   */
  reportTournamentMatchResult(resultData) {
    if (!this.connected || !this.socket) {
      console.error('Cannot report match result: Not connected to server');
      return;
    }
    
    console.log('Reporting match result:', resultData.matchId);
    
    this.sendMessage({
      type: 'tournamentMatchComplete',
      tournamentId: resultData.tournamentId,
      matchId: resultData.matchId,
      winnerId: resultData.winnerId
    });
  }
  
  /**
   * Request tournament bracket data
   * @param {string} tournamentId - Tournament ID
   */
  requestTournamentBracket(tournamentId) {
    if (!this.connected || !this.socket) {
      console.error('Cannot request tournament bracket: Not connected to server');
      return;
    }
    
    console.log('Requesting tournament bracket:', tournamentId);
    
    this.sendMessage({
      type: 'tournamentBracketRequest',
      tournamentId
    });
  }
  
  /**
   * Register tournament callbacks
   * @param {Object} callbacks - Tournament callbacks
   * @param {Function} callbacks.onTournamentCreated - Called when a tournament is created
   * @param {Function} callbacks.onTournamentJoined - Called when a player joins a tournament
   * @param {Function} callbacks.onTournamentUpdated - Called when a tournament is updated
   * @param {Function} callbacks.onNewTournament - Called when a new tournament is created
   * @param {Function} callbacks.onActiveTournaments - Called when active tournaments list is received
   */
  registerTournamentCallbacks(callbacks) {
    console.log('Registering tournament callbacks');
    
    if (callbacks) {
      this._tournamentCallbacks = {
        ...this._tournamentCallbacks,
        ...callbacks
      };
    }
    
    console.log('Tournament callbacks registered:', Object.keys(this._tournamentCallbacks).filter(key => !!this._tournamentCallbacks[key]));
  }
  
  /**
   * Get current tournament data
   * @returns {Object|null} - Current tournament data
   */
  getCurrentTournament() {
    return this._currentTournament;
  }
  
  /**
   * Get available tournaments
   * @returns {Array} - Available tournaments
   */
  getAvailableTournaments() {
    return this._availableTournaments || [];
  }
  
  /**
   * Register a message handler for a specific message type
   * @param {string} messageType - The message type to handle
   * @param {Function} handler - The handler function
   */
  registerMessageHandler(messageType, handler) {
    console.log(`Registering handler for message type: ${messageType}`);
    
    if (!this.messageHandlers) {
      this.messageHandlers = {};
    }
    
    if (!this.messageHandlers[messageType]) {
      this.messageHandlers[messageType] = [];
    }
    
    this.messageHandlers[messageType].push(handler);
  }
  
  /**
   * Unregister a message handler for a specific message type
   * @param {string} messageType - The message type
   * @param {Function} handler - The handler function to remove
   */
  unregisterMessageHandler(messageType, handler) {
    console.log(`Unregistering handler for message type: ${messageType}`);
    
    if (!this.messageHandlers || !this.messageHandlers[messageType]) {
      return;
    }
    
    const index = this.messageHandlers[messageType].indexOf(handler);
    if (index !== -1) {
      this.messageHandlers[messageType].splice(index, 1);
    }
  }
  
  /**
   * Set a status callback function
   * @param {Function} callback - The callback function
   */
  setStatusCallback(callback) {
    this.statusCallback = callback;
  }
  
  /**
   * Join a battle royale
   * @param {string} battleRoyaleId - The ID of the battle royale to join
   */
  joinBattleRoyale(battleRoyaleId) {
    if (!this.connected || !this.socket) {
      console.error('Cannot join battle royale: Not connected to server');
      return;
    }
    
    console.log('Joining battle royale:', battleRoyaleId);
    
    this.sendMessage({
      type: 'joinBattleRoyale',
      battleRoyaleId
    });
  }
  
  /**
   * Debug method to show detailed information about other players
   * Can be called from browser console: window.webSocketManager.debugPlayers()
   */
  debugPlayers() {
    console.log('===== PLAYER DEBUG INFO =====');
    console.log('Current player ID:', this.playerId);
    console.log('Current game mode:', window.game?.gameMode);
    console.log('Current tournament:', this._currentTournament);
    console.log('Other players count:', Object.keys(this.otherPlayers).length);
    
    if (Object.keys(this.otherPlayers).length > 0) {
      console.log('Other players details:');
      Object.values(this.otherPlayers).forEach(player => {
        console.log(`- Player ${player.id}:`);
        console.log(`  Class: ${player.class || player.characterClass}`);
        console.log(`  Position:`, player.position);
        console.log(`  Health: ${player.health}/${player.stats?.health}`);
      });
    } else {
      console.log('No other players stored in WebSocketManager');
    }
    
    // Check EntityManager if available
    if (window.game?.entityManager) {
      const entities = window.game.entityManager.getEntitiesByType('otherPlayer');
      console.log('Entity Manager - Other players count:', entities.length);
      
      if (entities.length > 0) {
        console.log('Entity Manager - Other players details:');
        entities.forEach(entity => {
          console.log(`- Entity ${entity.id}:`);
          console.log(`  Type: ${entity.type}`);
          console.log(`  Class: ${entity.classType}`);
          console.log(`  Position:`, entity.position);
          console.log(`  Mesh visible:`, entity.mesh?.visible);
          console.log(`  Health: ${entity.health}/${entity.stats?.health}`);
        });
      } else {
        console.log('No other player entities in EntityManager');
      }
    }
    
    console.log('===== END PLAYER DEBUG INFO =====');
    
    return {
      currentPlayerID: this.playerId,
      otherPlayerCount: Object.keys(this.otherPlayers).length,
      otherPlayerIDs: Object.keys(this.otherPlayers),
      entityCount: window.game?.entityManager ? 
                  window.game.entityManager.getEntitiesByType('otherPlayer').length : 
                  'EntityManager not available'
    };
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
}

// Create and export singleton instance
const webSocketManager = new WebSocketManager();
export default webSocketManager; 