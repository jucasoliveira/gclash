import eventBus from '../core/EventBus.js';

/**
 * WebSocketManager - Simple WebSocket implementation for multiplayer communication
 */
class WebSocketManager {
  constructor() {
    // Connection state
    this.socket = null;
    this.playerId = null;
    this.connected = false;
    this.playerData = null;
    this.otherPlayers = {};
    
    // Bind methods
    this.connect = this.connect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
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
        console.log(`Connecting to server at ${serverUrl}`);
        
        // Create WebSocket connection
        this.socket = new WebSocket(serverUrl);
        
        // Set up event handlers with proper binding
        this.socket.onopen = () => {
          console.log('Connected to server');
          this.connected = true;
          resolve();
        };
        
        this.socket.onclose = () => {
          console.log('Disconnected from server');
          this.connected = false;
          
          // If we were previously connected, emit a disconnected event
          if (this.connected) {
            eventBus.emit('network.disconnected');
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('Server error:', error);
          this.connected = false;
          reject(error);
        };
        
        // Make sure to bind the message handler to this instance
        this.socket.onmessage = this.handleMessage.bind(this);
        
        // Set a connection timeout
        const timeout = setTimeout(() => {
          if (!this.connected) {
            console.error('Connection timeout');
            this.socket.close();
            reject(new Error('Connection timeout'));
          }
        }, 5000);
        
        // Clear timeout when connected
        this.socket.addEventListener('open', () => {
          clearTimeout(timeout);
        });
      } catch (error) {
        console.error('Error connecting to server:', error);
        this.connected = false;
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
      console.log('Received message:', message.type);
      
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
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }
  
  /**
   * Send a message to the server
   * @param {Object} message - The message to send
   */
  sendMessage(message) {
    if (this.socket && this.connected) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: not connected');
    }
  }
  
  /**
   * Join the game with player data
   * @param {Object} playerData - The player data
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
}

// Create and export singleton instance
const webSocketManager = new WebSocketManager();
export default webSocketManager; 