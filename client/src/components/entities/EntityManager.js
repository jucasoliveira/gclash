import * as THREE from 'three';
import eventBus from '../core/EventBus.js';
import renderer from '../core/Renderer.js';
import Player from './Player.js';
import OtherPlayer from './OtherPlayer.js';
import CHARACTER_CLASSES from '../../config/classes.js';

/**
 * EntityManager - Manages all game entities
 * Handles creation, updating, and removal of entities
 */
class EntityManager {
  constructor() {
    this.entities = new Map();
    this.player = null;
    
    // Bindings
    this._boundHandleExistingPlayers = this._handleExistingPlayers.bind(this);
    this._boundHandlePlayerJoined = this._handlePlayerJoined.bind(this);
    this._boundHandlePlayerLeft = this._handlePlayerLeft.bind(this);
    this._boundUpdate = this.update.bind(this);
  }

  /**
   * Initialize the entity manager
   * @returns {EntityManager} - This instance for chaining
   */
  init() {
    // Set up network event listeners
    eventBus.on('network.existingPlayers', this._boundHandleExistingPlayers);
    eventBus.on('network.playerJoined', this._boundHandlePlayerJoined);
    eventBus.on('network.playerLeft', this._boundHandlePlayerLeft);
    eventBus.on('network.playerAttacked', this._handlePlayerAttacked.bind(this));
    eventBus.on('network.playerHealthChanged', this._handlePlayerHealthChanged.bind(this));
    eventBus.on('network.playerDied', this._handlePlayerDied.bind(this));
    eventBus.on('network.playerRespawned', this._handlePlayerRespawned.bind(this));
    
    // Set up render update cycle
    eventBus.on('renderer.beforeRender', this._boundUpdate);
    
    // Set up combat event listeners
    eventBus.on('combat.getTargets', this._handleGetTargets.bind(this));
    eventBus.on('combat.damage', this._handleDamage.bind(this));
    eventBus.on('entityManager.getEntity', this._handleGetEntity.bind(this));
    
    // Add direct player access event handler
    eventBus.on('entityManager.getPlayerByID', (data) => {
      if (data && data.id && data.callback) {
        if (this.player && this.player.id === data.id) {
          console.log('EntityManager.getPlayerByID: Returning local player');
          data.callback(this.player);
        } else {
          // Look in other entities
          const entity = this.getEntity(data.id);
          console.log(`EntityManager.getPlayerByID: Returning entity for ${data.id}`);
          data.callback(entity);
        }
      }
    });
    
    return this;
  }

  /**
   * Create a local player
   * @param {string} classType - Character class type (CLERK, WARRIOR, RANGER)
   * @param {string} id - Optional player ID (defaults to socket ID or generated)
   * @returns {Player} - Created player entity
   */
  createPlayer(classType, id = null) {
    // Check if player already exists
    if (this.player) {
      console.warn('Player already exists. Destroying existing player.');
      this.removeEntity(this.player.id);
    }
    
    // Get class stats
    const stats = CHARACTER_CLASSES[classType];
    if (!stats) {
      console.error(`Invalid class type: ${classType}`);
      return null;
    }
    
    // Create player
    const player = new Player(id, classType, stats);
    player.init();
    
    // Add to entities
    this.addEntity(player);
    this.player = player;
    
    // Add to scene
    if (player.mesh) {
      renderer.addObject(`player-${player.id}`, player.mesh);
    }
    
    // Emit event
    eventBus.emit('entityManager.playerCreated', { player });
    
    return player;
  }

  /**
   * Handle existing players from server
   * @param {Array} players - Array of player data from server
   * @private
   */
  _handleExistingPlayers(players) {
    // Create entities for each existing player
    players.forEach(playerData => {
      this._createOtherPlayer(playerData);
    });
  }

  /**
   * Handle new player joined event
   * @param {Object} playerData - Player data from server
   * @private
   */
  _handlePlayerJoined(playerData) {
    this._createOtherPlayer(playerData);
  }

