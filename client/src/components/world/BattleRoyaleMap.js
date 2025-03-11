import * as THREE from 'three';
import renderer from '../core/Renderer.js';
import eventBus from '../core/EventBus.js';

/**
 * BattleRoyaleMap - Creates a 1000km x 1000km map with terrain features and health pickups
 */
class BattleRoyaleMap {
  constructor() {
    this.objects = [];
    this.ground = null;
    this.trees = [];
    this.healthPickups = [];

    // Map properties
    this.size = 1000; // 1000 units = 1000km in our scale
    this.treeCount = 100; // Number of trees to place
    this.healthPickupCount = 20; // Number of health pickups
    this.groundColor = 0x4a7e5c; // Green ground
    this.treeColor = 0x2d4a33; // Dark green trees
    this.healthPickupColor = 0xe74c3c; // Red health pickups
    
    // Pickup properties
    this.pickupRotationSpeed = 0.01;
    this.pickupBobSpeed = 0.5;
    this.pickupBobHeight = 0.2;
    
    // Bind methods
    this._updatePickups = this._updatePickups.bind(this);
  }

  /**
   * Initialize the battle royale map
   * @param {Object} options - Configuration options
   * @returns {BattleRoyaleMap} - This instance for chaining
   */
  init(options = {}) {
    // Apply options
    if (options.size !== undefined) this.size = options.size;
    if (options.treeCount !== undefined) this.treeCount = options.treeCount;
    if (options.healthPickupCount !== undefined) this.healthPickupCount = options.healthPickupCount;
    if (options.groundColor !== undefined) this.groundColor = options.groundColor;
    if (options.treeColor !== undefined) this.treeColor = options.treeColor;
    if (options.healthPickupColor !== undefined) this.healthPickupColor = options.healthPickupColor;
    
    // Create ground
    this.createGround();
    
    // Create trees
    this.createTrees();
    
    // Create health pickups
    this.createHealthPickups();
    
    // Start animation loop for pickups using the event system
    eventBus.on('renderer.beforeRender', this._updatePickups);
    
    // Emit event that map is ready
    eventBus.emit('map.ready', { type: 'battleRoyale' });
    
    return this;
  }

