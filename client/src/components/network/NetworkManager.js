import eventBus from '../core/EventBus.js';

/**
 * NetworkManager - Handles WebRTC connections and WebSocket signaling
 * Manages peer-to-peer connections and provides an API for sending and receiving messages
 */
class NetworkManager {
  constructor() {
    this.ws = null;
    this.serverUrl = 'ws://localhost:3000';
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.playerData = null;
    this.playerId = null;
    this.peers = {}; // Store peer connections by player ID
    this.otherPlayers = {}; // Store other player data
    
    // Binding methods
    this.connect = this.connect.bind(this);
    this.handleConnect = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleError = this.handleError.bind(this);
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
    
    if (config.maxReconnectAttempts !== undefined) {
      this.maxReconnectAttempts = config.maxReconnectAttempts;
    }
    
    if (config.reconnectDelay !== undefined) {
      this.reconnectDelay = config.reconnectDelay;
    }
    
    return this;
  }

  /**
   * Connect to the signaling server
   * @returns {Promise} - Resolves when connected, rejects on error
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }
      
      try {
        console.log(`Connecting to signaling server at ${this.serverUrl}...`);
        
        this.ws = new WebSocket(this.serverUrl);
        
        // Set up event handlers
        this.ws.onopen = () => {
          this.handleConnect();
          resolve();
        };
        
        this.ws.onclose = this.handleDisconnect;
        this.ws.onerror = (error) => {
          this.handleError(error);
        reject(error);
      };
        
        this.ws.onmessage = this.handleMessage;
      } catch (error) {
        console.error('Error connecting to signaling server:', error);
        this.handleError(error);
        reject(error);
      }
    });
  }

  /**
   * Handle connection to the signaling server
   */
  handleConnect() {
    console.log('Connected to signaling server');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    eventBus.emit('network.connected');
  }

  /**
   * Handle disconnection from the signaling server
   */
  handleDisconnect() {
    console.log('Disconnected from signaling server');
    this.isConnected = false;
    
    // Clean up peer connections
    Object.values(this.peers).forEach(peer => {
      if (peer && typeof peer.destroy === 'function') {
        peer.destroy();
      }
    });
    
    this.peers = {};
    
    // Attempt to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      eventBus.emit('network.reconnectFailed');
    }
    
