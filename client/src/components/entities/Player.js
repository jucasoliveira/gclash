import * as THREE from 'three';
import Entity from './Entity.js';
import eventBus from '../core/EventBus.js';
import webSocketManager from '../network/WebSocketManager.js';

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
   * Handle move to position event (left click on ground)
   * @param {Object} data - Move event data
   * @private
   */
  _handleMove(data) {
    // Skip if we're attacking
    if (this.isAttacking) {
      console.log('Not moving - currently attacking');
      return;
    }
    
    // Create a raycaster for ground detection
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(data.ndc, window.currentCamera);
    
    // Get the ground plane
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    
    // Find intersection with ground plane
    const intersection = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
      // Log debug info including current position and click position
      const distanceToClick = this.position.distanceTo(intersection);
      console.log(`Moving to position: (${intersection.x.toFixed(2)}, ${intersection.y.toFixed(2)}, ${intersection.z.toFixed(2)})`);
      console.log(`Current position: (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)})`);
      console.log(`Distance to click: ${distanceToClick.toFixed(2)} units`);
      
      // Set the target position for the player to move towards
      this.targetPosition = intersection.clone();
      this.isMouseMoving = true;
      
      // Create a visual movement indicator
      this._createMovementIndicator(intersection);
      
      // Reset WASD movement since mouse movement takes priority
      this.movementDirection.set(0, 0, 0);
      this.isMoving = false;
      
      // Debug info
      console.log('Player speed stat:', this.stats.speed);
      console.log('Movement type:', this.classType);
    } else {
      console.warn('Failed to intersect with ground plane');
    }
  }
  
  /**
   * Create a visual indicator at the clicked position
   * @param {THREE.Vector3} position - Position to place the indicator
   * @private
   */
  _createMovementIndicator(position) {
    // Create a smaller, dark red circular indicator
    const geometry = new THREE.CircleGeometry(0.5, 32); // Reduced size from 1.0 to 0.5
    const material = new THREE.MeshBasicMaterial({
      color: 0x8B0000, // Changed to dark red
      transparent: true,
      opacity: 0.7, // Slightly reduced opacity
      side: THREE.DoubleSide
    });
    
    const indicator = new THREE.Mesh(geometry, material);
    indicator.position.copy(position);
    indicator.position.y += 0.05; // Slightly higher above ground to avoid z-fighting
    indicator.rotation.x = -Math.PI / 2; // Lay flat on the ground
    
    // Add to scene temporarily
    eventBus.emit('renderer.addObject', {
      id: `move-indicator-${Date.now()}`,
      object: indicator,
      temporary: true,
      duration: 1.0 // Slightly reduced from 1.5 to 1.0 seconds
    });
    
    console.log(`Created movement indicator at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    
    // Animate the indicator (fade out)
    const startTime = Date.now();
    const duration = 1000; // 1 second
    
    const animateIndicator = () => {
      const elapsedTime = Date.now() - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      if (progress < 1 && indicator.parent) {
        // Indicator fade out and scale up slightly
        indicator.material.opacity = 0.7 * (1 - progress);
        indicator.scale.set(1 + progress * 0.3, 1 + progress * 0.3, 1);
        
        requestAnimationFrame(animateIndicator);
      }
    };
    
    // Start animation
    animateIndicator();
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
   * Update player position based on movement direction
   * @param {number} deltaTime - Time since last update in seconds
   */
  update(deltaTime) {
    // Call base entity update (components)
    super.update(deltaTime);
    
    // Ensure a reasonable deltaTime (prevent extremely small values)
    // This protects against irregular frame rates and potential division by zero
    const safeDeltatime = Math.max(deltaTime, 0.016); // Force minimum 16ms (approximately 60 FPS)
    
    // Debug log for deltaTime issues (uncomment if needed)
    if (deltaTime < 0.001) {
      console.warn(`Extremely small deltaTime: ${deltaTime}`);
    }
    
    // Handle mouse-driven movement (Diablo-style)
    if (this.isMouseMoving && this.targetPosition) {
      // Calculate direction vector to target
      const direction = new THREE.Vector3();
      direction.subVectors(this.targetPosition, this.position);
      direction.y = 0; // Keep movement on the ground plane
      
      // Check if we've arrived (within a small threshold)
      const distanceToTarget = direction.length();
      
      // Log distance for debugging more frequently
      if (distanceToTarget % 0.5 < 0.01) { // Log approx every 0.5 units
        console.log(`Distance to target: ${distanceToTarget.toFixed(2)} units`);
      }
      
      if (distanceToTarget < 0.2) {
        // We've arrived at the destination
        this.isMouseMoving = false;
        this.targetPosition = null;
        console.log('Arrived at destination');
        
        // Check if we were moving to attack a target
        if (this.attackTargetId && !this.isAttacking && this.attackCooldown <= 0) {
          const target = this._getEntityById(this.attackTargetId);
          if (target) {
            // Check if we're in range now
            const distanceToEnemy = this.position.distanceTo(target.position);
            if (distanceToEnemy <= this.primaryAttack.range) {
              // We're in range, try to attack
              const manaCost = this.manaUsage[this.classType].cost;
              if (this.mana >= manaCost) {
                // Consume mana
                this.mana -= manaCost;
                this._emitManaChange();
                
                // Record attack time for Ranger mana regeneration
                this.lastAttackTime = Date.now();
                
                // Start attack cooldown
                this.attackCooldown = this.primaryAttack.cooldown;
                this.isAttacking = true;
                
                // Execute the attack
                this._executeAttack(this.attackTargetId, this.primaryAttack.damage, distanceToEnemy);
                
                // Show attack animation/effect
                this._showAttackEffect();
                
                // Reset attack state after animation completes
                setTimeout(() => {
                  this.isAttacking = false;
                }, 200);
              }
            }
          }
          
          // Clear the attack target
          this.attackTargetId = null;
        }
      } else {
        // Normalize direction and apply movement
        direction.normalize();
        
        // Calculate movement step for this frame - DRAMATICALLY increased speed multiplier
        const movementMultiplier = 30.0; // Massively increased from 10.0 to 30.0
        const step = this.stats.speed * safeDeltatime * movementMultiplier;
        
        console.log(`Movement calculation: speed=${this.stats.speed}, deltaTime=${safeDeltatime}, multiplier=${movementMultiplier}`);
        console.log(`Step size: ${step.toFixed(4)} units`);
        
        const oldPos = this.position.clone(); // For logging movement distance
        
        // Move toward target, but don't overshoot
        if (step >= distanceToTarget) {
          this.position.copy(this.targetPosition);
          this.isMouseMoving = false;
          this.targetPosition = null;
          console.log('Reached target position in one step');
        } else {
          // Move in the direction of the target
          this.position.x += direction.x * step;
          this.position.z += direction.z * step;
          
          // More frequent logging of movement amount
          if (Math.random() < 0.2) { // ~20% chance of logging each frame
            const moveDistance = this.position.distanceTo(oldPos);
            console.log(`Moved ${moveDistance.toFixed(4)} units this frame, step size: ${step.toFixed(4)}`);
            console.log(`New position: (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)})`);
          }
          
          // Apply rotation to face movement direction
          if (direction.length() > 0.1) {
            const targetRotation = Math.atan2(direction.x, direction.z);
            // Smoothly rotate toward target direction
            const rotationSpeed = 30 * safeDeltatime; // Increased rotation speed further
            const angleDiff = this._getAngleDifference(this.rotation.y, targetRotation);
            this.rotation.y += angleDiff * rotationSpeed;
          }
        }
        
        // Force position update on the mesh
        if (this.mesh) {
          this.mesh.position.copy(this.position);
          // Log mesh position to ensure it's updating correctly
          if (Math.random() < 0.05) {
            console.log(`Mesh position: (${this.mesh.position.x.toFixed(2)}, ${this.mesh.position.y.toFixed(2)}, ${this.mesh.position.z.toFixed(2)})`);
          }
        } else {
          console.warn('Player has no mesh to update!');
        }
        
        // Send position update to server
        webSocketManager.updatePosition({
          x: this.position.x,
          y: this.position.y,
          z: this.position.z
        });
        
        // Check if we're moving to attack a target and might be in range now
        if (this.attackTargetId && !this.isAttacking && this.attackCooldown <= 0) {
          const target = this._getEntityById(this.attackTargetId);
          if (target) {
            // Check if we're in range now
            const distanceToEnemy = this.position.distanceTo(target.position);
            if (distanceToEnemy <= this.primaryAttack.range) {
              // We're in range, stop moving and attack
              this.isMouseMoving = false;
              this.targetPosition = null;
              
              // Check mana
              const manaCost = this.manaUsage[this.classType].cost;
              if (this.mana >= manaCost) {
                // Consume mana
                this.mana -= manaCost;
                this._emitManaChange();
                
                // Record attack time for Ranger mana regeneration
                this.lastAttackTime = Date.now();
                
                // Start attack cooldown
                this.attackCooldown = this.primaryAttack.cooldown;
                this.isAttacking = true;
                
                // Execute the attack
                this._executeAttack(this.attackTargetId, this.primaryAttack.damage, distanceToEnemy);
                
                // Show attack animation/effect
                this._showAttackEffect();
                
                // Reset attack state after animation completes
                setTimeout(() => {
                  this.isAttacking = false;
                }, 200);
                
                // Clear the attack target
                this.attackTargetId = null;
              }
            }
          }
        }
      }
    }
    // Handle WASD keyboard movement (as secondary option)
    else if (this.isMoving) {
      // Cancel any mouse movement since keyboard takes over
      this.isMouseMoving = false;
      this.targetPosition = null;
      this.attackTargetId = null; // Clear any pending attack
      
      // Normalize direction vector
      const direction = this.movementDirection.clone().normalize();
      
      // Move player based on speed - also increase WASD movement for consistency
      const movementMultiplier = 30.0; // Increased from 10.0 to 30.0 for consistency
      const deltaX = direction.x * this.stats.speed * safeDeltatime * movementMultiplier;
      const deltaZ = direction.z * this.stats.speed * safeDeltatime * movementMultiplier;
      
      const oldPos = this.position.clone(); // For logging movement distance
      
      this.position.x += deltaX;
      this.position.z += deltaZ;
      
      // More frequent logging of WASD movement
      if (Math.random() < 0.1) { // ~10% chance of logging each frame
        const moveDistance = this.position.distanceTo(oldPos);
        console.log(`WASD moved ${moveDistance.toFixed(4)} units this frame, deltaX: ${deltaX.toFixed(4)}, deltaZ: ${deltaZ.toFixed(4)}`);
      }
      
      // Apply rotation to face movement direction
      if (direction.length() > 0.1) {
        const targetRotation = Math.atan2(direction.x, direction.z);
        // Smoothly rotate toward target direction
        const rotationSpeed = 30 * safeDeltatime; // Increased rotation speed
        const angleDiff = this._getAngleDifference(this.rotation.y, targetRotation);
        this.rotation.y += angleDiff * rotationSpeed;
      }
      
      // Force position update on the mesh
      if (this.mesh) {
        this.mesh.position.copy(this.position);
      } else {
        console.warn('Player has no mesh to update during WASD movement!');
      }
      
      // Send movement to server
      webSocketManager.updatePosition({
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      });
    }
    
    // Update attack cooldown
    if (this.attackCooldown > 0) {
      // Decrease cooldown by delta time
      this.attackCooldown = Math.max(0, this.attackCooldown - safeDeltatime);
      
      // Log cooldown for debugging
      if (safeDeltatime > 0 && this.attackCooldown % 1 < safeDeltatime) {
        console.debug(`Attack cooldown: ${this.attackCooldown.toFixed(2)}s left`);
      }
      
      // If we just reached 0, log that attack is ready
      if (this.attackCooldown === 0) {
        console.log('Attack ready!');
      }
    }
    
    // Update core skill cooldown
    if (this.coreSkillCooldown > 0) {
      this.coreSkillCooldown = Math.max(0, this.coreSkillCooldown - safeDeltatime);
      
      if (this.coreSkillCooldown === 0) {
        console.log('Core skill ready!');
      }
    }
    
    // Update evade cooldown
    if (this.evadeCooldown > 0) {
      this.evadeCooldown = Math.max(0, this.evadeCooldown - safeDeltatime);
      
      if (this.evadeCooldown === 0) {
        console.log('Evade ready!');
      }
    }
    
    // Mana regeneration based on class type
    this._regenerateMana(safeDeltatime);
    
    // Update all cooldown UI elements
    this._updateCooldownUI();
  }
  
  /**
   * Helper to get the shortest angle difference
   * @param {number} current - Current angle in radians
   * @param {number} target - Target angle in radians
   * @returns {number} - Angle difference
   * @private
   */
  _getAngleDifference(current, target) {
    let diff = target - current;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  }
  
  /**
   * Regenerate mana based on class type and state
   * @param {number} deltaTime - Time since last update
   * @private
   */
  _regenerateMana(deltaTime) {
    // Ensure a reasonable deltaTime (prevent extremely small values)
    const safeDeltatime = Math.max(deltaTime, 0.016); // Match the same minimum as in update method
    
    // Base regeneration for all classes
    let manaToAdd = this.manaRegenRate * safeDeltatime;
    
    // Class-specific bonus regeneration
    if (this.classType === 'CLERK') {
      // Clerk regenerates mana faster when standing still
      if (!this.isMoving) {
        manaToAdd += this.manaUsage.CLERK.regenBonus.standing * safeDeltatime;
      } else {
        manaToAdd += this.manaUsage.CLERK.regenBonus.moving * safeDeltatime;
      }
    } else if (this.classType === 'RANGER') {
      // Ranger regenerates mana faster when not attacking
      const timeSinceLastAttack = (Date.now() - this.lastAttackTime) / 1000;
      if (timeSinceLastAttack > 2) { // Not attacked for 2 seconds
        manaToAdd += this.manaUsage.RANGER.regenBonus.notAttacking * safeDeltatime;
      }
    }
    // Note: Warrior builds mana by landing hits, handled in _executeAttack
    
    // Log mana regeneration (occasionally)
    if (Math.random() < 0.01) { // 1% chance to log
      console.log(`Regenerated ${manaToAdd.toFixed(2)} mana, current: ${this.mana.toFixed(1)}/${this.maxMana}`);
    }
    
    // Add regenerated mana
    if (manaToAdd > 0) {
      this.mana = Math.min(this.maxMana, this.mana + manaToAdd);
      
      // Update mana UI
      this._emitManaChange();
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
      const maxCooldown = this.primaryAttack.cooldown;
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
        totalTime: this.primaryAttack.cooldown
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
    
    // Add to scene
    eventBus.emit('renderer.addObject', {
      id: `death-effect-${this.id}`,
      object: particles,
      temporary: true,
      duration: 2
    });
    
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
    // Remove event listeners
    eventBus.off('input.move.forward.start', this._boundHandleMoveForward);
    eventBus.off('input.move.backward.start', this._boundHandleMoveBackward);
    eventBus.off('input.move.left.start', this._boundHandleMoveLeft);
    eventBus.off('input.move.right.start', this._boundHandleMoveRight);
    
    eventBus.off('input.move.forward.end', this._boundHandleMoveForwardEnd);
    eventBus.off('input.move.backward.end', this._boundHandleMoveBackwardEnd);
    eventBus.off('input.move.left.end', this._boundHandleMoveLeftEnd);
    eventBus.off('input.move.right.end', this._boundHandleMoveRightEnd);
    
    // Remove new event listeners
    eventBus.off('input.move', this._boundHandleMove);
    eventBus.off('input.click', this._boundHandleAttack);
    eventBus.off('input.coreSkill', this._boundHandleCoreSkill);
    eventBus.off('input.action.evade.start', this._boundHandleEvade);
    
    // Remove skill slot event listeners
    eventBus.off('input.skill.slot1.start', this._boundHandleSkill1);
    eventBus.off('input.skill.slot2.start', this._boundHandleSkill2);
    eventBus.off('input.skill.slot3.start', this._boundHandleSkill3);
    eventBus.off('input.skill.slot4.start', this._boundHandleSkill4);
    
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
    // Validate health values to prevent NaN errors
    if (typeof this.health !== 'number' || isNaN(this.health)) {
      console.warn('Invalid health value in _updateHealthUI, resetting to 0');
      this.health = 0;
    }
    
    if (!this.stats || typeof this.stats.health !== 'number' || isNaN(this.stats.health) || this.stats.health <= 0) {
      console.warn('Invalid max health value in _updateHealthUI, using default');
      if (!this.stats) this.stats = {};
      this.stats.health = 100; // Default max health
    }
    
    console.log(`UPDATING PLAYER UI: Health = ${this.health}/${this.stats.health}`);
    
    // Update health bar
    const healthFill = document.getElementById('health-fill');
    const playerStats = document.getElementById('player-stats');
    
    if (healthFill) {
      // Calculate health percentage, ensuring it's between 0-100
      const healthPercent = Math.max(0, Math.min(100, (this.health / this.stats.health) * 100));
      
      // Force immediate update
      healthFill.style.transition = 'none';
      healthFill.style.width = `${healthPercent}%`;
      healthFill.offsetHeight; // Force reflow
      
      // Update color based on health percentage
      if (healthPercent > 60) {
        healthFill.style.backgroundColor = '#2ecc71'; // Green
      } else if (healthPercent > 30) {
        healthFill.style.backgroundColor = '#f39c12'; // Orange
      } else {
        healthFill.style.backgroundColor = '#e74c3c'; // Red
      }
      
      console.log(`Health bar updated: ${healthPercent}% width, health: ${this.health}/${this.stats.health}`);
      
      // Re-enable transition
      setTimeout(() => {
        healthFill.style.transition = 'width 0.3s ease-out, background-color 0.3s ease-out';
      }, 50);
    }
    
    if (playerStats) {
      playerStats.textContent = `Health: ${Math.round(this.health)}/${this.stats.health}`;
      console.log(`Player stats text updated to: ${playerStats.textContent}`);
    }
    
    // Update the health orb in the HUD
    eventBus.emit('player.healthChanged', {
      id: this.id,
      health: this.health,
      maxHealth: this.stats.health
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
}

export default Player;