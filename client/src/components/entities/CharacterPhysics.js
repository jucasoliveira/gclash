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
    
    // Ray casting for ground detection - will be fully initialized in _initPhysics
    this.ray = null;
    
    // Movement properties
    this.currentVelocity = new THREE.Vector3();
    this.targetPosition = null;
    this.isMoving = false;
    
    // Physics properties
    this.fallSpeed = 0;
    this.verticalVelocity = 0;
    
    // Log construction for debugging
    console.log(`[CHARACTER PHYSICS] Created physics controller with height: ${this.characterHeight.toFixed(2)}, radius: ${this.characterRadius.toFixed(2)}`);
    console.log(`[CHARACTER PHYSICS] Initial position: (${this.initialPosition.x.toFixed(2)}, ${this.initialPosition.y.toFixed(2)}, ${this.initialPosition.z.toFixed(2)})`);
    
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
    // Check for required dependencies
    if (!window.RAPIER || !window.physicsWorld) {
      console.error('[CHARACTER PHYSICS] Unable to initialize physics - RAPIER or physicsWorld not available');
      return;
    }

    const world = window.physicsWorld;
    const RAPIER = window.RAPIER;

    // Calculate the initial height based on the map
    let mapHeight = 0;
    if (window.game?.currentMap?.getHeightAt) {
      const heightPos = new THREE.Vector3(this.initialPosition.x, 0, this.initialPosition.z);
      mapHeight = window.game.currentMap.getHeightAt(heightPos);
      
      if (mapHeight !== undefined && !isNaN(mapHeight)) {
        console.log(`[CHARACTER PHYSICS] Map height at initial position: ${mapHeight.toFixed(2)}`);
      } else {
        console.warn('[CHARACTER PHYSICS] Failed to get map height at initial position');
        mapHeight = 0; // Fallback to 0 if height not available
      }
    }
    
    // CRITICAL FIX: Position the character mesh directly on the ground
    // The physics body should be positioned at the center of the character
    
    // Set the character mesh position directly on ground level
    if (this.characterMesh) {
      // FIXED: Adjust the initial position to account for the character mesh's height center
      const characterMeshHeight = 1.6; // Based on mesh dimensions 0.80 x 1.60 x 0.80
      this.characterMesh.position.set(
        this.initialPosition.x,
        mapHeight + (characterMeshHeight / 2), // Position at mesh center height above ground
        this.initialPosition.z
      );
      console.log(`[CHARACTER PHYSICS] Positioned character mesh at correct height: (${this.characterMesh.position.x.toFixed(2)}, ${this.characterMesh.position.y.toFixed(2)}, ${this.characterMesh.position.z.toFixed(2)})`);
      console.log(`[CHARACTER PHYSICS] Ground height: ${mapHeight.toFixed(2)}, Mesh height offset: ${(characterMeshHeight / 2).toFixed(2)}`);
    }
    
    // CRITICAL FIX: Calculate physics body position (at character center)
    // The physics body should be positioned at half the character's height above the ground
    const physicsY = mapHeight + (this.characterHeight / 2);
    
    console.log(`[CHARACTER PHYSICS] Positioning - Ground: ${mapHeight.toFixed(2)}, Physics: ${physicsY.toFixed(2)}`);
    
    // Create kinematic body at the center of the character
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(
        this.initialPosition.x,
        physicsY, // Position at the center of the character
        this.initialPosition.z
      );
    
    this.rigidBody = world.createRigidBody(bodyDesc);
    
    // IMPROVED COLLIDER: Create a capsule collider that properly matches the character mesh dimensions
    // For a typical character cube with dimensions 0.8 x 1.6 x 0.8, adjust the capsule to fully envelop it
    
    // CRITICAL FIX: Adjust capsule parameters to fully encompass the character mesh
    // For a character with height 1.6, make the capsule slightly larger
    // Use the character's dimension as the basis for the collider size
    const halfHeight = this.characterHeight * 0.4; // 40% of character height for half-height
    
    // Make sure the radius is at least half the character's width/depth
    // For a cube, this should be at least half the width/depth to fully envelop it
    const radius = Math.max(this.characterRadius, 0.4); // At least 0.4 to cover the character's width
    
    console.log(`[CHARACTER PHYSICS] Creating capsule collider - halfHeight: ${halfHeight.toFixed(2)}, radius: ${radius.toFixed(2)}`);
    
    // Create a capsule collider with the adjusted parameters
    // The capsule is aligned with the Y axis, with the cylinder part centered at the origin
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
    
    // Enable continuous collision detection to prevent falling through ground at high speeds
    colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    
    // Create the collider and attach it to the rigid body
    this.collider = world.createCollider(colliderDesc, this.rigidBody);
    
    console.log('[CHARACTER PHYSICS] Physics body and collider created successfully');
    
    // Create debug visualization to show the physics body
    this._createDebugVisualization();
    
    // Initialize map collision if available
    this._initMapCollision();
  }
  
  /**
   * Initialize collision detection with the map floor
   * @private
   */
  _initMapCollision() {
    if (!window.game || !window.game.currentMap) {
      console.warn('[CHARACTER PHYSICS] Could not initialize map collision - game or map not available');
      return;
    }
    
    const map = window.game.currentMap;
    
    // Check if physics terrain needs to be initialized
    if (typeof map.createPhysicsTerrain === 'function' && !map.physicsInitialized) {
      console.log('[CHARACTER PHYSICS] Initializing map physics terrain');
      map.createPhysicsTerrain();
    }
    
    // Try an initial ray cast to detect the ground
    if (window.physicsWorld && this.ray) {
      const hit = window.physicsWorld.castRay(this.ray, 50.0, true);
      
      if (hit) {
        console.log(`[CHARACTER PHYSICS] Initial ray cast detected ground at distance: ${hit.toi?.toFixed(2) || 'unknown'}`);
      } else {
        console.log('[CHARACTER PHYSICS] Initial ray cast did not hit ground - using map height data');
        
        // Try map height data as fallback
        if (typeof map.getHeightAt === 'function') {
          const position = new THREE.Vector3(
            this.initialPosition.x,
            0,
            this.initialPosition.z
          );
          
          const height = map.getHeightAt(position);
          if (height !== undefined) {
            console.log(`[CHARACTER PHYSICS] Map height at initial position: ${height.toFixed(2)}`);
          }
        }
      }
    }
  }
  
  /**
   * Create a visual representation of the physics body for debugging
   * @private
   */
  _createDebugVisualization() {
    if (!window.renderer) {
      console.warn('[CHARACTER PHYSICS] Cannot create debug visualization - renderer not available');
      return;
    }
    
    // CRITICAL FIX: Use the exact same dimensions as the actual physics collider
    // This ensures the debug visualization accurately represents the physics body
    const halfHeight = this.characterHeight * 0.4; // 40% of character height
    const radius = Math.max(this.characterRadius, 0.4); // Match the collider radius
    
    console.log(`[CHARACTER PHYSICS] Creating debug visualization with radius ${radius.toFixed(2)} and half-height ${halfHeight.toFixed(2)}`);
    
    // Create capsule geometry with higher segment count for smoother visualization
    const geometry = new THREE.CapsuleGeometry(radius, halfHeight * 2, 16, 16);
    
    // Use a semi-transparent red material for better visibility
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000, // Bright red
      wireframe: true, // Wireframe for clear visualization
      transparent: true,
      opacity: 0, // Reduced opacity for less visual interference
      depthTest: false, // Ensure it's visible even through other objects
      side: THREE.DoubleSide // Visible from both sides
    });
    
    // Create the debug mesh
    this.debugMesh = new THREE.Mesh(geometry, material);
    
    // IMPORTANT: Position the debug mesh at the physics body position
    if (this.rigidBody) {
      const pos = this.rigidBody.translation();
      this.debugMesh.position.set(pos.x, pos.y, pos.z);
      console.log(`[CHARACTER PHYSICS] Debug mesh positioned at physics body: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    } else if (this.characterMesh) {
      // If no physics body yet, position at character's center
      const meshPos = this.characterMesh.position;
      this.debugMesh.position.set(
        meshPos.x,
        meshPos.y + (this.characterHeight / 2), // Position at center of character
        meshPos.z
      );
      console.log(`[CHARACTER PHYSICS] Debug mesh positioned at character center: (${this.debugMesh.position.x.toFixed(2)}, ${this.debugMesh.position.y.toFixed(2)}, ${this.debugMesh.position.z.toFixed(2)})`);
    } else {
      // Fallback to initial position
      this.debugMesh.position.copy(this.initialPosition);
      this.debugMesh.position.y += this.characterHeight / 2; // Position at center of character
      console.log(`[CHARACTER PHYSICS] Debug mesh positioned at initial position: (${this.debugMesh.position.x.toFixed(2)}, ${this.debugMesh.position.y.toFixed(2)}, ${this.debugMesh.position.z.toFixed(2)})`);
    }
    
    // Set a very high renderOrder to ensure it's drawn on top
    this.debugMesh.renderOrder = 9999;
    
    // Add to scene via event bus
    eventBus.emit('renderer.addObject', {
      id: 'characterPhysicsDebug',
      object: this.debugMesh,
      temporary: false
    });
    
    // Make visible by default for debugging
    this.debugMesh.visible = true;
    this.debugVisible = true;
    
    console.log('[CHARACTER PHYSICS] Debug visualization is now VISIBLE by default');
  }
  
  /**
   * Set a new target position for the character to move toward
   * @param {THREE.Vector3} position - Target position
   */
  setTargetPosition(position) {
    // Validate input
    if (!position || typeof position !== 'object' || 
        isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
      console.error('[CHARACTER PHYSICS] Invalid target position:', position);
      return;
    }
    
    // Check if physics is initialized
    if (!this.rigidBody) {
      console.error('[CHARACTER PHYSICS] Cannot set target position - rigid body not initialized');
      console.log('[CHARACTER PHYSICS] Will retry in 500ms...');
      
      // Retry after a short delay to allow physics to initialize
      setTimeout(() => {
        console.log('[CHARACTER PHYSICS] Retrying setTargetPosition...');
        if (this.rigidBody) {
          this.setTargetPosition(position);
        } else {
          console.error('[CHARACTER PHYSICS] Rigid body still not available after retry');
        }
      }, 500);
      
      return;
    }
    
    // Get current physics position
    const currentPos = this.rigidBody.translation();
    
    // CRITICAL FIX: Adjust the target position for the physics body
    // The target position is usually at ground level (where the character's feet should be)
    // But the physics body is at the character's center, so we need to adjust the Y coordinate
    
    // Get the ground height at the target position
    let targetGroundHeight = position.y;
    if (window.game?.currentMap?.getHeightAt) {
      const mapHeight = window.game.currentMap.getHeightAt(new THREE.Vector3(position.x, 0, position.z));
      if (mapHeight !== undefined && !isNaN(mapHeight)) {
        targetGroundHeight = mapHeight;
        console.log(`[CHARACTER PHYSICS] Found ground height at target: ${mapHeight.toFixed(2)}`);
      }
    }
    
    // CRITICAL FIX: Create a new target position with the adjusted Y coordinate
    // Position the physics body at half the character's height above the ground
    const adjustedTarget = new THREE.Vector3(
      position.x,
      targetGroundHeight + (this.characterHeight / 2), // Position at center of character
      position.z
    );
    
    // Check distance to target position
    const dx = adjustedTarget.x - currentPos.x;
    const dz = adjustedTarget.z - currentPos.z;
    const distanceSquared = dx * dx + dz * dz;
    
    // Only set as moving if target is significantly different from current position
    const minDistanceSquared = 0.01; // Minimum squared distance to consider as a new target
    if (distanceSquared < minDistanceSquared) {
      console.log('[CHARACTER PHYSICS] Target position too close to current position, ignoring');
      return;
    }
    
    // Store the adjusted target position
    this.targetPosition = adjustedTarget;
    this.isMoving = true;
    
    // Create a normalized direction vector for movement
    this.currentVelocity = new THREE.Vector3();
    
    console.log(`[CHARACTER PHYSICS] New target position set: (${adjustedTarget.x.toFixed(2)}, ${adjustedTarget.y.toFixed(2)}, ${adjustedTarget.z.toFixed(2)})`);
    console.log(`[CHARACTER PHYSICS] Original target: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    console.log(`[CHARACTER PHYSICS] Current position: (${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(2)}, ${currentPos.z.toFixed(2)})`);
    console.log(`[CHARACTER PHYSICS] Distance to target: ${Math.sqrt(distanceSquared).toFixed(2)}`);
  }
  
  /**
   * Update the physics body each frame
   * @param {number} deltaTime - Time since last update
   */
  update(deltaTime) {
    // Safety check for required components
    if (!this.rigidBody) {
      if (Math.random() < 0.1) { // Less frequent warning to reduce spam
        console.warn('[CHARACTER PHYSICS] Cannot update physics - rigidBody not available');
        
        // Check if physics world is available but rigid body isn't
        if (window.RAPIER && window.physicsWorld && !this.rigidBody) {
          console.log('[CHARACTER PHYSICS] Physics world is available but rigid body is not - attempting to initialize');
          this._initPhysics();
        }
      }
      return;
    }
    
    if (!this.characterMesh) {
      if (Math.random() < 0.1) { // Less frequent warning to reduce spam
        console.warn('[CHARACTER PHYSICS] Cannot update physics - characterMesh not available');
      }
      return;
    }
    
    // Get the current physics body position
    const physicsPos = this.rigidBody.translation();
    
    // Check for NaN values in physics position
    if (isNaN(physicsPos.x) || isNaN(physicsPos.y) || isNaN(physicsPos.z)) {
      console.error('[CHARACTER PHYSICS] Physics body has invalid position:', physicsPos);
      
      // Try to reset to a safe position
      if (this.initialPosition) {
        console.log('[CHARACTER PHYSICS] Resetting to initial position due to invalid physics state');
        this.rigidBody.setNextKinematicTranslation({
          x: this.initialPosition.x,
          y: this.initialPosition.y + (this.characterHeight / 2), // Position at center of character
          z: this.initialPosition.z
        });
      }
      
      return;
    }
    
    // FIRST: Check map height as a direct safety measure every frame
    // This ensures we never fall through the map, even if ray casting fails
    let mapHeight = 0;
    let safeY;
    const characterHeight = this.characterHeight || 1.8;
    const characterRadius = this.characterRadius || 0.3;
    const groundThreshold = 0.05; // Reduced from 0.1 to 0.05 for closer ground contact
    
    if (window.game?.currentMap?.getHeightAt) {
      mapHeight = window.game.currentMap.getHeightAt(new THREE.Vector3(physicsPos.x, 0, physicsPos.z));
      
      if (mapHeight !== undefined && !isNaN(mapHeight)) {
        // CRITICAL FIX: Calculate a safe position for the physics body
        // Position the physics body at half the character's height above the ground
        safeY = mapHeight + (characterHeight / 2);
        
        // CRITICAL FIX: If physics body is too high above the ground, force it down
        // This fixes the issue where the physics body is floating too high
        if (physicsPos.y > safeY + 0.1) { // If more than 0.1 units above safe height
          this.rigidBody.setNextKinematicTranslation({
            x: physicsPos.x,
            y: safeY,
            z: physicsPos.z
          });
          
          // Reset fall speed
          this.fallSpeed = 0;
          
          // Log only occasionally to avoid spam
          if (Math.random() < 0.05) {
            console.log(`[SYNC FIX] Physics body too high (${physicsPos.y.toFixed(2)}) - adjusted down to ${safeY.toFixed(2)}`);
          }
          
          // Update debug visualization
          if (this.debugMesh) {
            this.debugMesh.position.y = safeY;
          }
        }
        
        // If character is below safe height, immediately place at safe height
        if (physicsPos.y < safeY - 0.05) { // Small threshold to prevent constant adjustments
          this.rigidBody.setNextKinematicTranslation({
            x: physicsPos.x,
            y: safeY,
            z: physicsPos.z
          });
          
          // Reset fall speed
          this.fallSpeed = 0;
          
          // Log only occasionally to avoid spam
          if (Math.random() < 0.05) {
            console.log(`[SAFETY] Character below safe height - adjusted to ${safeY.toFixed(2)}`);
          }
          
          // Update debug visualization if available
          if (this.debugMesh) {
            this.debugMesh.position.y = safeY;
          }
        }
      }
    }
    
    // Apply gravity and collision detection SECOND
    // This handles ray-based ground detection
    this.applyGravityAndGroundCollision(deltaTime);
    
    // Get the updated physics body position after gravity
    const updatedPhysicsPos = this.rigidBody.translation();
    
    // Move toward target position if we have one
    if (this.targetPosition && this.isMoving) {
      this._updateMovement(deltaTime, updatedPhysicsPos);
    }
    
    // Get the final physics body position after all updates
    const finalPhysicsPos = this.rigidBody.translation();
    
    // Get the current map height at the character's position for mesh placement
    let groundY = 0;
    if (window.game?.currentMap?.getHeightAt) {
      groundY = window.game.currentMap.getHeightAt(new THREE.Vector3(finalPhysicsPos.x, 0, finalPhysicsPos.z)) || 0;
    }
    
    // FIXED: Calculate the correct Y position for the mesh based on mesh dimensions
    // If the mesh's pivot/origin is at its center, we need to offset by half its height
    const characterMeshHeight = 1.6; // Based on logs showing mesh dimensions 0.80 x 1.60 x 0.80
    const meshY = groundY + (characterMeshHeight / 2);
    
    // Safety check before updating character mesh position
    if (isNaN(finalPhysicsPos.x) || isNaN(meshY) || isNaN(finalPhysicsPos.z)) {
      console.error('[CHARACTER PHYSICS] Calculated invalid character mesh position');
      return;
    }
    
    // Update character mesh position to match ground height with proper offset
    this.characterMesh.position.x = finalPhysicsPos.x;
    this.characterMesh.position.z = finalPhysicsPos.z;
    
    // Use direct assignment to ensure precise positioning
    this.characterMesh.position.y = meshY;
    
    // Log position occasionally for debugging
    if (Math.random() < 0.01) {
      console.log(`[CHARACTER PHYSICS] Mesh positioned at: (${this.characterMesh.position.x.toFixed(2)}, ${this.characterMesh.position.y.toFixed(2)}, ${this.characterMesh.position.z.toFixed(2)})`);
      console.log(`[CHARACTER PHYSICS] Ground height: ${groundY.toFixed(2)}, Mesh height offset: ${(characterMeshHeight / 2).toFixed(2)}`);
    }
    
    // IMPORTANT: Force the physics body to match the mesh's XZ position but maintain its proper Y height
    // This keeps the physics body centered above the mesh at the correct height
    const correctPhysicsY = groundY + (characterHeight / 2);
    
    // Only adjust if there's a significant difference
    if (Math.abs(finalPhysicsPos.y - correctPhysicsY) > 0.05) {
      this.rigidBody.setNextKinematicTranslation({
        x: finalPhysicsPos.x,
        y: correctPhysicsY,
        z: finalPhysicsPos.z
      });
      
      // Update debug visualization
      if (this.debugMesh) {
        this.debugMesh.position.y = correctPhysicsY;
      }
      
      if (Math.random() < 0.05) {
        console.log(`[SYNC FIX] Adjusted physics Y from ${finalPhysicsPos.y.toFixed(2)} to ${correctPhysicsY.toFixed(2)}`);
      }
    }
    
    // Update character mesh rotation to face movement direction
    if (this.isMoving && this.lastMoveDirection) {
      // Calculate the angle from the move direction
      const angle = Math.atan2(this.lastMoveDirection.x, this.lastMoveDirection.z);
      // Set the mesh rotation
      this.characterMesh.rotation.y = angle;
    }
    
    // Log occasionally to debug sync issues
    if (Math.random() < 0.01) {
      console.log(`[CHARACTER PHYSICS] Sync - Physics: (${finalPhysicsPos.x.toFixed(2)}, ${finalPhysicsPos.y.toFixed(2)}, ${finalPhysicsPos.z.toFixed(2)}) Mesh: (${this.characterMesh.position.x.toFixed(2)}, ${this.characterMesh.position.y.toFixed(2)}, ${this.characterMesh.position.z.toFixed(2)})`);
      if (groundY !== undefined) {
        console.log(`[CHARACTER PHYSICS] Ground Y: ${groundY.toFixed(2)}, Physics Y: ${finalPhysicsPos.y.toFixed(2)}, Mesh Y: ${meshY.toFixed(2)}`);
      }
    }
    
    // Update debug visualization if present
    if (this.debugMesh) {
      this.debugMesh.position.set(finalPhysicsPos.x, finalPhysicsPos.y, finalPhysicsPos.z);
      
      // Make sure it stays visible if debug is enabled
      if (this.debugVisible && !this.debugMesh.visible) {
        this.debugMesh.visible = true;
      }
    }
  }
  
  /**
   * Update character movement toward target position
   * @param {number} deltaTime - Time since last update
   * @param {Object} physicsPos - Current physics body position
   * @private 
   */
  _updateMovement(deltaTime, physicsPos) {
    // Safety check for rigid body
    if (!this.rigidBody) {
      console.error('[CHARACTER PHYSICS] Cannot update movement - rigid body not available');
      return;
    }
    
    // Safety check for target position
    if (!this.targetPosition) {
      console.warn('[CHARACTER PHYSICS] No target position set, cannot move');
      this.isMoving = false;
      return;
    }
    
    // Create a current position vector from physics body position
    const currentPos = new THREE.Vector3(physicsPos.x, physicsPos.y, physicsPos.z);
    
    // Calculate direction to target (in XZ plane only)
    const direction = new THREE.Vector3()
      .subVectors(this.targetPosition, currentPos)
      .setY(0) // Ignore Y component for horizontal movement
      .normalize();
    
    // Store this direction for character rotation
    this.lastMoveDirection = direction.clone();
    
    // Check if direction is valid (not NaN)
    if (isNaN(direction.x) || isNaN(direction.y) || isNaN(direction.z)) {
      console.error('[CHARACTER PHYSICS] Invalid movement direction:', direction);
      this.isMoving = false;
      return;
    }
    
    // Calculate move speed and distance
    const moveSpeed = 5.0 * deltaTime; // Base speed of 5 units per second
    const distanceToTarget = currentPos.distanceTo(this.targetPosition);
    
    // If close enough to target, stop moving
    if (distanceToTarget < 0.1) {
      this.isMoving = false;
      console.log('[CHARACTER PHYSICS] Reached target position, stopping movement');
      return;
    }
    
    // Calculate actual movement distance this frame
    let movement = Math.min(moveSpeed, distanceToTarget);
    
    // Calculate the new position for look-ahead
    const newX = currentPos.x + direction.x * movement;
    const newZ = currentPos.z + direction.z * movement;
    
    // Look ahead with a ray to determine terrain height at the next position
    // This helps prevent stepping into holes or walls
    if (window.RAPIER && window.physicsWorld) {
      // Create a ray for terrain height detection at the target position
      const lookAheadRay = new window.RAPIER.Ray(
        // Start ray from slightly above the future position
        { 
          x: newX,
          y: currentPos.y + this.characterHeight, // Start from above
          z: newZ
        },
        // Point straight down
        { x: 0, y: -1, z: 0 }
      );
      
      // Cast the ray to find terrain height
      const hit = window.physicsWorld.castRay(lookAheadRay, 20.0, true);
      
      if (hit) {
        // Calculate terrain height at the new position
        const hitPointY = lookAheadRay.origin.y + lookAheadRay.dir.y * hit.toi;
        
        // Check if the terrain slope is too steep (height difference too large)
        const heightDifference = Math.abs(hitPointY - currentPos.y);
        const maxClimbHeight = this.characterRadius * 1.5; // Same as in applyGravityAndGroundCollision
        
        if (heightDifference > maxClimbHeight) {
          // Terrain is too steep in this direction - adjust movement
          if (Math.random() < 0.05) { // Log occasionally
            console.log(`[TERRAIN] Too steep to climb: ${heightDifference.toFixed(2)} > ${maxClimbHeight.toFixed(2)}`);
          }
          
          // Reduce movement to slow down when approaching steep terrain
          // This makes the character slow down rather than stop completely
          movement *= 0.2;
        }
      }
    }
    
    // Apply the movement with potentially reduced speed from terrain check
    const moveVector = direction.clone().multiplyScalar(movement);
    
    // Calculate new position
    const newPosition = {
      x: currentPos.x + moveVector.x,
      y: currentPos.y, // Maintain current Y (applyGravityAndGroundCollision will handle height)
      z: currentPos.z + moveVector.z
    };
    
    try {
      // Update the rigid body position
      this.rigidBody.setNextKinematicTranslation(newPosition);
      
      // Log movement occasionally
      if (Math.random() < 0.01) {
        console.log(`[CHARACTER PHYSICS] Moving to target: ${distanceToTarget.toFixed(2)} units away, speed: ${moveSpeed.toFixed(2)}, movement: ${movement.toFixed(2)}`);
      }
    } catch (error) {
      console.error('[CHARACTER PHYSICS] Error updating rigid body position:', error);
      console.log('[CHARACTER PHYSICS] Attempted to move to:', newPosition);
    }
  }
  
  /**
   * Apply gravity and handle ground collision
   * @param {number} deltaTime - Time since last update
   */
  applyGravityAndGroundCollision(deltaTime) {
    if (!this.rigidBody || !window.physicsWorld) {
      console.warn('[CHARACTER PHYSICS] Cannot apply gravity - physics world or rigid body not available');
      return;
    }
    
    const world = window.physicsWorld;
    const currentPos = this.rigidBody.translation();
    
    // ENHANCED SAFETY CHECK: If the character has fallen too far, reset position immediately
    // This prevents the character from falling forever if there's no ground detection
    const MINIMUM_Y_POSITION = -3; // Reduced from -5 to -3 for even faster recovery
    if (currentPos.y < MINIMUM_Y_POSITION) {
      console.warn(`[CHARACTER PHYSICS] Character fell below minimum Y (${currentPos.y.toFixed(2)}), resetting to safe position`);
      
      // Instead of using initial position, try to find a safe spawn position
      let safePosition;
      
      // Try to get a spawn position from the current map
      if (window.game && window.game.currentMap && typeof window.game.currentMap.getRandomSpawnPosition === 'function') {
        safePosition = window.game.currentMap.getRandomSpawnPosition();
        console.log(`[CHARACTER PHYSICS] Found safe spawn position on map: (${safePosition.x.toFixed(2)}, ${safePosition.y.toFixed(2)}, ${safePosition.z.toFixed(2)})`);
      } else {
        // Fallback to initial position or origin
        safePosition = {
          x: this.initialPosition ? this.initialPosition.x : 0,
          y: this.initialPosition ? Math.max(this.initialPosition.y, 4) : 4, // Increased from 3 to 4 units high
          z: this.initialPosition ? this.initialPosition.z : 0
        };
        console.log(`[CHARACTER PHYSICS] Using fallback safe position: (${safePosition.x.toFixed(2)}, ${safePosition.y.toFixed(2)}, ${safePosition.z.toFixed(2)})`);
      }
      
      // Update the rigid body position
      this.rigidBody.setNextKinematicTranslation(safePosition);
      
      // Reset fall speed
      this.fallSpeed = 0;
      
      // Also update the character mesh if available
      if (this.characterMesh) {
        // Apply character height offset for proper mesh positioning
        const yOffset = this.characterHeight / 2; // Position mesh with feet on ground
        this.characterMesh.position.set(safePosition.x, safePosition.y - yOffset, safePosition.z);
      }
      
      return;
    }
    
    // Store the character height and radius for calculations
    const characterHeight = this.characterHeight || 1.8;
    const characterRadius = this.characterRadius || 0.3;
    
    // Calculate maximum step height the character can climb
    // This allows the character to move up small steps or inclines
    const maxStepHeight = characterRadius * 1.5; // Adjust this multiplier to control step climbing ability
    
    // Calculate threshold distance for ground detection
    // This threshold defines how far above the ground the character should stay
    const groundThreshold = characterRadius + 0.1; // Reduced from 0.2 to 0.1 for closer ground contact
    
    // Initialize or update the terrain normal storage (for slope detection)
    this.terrainNormal = this.terrainNormal || { x: 0, y: 1, z: 0 };
    
    // Initialize or update step detection variables
    this.lastGroundY = this.lastGroundY !== undefined ? this.lastGroundY : currentPos.y;
    this.onStep = this.onStep || false;
    
    // Store the current vertical fall speed for smoothing
    this.fallSpeed = this.fallSpeed || 0;
    
    // IMPROVED: First try to get height from the map - more reliable than raycasting
    let mapHeight;
    let groundDetected = false;
    let groundY = null;
    
    if (window.game && window.game.currentMap && typeof window.game.currentMap.getHeightAt === 'function') {
      // Try to get height from the map
      mapHeight = window.game.currentMap.getHeightAt(new THREE.Vector3(currentPos.x, 0, currentPos.z));
      
      if (mapHeight !== undefined && !isNaN(mapHeight)) {
        groundDetected = true;
        groundY = mapHeight;
        
        // CRITICAL FIX: Adjust position to stay above terrain with proper offset
        const newY = groundY + (characterHeight / 2);
        
        // Always prioritize map height data, especially when close to the terrain
        // Use it if we're falling or within a reasonable distance of where we should be
        const shouldUseMapHeight = 
          this.fallSpeed < 0 || // We're falling
          Math.abs(currentPos.y - newY) < 3.0; // Not too far from where we should be
          
        if (shouldUseMapHeight) {
          this.rigidBody.setNextKinematicTranslation({
            x: currentPos.x,
            y: newY,
            z: currentPos.z
          });
          
          // Reset fall speed when grounded
          this.fallSpeed = 0;
          
          // Log only if significant change
          if (Math.abs(currentPos.y - newY) > 0.1) {
            console.log(`[GROUND] Using map height data: ${mapHeight.toFixed(2)}, adjusted Y to ${newY.toFixed(2)}`);
          }
          
          // Update last ground Y
          this.lastGroundY = groundY;
          
          // No need to continue with ray casting if we have good map data
          return;
        }
      }
    }
    
    // FALLBACK: If map height data isn't available or reliable, use ray casting
    // Create the ray for ground detection if it doesn't exist
    if (!this.ray) {
      if (!window.RAPIER) {
        console.error('[CHARACTER PHYSICS] RAPIER not available, cannot create ray');
        return;
      }
      
      // Initialize ray pointing downward from the character position
      const rayOrigin = {
        x: currentPos.x,
        y: currentPos.y + 0.5, // Start ray from higher above the character
        z: currentPos.z
      };
      
      this.ray = new window.RAPIER.Ray(
        rayOrigin,
        { x: 0, y: -1, z: 0 } // Pointing straight down
      );
      
      console.log(`[CHARACTER PHYSICS] Ray created for ground detection at (${rayOrigin.x.toFixed(2)}, ${rayOrigin.y.toFixed(2)}, ${rayOrigin.z.toFixed(2)})`);
    }
    
    // IMPROVED: Update ray origin to current position, from higher above the character
    // This helps avoid starting the ray inside geometry which might cause it to miss collisions
    this.ray.origin.x = currentPos.x;
    this.ray.origin.y = currentPos.y + 0.5; // Increased from 0.4 to 0.5 for higher origin
    this.ray.origin.z = currentPos.z;
    
    // Direction is always downward
    this.ray.dir.x = 0;
    this.ray.dir.y = -1;
    this.ray.dir.z = 0;
    
    // Cast the ray for ground detection
    const maxToi = 50.0; // Keep at 50.0 to detect ground far below
    const solid = true; // Stop at first hit
    
    const hit = world.castRay(this.ray, maxToi, solid);
    
    // Enhanced debugging - more details about the hit result
    if (Math.random() < 0.05) { // Increased frequency for debugging
      console.log(`[RAY DEBUG] Casting ray from (${this.ray.origin.x?.toFixed(2) || 'undefined'}, ${this.ray.origin.y?.toFixed(2) || 'undefined'}, ${this.ray.origin.z?.toFixed(2) || 'undefined'}) downward`);
      
      // Detailed hit result logging
      if (hit) {
        const hitToi = hit.toi || 'unknown';
        const hitNormal = hit.normal ? `(${hit.normal.x?.toFixed(2) || '?'}, ${hit.normal.y?.toFixed(2) || '?'}, ${hit.normal.z?.toFixed(2) || '?'})` : 'unknown';
        const hitPoint = {
          x: this.ray.origin.x + this.ray.dir.x * (typeof hit.toi === 'number' ? hit.toi : 0),
          y: this.ray.origin.y + this.ray.dir.y * (typeof hit.toi === 'number' ? hit.toi : 0),
          z: this.ray.origin.z + this.ray.dir.z * (typeof hit.toi === 'number' ? hit.toi : 0)
        };
        
        console.log(`[RAY DEBUG] HIT at distance ${hitToi}, normal: ${hitNormal}, point: (${hitPoint.x.toFixed(2)}, ${hitPoint.y.toFixed(2)}, ${hitPoint.z.toFixed(2)})`);
        console.log(`[RAY DEBUG] Hit object details:`, hit.colliderHandle ? `Collider handle: ${hit.colliderHandle}` : 'No collider handle');
      } else {
        console.log(`[RAY DEBUG] NO HIT - Ray missed all terrain`);
      }
      
      // Check map height data regardless of ray hit
      if (mapHeight !== undefined) {
        console.log(`[RAY DEBUG] Map height at position: ${mapHeight.toFixed(2)}`);
      }
    }
    
    // Process ray hit result
    if (hit && typeof hit.toi === 'number') {
      // Calculate hit point
      const hitPoint = {
        x: this.ray.origin.x + this.ray.dir.x * hit.toi,
        y: this.ray.origin.y + this.ray.dir.y * hit.toi,
        z: this.ray.origin.z + this.ray.dir.z * hit.toi
      };
      
      // Store terrain normal if available
      if (hit.normal) {
        this.terrainNormal = hit.normal;
      }
      
      // Calculate the distance from the character's center to the ground
      const distanceToGround = hit.toi - 0.5; // Subtract the ray origin offset
      
      // If the ground is within our threshold, adjust position to stay above it
      if (distanceToGround < groundThreshold + characterHeight/2) {
        // CRITICAL FIX: Calculate new Y position to stay above ground with proper offset
        const newY = hitPoint.y + groundThreshold + (characterHeight / 2);
        
        // Check if this is a step (sudden height change)
        const heightDifference = Math.abs(hitPoint.y - this.lastGroundY);
        this.onStep = heightDifference > 0.1 && heightDifference < maxStepHeight;
        
        // Update the rigid body position
        this.rigidBody.setNextKinematicTranslation({
          x: currentPos.x,
          y: newY,
          z: currentPos.z
        });
        
        // Reset fall speed when grounded
        this.fallSpeed = 0;
        
        // Update last ground Y
        this.lastGroundY = hitPoint.y;
        
        // Log only if significant change or on a step
        if (Math.abs(currentPos.y - newY) > 0.1 || this.onStep) {
          console.log(`[GROUND] Ray hit at ${hitPoint.y.toFixed(2)}, adjusted Y to ${newY.toFixed(2)}${this.onStep ? ' (step detected)' : ''}`);
        }
        
        // Ground detected
        groundDetected = true;
        groundY = hitPoint.y;
      }
    }
    
    // If no ground was detected by either method, apply gravity
    if (!groundDetected) {
      // Apply gravity
      this._applyGravity(deltaTime, currentPos);
    }
  }
  
  /**
   * Apply gravity to make the character fall
   * @param {number} deltaTime - Time since last update
   * @param {Object} currentPos - Current physics body position
   * @private
   */
  _applyGravity(deltaTime, currentPos) {
    // Apply simulated gravity with smoothing
    const gravity = -6.0; // Adjusted from -5.0 to -6.0 for slightly faster falling
    const targetFallSpeed = this.fallSpeed + (gravity * deltaTime);
    
    // Limit maximum fall speed to prevent falling too fast
    const maxFallSpeed = -12.0; // Increased from -10.0 to -12.0 for faster terminal velocity
    const limitedTarget = Math.max(targetFallSpeed, maxFallSpeed);
    
    // Smooth fall speed for better visuals (lerp between current and target)
    // Increased responsiveness from 0.1 to 0.15 for faster reaction to gravity
    this.fallSpeed = this.fallSpeed * 0.85 + limitedTarget * 0.15;
    
    // Calculate new Y position with gravity applied
    const newY = currentPos.y + (this.fallSpeed * deltaTime);
    
    // Check for map height data as a backup safety measure
    let mapHeight;
    let safeY = null;
    const characterHeight = this.characterHeight || 1.8;
    const characterRadius = this.characterRadius || 0.3;
    
    if (window.game?.currentMap?.getHeightAt) {
      mapHeight = window.game.currentMap.getHeightAt(new THREE.Vector3(currentPos.x, 0, currentPos.z));
    }
    
    // Don't let character fall below map height
    if (mapHeight !== undefined && !isNaN(mapHeight)) {
      // CRITICAL FIX: Calculate safe height with proper offset
      // Position the physics body at half the character's height above the ground
      safeY = mapHeight + (characterHeight / 2);
      
      // If falling would put us below safe height, stop at the safe height
      if (newY < safeY) {
        // Set position to safe height
        this.rigidBody.setNextKinematicTranslation({
          x: currentPos.x,
          y: safeY,
          z: currentPos.z
        });
        
        // Stop falling
        this.fallSpeed = 0;
        
        // Update last ground Y for step detection
        this.lastGroundY = mapHeight;
        
        if (Math.random() < 0.05) { // Increased logging frequency
          console.log(`[GRAVITY] Fall prevented by map height data - adjusted Y to ${safeY.toFixed(2)}`);
        }
        
        // Update debug visualization if available
        if (this.debugMesh) {
          this.debugMesh.position.y = safeY;
        }
        
        return;
      }
    }
    
    // Update position with gravity applied
    this.rigidBody.setNextKinematicTranslation({
      x: currentPos.x,
      y: newY,
      z: currentPos.z
    });
    
    if (Math.random() < 0.03) { // Increased logging frequency
      console.log(`[GRAVITY] Falling - speed: ${this.fallSpeed.toFixed(2)}, new Y: ${newY.toFixed(2)}`);
      if (safeY !== null) {
        console.log(`[GRAVITY] Safe Y: ${safeY.toFixed(2)}, distance to safe: ${(newY - safeY).toFixed(2)}`);
      }
    }
    
    // Update debug visualization if available
    if (this.debugMesh) {
      this.debugMesh.position.y = newY;
    }
  }
  
  /**
   * Toggle the visibility of the debug visualization
   * @param {boolean} [visible] - If provided, set to this value, otherwise toggle
   * @returns {boolean} The new visibility state
   */
  toggleDebug(visible) {
    if (this.debugMesh) {
      // If visible parameter is provided, use it, otherwise toggle current state
      if (visible !== undefined) {
        this.debugMesh.visible = visible;
        this.debugVisible = visible;
      } else {
        this.debugMesh.visible = !this.debugMesh.visible;
        this.debugVisible = this.debugMesh.visible;
      }
      
      console.log(`[CHARACTER PHYSICS] Debug visualization ${this.debugVisible ? 'SHOWN' : 'HIDDEN'}`);
      return this.debugVisible;
    } else {
      console.warn('[CHARACTER PHYSICS] Cannot toggle debug - debug mesh not available');
      return false;
    }
  }
  
  /**
   * Get the current position of the physics body
   * @returns {Object|null} The position object with x, y, z properties, or null if not available
   */
  getPhysicsPosition() {
    if (this.rigidBody) {
      const pos = this.rigidBody.translation();
      return { x: pos.x, y: pos.y, z: pos.z };
    }
    return null;
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