  /**
   * Create an other player entity
   * @param {Object} playerData - Player data from server
   * @returns {OtherPlayer} - Created entity
   * @private
   */
  _createOtherPlayer(playerData) {
    // Check if entity already exists
    if (this.entities.has(playerData.id)) {
      console.warn(`Entity already exists with ID ${playerData.id}`);
      return this.entities.get(playerData.id);
    }
    
    // Ensure player data has health information
    if (playerData.stats && !playerData.health) {
      playerData.health = playerData.stats.health;
    }
    
    console.log(`Creating other player with data:`, playerData);
    
    // Create other player entity
    const otherPlayer = new OtherPlayer(playerData.id, playerData);
    otherPlayer.init();
    
    // Add to entities
    this.addEntity(otherPlayer);
    
    // Add to scene
    if (otherPlayer.mesh) {
      renderer.addObject(`player-${otherPlayer.id}`, otherPlayer.mesh);
    }
    
    return otherPlayer;
  }

  /**
   * Handle player left event
   * @param {Object} data - Player data from server
   * @private
   */
  _handlePlayerLeft(data) {
    if (data.id && this.entities.has(data.id)) {
      this.removeEntity(data.id);
    }
  }

  /**
   * Add an entity to the manager
   * @param {Entity} entity - Entity to add
   * @returns {EntityManager} - This instance for chaining
   */
  addEntity(entity) {
    if (this.entities.has(entity.id)) {
      console.warn(`Entity with ID ${entity.id} already exists. Replacing.`);
      this.removeEntity(entity.id);
    }
    
    this.entities.set(entity.id, entity);
    
    // Emit event
    eventBus.emit('entityManager.entityAdded', { 
      entityId: entity.id,
      entity,
      type: entity.type
    });
    
    return this;
  }

  /**
   * Get an entity by ID
   * @param {string} id - Entity ID
   * @returns {Entity|null} - Entity or null if not found
   */
  getEntity(id) {
    return this.entities.get(id) || null;
  }

  /**
   * Get all entities of a specific type
   * @param {string} type - Entity type
   * @returns {Array} - Array of entities
   */
  getEntitiesByType(type) {
    const result = [];
    
    this.entities.forEach(entity => {
      if (entity.type === type) {
        result.push(entity);
      }
    });
    
    return result;
  }

  /**
   * Remove an entity by ID
   * @param {string} id - Entity ID
   * @returns {boolean} - Whether the entity was removed
   */
  removeEntity(id) {
    if (!this.entities.has(id)) {
      return false;
    }
    
    const entity = this.entities.get(id);
    
    // Clear from player reference if it's the local player
    if (this.player && this.player.id === id) {
      this.player = null;
    }
    
    // Remove from scene
    renderer.removeObject(`player-${id}`);
    
    // Destroy entity
    entity.destroy();
    
    // Remove from entities map
    this.entities.delete(id);
    
    // Emit event
    eventBus.emit('entityManager.entityRemoved', { 
      entityId: id,
      type: entity.type
    });
    
    return true;
  }

  /**
   * Update all entities
   * @param {Object} data - Event data including deltaTime
   */
  update(data) {
    const deltaTime = data.deltaTime || 0;
    
    // Update all entities
    this.entities.forEach(entity => {
      if (entity.isActive) {
        entity.update(deltaTime);
      }
    });
  }

  /**
   * Handle request to get all targetable entities
   * @param {Object} data - Event data with callback function
   * @private
   */
  _handleGetTargets(data) {
    if (!data.callback) return;
    
    const targetMeshes = [];
    
    // Get all other player meshes
    this.entities.forEach(entity => {
      if (entity.type === 'otherPlayer' && entity.mesh) {
        targetMeshes.push(entity.mesh);
      }
    });
    
    // Call the callback with the array of meshes
    data.callback(targetMeshes);
  }
  
  /**
   * Handle combat damage event
   * @param {Object} data - Damage event data
   * @private
   */
  _handleDamage(data) {
    const { targetId, damage, attackerId, attackType } = data;
    
    // Find the target entity
    const targetEntity = this.getEntity(targetId);
    
    if (!targetEntity) {
      console.warn(`Target entity ${targetId} not found for damage event`);
      return;
    }
    
    // Apply damage
    if (typeof targetEntity.takeDamage === 'function') {
      const remainingHealth = targetEntity.takeDamage(damage);
      
      // Log damage
      console.log(`${attackerId} hit ${targetId} with ${attackType} for ${damage} damage (${remainingHealth} HP remaining)`);
      
      // Create floating damage text
      this._createDamageText(targetEntity.position, damage);
      
      // Check if target died
      if (remainingHealth <= 0) {
        console.log(`${targetId} was defeated!`);
      }
    }
  }
  
