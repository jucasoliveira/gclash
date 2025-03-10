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
    
    // Update health bar orientation to face camera
    if (this.healthBar && window.currentCamera) {
      this.healthBar.lookAt(window.currentCamera.position);
    }
  }

  /**
   * Take damage
   * @param {number} amount - Amount of damage to take
   * @returns {number} - Remaining health
   */
  takeDamage(amount) {
    // Calculate original health percentage (for animation)
    const originalHealthPercentage = this.health / this.stats.health;
    
    // Apply damage
    this.health = Math.max(0, this.health - amount);
    const newHealthPercentage = this.health / this.stats.health;
    
    // Create or update health indicator above player
    this._createHealthIndicator();
    
    // Animate health bar decrease
    this._animateHealthDecrease(originalHealthPercentage, newHealthPercentage);
    
    // Flash the mesh red on damage
    this._flashDamage();
    
    // Emit health change event
    eventBus.emit(`entity.${this.id}.healthChanged`, {
      entityId: this.id,
      health: this.health,
      maxHealth: this.stats.health
    });
    
    // Check if player died
    if (this.health <= 0) {
      eventBus.emit(`entity.${this.id}.died`, { entityId: this.id });
      
      // Show death effect
      this._showDeathEffect();
    }
    
    return this.health;
  }
  
  /**
   * Animate health decrease in the health bar
   * @param {number} fromPercent - Starting health percentage
   * @param {number} toPercent - Ending health percentage
   * @private
   */
  _animateHealthDecrease(fromPercent, toPercent) {
    if (!this.healthBar) return;
    
    // Get the health fill element (second child of health bar group)
    const healthFill = this.healthBar.children[1];
    if (!healthFill) return;
    
    // Current scale
    const startWidth = fromPercent * 0.96;
    const endWidth = toPercent * 0.96;
    
    // Duration of animation in milliseconds
    const duration = 500;
    const startTime = Date.now();
    
    // Find the material to change color
    const material = healthFill.material;
    
    // Store original color
    const originalColor = material.color.clone();
    
    // Animation function
    const animateHealth = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Calculate current width with easing
      const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
      const currentWidth = startWidth + (endWidth - startWidth) * easedProgress;
      
      // Update health fill scale
      if (healthFill.scale) {
        healthFill.scale.setX(currentWidth / 0.96);
      }
      
      // Update position to keep aligned to left
      if (healthFill.position) {
        healthFill.position.setX((currentWidth - 1) / 2);
      }
      
      // Update health text if it exists (third child of health bar)
      if (this.healthBar.children[2] && this.healthBar.children[2].material && this.healthBar.children[2].material.map) {
        const currentHealth = Math.round(this.health);
        const maxHealth = this.stats.health;
        
        // Update canvas texture
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${currentHealth}/${maxHealth}`, 32, 16);
        
        // Apply to texture
        const newTexture = new THREE.CanvasTexture(canvas);
        this.healthBar.children[2].material.map.dispose();
        this.healthBar.children[2].material.map = newTexture;
        this.healthBar.children[2].material.needsUpdate = true;
      }
      
      // Pulse red during damage
      if (progress < 1) {
        const pulseIntensity = (1 - progress) * 0.5;
        material.color.setRGB(
          originalColor.r + pulseIntensity,
          originalColor.g * (1 - pulseIntensity),
          originalColor.b * (1 - pulseIntensity)
        );
        
        requestAnimationFrame(animateHealth);
      } else {
        // Reset to appropriate color based on health
        this._updateHealthBarColor(toPercent);
      }
    };
    
    // Start animation
    animateHealth();
  }
  
  /**
   * Update health bar color based on percentage
   * @param {number} percentage - Health percentage (0-1)
   * @private
   */
  _updateHealthBarColor(percentage) {
    if (!this.healthBar || !this.healthBar.children[1]) return;
    
    const material = this.healthBar.children[1].material;
    if (!material) return;
    
    if (percentage > 0.6) {
      material.color.set(0x2ecc71); // Green for high health
    } else if (percentage > 0.3) {
      material.color.set(0xf39c12); // Orange for medium health
    } else {
      material.color.set(0xe74c3c); // Red for low health
    }
  }
  
  /**
   * Create a health indicator above the player
   * @private
   */
  _createHealthIndicator() {
    if (!this.mesh) return;
    
    console.log(`Updating health bar for ${this.id}, health: ${this.health}/${this.stats.health}`);
    
    // Remove existing health indicator
    if (this.healthBar) {
      this.mesh.remove(this.healthBar);
    }
    
    // Create background bar
    const bgGeometry = new THREE.PlaneGeometry(1, 0.2);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const background = new THREE.Mesh(bgGeometry, bgMaterial);
    
    // Create health fill - ensure valid numbers
    const healthRatio = (this.health && this.stats.health) ? 
                         (this.health / this.stats.health) : 0;
    const fillWidth = Math.max(0.02, healthRatio * 0.96);
    
    // Ensure fillWidth is a valid number
    const validFillWidth = isNaN(fillWidth) ? 0.02 : fillWidth;
    
    // Create health fill with base geometry
    const fillGeometry = new THREE.PlaneGeometry(1, 0.16);
    
    // Determine color based on health percentage
    let fillColor;
    if (healthRatio > 0.6) {
      fillColor = 0x2ecc71; // Green for high health
    } else if (healthRatio > 0.3) {
      fillColor = 0xf39c12; // Orange for medium health
    } else {
      fillColor = 0xe74c3c; // Red for low health
    }
    
    const fillMaterial = new THREE.MeshBasicMaterial({ color: fillColor });
    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    
    // Scale width to match health percentage (instead of creating a new geometry)
    fill.scale.setX(validFillWidth);
    
    // Position to align left edge
    fill.position.set((validFillWidth - 1) / 2, 0, 0.01);
    
    // Add text to show numeric health
    const healthTextCanvas = document.createElement('canvas');
    healthTextCanvas.width = 64;
    healthTextCanvas.height = 32;
    const ctx = healthTextCanvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(this.health)}/${this.stats.health}`, 32, 16);
    
    const healthTexture = new THREE.CanvasTexture(healthTextCanvas);
    const healthTextGeometry = new THREE.PlaneGeometry(0.8, 0.2);
    const healthTextMaterial = new THREE.MeshBasicMaterial({ 
      map: healthTexture,
      transparent: true,
      depthTest: false
    });
    
    const healthText = new THREE.Mesh(healthTextGeometry, healthTextMaterial);
    healthText.position.set(0, -0.25, 0.01);
    
    // Create container
    this.healthBar = new THREE.Group();
    this.healthBar.add(background);
    this.healthBar.add(fill);
    this.healthBar.add(healthText);
    
    // Position above player
    this.healthBar.position.set(0, 1.8, 0);
    this.healthBar.rotation.copy(window.currentCamera.rotation);
    
    // Add to player mesh
    this.mesh.add(this.healthBar);
    
    // Face the health bar to the camera
    const updateOrientation = () => {
      if (this.healthBar && window.currentCamera) {
        // Make health bar face camera
        const lookAt = new THREE.Vector3().copy(this.mesh.position);
        lookAt.y += 2;
        this.healthBar.lookAt(window.currentCamera.position);
      }
    };
    
    // Update initially
    updateOrientation();
    
    // Set up event listener for camera updates
    eventBus.on('camera.updated', updateOrientation);
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
    eventBus.off(`network.playerMoved`, this._boundHandlePlayerMoved);
    
    // Call base entity destroy
    super.destroy();
  }
}

export default OtherPlayer;