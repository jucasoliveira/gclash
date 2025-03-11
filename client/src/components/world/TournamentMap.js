import * as THREE from 'three';
import renderer from '../core/Renderer.js';
import eventBus from '../core/EventBus.js';

/**
 * TournamentMap - Creates a 2km x 2km arena with walls and obstacles for tournament mode
 */
class TournamentMap {
  constructor() {
    this.objects = [];
    this.ground = null;
    this.walls = [];
    this.obstacles = [];

    // Map properties
    this.size = 80; // 80 units = 2km in our scale
    this.wallHeight = 3;
    this.wallThickness = 0.5;
    this.arenaColor = 0x808080; // Gray arena floor
    this.wallColor = 0x505050; // Darker gray walls
    this.obstacleColor = 0x684721; // Brown for wooden crates/boxes
  }

  /**
   * Initialize the tournament map
   * @param {Object} options - Configuration options
   * @returns {TournamentMap} - This instance for chaining
   */
  init(options = {}) {
    // Apply options
    if (options.size !== undefined) this.size = options.size;
    if (options.wallHeight !== undefined) this.wallHeight = options.wallHeight;
    if (options.arenaColor !== undefined) this.arenaColor = options.arenaColor;
    if (options.wallColor !== undefined) this.wallColor = options.wallColor;
    if (options.obstacleColor !== undefined) this.obstacleColor = options.obstacleColor;
    
    // Create arena ground
    this.createGround();
    
    // Create arena walls
    this.createWalls();
    
    // Create obstacles
    this.createObstacles();
    
    // Create spotlights for tournament arena feel
    this.createSpotlights();
    
    // Emit event that map is ready
    eventBus.emit('map.ready', { type: 'tournament' });
    
    return this;
  }

  /**
   * Create the arena ground
   */
  createGround() {
    // Create a plane geometry for the ground
    const geometry = new THREE.PlaneGeometry(this.size, this.size);
    
    // Create arena floor texture
    const texture = this.createArenaTexture();
    
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
    renderer.addObject('tournamentGround', this.ground);
  }

  /**
   * Create a procedural texture for the arena floor
   * @returns {THREE.CanvasTexture} - Generated texture
   */
  createArenaTexture(size = 1024, lineWidth = 2) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fill background with arena color
    ctx.fillStyle = `#${this.arenaColor.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, size, size);
    
    // Draw grid lines with slightly darker color
    const lineColor = this.arenaColor - 0x111111;
    ctx.strokeStyle = `#${lineColor.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = lineWidth;
    
    // Draw circular arena pattern
    const center = size / 2;
    const radius = size / 2 - 10;
    
    // Draw circular boundary
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw concentric circles
    for (let r = radius * 0.8; r > 0; r -= radius * 0.2) {
      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw radial lines
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(
        center + Math.cos(angle) * radius,
        center + Math.sin(angle) * radius
      );
      ctx.stroke();
    }
    
