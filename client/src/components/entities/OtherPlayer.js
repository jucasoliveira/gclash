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
    this.stats = playerData.stats || { color: 0xff6600, health: 100 };
    
    // Set health - prioritize explicit health over stats.health
    this.health = playerData.health !== undefined ? 
                  playerData.health : 
                  (this.stats.health || 100);
                  
    console.log(`OtherPlayer created with health: ${this.health}/${this.stats.health}`);
    
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
    console.log(`[OTHER_PLAYER] Initializing player ${this.id} with class ${this.classType}`);
    
    // Initialize base entity
    super.init();
    
    // Create player mesh based on class
    this._createPlayerMesh();
    
    // Create health bar
    this._createHealthBar();
    
    // Listen for movement updates from network
    eventBus.on(`network.playerMoved`, (data) => {
      if (data.id === this.id) {
        this._handlePlayerMoved(data);
      }
    });
    
    // Listen for health updates from network
    eventBus.on(`network.playerHealthChanged`, (data) => {
      if (data.id === this.id && data.health !== undefined) {
        console.log(`[OTHER_PLAYER] Health changed for ${this.id}: ${data.health}`);
        this.health = data.health;
        this._updateHealthBar();
      }
    });
    
    // Listen for death events from network
    eventBus.on(`network.playerDied`, (data) => {
      if (data.id === this.id) {
        console.log(`[OTHER_PLAYER] Player ${this.id} died`);
        if (this.mesh) {
          this.mesh.visible = false;
          if (this.healthBar) {
            this.healthBar.visible = false;
          }
          this._showDeathEffect();
        }
      }
    });
    
    // Listen for respawn events from network
    eventBus.on(`network.playerRespawned`, (data) => {
      if (data.id === this.id) {
        console.log(`[OTHER_PLAYER] Player ${this.id} respawned`);
        if (this.mesh) {
          this.mesh.visible = true;
          this.health = data.health || this.stats.health;
          this._updateHealthBar();
          
          // Update position if provided
          if (data.position) {
            this.position.set(
              data.position.x,
              data.position.y,
              data.position.z
            );
            this.targetPosition.copy(this.position);
          }
          
          // Ensure health bar is visible
          if (this.healthBar) {
            this.healthBar.visible = true;
          } else {
            this._createHealthBar();
          }
        }
      }
    });
    
    // Also listen for entity-specific events (for compatibility)
    eventBus.on(`entity.${this.id}.moved`, (data) => {
      this._handlePlayerMoved(data);
    });
    
    eventBus.on(`entity.${this.id}.healthChanged`, (data) => {
      if (data.health !== undefined) {
        this.health = data.health;
        this._updateHealthBar();
      }
    });
    
    eventBus.on(`entity.${this.id}.died`, () => {
      if (this.mesh) {
        this.mesh.visible = false;
        if (this.healthBar) {
          this.healthBar.visible = false;
        }
        this._showDeathEffect();
      }
    });
    
    eventBus.on(`entity.${this.id}.respawned`, (data) => {
      if (this.mesh) {
        this.mesh.visible = true;
        this.health = this.stats.health;
        this._updateHealthBar();
        
        // Update position if provided
        if (data.position) {
          this.position.set(
            data.position.x,
            data.position.y,
            data.position.z
          );
          this.targetPosition.copy(this.position);
        }
        
        // Ensure health bar is visible
        if (this.healthBar) {
          this.healthBar.visible = true;
        } else {
          this._createHealthBar();
        }
      }
    });
    
    console.log(`[OTHER_PLAYER] Player ${this.id} initialized successfully`);
    return this;
  }

  /**
   * Create player mesh based on character class
   * @private
   */
  _createPlayerMesh() {
    console.log(`[OTHER_PLAYER] Creating mesh for player ${this.id} with class ${this.classType}`);
    
    // Create player mesh (box for now)
    const geometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
    const material = new THREE.MeshStandardMaterial({ 
      color: this.stats.color || 0xff6600 
    });
    
    this.createMesh(geometry, material);
    
    // Ensure mesh was created and is visible
    if (this.mesh) {
      console.log(`[OTHER_PLAYER] Mesh created successfully for player ${this.id}`);
      this.mesh.visible = true;
      
      // Verify the mesh is in the scene
      setTimeout(() => {
        if (this.mesh.parent) {
          console.log(`[OTHER_PLAYER] Mesh for player ${this.id} is in the scene`);
        } else {
          console.warn(`[OTHER_PLAYER] Mesh for player ${this.id} is NOT in the scene!`);
          
          // Try to add it to the scene if we have access to the renderer
          if (window.game && window.game.renderer && window.game.renderer.scene) {
            console.log(`[OTHER_PLAYER] Attempting to add mesh for player ${this.id} to scene`);
            window.game.renderer.scene.add(this.mesh);
          }
        }
      }, 100);
    } else {
      console.error(`[OTHER_PLAYER] Failed to create mesh for player ${this.id}`);
    }
  }

  /**
   * Handle player movement update from network
   * @param {Object} data - Movement data from server
   * @private
   */
  _handlePlayerMoved(data) {
    console.log(`[OTHER_PLAYER] Player ${this.id} moved to:`, data.position);
    
    if (!data.position) {
      console.warn(`[OTHER_PLAYER] Invalid position data for player ${this.id}:`, data);
      return;
    }
    
    // Update target position
    this.targetPosition.set(
      data.position.x,
      data.position.y,
      data.position.z
    );
    
    // Enable interpolation
    this.isInterpolating = true;
    
    // Ensure mesh is visible
    if (this.mesh && !this.mesh.visible) {
      console.log(`[OTHER_PLAYER] Making player ${this.id} visible after movement`);
      this.mesh.visible = true;
      
      // Also make health bar visible if it exists
      if (this.healthBar) {
        this.healthBar.visible = true;
      } else {
        // Create health bar if it doesn't exist
        this._createHealthBar();
      }
    }
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
    
    // Update health bar orientation to face camera
    if (this.healthBar && window.currentCamera) {
      // Make health bar face camera
      this.healthBar.lookAt(window.currentCamera.position);
      
      // Ensure health bar visibility matches mesh visibility
      if (this.mesh) {
        this.healthBar.visible = this.mesh.visible;
      }
    } else if (this.mesh && this.mesh.visible && !this.healthBar) {
      // Create health bar if it doesn't exist but should
      console.log(`[OTHER_PLAYER] Creating missing health bar for visible player ${this.id}`);
      this._createHealthBar();
    }
  }

  /**
   * Take damage
   * @param {number} amount - Amount of damage to take
   * @param {boolean} fromNetwork - Whether this damage is from a network event
   * @returns {boolean} - True if player died, false otherwise
   */
  takeDamage(amount, fromNetwork = false) {
    console.log(`[DAMAGE] OtherPlayer ${this.id} taking ${amount} damage. Current health: ${this.health}/${this.stats.health}`);
    
    // Skip if already dead
    if (this.health <= 0) {
      console.log(`[DAMAGE] OtherPlayer ${this.id} already dead, ignoring damage`);
      return true;
    }
    
    // Skip if amount is invalid
    if (!amount || amount <= 0) {
      console.log(`[DAMAGE] OtherPlayer ${this.id} invalid damage amount:`, amount);
      return false;
    }
    
    // Ensure health is a valid number
    if (typeof this.health !== 'number' || isNaN(this.health)) {
      console.warn(`[DAMAGE] OtherPlayer ${this.id} invalid health value, resetting to max health`);
      this.health = this.stats.health;
    }
    
    // Ensure stats.health is valid based on class
    if (!this.stats.health) {
      console.warn(`[DAMAGE] OtherPlayer ${this.id} missing stats.health, using default values based on class`);
      // Set default health values based on class
      const defaultHealthByClass = {
        'CLERK': 80,
        'WARRIOR': 120,
        'RANGER': 100
      };
      this.stats.health = defaultHealthByClass[this.classType] || 100;
    }
    
    // Calculate original health
    const oldHealth = this.health;
    
    // Apply damage
    this.health = Math.max(0, this.health - amount);
    
    console.log(`[DAMAGE] OtherPlayer ${this.id} health updated: ${oldHealth} -> ${this.health} (${amount} damage)`);
    
    // Update health bar
    this._updateHealthBar();
    
    // Check if player died
    if (this.health <= 0) {
      console.log(`[DEATH] OtherPlayer ${this.id} died from damage`);
      
      // Hide player mesh
      if (this.mesh) {
        this.mesh.visible = false;
        console.log(`[DEATH] OtherPlayer ${this.id} mesh hidden`);
      }
      
      // Show death effect
      this._showDeathEffect();
      
      // Return true to indicate death
      return true;
    }
    
    // Return false to indicate player is still alive
    return false;
  }
  
  /**
   * Update health bar
   * @private
   */
  _updateHealthBar() {
    console.log(`Updating health bar for ${this.id}, health: ${this.health}/${this.stats.health}`);
    
    // Skip if no mesh
    if (!this.mesh) {
      return;
    }
    
    // Create health bar if it doesn't exist
    if (!this.healthBar) {
      this._createHealthBar();
    }
    
    // Update health bar fill
    if (this.healthBarFill) {
      const healthPercent = Math.max(0, Math.min(1, this.health / this.stats.health));
      this.healthBarFill.scale.x = healthPercent;
      
      // Update color based on health percentage
      this._updateHealthBarColor(healthPercent);
    }
  }
  
  /**
   * Update health bar color based on health percentage
   * @param {number} percentage - Health percentage (0-1)
   * @private
   */
  _updateHealthBarColor(percentage) {
    console.log(`[HEALTH] Updating health bar color for ${this.id} with percentage ${percentage.toFixed(2)}`);
    
    if (!this.healthBarFill) {
      return;
    }
    
    // Set color based on health percentage
    if (percentage > 0.6) {
      console.log(`[HEALTH] Setting health bar color to green for ${this.id}`);
      this.healthBarFill.material.color.setHex(0x2ecc71); // Green
    } else if (percentage > 0.3) {
      console.log(`[HEALTH] Setting health bar color to orange for ${this.id}`);
      this.healthBarFill.material.color.setHex(0xf39c12); // Orange
    } else {
      console.log(`[HEALTH] Setting health bar color to red for ${this.id}`);
      this.healthBarFill.material.color.setHex(0xe74c3c); // Red
    }
  }
  
  /**
   * Create health bar
   * @private
   */
  _createHealthBar() {
    if (!this.mesh) {
      console.warn(`[HEALTH] Cannot create health bar for ${this.id}: mesh not found`);
      return;
    }
    
    // If health bar already exists, remove it first
    if (this.healthBar) {
      console.log(`[HEALTH] Removing existing health bar for ${this.id}`);
      this.mesh.remove(this.healthBar);
      this.healthBar = null;
      this.healthBarFill = null;
    }
    
    console.log(`[HEALTH] Creating health bar for ${this.id}`);
    
    // Create health bar container
    const healthBarGroup = new THREE.Group();
    healthBarGroup.name = `healthbar-${this.id}`;
    
    // Position above player
    healthBarGroup.position.set(0, 2.2, 0);
    
    // Create health bar background (black)
    const backgroundGeometry = new THREE.PlaneGeometry(1, 0.15);
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      depthTest: false
    });
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    healthBarGroup.add(background);
    
    // Create health bar fill (green)
    const fillGeometry = new THREE.PlaneGeometry(1, 0.15);
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: 0x2ecc71,
      transparent: true,
      opacity: 0.8,
      depthTest: false
    });
    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    
    // Position fill to align with left edge of background
    fill.position.set(0, 0, 0.01);
    
    // Set initial scale based on health
    const healthPercent = Math.max(0, Math.min(1, this.health / this.stats.health));
    fill.scale.x = healthPercent;
    
    // Add fill to group
    healthBarGroup.add(fill);
    this.healthBarFill = fill;
    
    // Add health bar to mesh
    this.mesh.add(healthBarGroup);
    this.healthBar = healthBarGroup;
    
    // Make health bar always face camera
    healthBarGroup.userData.isBillboard = true;
    
    // Ensure health bar is visible if mesh is visible
    healthBarGroup.visible = this.mesh.visible;
    
    // Update health bar color based on health percentage
    this._updateHealthBarColor(healthPercent);
    
    console.log(`[HEALTH] Health bar created for ${this.id} with health ${this.health}/${this.stats.health} (${healthPercent * 100}%)`);
  }
  
  /**
   * Flash the mesh red when taking damage
   * @private
   */
  _flashDamage() {
    if (!this.mesh || !this.mesh.material) return;
    
    // Store original color
    const originalColor = this.mesh.material.color.clone();
    
    // Set to damage color (red)
    this.mesh.material.color.set(0xff0000);
    
    // Restore original color after a short delay
    setTimeout(() => {
      if (this.mesh && this.mesh.material) {
        this.mesh.material.color.copy(originalColor);
      }
    }, 200);
  }
  
  /**
   * Show death effect when health reaches zero
   * @private
   */
  _showDeathEffect() {
    if (!this.mesh) return;
    
    // Create particles
    const particleCount = 20;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.SphereGeometry(0.1, 4, 4);
      const material = new THREE.MeshBasicMaterial({ 
        color: this.stats.color,
        transparent: true,
        opacity: 0.8
      });
      
      const particle = new THREE.Mesh(geometry, material);
      
      // Set random position offset
      particle.position.set(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 0.5
      );
      
      // Set random velocity
      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.05,
        Math.random() * 0.08,
        (Math.random() - 0.5) * 0.05
      );
      
      particles.add(particle);
    }
    
    // Position at player position
    particles.position.copy(this.position);
    
    // Add to scene
    eventBus.emit('renderer.addObject', {
      id: `death-effect-${this.id}`,
      object: particles,
      temporary: true,
      duration: 2
    });
    
    // Hide player mesh
    if (this.mesh) {
      this.mesh.visible = false;
    }
    
    // Animate particles
    const animateParticles = () => {
      if (!particles.parent) return;
      
      // Update particle positions
      particles.children.forEach(particle => {
        const velocity = particle.userData.velocity;
        particle.position.add(velocity);
        
        // Add gravity effect
        velocity.y -= 0.002;
        
        // Fade out
        if (particle.material.opacity > 0.01) {
          particle.material.opacity -= 0.01;
        }
      });
      
      requestAnimationFrame(animateParticles);
    };
    
    // Start animation
    requestAnimationFrame(animateParticles);
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Remove event listeners
    eventBus.off(`entity.${this.id}.moved`);
    eventBus.off(`entity.${this.id}.healthChanged`);
    eventBus.off(`entity.${this.id}.died`);
    eventBus.off(`entity.${this.id}.respawned`);
    
    // Also remove network event listeners
    eventBus.off(`network.playerMoved`, (data) => data.id === this.id);
    eventBus.off(`network.playerHealthChanged`, (data) => data.id === this.id);
    eventBus.off(`network.playerDied`, (data) => data.id === this.id);
    eventBus.off(`network.playerRespawned`, (data) => data.id === this.id);
    
    console.log(`[OTHER_PLAYER] Destroyed player ${this.id}`);
    
    // Call base entity destroy
    super.destroy();
  }
}

export default OtherPlayer;