import eventBus from '../core/EventBus.js';

/**
 * WebRTCManager - Simple WebRTC implementation for peer-to-peer communication
 */
class WebRTCManager {
  constructor() {
    // Connection state
    this.signaling = null;
    this.playerId = null;
    this.peers = {};
    this.connected = false;
    this.playerData = null;
    
    // Bind methods
    this.connect = this.connect.bind(this);
    this.handleSignalingMessage = this.handleSignalingMessage.bind(this);
  }
  
  /**
   * Connect to the signaling server
   * @param {string} serverUrl - The signaling server URL
   * @returns {Promise} - Resolves when connected
   */
  connect(serverUrl = 'ws://localhost:3000') {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Connecting to signaling server at ${serverUrl}`);
        
        // Create WebSocket connection
        this.signaling = new WebSocket(serverUrl);
        
        // Set up event handlers
        this.signaling.onopen = () => {
          console.log('Connected to signaling server');
          this.connected = true;
          resolve();
        };
        
        this.signaling.onclose = () => {
          console.log('Disconnected from signaling server');
          this.connected = false;
        };
        
        this.signaling.onerror = (error) => {
          console.error('Signaling server error:', error);
          reject(error);
        };
        
        this.signaling.onmessage = this.handleSignalingMessage;
      } catch (error) {
        console.error('Error connecting to signaling server:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Handle messages from the signaling server
   * @param {MessageEvent} event - The message event
   */
  handleSignalingMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('Received signaling message:', message.type);
      
      switch (message.type) {
        case 'id':
          this.playerId = message.id;
          console.log('Assigned ID:', this.playerId);
          
          // If we have player data, send it now
          if (this.playerData) {
            this.joinGame(this.playerData);
          }
          break;
          
        case 'newPlayer':
          console.log('New player joined:', message.id);
          this.createPeerConnection(message.id, true);
          break;
          
        case 'playerJoined':
          console.log('Player joined with data:', message.player);
          eventBus.emit('network.playerJoined', message.player);
          this.createPeerConnection(message.player.id, true);
          break;
          
        case 'signal':
          console.log('Received signal from:', message.id);
          
          // Create peer if it doesn't exist
          if (!this.peers[message.id]) {
            this.createPeerConnection(message.id, false);
          }
          
          // Apply the signal
          if (this.peers[message.id]) {
            this.peers[message.id].signal(message.signal);
          }
          break;
          
        case 'existingPlayers':
          console.log('Received existing players:', message.players);
          
          // Notify about existing players
          if (message.players && message.players.length > 0) {
            eventBus.emit('network.existingPlayers', message.players);
            
            // Create peer connections to all existing players
            message.players.forEach(player => {
              this.createPeerConnection(player.id, true);
            });
          }
          break;
          
        case 'playerLeft':
          console.log('Player left:', message.id);
          
          // Clean up peer connection
          if (this.peers[message.id]) {
            this.peers[message.id].destroy();
            delete this.peers[message.id];
          }
          
          // Notify about player leaving
          eventBus.emit('network.playerLeft', { id: message.id });
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  }
  
  /**
   * Create a WebRTC peer connection
   * @param {string} peerId - The ID of the peer
   * @param {boolean} initiator - Whether this peer is the initiator
   */
  createPeerConnection(peerId, initiator) {
    // Skip if peer already exists
    if (this.peers[peerId]) {
      console.log(`Peer ${peerId} already exists`);
      return;
    }
    
    console.log(`Creating ${initiator ? 'initiator' : 'receiver'} peer for ${peerId}`);
    
    try {
      // Create peer
      const peer = new SimplePeer({
        initiator,
        trickle: false,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });
      
      // Store peer
      this.peers[peerId] = peer;
      
      // Handle signal event
      peer.on('signal', signal => {
        console.log(`Generated signal for peer ${peerId}`);
        
        // Send signal to the signaling server
        this.sendToSignaling({
          type: 'signal',
          to: peerId,
          signal
        });
      });
      
      // Handle connect event
      peer.on('connect', () => {
        console.log(`Connected to peer ${peerId}`);
        
        // Send a test message
        this.sendToPeer(peerId, {
          type: 'hello',
          message: `Hello from ${this.playerId}`
        });
        
        // Send player data
        if (this.playerData) {
          this.sendToPeer(peerId, {
            type: 'playerData',
            ...this.playerData
          });
        }
      });
      
      // Handle data event
      peer.on('data', data => {
        try {
          const message = JSON.parse(data.toString());
          this.handlePeerMessage(peerId, message);
        } catch (error) {
          console.error('Error parsing peer message:', error);
        }
      });
      
      // Handle error event
      peer.on('error', error => {
        console.error(`Peer ${peerId} error:`, error);
      });
      
      // Handle close event
      peer.on('close', () => {
        console.log(`Peer ${peerId} closed`);
        delete this.peers[peerId];
        eventBus.emit('network.playerLeft', { id: peerId });
      });
    } catch (error) {
      console.error(`Error creating peer ${peerId}:`, error);
    }
  }
  
  /**
   * Handle messages from peers
   * @param {string} peerId - The ID of the peer
   * @param {Object} message - The message
   */
  handlePeerMessage(peerId, message) {
    // Skip logging for position updates to reduce spam
    if (message.type !== 'position') {
      console.log(`Received peer message (${message.type}) from ${peerId}`);
    }
    
    switch (message.type) {
      case 'hello':
        console.log(`Received hello from ${peerId}: ${message.message}`);
        break;
        
      case 'playerData':
        console.log(`Received player data from ${peerId}`);
        eventBus.emit('network.playerJoined', {
          id: peerId,
          ...message
        });
        break;
        
      case 'position':
        // Update player position
        eventBus.emit('network.playerMoved', {
          id: peerId,
          position: message.position
        });
        break;
        
      case 'attack':
        console.log(`Received attack from ${peerId} targeting ${message.targetId}`);
        
        // Emit attack event
        eventBus.emit('network.playerAttacked', {
          id: peerId,
          targetId: message.targetId,
          damage: message.damage,
          attackType: message.attackType
        });
        
        // If we are the target, handle damage
        if (message.targetId === this.playerId) {
          console.log(`We are the target of attack from ${peerId}`);
          
          // Apply damage directly to player
          if (window.game && window.game.player) {
            window.game.player.takeDamage(message.damage, true);
          }
          
          // Show damage in UI
          if (window.updateHealthUI && window.game && window.game.player) {
            const health = window.game.player.health;
            const maxHealth = window.game.player.stats.health;
            window.updateHealthUI(health, maxHealth);
          }
          
          // Check if player died
          if (window.game && window.game.player && window.game.player.health <= 0) {
            // Show death screen
            if (window.showDeathScreen) {
              window.showDeathScreen(peerId);
            }
            
            // Notify attacker
            this.sendToPeer(peerId, {
              type: 'death',
              attackerId: peerId
            });
          }
        }
        break;
        
      case 'death':
        console.log(`Player ${peerId} died`);
        eventBus.emit('network.playerDied', {
          id: peerId,
          attackerId: message.attackerId
        });
        break;
        
      case 'respawn':
        console.log(`Player ${peerId} respawned`);
        eventBus.emit('network.playerRespawned', {
          id: peerId,
          position: message.position,
          health: message.health,
          maxHealth: message.maxHealth
        });
        break;
    }
  }
  
  /**
   * Send a message to the signaling server
   * @param {Object} message - The message to send
   */
  sendToSignaling(message) {
    if (this.signaling && this.connected) {
      this.signaling.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send to signaling server: not connected');
    }
  }
  
  /**
   * Send a message to a specific peer
   * @param {string} peerId - The ID of the peer
   * @param {Object} message - The message to send
   */
  sendToPeer(peerId, message) {
    const peer = this.peers[peerId];
    
    if (peer && peer.connected) {
      try {
        peer.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending to peer ${peerId}:`, error);
      }
    } else {
      console.warn(`Cannot send to peer ${peerId}: not connected`);
    }
  }
  
  /**
   * Broadcast a message to all peers
   * @param {Object} message - The message to send
   */
  broadcast(message) {
    Object.keys(this.peers).forEach(peerId => {
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
    this.playerData = playerData;
    
    // Send join message to signaling server
    this.sendToSignaling({
      type: 'join',
      playerData: {
        ...playerData,
        id: this.playerId
      }
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
    
    // Broadcast position to all peers
    this.broadcast({
      type: 'position',
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
    
    // Send attack to target peer
    if (this.peers[attackData.targetId]) {
      this.sendToPeer(attackData.targetId, {
        type: 'attack',
        targetId: attackData.targetId,
        damage: attackData.damage,
        attackType: attackData.attackType
      });
    } else {
      // Broadcast to all peers if target peer not found
      this.broadcast({
        type: 'attack',
        targetId: attackData.targetId,
        damage: attackData.damage,
        attackType: attackData.attackType
      });
    }
    
    // Emit local event for visualization
    eventBus.emit('network.playerAttacked', {
      id: this.playerId,
      ...attackData
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
    this.broadcast({
      type: 'respawn',
      ...respawnData
    });
    
    // Update local player data
    if (this.playerData) {
      this.playerData.position = respawnData.position;
    }
  }
  
  /**
   * Disconnect from the signaling server and peers
   */
  disconnect() {
    // Destroy all peer connections
    Object.values(this.peers).forEach(peer => {
      if (peer && typeof peer.destroy === 'function') {
        peer.destroy();
      }
    });
    
    // Clear peers
    this.peers = {};
    
    // Close signaling connection
    if (this.signaling) {
      this.signaling.close();
      this.signaling = null;
    }
    
    this.connected = false;
  }
  
  /**
   * Set up configuration
   * @param {Object} config - Configuration object
   */
  configure(config = {}) {
    if (config.serverUrl) {
      this.serverUrl = config.serverUrl;
    }
    
    console.log('WebRTCManager configured');
    return this;
  }
  
  /**
   * Update player health
   * @param {Object} healthData - The health data
   */
  updateHealth(healthData) {
    console.log('Updating health:', healthData);
    
    // Broadcast health change to all peers
    this.broadcast({
      type: 'healthChange',
      health: healthData.health,
      maxHealth: healthData.maxHealth,
      damage: healthData.damage
    });
  }
}

// Create and export singleton instance
const webRTCManager = new WebRTCManager();
export default webRTCManager; 