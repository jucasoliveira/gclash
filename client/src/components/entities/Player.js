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
    
    // Combat properties
    this.attackCooldown = 0;
    this.isAttacking = false;
    this.primaryAttack = stats.abilities.primary;
    
    // Event bindings
    this._boundHandleMoveForward = this._handleMoveForward.bind(this);
    this._boundHandleMoveBackward = this._handleMoveBackward.bind(this);
    this._boundHandleMoveLeft = this._handleMoveLeft.bind(this);
    this._boundHandleMoveRight = this._handleMoveRight.bind(this);
    
    this._boundHandleMoveForwardEnd = this._handleMoveForwardEnd.bind(this);
    this._boundHandleMoveBackwardEnd = this._handleMoveBackwardEnd.bind(this);
    this._boundHandleMoveLeftEnd = this._handleMoveLeftEnd.bind(this);
    this._boundHandleMoveRightEnd = this._handleMoveRightEnd.bind(this);
    
    this._boundHandleAttack = this._handleAttack.bind(this);
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
    
    // Initialize cooldown UI with attack ready
    this.attackCooldown = 0;
    this._updateCooldownUI();
    
    // Make sure the game UI is visible
    const gameUI = document.getElementById('game-ui');
    if (gameUI) {
      gameUI.classList.add('visible');
    }
    
    // Initialize UI elements
    this._initializeUI();
    
    // Force update health UI to ensure it's properly set at start
    this._updateHealthUI();
    
    return this;
  }
  
  /**
   * Initialize UI elements for the player
   * @private 
   */
  _initializeUI() {
    // Set player class and color in UI
    const playerClassElement = document.getElementById('player-class');
    const playerColorElement = document.getElementById('player-color');
    
    if (playerClassElement) {
      playerClassElement.textContent = `Class: ${this.classType.charAt(0) + this.classType.slice(1).toLowerCase()}`;
    }
    
    if (playerColorElement) {
      playerColorElement.style.backgroundColor = `#${this.stats.color.toString(16).padStart(6, '0')}`;
    }
    
    // Initialize health UI
    const healthFill = document.getElementById('health-fill');
    const playerStats = document.getElementById('player-stats');
    
    if (healthFill) {
      healthFill.style.width = '100%';
      healthFill.style.backgroundColor = '#2ecc71'; // Green for full health
    }
    
    if (playerStats) {
      playerStats.textContent = `Health: ${this.health}/${this.stats.health}`;
    }
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
    
    // Combat events
    eventBus.on('input.click', this._boundHandleAttack);
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
    
    // Update attack cooldown
    if (this.attackCooldown > 0) {
      // Decrease cooldown by delta time
      this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
      
      // Log cooldown for debugging
      if (deltaTime > 0) {
        console.debug(`Cooldown decreasing: ${this.attackCooldown.toFixed(2)} seconds left (delta: ${deltaTime.toFixed(3)}s)`);
      }
      
      // Update cooldown UI
      this._updateCooldownUI();
      
      // If we just reached 0, log that attack is ready
      if (this.attackCooldown === 0) {
        console.log('Attack ready!');
      }
    }
  }
  
  /**
   * Update the cooldown UI indicator
   * @private
   */
  _updateCooldownUI() {
    const cooldownFill = document.getElementById('cooldown-fill');
    if (cooldownFill) {
      // Calculate percentage of cooldown remaining
      const maxCooldown = this.primaryAttack.cooldown;
      const percentRemaining = (this.attackCooldown / maxCooldown) * 100;
      
      // Update the width of the cooldown fill
      cooldownFill.style.width = `${100 - percentRemaining}%`;
      
      // Change color based on availability
      if (percentRemaining <= 0) {
        cooldownFill.style.backgroundColor = '#2ecc71'; // Green when ready
      } else {
        cooldownFill.style.backgroundColor = '#3498db'; // Blue when cooling down
      }
    }
  }
  
  /**
   * Handle mouse click for attack
   * @param {Object} data - Click event data
   * @private
   */
  _handleAttack(data) {
    // Check if attack is on cooldown or we're already attacking
    if (this.isAttacking) {
      console.debug('Cannot attack: already performing an attack');
      return;
    }
    
    if (this.attackCooldown > 0) {
      console.debug('Attack on cooldown:', this.attackCooldown.toFixed(2), 'seconds left');
      return;
    }
    
    // Start attack cooldown (in seconds)
    this.attackCooldown = this.primaryAttack.cooldown;
    this.isAttacking = true;
    
    console.log(`Attack executed: ${this.primaryAttack.name}, cooldown: ${this.attackCooldown}s`);
    
    // Create a raycaster for target detection
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(data.ndc, window.currentCamera);
    
    // Get entities that can be targeted (other players)
    const targetableMeshes = [];
    
    // Find all possible targets
    eventBus.emit('combat.getTargets', { 
      callback: (targets) => {
        targetableMeshes.push(...targets);
      }
    });
    
    // Check for intersections
    const intersects = raycaster.intersectObjects(targetableMeshes);
    
    if (intersects.length > 0) {
      // Get the entity ID from the mesh
      const targetEntityId = intersects[0].object.userData.entityId;
      
      if (targetEntityId) {
        // Check if target is in range
        const target = this._getEntityById(targetEntityId);
        
        if (target) {
          const distance = this.position.distanceTo(target.position);
          
          if (distance <= this.primaryAttack.range) {
            // Deal damage
            this._executeAttack(targetEntityId, this.primaryAttack.damage);
          } else {
            console.log('Target out of range');
          }
        }
      }
    }
    
    // Show attack animation/effect
    this._showAttackEffect();
    
    // Reset attack state after animation completes
    setTimeout(() => {
      this.isAttacking = false;
      console.log('Attack animation completed, can attack again when cooldown expires');
    }, 200);
  }
  
  /**
   * Execute attack on a target
   * @param {string} targetId - Target entity ID
   * @param {number} damage - Damage amount
   * @private
   */
  _executeAttack(targetId, damage) {
    // Emit damage event
    eventBus.emit('combat.damage', {
      attackerId: this.id,
      targetId: targetId,
      damage: damage,
      attackType: this.primaryAttack.name
    });
    
    // Send attack to server
    networkManager.sendPlayerAttack({
      targetId: targetId,
      damage: damage,
      attackType: this.primaryAttack.name
    });
  }
  
  /**
   * Show attack effect/animation based on class
   * @private
   */
  _showAttackEffect() {
    const attackEffect = this._createAttackEffect();
    
    if (attackEffect) {
      // Add to scene
      eventBus.emit('renderer.addObject', {
        id: `attack-${this.id}-${Date.now()}`,
        object: attackEffect,
        temporary: true,
        duration: 0.5 // Remove after 0.5 seconds
      });
    }
  }
  
  /**
   * Create attack effect mesh based on class type
   * @returns {THREE.Object3D} Attack effect mesh
   * @private
   */
  _createAttackEffect() {
    let geometry, material, mesh;
    
    switch (this.classType) {
      case 'CLERK':
        // Magic bolt (blue sphere)
        geometry = new THREE.SphereGeometry(0.3, 8, 8);
        material = new THREE.MeshBasicMaterial({ 
          color: 0x00aaff,
          transparent: true,
          opacity: 0.7
        });
        mesh = new THREE.Mesh(geometry, material);
        // Position in front of player
        mesh.position.copy(this.position.clone().add(new THREE.Vector3(0, 0.5, -1)));
        break;
        
      case 'WARRIOR':
        // Melee swing (red arc)
        geometry = new THREE.TorusGeometry(0.7, 0.1, 8, 16, Math.PI);
        material = new THREE.MeshBasicMaterial({ 
          color: 0xff3300,
          transparent: true,
          opacity: 0.7
        });
        mesh = new THREE.Mesh(geometry, material);
        // Position in front of player
        mesh.position.copy(this.position.clone().add(new THREE.Vector3(0, 0.5, -0.5)));
        mesh.rotation.set(Math.PI/2, 0, 0);
        break;
        
      case 'RANGER':
        // Arrow (green cylinder)
        geometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
        material = new THREE.MeshBasicMaterial({ 
          color: 0x33cc33,
          transparent: true,
          opacity: 0.7
        });
        mesh = new THREE.Mesh(geometry, material);
        // Position in front of player
        mesh.position.copy(this.position.clone().add(new THREE.Vector3(0, 0.5, -1)));
        mesh.rotation.set(Math.PI/2, 0, 0);
        break;
        
      default:
        return null;
    }
    
    return mesh;
  }
  
  /**
   * Helper to get entity by ID
   * @param {string} id - Entity ID
   * @returns {Entity} - Entity or null
   * @private
   */
  _getEntityById(id) {
    let entity = null;
    
    eventBus.emit('entityManager.getEntity', { 
      id,
      callback: (result) => {
        entity = result;
      }
    });
    
    return entity;
  }

  /**
   * Take damage
   * @param {number} amount - Amount of damage to take
   * @param {boolean} fromNetwork - Whether this damage is from a network event
   * @returns {number} - Remaining health
   */
  takeDamage(amount, fromNetwork = false) {
    const oldHealth = this.health;
    this.health = Math.max(0, this.health - amount);
    
    console.log(`PLAYER TAKING DAMAGE: ${oldHealth} -> ${this.health} (${amount} damage)`);
    
    // DIRECTLY UPDATE THE GAME UI
    // Find the Game instance through the global window object
    if (window.game && typeof window.game.updateHealthUI === 'function') {
      console.log(`CRITICAL: Directly calling game.updateHealthUI from Player.takeDamage`);
      window.game.updateHealthUI(this.health, this.stats.health);
    }
    
    // Also update through our own method for redundancy
    this._updateHealthUI();
    
    // Emit health changed event for other systems
    eventBus.emit(`entity.${this.id}.healthChanged`, {
      entityId: this.id,
      health: this.health,
      maxHealth: this.stats.health
    });
    
    // Emit global health change event that Game.js can listen for
    eventBus.emit('player.healthChanged', {
      id: this.id,
      health: this.health,
      maxHealth: this.stats.health,
      damage: amount
    });
    
    // Only send health update to server if this damage wasn't already from the network
    // This prevents feedback loops where A tells B tells A tells B...
    if (!fromNetwork) {
      networkManager.sendPlayerHealthChange({
        health: this.health,
        maxHealth: this.stats.health,
        damage: amount
      });
    }
    
    // Play damage effect
    this._playDamageEffect();
    
    // CRITICAL: Direct DOM manipulation for health bar
    const healthFill = document.getElementById('health-fill');
    const playerStats = document.getElementById('player-stats');
    
    if (healthFill) {
      const percentage = Math.max(0, Math.min(100, (this.health / this.stats.health) * 100));
      
      // Force immediate update
      healthFill.style.transition = 'none';
      healthFill.style.width = `${percentage}%`;
      healthFill.offsetHeight; // Force reflow
      
      // Set color
      if (percentage > 60) {
        healthFill.style.backgroundColor = '#2ecc71'; // Green
      } else if (percentage > 30) {
        healthFill.style.backgroundColor = '#f39c12'; // Orange
      } else {
        healthFill.style.backgroundColor = '#e74c3c'; // Red
      }
      
      console.log(`CRITICAL: Direct DOM health bar update to ${percentage}%`);
      
      // Re-enable transition
      setTimeout(() => {
        healthFill.style.transition = 'width 0.3s ease-out, background-color 0.3s ease-out';
      }, 50);
    }
    
    if (playerStats) {
      playerStats.textContent = `Health: ${Math.round(this.health)}/${this.stats.health}`;
    }
    
    // Check if player died
    if (this.health <= 0) {
      console.log(`PLAYER DIED FROM DAMAGE: Health reached ${this.health}`);
      
      // Emit death event
      eventBus.emit(`entity.${this.id}.died`, { entityId: this.id });
      
      // Send death notification to server (only if not from network)
      if (!fromNetwork) {
        networkManager.sendPlayerDeath({
          position: {
            x: this.position.x,
            y: this.position.y,
            z: this.position.z
          }
        });
      }
      
      // Hide player mesh
      if (this.mesh) {
        this.mesh.visible = false;
      }
      
      // Show death effect
      this._showDeathEffect();
    }
    
    return this.health;
  }
  
  /**
   * Update the player's health UI
   * @private
   */
  _updateHealthUI() {
    // Make sure the game UI is visible if it's not already
    const gameUI = document.getElementById('game-ui');
    if (gameUI && !gameUI.classList.contains('visible')) {
      gameUI.classList.add('visible');
    }
    
    const healthFill = document.getElementById('health-fill');
    const playerStats = document.getElementById('player-stats');
    
    // Ensure health is clamped to valid range (0 to max)
    const validHealth = Math.max(0, Math.min(this.stats.health, this.health));
    
    console.log(`UPDATING PLAYER UI: Health = ${validHealth}/${this.stats.health}`);
    
    // Update the health bar fill
    if (healthFill) {
      const percentage = Math.max(0, Math.min(100, (validHealth / this.stats.health) * 100));
      
      // Force immediate style update without animation
      healthFill.style.transition = 'none'; // Turn off transition temporarily
      
      // Update DOM directly and force a reflow
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
      
      // Restore transition after a brief delay
      setTimeout(() => {
        healthFill.style.transition = 'width 0.2s ease-out';
      }, 50);
      
      console.log(`Health bar updated: ${percentage}% width, health: ${validHealth}/${this.stats.health}`);
    } else {
      console.error('CRITICAL ERROR: Health fill element not found in the DOM!');
      // Try to recreate it
      const healthBar = document.querySelector('.health-bar');
      if (healthBar) {
        console.log('Found health bar container, recreating health fill');
        const newHealthFill = document.createElement('div');
        newHealthFill.id = 'health-fill';
        newHealthFill.className = 'health-fill';
        healthBar.innerHTML = '';
        healthBar.appendChild(newHealthFill);
      }
    }
    
    // Update the text display
    if (playerStats) {
      playerStats.textContent = `Health: ${Math.round(validHealth)}/${this.stats.health}`;
      console.log(`Player stats text updated to: ${playerStats.textContent}`);
    } else {
      console.error('CRITICAL ERROR: Player stats element not found in the DOM!');
    }
    
    // Additional direct update to DOM for reliability
    document.querySelectorAll('.health-fill').forEach(fill => {
      const percentage = Math.max(0, Math.min(100, (validHealth / this.stats.health) * 100));
      fill.style.width = `${percentage}%`;
    });
  }
  
  /**
   * Play damage effect when player takes damage
   * @private
   */
  _playDamageEffect() {
    // Flash the screen red
    const flashElement = document.createElement('div');
    flashElement.style.position = 'fixed';
    flashElement.style.top = '0';
    flashElement.style.left = '0';
    flashElement.style.width = '100%';
    flashElement.style.height = '100%';
    flashElement.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
    flashElement.style.pointerEvents = 'none';
    flashElement.style.zIndex = '1000';
    flashElement.style.transition = 'opacity 0.3s ease-out';
    
    document.body.appendChild(flashElement);
    
    // Fade out and remove
    setTimeout(() => {
      flashElement.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(flashElement)) {
          document.body.removeChild(flashElement);
        }
      }, 300);
    }, 50);
    
    // Shake the camera slightly
    if (window.currentCamera) {
      const originalPosition = window.currentCamera.position.clone();
      const shakeAmount = 0.1;
      
      // Small random offset
      window.currentCamera.position.x += (Math.random() - 0.5) * shakeAmount;
      window.currentCamera.position.y += (Math.random() - 0.5) * shakeAmount;
      window.currentCamera.position.z += (Math.random() - 0.5) * shakeAmount;
      
      // Reset camera position after a short delay
      setTimeout(() => {
        if (window.currentCamera) {
          window.currentCamera.position.copy(originalPosition);
        }
      }, 100);
    }
  }
  
  /**
   * Show death effect when player health reaches zero
   * @private
   */
  _showDeathEffect() {
    console.log('Player died!');
    
    // Double-check that player health is 0
    this.health = 0;
    
    // Force update the health UI directly
    this._updateHealthUI();
    
    // Hide the player mesh
    if (this.mesh) {
      console.log('Making player mesh invisible on death');
      this.mesh.visible = false;
    }
    
    // Create particle explosion like OtherPlayer
    this._createDeathParticles();
    
    // Use the global death screen if available
    if (window.showDeathScreen) {
      console.log('Using global death screen');
      window.showDeathScreen();
      
      // Respawn player after a delay
      setTimeout(() => {
        console.log('Auto-respawning player after death');
        this._respawn();
      }, 3500); // Wait for countdown plus transition
      
      return;
    }
    
    // Fallback: Use DOM-based death overlay if global function not available
    console.log('Using fallback death overlay');
    const existingOverlay = document.querySelector('.death-overlay');
    if (existingOverlay) {
      // Use the existing overlay
      console.log('Using existing death overlay element');
      existingOverlay.classList.add('visible');
      
      // Respawn player after a delay
      setTimeout(() => {
        existingOverlay.classList.remove('visible');
        this._respawn();
      }, 3000);
      
      return;
    }
    
    // Last resort: Create a simple death overlay
    console.log('Creating simple death overlay as last resort');
    const deathOverlay = document.createElement('div');
    deathOverlay.style.position = 'fixed';
    deathOverlay.style.top = '0';
    deathOverlay.style.left = '0';
    deathOverlay.style.width = '100%';
    deathOverlay.style.height = '100%';
    deathOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    deathOverlay.style.display = 'flex';
    deathOverlay.style.justifyContent = 'center';
    deathOverlay.style.alignItems = 'center';
    deathOverlay.style.color = '#e74c3c';
    deathOverlay.style.fontSize = '72px';
    deathOverlay.style.fontWeight = 'bold';
    deathOverlay.style.zIndex = '2000';
    deathOverlay.textContent = 'YOU DIED';
    
    document.body.appendChild(deathOverlay);
    
    // Respawn player after a delay
    setTimeout(() => {
      if (document.body.contains(deathOverlay)) {
        document.body.removeChild(deathOverlay);
        this._respawn();
      }
    }, 3000);
  }
  
  /**
   * Create death particle effects
   * @private
   */
  _createDeathParticles() {
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
    
    // Animate particles
    const startTime = Date.now();
    const duration = 2000; // 2 seconds
    
    const animateParticles = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      if (progress < 1 && particles.parent) {
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
      }
    };
    
    // Start animation
    animateParticles();
  }
  
  /**
   * Respawn player after death
   * @private
   */
  _respawn() {
    console.log('RESPAWN: Player respawning...');
    
    // Reset health
    this.health = this.stats.health;
    
    // CRITICAL: Direct update health display
    if (window.updateHealthUI) {
      window.updateHealthUI(this.health, this.stats.health);
    }
    
    // Update UI through normal method as well
    this._updateHealthUI();
    
    // Move to a different position
    const randomX = Math.floor(Math.random() * 10) - 5;
    const randomZ = Math.floor(Math.random() * 10) - 5;
    this.setPosition(randomX, 0.8, randomZ);
    
    // Make player mesh visible again
    if (this.mesh) {
      console.log('RESPAWN: Making player mesh visible again');
      this.mesh.visible = true;
    } else {
      console.error('RESPAWN: Player mesh not found!');
      // Try to recreate mesh if it's missing
      this._createPlayerMesh();
      this.mesh.visible = true;
    }
    
    // Create respawn effect
    this._createRespawnEffect();
    
    // Make sure health bar is restored
    const healthFill = document.getElementById('health-fill');
    if (healthFill) {
      healthFill.style.width = '100%';
      healthFill.style.backgroundColor = '#2ecc71'; // Green for full health
    }
    
    // Emit respawn event
    eventBus.emit(`entity.${this.id}.respawned`, { 
      entityId: this.id,
      position: this.position.clone(),
      health: this.health
    });
    
    // CRITICAL: Send respawn notification to server with explicit health
    console.log(`RESPAWN: Sending respawn data to server: health=${this.health}, pos=(${this.position.x}, ${this.position.y}, ${this.position.z})`);
    
    networkManager.sendPlayerRespawn({
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      },
      health: this.health
    });
    
    console.log('RESPAWN: Player respawned successfully!');
  }
  
  /**
   * Create respawn effect
   * @private
   */
  _createRespawnEffect() {
    // Create a light burst effect (similar to EntityManager)
    const respawnLight = new THREE.PointLight(0x00ffff, 5, 3);
    respawnLight.position.copy(this.position);
    respawnLight.position.y += 0.5;
    
    // Add to scene
    eventBus.emit('renderer.addObject', {
      id: `respawn-light-${this.id}-${Date.now()}`,
      object: respawnLight,
      temporary: true,
      duration: 1
    });
    
    // Create particles
    const particleCount = 15;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.SphereGeometry(0.1, 4, 4);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8
      });
      
      const particle = new THREE.Mesh(geometry, material);
      
      // Set position at center
      particle.position.set(0, 0, 0);
      
      // Set random velocity (outward)
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.05 + Math.random() * 0.05;
      particle.userData.velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        0.02 + Math.random() * 0.06,
        Math.sin(angle) * speed
      );
      
      particles.add(particle);
    }
    
    // Position at player position
    particles.position.copy(this.position);
    particles.position.y += 0.2;
    
    // Add to scene
    eventBus.emit('renderer.addObject', {
      id: `respawn-particles-${this.id}-${Date.now()}`,
      object: particles,
      temporary: true,
      duration: 1
    });
    
    // Animate particles
    const startTime = Date.now();
    const duration = 1000; // 1 second
    
    const animateParticles = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      if (progress < 1 && particles.parent) {
        // Update particle positions
        particles.children.forEach(particle => {
          const velocity = particle.userData.velocity;
          particle.position.add(velocity);
          
          // Add slight gravity effect
          velocity.y -= 0.001;
          
          // Fade out
          if (particle.material.opacity > 0.01) {
            particle.material.opacity -= 0.02;
          }
        });
        
        requestAnimationFrame(animateParticles);
      }
    };
    
    // Start animation
    requestAnimationFrame(animateParticles);
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