    // Create and return the texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    
    return texture;
  }

  /**
   * Create walls around the arena
   */
  createWalls() {
    const halfSize = this.size / 2;
    const wallGeometry = new THREE.BoxGeometry(
      this.size + this.wallThickness * 2,
      this.wallHeight,
      this.wallThickness
    );
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      color: this.wallColor,
      roughness: 0.7
    });
    
    // North wall
    const northWall = new THREE.Mesh(wallGeometry, wallMaterial);
    northWall.position.set(0, this.wallHeight / 2, -halfSize - this.wallThickness / 2);
    northWall.castShadow = true;
    northWall.receiveShadow = true;
    renderer.addObject('northWall', northWall);
    this.walls.push(northWall);
    
    // South wall
    const southWall = new THREE.Mesh(wallGeometry, wallMaterial);
    southWall.position.set(0, this.wallHeight / 2, halfSize + this.wallThickness / 2);
    southWall.castShadow = true;
    southWall.receiveShadow = true;
    renderer.addObject('southWall', southWall);
    this.walls.push(southWall);
    
    // East wall
    const eastWallGeometry = new THREE.BoxGeometry(
      this.wallThickness,
      this.wallHeight,
      this.size + this.wallThickness * 2
    );
    const eastWall = new THREE.Mesh(eastWallGeometry, wallMaterial);
    eastWall.position.set(halfSize + this.wallThickness / 2, this.wallHeight / 2, 0);
    eastWall.castShadow = true;
    eastWall.receiveShadow = true;
    renderer.addObject('eastWall', eastWall);
    this.walls.push(eastWall);
    
    // West wall
    const westWall = new THREE.Mesh(eastWallGeometry, wallMaterial);
    westWall.position.set(-halfSize - this.wallThickness / 2, this.wallHeight / 2, 0);
    westWall.castShadow = true;
    westWall.receiveShadow = true;
    renderer.addObject('westWall', westWall);
    this.walls.push(westWall);
  }

  /**
   * Create obstacles in the arena
   */
  createObstacles() {
    const obstacleMaterial = new THREE.MeshStandardMaterial({
      color: this.obstacleColor,
      roughness: 0.9
    });
    
    // Create a number of boxes throughout the arena
    const numObstacles = 15;
    const boxSizes = [
      { w: 1.5, h: 1.5, d: 1.5 },  // Large box
      { w: 1.0, h: 1.0, d: 1.0 },  // Medium box
      { w: 0.8, h: 0.8, d: 0.8 }   // Small box
    ];
    
    for (let i = 0; i < numObstacles; i++) {
      // Choose random box size
      const sizeIndex = Math.floor(Math.random() * boxSizes.length);
      const size = boxSizes[sizeIndex];
      
      // Create box geometry based on selected size
      const geometry = new THREE.BoxGeometry(size.w, size.h, size.d);
      const box = new THREE.Mesh(geometry, obstacleMaterial);
      
      // Position the box randomly within the arena (not too close to edges)
      const safeZone = this.size * 0.4;
      box.position.set(
        (Math.random() * 2 - 1) * safeZone,  // X between -safeZone and safeZone
        size.h / 2,                          // Y to place on ground
        (Math.random() * 2 - 1) * safeZone   // Z between -safeZone and safeZone
      );
      
      // Add some random rotation for variety
      box.rotation.y = Math.random() * Math.PI * 2;
      
      // Enable shadows
      box.castShadow = true;
      box.receiveShadow = true;
      
      // Add to the scene
      renderer.addObject(`obstacle_${i}`, box);
      this.obstacles.push(box);
    }
    
    // Add some clusters of boxes to create more interesting obstacles
    this.createObstacleCluster(3, 3, 0, obstacleMaterial);
    this.createObstacleCluster(-3, -3, 0, obstacleMaterial);
  }
  
  /**
   * Create a cluster of obstacle boxes
   * @param {number} x - X position
   * @param {number} z - Z position
   * @param {number} rotation - Rotation in radians
   * @param {THREE.Material} material - Material to use for boxes
   */
  createObstacleCluster(x, z, rotation, material) {
    const boxSize = 0.7;
    const clusterSize = 3;
    const group = new THREE.Group();
    
    // Create a stack of boxes
    for (let i = 0; i < clusterSize; i++) {
      for (let j = 0; j < clusterSize - i; j++) {
        const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
        const box = new THREE.Mesh(geometry, material);
        
        // Position each box in the stack
        box.position.set(
          (j - (clusterSize - i - 1) / 2) * boxSize,
          (i + 0.5) * boxSize, // Stack upward
          0
        );
        
        box.castShadow = true;
        box.receiveShadow = true;
        group.add(box);
      }
    }
    
    // Position and rotate the entire cluster
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    
    // Add to scene
    renderer.addObject(`cluster_${x}_${z}`, group);
    this.obstacles.push(group);
  }
  
  /**
   * Get obstacle objects for collision detection
   * @returns {Array} Array of obstacle objects
   */
  getObstacles() {
    return this.obstacles;
  }
  
  /**
   * Get wall objects for collision detection
   * @returns {Array} Array of wall objects
   */
  getWalls() {
    return this.walls;
  }

  /**
   * Clean up all resources
   */
  dispose() {
    // Remove ground
    if (this.ground) {
      renderer.removeObject('tournamentGround');
      if (this.ground.geometry) this.ground.geometry.dispose();
      if (this.ground.material) {
        if (this.ground.material.map) this.ground.material.map.dispose();
        this.ground.material.dispose();
      }
    }
    
    // Remove walls
    this.walls.forEach((wall, index) => {
      renderer.removeObject(`northWall`);
      renderer.removeObject(`southWall`);
      renderer.removeObject(`eastWall`);
      renderer.removeObject(`westWall`);
      if (wall.geometry) wall.geometry.dispose();
      if (wall.material) wall.material.dispose();
    });
    
    // Remove obstacles
    this.obstacles.forEach((obstacle, index) => {
      renderer.removeObject(`obstacle_${index}`);
      renderer.removeObject(`cluster_${index}_${index}`);
      if (obstacle instanceof THREE.Mesh) {
        if (obstacle.geometry) obstacle.geometry.dispose();
        if (obstacle.material) obstacle.material.dispose();
      } else if (obstacle instanceof THREE.Group) {
        obstacle.children.forEach(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
    });
    
    // Remove spotlights and other objects
    this.objects.forEach((obj, index) => {
      if (obj instanceof THREE.Light) {
        // Remove lights
        renderer.removeObject(`spotlight_${index}`);
        renderer.removeObject(`spotlight_target_${index}`);
        renderer.removeObject(`tournamentAmbient`);
      } else if (obj instanceof THREE.Object3D) {
        // Remove any other 3D objects
        renderer.removeObject(`object_${index}`);
      }
    });
    
    // Clear arrays
    this.walls = [];
    this.obstacles = [];
    this.objects = [];
    this.ground = null;
  }

  /**
   * Create spotlights around the arena for tournament atmosphere
   */
  createSpotlights() {
    const spotlightPositions = [
      { x: -8, y: 6, z: -8 },
      { x: 8, y: 6, z: -8 },
      { x: -8, y: 6, z: 8 },
      { x: 8, y: 6, z: 8 }
    ];
    
    // Create spotlights at each corner
    spotlightPositions.forEach((pos, index) => {
      // Create spotlight
      const spotlight = new THREE.SpotLight(0xffffff, 0.8);
      spotlight.position.set(pos.x, pos.y, pos.z);
      spotlight.angle = Math.PI / 6; // 30 degrees
      spotlight.penumbra = 0.2;
      spotlight.decay = 1.5;
      spotlight.distance = 25;
      spotlight.castShadow = true;
      
      // Target towards center of arena
      spotlight.target.position.set(0, 0, 0);
      
      // Set up shadow properties
      spotlight.shadow.mapSize.width = 1024;
      spotlight.shadow.mapSize.height = 1024;
      spotlight.shadow.camera.near = 1;
      spotlight.shadow.camera.far = 30;
      
      // Add to scene including target
      renderer.addObject(`spotlight_${index}`, spotlight);
      renderer.addObject(`spotlight_target_${index}`, spotlight.target);
      
      // Store for cleanup
      this.objects.push(spotlight);
      this.objects.push(spotlight.target);
    });
    
    // Add a subtle ambient light with blueish tint for arena atmosphere
    const ambientLight = new THREE.AmbientLight(0x404080, 0.3);
    renderer.addObject('tournamentAmbient', ambientLight);
    this.objects.push(ambientLight);
  }
}

// Create singleton instance
const tournamentMap = new TournamentMap();

export default tournamentMap; 