import * as THREE from 'three';
import Entity from './Entity.js';
import eventBus from '../core/EventBus.js';

/**
 * OtherPlayer - Represents another player in the game
 * Handles network-synchronized player entities
 */
class OtherPlayer extends Entity {
  /**
   * Create a new networked player
   * @param {string} id - Unique player ID
   * @param {Object} playerData - Player data from server
   */
  constructor(id, playerData) {
    super(id);
    
    // Player properties
    this.type = 'otherPlayer';
    this.classType = playerData.class || 'WARRIOR';
    this.stats = playerData.stats || { color: 0xff6600 };
    this.targetPosition = new THREE.Vector3();
    
    // Set initial position
    if (playerData.position) {
      this.position.set(
        playerData.position.x || 0,
        playerData.position.y || 0.8,
        playerData.position.z || 0
      );
      this.targetPosition.copy(this.position);
    }
    
    // Smoothing
    this.lerpFactor = 0.1; // Adjust for smoother/snappier movement
    this.isInterpolating = false;
    
    // Event bindings
    this._boundHandlePlayerMoved = this._handlePlayerMoved.bind(this);
  }

  /**
   * Initialize the other player
   * @returns {OtherPlayer} - This instance for chaining
   */
  init() {
    // Initialize base entity
    super.init();
    
    // Create player mesh based on class
    this._createPlayerMesh();
    
    // Listen for movement updates from network
    eventBus.on(`network.playerMoved`, (data) => {
      if (data.id === this.id) {
        this._handlePlayerMoved(data);
      }
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
      color: this.stats.color || 0xff6600 
    });
    
    this.createMesh(geometry, material);
  }

  /**
   * Handle player movement update from network
   * @param {Object} data - Movement data from server
   * @private
   */
  _handlePlayerMoved(data) {
    if (!data.position) return;
    
    // Update target position
    this.targetPosition.set(
      data.position.x,
      data.position.y,
      data.position.z
    );
    
    // Enable interpolation
    this.isInterpolating = true;
  }

  /**
   * Update player position with interpolation
   * @param {number} deltaTime - Time since last update in seconds
   */
  update(deltaTime) {
    // Call base entity update
    super.update(deltaTime);
    
    // Interpolate position if needed
    if (this.isInterpolating) {
      // Calculate distance to target
      const distance = this.position.distanceTo(this.targetPosition);
      
      // If close enough, snap to target position
      if (distance < 0.01) {
        this.position.copy(this.targetPosition);
        this.isInterpolating = false;
        
        // Update mesh position
        if (this.mesh) {
          this.mesh.position.copy(this.position);
        }
      } else {
        // Interpolate position
        const newPosition = new THREE.Vector3().copy(this.position).lerp(
          this.targetPosition, 
          this.lerpFactor
        );
        
        // Update position without triggering events
        this.position.copy(newPosition);
        
        // Update mesh position
        if (this.mesh) {
          this.mesh.position.copy(this.position);
        }
      }
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Remove event listeners
    eventBus.off(`network.playerMoved`, this._boundHandlePlayerMoved);
    
    // Call base entity destroy
    super.destroy();
  }
}

export default OtherPlayer;