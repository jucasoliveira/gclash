import * as THREE from 'three';
import Entity from './Entity.js';
import eventBus from '../core/EventBus.js';
import networkManager from '../network/NetworkManager.js';

/**
 * Player - Represents the local player in the game
 * Extends the base Entity class with player-specific functionality
 */
class Player extends Entity {
  /**
   * Create a new player
   * @param {string} id - Unique player ID
   * @param {string} classType - Character class type (CLERK, WARRIOR, RANGER)
   * @param {Object} stats - Player stats
   */
  constructor(id, classType, stats) {
    super(id);
    
    // Player-specific properties
    this.type = 'player';
    this.classType = classType;
    this.stats = { ...stats };
    this.health = stats.health;
    this.isMoving = false;
    this.movementDirection = new THREE.Vector3();
    
    // Event bindings
    this._boundHandleMoveForward = this._handleMoveForward.bind(this);
    this._boundHandleMoveBackward = this._handleMoveBackward.bind(this);
    this._boundHandleMoveLeft = this._handleMoveLeft.bind(this);
    this._boundHandleMoveRight = this._handleMoveRight.bind(this);
    
    this._boundHandleMoveForwardEnd = this._handleMoveForwardEnd.bind(this);
    this._boundHandleMoveBackwardEnd = this._handleMoveBackwardEnd.bind(this);
    this._boundHandleMoveLeftEnd = this._handleMoveLeftEnd.bind(this);
    this._boundHandleMoveRightEnd = this._handleMoveRightEnd.bind(this);
  }

  /**
   * Initialize the player
   * @returns {Player} - This instance for chaining
   */
  init() {
    // Initialize base entity
    super.init();
    
    // Create player mesh based on class
    this._createPlayerMesh();
    
    // Set up movement event listeners
    this._setupEventListeners();
    
    // Register with network manager
    networkManager.setPlayerData({
      id: this.id,
      position: { 
        x: this.position.x, 
        y: this.position.y, 
        z: this.position.z 
      },
      type: 'player',
      class: this.classType,
      stats: this.stats
    });
    
    return this;
  }

  /**
   * Create player mesh based on character class
   * @private
   */
  _createPlayerMesh() {
    // Create player mesh (box for now)
    const geometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
    const material = new THREE.MeshStandardMaterial({ 
      color: this.stats.color 
    });
    
    this.createMesh(geometry, material);
    this.setPosition(2, 0.8, 2); // Default position
  }

  /**
   * Set up event listeners for player movement
   * @private
   */
  _setupEventListeners() {
    // Movement start events
    eventBus.on('input.move.forward.start', this._boundHandleMoveForward);
    eventBus.on('input.move.backward.start', this._boundHandleMoveBackward);
    eventBus.on('input.move.left.start', this._boundHandleMoveLeft);
    eventBus.on('input.move.right.start', this._boundHandleMoveRight);
    
    // Movement end events
    eventBus.on('input.move.forward.end', this._boundHandleMoveForwardEnd);
    eventBus.on('input.move.backward.end', this._boundHandleMoveBackwardEnd);
    eventBus.on('input.move.left.end', this._boundHandleMoveLeftEnd);
    eventBus.on('input.move.right.end', this._boundHandleMoveRightEnd);
  }

  /**
   * Handle move forward event
   * @private
   */
  _handleMoveForward() {
    this.movementDirection.z = -1;
    this.isMoving = true;
  }

  /**
   * Handle move backward event
   * @private
   */
  _handleMoveBackward() {
    this.movementDirection.z = 1;
    this.isMoving = true;
  }

  /**
   * Handle move left event
   * @private
   */
  _handleMoveLeft() {
    this.movementDirection.x = -1;
    this.isMoving = true;
  }

  /**
   * Handle move right event
   * @private
   */
  _handleMoveRight() {
    this.movementDirection.x = 1;
    this.isMoving = true;
  }

  /**
   * Handle move forward end event
   * @private
   */
  _handleMoveForwardEnd() {
    if (this.movementDirection.z < 0) {
      this.movementDirection.z = 0;
      this.isMoving = this.movementDirection.length() > 0;
    }
  }

  /**
   * Handle move backward end event
   * @private
   */
  _handleMoveBackwardEnd() {
    if (this.movementDirection.z > 0) {
      this.movementDirection.z = 0;
      this.isMoving = this.movementDirection.length() > 0;
    }
  }

  /**
   * Handle move left end event
   * @private
   */
  _handleMoveLeftEnd() {
    if (this.movementDirection.x < 0) {
      this.movementDirection.x = 0;
      this.isMoving = this.movementDirection.length() > 0;
    }
  }

  /**
   * Handle move right end event
   * @private
   */
  _handleMoveRightEnd() {
    if (this.movementDirection.x > 0) {
      this.movementDirection.x = 0;
      this.isMoving = this.movementDirection.length() > 0;
    }
  }

  /**
   * Update player position based on movement direction
   * @param {number} deltaTime - Time since last update in seconds
   */
  update(deltaTime) {
    // Call base entity update (components)
    super.update(deltaTime);
    
    // Handle movement
    if (this.isMoving) {
      // Normalize direction vector
      const direction = this.movementDirection.clone().normalize();
      
      // Move player based on speed
      const deltaX = direction.x * this.stats.speed;
      const deltaZ = direction.z * this.stats.speed;
      
      this.move(deltaX, 0, deltaZ);
      
      // Send movement to server
      networkManager.sendPlayerMove({
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      });
    }
  }

  /**
   * Take damage
   * @param {number} amount - Amount of damage to take
   * @returns {number} - Remaining health
   */
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    
    eventBus.emit(`entity.${this.id}.healthChanged`, {
      entityId: this.id,
      health: this.health,
      maxHealth: this.stats.health
    });
    
    // Check if player died
    if (this.health <= 0) {
      eventBus.emit(`entity.${this.id}.died`, { entityId: this.id });
    }
    
    return this.health;
  }

  /**
   * Heal player
   * @param {number} amount - Amount to heal
   * @returns {number} - New health
   */
  heal(amount) {
    this.health = Math.min(this.stats.health, this.health + amount);
    
    eventBus.emit(`entity.${this.id}.healthChanged`, {
      entityId: this.id,
      health: this.health,
      maxHealth: this.stats.health
    });
    
    return this.health;
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Remove event listeners
    eventBus.off('input.move.forward.start', this._boundHandleMoveForward);
    eventBus.off('input.move.backward.start', this._boundHandleMoveBackward);
    eventBus.off('input.move.left.start', this._boundHandleMoveLeft);
    eventBus.off('input.move.right.start', this._boundHandleMoveRight);
    
    eventBus.off('input.move.forward.end', this._boundHandleMoveForwardEnd);
    eventBus.off('input.move.backward.end', this._boundHandleMoveBackwardEnd);
    eventBus.off('input.move.left.end', this._boundHandleMoveLeftEnd);
    eventBus.off('input.move.right.end', this._boundHandleMoveRightEnd);
    
    // Call base entity destroy
    super.destroy();
  }
}

export default Player;