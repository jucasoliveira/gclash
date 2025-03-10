import { io } from 'socket.io-client';
import eventBus from '../core/EventBus.js';

/**
 * NetworkManager - Handles Socket.io connections and events
 * Manages the connection to the server and provides an API for sending and receiving messages
 */
class NetworkManager {
  constructor() {
    this.socket = null;
    this.serverUrl = 'http://localhost:3000';
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.playerData = null;
    
    // Binding methods
    this.connect = this.connect.bind(this);
    this.handleConnect = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleReconnectAttempt = this.handleReconnectAttempt.bind(this);
    this.handleReconnectFailed = this.handleReconnectFailed.bind(this);
  }

  /**
   * Set up configuration
   * @param {Object} config - Configuration object
   */
  configure(config = {}) {
    if (config.serverUrl) {
      this.serverUrl = config.serverUrl;
    }
    
    if (config.maxReconnectAttempts !== undefined) {
      this.maxReconnectAttempts = config.maxReconnectAttempts;
    }
    
    if (config.reconnectDelay !== undefined) {
      this.reconnectDelay = config.reconnectDelay;
    }
    
    return this;
  }

  /**
   * Connect to the server
   * @returns {Promise} - Resolves when connected, rejects on error
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve(this.socket);
        return;
      }
      
      // Set up temporary event handlers for connection
      const onConnect = () => {
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
        resolve(this.socket);
      };
      
      const onError = (error) => {
        if (!this.socket) return;
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
        reject(error);
      };
      
      // Create socket if it doesn't exist
      if (!this.socket) {
        this.socket = io(this.serverUrl, {
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          autoConnect: false
        });
        
        // Set up standard event handlers
        this.setupEventListeners();
      }
      
      // Register temporary handlers for this connection attempt
      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onError);
      
      // Connect
      this.socket.connect();
    });
  }

  /**
   * Set up event listeners for the socket
   */
  setupEventListeners() {
    if (!this.socket) return;
    
    // Connection events
    this.socket.on('connect', this.handleConnect);
    this.socket.on('disconnect', this.handleDisconnect);
    this.socket.on('connect_error', this.handleError);
    this.socket.io.on('reconnect_attempt', this.handleReconnectAttempt);
    this.socket.io.on('reconnect_failed', this.handleReconnectFailed);
    
    // Game events
    this.socket.on('existingPlayers', (players) => {
      eventBus.emit('network.existingPlayers', players);
    });
    
    this.socket.on('playerJoined', (playerData) => {
      eventBus.emit('network.playerJoined', playerData);
    });
    
    this.socket.on('playerMoved', (moveData) => {
      eventBus.emit('network.playerMoved', moveData);
    });
    
    this.socket.on('playerLeft', (data) => {
      eventBus.emit('network.playerLeft', data);
    });
    
    this.socket.on('playerAttacked', (attackData) => {
      eventBus.emit('network.playerAttacked', attackData);
      
      // Log all attack events clearly
      console.log(`NETWORK: Attack event received - ${attackData.id} attacked ${attackData.targetId} for ${attackData.damage} damage`);
    });
    
    this.socket.on('playerHealthChanged', (healthData) => {
      console.log(`NETWORK: Health change event received - Player ${healthData.id} health now ${healthData.health}/${healthData.maxHealth}`);
      
      // Check if this is for our player ID
      if (this.socket && this.socket.id === healthData.id) {
        console.log(`NETWORK: This health change is for the local player!`);
        
        // CRITICAL: Direct DOM update for player health bar
        const healthFill = document.getElementById('health-fill');
        const playerStats = document.getElementById('player-stats');
        
        if (healthFill) {
          // Calculate percentage
          const percentage = Math.max(0, Math.min(100, (healthData.health / healthData.maxHealth) * 100));
          
          // Force immediate update without transition
          healthFill.style.transition = 'none';
          healthFill.style.width = `${percentage}%`;
          healthFill.offsetHeight; // Force reflow
          
          // Set color based on health percentage
          if (percentage > 60) {
            healthFill.style.backgroundColor = '#2ecc71'; // Green for high health
          } else if (percentage > 30) {
            healthFill.style.backgroundColor = '#f39c12'; // Orange for medium health
          } else {
            healthFill.style.backgroundColor = '#e74c3c'; // Red for low health
          }
          
          console.log(`DIRECT NETWORK UI UPDATE: Set health bar to ${percentage}%`);
          
          // Re-enable transition after a small delay
          setTimeout(() => {
            healthFill.style.transition = 'width 0.3s ease-out, background-color 0.3s ease-out';
          }, 50);
        }
        
        if (playerStats) {
          playerStats.textContent = `Health: ${Math.round(healthData.health)}/${healthData.maxHealth}`;
        }
        
        // Make game UI visible if it's not
        const gameUI = document.getElementById('game-ui');
        if (gameUI && !gameUI.classList.contains('visible')) {
          gameUI.classList.add('visible');
        }
        
        // CRITICAL: Use global DOM update function if available
        if (window.updateHealthUI) {
          console.log('NETWORK: Calling global updateHealthUI function');
          window.updateHealthUI(healthData.health, healthData.maxHealth);
        }
        
        // Also dispatch a custom DOM event
        const healthUpdateEvent = new CustomEvent('socket-health-update', {
          detail: {
            id: healthData.id,
            health: healthData.health,
            maxHealth: healthData.maxHealth
          }
        });
        document.dispatchEvent(healthUpdateEvent);
      }
      
      // Emit the event for the EntityManager to handle
      eventBus.emit('network.playerHealthChanged', healthData);
    });
    
    this.socket.on('playerDied', (deathData) => {
      console.log(`NETWORK: Death event received - Player ${deathData.id} died`);
      
      // Check if this is for our player ID
      if (this.socket && this.socket.id === deathData.id) {
        console.log(`NETWORK: Local player death event received!`);
        
        // CRITICAL: Direct DOM update for health to zero
        const healthFill = document.getElementById('health-fill');
        const playerStats = document.getElementById('player-stats');
        
        if (healthFill) {
          // Force immediate update to zero health
          healthFill.style.transition = 'none';
          healthFill.style.width = '0%';
          healthFill.style.backgroundColor = '#e74c3c'; // Red
          healthFill.offsetHeight; // Force reflow
        }
        
        if (playerStats) {
          playerStats.textContent = `Health: 0/100`;
        }
        
        // CRITICAL: Show death screen using global function
        if (window.showDeathScreen) {
          console.log('NETWORK: Calling global showDeathScreen function');
          window.showDeathScreen(deathData.attackerId);
        }
        
        // Also dispatch a DOM event
        const deathEvent = new CustomEvent('player-died', {
          detail: {
            id: deathData.id,
            attackerId: deathData.attackerId
          }
        });
        document.dispatchEvent(deathEvent);
        
        // Find player object through EntityManager and hide its mesh
        eventBus.emit('entityManager.getPlayerByID', {
          id: deathData.id,
          callback: (player) => {
            if (player && player.mesh) {
              console.log('CRITICAL: Hiding player mesh directly on death event');
              player.mesh.visible = false;
              
              // Set health to zero
              player.health = 0;
            }
          }
        });
      }
      
      eventBus.emit('network.playerDied', deathData);
    });
    
    this.socket.on('playerRespawned', (respawnData) => {
      console.log(`NETWORK: Respawn event received - Player ${respawnData.id} respawned with health ${respawnData.health}`);
      
      // Special handling for local player respawn
      if (this.socket && respawnData.id === this.socket.id) {
        console.log('NETWORK: This is our own respawn event');
        
        // Update health UI 
        if (window.updateHealthUI) {
          window.updateHealthUI(respawnData.health, respawnData.maxHealth || 100);
        }
        
        // Also update the DOM directly
        const healthFill = document.getElementById('health-fill');
        const playerStats = document.getElementById('player-stats');
        
        if (healthFill) {
          healthFill.style.transition = 'none';
          healthFill.style.width = '100%';
          healthFill.style.backgroundColor = '#2ecc71';
          healthFill.offsetHeight; // Force reflow
          
          // Restore transition after a brief delay
          setTimeout(() => {
            healthFill.style.transition = 'width 0.3s ease-out, background-color 0.3s ease-out';
          }, 50);
        }
        
        if (playerStats) {
          playerStats.textContent = `Health: ${respawnData.health}/${respawnData.maxHealth || 100}`;
        }
      }
      
      // Emit the event for EntityManager to handle
      eventBus.emit('network.playerRespawned', respawnData);
    });
  }

