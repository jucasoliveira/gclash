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