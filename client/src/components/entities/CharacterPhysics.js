import * as THREE from 'three';
import eventBus from '../core/EventBus.js';

/**
 * CharacterPhysics - Manages the kinematic physics body for a character
 * Creates and updates a Rapier kinematic body that follows the character
 */
class CharacterPhysics {
  /**
   * Create a new character physics controller
   * @param {Object} options - Configuration options
   * @param {THREE.Object3D} options.characterMesh - The visual mesh of the character
   * @param {THREE.Vector3} options.initialPosition - Starting position
   * @param {number} options.characterHeight - Height of the character
   * @param {number} options.characterRadius - Radius of the character
   */
  constructor(options) {
    // Store options
    this.characterMesh = options.characterMesh;
    this.initialPosition = options.initialPosition || new THREE.Vector3(0, 0, 0);
    this.characterHeight = options.characterHeight || 1.8;
    this.characterRadius = options.characterRadius || 0.3;
    
    // Scale factors for debug visualization (to make it larger than the actual physics body)
    this.debugVisualizationScale = 1.2; // Makes debug 20% larger than collision body
    
    // Physics body
    this.rigidBody = null;
    this.collider = null;
    
    // Debug visualization
    this.debugMesh = null;
    this.debugVisible = false;
    
    // Ray casting for ground detection
    this.ray = null;
    
    // Movement properties
    this.currentVelocity = new THREE.Vector3();
    this.targetPosition = null;
    this.isMoving = false;
    
    // Initialize physics if RAPIER is available
    if (window.RAPIER && window.physicsWorld) {
      this._initPhysics();
    } else {
      console.warn('[CHARACTER PHYSICS] Rapier not available, waiting for initialization');
      // Listen for physics init event
      eventBus.once('physics.initialized', () => {
        this._initPhysics();
      });
    }
  }
  
  /**
   * Initialize the physics body and collider
   * @private
   */
  _initPhysics() {
    if (!window.RAPIER || !window.physicsWorld) {
      console.error('[CHARACTER PHYSICS] Cannot initialize physics - Rapier not available');
      return;
    }
    
    const RAPIER = window.RAPIER;
    const world = window.physicsWorld;
    
    // Make sure initialPosition is slightly above ground to prevent clipping
    // This helps with visualization and prevents the character from starting embedded in terrain
    if (this.initialPosition.y < 0.5) {
      console.log(`[CHARACTER PHYSICS] Adjusting initial height from ${this.initialPosition.y.toFixed(2)} to 1.0 to prevent terrain clipping`);
      this.initialPosition.y = 1.0; // Ensure we start at least 1 unit above ground
    }
    
    // Create kinematic body
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(
        this.initialPosition.x,
        this.initialPosition.y,
        this.initialPosition.z
      );
    
    this.rigidBody = world.createRigidBody(bodyDesc);
    
    // Create capsule collider
    // Parameters: half-height, radius
    const halfHeight = this.characterHeight / 2 - this.characterRadius;
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, this.characterRadius);
    
    this.collider = world.createCollider(colliderDesc, this.rigidBody.handle);
    
    // Create ray for ground detection
    this.ray = new RAPIER.Ray(
      { x: this.initialPosition.x, y: this.initialPosition.y, z: this.initialPosition.z },
      { x: 0, y: -1, z: 0 }
    );
    
    console.log(`[CHARACTER PHYSICS] Physics body initialized at (${this.initialPosition.x.toFixed(2)}, ${this.initialPosition.y.toFixed(2)}, ${this.initialPosition.z.toFixed(2)})`);
    
    // Create debug visualization
    this._createDebugVisualization();
    
