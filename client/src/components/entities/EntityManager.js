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
    console.log('[ENTITY MANAGER] Initializing and setting up event listeners');
    
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
    
    console.log('[ENTITY MANAGER] Network event listeners registered successfully');
    
    // Set up render update cycle
    eventBus.on('renderer.beforeRender', this._boundUpdate);
    
    // Set up combat event listeners
    eventBus.on('combat.getTargets', this._handleGetTargets.bind(this));
    eventBus.on('combat.getEntity', this._handleGetEntity.bind(this));
    eventBus.on('combat.attackRequested', this._handleAttackRequested.bind(this));
    
    console.log('[ENTITY MANAGER] All event listeners registered');
    
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
   * Create an other player entity
   * @param {Object} playerData - Player data from server
   * @returns {OtherPlayer} - The created player entity
   * @private
   */
  _createOtherPlayer(playerData) {
    // Skip if no ID
    if (!playerData.id) {
      console.warn('[ENTITY] Cannot create other player: No ID provided', playerData);
      return null;
    }
    
    // Skip if this is our own player
    if (playerData.id === window.webSocketManager?.playerId) {
      console.log(`[ENTITY] Skipping creation of own player: ${playerData.id}`);
      return null;
    }
    
    console.log(`[ENTITY] Creating other player: ${playerData.id}`, playerData);
    
    // Check if player already exists
    const existingPlayer = this.getEntity(playerData.id);
    if (existingPlayer) {
      console.log(`[ENTITY] Player ${playerData.id} already exists, updating position and health`);
      
      // Update position if provided
      if (playerData.position) {
        existingPlayer.position.set(
          playerData.position.x || 0,
          playerData.position.y || 0.8,
          playerData.position.z || 0
        );
      }
      
      // Update health if provided and health bar exists
      if (playerData.health !== undefined && existingPlayer._updateHealthBar) {
        existingPlayer.health = playerData.health;
        existingPlayer._updateHealthBar();
      }
      
      return existingPlayer;
    }
    
    // Ensure player has position data
    if (!playerData.position) {
      playerData.position = { x: 0, y: 0.8, z: 0 };
      console.log(`[ENTITY] Added default position for player ${playerData.id}`);
    }
    
    // Ensure player has class data
    if (!playerData.class && playerData.characterClass) {
      playerData.class = playerData.characterClass;
    } else if (!playerData.characterClass && playerData.class) {
      playerData.characterClass = playerData.class;
    } else if (!playerData.class && !playerData.characterClass) {
      playerData.class = 'WARRIOR';
      playerData.characterClass = 'WARRIOR';
      console.log(`[ENTITY] Added default class for player ${playerData.id}`);
    }
    
    // Ensure player has stats data
    if (!playerData.stats) {
      // Default stats based on class
      const classType = playerData.class || 'WARRIOR';
      const defaultStats = {
        'CLERK': {
          id: 'CLERK',
          name: 'Clerk',
          color: 0x428CD5,
          health: 80,
          speed: 0.15,
          description: 'High speed, lower health. Uses magic attacks.'
        },
        'WARRIOR': {
          id: 'WARRIOR',
          name: 'Warrior',
          color: 0xD54242,
          health: 120,
          speed: 0.1,
          description: 'High health, lower speed. Uses melee attacks.'
        },
        'RANGER': {
          id: 'RANGER',
          name: 'Ranger',
          color: 0x42D54C,
          health: 100,
          speed: 0.125,
          description: 'Balanced health and speed. Uses ranged attacks.'
        }
      };
      
      playerData.stats = defaultStats[classType] || defaultStats['WARRIOR'];
      console.log(`[ENTITY] Added default stats for player ${playerData.id} based on class ${classType}`);
    }
    
    // Ensure player has health data
    if (playerData.stats && !playerData.health) {
      playerData.health = playerData.stats.health;
      console.log(`[ENTITY] Added health data for player ${playerData.id}: ${playerData.health}`);
    }
    
    // Create new player entity
    const otherPlayer = new OtherPlayer(playerData.id, playerData);
    
    // Initialize player
    otherPlayer.init();
    
    // Set initial position
    if (playerData.position) {
      otherPlayer.position.set(
        playerData.position.x || 0,
        playerData.position.y || 0.8,
        playerData.position.z || 0
      );
    }
    
    // Add to entity manager
    this.addEntity(otherPlayer);
    
    // Add to scene - THIS WAS MISSING!
    if (otherPlayer.mesh) {
      console.log(`[ENTITY] Adding mesh for player ${playerData.id} to scene`);
      renderer.addObject(`player-${otherPlayer.id}`, otherPlayer.mesh);
      otherPlayer.mesh.visible = true;
      console.log(`[ENTITY] Ensured player ${playerData.id} is visible`);
    } else {
      console.warn(`[ENTITY] Player ${playerData.id} has no mesh to add to scene`);
    }
    
    // Emit event for other systems
    eventBus.emit('entity.playerCreated', { 
      id: playerData.id, 
      type: 'otherPlayer',
      class: playerData.class || playerData.characterClass
    });
    
    return otherPlayer;
  }

  /**
   * Handle existing players data from server
   * @param {Array} players - Array of player data
   * @private
   */
  _handleExistingPlayers(players) {
    console.log('[ENTITY] Handling existing players:', players);
    console.log('[ENTITY] Current player ID:', window.webSocketManager?.playerId);
    
    if (!Array.isArray(players) || players.length === 0) {
      console.log('[ENTITY] No existing players to handle or invalid data format');
      console.log('[ENTITY] Players type:', typeof players);
      
      if (players && typeof players === 'object') {
        console.log('[ENTITY] Players keys:', Object.keys(players));
      }
      
      return;
    }
    
    // Track created players for debug
    const createdPlayers = [];
    
    // Process each player
    players.forEach(playerData => {
      // Skip if this is our own player
      if (playerData.id === window.webSocketManager?.playerId) {
        console.log(`[ENTITY] Skipping own player: ${playerData.id}`);
        return;
      }
      
      // Skip if player has no ID
      if (!playerData.id) {
        console.warn('[ENTITY] Player data missing ID, skipping:', playerData);
        return;
      }
      
      console.log(`[ENTITY] Processing existing player: ${playerData.id}`);
      
      // Ensure player has position data
      if (!playerData.position) {
        playerData.position = { x: 0, y: 0.8, z: 0 };
        console.log(`[ENTITY] Added default position for player ${playerData.id}`);
      }
      
      // Ensure player has class data
      if (!playerData.class && playerData.characterClass) {
        playerData.class = playerData.characterClass;
      } else if (!playerData.characterClass && playerData.class) {
        playerData.characterClass = playerData.class;
      } else if (!playerData.class && !playerData.characterClass) {
        playerData.class = 'WARRIOR';
        playerData.characterClass = 'WARRIOR';
        console.log(`[ENTITY] Added default class for player ${playerData.id}`);
      }
      
      // Ensure player has stats data
      if (!playerData.stats) {
        // Default stats based on class
        const classType = playerData.class || 'WARRIOR';
        const defaultStats = {
          'CLERK': {
            id: 'CLERK',
            name: 'Clerk',
            color: 0x428CD5,
            health: 80,
            speed: 0.15,
            description: 'High speed, lower health. Uses magic attacks.'
          },
          'WARRIOR': {
            id: 'WARRIOR',
            name: 'Warrior',
            color: 0xD54242,
            health: 120,
            speed: 0.1,
            description: 'High health, lower speed. Uses melee attacks.'
          },
          'RANGER': {
            id: 'RANGER',
            name: 'Ranger',
            color: 0x42D54C,
            health: 100,
            speed: 0.125,
            description: 'Balanced health and speed. Uses ranged attacks.'
          }
        };
        
        playerData.stats = defaultStats[classType] || defaultStats['WARRIOR'];
        console.log(`[ENTITY] Added default stats for player ${playerData.id} based on class ${classType}`);
      }
      
      // Ensure player has health data
      if (playerData.stats && !playerData.health) {
        playerData.health = playerData.stats.health;
        console.log(`[ENTITY] Added health data for player ${playerData.id}: ${playerData.health}`);
      }
      
      // Check if player already exists
      const existingPlayer = this.getEntity(playerData.id);
      if (existingPlayer) {
        console.log(`[ENTITY] Player ${playerData.id} already exists, updating position and health`);
        
        // Update position if provided
        if (playerData.position) {
          existingPlayer.position.set(
            playerData.position.x || 0,
            playerData.position.y || 0.8,
            playerData.position.z || 0
          );
        }
        
        // Update health if provided
        if (playerData.health !== undefined) {
          existingPlayer.health = playerData.health;
          if (existingPlayer._updateHealthBar) {
            existingPlayer._updateHealthBar();
          }
        }
        
        // Ensure the player is visible
        if (existingPlayer.mesh) {
          existingPlayer.mesh.visible = true;
          console.log(`[ENTITY] Ensured existing player ${playerData.id} is visible`);
        }
        
        createdPlayers.push(playerData.id + ' (updated)');
      } else {
        // Create the player entity
        const otherPlayer = this._createOtherPlayer(playerData);
        
        if (otherPlayer) {
          createdPlayers.push(playerData.id);
          
          // Ensure the player is visible
          if (otherPlayer.mesh) {
            otherPlayer.mesh.visible = true;
            console.log(`[ENTITY] Ensured new player ${playerData.id} is visible`);
          }
        }
      }
    });
    
    console.log(`[ENTITY] Processed ${createdPlayers.length} other players: ${createdPlayers.join(', ')}`);
    
    // Emit event to notify that all existing players have been processed
    eventBus.emit('entityManager.existingPlayersProcessed', {
      count: createdPlayers.length,
      ids: createdPlayers
    });
  }

  /**
   * Handle player joined event
   * @param {Object} playerData - Player data from server
   * @private
   */
  _handlePlayerJoined(playerData) {
    console.log('[ENTITY] Player joined:', playerData);
    
    // Skip if no ID
    if (!playerData.id) {
      console.warn('[ENTITY] Player joined with no ID:', playerData);
      return;
    }
    
    // Skip if this is our own player
    if (playerData.id === window.webSocketManager?.playerId) {
      console.log(`[ENTITY] Skipping own player join event: ${playerData.id}`);
      return;
    }
    
    // Ensure player has position data
    if (!playerData.position) {
      playerData.position = { x: 0, y: 0.8, z: 0 };
      console.log(`[ENTITY] Added default position for player ${playerData.id}`);
    }
    
    // Ensure player has class data
    if (!playerData.class && playerData.characterClass) {
      playerData.class = playerData.characterClass;
    } else if (!playerData.characterClass && playerData.class) {
      playerData.characterClass = playerData.class;
    } else if (!playerData.class && !playerData.characterClass) {
      playerData.class = 'WARRIOR';
      playerData.characterClass = 'WARRIOR';
      console.log(`[ENTITY] Added default class for player ${playerData.id}`);
    }
    
    // Ensure player has stats data
    if (!playerData.stats) {
      // Default stats based on class
      const classType = playerData.class || 'WARRIOR';
      const defaultStats = {
        'CLERK': {
          id: 'CLERK',
          name: 'Clerk',
          color: 0x428CD5,
          health: 80,
          speed: 0.15,
          description: 'High speed, lower health. Uses magic attacks.'
        },
        'WARRIOR': {
          id: 'WARRIOR',
          name: 'Warrior',
          color: 0xD54242,
          health: 120,
          speed: 0.1,
          description: 'High health, lower speed. Uses melee attacks.'
        },
        'RANGER': {
          id: 'RANGER',
          name: 'Ranger',
          color: 0x42D54C,
          health: 100,
          speed: 0.125,
          description: 'Balanced health and speed. Uses ranged attacks.'
        }
      };
      
      playerData.stats = defaultStats[classType] || defaultStats['WARRIOR'];
      console.log(`[ENTITY] Added default stats for player ${playerData.id} based on class ${classType}`);
    }
    
    // Ensure player has health data
    if (playerData.stats && !playerData.health) {
      playerData.health = playerData.stats.health;
      console.log(`[ENTITY] Added health data for player ${playerData.id}: ${playerData.health}`);
    }
    
    // Check if player already exists
    const existingPlayer = this.getEntity(playerData.id);
    if (existingPlayer) {
      console.log(`[ENTITY] Player ${playerData.id} already exists, updating position and health`);
      
      // Update position if provided
      if (playerData.position) {
        existingPlayer.position.set(
          playerData.position.x || 0,
          playerData.position.y || 0.8,
          playerData.position.z || 0
        );
      }
      
      // Update health if provided
      if (playerData.health !== undefined) {
        existingPlayer.health = playerData.health;
        if (existingPlayer._updateHealthBar) {
          existingPlayer._updateHealthBar();
        }
      }
      
      // Ensure the player is visible
      if (existingPlayer.mesh) {
        existingPlayer.mesh.visible = true;
        console.log(`[ENTITY] Ensured existing player ${playerData.id} is visible`);
      }
      
      // Emit event for other systems
      eventBus.emit('entity.playerJoined', { 
        id: playerData.id, 
        type: 'otherPlayer',
        class: playerData.class || playerData.characterClass
      });
      
      return existingPlayer;
    }
    
    // Create the player entity
    const otherPlayer = this._createOtherPlayer(playerData);
    
    if (otherPlayer) {
      console.log(`[ENTITY] Created other player: ${playerData.id}`);
      
      // Ensure the player is visible
      if (otherPlayer.mesh) {
        otherPlayer.mesh.visible = true;
        console.log(`[ENTITY] Ensured player ${playerData.id} is visible`);
      }
      
      // Emit event for other systems
      eventBus.emit('entity.playerJoined', { 
        id: playerData.id, 
        type: 'otherPlayer',
        class: playerData.class || playerData.characterClass
      });
      
      return otherPlayer;
    }
    
    return null;
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
   * Handle attack request from player
   * @param {Object} data - Attack data
   * @private
   */
  _handleAttackRequested(data) {
    console.log('[ENTITY] Attack requested:', data);
    
    // Get attacker entity
    const attacker = this.getEntity(data.attackerId);
    if (!attacker) {
      console.error(`[ENTITY] Attacker not found: ${data.attackerId}`);
      return;
    }
    
    // Get target entity
    const target = this.getEntity(data.targetId);
    if (!target) {
      console.error(`[ENTITY] Target not found: ${data.targetId}`);
      return;
    }
    
    // Prevent self-damage
    if (data.attackerId === data.targetId) {
      console.warn('[ENTITY] Prevented self-damage attempt');
      return;
    }
    
    // Calculate distance between attacker and target
    const distance = attacker.position.distanceTo(target.position);
    
    // Get attack range from data or default
    const attackRange = data.range || 5;
    
    // Check if target is in range
    if (distance > attackRange) {
      console.log(`[ENTITY] Target out of range: ${distance.toFixed(2)} > ${attackRange}`);
      
      // Show missed attack effect
      this._showMissedAttackEffect(attacker, target, {
        ...data,
        distance,
        maxRange: attackRange
      });
      
      // Notify attacker about miss
      if (data.callback) {
        data.callback({
          success: false,
          reason: 'Target out of range',
          distance,
          maxRange: attackRange
        });
      }
      
      return;
    }
    
    // Process the attack
    this._processAttackWithTarget(data);
  }
  
  /**
   * Handle player attacked event from network
   * @param {Object} data - Attack data from server
   * @private
   */
  _handlePlayerAttacked(data) {
    console.log('Received attack event:', `Player ${data.id} attacked ${data.targetId} for ${data.damage} damage`);
    
    // Skip processing if this is a local visual-only attack
    if (data.isLocalVisualOnly) {
      console.log('Skipping server processing for local visual-only attack');
      return;
    }
    
    // Get attacker entity
    let attacker = this.getEntity(data.id);
    
    // If attacker not found, create a placeholder for visual effects
    if (!attacker) {
      console.log(`Attacker with ID ${data.id} not found, creating a placeholder for visual effects`);
      
      // Try to get data from WebSocketManager's other players cache
      let attackerData = null;
      if (window.webSocketManager && window.webSocketManager.otherPlayers) {
        attackerData = window.webSocketManager.otherPlayers[data.id];
      }
      
      // Create a placeholder object with minimal required properties
      attacker = {
        id: data.id,
        type: 'otherPlayer',
        position: attackerData?.position || { x: 0, y: 0.8, z: 0 },
        classType: attackerData?.characterClass || attackerData?.class || 'WARRIOR',
        characterClass: attackerData?.characterClass || attackerData?.class || 'WARRIOR'
      };
    }
    
    // Get target entity
    let target = this.getEntity(data.targetId);
    
    // If target not found, try to find it using direct entity lookup
    if (!target) {
      console.log(`Target with ID ${data.targetId} not found`);
      console.log(`Attempting to find target ${data.targetId} using direct entity lookup...`);
      
      // Try to find the entity by iterating through all entities
      this.entities.forEach(entity => {
        if (entity.id === data.targetId || (entity.networkId && entity.networkId === data.targetId)) {
          target = entity;
        }
      });
      
      // If still not found, check if it's the local player
      if (!target && window.game && window.game.player && window.game.player.id === data.targetId) {
        target = window.game.player;
        console.log(`Found target as local player: ${data.targetId}`);
      }
      
      // If still not found, create a placeholder for visual effects
      if (!target) {
        console.log(`Target ${data.targetId} not found even with fallback methods`);
        
        // Try to get data from WebSocketManager's other players cache
        let targetData = null;
        if (window.webSocketManager && window.webSocketManager.otherPlayers) {
          targetData = window.webSocketManager.otherPlayers[data.targetId];
        }
        
        // Create a placeholder object with minimal required properties
        target = {
          id: data.targetId,
          type: 'otherPlayer',
          position: targetData?.position || { x: 0, y: 0.8, z: 0 },
          classType: targetData?.characterClass || targetData?.class || 'WARRIOR',
          characterClass: targetData?.characterClass || targetData?.class || 'WARRIOR'
        };
      }
    }
    
    // Process the attack with the entities
    this._processAttackWithTarget({
      attackerId: data.id,
      targetId: data.targetId,
      damage: data.damage,
      attackType: data.attackType,
      attackId: data.attackId,
      distance: data.distance,
      attacker: attacker,
      target: target
    });
  }
  
  /**
   * Process attack with target
   * @param {Object} attackData - Attack data
   * @private
   */
  _processAttackWithTarget(attackData) {
    console.log('[ENTITY] Processing attack with target:', attackData);
    
    const attacker = attackData.attacker;
    const target = attackData.target;
    
    if (!attacker || !target) {
      console.error('[ENTITY] Missing attacker or target for attack processing');
      return;
    }
    
    // Show attack effect between entities
    this._showAttackEffectBetweenEntities(attacker, target, attackData);
    
    // Determine if this is a local player attack
    const isLocalPlayerAttack = attacker.type === 'player' && attacker === this.player;
    
    if (isLocalPlayerAttack) {
      console.log('[ENTITY] Local player attack - sending to server');
      // Local player attacks are handled by the server
      // We just show the visual effect here
      return;
    }
    
    // For non-player attacks (e.g., other players attacking), apply damage directly
    console.log('[ENTITY] Non-player attack - applying damage directly');
    
    // Apply damage to target if it has takeDamage method
    if (typeof target.takeDamage === 'function') {
      const died = target.takeDamage(attackData.damage, true); // true = from network
      console.log(`[ENTITY] Damage applied to ${target.id}: ${attackData.damage}, died: ${died}`);
    } else {
      console.warn(`[ENTITY] Target ${target.id} does not have takeDamage method`);
      
      // If target is the local player, try to apply damage through game.player
      if (target.id === window.webSocketManager?.playerId && window.game?.player) {
        console.log('[ENTITY] Applying damage to local player through game.player');
        window.game.player.takeDamage(attackData.damage, true);
      }
    }
    
    // Create floating damage text
    if (target.position) {
      this._createDamageText(target.position, attackData.damage);
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
    // Safety check for entities
    if (!attacker || !target) {
      console.warn('[ENTITY] Cannot show attack effect: missing attacker or target');
      return;
    }
    
    // Get positions, handling both entity objects and placeholder objects
    let startPos, endPos;
    
    // Get attacker position
    if (attacker.position instanceof THREE.Vector3) {
      startPos = attacker.position.clone();
    } else if (attacker.position) {
      // Convert plain object to Vector3
      startPos = new THREE.Vector3(
        attacker.position.x || 0,
        attacker.position.y || 0.8,
        attacker.position.z || 0
      );
    } else {
      // Default position if none available
      console.warn('[ENTITY] Attacker has no position, using default');
      startPos = new THREE.Vector3(0, 0.8, 0);
    }
    
    // Add height offset for better visual
    startPos.y += 0.5;
    
    // Get target position
    if (target.position instanceof THREE.Vector3) {
      endPos = target.position.clone();
    } else if (target.position) {
      // Convert plain object to Vector3
      endPos = new THREE.Vector3(
        target.position.x || 0,
        target.position.y || 0.8,
        target.position.z || 0
      );
    } else {
      // Default position if none available
      console.warn('[ENTITY] Target has no position, using default');
      endPos = new THREE.Vector3(0, 0.8, 0);
    }
    
    // Add height offset for better visual
    endPos.y += 0.5;
    
    console.log('[ENTITY] Attack effect from', startPos, 'to', endPos);
    
    // Determine correct effect based on attacker class
    let geometry, material;
    const attackerClass = attacker.classType || attacker.characterClass || 'WARRIOR';
    
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
    attackEffect.position.copy(startPos);
    
    // For melee attacks, rotate appropriately
    if (attackerClass === 'WARRIOR') {
      attackEffect.position.copy(attacker.position.clone().add(new THREE.Vector3(0, 0.5, -0.5)));
      
      // Orient toward target
      const direction = new THREE.Vector3().subVectors(endPos, startPos).normalize();
      const angle = Math.atan2(direction.x, direction.z);
      attackEffect.rotation.set(Math.PI/2, 0, angle);
    } else if (attackerClass === 'RANGER') {
      // Orient arrow toward target
      const direction = new THREE.Vector3().subVectors(endPos, startPos).normalize();
      const arrowAngle = Math.atan2(direction.x, direction.z);
      attackEffect.rotation.set(Math.PI/2, 0, arrowAngle);
    }
    
    // Add to scene
    renderer.addObject(`attack-${attacker.id}-${Date.now()}`, attackEffect, true, 0.5);
    
    // For ranged attacks, animate projectile
    if (attackerClass === 'CLERK' || attackerClass === 'RANGER') {
      const startTime = Date.now();
      const distance = startPos.distanceTo(endPos);
      const duration = Math.min(0.5, distance * 0.1);
      
      const animateProjectile = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(1, elapsed / duration);
        
        if (progress < 1) {
          // Interpolate position
          attackEffect.position.lerpVectors(startPos, endPos, progress);
          requestAnimationFrame(animateProjectile);
        }
      };
      
      // Start animation
      animateProjectile();
    }
  }
  
  /**
   * Handle player health changed event
   * @param {Object} data - Health data
   * @private
   */
  _handlePlayerHealthChanged(data) {
    console.log('Health change event received:', data);
    
    // Skip if no ID provided
    if (!data.id) {
      console.warn('Health change event missing ID');
      return;
    }
    
    // Get the entity
    const entity = this.getEntity(data.id);
    
    // If entity not found, check if it's the local player
    if (!entity) {
      console.log('Entity with ID', data.id, 'not found for health change event');
      
      // Check if this is the local player's ID
      if (window.webSocketManager && window.webSocketManager.playerId === data.id) {
        console.log('Health change is for local player, applying directly');
        
        // Apply damage to local player
        if (window.game && window.game.player && typeof window.game.player.takeDamage === 'function') {
          window.game.player.takeDamage(data.damage || 0, true);
          return;
        }
      }
      
      // Check if it's an other player that we know about
      if (window.webSocketManager && window.webSocketManager.otherPlayers) {
        const playerData = window.webSocketManager.otherPlayers[data.id];
        if (playerData) {
          console.log('Found player in network cache, updating health data');
          
          // Update the health in the cache
          playerData.health = data.health;
          playerData.maxHealth = data.maxHealth;
          
          // Try to find the entity again by iterating through all entities
          // This is a fallback in case the entity exists but wasn't found by ID
          let foundEntity = null;
          this.entities.forEach(e => {
            if (e.id === data.id || (e.networkId && e.networkId === data.id)) {
              foundEntity = e;
            }
          });
          
          if (foundEntity) {
            console.log('Found entity through direct iteration, applying health update');
            if (typeof foundEntity.takeDamage === 'function') {
              foundEntity.takeDamage(data.damage || 0, true);
            }
          }
        }
      }
      
      // If we still couldn't find the entity, just log and return
      return;
    }
    
    // Log the health change
    console.log('Entity', data.id, 'health update:', entity.health, '->', data.health, '(damage:', data.damage, ')');
    
    // Apply the health change
    if (entity.type === 'otherPlayer') {
      console.log('Applying damage to other player (', entity.id, '):', data.damage);
      
      // Ensure maxHealth is set
      if (data.maxHealth && !entity.stats?.health) {
        entity.stats = entity.stats || {};
        entity.stats.health = data.maxHealth;
      }
      
      // Apply damage
      if (typeof entity.takeDamage === 'function') {
        entity.takeDamage(data.damage || 0, true);
      } else {
        console.warn('Entity', entity.id, 'does not have takeDamage method');
        
        // Direct health update as fallback
        entity.health = data.health;
      }
    } else if (entity.type === 'player') {
      console.log('Applying damage to local player:', data.damage);
      
      // Apply damage
      if (typeof entity.takeDamage === 'function') {
        entity.takeDamage(data.damage || 0, true);
      } else {
        console.warn('Local player does not have takeDamage method');
        
        // Direct health update as fallback
        entity.health = data.health;
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
   * Handle player moved event
   * @param {Object} data - Movement data
   * @private
   */
  _handlePlayerMoved(data) {
    // Skip if no ID or position
    if (!data.id || !data.position) {
      console.warn('[ENTITY] Invalid player movement data:', data);
      return;
    }
    
    // Skip if this is our own player
    if (data.id === window.webSocketManager?.playerId) {
      return;
    }
    
    console.log(`[ENTITY] Player ${data.id} moved to:`, data.position);
    
    // Get the entity
    let entity = this.getEntity(data.id);
    
    // If entity not found, try to create it
    if (!entity) {
      console.log(`[ENTITY] Entity not found for movement update: ${data.id}, creating placeholder`);
      
      // Try to get player data from WebSocketManager
      let playerData = null;
      if (window.webSocketManager && window.webSocketManager.otherPlayers) {
        playerData = window.webSocketManager.otherPlayers[data.id];
      }
      
      // If we have player data, create the entity
      if (playerData) {
        // Ensure position is updated
        playerData.position = data.position;
        
        // Create the entity
        entity = this._createOtherPlayer(playerData);
        
        if (entity) {
          console.log(`[ENTITY] Created entity for player ${data.id} from movement data`);
          
          // Ensure the entity is visible
          if (entity.mesh) {
            console.log(`[ENTITY] Adding mesh for player ${data.id} to scene from movement data`);
            renderer.addObject(`player-${entity.id}`, entity.mesh);
            entity.mesh.visible = true;
            console.log(`[ENTITY] Ensured new player ${data.id} is visible after creation from movement`);
          }
        }
      } else {
        // Create minimal player data
        const minimalPlayerData = {
          id: data.id,
          position: data.position,
          class: data.class || 'WARRIOR',
          characterClass: data.characterClass || data.class || 'WARRIOR',
          type: 'otherPlayer'
        };
        
        // Create the entity
        entity = this._createOtherPlayer(minimalPlayerData);
        
        if (entity) {
          console.log(`[ENTITY] Created minimal entity for player ${data.id} from movement data`);
          
          // Ensure the entity is visible
          if (entity.mesh) {
            console.log(`[ENTITY] Adding mesh for player ${data.id} to scene from movement data`);
            renderer.addObject(`player-${entity.id}`, entity.mesh);
            entity.mesh.visible = true;
            console.log(`[ENTITY] Ensured minimal player ${data.id} is visible after creation from movement`);
          }
        }
      }
    } else {
      // Update position
      entity.position.set(
        data.position.x,
        data.position.y,
        data.position.z
      );
      
      // Update target position if entity has it
      if (entity.targetPosition) {
        entity.targetPosition.set(
          data.position.x,
          data.position.y,
          data.position.z
        );
      }
      
      // Enable interpolation if entity supports it
      if (typeof entity.isInterpolating !== 'undefined') {
        entity.isInterpolating = true;
      }
      
      // Ensure the entity is visible
      if (entity.mesh && !entity.mesh.visible) {
        entity.mesh.visible = true;
        console.log(`[ENTITY] Made player ${data.id} visible after movement update`);
        
        // Also make health bar visible if it exists
        if (entity.healthBar) {
          entity.healthBar.visible = true;
        } else if (typeof entity._createHealthBar === 'function') {
          // Create health bar if it doesn't exist
          entity._createHealthBar();
        }
      }
    }
    
    // Emit entity-specific moved event
    eventBus.emit(`entity.${data.id}.moved`, {
      id: data.id,
      position: data.position
    });
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