    eventBus.emit('network.disconnected');
  }

  /**
   * Handle WebSocket errors
   * @param {Error} error - The error object
   */
  handleError(error) {
    console.error('WebSocket error:', error);
    eventBus.emit('network.error', { error });
  }

  /**
   * Handle incoming WebSocket messages from the server
   * @param {MessageEvent} event - The message event
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      console.log('Received server message:', data.type);
      
      switch (data.type) {
        case 'id':
          this.playerId = data.id;
          console.log('Assigned player ID:', this.playerId);
          eventBus.emit('network.idAssigned', { id: this.playerId });
          
          // If we have player data, send it now that we have an ID
          if (this.playerData) {
            console.log('Sending player data after ID assignment');
            this.ws.send(JSON.stringify({
              type: 'join',
              playerData: {
                ...this.playerData,
                id: this.playerId
              }
            }));
          }
          break;
          
        case 'newPlayer':
          console.log('New player joined:', data.id);
          // Create a peer connection as initiator
          this.createPeer(data.id, true);
          break;
          
        case 'playerJoined':
          console.log('Player joined with data:', data.player);
          // Store player data
          this.otherPlayers[data.player.id] = data.player;
          // Create peer connection
          this.createPeer(data.player.id, true);
          // Emit event for entity manager
          eventBus.emit('network.playerJoined', data.player);
          break;
          
        case 'signal':
          console.log('Received signal from peer:', data.id);
          
          // If we don't have a peer yet, create one as non-initiator
          if (!this.peers[data.id]) {
            console.log('Creating new peer for signal as receiver');
            this.createPeer(data.id, false);
          }
          
          // Apply the signal to the peer
          if (this.peers[data.id]) {
            try {
              console.log('Applying signal to peer');
              this.peers[data.id].signal(data.signal);
            } catch (error) {
              console.error('Error applying signal:', error);
            }
          } else {
            console.error('Cannot apply signal: peer not created');
          }
          break;
          
        case 'existingPlayers':
          console.log('Received existing players:', data.players);
          if (data.players && Array.isArray(data.players)) {
            // Store player data
            data.players.forEach(player => {
              this.otherPlayers[player.id] = player;
              
              // Create peer connections to all existing players
              console.log('Creating peer connection to existing player:', player.id);
              this.createPeer(player.id, true);
            });
            
            // Emit event for entity manager
            eventBus.emit('network.existingPlayers', data.players);
          }
          break;
          
        case 'playerLeft':
          console.log('Player left:', data.id);
          if (this.peers[data.id]) {
            console.log('Destroying peer connection for departed player');
            this.peers[data.id].destroy();
            delete this.peers[data.id];
          }
          delete this.otherPlayers[data.id];
          eventBus.emit('network.playerLeft', { id: data.id });
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing server message:', error);
    }
  }

  /**
   * Create a WebRTC peer connection
   * @param {string} peerId - The ID of the peer to connect to
   * @param {boolean} initiator - Whether this peer is the initiator
   */
  createPeer(peerId, initiator) {
    console.log(`Creating ${initiator ? 'initiator' : 'receiver'} peer for ${peerId}`);
    
    // Don't create duplicate peers
    if (this.peers[peerId]) {
      console.log(`Peer ${peerId} already exists, not creating again`);
      return;
    }
    
    // Use a global variable to ensure the Peer constructor is available
    if (!window.SimplePeer) {
      console.error('SimplePeer not available globally');
      alert('WebRTC library not loaded properly. Please refresh the page.');
      return;
    }
    
    try {
      // Create the peer with ICE servers for NAT traversal
      const peer = new window.SimplePeer({
        initiator: initiator,
        trickle: false,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });
      
      // Store the peer
      this.peers[peerId] = peer;
      
      // Handle signaling data
      peer.on('signal', signal => {
        console.log(`Generated signal for peer ${peerId}`);
        
        // Send the signal to the server
        this.ws.send(JSON.stringify({
          type: 'signal',
          to: peerId,
          signal: signal
        }));
      });
      
      // Handle successful connection
      peer.on('connect', () => {
        console.log(`Connected to peer ${peerId}!`);
        
        // Send a test message
        peer.send(JSON.stringify({
          type: 'hello',
          message: `Hello from ${this.playerId}`,
          timestamp: Date.now()
        }));
        
        // Send our player data
        if (this.playerData) {
          peer.send(JSON.stringify({
            type: 'playerData',
            position: this.playerData.position,
            class: this.playerData.class,
            stats: this.playerData.stats
          }));
        }
      });
      
      // Handle incoming data
      peer.on('data', data => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`Received data from peer ${peerId}:`, message.type);
          
          // Process the message
          this.handlePeerMessage(peerId, message);
        } catch (error) {
          console.error(`Error processing data from peer ${peerId}:`, error);
        }
      });
      
      // Handle errors
      peer.on('error', error => {
        console.error(`Peer ${peerId} error:`, error.message);
      });
      
      // Handle close
      peer.on('close', () => {
        console.log(`Peer ${peerId} connection closed`);
        delete this.peers[peerId];
        
        // Remove the player from our list
        if (this.otherPlayers[peerId]) {
          delete this.otherPlayers[peerId];
          
          // Notify the entity manager
          eventBus.emit('network.playerLeft', { id: peerId });
        }
      });
      
      return peer;
    } catch (error) {
      console.error(`Error creating peer ${peerId}:`, error);
      return null;
    }
  }

  /**
   * Handle incoming peer messages
   * @param {string} peerId - The ID of the peer that sent the message
   * @param {Object} message - The message object
   */
  handlePeerMessage(peerId, message) {
    // Skip logging for position updates to reduce console spam
    if (message.type !== 'position') {
      console.log(`Received peer message (${message.type}) from ${peerId}`);
    }
    
    switch (message.type) {
      case 'hello':
        console.log(`Received hello from ${peerId}: ${message.message}`);
        break;
        
      case 'ping':
        // Respond with pong
        this.sendToPeer(peerId, { type: 'pong', timestamp: message.timestamp });
        break;
        
      case 'pong':
        // Calculate round-trip time
        if (message.timestamp) {
          const rtt = Date.now() - message.timestamp;
          console.log(`Ping-pong round-trip time with ${peerId}: ${rtt}ms`);
        }
        break;
        
      case 'playerData':
        console.log(`Received player data from ${peerId}`);
        this.otherPlayers[peerId] = {
          id: peerId,
          position: message.position,
          class: message.class,
          stats: message.stats,
          type: 'otherPlayer'
        };
        
        // Emit event for entity manager
        eventBus.emit('network.playerJoined', this.otherPlayers[peerId]);
        break;
        
      case 'position':
        // Update our record of this player's position
        if (this.otherPlayers[peerId]) {
          this.otherPlayers[peerId].position = message.position;
          
          // Emit event for entity manager
          eventBus.emit('network.playerMoved', {
            id: peerId,
            position: message.position
          });
        }
        break;
        
      case 'attack':
        console.log(`Received attack from ${peerId} targeting ${message.targetId} for ${message.damage} damage`);
        
        // Emit event for entity manager
        const attackData = {
          id: peerId,
          targetId: message.targetId,
          damage: message.damage,
          attackType: message.attackType || 'unknown'
        };
        
        // If we are the target, handle the damage locally
        if (message.targetId === this.playerId) {
          console.log(`We are the target of this attack!`);
          
          // Call handleDamage
          this.handleDamage(peerId, message.damage);
          
          // Also call takeDamage directly on our player entity for immediate feedback
          if (window.game && window.game.player) {
            console.log(`Applying damage directly to player: ${message.damage}`);
            window.game.player.takeDamage(message.damage, true);
            
            // Check if player died from this attack
            if (window.game.player.health <= 0) {
              console.log(`Player died from this attack!`);
              
              // Show death screen with attacker ID
              if (window.showDeathScreen) {
                console.log(`Showing death screen with attacker: ${peerId}`);
                window.showDeathScreen(peerId);
              }
              
              // Notify attacker that they killed us
              this.sendToPeer(peerId, {
                type: 'death',
                attackerId: peerId
              });
            }
          }
        }
        
        // Emit network event for visualization
        eventBus.emit('network.playerAttacked', attackData);
        break;
        
      case 'healthChange':
        console.log(`Received health change from ${peerId}: ${message.health}/${message.maxHealth}`);
        
        // Emit event for entity manager
        eventBus.emit('network.playerHealthChanged', {
          id: peerId,
          health: message.health,
          maxHealth: message.maxHealth,
          damage: message.damage
        });
        break;
        
      case 'death':
        console.log(`Received death notification from ${peerId}`);
        
        // Emit event for entity manager
        eventBus.emit('network.playerDied', {
          id: peerId,
          attackerId: message.attackerId
        });
        break;
        
      case 'respawn':
        console.log(`Received respawn from ${peerId}`);
        
        if (this.otherPlayers[peerId]) {
          this.otherPlayers[peerId].position = message.position;
          
          // Emit event for entity manager
          eventBus.emit('network.playerRespawned', {
            id: peerId,
            position: message.position,
            health: message.health,
            maxHealth: message.maxHealth
          });
        }
        break;
        
      default:
        console.log(`Unknown peer message type: ${message.type}`);
    }
  }

  /**
   * Handle receiving damage
   * @param {string} attackerId - The ID of the attacker
   * @param {number} damage - The amount of damage
   */
  handleDamage(attackerId, damage) {
    console.log(`NETWORK: Handling damage from ${attackerId}: ${damage}`);
    
    // Ensure damage is a valid number
    damage = parseInt(damage, 10);
    if (isNaN(damage)) {
      console.error(`NETWORK: Invalid damage value:`, damage);
      return;
    }
    
    // Emit event for entity manager
    eventBus.emit('player.receivedDamage', {
      attackerId,
      damage
    });
    
    // Get our player entity
    if (!window.game || !window.game.player) {
      console.error(`NETWORK: Cannot find player entity to apply damage`);
      return;
    }
    
    const player = window.game.player;
    
    // Calculate new health
    const oldHealth = player.health || 0;
    const newHealth = Math.max(0, oldHealth - damage);
    const maxHealth = player.stats?.health || 100;
    
    console.log(`NETWORK: Health changing from ${oldHealth} to ${newHealth} (max: ${maxHealth})`);
    
    // Update the player's health value
    player.health = newHealth;
    
    // Update the HUD directly (multiple methods for redundancy)
    if (window.game.updateHealthUI) {
      window.game.updateHealthUI(newHealth, maxHealth);
    }
    
    // Update health bar directly in the DOM
    this._updateHealthBarDOM(newHealth, maxHealth);
    
    // Create a health change event for the UI
    const healthEvent = new CustomEvent('player-health-changed', {
      detail: {
        health: newHealth,
        maxHealth: maxHealth,
        damage: damage
      }
    });
    document.dispatchEvent(healthEvent);
    
    // Check if player died
    if (oldHealth > 0 && newHealth <= 0) {
      console.log(`NETWORK: Player died from damage by ${attackerId}`);
      
      // Show death screen
      if (window.showDeathScreen) {
        window.showDeathScreen(attackerId);
      }
      
      // Create a death event
      const deathEvent = new CustomEvent('player-died', {
        detail: {
          id: this.playerId,
          attackerId: attackerId
        }
      });
      document.dispatchEvent(deathEvent);
      
      // Hide player mesh if available
      if (player.mesh) {
        player.mesh.visible = false;
      }
    }
  }

  /**
   * Update health bar directly in the DOM (backup method)
   * @private
   */
  _updateHealthBarDOM(health, maxHealth) {
    // Calculate health percentage
    const percentage = Math.max(0, Math.min(100, (health / maxHealth) * 100));
    
    // Update the health bar fill element if it exists
    const healthFill = document.getElementById('health-fill');
    if (healthFill) {
      // Temporarily disable transitions for immediate update
      healthFill.style.transition = 'none';
      healthFill.style.width = `${percentage}%`;
      
      // Force a reflow to ensure the style change takes effect
      healthFill.offsetHeight;
      
      // Set color based on health percentage
      if (percentage > 60) {
        healthFill.style.backgroundColor = '#2ecc71'; // Green for high health
      } else if (percentage > 30) {
        healthFill.style.backgroundColor = '#f39c12'; // Orange for medium health
      } else {
        healthFill.style.backgroundColor = '#e74c3c'; // Red for low health
      }
      
      // Re-enable transitions
      setTimeout(() => {
        healthFill.style.transition = 'width 0.3s ease-out, background-color 0.3s ease-out';
      }, 50);
      
      console.log(`NETWORK: Updated health bar DOM to ${percentage}%`);
    }
    
    // Update player stats text if it exists
    const playerStats = document.getElementById('player-stats');
    if (playerStats) {
      playerStats.textContent = `Health: ${Math.round(health)}/${maxHealth}`;
    }
  }

  /**
   * Send a message to a specific peer
   * @param {string} peerId - The ID of the peer to send to
   * @param {Object} message - The message to send
   */
  sendToPeer(peerId, message) {
    if (!this.peers[peerId]) {
      console.warn(`Cannot send to peer ${peerId}: peer not created`);
      return;
    }
    
    const peer = this.peers[peerId];
    const messageString = JSON.stringify(message);
    
    // If peer is connected, send immediately
    if (peer.connected) {
      try {
        console.log(`Sending message to peer ${peerId}:`, message.type);
        peer.send(messageString);
      } catch (error) {
        console.error(`Error sending to peer ${peerId}:`, error);
      }
    } else {
      // If peer is not yet connected, wait for connection
      console.log(`Peer ${peerId} not yet connected, queueing message:`, message.type);
      
      const onConnect = () => {
        try {
          console.log(`Sending queued message to peer ${peerId} after connect:`, message.type);
          peer.send(messageString);
          peer.off('connect', onConnect);
        } catch (error) {
          console.error(`Error sending to peer ${peerId} after connect:`, error);
        }
      };
      
      peer.once('connect', onConnect);
      
      // Set a timeout to clean up the listener if connection doesn't happen
      setTimeout(() => {
        peer.off('connect', onConnect);
      }, 10000); // 10 seconds timeout
    }
  }

  /**
   * Send a message to all connected peers
   * @param {Object} message - The message to send
   */
  broadcast(message) {
    const peerIds = Object.keys(this.peers);
    
    if (peerIds.length === 0) {
      console.log('No peers to broadcast to:', message.type);
      return;
    }
    
    console.log(`Broadcasting ${message.type} to ${peerIds.length} peers:`, peerIds);
    
    peerIds.forEach(peerId => {
      this.sendToPeer(peerId, message);
    });
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
      id: this.playerId // Include our ID if we have one
    };
    
    // If we're already connected and have an ID, send join message
    if (this.isConnected && this.playerId) {
      console.log('Already connected, sending join message with ID:', this.playerId);
      this.ws.send(JSON.stringify({
        type: 'join',
        playerData: this.playerData
      }));
    } else if (this.isConnected) {
      // We're connected but don't have an ID yet, wait for ID assignment
      console.log('Connected but waiting for ID assignment');
    } else {
      // Not connected, connect first
      console.log('Not connected, connecting first');
      this.connect().then(() => {
        console.log('Connected, waiting for ID before joining');
        // ID will be assigned and join message sent in handleMessage
      }).catch(error => {
        console.error('Failed to connect for join:', error);
        eventBus.emit('network.joinFailed', { error });
      });
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
    
    // Format the position data to ensure consistent precision
    const formattedPosition = {
      x: parseFloat(position.x.toFixed(2)),
      y: parseFloat(position.y.toFixed(2)),
      z: parseFloat(position.z.toFixed(2))
    };
    
    // Send the position update to all connected peers
    Object.keys(this.peers).forEach(peerId => {
      const peer = this.peers[peerId];
      
      if (peer && peer.connected) {
        try {
          peer.send(JSON.stringify({
            type: 'position',
            position: formattedPosition
          }));
        } catch (error) {
          console.error(`Error sending position to peer ${peerId}:`, error);
        }
      }
    });
  }

  /**
   * Send an attack
   * @param {Object} attackData - The attack data
   */
  sendAttack(attackData) {
    console.log('NETWORK: Sending attack:', attackData);
    
    // Format the attack data for consistency
    const formattedAttack = {
      type: 'attack',
      targetId: attackData.targetId,
      damage: parseInt(attackData.damage, 10),
      attackType: attackData.attackType || 'unknown'
    };
    
    // Get the target peer
    if (this.peers[attackData.targetId] && this.peers[attackData.targetId].connected) {
      // Send directly to the target peer for more reliable delivery
      console.log(`NETWORK: Sending attack directly to target peer ${attackData.targetId}`);
      this.sendToPeer(attackData.targetId, formattedAttack);
    } else {
      // If the target isn't a direct peer, broadcast to everyone
      console.log('NETWORK: Broadcasting attack to all peers');
      this.broadcast(formattedAttack);
    }
    
    // If the target is a peer, emit the attack locally too
    if (this.otherPlayers[attackData.targetId]) {
      console.log('NETWORK: Target is a peer, emitting local attack event');
      eventBus.emit('network.playerAttacked', {
        id: this.playerId,
        ...attackData
      });
    }
  }

  /**
   * Update player health
   * @param {Object} healthData - The health data
   */
  updateHealth(healthData) {
    this.broadcast({
      type: 'healthChange',
      ...healthData
    });
  }
  
  /**
   * Send player death
   * @param {Object} deathData - The death data
   */
  sendDeath(deathData) {
    this.broadcast({
      type: 'death',
      ...deathData
    });
  }
  
  /**
   * Send player respawn
   * @param {Object} respawnData - The respawn data
   */
  sendRespawn(respawnData) {
    if (this.playerData) {
      this.playerData.position = respawnData.position;
    }
    
    this.broadcast({
      type: 'respawn',
      ...respawnData
    });
  }

  /**
   * Disconnect from the server and peers
   */
  disconnect() {
    // Destroy all peer connections
    Object.values(this.peers).forEach(peer => {
      if (peer && typeof peer.destroy === 'function') {
        peer.destroy();
      }
    });
    
    this.peers = {};
    
    // Close WebSocket connection
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    
    this.isConnected = false;
    eventBus.emit('network.disconnected');
  }
}

// Create and export a singleton instance
const networkManager = new NetworkManager();
export default networkManager;