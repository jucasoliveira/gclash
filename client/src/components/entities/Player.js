import * as THREE from 'three';
import Entity from './Entity.js';
import eventBus from '../core/EventBus.js';
import webSocketManager from '../network/WebSocketManager.js';
import game from '../core/Game.js';
import CharacterPhysics from './CharacterPhysics.js';

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
    
    // Set this as the local player
    this.isLocalPlayer = true;
    
    // Mouse movement properties
    this.targetPosition = null;
    this.isMouseMoving = false;
    this.pathfindingPath = [];
    this.movementSpeed = stats.speed * 2.0; // DRAMATICALLY increased from 0.5 to 2.0 for much faster movement
    
    // Attack target tracking
    this.attackTargetId = null;
    
    // Add mana system
    this.mana = 100; // Default max mana for all classes
    this.maxMana = 100;
    this.manaRegenRate = this.classType === 'CLERK' ? 5 : this.classType === 'WARRIOR' ? 2 : 3; // Per second
    this.lastManaRegen = 0;
    this.manaUsage = {
      CLERK: { cost: 15, regenBonus: { moving: 1, standing: 3 } },
      WARRIOR: { cost: 20, regenBonus: { onHit: 10 } },
      RANGER: { cost: 12, regenBonus: { notAttacking: 2 } }
    };
    this.lastAttackTime = 0;
    
    // Combat properties
    this.attackCooldown = 0;
    this.coreSkillCooldown = 0; // New property for core skill cooldown
    this.evadeCooldown = 0; // New property for evade cooldown
    this.isAttacking = false;
    this.primaryAttack = stats.abilities.primary;
    
    // Physics body for the character (will be initialized in init)
    this.physicsBody = null;
    
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
    webSocketManager.joinGame({
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
    
    // Initialize mana to full
    this.mana = this.maxMana;
    
    // Make sure the game UI is visible
    const gameUI = document.getElementById('game-ui');
    if (gameUI) {
      gameUI.classList.add('visible');
    }
    
    // Initialize UI elements
    this._initializeUI();
    
    // Force update health UI to ensure it's properly set at start
    this._updateHealthUI();
    
    // Initialize physics body after mesh is created
    this._initializePhysics();
    
    // Schedule a check for terrain meshes availability, to ensure movement works
    // even if physics initialization hasn't completed yet
    setTimeout(() => {
      this._ensureTerrainMeshesAvailable();
    }, 1000);
    
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
    
    // Initialize mana UI
    this._emitManaChange();
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
    
    // Initialize animations for the box mesh
    // This is a temporary solution until we have proper character models
    if (!this.mixer && this.mesh) {
      console.log('[PLAYER] Initializing basic animations for box mesh');
      
      // Create a simple animation mixer
      this.mixer = new THREE.AnimationMixer(this.mesh);
      
      // Create dummy animations
      const idleTrack = new THREE.AnimationClip('idle', 1, [
        new THREE.KeyframeTrack(
          '.rotation[y]',
          [0, 0.5, 1],
          [0, 0.05, 0]
        )
      ]);
      
      const runTrack = new THREE.AnimationClip('run', 0.5, [
        new THREE.KeyframeTrack(
          '.position[y]',
          [0, 0.25, 0.5],
          [this.mesh.position.y, this.mesh.position.y + 0.1, this.mesh.position.y]
        )
      ]);
      
      // Store animations
      this.animations = {
        'idle': this.mixer.clipAction(idleTrack),
        'run': this.mixer.clipAction(runTrack)
      };
      
      // Set loop modes
      this.animations['idle'].setLoop(THREE.LoopRepeat);
      this.animations['run'].setLoop(THREE.LoopRepeat);
      
      // Start with idle animation
      this.animations['idle'].play();
      this.currentAnimation = this.animations['idle'];
      
      console.log('[PLAYER] Basic animations initialized');
    }
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
    
    // Movement/Interact with left click
    eventBus.on('input.move', this._boundHandleMove = this._handleMove.bind(this));
    
    // Combat events
    eventBus.on('input.click', this._boundHandleAttack); // Basic attack with left click
    eventBus.on('input.coreSkill', this._boundHandleCoreSkill = this._handleCoreSkill.bind(this)); // Core skill with right click
    
    // Evade event
    eventBus.on('input.action.evade.start', this._boundHandleEvade = this._handleEvade.bind(this));
    
    // Skill slot events
    eventBus.on('input.skill.slot1.start', this._boundHandleSkill1 = this._handleSkill.bind(this, 1));
    eventBus.on('input.skill.slot2.start', this._boundHandleSkill2 = this._handleSkill.bind(this, 2));
    eventBus.on('input.skill.slot3.start', this._boundHandleSkill3 = this._handleSkill.bind(this, 3));
    eventBus.on('input.skill.slot4.start', this._boundHandleSkill4 = this._handleSkill.bind(this, 4));
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
   * Handle move event (click to move)
   * @param {Object} data - Position data
   * @private
   */
  _handleMove(data) {
    // Don't move if dead or taking damage
    if (this.isDead || this.isTakingDamage) {
      console.log('[PLAYER] Cannot move - character is dead or taking damage');
      return;
    }
    
    if (!this.characterPhysics || !this.characterPhysics.rigidBody) {
      console.error('[PLAYER] Cannot move - no physics body available');
      return;
    }
    
    // Validate move command data
    if (!data || typeof data !== 'object') {
      console.error('[PLAYER] Invalid move command data');
      return;
    }
    
    // Handle different data formats for movement
    let clickCoords;
    
    // Handle direct x/z coordinates for testing or direct positioning
    if (typeof data.x === 'number' && typeof data.z === 'number') {
      // Create a target position from direct coordinates
      const targetPosition = new THREE.Vector3(data.x, 0, data.z);
      
      console.log(`[PLAYER] Using direct position: (${targetPosition.x.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
      
      // Check if the target position is walkable
      let isWalkable = true;
      if (window.game && window.game.currentMap && typeof window.game.currentMap.isWalkable === 'function') {
        isWalkable = window.game.currentMap.isWalkable(targetPosition);
      }
      
      if (!isWalkable) {
        console.log('[PLAYER] Target position is not walkable, finding alternative path');
        
        // Try to find a walkable path
        const walkablePath = this._findWalkablePath(targetPosition);
        
        if (walkablePath) {
          console.log('[PLAYER] Found walkable alternative:', walkablePath);
          
          // Create visual indicator for non-walkable
          this._createNonWalkableIndicator(targetPosition);
          
          // Use the walkable point instead
          targetPosition.copy(walkablePath);
          
          // Create movement indicator at the walkable point
          this._createMovementIndicator(walkablePath);
        } else {
          console.log('[PLAYER] No walkable path found');
          
          // Create visual indicator for non-walkable
          this._createNonWalkableIndicator(targetPosition);
          
          // Can't move here
          return;
        }
      } else {
        // Create visual indicator for movement
        this._createMovementIndicator(targetPosition);
      }
      
      // Set the proper Y height based on the terrain
      if (window.game && window.game.currentMap && typeof window.game.currentMap.getHeightAt === 'function') {
        const terrainHeight = window.game.currentMap.getHeightAt(targetPosition);
        if (terrainHeight !== undefined && !isNaN(terrainHeight)) {
          targetPosition.y = terrainHeight;
          console.log(`[PLAYER] Set target height to match terrain: ${terrainHeight.toFixed(2)}`);
        }
      }
      
      // Update the character's target position using physics
      console.log(`[PLAYER] Setting movement target to: (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
      
      // Set the target position in the character physics controller
      this.characterPhysics.setTargetPosition(targetPosition);
      
      // Update animation
      this.animation = 'run';
      this._playAnimation('run');
      
      // Only emit server update if we're in multiplayer
      if (window.socket && window.isMultiplayer) {
        // Emit position update to server (for other players)
        this._emitPositionUpdate();
      }
      
      return;
    }
    
    // Get click coordinates from standard mouse click
    // Support both clickCoords (legacy) and position (new format from InputManager)
    clickCoords = data.clickCoords || data.position;
    if (!clickCoords) {
      console.error('[PLAYER] No click coordinates provided in data:', data);
      return;
    }
    
    console.log('[PLAYER] Processing click at screen coordinates:', clickCoords.x, clickCoords.y);
    
    // Convert click coordinates to NDC (Normalized Device Coordinates)
    // Use provided NDC if available, otherwise calculate
    let ndcCoords;
    if (data.ndc) {
      ndcCoords = data.ndc;
    } else {
      ndcCoords = new THREE.Vector2(
        (clickCoords.x / window.innerWidth) * 2 - 1,
        -(clickCoords.y / window.innerHeight) * 2 + 1
      );
    }
    
    console.log(`[PLAYER] Processing click at NDC coordinates: (${ndcCoords.x.toFixed(3)}, ${ndcCoords.y.toFixed(3)})`);
    
    // Make sure we have a valid camera reference
    if (!window.currentCamera) {
      console.error('[PLAYER] Cannot raycasting - no camera available');
      return;
    }
    
    // Create a raycaster to convert screen position to world position
    const raycaster = new THREE.Raycaster();
    
    // Set the raycaster from the camera using NDC coordinates
    raycaster.setFromCamera(ndcCoords, window.currentCamera);
    
    // Define a "ground plane" to intersect with
    // Use the current map or a temporary plane if no map is available
    let intersectionTarget = [];
    
    if (window.game && window.game.currentMap) {
      // Array to hold all meshes that can be raycasted against
      const mapMeshes = [];
      
      // Add map container if it exists
      if (window.game.currentMap.mapContainer) {
        mapMeshes.push(window.game.currentMap.mapContainer);
      }
      
      // Add map floor if it exists
      if (window.game.currentMap.mapFloor) {
        mapMeshes.push(window.game.currentMap.mapFloor);
      }
      
      // Add individual terrain meshes that exist in tournament map
      const terrainMeshIds = ['stoneMesh', 'grassMesh', 'dirt2Mesh', 'dirtMesh', 'sandMesh'];
      for (const id of terrainMeshIds) {
        const mesh = window.renderer.getObject(id);
        if (mesh) {
          mapMeshes.push(mesh);
        }
      }
      
      // Add water plane for intersection if it exists
      if (window.game.currentMap.waterMesh) {
        mapMeshes.push(window.game.currentMap.waterMesh);
      }
      
      intersectionTarget = mapMeshes;
      
      console.log(`[PLAYER] Raycasting against ${mapMeshes.length} map meshes`);
    } else {
      // No map available, create a temporary ground plane
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      intersectionTarget = groundPlane;
      
      console.log('[PLAYER] No map available, using temporary ground plane');
    }
    
    // Find intersection point
    let targetPosition;
    
    if (Array.isArray(intersectionTarget)) {
      // Using mesh objects
      const intersects = raycaster.intersectObjects(intersectionTarget, true);
      
      if (intersects.length > 0) {
        // Get the closest intersection point
        targetPosition = intersects[0].point.clone();
        console.log(`[PLAYER] Raycast hit at: (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
      } else {
        // FALLBACK: If no raycast hits, use a ground plane at y=0
        console.warn('[PLAYER] No raycast hits on map, using fallback ground plane');
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersect = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane, intersect);
        targetPosition = intersect.clone();
        
        // Make sure the target position is within the map bounds if possible
        if (window.game && window.game.currentMap && window.game.currentMap.mapRadius) {
          const horizontalDist = Math.sqrt(targetPosition.x * targetPosition.x + targetPosition.z * targetPosition.z);
          if (horizontalDist > window.game.currentMap.mapRadius) {
            // Scale back to map radius
            const scaleFactor = window.game.currentMap.mapRadius / horizontalDist * 0.9; // 10% inside the boundary
            targetPosition.x *= scaleFactor;
            targetPosition.z *= scaleFactor;
          }
        }
      }
    } else {
      // Using a plane
      const intersect = new THREE.Vector3();
      raycaster.ray.intersectPlane(intersectionTarget, intersect);
      targetPosition = intersect.clone();
    }
    
    // Check if the target position is walkable
    let isWalkable = true;
    if (window.game && window.game.currentMap && typeof window.game.currentMap.isWalkable === 'function') {
      isWalkable = window.game.currentMap.isWalkable(targetPosition);
    }
    
    if (!isWalkable) {
      console.log('[PLAYER] Target position is not walkable, finding alternative path');
      
      // Try to find a walkable path
      const walkablePath = this._findWalkablePath(targetPosition);
      
      if (walkablePath) {
        console.log('[PLAYER] Found walkable alternative:', walkablePath);
        
        // Create visual indicator for non-walkable
        this._createNonWalkableIndicator(targetPosition);
        
        // Use the walkable point instead
        targetPosition.copy(walkablePath);
        
        // Create movement indicator at the walkable point
        this._createMovementIndicator(walkablePath);
      } else {
        console.log('[PLAYER] No walkable path found');
        
        // Create visual indicator for non-walkable
        this._createNonWalkableIndicator(targetPosition);
        
        // Can't move here
        return;
      }
    } else {
      // Create visual indicator for movement
      this._createMovementIndicator(targetPosition);
    }
    
    // Update the character's target position
    // PHYSICS: Now we use the CharacterPhysics controller to handle movement
    console.log(`[PLAYER] Setting movement target to: (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
    
    // Set the target position in the character physics controller
    this.characterPhysics.setTargetPosition(targetPosition);
    
    // Update animation
    this.animation = 'run';
    this._playAnimation('run');
    
    // Only emit server update if we're in multiplayer
    if (window.socket && window.isMultiplayer) {
      // Emit position update to server (for other players)
      this._emitPositionUpdate();
    }
  }
  
  /**
   * Find a walkable path to the target position
   * @param {THREE.Vector3} targetPosition - The target position
   * @param {number} maxSteps - Maximum number of steps to try
   * @returns {Array<THREE.Vector3>|null} - Array of positions forming a path, or null if no path found
   * @private
   */
  _findWalkablePath(targetPosition, maxSteps = 10) {
    const currentMap = window.game?.currentMap;
    if (!currentMap || typeof currentMap.isWalkable !== 'function') {
      console.warn(`[PATH] No valid map or isWalkable function found`);
      return null;
    }
    
    console.log(`[PATH] Finding walkable path from (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)}) to (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
    
    // Direction from current to target
    const direction = new THREE.Vector3()
      .subVectors(targetPosition, this.position)
      .normalize();
    
    // Total distance to target
    const totalDistance = this.position.distanceTo(targetPosition);
    
    // Step size (divide total distance by number of steps)
    // Use a smaller step size for more precise path finding
    const stepSize = Math.max(0.3, totalDistance / maxSteps);
    console.log(`[PATH] Total distance: ${totalDistance.toFixed(2)}, Step size: ${stepSize.toFixed(2)}, Max steps: ${maxSteps}`);
    
    // Create path array
    const path = [];
    
    // Try stepping towards the target
    for (let step = 1; step <= maxSteps; step++) {
      // Calculate distance for this step (don't exceed total distance)
      const stepDistance = Math.min(step * stepSize, totalDistance);
      
      // Calculate position at this step
      const stepPosition = new THREE.Vector3()
        .copy(this.position)
        .addScaledVector(direction, stepDistance);
      
      // Check if this position is walkable
      const isWalkable = currentMap.isWalkable(stepPosition);
      console.log(`[PATH] Step ${step}: Position (${stepPosition.x.toFixed(2)}, ${stepPosition.y.toFixed(2)}, ${stepPosition.z.toFixed(2)}) is ${isWalkable ? 'walkable' : 'NOT walkable'}`);
      
      if (isWalkable) {
        // Adjust height to match terrain
        if (typeof currentMap.getHeightAt === 'function') {
          const height = currentMap.getHeightAt(stepPosition);
          stepPosition.y = height + 0.1;
        }
        
        // Add to path
        path.push(stepPosition);
        
        // If we've reached the target, we're done
        if (stepDistance >= totalDistance) {
          console.log(`[PATH] Reached target, path complete with ${path.length} steps`);
          return path;
        }
      } else {
        // If we hit a non-walkable tile, return the path so far (if any)
        if (path.length > 0) {
          console.log(`[PATH] Hit non-walkable tile at step ${step}, returning partial path with ${path.length} steps`);
          return path;
        } else {
          console.log(`[PATH] No walkable path found - first step is not walkable`);
          return null;
        }
      }
    }
    
    // If we've tried all steps and still have a path, return it
    if (path.length > 0) {
      console.log(`[PATH] Reached max steps (${maxSteps}), returning partial path with ${path.length} steps`);
      return path;
    } else {
      console.log(`[PATH] No walkable path found after ${maxSteps} steps`);
      return null;
    }
  }
  
  /**
   * Create a red X indicator at a non-walkable position
   * @param {THREE.Vector3} position - Position to place the indicator
   * @private
   */
  _createNonWalkableIndicator(position) {
    // Create a red X indicator
    const size = 0.5;
    const geometry = new THREE.BufferGeometry();
    
    // Create X shape vertices
    const vertices = new Float32Array([
      // First line of X
      -size, 0.1, -size,
      size, 0.1, size,
      
      // Second line of X
      -size, 0.1, size,
      size, 0.1, -size
    ]);
    
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    
    // Create bright red material with transparency
    const material = new THREE.LineBasicMaterial({ 
      color: 0xff0000,
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
      depthTest: false // Ensure it's visible even if below terrain
    });
    
    // Create line segments
    const indicator = new THREE.LineSegments(geometry, material);
    
    // Position indicator
    indicator.position.copy(position);
    
    // Ensure Y position is slightly above terrain
    const currentMap = window.game?.currentMap;
    if (currentMap && typeof currentMap.getHeightAt === 'function') {
      indicator.position.y = currentMap.getHeightAt(position) + 0.1;
    }
    
    // Add to scene
    eventBus.emit('renderer.addObject', {
      id: `non-walkable-indicator-${Date.now()}`,
      object: indicator,
      temporary: true,
      duration: 2.0 // Match the duration of the movement indicator
    });
    
    // Animate indicator with a simple pulse
    const startTime = Date.now();
    const duration = 2000; // 2 seconds
    
    const animateIndicator = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1 && indicator.parent) {
        // Simple pulse animation that expands and fades out
        const scale = 1 + progress * 1.5; // Gradually expand to 2.5x size
        indicator.scale.set(scale, scale, scale);
        
        // Fade out as it expands
        indicator.material.opacity = 0.9 * (1 - progress);
        
        requestAnimationFrame(animateIndicator);
      }
    };
    
    // Start animation
    requestAnimationFrame(animateIndicator);
  }

  /**
   * Create a movement indicator at the click position
   * @param {THREE.Vector3} position - Position to place the indicator
   * @private
   */
  _createMovementIndicator(position) {
    // Ensure we have a valid position
    if (!position) {
      console.warn(`[INDICATOR] Cannot create movement indicator: invalid position`);
      return;
    }
    
    // Get the correct height from the current map
    const currentMap = window.game?.currentMap;
    let indicatorHeight = position.y;
    
    if (currentMap && typeof currentMap.getHeightAt === 'function') {
      // Get terrain height at indicator position
      const terrainHeight = currentMap.getHeightAt(position);
      
      if (terrainHeight !== undefined) {
        // Set indicator slightly above terrain
        indicatorHeight = terrainHeight + 0.1;
      }
    }
    
    // Create a ring indicator with dark red color
    const geometry = new THREE.RingGeometry(0.4, 0.6, 32); // Slightly smaller ring
    const material = new THREE.MeshBasicMaterial({
      color: 0x8B0000, // Dark red color
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false // Ensure it's visible even if below terrain
    });
    
    const indicator = new THREE.Mesh(geometry, material);
    
    // Set position with the correct height
    indicator.position.set(position.x, indicatorHeight, position.z);
    indicator.rotation.x = -Math.PI / 2; // Lay flat on the ground
    
    // Generate a unique ID for this indicator
    const indicatorId = `move-indicator-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Log the indicator creation for debugging
    console.log(`[INDICATOR] Created movement indicator at (${position.x.toFixed(2)}, ${indicatorHeight.toFixed(2)}, ${position.z.toFixed(2)})`);
    
    // Add to scene with shorter duration
    eventBus.emit('renderer.addObject', {
      id: indicatorId,
      object: indicator,
      temporary: true,
      duration: 2.0 // 2 seconds is enough for a click indicator
    });
    
    // Add simple pulsing animation effect
    const startTime = Date.now();
    const duration = 2000; // 2 seconds, matching the duration above
    
    const animateIndicator = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1 && indicator.parent) {
        // Simple pulse animation that expands and fades out
        const scale = 1 + progress * 1.5; // Gradually expand to 2.5x size
        indicator.scale.set(scale, scale, scale);
        
        // Fade out as it expands
        indicator.material.opacity = 0.8 * (1 - progress);
        
        // Continue animation
        requestAnimationFrame(animateIndicator);
      }
    };
    
    // Start animation
    requestAnimationFrame(animateIndicator);
    
    return indicator;
  }

  /**
   * Handle evade action (space bar)
   * @private
   */
  _handleEvade() {
    // Check if evade is on cooldown
    if (this.evadeCooldown > 0) {
      console.debug('Evade on cooldown:', this.evadeCooldown.toFixed(2), 'seconds left');
      return;
    }
    
    // Set evade cooldown (in seconds)
    this.evadeCooldown = 1.5; // Adjust as needed
    
    console.log('Evade executed');
    
    // Calculate evade direction based on current movement
    const evadeDirection = this.movementDirection.clone();
    
    // If not moving, evade backward
    if (evadeDirection.lengthSq() < 0.1) {
      evadeDirection.z = 1; // Backward
    }
    
    // Normalize and scale by evade distance
    evadeDirection.normalize().multiplyScalar(5);
    
    // Apply evade movement
    this.position.x += evadeDirection.x;
    this.position.z += evadeDirection.z;
    
    // Send position update to server
    webSocketManager.updatePosition({
      x: this.position.x,
      y: this.position.y,
      z: this.position.z
    });
    
    // TODO: Add evade animation and effects
  }

  /**
   * Handle core skill (right click)
   * @param {Object} data - Core skill event data
   * @private
   */
  _handleCoreSkill(data) {
    // Check if core skill is on cooldown
    if (this.coreSkillCooldown > 0) {
      console.debug('Core skill on cooldown:', this.coreSkillCooldown.toFixed(2), 'seconds left');
      return;
    }
    
    // Check if enough mana is available
    const manaCost = this.manaUsage[this.classType].cost * 1.5; // Core skills cost more
    if (this.mana < manaCost) {
      console.debug(`Not enough mana: ${this.mana.toFixed(1)}/${manaCost} required`);
      return;
    }
    
    // Consume mana
    this.mana -= manaCost;
    this._emitManaChange();
    
    // Set core skill cooldown (in seconds)
    this.coreSkillCooldown = 8; // Adjust as needed
    
    console.log('Core skill executed');
    
    // TODO: Implement class-specific core skills
    switch (this.classType) {
      case 'CLERK':
        // Healing wave or shield
        console.log('Clerk core skill: Healing Wave');
        break;
      case 'WARRIOR':
        // Whirlwind attack or charge
        console.log('Warrior core skill: Whirlwind');
        break;
      case 'RANGER':
        // Multi-shot or trap
        console.log('Ranger core skill: Multi-shot');
        break;
    }
    
    // TODO: Add core skill animation and effects
  }

  /**
   * Handle skill slot activation (number keys 1-4)
   * @param {number} slotNumber - Skill slot number (1-4)
   * @private
   */
  _handleSkill(slotNumber) {
    console.log(`Skill slot ${slotNumber} activated`);
    
    // TODO: Implement skill slot functionality
    // This will depend on the skill system which isn't fully implemented yet
  }

  /**
   * Execute attack on a target
   * @param {string} targetId - Target entity ID
   * @param {number} damage - Damage amount
   * @param {number} distance - Distance to target (if known)
   * @private
   */
  _executeAttack(targetId, damage, distance = null) {
    // Generate a local attack ID for tracking
    const attackId = Date.now().toString() + '-' + Math.floor(Math.random() * 1000);
    
    console.log(`[ATTACK] Executing attack on target ${targetId} for ${damage} damage (ID: ${attackId})`);
    
    // Emit attack request event - for visualization only, damage will be confirmed by server
    eventBus.emit('combat.attackRequested', {
      attackerId: this.id,
      targetId: targetId,
      damage: damage,
      attackType: this.primaryAttack.name,
      attackId: attackId,
      distance: distance
    });
    
    // Get position for debugging
    const myPos = {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z
    };
    
    try {
      // Verify that WebSocketManager is initialized
      if (!webSocketManager) {
        console.error("[ATTACK ERROR] WebSocketManager not available");
        return;
      }
      
      console.log(`[ATTACK] Sending attack to server with ID ${attackId}, damage: ${damage}, distance: ${distance || 'unknown'}`);
      console.log(`[ATTACK] My position: (${myPos.x.toFixed(2)}, ${myPos.y.toFixed(2)}, ${myPos.z.toFixed(2)})`);
      
      // Send attack to server with position data - server will validate and apply damage
      webSocketManager.sendAttack({
        targetId,
        damage,
        attackType: this.primaryAttack.name,
        attackId: attackId,
        distance: distance,
        debug: {
          myPosition: myPos,
          timestamp: Date.now()
        }
      });
      
      console.log(`[ATTACK] Attack sent to server - ID: ${attackId}`);
    } catch (error) {
      console.error("[ATTACK ERROR] Failed to send attack to server:", error);
    }
  }

  /**
   * Update player state
   * @param {number} deltaTime - Time since last update
   */
  update(deltaTime) {
    // Update mesh animation
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
    
    // Update physics if available
    if (this.characterPhysics) {
      this.characterPhysics.update(deltaTime);
      
      // Update internal position tracking to match the mesh
      // This ensures all position-dependent code works correctly
      if (this.mesh) {
        this.position.copy(this.mesh.position);
      }
    }
    
    // Update health UI
    this._updateHealthUI();
    
    // Update cooldown UI if it exists
    if (this._updateCooldownUI) {
      this._updateCooldownUI();
    }
    
    // Regenerate mana if it exists
    if (this._regenerateMana) {
      this._regenerateMana(deltaTime);
    }
  }

  /**
   * Update animations based on player state
   * @param {number} deltaTime - Time since last update
   * @private
   */
  _updateAnimations(deltaTime) {
    // If we have a mixer, update it with the delta time
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
    
    // If we're moving, make sure the running animation is playing
    if (this.isMoving) {
      if (this.animation !== 'run') {
        this.animation = 'run';
        this._playAnimation('run');
      }
    } else {
      // Otherwise, make sure we're idling
      if (this.animation !== 'idle') {
        this.animation = 'idle';
        this._playAnimation('idle');
      }
    }
  }

  /**
   * Play an animation on the character model
   * @param {string} animationName - Name of the animation to play
   * @private
   */
  _playAnimation(animationName) {
    // Check if mesh and mixer are available
    if (!this.mesh || !this.mixer) {
      console.warn(`[PLAYER] Cannot play animation - mesh or mixer not available`);
      
      // If mesh exists but mixer doesn't, try to initialize the mixer
      if (this.mesh && !this.mixer) {
        console.log('[PLAYER] Attempting to initialize mixer for animations');
        
        // Create a simple animation mixer
        this.mixer = new THREE.AnimationMixer(this.mesh);
        
        // Create dummy animations if they don't exist
        if (!this.animations || Object.keys(this.animations).length === 0) {
          console.log('[PLAYER] Creating basic animations');
          
          const idleTrack = new THREE.AnimationClip('idle', 1, [
            new THREE.KeyframeTrack(
              '.rotation[y]',
              [0, 0.5, 1],
              [0, 0.05, 0]
            )
          ]);
          
          const runTrack = new THREE.AnimationClip('run', 0.5, [
            new THREE.KeyframeTrack(
              '.position[y]',
              [0, 0.25, 0.5],
              [this.mesh.position.y, this.mesh.position.y + 0.1, this.mesh.position.y]
            )
          ]);
          
          // Store animations
          this.animations = {
            'idle': this.mixer.clipAction(idleTrack),
            'run': this.mixer.clipAction(runTrack)
          };
          
          // Set loop modes
          this.animations['idle'].setLoop(THREE.LoopRepeat);
          this.animations['run'].setLoop(THREE.LoopRepeat);
        }
      } else {
        // If we can't initialize the mixer, return early
        return;
      }
    }
    
    // Make sure animations object exists
    if (!this.animations) {
      console.warn('[PLAYER] Animations object not initialized');
      this.animations = {};
      return;
    }
    
    // Find the animation by name
    const animation = this.animations[animationName];
    if (!animation) {
      console.warn(`[PLAYER] Animation "${animationName}" not found`);
      return;
    }
    
    // Stop current animation if different
    if (this.currentAnimation && this.currentAnimation !== animation) {
      this.currentAnimation.stop();
    }
    
    // Play the new animation
    animation.play();
    this.currentAnimation = animation;
    
    // Log animation change (with random chance to avoid spam)
    if (Math.random() < 0.1) {
      console.log(`[PLAYER] Playing animation: ${animationName}`);
    }
  }

  /**
   * Emit mana change event
   * @private
   */
  _emitManaChange() {
    eventBus.emit('player.manaChanged', {
      mana: this.mana,
      maxMana: this.maxMana
    });
  }
  
  /**
   * Update cooldown UI elements
   * @private
   */
  _updateCooldownUI() {
    // Update basic attack cooldown
    const attackCooldownFill = document.getElementById('cooldown-fill');
    if (attackCooldownFill) {
      // Calculate percentage of cooldown remaining
      const maxCooldown = this.primaryAttack?.cooldown || 1;
      const percentRemaining = (this.attackCooldown / maxCooldown) * 100;
      
      // Update the width of the cooldown fill
      attackCooldownFill.style.width = `${100 - percentRemaining}%`;
      
      // Change color based on availability
      if (percentRemaining <= 0) {
        attackCooldownFill.style.backgroundColor = '#2ecc71'; // Green when ready
      } else {
        attackCooldownFill.style.backgroundColor = '#3498db'; // Blue when cooling down
      }
    }
    
    // Update core skill cooldown
    const coreSkillCooldownFill = document.getElementById('core-skill-cooldown-fill');
    if (coreSkillCooldownFill) {
      const maxCoreSkillCooldown = 8; // Same as in _handleCoreSkill
      const percentRemaining = (this.coreSkillCooldown / maxCoreSkillCooldown) * 100;
      
      coreSkillCooldownFill.style.width = `${100 - percentRemaining}%`;
      
      if (percentRemaining <= 0) {
        coreSkillCooldownFill.style.backgroundColor = '#2ecc71'; // Green when ready
      } else {
        coreSkillCooldownFill.style.backgroundColor = '#e74c3c'; // Red when cooling down
      }
    }
    
    // Update evade cooldown
    const evadeCooldownFill = document.getElementById('evade-cooldown-fill');
    if (evadeCooldownFill) {
      const maxEvadeCooldown = 1.5; // Same as in _handleEvade
      const percentRemaining = (this.evadeCooldown / maxEvadeCooldown) * 100;
      
      evadeCooldownFill.style.width = `${100 - percentRemaining}%`;
      
      if (percentRemaining <= 0) {
        evadeCooldownFill.style.backgroundColor = '#2ecc71'; // Green when ready
      } else {
        evadeCooldownFill.style.backgroundColor = '#f39c12'; // Orange when cooling down
      }
    }
    
    // Emit cooldown updates for all skills
    eventBus.emit('player.cooldownUpdate', [
      {
        skillIndex: 0,
        skillName: 'Basic Attack',
        remainingTime: this.attackCooldown,
        totalTime: this.primaryAttack?.cooldown || 1
      },
      {
        skillIndex: 'core',
        skillName: 'Core Skill',
        remainingTime: this.coreSkillCooldown,
        totalTime: 8 // Same as in _handleCoreSkill
      },
      {
        skillIndex: 'evade',
        skillName: 'Evade',
        remainingTime: this.evadeCooldown,
        totalTime: 1.5 // Same as in _handleEvade
      }
    ]);
  }

  /**
   * Regenerate mana based on class type
   * @param {number} deltaTime - Time since last update in seconds
   * @private
   */
  _regenerateMana(deltaTime) {
    // Skip if already at max mana
    if (this.mana >= this.maxMana) {
      this.mana = this.maxMana; // Ensure mana doesn't exceed max
      return;
    }
    
    let regenAmount = 0;
    const now = Date.now();
    
    // Different regeneration mechanics based on class
    if (this.classType === 'CLERK') {
      // Clerk regenerates mana faster when standing still
      const baseRegen = this.manaRegenRate * deltaTime;
      const standingBonus = !this.isMoving ? 
                           this.manaUsage.CLERK.regenBonus.standing : 
                           this.manaUsage.CLERK.regenBonus.moving;
      
      regenAmount = baseRegen * standingBonus;
    } else if (this.classType === 'RANGER') {
      // Ranger regenerates mana when not attacking for a few seconds
      const timeSinceLastAttack = (now - this.lastAttackTime) / 1000;
      if (timeSinceLastAttack > 3) { // 3 seconds without attacking
        regenAmount = this.manaRegenRate * deltaTime * this.manaUsage.RANGER.regenBonus.notAttacking;
      } else {
        regenAmount = this.manaRegenRate * deltaTime;
      }
    } else {
      // Default regeneration for other classes (e.g., Warrior)
      regenAmount = this.manaRegenRate * deltaTime;
    }
    
    // Apply regeneration
    this.mana = Math.min(this.maxMana, this.mana + regenAmount);
    
    // Log mana regeneration only when significant changes occur (>= 1 mana)
    this._lastLoggedMana = this._lastLoggedMana || this.mana;
    if (Math.abs(this.mana - this._lastLoggedMana) >= 1) {
      console.log(`Regenerated ${regenAmount.toFixed(2)} mana, current: ${this.mana.toFixed(1)}/${this.maxMana}`);
      this._lastLoggedMana = this.mana;
    }
    
    // Emit mana change event for UI updates - but only when significant changes occur
    this._lastEmittedMana = this._lastEmittedMana || this.mana;
    if (Math.abs(this.mana - this._lastEmittedMana) >= 0.5) {
      this._emitManaChange();
      this._lastEmittedMana = this.mana;
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
    
    try {
      // Create a raycaster for target detection
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(data.ndc, window.currentCamera);
      
      // Get entities that can be targeted (other players)
      const targetableMeshes = [];
      let targetEntityId = null;
      
      // Find all possible targets
      eventBus.emit('combat.getTargets', { 
        callback: (targets) => {
          targetableMeshes.push(...targets);
        }
      });
      
      console.log(`[ATTACK] Found ${targetableMeshes.length} targetable meshes`);
      
      // Check for intersections
      const intersects = raycaster.intersectObjects(targetableMeshes);
      
      if (intersects.length > 0) {
        // Get the entity ID from the mesh
        targetEntityId = intersects[0].object.userData.entityId;
        console.log(`[ATTACK] Raycast hit on entity: ${targetEntityId}`);
        
        if (targetEntityId) {
          // Check if target is in range
          const target = this._getEntityById(targetEntityId);
          
          if (target) {
            const distance = this.position.distanceTo(target.position);
            
            console.log(`[ATTACK] Target found: ${targetEntityId} at distance ${distance.toFixed(2)}, attack range: ${this.primaryAttack.range}`);
            
            // Client-side range check (this will be validated again on server)
            if (distance <= this.primaryAttack.range) {
              // If attack is on cooldown, don't continue with attack attempt
              if (this.attackCooldown > 0) {
                console.debug('Attack on cooldown:', this.attackCooldown.toFixed(2), 'seconds left');
                return;
              }
              
              // Check if enough mana is available
              const manaCost = this.manaUsage[this.classType].cost;
              if (this.mana < manaCost) {
                console.debug(`Not enough mana: ${this.mana.toFixed(1)}/${manaCost} required`);
                return;
              }
              
              // Consume mana
              this.mana -= manaCost;
              this._emitManaChange();
              
              // Record attack time for Ranger mana regeneration
              this.lastAttackTime = Date.now();
              
              // Start attack cooldown (in seconds)
              this.attackCooldown = this.primaryAttack.cooldown;
              this.isAttacking = true;
              
              // Deal damage - note that actual damage application depends on server validation
              this._executeAttack(targetEntityId, this.primaryAttack.damage, distance);
              
              // Show attack animation/effect
              this._showAttackEffect();
              
              // Reset attack state after animation completes
              setTimeout(() => {
                this.isAttacking = false;
                console.log('Attack animation completed, can attack again when cooldown expires');
              }, 200);
            } else {
              console.log(`[ATTACK] Target out of range (${distance.toFixed(2)} > ${this.primaryAttack.range}), moving closer`);
              
              // Target is out of range - move toward it to get in range (Diablo-like behavior)
              // Calculate a position that's within attack range
              const directionToTarget = new THREE.Vector3().subVectors(target.position, this.position).normalize();
              const desiredDistance = this.primaryAttack.range * 0.8; // Get slightly closer than max range
              const moveToPosition = new THREE.Vector3().copy(target.position).sub(
                directionToTarget.multiplyScalar(desiredDistance)
              );
              
              // Set as movement target
              this.targetPosition = moveToPosition;
              this.isMouseMoving = true;
              this._createMovementIndicator(moveToPosition);
              
              // Store the target so we can try to attack when we get in range
              this.attackTargetId = targetEntityId;
              
              // Reset WASD movement since mouse movement takes priority
              this.movementDirection.set(0, 0, 0);
              this.isMoving = false;
            }
          } else {
            console.log(`[ATTACK] Target entity ${targetEntityId} not found in entity manager`);
          }
        } else {
          console.log(`[ATTACK] Hit object has no entityId in userData`);
        }
      } else {
        console.log('[ATTACK] No target found under cursor');
        
        // With Diablo-like controls, if we click and there's no target, 
        // the move handler will take care of movement
        return;
      }
    } catch (error) {
      console.error('[ATTACK ERROR] Error processing attack:', error);
    }
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
    if (!id) {
      console.warn('[ENTITY] Cannot get entity: ID is null or undefined');
      return null;
    }
    
    let entity = null;
    
    try {
      // Try to get entity from EntityManager
      eventBus.emit('entityManager.getEntity', { 
        id,
        callback: (result) => {
          entity = result;
        }
      });
      
      if (!entity) {
        console.warn(`[ENTITY] Entity with ID ${id} not found in EntityManager`);
        
        // As a fallback, try to get entity directly from window.game.entityManager
        if (window.game && window.game.entityManager) {
          const fallbackEntity = window.game.entityManager.getEntity(id);
          if (fallbackEntity) {
            console.log(`[ENTITY] Found entity ${id} using fallback method`);
            entity = fallbackEntity;
          }
        }
      } else {
        console.log(`[ENTITY] Successfully retrieved entity ${id}`);
      }
    } catch (error) {
      console.error(`[ENTITY] Error getting entity ${id}:`, error);
    }
    
    return entity;
  }

  /**
   * Handle player death
   * @private
   * @param {string} attackerId - ID of the player who killed this player
   */
  _handleDeath(attackerId) {
    // Prevent multiple death handling
    if (this.isDead) {
      console.log('Player already dead, ignoring duplicate death handling');
      return;
    }
    
    // Set death flag
    this.isDead = true;
    console.log('Player died, killed by:', attackerId);
    
    // Ensure health is exactly 0
    this.stats.health = 0;
    this.health = 0;
    
    // Update health UI to show 0 health
    this._updateHealthUI();
    
    // Show death effect
    this._showDeathEffect();
    
    // Hide player mesh
    if (this.mesh) {
      this.mesh.visible = false;
      
      // Hide health bar if it exists
      if (this.healthBar) {
        this.healthBar.visible = false;
      }
      
      // Remove mesh from scene after a short delay
      setTimeout(() => {
        // Remove mesh from scene
        eventBus.emit('renderer.removeObject', {
          id: `player-${this.id}`
        });
        
        // Clear the reference
        this.mesh = null;
      }, 100);
    }
    
    // Notify server about death
    eventBus.emit('network.send', {
      type: 'playerDied',
      data: {
        id: this.id,
        attackerId: attackerId
      }
    });
    
    // Show death screen with attacker ID after a short delay to allow effects to start
    setTimeout(() => {
      eventBus.emit('ui.showDeathScreen', {
        attackerId: attackerId
      });
      
      // Mark that death screen has been shown
      this.deathScreenShown = true;
    }, 100);
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
        color: this.stats.color || 0xff0000,
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
    particles.position.y += 0.2;
    
    // Add to scene
    eventBus.emit('renderer.addObject', {
      id: `death-effect-${this.id}`,
      object: particles,
      temporary: true,
      duration: 2
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
   * Take damage from an attack
   * @param {number} amount - Amount of damage to take
   * @param {string} attackerId - ID of the attacker
   * @returns {boolean} - Whether the damage was applied
   */
  takeDamage(amount, attackerId) {
    // Skip if already dead
    if (this.isDead) {
      console.log('Player is already dead, ignoring damage');
      return false;
    }
    
    // Validate damage amount
    if (typeof amount !== 'number' || amount <= 0) {
      console.warn('Invalid damage amount:', amount);
      return false;
    }
    
    // Ensure stats object exists
    if (!this.stats) {
      console.warn('Player stats not initialized');
      return false;
    }
    
    // Ensure health property exists
    if (typeof this.stats.health !== 'number') {
      console.warn('Health stat not initialized, setting default based on class');
      // Set default health based on class
      switch (this.classType) {
        case 'warrior':
        case 'WARRIOR':
          this.stats.health = 120;
          break;
        case 'ranger':
        case 'RANGER':
          this.stats.health = 80;
          break;
        case 'clerk':
        case 'CLERK':
          this.stats.health = 100;
          break;
        default:
          this.stats.health = 100;
      }
    }
    
    // Store original health for comparison
    const oldHealth = this.stats.health;
    
    // Apply damage
    this.stats.health = Math.max(0, this.stats.health - amount);
    
    // Update health UI
    this._updateHealthUI();
    
    // Log damage
    console.log(`Player took ${amount} damage from ${attackerId || 'unknown'}, health: ${this.stats.health}/${oldHealth}`);
    
    // Notify server about health change
    eventBus.emit('network.send', {
      type: 'playerHealthChanged',
      data: {
        id: this.id,
        health: this.stats.health,
        attackerId: attackerId
      }
    });
    
    // Check if player died - only if health is actually zero
    if (this.stats.health <= 0 && !this.isDead) {
      console.log('Player health reached zero, triggering death');
      // Call death handler with attacker ID
      this._handleDeath(attackerId);
      return true;
    }
    
    // Play damage effect for non-fatal damage
    this._playDamageEffect();
    
    return false;
  }
  
  /**
   * Respawn player after death
   * @private
   */
  _respawn() {
    console.log('RESPAWN: Player respawning...');
    
    // Reset isDead flag
    this.isDead = false;
    
    // Reset death screen shown flag
    this.deathScreenShown = false;
    
    // Reset health and mana with proper validation
    if (!this.stats) {
      console.warn('RESPAWN: Player stats not initialized, creating default stats');
      this.stats = {
        health: 100,
        maxHealth: 100
      };
    }
    
    // Ensure health property exists in stats
    if (typeof this.stats.health !== 'number' || isNaN(this.stats.health)) {
      console.warn('RESPAWN: Health stat not initialized or invalid, setting default based on class');
      // Set default health based on class
      switch (this.classType) {
        case 'warrior':
        case 'WARRIOR':
          this.stats.health = 120;
          break;
        case 'ranger':
        case 'RANGER':
          this.stats.health = 80;
          break;
        case 'clerk':
        case 'CLERK':
          this.stats.health = 100;
          break;
        default:
          this.stats.health = 100;
      }
    }
    
    // Reset health to full
    this.health = this.stats.health;
    this.mana = this.maxMana;
    
    console.log(`RESPAWN: Health reset to ${this.health}/${this.stats.health}`);
    
    // Update mana UI
    this._emitManaChange();
    
    // CRITICAL: Direct update health display
    if (window.updateHealthUI) {
      window.updateHealthUI(this.health, this.stats.health);
    }
    
    // Update UI through normal method as well
    this._updateHealthUI();
    
    // Also explicitly update the new HUD
    eventBus.emit('player.healthChanged', {
      id: this.id, // Include player ID for filtering
      health: this.health,
      maxHealth: this.stats.health
    });
    
    // Move to a different position
    const randomX = Math.floor(Math.random() * 10) - 5;
    const randomZ = Math.floor(Math.random() * 10) - 5;
    this.setPosition(randomX, 0.8, randomZ);
    
    // Make player mesh visible again
    if (this.mesh) {
      console.log('RESPAWN: Making player mesh visible again');
      this.mesh.visible = true;
    } else {
      console.warn('RESPAWN: Player mesh not found, recreating mesh');
      // Try to recreate mesh if it's missing
      this._createPlayerMesh();
      if (this.mesh) {
        this.mesh.visible = true;
      } else {
        console.error('RESPAWN: Failed to recreate player mesh!');
      }
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
    
    webSocketManager.sendRespawn({
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
    console.log(`[PLAYER] Destroying player ${this.id} (${this.classType})`);
    
    // Remove physics controller if it exists
    if (this.characterPhysics) {
      this.characterPhysics.dispose();
      this.characterPhysics = null;
    }
    
    // Clear terrain check interval
    if (this.terrainCheckInterval) {
      clearInterval(this.terrainCheckInterval);
      this.terrainCheckInterval = null;
      console.log('[PLAYER] Cleared terrain check interval');
    }
    
    // Clean up mesh
    if (this.mesh) {
      if (window.renderer) {
        window.renderer.removeObject(`player-${this.id}`);
      }
      this.mesh = null;
    }
    
    // Remove nameplates and health bars
    this._removeNameplateAndHealthBar();
    
    // Remove event listeners
    eventBus.off(`input.moveForward.${this.id}`);
    eventBus.off(`input.moveBackward.${this.id}`);
    eventBus.off(`input.moveLeft.${this.id}`);
    eventBus.off(`input.moveRight.${this.id}`);
    eventBus.off(`input.moveForwardEnd.${this.id}`);
    eventBus.off(`input.moveBackwardEnd.${this.id}`);
    eventBus.off(`input.moveLeftEnd.${this.id}`);
    eventBus.off(`input.moveRightEnd.${this.id}`);
    eventBus.off(`input.move.${this.id}`);
    eventBus.off(`input.evade.${this.id}`);
    eventBus.off(`input.coreSkill.${this.id}`);
    eventBus.off(`input.skill.${this.id}`);
    eventBus.off(`network.playerAttacked.${this.id}`);
    
    // Call base entity destroy
    super.destroy();
  }

  /**
   * Show a visual indicator for range warnings
   * @param {number} distance - Current distance to target
   * @param {number} maxRange - Maximum attack range
   * @private
   */
  _showRangeWarningIndicator(distance, maxRange) {
    // Create a text sprite for the warning
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    // Set up text style
    context.font = 'bold 24px Arial';
    context.fillStyle = '#ff3300';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Draw warning text
    context.fillText(`Range: ${distance.toFixed(1)} > ${maxRange}`, 128, 32);
    
    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    const sprite = new THREE.Sprite(material);
    
    // Position above player
    sprite.position.copy(this.position.clone().add(new THREE.Vector3(0, 2, 0)));
    sprite.scale.set(2, 0.5, 1);
    
    // Add to scene temporarily
    eventBus.emit('renderer.addObject', {
      id: `range-warning-${Date.now()}`,
      object: sprite,
      temporary: true,
      duration: 1.5
    });
  }

  /**
   * Update the player's health UI
   * @private
   */
  _updateHealthUI() {
    // Skip if we've updated very recently (prevent spam)
    if (this._lastHealthUpdate && Date.now() - this._lastHealthUpdate < 500) {
      return; // Only update every 500ms
    }
    
    // Update timestamp
    this._lastHealthUpdate = Date.now();
    
    // Make sure we have UI elements
    const healthFill = document.getElementById('health-fill');
    const statsText = document.getElementById('player-stats');
    
    if (!healthFill || !statsText) {
      return;
    }
    
    // Calculate health percentage for display
    const maxHealth = this.stats ? this.stats.health : 100;
    const currentHealth = this.health || 0;
    const healthPercentage = Math.max(0, Math.min(100, (currentHealth / maxHealth * 100)));
    
    console.log('UPDATING PLAYER UI: Health =', currentHealth + '/' + maxHealth);
    
    // Update health fill bar width
    healthFill.style.width = healthPercentage + '%';
    
    // Color-code health based on percentage
    if (healthPercentage > 60) {
      healthFill.style.backgroundColor = '#3de73d'; // Green
    } else if (healthPercentage > 30) {
      healthFill.style.backgroundColor = '#e7de3d'; // Yellow
    } else {
      healthFill.style.backgroundColor = '#e73d3d'; // Red
    }
    
    // Update text display
    statsText.textContent = `Health: ${currentHealth}/${maxHealth}`;
    
    console.log('Health bar updated: ' + healthPercentage + '% width, health: ' + currentHealth + '/' + maxHealth);
    console.log('Player stats text updated to: ' + statsText.textContent);
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
  }

  /**
   * Initialize physics for the player
   * Uses CharacterPhysics to create a kinematic physics body for the player
   * that handles movement, collision detection, and terrain alignment
   * @private
   */
  _initializePhysics() {
    if (!this.mesh) {
      console.error('[PLAYER] Cannot initialize physics - mesh not created');
      return;
    }
    
    // Ensure initial position is above the ground
    // If map exists, try to get the ground height at the player's position
    if (window.game && window.game.currentMap && typeof window.game.currentMap.getHeightAt === 'function') {
      const groundHeight = window.game.currentMap.getHeightAt(this.position);
      if (groundHeight !== undefined && !isNaN(groundHeight)) {
        // Ensure player is above the ground plus some margin
        const minHeight = groundHeight + 2.0; // 2.0 units above ground
        if (this.position.y < minHeight) {
          console.log(`[PLAYER] Adjusting initial Y position from ${this.position.y.toFixed(2)} to ${minHeight.toFixed(2)} to stay above terrain`);
          this.position.y = minHeight;
          
          // Also update mesh position
          if (this.mesh) {
            this.mesh.position.y = minHeight;
          }
        }
      }
    }
    
    // Create physics body for the player with adjusted position
    this.characterPhysics = new CharacterPhysics({
      characterMesh: this.mesh,
      initialPosition: this.position.clone(),
      characterHeight: this.characterHeight || 1.76,
      characterRadius: this.characterRadius || 0.48
    });
    
    // Store dimensions for convenience
    this.characterHeight = this.characterHeight || 1.76;
    this.characterRadius = this.characterRadius || 0.48;
    
    console.log(`[PLAYER PHYSICS] Character mesh dimensions: ${this.mesh.geometry.parameters.width.toFixed(2)} x ${this.mesh.geometry.parameters.height.toFixed(2)} x ${this.mesh.geometry.parameters.depth.toFixed(2)}`);
    
    // Listen for physics ready event
    eventBus.once('characterPhysics.ready', () => {
      console.log('[PLAYER] Physics body initialized with height', this.characterHeight, 'and radius', this.characterRadius);
      console.log('[PLAYER] Initial position:', `(${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)})`);
      
      // Expose physics debug toggle globally
      window.togglePlayerPhysicsDebug = (visible) => {
        if (this.characterPhysics) {
          this.characterPhysics.toggleDebug(visible);
        }
      };
      
      // Enable physics debug by default in dev mode
      if (process.env.NODE_ENV === 'development') {
        window.togglePlayerPhysicsDebug(true);
        console.log('[PLAYER] Physics debug visualization enabled automatically');
      }
      
      console.log('[PLAYER] Physics debug toggle exposed as window.togglePlayerPhysicsDebug(true/false)');
      
      // Initialize fully after physics are ready
      this._initializeAfterLoad();
      
      // Schedule periodic checks to ensure terrain meshes stay available
      // This helps when navigating between scenes or after loading new maps
      this.terrainCheckInterval = setInterval(() => {
        this._ensureTerrainMeshesAvailable();
      }, 5000); // Check every 5 seconds
      
      console.log('[PLAYER] Scheduled periodic terrain mesh availability checks');
    });
  }

  /**
   * Emit position update to network
   * @private
   */
  _emitPositionUpdate() {
    // Don't emit position updates if not initialized
    if (!this.isInitialized) return;
    
    // Get current position and rotation
    const position = this.mesh ? this.mesh.position.clone() : this.position.clone();
    const rotation = this.mesh ? this.mesh.rotation.y : this.rotation.y;
    
    // Create position update data
    const updateData = {
      id: this.id,
      position: {
        x: position.x,
        y: position.y,
        z: position.z
      },
      rotation: rotation
    };
    
    // Emit locally for client-side prediction
    eventBus.emit('player.positionUpdated', updateData);
    
    // Send to server if network is available
    if (window.webSocketManager) {
      window.webSocketManager.updatePlayerPosition(updateData);
    }
  }

  /**
   * Get height at a specific position from the terrain
   * @param {THREE.Vector3} position - Position to check
   * @returns {number|null} - Terrain height or null if not available
   * @private
   */
  _getHeightAtPosition(position) {
    // Try to get height from the current map
    if (window.game && window.game.currentMap) {
      if (typeof window.game.currentMap.getHeightAt === 'function') {
        return window.game.currentMap.getHeightAt(position);
      } else if (typeof window.game.currentMap.getHeightAtPosition === 'function') {
        return window.game.currentMap.getHeightAtPosition(position);
      }
    }
    
    // Fallback: return current height
    console.warn('[PLAYER] No map terrain height function available, using current height');
    return this.mesh ? this.mesh.position.y : this.position.y;
  }

  /**
   * Ensure all terrain meshes are ready for raycasting
   * This fixes issues with movement by making sure all map meshes are properly referenced
   */
  _ensureTerrainMeshesAvailable() {
    if (!window.game || !window.game.currentMap) {
      console.warn('[PLAYER] Cannot ensure terrain meshes - no map available');
      return;
    }
    
    // Create a reference to mapContainer if needed
    if (!window.game.currentMap.mapContainer && window.renderer) {
      const mapContainer = window.renderer.getObject('mapContainer');
      if (mapContainer) {
        console.log('[PLAYER] Setting mapContainer reference on currentMap');
        window.game.currentMap.mapContainer = mapContainer;
      } else {
        console.warn('[PLAYER] mapContainer not found in renderer');
      }
    }
    
    // Create a reference to mapFloor if needed
    if (!window.game.currentMap.mapFloor && window.renderer) {
      const mapFloor = window.renderer.getObject('mapFloor');
      if (mapFloor) {
        console.log('[PLAYER] Setting mapFloor reference on currentMap');
        window.game.currentMap.mapFloor = mapFloor;
      } else {
        console.warn('[PLAYER] mapFloor not found in renderer');
      }
    }
    
    // Ensure map physics is initialized if available
    if (window.game.currentMap && typeof window.game.currentMap.createPhysicsTerrain === 'function' && 
        (!window.game.currentMap.physicsInitialized)) {
      console.log('[PLAYER] Initializing map physics terrain');
      window.game.currentMap.createPhysicsTerrain();
      window.game.currentMap.physicsInitialized = true;
    }
    
    // Check if character physics knows about the map
    if (this.characterPhysics && this.characterPhysics.rigidBody) {
      console.log('[PLAYER] Character physics body is available');
      
      // Test ground detection by casting a ray
      if (window.RAPIER && window.physicsWorld && this.characterPhysics.ray) {
        const currentPos = this.characterPhysics.rigidBody.translation();
        
        // Update ray position to current character position
        this.characterPhysics.ray.origin.x = currentPos.x;
        this.characterPhysics.ray.origin.y = currentPos.y + 0.1; // Slightly above character
        this.characterPhysics.ray.origin.z = currentPos.z;
        
        // Cast ray downward
        const hit = window.physicsWorld.castRay(this.characterPhysics.ray, 50.0, true);
        
        // Use optional chaining and nullish coalescing to avoid TypeErrors
        const hitDistance = hit?.toi ? hit.toi.toFixed(2) : 'unknown';
        console.log(`[PLAYER] Ray test result: ${hit ? 'HIT at distance ' + hitDistance : 'NO HIT'}`);
        
        // If no hit, try to get map height from getHeightAt
        if (!hit && window.game.currentMap.getHeightAt) {
          const mapHeight = window.game.currentMap.getHeightAt(new THREE.Vector3(currentPos.x, 0, currentPos.z));
          const heightStr = mapHeight !== undefined && !isNaN(mapHeight) ? mapHeight.toFixed(2) : 'undefined';
          console.log(`[PLAYER] Map height at current position: ${heightStr}`);
          
          // If height is valid and character is below it, reset position
          if (mapHeight !== undefined && !isNaN(mapHeight) && currentPos.y < mapHeight) {
            console.log(`[PLAYER] Character is below terrain, resetting position to terrain height + offset`);
            const safeY = mapHeight + this.characterPhysics.characterRadius + 0.5;
            
            // Update physics body position
            this.characterPhysics.rigidBody.setNextKinematicTranslation({
              x: currentPos.x,
              y: safeY,
              z: currentPos.z
            });
            
            // Also update character mesh
            if (this.mesh) {
              const meshY = safeY - (this.characterPhysics.characterHeight * 0.3); // Changed from 0.4 to 0.3
              this.mesh.position.set(currentPos.x, meshY, currentPos.z);
              this.position.copy(this.mesh.position);
            }
          }
        }
      }
    }
    
    // Log status
    console.log('[PLAYER] Terrain mesh check completed');
  }

  /**
   * Initialize player after all resources are loaded
   * @private
   */
  _initializeAfterLoad() {
    console.log('[PLAYER] Initializing player after mesh load');
    
    // No need for _setupInputHandlers, input is handled in _setupEventListeners
    
    // Initialize UI if not already done (ensure proper UI updates)
    if (window.game && window.game.updateHealthUI) {
      const maxHealth = this.stats?.health || 100;
      window.game.updateHealthUI(this.health, maxHealth);
    }
    
    // Make sure health UI is updated
    this._updateHealthUI();
    
    // Set up physics debugger if running in development mode
    this._setupPhysicsDebugger();
    
    // Ensure terrain meshes are available for movement
    this._ensureTerrainMeshesAvailable();
    
    // Emit event that player is fully initialized
    eventBus.emit('player.ready', { player: this });
    
    // Set up interval to check terrain meshes periodically - IMPORTANT for ground detection
    this.terrainCheckInterval = setInterval(() => {
      this._ensureTerrainMeshesAvailable();
    }, 5000); // Check every 5 seconds
    
    // Set initial animation
    this._playAnimation('idle');
  }
  
  /**
   * Set up physics debugger
   * @private
   */
  _setupPhysicsDebugger() {
    // Only proceed if running in development mode
    if (process.env.NODE_ENV === 'development' && this.characterPhysics) {
      // Show physics debug visualization
      this.characterPhysics.toggleDebug(true);
      
      // Add keyboard shortcut for toggling physics debug (F2)
      window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
          this.characterPhysics.toggleDebug(!this.characterPhysics.debugVisible);
          console.log(`[PLAYER] Physics debug ${this.characterPhysics.debugVisible ? 'enabled' : 'disabled'}`);
        }
      });
      
      console.log('[PLAYER] Physics debugger enabled (press F2 to toggle)');
    }
  }

  /**
   * Remove the player's nameplate and health bar elements
   * @private
   */
  _removeNameplateAndHealthBar() {
    // For the main player, there typically aren't individually attached nameplate elements
    // However, we should still check for any THREE.js objects attached to the mesh
    if (this.mesh) {
      // Check for health bar attached to mesh (similar to OtherPlayer implementation)
      const healthBar = this.mesh.getObjectByName(`healthbar-${this.id}`);
      if (healthBar) {
        this.mesh.remove(healthBar);
        console.log(`[PLAYER] Removed mesh-attached health bar for player ${this.id}`);
      }
      
      // Check for nameplate
      const nameplate = this.mesh.getObjectByName(`nameplate-${this.id}`);
      if (nameplate) {
        this.mesh.remove(nameplate);
        console.log(`[PLAYER] Removed mesh-attached nameplate for player ${this.id}`);
      }
    }
    
    // Clean up any DOM-based UI elements specific to this player
    // The main player UI elements are generally global, but we'll check for
    // any player-specific elements that might have been created
    
    // Player-specific DOM elements (if they were created with IDs based on player ID)
    const elements = [
      `player-ui-${this.id}`,
      `health-bar-${this.id}`,
      `mana-bar-${this.id}`,
      `nameplate-${this.id}`,
      `skill-ui-${this.id}`
    ];
    
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
        console.log(`[PLAYER] Removed DOM element: ${id}`);
      }
    });
    
    // Reset any global UI elements (optional, since they'll be updated by a new player)
    // This is mainly for visual feedback during player transitions
    if (this.isLocalPlayer) {
      const healthFill = document.getElementById('health-fill');
      const playerStats = document.getElementById('player-stats');
      
      if (healthFill) {
        healthFill.style.width = '0%';
      }
      
      if (playerStats) {
        playerStats.textContent = 'Health: 0/0';
      }
    }
    
    console.log(`[PLAYER] Completed UI cleanup for player ${this.id}`);
  }

  /**
   * Update the player's health bar
   * @private
   */
  _updateHealthBar() {
    // Skip if player is dead
    if (this.isDead) return;
    
    // Use updateHealthUI instead if it's the local player
    if (this._updateHealthUI) {
      this._updateHealthUI();
      return;
    }
    
    // For non-local players or if _updateHealthUI isn't available,
    // create/update an in-game health bar above the character
    
    // Calculate health percentage
    const maxHealth = this.stats?.health || 100;
    const currentHealth = this.health || 0;
    const healthPercent = Math.max(0, Math.min(1, currentHealth / maxHealth));
    
    // Log health status occasionally for debugging
    if (Math.random() < 0.01) {
      console.log(`[PLAYER] Health: ${currentHealth}/${maxHealth} (${(healthPercent * 100).toFixed(0)}%)`);
    }
    
    // If mesh isn't available, we can't update a 3D health bar
    if (!this.mesh) return;
    
    // Create health bar if it doesn't exist
    if (!this.healthBar) {
      const barWidth = 1.5;
      const barHeight = 0.1;
      
      // Create container
      this.healthBar = new THREE.Group();
      this.healthBar.name = `healthbar-${this.id}`;
      
      // Position above character
      this.healthBar.position.y = this.characterHeight ? this.characterHeight + 0.5 : 2.3;
      
      // Create background bar
      const bgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
      const bgMaterial = new THREE.MeshBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.7,
        depthTest: false
      });
      this.healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
      
      // Create health fill
      const fillGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.9,
        depthTest: false
      });
      this.healthBarFill = new THREE.Mesh(fillGeometry, fillMaterial);
      this.healthBarFill.position.z = 0.01; // Slightly in front of background
      
      // Add to container
      this.healthBar.add(this.healthBarBg);
      this.healthBar.add(this.healthBarFill);
      
      // Add to mesh
      this.mesh.add(this.healthBar);
    }
    
    // Update health bar fill width based on health percentage
    if (this.healthBarFill) {
      const barWidth = 1.5;
      this.healthBarFill.scale.x = healthPercent;
      this.healthBarFill.position.x = (barWidth * (healthPercent - 1)) / 2;
      
      // Update color based on health percentage
      const material = this.healthBarFill.material;
      if (healthPercent > 0.6) {
        // Green for high health
        material.color.setRGB(0, 1, 0);
      } else if (healthPercent > 0.3) {
        // Yellow for medium health
        material.color.setRGB(1, 1, 0);
      } else {
        // Red for low health
        material.color.setRGB(1, 0, 0);
      }
    }
    
    // Make health bar face camera
    if (this.healthBar && window.camera) {
      this.healthBar.lookAt(window.camera.position);
    }
  }
}

export default Player;