  /**
   * Handle successful connection
   */
  handleConnect() {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    console.log('Connected to server!', this.socket.id);
    
    eventBus.emit('network.connected', { id: this.socket.id });
    
    // Send player join if we have player data
    if (this.playerData) {
      this.emit('playerJoin', this.playerData);
    }
  }

  /**
   * Handle disconnection
   * @param {string} reason - Reason for disconnection
   */
  handleDisconnect(reason) {
    this.isConnected = false;
    console.log('Disconnected from server:', reason);
    
    eventBus.emit('network.disconnected', { reason });
  }

  /**
   * Handle connection error
   * @param {Error} error - Connection error
   */
  handleError(error) {
    console.error('Connection error:', error);
    eventBus.emit('network.error', { error });
  }

  /**
   * Handle reconnection attempt
   * @param {number} attempt - Attempt number
   */
  handleReconnectAttempt(attempt) {
    this.reconnectAttempts = attempt;
    console.log(`Reconnection attempt ${attempt}/${this.maxReconnectAttempts}`);
    
    eventBus.emit('network.reconnectAttempt', { 
      attempt, 
      max: this.maxReconnectAttempts 
    });
  }

  /**
   * Handle failed reconnection
   */
  handleReconnectFailed() {
    console.error('Failed to reconnect to server');
    eventBus.emit('network.reconnectFailed');
  }

