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
   * Handle messages from the server
   * @param {MessageEvent} event - The message event
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('Received WebSocket message:', message.type, message);
      
      // Emit the raw message for other components to use
      eventBus.emit('websocket.message', message);
      
      // Process message based on type
      switch (message.type) {
        case 'id':
          this.playerId = message.id;
          console.log('Assigned ID:', this.playerId);
          
          // Emit ID assigned event
          eventBus.emit('network.idAssigned', this.playerId);
          
          // If we have player data, send it now
          if (this.playerData) {
            this.joinGame(this.playerData);
          }
          break;
          
        case 'joined':
          console.log('Joined game with ID:', message.id);
          
          // Store player data
          this.playerId = message.id;
          this._hasJoined = true;
          this._connectionStatus = 'joined';
          
          // Store player properties
          if (message.username) this._username = message.username;
          if (message.characterClass) this._characterClass = message.characterClass;
          if (message.stats) this._stats = message.stats;
          
          // If we have a tournament ID, store it
          if (message.currentTournament) {
            console.log('Player is in tournament:', message.currentTournament);
            this._currentTournament = {
              id: message.currentTournament
            };
          }
          
          // Emit joined event
          eventBus.emit('network.joined', {
            id: this.playerId,
            username: this._username,
            characterClass: this._characterClass,
            stats: this._stats,
            currentTournament: message.currentTournament
          });
          
          // Update UI if we have a status callback
          if (this.statusCallback) {
            this.statusCallback({
              status: 'joined',
              playerId: this.playerId,
              username: this._username,
              characterClass: this._characterClass,
              stats: this._stats,
              currentTournament: message.currentTournament
            });
          }
          break;
          
        case 'existingPlayers':
          console.log('Received existing players:', message.players);
          
          // Store other players
          if (message.players && Array.isArray(message.players)) {
            message.players.forEach(player => {
              if (player.id !== this.playerId) {
                this.otherPlayers[player.id] = player;
              }
            });
            
            // Notify about existing players
            eventBus.emit('network.existingPlayers', message.players);
          }
          break;
          
        case 'playerJoined':
          console.log('Player joined:', message.player);
          
          // Store player data
          if (message.player && message.player.id !== this.playerId) {
            this.otherPlayers[message.player.id] = message.player;
            
            // Notify about new player
            eventBus.emit('network.playerJoined', message.player);
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
          
          // Determine if attack should be processed
          // If inRange is explicitly false, it's a miss
          // Otherwise assume it's a hit (for backward compatibility and robustness)
          const shouldProcessAttack = message.inRange !== false;
          message.inRange = shouldProcessAttack; // Normalize for consistency
          
          console.log(`Processing attack: ${shouldProcessAttack ? 'YES' : 'NO'} - inRange: ${message.inRange}`);
          
          // Notify about player attack with all relevant details
          eventBus.emit('network.playerAttacked', {
            id: message.id,
            targetId: message.targetId,
            damage: message.damage,
            attackType: message.attackType,
            attackId: message.attackId || `legacy-${Date.now()}`,
            inRange: message.inRange,
            distance: message.distance || 0
          });
          
          // If we are the target and the attack should be processed, handle damage
          if (message.targetId === this.playerId && shouldProcessAttack) {
            console.log('We are the target of attack - applying damage');
            
            // Apply damage directly to player
            if (window.game && window.game.player) {
              window.game.player.takeDamage(message.damage, true);
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
          
          // Update stored health for other players
          if (message.id && message.id !== this.playerId && this.otherPlayers[message.id]) {
            console.log(`Updating stored health for player ${message.id}: ${message.health}/${message.maxHealth}`);
            this.otherPlayers[message.id].health = message.health;
            
            // Also update maxHealth if provided
            if (message.maxHealth) {
              this.otherPlayers[message.id].maxHealth = message.maxHealth;
              
              // Update stats if they exist
              if (this.otherPlayers[message.id].stats) {
                this.otherPlayers[message.id].stats.health = message.maxHealth;
              }
            }
          }
          
          // Notify about health change with all details
          eventBus.emit('network.playerHealthChanged', {
            id: message.id,
            health: message.health,
            maxHealth: message.maxHealth,
            damage: message.damage || 0,
            attackerId: message.attackerId
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
              
              // If we took damage, play damage effect
              if (message.damage && message.damage > 0 && typeof window.game.player._playDamageEffect === 'function') {
                window.game.player._playDamageEffect();
              }
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
      
      // Call registered message handlers
      if (this.messageHandlers && this.messageHandlers[message.type]) {
        this.messageHandlers[message.type].forEach(handler => {
          try {
            handler(message);
          } catch (handlerError) {
            console.error(`Error in message handler for ${message.type}:`, handlerError);
          }
        });
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }
  
  /**
   * Send a message to the server
   * @param {Object} message - The message to send
   */
  sendMessage(message) {
    if (!this.socket || !this.connected) {
      console.error('Cannot send message: Not connected to server');
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
   * Join the game with player data
   * @param {Object} playerData - Player data
   */
  joinGame(playerData) {
    console.log('Joining game with player data:', playerData);
    
    // Get authentication data from localStorage
    let authData = null;
    try {
      const userData = localStorage.getItem('guildClashUser');
      if (userData) {
        authData = JSON.parse(userData);
        console.log('Including authentication data for user:', authData.username);
      }
    } catch (error) {
      console.error('Error parsing authentication data:', error);
    }
    
    // Store player data
    this.playerData = {
      ...playerData,
      id: this.playerId,
      auth: authData ? {
        userId: authData.id,
        username: authData.username
      } : null
    };
    
    // Make sure characterClass is set (for backward compatibility)
    if (!this.playerData.characterClass && this.playerData.class) {
      this.playerData.characterClass = this.playerData.class;
    }
    
    // Send join message
    this.sendMessage({
      type: 'join',
      playerData: this.playerData
    });
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
   * @param {Object} healthData - The health data
   */
  updateHealth(healthData) {
    console.log('Updating health:', healthData);
    
    // Send health update
    this.sendMessage({
      type: 'playerHealthChange',
      health: healthData.health,
      maxHealth: healthData.maxHealth,
      damage: healthData.damage
    });
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
}

// Create and export singleton instance
const webSocketManager = new WebSocketManager();
export default webSocketManager; 