  /**
   * Create the ground
   */
  createGround() {
    // Create a plane geometry for the ground
    const geometry = new THREE.PlaneGeometry(this.size, this.size);
    
    // Create ground texture
    const texture = this.createGroundTexture();
    
    // Create material with the texture
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      roughness: 0.8
    });
    
    // Create mesh and position it
    this.ground = new THREE.Mesh(geometry, material);
    this.ground.rotation.x = -Math.PI / 2; // Rotate to be flat
    this.ground.receiveShadow = true;
    
    // Add to renderer
    renderer.addObject('battleRoyaleGround', this.ground);
  }

  /**
   * Create a procedural texture for the ground
   * @returns {THREE.CanvasTexture} - Generated texture
   */
  createGroundTexture(size = 1024, lineWidth = 2) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fill background with ground color
    ctx.fillStyle = `#${this.groundColor.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, size, size);
    
    // Create a more natural-looking terrain pattern
    // Add some noise/variation to the ground
    const noiseColor = this.groundColor - 0x050505;
    ctx.fillStyle = `#${noiseColor.toString(16).padStart(6, '0')}`;
    
    // Create a pattern of small patches
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 5 + Math.random() * 15;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Create and return the texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(this.size / 20, this.size / 20);
    
    return texture;
  }

  /**
   * Create trees (represented as cylinders)
   */
  createTrees() {
    // Create tree geometry and material
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 4, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown trunk
    
    const leavesGeometry = new THREE.ConeGeometry(2, 5, 8);
    const leavesMaterial = new THREE.MeshStandardMaterial({ color: this.treeColor });
    
    // Create trees at random positions
    for (let i = 0; i < this.treeCount; i++) {
      // Create trunk
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      
      // Create leaves
      const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
      leaves.castShadow = true;
      leaves.position.y = 4.5; // Position on top of trunk
      
      // Create tree group
      const tree = new THREE.Group();
      tree.add(trunk);
      tree.add(leaves);
      
      // Position tree randomly on the map
      const halfSize = this.size / 2 - 10; // Keep away from edges
      const x = (Math.random() * this.size) - halfSize;
      const z = (Math.random() * this.size) - halfSize;
      tree.position.set(x, 2, z); // Set y to 2 to place on ground
      
      // Add to scene and store reference
      renderer.addObject(`tree_${i}`, tree);
      this.trees.push(tree);
    }
  }

  /**
   * Create health pickups (represented as red spheres)
   */
  createHealthPickups() {
    // Create health pickup geometry and material
    const geometry = new THREE.SphereGeometry(1, 16, 16);
    const material = new THREE.MeshStandardMaterial({ 
      color: this.healthPickupColor,
      emissive: this.healthPickupColor,
      emissiveIntensity: 0.5
    });
    
    // Create pickups at random positions
    for (let i = 0; i < this.healthPickupCount; i++) {
      // Create pickup
      const pickup = new THREE.Mesh(geometry, material);
      pickup.castShadow = true;
      pickup.receiveShadow = true;
      
      // Position pickup randomly on the map
      const halfSize = this.size / 2 - 10; // Keep away from edges
      const x = (Math.random() * this.size) - halfSize;
      const z = (Math.random() * this.size) - halfSize;
      pickup.position.set(x, 1.5, z); // Float above ground
      
      // Add custom properties for animation
      pickup.userData = {
        initialY: 1.5,
        bobOffset: Math.random() * Math.PI * 2, // Random starting phase
        type: 'healthPickup',
        healAmount: 20 // Amount of health to restore
      };
      
      // Add to scene and store reference
      renderer.addObject(`healthPickup_${i}`, pickup);
      this.healthPickups.push(pickup);
      
      // Add collision detection for this pickup
      this._setupPickupCollision(pickup, i);
    }
  }

  /**
   * Set up collision detection for a health pickup
   * @param {THREE.Mesh} pickup - The pickup mesh
   * @param {number} index - Pickup index
   * @private
   */
  _setupPickupCollision(pickup, index) {
    // Listen for player position updates
    eventBus.on('player.moved', (data) => {
      // Skip if pickup was already collected
      if (!pickup.visible) return;
      
      // Check distance to player
      const playerPos = data.position;
      const pickupPos = pickup.position;
      
      const dx = playerPos.x - pickupPos.x;
      const dz = playerPos.z - pickupPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      // If player is close enough, collect the pickup
      if (distance < 2) {
        this._collectPickup(pickup, index);
      }
    });
  }

  /**
   * Collect a health pickup
   * @param {THREE.Mesh} pickup - The pickup mesh
   * @param {number} index - Pickup index
   * @private
   */
  _collectPickup(pickup, index) {
    // Hide the pickup
    pickup.visible = false;
    
    // Emit event for health restoration
    eventBus.emit('player.healthPickup', {
      healAmount: pickup.userData.healAmount
    });
    
    // Play pickup effect
    this._playPickupEffect(pickup.position);
    
    // Respawn the pickup after a delay
    setTimeout(() => {
      // Reposition the pickup
      const halfSize = this.size / 2 - 10;
      const x = (Math.random() * this.size) - halfSize;
      const z = (Math.random() * this.size) - halfSize;
      pickup.position.set(x, 1.5, z);
      pickup.userData.initialY = 1.5;
      
      // Make it visible again
      pickup.visible = true;
    }, 30000); // Respawn after 30 seconds
  }

  /**
   * Play pickup effect at position
   * @param {THREE.Vector3} position - Effect position
   * @private
   */
  _playPickupEffect(position) {
    // Create particle effect for pickup
    const particleCount = 20;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.SphereGeometry(0.1, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: this.healthPickupColor,
        transparent: true,
        opacity: 1
      });
      
      const particle = new THREE.Mesh(geometry, material);
      
      // Set random direction
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.05 + Math.random() * 0.1;
      particle.userData = {
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          0.1 + Math.random() * 0.1,
          Math.sin(angle) * speed
        ),
        life: 1.0 // Life counter (1.0 to 0.0)
      };
      
      // Position at pickup location
      particle.position.copy(position);
      
      particles.add(particle);
    }
    
    // Add to scene
    renderer.addObject('pickupEffect', particles);
    
    // Create a function to animate particles
    const animateParticles = (data) => {
      let allDead = true;
      
      particles.children.forEach(particle => {
        // Move particle
        particle.position.add(particle.userData.velocity);
        
        // Apply gravity
        particle.userData.velocity.y -= 0.005;
        
        // Reduce life
        particle.userData.life -= 0.02;
        
        // Update opacity
        particle.material.opacity = particle.userData.life;
        
        // Check if particle is still alive
        if (particle.userData.life > 0) {
          allDead = false;
        }
      });
      
      // Remove particles if all are dead
      if (allDead) {
        renderer.removeObject('pickupEffect');
        eventBus.off('renderer.beforeRender', animateParticles);
        
        // Dispose resources
        particles.children.forEach(particle => {
          particle.geometry.dispose();
          particle.material.dispose();
        });
      }
    };
    
    // Add to animation loop using event system
    eventBus.on('renderer.beforeRender', animateParticles);
  }

  /**
   * Update pickups animation
   * @param {Object} data - Event data with deltaTime
   * @private
   */
  _updatePickups(data) {
    const time = performance.now() * 0.001; // Convert to seconds
    
    // Update each health pickup
    this.healthPickups.forEach(pickup => {
      if (!pickup.visible) return;
      
      // Rotate pickup
      pickup.rotation.y += this.pickupRotationSpeed;
      
      // Bob up and down
      const bobOffset = pickup.userData.bobOffset || 0;
      pickup.position.y = pickup.userData.initialY + 
        Math.sin((time + bobOffset) * this.pickupBobSpeed) * this.pickupBobHeight;
    });
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Remove from animation loop
    eventBus.off('renderer.beforeRender', this._updatePickups);
    
    // Remove ground
    renderer.removeObject('battleRoyaleGround');
    
    // Dispose ground resources
    if (this.ground) {
      if (this.ground.geometry) this.ground.geometry.dispose();
      if (this.ground.material) {
        if (this.ground.material.map) this.ground.material.map.dispose();
        this.ground.material.dispose();
      }
    }
    
    // Remove and dispose trees
    this.trees.forEach((tree, i) => {
      renderer.removeObject(`tree_${i}`);
      
      // Dispose tree resources
      tree.children.forEach(part => {
        if (part.geometry) part.geometry.dispose();
        if (part.material) part.material.dispose();
      });
    });
    
    // Remove and dispose health pickups
    this.healthPickups.forEach((pickup, i) => {
      renderer.removeObject(`healthPickup_${i}`);
      
      // Dispose pickup resources
      if (pickup.geometry) pickup.geometry.dispose();
      if (pickup.material) pickup.material.dispose();
    });
    
    // Clear arrays
    this.trees = [];
    this.healthPickups = [];
    this.ground = null;
  }
}

// Create singleton instance
const battleRoyaleMap = new BattleRoyaleMap();

export default battleRoyaleMap; 