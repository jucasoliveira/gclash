import * as THREE from 'three';
import eventBus from '../core/EventBus.js';

/**
 * Entity - Base class for all game entities
 * Provides common functionality for position, rotation, etc.
 */
class Entity {
  constructor(id = null) {
    this.id = id || crypto.randomUUID();
    this.type = 'entity';
    this.position = new THREE.Vector3();
    this.rotation = new THREE.Euler();
    this.scale = new THREE.Vector3(1, 1, 1);
    this.mesh = null;
    this.isActive = true;
    
    // Component system
    this.components = new Map();
    
    // Event bindings
    this._boundHandleDestroy = this._handleDestroy.bind(this);
  }

  /**
   * Initialize the entity
   * @returns {Entity} - This instance for chaining
   */
  init() {
    // Listen for destroy event
    eventBus.on(`entity.${this.id}.destroy`, this._boundHandleDestroy);
    
    return this;
  }

  /**
   * Add a component to the entity
   * @param {string} name - Component name
   * @param {Object} component - Component instance
   * @returns {Entity} - This instance for chaining
   */
  addComponent(name, component) {
    if (this.components.has(name)) {
      console.warn(`Entity ${this.id} already has component ${name}. Replacing.`);
    }
    
    this.components.set(name, component);
    
    // Initialize component if it has an init method
    if (typeof component.init === 'function') {
      component.init(this);
    }
    
    return this;
  }

  /**
   * Get a component by name
   * @param {string} name - Component name
   * @returns {Object|null} - Component instance or null if not found
   */
  getComponent(name) {
    return this.components.get(name) || null;
  }

  /**
   * Remove a component
   * @param {string} name - Component name
   * @returns {boolean} - Whether the component was removed
   */
  removeComponent(name) {
    if (!this.components.has(name)) {
      return false;
    }
    
    const component = this.components.get(name);
    
    // Clean up component if it has a dispose method
    if (typeof component.dispose === 'function') {
      component.dispose(this);
    }
    
    this.components.delete(name);
    return true;
  }

  /**
   * Create and configure a mesh for this entity
   * @param {THREE.Geometry|THREE.BufferGeometry} geometry - Mesh geometry
   * @param {THREE.Material} material - Mesh material
   * @returns {Entity} - This instance for chaining
   */
  createMesh(geometry, material) {
    // Clean up existing mesh
    if (this.mesh) {
      this.mesh.removeFromParent();
    }
    
    // Create new mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.copy(this.rotation);
    this.mesh.scale.copy(this.scale);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Store reference to this entity in the mesh userData
    this.mesh.userData.entityId = this.id;
    
    return this;
  }

  /**
   * Set the position of the entity
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} z - Z coordinate
   * @returns {Entity} - This instance for chaining
   */
  setPosition(x, y, z) {
    this.position.set(x, y, z);
    
    if (this.mesh) {
      this.mesh.position.copy(this.position);
    }
    
    eventBus.emit(`entity.${this.id}.moved`, { 
      entityId: this.id,
      position: this.position.clone()
    });
    
    return this;
  }

  /**
   * Move the entity by the given amount
   * @param {number} deltaX - X amount to move
   * @param {number} deltaY - Y amount to move
   * @param {number} deltaZ - Z amount to move
   * @returns {Entity} - This instance for chaining
   */
  move(deltaX, deltaY, deltaZ) {
    this.position.x += deltaX;
    this.position.y += deltaY;
    this.position.z += deltaZ;
    
    if (this.mesh) {
      this.mesh.position.copy(this.position);
    }
    
    eventBus.emit(`entity.${this.id}.moved`, { 
      entityId: this.id,
      position: this.position.clone()
    });
    
    return this;
  }

  /**
   * Set the rotation of the entity
   * @param {number} x - X rotation (radians)
   * @param {number} y - Y rotation (radians)
   * @param {number} z - Z rotation (radians)
   * @returns {Entity} - This instance for chaining
   */
  setRotation(x, y, z) {
    this.rotation.set(x, y, z);
    
    if (this.mesh) {
      this.mesh.rotation.copy(this.rotation);
    }
    
    eventBus.emit(`entity.${this.id}.rotated`, { 
      entityId: this.id,
      rotation: this.rotation.clone()
    });
    
    return this;
  }

  /**
   * Set the scale of the entity
   * @param {number} x - X scale
   * @param {number} y - Y scale
   * @param {number} z - Z scale
   * @returns {Entity} - This instance for chaining
   */
  setScale(x, y, z) {
    this.scale.set(x, y, z);
    
    if (this.mesh) {
      this.mesh.scale.copy(this.scale);
    }
    
    eventBus.emit(`entity.${this.id}.scaled`, { 
      entityId: this.id,
      scale: this.scale.clone()
    });
    
    return this;
  }

  /**
   * Update the entity
   * @param {number} deltaTime - Time since last update in seconds
   */
  update(deltaTime) {
    if (!this.isActive) return;
    
    // Update all components
    this.components.forEach(component => {
      if (typeof component.update === 'function') {
        component.update(this, deltaTime);
      }
    });
  }

  /**
   * Handle entity destruction event
   * @private
   */
  _handleDestroy() {
    this.destroy();
  }

  /**
   * Destroy the entity
   */
  destroy() {
    // Deactivate
    this.isActive = false;
    
    // Remove mesh from scene
    if (this.mesh) {
      this.mesh.removeFromParent();
      this.mesh = null;
    }
    
    // Clean up components
    this.components.forEach((component, name) => {
      this.removeComponent(name);
    });
    
    // Remove event listeners
    eventBus.off(`entity.${this.id}.destroy`, this._boundHandleDestroy);
    
    // Emit destroyed event
    eventBus.emit(`entity.${this.id}.destroyed`, { entityId: this.id });
  }
}

export default Entity;