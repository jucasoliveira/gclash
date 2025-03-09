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
    
    // Set up render update cycle
    eventBus.on('renderer.beforeRender', this._boundUpdate);
    
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
   * Clean up resources
   */
  dispose() {
    // Remove event listeners
    eventBus.off('network.existingPlayers', this._boundHandleExistingPlayers);
    eventBus.off('network.playerJoined', this._boundHandlePlayerJoined);
    eventBus.off('network.playerLeft', this._boundHandlePlayerLeft);
    eventBus.off('renderer.beforeRender', this._boundUpdate);
    
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