    // Emit event that physics is ready
    eventBus.emit('characterPhysics.ready', this);
  }
  
  /**
   * Create a debug visualization of the physics body
   * @private
   */
  _createDebugVisualization() {
    if (!window.renderer) {
      console.warn('[CHARACTER PHYSICS] Cannot create debug visualization - renderer not available');
      return;
    }
    
    // Create capsule geometry to represent the collider
    const halfHeight = this.characterHeight / 2 - this.characterRadius;
    
    // Make the visualization larger than the actual collider for better visibility
    // and to ensure it fully envelops the character mesh
    const visualRadius = this.characterRadius * this.debugVisualizationScale;
    const visualHeight = halfHeight * 2 * this.debugVisualizationScale;
    
    console.log(`[CHARACTER PHYSICS] Creating debug visualization with radius ${visualRadius.toFixed(2)} and height ${visualHeight.toFixed(2)}`);
    
    // Higher segment count for smoother visualization
    const geometry = new THREE.CapsuleGeometry(visualRadius, visualHeight, 24, 24);
    
    // More transparent material so you can see the character inside
    const material = new THREE.MeshBasicMaterial({
      color: 0xff3333, // Vibrant red
      wireframe: false, // Solid instead of wireframe
      transparent: true,
      opacity: 0.4, // Lower opacity to see character inside
      depthTest: true, // Ensure proper depth testing
      side: THREE.DoubleSide, // Visible from both sides
      polygonOffset: true,     // Use polygon offset to avoid z-fighting
      polygonOffsetFactor: -4, // Pull the mesh toward the camera
      polygonOffsetUnits: 1
    });
    
    // Create the debug mesh
    this.debugMesh = new THREE.Mesh(geometry, material);
    
    // Set initial position
    this.debugMesh.position.copy(this.initialPosition);
    
    // Add a slight Y offset to better center the capsule on the character
    // This adjusts for characters where the origin may not be at the center
    const yOffset = this.characterHeight * 0.02; // Small offset for fine-tuning
    this.debugMesh.position.y += yOffset;
    
    // Set a very high renderOrder to ensure it's drawn on top
    this.debugMesh.renderOrder = 9999;
    
    // Add to scene
    window.renderer.addObject('characterPhysicsDebug', this.debugMesh);
    
    // Make sure it's visible
    this.debugMesh.visible = true;
    this.debugVisible = true;
    
    console.log('[CHARACTER PHYSICS] Debug visualization created - LARGER RED CAPSULE fully enveloping character');
    console.log('[CHARACTER PHYSICS] Debug mesh position:', 
      this.debugMesh.position.x.toFixed(2), 
      this.debugMesh.position.y.toFixed(2), 
      this.debugMesh.position.z.toFixed(2));
  }
  
  /**
   * Set target position for movement
   * @param {THREE.Vector3} position - Target position
   */
  setTargetPosition(position) {
    this.targetPosition = position.clone();
    this.isMoving = true;
  }
  
  /**
   * Update the physics body position directly
   * @param {THREE.Vector3} position - New position
   */
  updatePosition(position) {
    if (!this.rigidBody) return;
    
    const currentPos = this.rigidBody.translation();
    
    // Update the rigid body position
    this.rigidBody.setNextKinematicTranslation({
      x: position.x,
      y: position.y,
      z: position.z
    });
    
    // Update debug visualization
    if (this.debugMesh) {
      this.debugMesh.position.copy(position);
    }
  }
  
  /**
   * Apply gravity and handle ground collision
   * @param {number} deltaTime - Time since last update
   */
  applyGravityAndGroundCollision(deltaTime) {
    if (!this.rigidBody || !window.physicsWorld) return;
    
    const world = window.physicsWorld;
    const currentPos = this.rigidBody.translation();
    
    // Update ray origin to current position
    this.ray.origin.x = currentPos.x;
    this.ray.origin.y = currentPos.y;
    this.ray.origin.z = currentPos.z;
    
    // Cast ray downward to detect ground
    const hit = world.castRay(this.ray, 10.0, true);
    
    if (hit) {
      // Calculate the point where the ray hit
      const hitPoint = {
        x: this.ray.origin.x + this.ray.dir.x * hit.toi,
        y: this.ray.origin.y + this.ray.dir.y * hit.toi,
        z: this.ray.origin.z + this.ray.dir.z * hit.toi
      };
      
      // Adjust height to stay above ground
      const newY = hitPoint.y + this.characterHeight / 2;
      
      // Only adjust if significantly different
      if (Math.abs(currentPos.y - newY) > 0.01) {
        this.rigidBody.setNextKinematicTranslation({
          x: currentPos.x,
          y: newY,
          z: currentPos.z
        });
        
        // Update debug visualization
        if (this.debugMesh) {
          this.debugMesh.position.y = newY;
        }
      }
    } else {
      // No ground found, apply gravity
      const gravity = -9.81 * deltaTime;
      const newY = currentPos.y + gravity;
      
      this.rigidBody.setNextKinematicTranslation({
        x: currentPos.x,
        y: newY,
        z: currentPos.z
      });
      
      // Update debug visualization
      if (this.debugMesh) {
        this.debugMesh.position.y = newY;
      }
    }
  }
  
  /**
   * Update the physics body each frame
   * @param {number} deltaTime - Time since last update
   */
  update(deltaTime) {
    if (!this.rigidBody || !this.characterMesh) {
      if (Math.random() < 0.1) { // Less frequent warning to reduce spam
        console.warn('[CHARACTER PHYSICS] Cannot update physics - rigidBody or characterMesh not available');
      }
      return;
    }
    
    // Get current position from the character mesh
    const meshPosition = new THREE.Vector3().copy(this.characterMesh.position);
    
    // Log positions every few seconds for debugging
    if (Math.random() < 0.01) { // Log roughly once every 100 frames
      console.log(`[CHARACTER PHYSICS] Character mesh position: (${meshPosition.x.toFixed(2)}, ${meshPosition.y.toFixed(2)}, ${meshPosition.z.toFixed(2)})`);
      
      if (this.debugMesh) {
        console.log(`[CHARACTER PHYSICS] Debug mesh position: (${this.debugMesh.position.x.toFixed(2)}, ${this.debugMesh.position.y.toFixed(2)}, ${this.debugMesh.position.z.toFixed(2)}) - Visible: ${this.debugMesh.visible}`);
      }
    }
    
    // Update physics body to follow mesh
    this.updatePosition(meshPosition);
    
    // Apply gravity and collision
    this.applyGravityAndGroundCollision(deltaTime);
    
    // Get updated position after physics
    const physicsPos = this.rigidBody.translation();
    
    // Update character mesh position to match physics body (with a slight upward offset to avoid clipping)
    // This is crucial for maintaining the connection between visual and physics
    this.characterMesh.position.set(physicsPos.x, physicsPos.y, physicsPos.z);
    
    // Ensure debug mesh is properly aligned with the physics body
    // Update it explicitly to make sure it stays visible and correctly positioned
    if (this.debugMesh) {
      // Set position directly for more reliable positioning
      this.debugMesh.position.set(physicsPos.x, physicsPos.y, physicsPos.z);
      
      // Make sure it stays visible
      if (this.debugVisible && !this.debugMesh.visible) {
        console.log('[CHARACTER PHYSICS] Forcing debug mesh to be visible');
        this.debugMesh.visible = true;
      }
    }
  }
  
  /**
   * Toggle visibility of debug visualization
   * @param {boolean} visible - Whether debug should be visible
   */
  toggleDebug(visible) {
    if (this.debugMesh) {
      this.debugMesh.visible = visible;
      this.debugVisible = visible;
      console.log(`[CHARACTER PHYSICS] Debug visualization ${visible ? 'ENABLED' : 'DISABLED'}`);
      
      if (visible) {
        // When enabling, log position and ensure high render order
        console.log('[CHARACTER PHYSICS] Debug mesh position:', 
          this.debugMesh.position.x.toFixed(2), 
          this.debugMesh.position.y.toFixed(2), 
          this.debugMesh.position.z.toFixed(2));
        this.debugMesh.renderOrder = 9999;
      }
    } else {
      console.warn('[CHARACTER PHYSICS] Cannot toggle debug visualization - debugMesh not available');
    }
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    // Remove physics body
    if (this.rigidBody && window.physicsWorld) {
      window.physicsWorld.removeRigidBody(this.rigidBody);
      this.rigidBody = null;
    }
    
    // Remove debug visualization
    if (this.debugMesh && window.renderer) {
      window.renderer.removeObject('characterPhysicsDebug');
      this.debugMesh = null;
    }
  }
}

export default CharacterPhysics; 