  /**
   * Set player data for joining
   * @param {Object} playerData - Player data
   */
  setPlayerData(playerData) {
    this.playerData = playerData;
    
    // If already connected, send join event
    if (this.isConnected && this.socket) {
      this.emit('playerJoin', playerData);
    }
  }

  /**
   * Emit an event to the server
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @returns {boolean} - Whether the event was sent
   */
  emit(event, data) {
    if (!this.isConnected || !this.socket) {
      console.warn(`Cannot emit ${event}: not connected`);
      return false;
    }
    
    this.socket.emit(event, data);
    return true;
  }

  /**
   * Send player movement
   * @param {Object} position - Position data {x, y, z}
   * @returns {boolean} - Whether the event was sent
   */
  sendPlayerMove(position) {
    return this.emit('playerMove', { position });
  }
  
  /**
   * Send player attack
   * @param {Object} attackData - Attack data
   * @returns {boolean} - Whether the event was sent
   */
  sendPlayerAttack(attackData) {
    return this.emit('playerAttack', attackData);
  }
  
  /**
   * Send player health change
   * @param {Object} healthData - Health data
   * @returns {boolean} - Whether the event was sent
   */
  sendPlayerHealthChange(healthData) {
    return this.emit('playerHealthChange', healthData);
  }
  
  /**
   * Send player death
   * @param {Object} deathData - Death data
   * @returns {boolean} - Whether the event was sent
   */
  sendPlayerDeath(deathData) {
    return this.emit('playerDeath', deathData);
  }
  
  /**
   * Send player respawn
   * @param {Object} respawnData - Respawn data with new position
   * @returns {boolean} - Whether the event was sent
   */
  sendPlayerRespawn(respawnData) {
    return this.emit('playerRespawn', respawnData);
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.disconnect();
    
    if (this.socket) {
      this.socket.off();
      this.socket.io.off('reconnect_attempt');
      this.socket.io.off('reconnect_failed');
      this.socket = null;
    }
    
    this.isConnected = false;
  }
}

// Create singleton instance
const networkManager = new NetworkManager();

export default networkManager;