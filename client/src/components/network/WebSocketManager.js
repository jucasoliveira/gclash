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
        
        // Set up event handlers
        this.socket.onopen = () => {
          console.log('Connected to server');
          this.connected = true;
          resolve();
        };
        
        this.socket.onclose = () => {
          console.log('Disconnected from server');
          this.connected = false;
        };
        
        this.socket.onerror = (error) => {
          console.error('Server error:', error);
          reject(error);
        };
        
        this.socket.onmessage = this.handleMessage;
      } catch (error) {
        console.error('Error connecting to server:', error);
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
          
          // Notify about player attack
          eventBus.emit('network.playerAttacked', {
            id: message.id,
            targetId: message.targetId,
            damage: message.damage,
            attackType: message.attackType
          });
          
          // If we are the target, handle damage
          if (message.targetId === this.playerId) {
            console.log('We are the target of attack');
            
            // Apply damage directly to player
            if (window.game && window.game.player) {
              window.game.player.takeDamage(message.damage, true);
            }
          }
          break;
          
        case 'playerHealthChanged':
          console.log('Player health changed:', message);
          
          // Update stored health
          if (message.id && this.otherPlayers[message.id]) {
            this.otherPlayers[message.id].health = message.health;
          }
          
          // Notify about health change
          eventBus.emit('network.playerHealthChanged', {
            id: message.id,
            health: message.health,
            maxHealth: message.maxHealth,
            damage: message.damage
          });
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
    
    // Store player data
    this.playerData = {
      ...playerData,
      id: this.playerId
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
    console.log('Sending attack:', attackData);
    
    // Send attack
    this.sendMessage({
      type: 'playerAttack',
      targetId: attackData.targetId,
      damage: attackData.damage,
      attackType: attackData.attackType
    });
    
    // Emit local event for visualization
    eventBus.emit('network.playerAttacked', {
      id: this.playerId,
      ...attackData
    });
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
}

// Create and export singleton instance
const webSocketManager = new WebSocketManager();
export default webSocketManager; 