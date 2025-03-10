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
    eventBus.on('network.playerMoved', this._handlePlayerMoved.bind(this));
    eventBus.on('network.playerAttacked', this._handlePlayerAttacked.bind(this));
    eventBus.on('network.playerHealthChanged', this._handlePlayerHealthChanged.bind(this));
    eventBus.on('network.playerDied', this._handlePlayerDied.bind(this));
    eventBus.on('network.playerRespawned', this._handlePlayerRespawned.bind(this));
    eventBus.on('network.playerAttackMissed', this._handlePlayerAttackMissed.bind(this));
    
    // Set up render update cycle
    eventBus.on('renderer.beforeRender', this._boundUpdate);
    
    // Set up combat event listeners
    eventBus.on('combat.getTargets', this._handleGetTargets.bind(this));
    eventBus.on('combat.getEntity', this._handleGetEntity.bind(this));
    eventBus.on('combat.attackRequested', this._handleAttackRequested.bind(this));
    
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
    
    // Set up entity type access event handler
    eventBus.on('entityManager.getEntitiesByType', this._handleGetEntitiesByType.bind(this));
    
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
   * @param {Object} data - Update data
   * @private
   */
  update(data) {
    const deltaTime = data.deltaTime || 0;
    
    // Update all entities
    this.entities.forEach(entity => {
      if (typeof entity.update === 'function') {
        entity.update(deltaTime);
      }
      
      // Update billboards to face camera
      if (entity.mesh) {
        // Check for health bar or other billboards
        entity.mesh.traverse(child => {
          if (child.userData && child.userData.isBillboard && window.currentCamera) {
            // Make the object face the camera
            child.lookAt(window.currentCamera.position);
          }
        });
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
   * Handle get entity request
   * @param {Object} data - Request data
   * @private
   */
  _handleGetEntity(data) {
    if (!data || !data.id || typeof data.callback !== 'function') {
      console.warn('Invalid getEntity request: missing id or callback');
      return;
    }
    
    const entity = this.getEntity(data.id);
    console.log(`EntityManager: getEntity request for ID ${data.id}, found: ${!!entity}`);
    
    // Call the callback with the entity (or null if not found)
    data.callback(entity);
  }
  
  /**
   * Handle attack requested event from player
   * @param {Object} data - Attack request data from player
   * @private
   */
  _handleAttackRequested(data) {
    console.log(`Attack requested: Player ${data.attackerId} targeting ${data.targetId}`);
    
    // Find the attacker entity
    const attacker = this.getEntity(data.attackerId);
    if (!attacker) return;
    
    // Find the target entity
    const target = this.getEntity(data.targetId);
    if (!target) return;
    
    // Show visual attack effect immediately (even though damage is not applied yet)
    // This gives instant visual feedback to the player
    this._showAttackEffectBetweenEntities(attacker, target, data);
    
    // IMPORTANT: No damage is applied here - we wait for server confirmation
    console.log(`Attack visual effect shown - waiting for server to confirm damage`);
  }
  
  /**
   * Handle player attack event from network
   * @param {Object} data - Attack data from server
   * @private
   */
  _handlePlayerAttacked(data) {
    console.log(`Received attack event: Player ${data.id} attacked ${data.targetId} for ${data.damage} damage`);
    
    // Find the attacker entity
    let attacker = this.getEntity(data.id);
    if (!attacker) {
      console.warn(`Attacker with ID ${data.id} not found, creating a placeholder for visual effects`);
      
      // Try to get attacker data from WebSocketManager's otherPlayers
      let attackerData = null;
      if (window.game && window.game.networkManager && window.game.networkManager.otherPlayers) {
        attackerData = window.game.networkManager.otherPlayers[data.id];
      }
      
      // Create a temporary placeholder attacker for visual effects
      attacker = {
        id: data.id,
        position: attackerData?.position || { x: 0, y: 0, z: 0 },
        classType: attackerData?.class || 'WARRIOR',
        mesh: null
      };
    }
    
    // Find the target entity
    let target = this.getEntity(data.targetId);
    if (!target) {
      console.warn(`Target with ID ${data.targetId} not found`);
      
      // Try to find the target using a direct lookup from all entities
      console.log(`Attempting to find target ${data.targetId} using direct entity lookup...`);
      this.entities.forEach((entity) => {
        if (entity.id === data.targetId) {
          target = entity;
          console.log(`Found target ${data.targetId} using direct lookup`);
        }
      });
      
      // If still not found, try to get target data from WebSocketManager's otherPlayers
      if (!target && window.game && window.game.networkManager && window.game.networkManager.otherPlayers) {
        const targetData = window.game.networkManager.otherPlayers[data.targetId];
        if (targetData) {
          console.log(`Found target ${data.targetId} in WebSocketManager's otherPlayers`);
          
          // Create a temporary placeholder target for visual effects
          target = {
            id: data.targetId,
            position: targetData.position || { x: 0, y: 0, z: 0 },
            classType: targetData.class || 'WARRIOR',
            mesh: null,
            health: targetData.health || 100,
            stats: targetData.stats || { health: 100 }
          };
        }
      }
      
      if (!target) {
        console.error(`Target ${data.targetId} not found even with fallback methods`);
        return;
      }
    }
    
    // Process the attack with the found target
    this._processAttackWithTarget(attacker, target, data);
  }
  
  /**
   * Process an attack with a valid target
   * @param {Entity} attacker - The attacking entity
   * @param {Entity} target - The target entity
   * @param {Object} data - Attack data
   * @private
   */
  _processAttackWithTarget(attacker, target, data) {
    // Always show attack effect between attacker and target for visual feedback
    this._showAttackEffectBetweenEntities(attacker, target, data);
    
    // Check if this is just for local visual feedback
    if (data.isLocalVisualOnly) {
      console.log("This is a local visual-only attack event - not applying damage");
      return;
    }
    
    // Determine if attack should be processed (inRange !== false)
    // This handles both explicitly true and undefined cases for backward compatibility
    const shouldProcessAttack = data.inRange !== false;
    
    // Only process damage if the attack is valid
    if (shouldProcessAttack) {
      console.log(`Processing attack damage - Attack is in range`);
      
      // If this is a warrior and they're the local player, grant mana bonus now
      if (attacker === this.player && attacker.classType === 'WARRIOR') {
        // Apply warrior mana gain on confirmed hit
        const manaGain = attacker.manaUsage?.WARRIOR?.regenBonus?.onHit || 10;
        attacker.mana = Math.min(attacker.maxMana, attacker.mana + manaGain);
        console.log(`Warrior gained ${manaGain} mana from landing a confirmed hit. Current mana: ${attacker.mana.toFixed(1)}`);
        if (typeof attacker._emitManaChange === 'function') {
          attacker._emitManaChange();
        }
      }
      
      // Apply damage to target if it's not the local player
      // (local player damage is handled by WebSocketManager and Game)
      if (target !== this.player && typeof target.takeDamage === 'function') {
        console.log(`Applying damage to non-local target: ${data.damage}`);
        target.takeDamage(data.damage, true);
        
        // Create floating damage text
        this._createDamageText(target.position, data.damage);
      } else if (target === this.player) {
        console.log(`Local player is the target - damage should be handled by WebSocketManager`);
      } else {
        console.warn(`Target entity doesn't have takeDamage method`);
        
        // DIRECT APPROACH: Just use the takeDamage method
        if (typeof target.takeDamage === 'function') {
          target.takeDamage(data.damage);
        } else {
          // Fallback for entities without takeDamage
          console.warn(`Using fallback damage application for entity ${target.id}`);
          
          // Update health directly if possible
          if (target.health !== undefined) {
            const oldHealth = target.health;
            target.health = Math.max(0, target.health - data.damage);
            console.log(`Applied damage directly: ${oldHealth} -> ${target.health}`);
            
            // Update health bar if it exists
            if (target.mesh) {
              target.mesh.traverse(child => {
                if (child.userData && child.userData.isHealthBar) {
                  const healthPercent = target.health / target.stats.health;
                  child.scale.x = Math.max(0.01, healthPercent);
                  
                  // Update color based on health percentage
                  if (child.material) {
                    if (healthPercent > 0.6) {
                      child.material.color.setHex(0x00ff00); // Green
                    } else if (healthPercent > 0.3) {
                      child.material.color.setHex(0xffff00); // Yellow
                    } else {
                      child.material.color.setHex(0xff0000); // Red
                    }
                  }
                }
              });
            }
          }
        }
      }
    } else {
      console.log(`Attack not processed - explicitly out of range`);
      
      // Show missed attack effect
      this._showMissedAttackEffect(attacker, target, data);
    }
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
    
    // Find the entity by ID
    const entity = this.getEntity(data.id);
    if (!entity) {
      console.warn(`Entity with ID ${data.id} not found for health change event`);
      return;
    }
    
    // Store old health for logging
    const oldHealth = entity.health || 0;
    const newHealth = data.health;
    const damage = data.damage || (oldHealth > newHealth ? oldHealth - newHealth : 0);
    
    console.log(`Entity ${data.id} health update: ${oldHealth} -> ${newHealth} (damage: ${damage})`);
    
    // Handle local player health changes separately
    if (entity === this.player) {
      console.log("Received health change event for our player");
      
      // Update player's health property
      this.player.health = newHealth;
      
      // Use Game.js for health UI updates if available
      if (window.game && typeof window.game.updateHealthUI === 'function') {
        console.log(`EntityManager calling game.updateHealthUI with ${newHealth}/${this.player.stats.health}`);
        window.game.updateHealthUI(newHealth, this.player.stats.health);
        
        // Dispatch a custom DOM event for any other listeners
        const healthChangedEvent = new CustomEvent('player-health-changed', {
          detail: {
            id: this.player.id,
            health: newHealth,
            maxHealth: this.player.stats.health,
            damage: damage
          }
        });
        document.dispatchEvent(healthChangedEvent);
      }
      
      // Update player's own UI method
      if (typeof this.player._updateHealthUI === 'function') {
        this.player._updateHealthUI();
      }
      
      // Play damage effect if it was damage (not healing)
      if (damage > 0 && typeof this.player._playDamageEffect === 'function') {
        this.player._playDamageEffect();
      }
    } else {
      // This is another player (not the local player)
      console.log(`Applying damage to other player (${data.id}): ${damage}`);
      
      // DIRECT APPROACH: Just use the takeDamage method
      if (typeof entity.takeDamage === 'function') {
        entity.takeDamage(damage);
      } else {
        // Fallback for entities without takeDamage
        entity.health = newHealth;
        
        // Create floating damage text
        if (damage > 0) {
          this._createDamageText(entity.position, damage);
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
        console.log(`Processing death for other player ${data.id}`);
        
        // Update health bar
        if (typeof player._createHealthIndicator === 'function') {
          console.log(`Updating health indicator for ${data.id} to show 0 health`);
          player._createHealthIndicator();
        }
        
        // Hide the mesh immediately
        if (player.mesh) {
          console.log(`Hiding mesh for player ${data.id}`);
          player.mesh.visible = false;
        }
        
        // Show death effect
        if (typeof player._showDeathEffect === 'function') {
          console.log(`Showing death effect for player ${data.id}`);
          player._showDeathEffect();
        } else {
          console.warn(`Player ${data.id} doesn't have _showDeathEffect method, using fallback`);
          // Fallback: create death particles at player position
          this._createDeathParticles(player.position.clone());
        }
        
        // Create a text effect showing "DESTROYED"
        this._createDestroyedText(player.position.clone());
      } else {
        console.log(`Player ${data.id} is not an otherPlayer (type: ${player.type}), using basic death handling`);
        
        // Basic handling for non-otherPlayer entities
        if (player.mesh) {
          player.mesh.visible = false;
        }
        
        // Create death particles at player position
        this._createDeathParticles(player.position.clone());
      }
      
      console.log(`Death effect shown for player ${data.id}`);
    } else {
      console.warn(`Player ${data.id} not found for death effect`);
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
    eventBus.off('combat.getTargets');
    eventBus.off('combat.getEntity');
    eventBus.off('combat.attackRequested');
    
    eventBus.off('network.existingPlayers');
    eventBus.off('network.playerJoined');
    eventBus.off('network.playerLeft');
    eventBus.off('network.playerMoved');
    eventBus.off('network.playerAttacked');
    eventBus.off('network.playerHealthChanged');
    eventBus.off('network.playerDied');
    eventBus.off('network.playerRespawned');
    eventBus.off('network.playerAttackMissed');
    
    // Remove all entities
    this.entities.forEach((entity, id) => {
      this.removeEntity(id);
    });
    
    this.player = null;
  }

  /**
   * Handle player movement from network
   * @param {Object} data - Movement data {id, position}
   * @private
   */
  _handlePlayerMoved(data) {
    // Ignore if it's our own player (we handle our own movement)
    if (this.player && data.id === this.player.id) {
      return;
    }
    
    // Get the entity
    const entity = this.getEntity(data.id);
    if (entity) {
      // Update position
      entity.setPosition(data.position.x, data.position.y, data.position.z);
    } else {
      // If entity doesn't exist yet, create it
      console.log(`Entity not found for movement update: ${data.id}, creating placeholder`);
      
      // Create a placeholder entity with minimal data
      const placeholderData = {
        id: data.id,
        position: data.position,
        class: 'WARRIOR', // Default class
        stats: CHARACTER_CLASSES.WARRIOR,
        type: 'otherPlayer'
      };
      
      this._createOtherPlayer(placeholderData);
    }
  }

  /**
   * Handle player attack missed event from network
   * @param {Object} data - Attack missed data
   * @private
   */
  _handlePlayerAttackMissed(data) {
    console.log(`Attack missed: Player ${data.id} tried to attack ${data.targetId} but failed: ${data.reason}`);
    
    // Find the attacker entity
    const attacker = this.getEntity(data.id);
    if (!attacker) return;
    
    // Find the target entity (might not exist if target disconnected)
    const target = this.getEntity(data.targetId);
    
    // Show missed attack effect
    this._showMissedAttackEffect(attacker, target, data);
  }

  /**
   * Show missed attack effect
   * @param {Entity} attacker - Attacking entity
   * @param {Entity} target - Target entity (may be null)
   * @param {Object} data - Attack data
   * @private
   */
  _showMissedAttackEffect(attacker, target, data) {
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
          opacity: 0.5
        });
        break;
        
      case 'WARRIOR':
        // Melee swing (red arc)
        geometry = new THREE.TorusGeometry(0.7, 0.1, 8, 16, Math.PI);
        material = new THREE.MeshBasicMaterial({ 
          color: 0xff3300,
          transparent: true,
          opacity: 0.5
        });
        break;
        
      case 'RANGER':
        // Arrow (green cylinder)
        geometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
        material = new THREE.MeshBasicMaterial({ 
          color: 0x33cc33,
          transparent: true,
          opacity: 0.5
        });
        break;
        
      default:
        // Generic effect
        geometry = new THREE.SphereGeometry(0.3, 8, 8);
        material = new THREE.MeshBasicMaterial({ 
          color: 0xaaaaaa,
          transparent: true,
          opacity: 0.5
        });
    }
    
    const attackEffect = new THREE.Mesh(geometry, material);
    
    // Position initially at attacker
    const startPos = attacker.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    attackEffect.position.copy(startPos);
    
    // For melee attacks, just place in front of attacker
    if (attackerClass === 'WARRIOR') {
      attackEffect.position.copy(attacker.position.clone().add(new THREE.Vector3(0, 0.5, -0.5)));
      attackEffect.rotation.set(Math.PI/2, 0, 0);
    }
    
    // Add to scene
    eventBus.emit('renderer.addObject', {
      id: `attack-miss-${attacker.id}-${Date.now()}`,
      object: attackEffect,
      temporary: true,
      duration: 0.5
    });
    
    // For ranged attacks, animate projectile to maximum range and dissipate
    if ((attackerClass === 'CLERK' || attackerClass === 'RANGER') && data.maxRange) {
      // Create direction vector - ideally this would point toward target
      // but if no target, just point forward from attacker
      let targetDirection;
      
      if (target) {
        // Direction toward target
        targetDirection = new THREE.Vector3().subVectors(target.position, attacker.position).normalize();
      } else {
        // Default direction (forward relative to attacker)
        targetDirection = new THREE.Vector3(0, 0, -1);
      }
      
      // Calculate end position at maximum range
      const endPos = startPos.clone().add(
        targetDirection.multiplyScalar(data.maxRange)
      );
      
      // Start animation
      const startTime = Date.now();
      const duration = Math.min(0.8, data.maxRange * 0.1); // Slower animation to show the miss
      
      const animateProjectile = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(1, elapsed / duration);
        
        if (progress < 1) {
          // Interpolate position
          attackEffect.position.lerpVectors(startPos, endPos, progress);
          
          // Add slight gravity effect for arrows
          if (attackerClass === 'RANGER' && progress > 0.7) {
            attackEffect.position.y -= 0.05 * (progress - 0.7) / 0.3;
          }
          
          // Continue animation
          requestAnimationFrame(animateProjectile);
        } else {
          // At maximum range, create a "fizzle" effect
          this._createFizzleEffect(endPos, attackerClass);
        }
      };
      
      // Start animation
      requestAnimationFrame(animateProjectile);
    }
  }

  /**
   * Create a fizzle effect at the point where projectile dissipates
   * @param {THREE.Vector3} position - Position for effect
   * @param {string} attackerClass - Class of attacker
   * @private
   */
  _createFizzleEffect(position, attackerClass) {
    // Create particles for fizzle effect
    const count = 10;
    const radius = 0.1;
    
    // Color based on attack type
    let color;
    switch (attackerClass) {
      case 'CLERK': color = 0x00aaff; break;
      case 'RANGER': color = 0x33cc33; break;
      default: color = 0xffffff;
    }
    
    // Create particles
    for (let i = 0; i < count; i++) {
      // Small particle
      const geometry = new THREE.SphereGeometry(0.05, 4, 4);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.7
      });
      const particle = new THREE.Mesh(geometry, material);
      
      // Random position in sphere
      particle.position.copy(position);
      particle.position.x += (Math.random() - 0.5) * radius;
      particle.position.y += (Math.random() - 0.5) * radius;
      particle.position.z += (Math.random() - 0.5) * radius;
      
      // Add to scene
      const particleId = `fizzle-${Date.now()}-${i}`;
      eventBus.emit('renderer.addObject', {
        id: particleId,
        object: particle,
        temporary: true,
        duration: 0.5
      });
      
      // Animate particle
      const startPos = particle.position.clone();
      const endPos = startPos.clone().add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3
        )
      );
      const startTime = Date.now();
      const duration = 0.5;
      
      const animateParticle = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(1, elapsed / duration);
        
        if (progress < 1) {
          // Move particle
          particle.position.lerpVectors(startPos, endPos, progress);
          
          // Fade out
          material.opacity = 0.7 * (1 - progress);
          
          // Continue animation
          requestAnimationFrame(animateParticle);
        }
      };
      
      // Start animation
      requestAnimationFrame(animateParticle);
    }
  }

  /**
   * Handle get entities by type request
   * @param {Object} data - Request data with type and callback
   * @private
   */
  _handleGetEntitiesByType(data) {
    if (!data || !data.type || typeof data.callback !== 'function') {
      console.warn('Invalid getEntitiesByType request: missing type or callback');
      return;
    }
    
    const entities = this.getEntitiesByType(data.type);
    console.log(`EntityManager: getEntitiesByType request for type ${data.type}, found: ${entities.length} entities`);
    
    // Call the callback with the found entities
    data.callback(entities);
  }

  /**
   * Create a "DESTROYED" text effect at the given position
   * @param {THREE.Vector3} position - Position to create the text
   * @private
   */
  _createDestroyedText(position) {
    console.log(`Creating DESTROYED text at position ${JSON.stringify(position)}`);
    
    // Create a canvas for the text
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // Draw text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Red outline
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 4;
    ctx.strokeText('DESTROYED', canvas.width / 2, canvas.height / 2);
    
    // White fill
    ctx.fillStyle = '#ffffff';
    ctx.fillText('DESTROYED', canvas.width / 2, canvas.height / 2);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create material with the texture
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide
    });
    
    // Create plane geometry for the text
    const geometry = new THREE.PlaneGeometry(2, 0.5);
    
    // Create mesh
    const textMesh = new THREE.Mesh(geometry, material);
    
    // Position above the player
    textMesh.position.copy(position);
    textMesh.position.y += 2.0;
    
    // Make it face the camera
    textMesh.userData.isBillboard = true;
    
    // Add to scene
    eventBus.emit('renderer.addObject', {
      id: `destroyed-text-${Date.now()}`,
      object: textMesh,
      temporary: true,
      duration: 3
    });
    
    // Animate the text
    const startTime = Date.now();
    const duration = 3000; // 3 seconds
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1) {
        // Move up slowly
        textMesh.position.y += 0.005;
        
        // Fade out near the end
        if (progress > 0.7) {
          const fadeProgress = (progress - 0.7) / 0.3;
          material.opacity = 1 - fadeProgress;
        }
        
        requestAnimationFrame(animate);
      }
    };
    
    // Start animation
    requestAnimationFrame(animate);
  }
}

// Create singleton instance
const entityManager = new EntityManager();

export default entityManager;