  /**
   * Handle get entity request
   * @param {Object} data - Request data
   * @private
   */
  _handleGetEntity(data) {
    const { id, callback } = data;
    
    if (!callback) return;
    
    const entity = this.getEntity(id);
    callback(entity);
  }
  
  /**
   * Handle player attack event from network
   * @param {Object} data - Attack data from server
   * @private
   */
  _handlePlayerAttacked(data) {
    console.log(`Received attack event: Player ${data.id} attacked ${data.targetId} for ${data.damage} damage`);
    
    // Find the attacker entity
    const attacker = this.getEntity(data.id);
    
    // Always show attack effect for any attack - this allows spectators to see attacks too
    if (attacker) {
      // Find the target entity
      const target = this.getEntity(data.targetId);
      if (target) {
        // Create visual attack effect between attacker and target
        this._showAttackEffectBetweenEntities(attacker, target, data);
      }
    }
    
    // NOTE: We're no longer applying damage directly here.
    // Instead, we'll rely on the playerHealthChanged event from the server
    // which will be handled by _handlePlayerHealthChanged for all players including local player
    
    // The health changes and damage effects will be processed uniformly for all entities
    // when we receive the playerHealthChanged event from the server
  }
  
  /**
   * Show attack effect between any two entities
   * @param {Entity} attacker - Attacking entity
   * @param {Entity} target - Target entity
   * @param {Object} data - Attack data
   * @private
   */
  _showAttackEffectBetweenEntities(attacker, target, data) {
    // Determine correct effect based on attacker class
    let geometry, material;
    const attackerClass = attacker.classType || 'WARRIOR';
    
    switch (attackerClass) {
      case 'CLERK':
        // Magic bolt (blue sphere)
        geometry = new THREE.SphereGeometry(0.3, 8, 8);
        material = new THREE.MeshBasicMaterial({ 
          color: 0x00aaff,
          transparent: true,
          opacity: 0.7
        });
        break;
        
      case 'WARRIOR':
        // Melee swing (red arc)
        geometry = new THREE.TorusGeometry(0.7, 0.1, 8, 16, Math.PI);
        material = new THREE.MeshBasicMaterial({ 
          color: 0xff3300,
          transparent: true,
          opacity: 0.7
        });
        break;
        
      case 'RANGER':
        // Arrow (green cylinder)
        geometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
        material = new THREE.MeshBasicMaterial({ 
          color: 0x33cc33,
          transparent: true,
          opacity: 0.7
        });
        break;
        
      default:
        // Generic effect
        geometry = new THREE.SphereGeometry(0.3, 8, 8);
        material = new THREE.MeshBasicMaterial({ 
          color: 0xffffff,
          transparent: true,
          opacity: 0.7
        });
    }
    
    const attackEffect = new THREE.Mesh(geometry, material);
    
    // Position initially at attacker
    const startPos = attacker.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    attackEffect.position.copy(startPos);
    
    // For melee attacks, rotate appropriately
    if (attackerClass === 'WARRIOR') {
      attackEffect.position.copy(attacker.position.clone().add(new THREE.Vector3(0, 0.5, -0.5)));
      
      // Orient toward target
      const direction = new THREE.Vector3().subVectors(target.position, attacker.position).normalize();
      const angle = Math.atan2(direction.x, direction.z);
      attackEffect.rotation.set(Math.PI/2, 0, angle);
    } else if (attackerClass === 'RANGER') {
      // Orient arrow toward target
      const direction = new THREE.Vector3().subVectors(target.position, attacker.position).normalize();
      const arrowAngle = Math.atan2(direction.x, direction.z);
      attackEffect.rotation.set(Math.PI/2, 0, arrowAngle);
    }
    
    // Add to scene
    renderer.addObject(`attack-${attacker.id}-${Date.now()}`, attackEffect, true, 0.5);
    
    // For ranged attacks, animate projectile
    if (attackerClass === 'CLERK' || attackerClass === 'RANGER') {
      const targetPos = target.position.clone().add(new THREE.Vector3(0, 0.5, 0));
      const startTime = Date.now();
      const distance = startPos.distanceTo(targetPos);
      const duration = Math.min(0.5, distance * 0.1);
      
      const animateProjectile = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(1, elapsed / duration);
        
        if (progress < 1) {
          // Interpolate position
          attackEffect.position.lerpVectors(startPos, targetPos, progress);
          requestAnimationFrame(animateProjectile);
        }
      };
      
      // Start animation
      animateProjectile();
    }
  }
  
  /**
   * Handle player health changed event from network
   * @param {Object} data - Health data from server
   * @private
   */
  _handlePlayerHealthChanged(data) {
    console.log("Health change event received:", data);
    
    // Handle local player health changes
    if (this.player && data.id === this.player.id) {
      console.log("Received health change event for our player");
      
      const oldHealth = this.player.health;
      // Update our own health
      this.player.health = data.health;
      
      console.log(`LOCAL PLAYER HEALTH UPDATED: ${oldHealth} -> ${data.health}`);
      
      // CRITICAL: Use Game.js for health UI updates if available
      if (window.game && typeof window.game.updateHealthUI === 'function') {
        console.log(`CRITICAL: EntityManager directly calling game.updateHealthUI with ${this.player.health}/${this.player.stats.health}`);
        window.game.updateHealthUI(this.player.health, this.player.stats.health);
        
        // Also dispatch a custom DOM event for any other listeners
        const healthChangedEvent = new CustomEvent('player-health-changed', {
          detail: {
            id: this.player.id,
            health: this.player.health,
            maxHealth: this.player.stats.health,
            damage: data.damage || 0
          }
        });
        document.dispatchEvent(healthChangedEvent);
      }
      
      // DIRECT DOM MANIPULATION FOR HEALTH UI
      // This bypasses the player._updateHealthUI method for critical updates
      
      // Make sure game UI is visible
      const gameUI = document.getElementById('game-ui');
      if (gameUI && !gameUI.classList.contains('visible')) {
        console.log("Making game UI visible");
        gameUI.classList.add('visible');
      }
      
      // Get the health elements
      const healthFill = document.getElementById('health-fill');
      const playerStats = document.getElementById('player-stats');
      
      // Calculate health percentage
      const validHealth = this.player.health;
      const maxHealth = this.player.stats.health;
      const percentage = Math.max(0, Math.min(100, (validHealth / maxHealth) * 100));
      
      console.log(`CRITICAL UI UPDATE: Setting health to ${validHealth}/${maxHealth} (${percentage}%)`);
      
      // Update health fill bar directly
      if (healthFill) {
        // Force immediate style update
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
        
        console.log(`Health bar width set to ${percentage}%`);
      } else {
        console.error("CRITICAL FAILURE: Could not find health-fill element!");
      }
      
      // Update player stats text
      if (playerStats) {
        playerStats.textContent = `Health: ${Math.round(validHealth)}/${maxHealth}`;
        console.log(`Player stats text updated to: ${playerStats.textContent}`);
      } else {
        console.error("CRITICAL FAILURE: Could not find player-stats element!");
      }
      
      // Show damage effect if it was from another player
      if (data.attackerId && data.attackerId !== this.player.id && oldHealth > data.health) {
        this.player._playDamageEffect();
        
        // Show damage text
        this._createDamageText(this.player.position, oldHealth - data.health);
      }
      
      // Check for death and show death effect if appropriate
      if (data.health <= 0 && oldHealth > 0) {
        console.log("Player died from health change event");
        
        // Add specific handling to make the player mesh invisible
        if (this.player.mesh) {
          this.player.mesh.visible = false;
        }
        
        // Show death effect after ensuring mesh is hidden
        this.player._showDeathEffect();
      }
      
      return;
    }
    
    // Handle other player health changes
    const player = this.getEntity(data.id);
    if (player) {
      // Set player health
      const oldHealth = player.health || (player.stats ? player.stats.health : 100);
      player.health = data.health;
      
      console.log(`Player ${data.id} health changed from ${oldHealth} to ${data.health}`);
      
      // Update health bar
      if (player.type === 'otherPlayer') {
        // Update health bar visualization
        if (typeof player._createHealthIndicator === 'function') {
          player._createHealthIndicator();
        }
        
        // If health decreased, show damage effect
        if (oldHealth > data.health) {
          if (typeof player._flashDamage === 'function') {
            player._flashDamage();
          }
          this._createDamageText(player.position, oldHealth - data.health);
        }
        
        // Check for death
        if (data.health <= 0 && oldHealth > 0) {
          if (typeof player._showDeathEffect === 'function') {
            player._showDeathEffect();
          }
        }
      }
    }
  }
  
  /**
   * Handle player died event from network
   * @param {Object} data - Death data from server
   * @private
   */
  _handlePlayerDied(data) {
    console.log(`Received player death event for ${data.id}`);
    
    // Check if it's the local player
    if (this.player && data.id === this.player.id) {
      console.log("⚠️ LOCAL PLAYER DIED - PROCESSING DEATH EFFECT ⚠️");
      
      // Set player health to 0 (important to update the actual property)
      this.player.health = 0;
      
      // CRITICAL: First hide the mesh to ensure it's not visible
      if (this.player.mesh) {
        console.log("Making player mesh invisible on death");
        this.player.mesh.visible = false;
      }
      
      // ENSURE GAME UI IS UPDATED FOR DEATH
      // Make sure game UI is visible
      const gameUI = document.getElementById('game-ui');
      if (gameUI && !gameUI.classList.contains('visible')) {
        console.log("Making game UI visible");
        gameUI.classList.add('visible');
      }
      
      // Direct DOM updates for health bar and stats
      const healthFill = document.getElementById('health-fill');
      const playerStats = document.getElementById('player-stats');
      
      if (healthFill) {
        console.log("CRITICAL: Setting health bar to 0%");
        // Force immediate update
        healthFill.style.transition = 'none';
        healthFill.style.width = '0%';
        healthFill.style.backgroundColor = '#e74c3c'; // Red
        healthFill.offsetHeight; // Force reflow
      } else {
        console.error("CRITICAL ERROR: Could not find health-fill element on death!");
        // Try to recreate it
        const healthBar = document.querySelector('.health-bar');
        if (healthBar) {
          console.log("Recreating missing health fill element");
          const newHealthFill = document.createElement('div');
          newHealthFill.id = 'health-fill';
          newHealthFill.className = 'health-fill';
          newHealthFill.style.width = '0%';
          newHealthFill.style.backgroundColor = '#e74c3c';
          healthBar.innerHTML = '';
          healthBar.appendChild(newHealthFill);
        }
      }
      
      if (playerStats) {
        console.log("CRITICAL: Setting player stats text to show 0 health");
        playerStats.textContent = `Health: 0/${this.player.stats.health}`;
      } else {
        console.error("CRITICAL ERROR: Could not find player-stats element on death!");
      }
      
      // Show death effects
      console.log("Showing player death particles");
      // Call _createDeathParticles directly to ensure particles are shown
      this.player._createDeathParticles();
      
      // Ensure all pending health updates are applied before showing death screen
      setTimeout(() => {
        console.log("Showing death overlay screen");
        // Then show the full death overlay
        this.player._showDeathEffect();
      }, 50);
      
      return;
    }
    
    // Handle other player death
    const player = this.getEntity(data.id);
    if (player) {
      console.log(`Other player ${data.id} died`);
      
      // Set player health to 0
      player.health = 0;
      
      // Update visuals
      if (player.type === 'otherPlayer') {
        // Update health bar
        if (typeof player._createHealthIndicator === 'function') {
          player._createHealthIndicator();
        }
        
        // Show death effect
        if (typeof player._showDeathEffect === 'function') {
          player._showDeathEffect();
        } else {
          // Fallback: hide mesh and show particles
          if (player.mesh) {
            player.mesh.visible = false;
          }
          
          // Create death particles at player position
          this._createDeathParticles(player.position.clone());
        }
      }
      
      console.log(`Death effect shown for player ${data.id}`);
    }
  }
  
  /**
   * Create death particle effect
   * @param {THREE.Vector3} position - Position for the effect
   * @private
   */
  _createDeathParticles(position) {
    // Create particles
    const particleCount = 20;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.SphereGeometry(0.1, 4, 4);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
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
    particles.position.copy(position);
    
    // Add to scene
    renderer.addObject(`death-particles-${Date.now()}`, particles, true, 2);
    
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
   * Handle player respawned event from network
   * @param {Object} data - Respawn data from server
   * @private
   */
  _handlePlayerRespawned(data) {
    console.log(`Received player respawn event for ${data.id}`, data);
    
    // Handle local player respawn
    if (this.player && data.id === this.player.id) {
      console.log("Local player respawned from network event");
      
      // Set player health
      this.player.health = data.health || this.player.stats.health;
      
      // Update UI
      this.player._updateHealthUI();
      
      // Update position if provided
      if (data.position) {
        this.player.setPosition(
          data.position.x,
          data.position.y,
          data.position.z
        );
      }
      
      // Force health UI update
      const healthFill = document.getElementById('health-fill');
      if (healthFill) {
        const percentage = 100; // Full health on respawn
        healthFill.style.width = `${percentage}%`;
        healthFill.style.backgroundColor = '#2ecc71'; // Green
      }
      
      return;
    }
    
    // Handle other player respawn
    const player = this.getEntity(data.id);
    if (player) {
      console.log(`Other player ${data.id} respawned with health=${data.health}`);
      
      // Reset health
      player.health = data.health || (player.stats ? player.stats.health : 100);
      
      // CRITICAL: Handle all player types including our own player
      // Update mesh visibility and position
      if (player.mesh) {
        console.log(`Making player ${data.id} mesh visible again`);
        player.mesh.visible = true;
      } else {
        console.warn(`Player ${data.id} has no mesh on respawn`);
      }
      
      // Update position
      if (data.position) {
        player.position.set(
          data.position.x,
          data.position.y,
          data.position.z
        );
        
        // Update mesh position
        if (player.mesh) {
          player.mesh.position.copy(player.position);
        }
      }
      
      // Additional handling for other players
      if (player.type === 'otherPlayer') {
        // Update health bar
        if (typeof player._createHealthIndicator === 'function') {
          player._createHealthIndicator();
        }
      }
      
      // Create respawn effect
      this._createRespawnEffect(player.position.clone());
      
      console.log(`Player ${data.id} fully respawned and visible at position ${JSON.stringify(data.position)}`);
    }
  }
  
  /**
   * Create respawn effect
   * @param {THREE.Vector3} position - Position for the effect
   * @private
   */
  _createRespawnEffect(position) {
    // Create a light burst effect
    const respawnLight = new THREE.PointLight(0x00ffff, 5, 3);
    respawnLight.position.copy(position);
    respawnLight.position.y += 0.5;
    
    // Add to scene
    renderer.addObject(`respawn-light-${Date.now()}`, respawnLight, true, 1);
    
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
    particles.position.copy(position);
    particles.position.y += 0.2;
    
    // Add to scene
    renderer.addObject(`respawn-particles-${Date.now()}`, particles, true, 1);
    
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
    animateParticles();
  }
  
  /**
   * Show attack effect for network attack
   * @param {Object} attackData - Attack data
   * @private
   */
  _showNetworkAttackEffect(attackData) {
    const attacker = this.getEntity(attackData.id);
    if (!attacker || !this.player) return;
    
    let geometry, material, mesh;
    
    // Create effect based on attacker class
    switch (attacker.classType) {
      case 'CLERK':
        // Magic bolt (blue sphere)
        geometry = new THREE.SphereGeometry(0.3, 8, 8);
        material = new THREE.MeshBasicMaterial({ 
          color: 0x00aaff,
          transparent: true,
          opacity: 0.7
        });
        break;
        
      case 'WARRIOR':
        // Melee swing (red arc)
        geometry = new THREE.TorusGeometry(0.7, 0.1, 8, 16, Math.PI);
        material = new THREE.MeshBasicMaterial({ 
          color: 0xff3300,
          transparent: true,
          opacity: 0.7
        });
        break;
        
      case 'RANGER':
        // Arrow (green cylinder)
        geometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
        material = new THREE.MeshBasicMaterial({ 
          color: 0x33cc33,
          transparent: true,
          opacity: 0.7
        });
        break;
        
      default:
        // Generic effect
        geometry = new THREE.SphereGeometry(0.3, 8, 8);
        material = new THREE.MeshBasicMaterial({ 
          color: 0xffffff,
          transparent: true,
          opacity: 0.7
        });
    }
    
    mesh = new THREE.Mesh(geometry, material);
    
    // Position between attacker and target
    const direction = new THREE.Vector3().subVectors(
      this.player.position,
      attacker.position
    ).normalize();
    
    const startPos = attacker.position.clone().add(
      new THREE.Vector3(0, 0.5, 0)
    );
    
    mesh.position.copy(startPos);
    
    // Add to scene
    eventBus.emit('renderer.addObject', {
      id: `attack-${attackData.id}-${Date.now()}`,
      object: mesh,
      temporary: true,
      duration: 0.5
    });
    
    // Animate the projectile
    const targetPos = this.player.position.clone().add(
      new THREE.Vector3(0, 0.5, 0)
    );
    
    // Duration based on distance
    const distance = startPos.distanceTo(targetPos);
    const duration = Math.min(0.5, distance * 0.1);
    const startTime = Date.now();
    
    const animateProjectile = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(1, elapsed / duration);
      
      if (progress < 1) {
        // Interpolate position
        mesh.position.lerpVectors(startPos, targetPos, progress);
        requestAnimationFrame(animateProjectile);
      }
    };
    
    // Start animation
    requestAnimationFrame(animateProjectile);
  }
  
  /**
   * Create a floating damage text
   * @param {THREE.Vector3} position - World position
   * @param {number} damage - Damage amount
   * @private
   */
  _createDamageText(position, damage) {
    if (!position || !window.currentCamera) {
      console.warn('Cannot create damage text: missing position or camera');
      return;
    }
    
    // Ensure we have valid position
    if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
      console.warn('Cannot create damage text: position contains NaN values');
      return;
    }
    
    // Create damage text using HTML
    const damageElement = document.createElement('div');
    damageElement.className = 'damage-text';
    damageElement.textContent = damage.toString();
    damageElement.style.color = '#ff0000';
    damageElement.style.position = 'absolute';
    damageElement.style.fontSize = '24px';
    damageElement.style.fontWeight = 'bold';
    damageElement.style.textShadow = '2px 2px 2px rgba(0,0,0,0.5)';
    damageElement.style.pointerEvents = 'none';
    
    // Add to DOM
    document.body.appendChild(damageElement);
    
    // Position in world space
    const updatePosition = () => {
      try {
        // Make a safe copy of the position with default values if NaN
        const safePosition = new THREE.Vector3(
          isNaN(position.x) ? 0 : position.x,
          isNaN(position.y) ? 0 : position.y,
          isNaN(position.z) ? 0 : position.z
        );
        
        // Convert world position to screen coordinates
        const worldPos = safePosition.clone().add(new THREE.Vector3(0, 1.5, 0));
        const screenPos = worldPos.clone().project(window.currentCamera);
        
        // Check for NaN values after projection
        if (isNaN(screenPos.x) || isNaN(screenPos.y)) {
          damageElement.style.left = '50%';
          damageElement.style.top = '50%';
          return;
        }
        
        const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
        
        damageElement.style.left = `${x}px`;
        damageElement.style.top = `${y}px`;
      } catch (err) {
        console.warn('Error updating damage text position:', err);
        // Fallback to center screen
        damageElement.style.left = '50%';
        damageElement.style.top = '50%';
      }
    };
    
    // Initial position
    updatePosition();
    
    // Animate the damage text
    let startTime = Date.now();
    let duration = 1000; // 1 second
    
    const animate = () => {
      try {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Update position (floating upward if position is valid)
        if (!isNaN(position.y)) {
          position.y += 0.01;
        }
        updatePosition();
        
        // Fade out
        damageElement.style.opacity = (1 - progress).toString();
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Remove element when animation completes
          if (document.body.contains(damageElement)) {
            document.body.removeChild(damageElement);
          }
        }
      } catch (err) {
        console.warn('Error animating damage text:', err);
        // Clean up in case of error
        if (document.body.contains(damageElement)) {
          document.body.removeChild(damageElement);
        }
      }
    };
    
    // Start animation
    requestAnimationFrame(animate);
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Remove event listeners
    eventBus.off('network.existingPlayers', this._boundHandleExistingPlayers);
    eventBus.off('network.playerJoined', this._boundHandlePlayerJoined);
    eventBus.off('network.playerLeft', this._boundHandlePlayerLeft);
    eventBus.off('renderer.beforeRender', this._boundUpdate);
    
    // Remove combat event listeners
    eventBus.off('combat.getTargets');
    eventBus.off('combat.damage');
    eventBus.off('entityManager.getEntity');
    eventBus.off('network.playerAttacked');
    eventBus.off('network.playerHealthChanged');
    eventBus.off('network.playerDied');
    eventBus.off('network.playerRespawned');
    
    // Remove all entities
    this.entities.forEach((entity, id) => {
      this.removeEntity(id);
    });
    
    this.player = null;
  }
}

// Create singleton instance
const entityManager = new EntityManager();

export default entityManager;