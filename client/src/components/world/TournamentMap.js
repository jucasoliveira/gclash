import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import renderer from '../core/Renderer.js';
import eventBus from '../core/EventBus.js';
import { createNoise2D } from 'simplex-noise';

/**
 * TournamentMap - Creates a hexagon-based procedurally generated arena for tournament mode
 */
class TournamentMap {
  constructor() {
    this.objects = [];
    this.ground = null;
    this.walls = [];
    this.obstacles = [];
    this.textures = {};
    this.envMap = null;

    // Map properties
    this.size = 80; // 80 units = 2km in our scale
    this.mapRadius = 32; // Radius of the circular map
    this.wallHeight = 3;
    this.wallThickness = 0.5;
    
    // Height constants for terrain types
    this.MAX_HEIGHT = 2.5; // Reduced height for flatter terrain
    this.STONE_HEIGHT = this.MAX_HEIGHT * 0.8;
    this.DIRT_HEIGHT = this.MAX_HEIGHT * 0.7;
    this.GRASS_HEIGHT = this.MAX_HEIGHT * 0.5;
    this.SAND_HEIGHT = this.MAX_HEIGHT * 0.3;
    this.DIRT2_HEIGHT = this.MAX_HEIGHT * 0;
    
    // Water height (used for walkable determination)
    this.WATER_HEIGHT = -0.1; // Slightly below zero to ensure all land is walkable
    
    // Geometry containers for merging
    this.stoneGeo = new THREE.BoxGeometry(0, 0, 0);
    this.dirtGeo = new THREE.BoxGeometry(0, 0, 0);
    this.dirt2Geo = new THREE.BoxGeometry(0, 0, 0);
    this.sandGeo = new THREE.BoxGeometry(0, 0, 0);
    this.grassGeo = new THREE.BoxGeometry(0, 0, 0);
    this.treeGeo = new THREE.BoxGeometry(0, 0, 0);
    
    // Simplex noise for terrain generation
    this.noise2D = createNoise2D();
    
    // Tile type tracking for walkable areas
    this.tileTypes = new Map(); // Maps position key to tile type
    
    // All terrain types are walkable except those with obstacles
    this.walkableTileTypes = ['stone', 'dirt', 'grass', 'sand', 'dirt2']; 
    
    // Obstacle tile types that are not walkable
    this.obstacleTypes = ['grass_with_tree']; // Removed 'sand_with_stone' to make stones walkable
  }

  /**
   * Initialize the tournament map
   * @param {Object} options - Configuration options
   * @returns {TournamentMap} - This instance for chaining
   */
  async init(options = {}) {
    console.log('[TOURNAMENT MAP] Initializing tournament map');
    
    // Apply options
    if (options.size !== undefined) this.size = options.size;
    if (options.mapRadius !== undefined) this.mapRadius = options.mapRadius;
    if (options.wallHeight !== undefined) this.wallHeight = options.wallHeight;
    
    // Load textures and environment map
    await this.loadTextures();
    
    // Generate the hexagon-based terrain
    this.generateTerrain();
    
    // Create Rapier physics for terrain
    this.createPhysicsTerrain();
    
    // Create water for the map boundary
    this.createWater();
    
    // Create map container (cylinder walls)
    this.createMapContainer();
    
    // Add clouds to the scene
    this.createClouds();
    
    // Create spotlights for tournament arena feel
    this.createSpotlights();
    
    // Expose physics debug toggle globally
    window.togglePhysicsDebug = (visible) => this.togglePhysicsDebug(visible);
    console.log('[TOURNAMENT MAP] Physics debug toggle exposed as window.togglePhysicsDebug(true/false)');
    
    // Emit event that map is ready
    console.log('[TOURNAMENT MAP] Tournament map initialization complete, emitting ready event');
    eventBus.emit('tournamentMap.ready', { type: 'tournament' });
    
    return this;
  }

  /**
   * Load all required textures and environment map
   */
  async loadTextures() {
    try {
      // Load regular textures
      const textureLoader = new THREE.TextureLoader();
      const loadTexture = (url) => {
        return new Promise((resolve, reject) => {
          textureLoader.load(
            url, 
            (texture) => {
              resolve(texture);
            },
            undefined, // onProgress callback not needed
            (error) => {
              console.error(`[TOURNAMENT MAP] Error loading texture ${url}:`, error);
              // Create a fallback colored texture
              const canvas = document.createElement('canvas');
              canvas.width = 128;
              canvas.height = 128;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#FF00FF'; // Magenta for missing textures
              ctx.fillRect(0, 0, 128, 128);
              const fallbackTexture = new THREE.CanvasTexture(canvas);
              resolve(fallbackTexture);
            }
          );
        });
      };

      // Load environment map
      const loadEnvironmentMap = () => {
        return new Promise((resolve, reject) => {
          const pmremGenerator = new THREE.PMREMGenerator(renderer.getRenderer());
          pmremGenerator.compileEquirectangularShader();

          const rgbeLoader = new RGBELoader();
          rgbeLoader.load('/assets/envmap.hdr', (texture) => {
            this.envMap = pmremGenerator.fromEquirectangular(texture).texture;
            pmremGenerator.dispose();
            texture.dispose();
            console.log('[TOURNAMENT MAP] Environment map loaded successfully');
            resolve();
          }, undefined, (error) => {
            console.error('[TOURNAMENT MAP] Error loading environment map:', error);
            reject(error);
          });
        });
      };

      // Load all textures in parallel
      const [dirt, dirt2, grass, sand, water, stone] = await Promise.all([
        loadTexture('/assets/dirt.png'),
        loadTexture('/assets/dirt2.jpg'),
        loadTexture('/assets/grass.jpg'),
        loadTexture('/assets/sand.jpg'),
        loadTexture('/assets/water.jpg'),
        loadTexture('/assets/stone.png')
      ]);
      
      // Store textures
      this.textures = { dirt, dirt2, grass, sand, water, stone };
      
      // Configure texture properties
      Object.values(this.textures).forEach(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
      });
      
      // Load environment map
      await loadEnvironmentMap();
      
      console.log('[TOURNAMENT MAP] All textures and environment map loaded successfully');
    } catch (error) {
      console.error('[TOURNAMENT MAP] Error loading textures and environment map:', error);
    }
  }

  /**
   * Generate the hexagon-based terrain
   */
  generateTerrain() {
    // Clear tile types map before regenerating
    this.tileTypes.clear();
    
    // Generate hexagons for the map
    for (let i = -40; i < 40; i++) {
      for (let j = -40; j < 40; j++) {
        let position = this.tileToPosition(i, j);
        
        // Only create hexagons within the map radius
        if (position.length() > this.mapRadius) continue;
        
        // Generate height using simplex noise (flatter than the lobby map)
        let noise = (this.noise2D(i * 0.1, j * 0.1) + 1) * 0.5;
        let height = Math.pow(noise, 2) * this.MAX_HEIGHT; // Increased power for flatter terrain
        
        // Create the hexagon and track its type
        this.makeHex(height, position, i, j);
      }
    }
    
    // Create meshes from the merged geometries
    let stoneMesh = this.hexMesh(this.stoneGeo, this.textures.stone);
    let grassMesh = this.hexMesh(this.grassGeo, this.textures.grass);
    let dirt2Mesh = this.hexMesh(this.dirt2Geo, this.textures.dirt2);
    let dirtMesh = this.hexMesh(this.dirtGeo, this.textures.dirt);
    let sandMesh = this.hexMesh(this.sandGeo, this.textures.sand);
    
    // Add meshes to the scene
    renderer.addObject('stoneMesh', stoneMesh);
    renderer.addObject('grassMesh', grassMesh);
    renderer.addObject('dirt2Mesh', dirt2Mesh);
    renderer.addObject('dirtMesh', dirtMesh);
    renderer.addObject('sandMesh', sandMesh);
    
    // Store for cleanup
    this.objects.push(stoneMesh, grassMesh, dirt2Mesh, dirtMesh, sandMesh);
  }

  /**
   * Convert tile coordinates to world position
   * @param {number} tileX - X tile coordinate
   * @param {number} tileY - Y tile coordinate
   * @returns {THREE.Vector2} - World position
   */
  tileToPosition(tileX, tileY) {
    return new THREE.Vector2((tileX + (tileY % 2) * 0.5) * 1.77, tileY * 1.535);
  }

  /**
   * Create hexagon geometry
   * @param {number} height - Height of the hexagon
   * @param {THREE.Vector2} position - Position of the hexagon
   * @returns {THREE.BufferGeometry} - Hexagon geometry
   */
  hexGeometry(height, position) {
    let geo = new THREE.CylinderGeometry(1, 1, height, 6, 1, false);
    geo.translate(position.x, height * 0.5, position.y);
    return geo;
  }

  /**
   * Create a hexagon and add it to the appropriate geometry container
   * @param {number} height - Height of the hexagon
   * @param {THREE.Vector2} position - Position of the hexagon
   * @param {number} tileX - X tile coordinate
   * @param {number} tileY - Y tile coordinate
   */
  makeHex(height, position, tileX, tileY) {
    let geo = this.hexGeometry(height, position);
    let tileType = '';
    
    if (height > this.STONE_HEIGHT) {
      this.stoneGeo = BufferGeometryUtils.mergeGeometries([this.stoneGeo, geo]);
      if (Math.random() > 0.8) {
        this.stoneGeo = BufferGeometryUtils.mergeGeometries([this.stoneGeo, this.stone(height, position)]);
      }
      tileType = 'stone';
    } else if (height > this.DIRT_HEIGHT) {
      this.dirtGeo = BufferGeometryUtils.mergeGeometries([this.dirtGeo, geo]);
      tileType = 'dirt';
    } else if (height > this.GRASS_HEIGHT) {
      this.grassGeo = BufferGeometryUtils.mergeGeometries([this.grassGeo, geo]);
      if (Math.random() > 0.8) {
        this.grassGeo = BufferGeometryUtils.mergeGeometries([this.grassGeo, this.tree(height, position)]);
        tileType = 'grass_with_tree'; // Mark tiles with trees as non-walkable
      } else {
        tileType = 'grass';
      }
    } else if (height > this.SAND_HEIGHT) {
      this.sandGeo = BufferGeometryUtils.mergeGeometries([geo, this.sandGeo]);
      if (Math.random() > 0.8) {
        this.stoneGeo = BufferGeometryUtils.mergeGeometries([this.stoneGeo, this.stone(height, position)]);
        tileType = 'sand_with_stone'; // Still tracked as sand_with_stone but now walkable
      } else {
        tileType = 'sand';
      }
    } else if (height > this.DIRT2_HEIGHT) {
      this.dirt2Geo = BufferGeometryUtils.mergeGeometries([this.dirt2Geo, geo]);
      tileType = 'dirt2';
    }
    
    // Store the tile type for this position
    const posKey = `${tileX},${tileY}`;
    this.tileTypes.set(posKey, { 
      type: tileType, 
      height: height, 
      position: new THREE.Vector3(position.x, height, position.y) 
    });
  }

  /**
   * Create a mesh from a geometry and texture
   * @param {THREE.BufferGeometry} geo - Geometry to use
   * @param {THREE.Texture} map - Texture to apply
   * @returns {THREE.Mesh} - Resulting mesh
   */
  hexMesh(geo, map) {
    let mat = new THREE.MeshPhysicalMaterial({
      map: map,
      envMap: this.envMap,
      envMapIntensity: 0.135,
      flatShading: true,
      roughness: 0.8,
    });
    
    let mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }

  /**
   * Create a stone object
   * @param {number} height - Base height
   * @param {THREE.Vector2} position - Position
   * @returns {THREE.BufferGeometry} - Stone geometry
   */
  stone(height, position) {
    const px = position.x + (Math.random() * 0.4 - 0.2);
    const pz = position.y + (Math.random() * 0.4 - 0.2);
    
    const geometry = new THREE.SphereGeometry(Math.random() * 0.3 + 0.1, 7, 7);
    geometry.translate(px, height + 0.15, pz);
    
    return geometry;
  }

  /**
   * Create a tree object
   * @param {number} height - Base height
   * @param {THREE.Vector2} position - Position
   * @returns {THREE.BufferGeometry} - Tree geometry
   */
  tree(height, position) {
    const treeHeight = Math.random() * 0.5 + 0.5;
    const px = position.x + (Math.random() * 0.4 - 0.2);
    const pz = position.y + (Math.random() * 0.4 - 0.2);
    
    // Tree trunk
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.1, treeHeight, 5);
    trunkGeo.translate(px, height + treeHeight * 0.5, pz);
    
    // Tree top
    const topGeo = new THREE.ConeGeometry(0.3, treeHeight * 0.6, 5);
    topGeo.translate(px, height + treeHeight + treeHeight * 0.3, pz);
    
    // Merge trunk and top
    return BufferGeometryUtils.mergeGeometries([trunkGeo, topGeo]);
  }

  /**
   * Create water for the map boundary
   */
  createWater() {
    const waterColor = new THREE.Color("#55aaff");
    waterColor.multiplyScalar(3);
    
    const waterMaterial = new THREE.MeshPhysicalMaterial({
      color: waterColor,
      roughness: 1,
      metalness: 0.025,
      ior: 1.4,
      transmission: 1,
      transparent: true,
      thickness: 1.5,
      roughnessMap: this.textures.water,
      metalnessMap: this.textures.water,
      envMap: this.envMap,
      envMapIntensity: 0.2,
    });
    
    const waterMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(this.mapRadius, this.mapRadius, this.MAX_HEIGHT * 0.2, 50),
      waterMaterial
    );
    
    waterMesh.receiveShadow = true;
    waterMesh.position.set(0, this.MAX_HEIGHT * 0.1, 0);
    renderer.addObject('waterMesh', waterMesh);
    this.objects.push(waterMesh);
  }

  /**
   * Create container for the map
   */
  createMapContainer() {
    // Map container (cylinder walls)
    const containerMaterial = new THREE.MeshPhysicalMaterial({
      map: this.textures.dirt,
      side: THREE.DoubleSide,
      roughness: 0.8,
      envMap: this.envMap,
      envMapIntensity: 0.2,
    });
    
    const mapContainer = new THREE.Mesh(
      new THREE.CylinderGeometry(this.mapRadius + 0.1, this.mapRadius + 0.1, this.MAX_HEIGHT * 0.25, 50, 1, true),
      containerMaterial
    );
    
    mapContainer.receiveShadow = true;
    mapContainer.position.set(0, this.MAX_HEIGHT * 0.125, 0);
    renderer.addObject('mapContainer', mapContainer);
    this.objects.push(mapContainer);
    
    // Map floor
    const floorMaterial = new THREE.MeshPhysicalMaterial({
      map: this.textures.dirt2,
      roughness: 0.9,
      envMap: this.envMap,
      envMapIntensity: 0.1,
    });
    
    const mapFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(this.mapRadius + 2.5, this.mapRadius + 2.5, this.MAX_HEIGHT * 0.1, 50),
      floorMaterial
    );
    
    mapFloor.receiveShadow = true;
    mapFloor.position.set(0, -this.MAX_HEIGHT * 0.05, 0);
    renderer.addObject('mapFloor', mapFloor);
    this.objects.push(mapFloor);
  }

  /**
   * Create clouds above the map
   */
  createClouds() {
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      roughness: 1,
      envMap: this.envMap,
      envMapIntensity: 0.1,
    });
    
    // Create several clouds at different positions
    for (let i = 0; i < 20; i++) {
      const cloudGroup = new THREE.Group();
      
      // Random position within map bounds
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * this.mapRadius * 0.8;
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius;
      const py = this.MAX_HEIGHT * 5 + Math.random() * this.MAX_HEIGHT * 2;
      
      // Create 3-5 spheres for each cloud
      const numSpheres = Math.floor(Math.random() * 3) + 3;
      
      for (let j = 0; j < numSpheres; j++) {
        const size = Math.random() * 1.5 + 0.5;
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(size, 7, 7),
          cloudMaterial
        );
        
        // Position sphere relative to cloud center
        sphere.position.set(
          Math.random() * 2 - 1,
          Math.random() * 0.3,
          Math.random() * 2 - 1
        );
        
        cloudGroup.add(sphere);
      }
      
      // Position the cloud group
      cloudGroup.position.set(px, py, pz);
      
      renderer.addObject(`cloud_${i}`, cloudGroup);
      this.objects.push(cloudGroup);
    }
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
      const spotlight = new THREE.SpotLight(new THREE.Color("#FFCB8E"), 0.8);
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
    const ambientLight = new THREE.AmbientLight(new THREE.Color("#404080"), 0.3);
    renderer.addObject('tournamentAmbient', ambientLight);
    this.objects.push(ambientLight);
  }

  /**
   * Create physics representation of the terrain using Rapier
   */
  createPhysicsTerrain() {
    if (!window.RAPIER) {
      console.warn('[TOURNAMENT MAP] Rapier physics not available, skipping physics terrain');
      
      // Listen for physics initialized event and try again
      eventBus.once('physics.initialized', () => {
        console.log('[TOURNAMENT MAP] Physics now available, creating terrain physics');
        this.createPhysicsTerrain();
      });
      
      return;
    }
    
    const RAPIER = window.RAPIER;
    const world = window.physicsWorld; // Assuming you have a physics world accessible
    
    if (!world) {
      console.warn('[TOURNAMENT MAP] Physics world not available, skipping physics terrain');
      
      // Listen for physics initialized event and try again
      eventBus.once('physics.initialized', () => {
        console.log('[TOURNAMENT MAP] Physics world now available, creating terrain physics');
        this.createPhysicsTerrain();
      });
      
      return;
    }
    
    console.log('[TOURNAMENT MAP] Creating hex-based physics terrain...');
    
    // Create a static rigid body to hold all our tile colliders
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const groundBody = world.createRigidBody(groundBodyDesc);
    
    // Track all created colliders for debugging
    const hexColliders = [];
    let colliderCount = 0;
    
    // Iterate through all the stored tile types and create colliders for each
    this.tileTypes.forEach((tileInfo, posKey) => {
      // Skip tiles that are below water or have obstacles
      if (tileInfo.height <= this.WATER_HEIGHT || this.obstacleTypes.includes(tileInfo.type)) {
        return;
      }
      
      const position = tileInfo.position;
      
      // Create a cylinder collider for this hex tile
      // Use radius of 1 to match the hex tiles (same as in hexGeometry)
      // Height should match the tile's height
      const hexCollider = RAPIER.ColliderDesc.cylinder(tileInfo.height / 2, 1.0);
      
      // Position the collider at the tile's position
      // Collider's y position should be at half height (center of cylinder)
      hexCollider.setTranslation(
        position.x,
        tileInfo.height / 2,
        position.z
      );
      
      // Add the collider to the ground body
      const colliderHandle = world.createCollider(hexCollider, groundBody.handle);
      hexColliders.push({
        handle: colliderHandle,
        position: position,
        height: tileInfo.height,
        type: tileInfo.type
      });
      
      colliderCount++;
    });
    
    // 2. Create a cylinder wall for the circular boundary (keep this from the previous implementation)
    const wallHeight = this.wallHeight || 3; // Use map's wall height or default to 3
    const wallThickness = this.wallThickness || 0.5; // Use map's wall thickness or default to 0.5
    
    // Create a cylinder collider that matches the map radius
    const wallCollider = RAPIER.ColliderDesc.cylinder(wallHeight / 2, this.mapRadius);
    
    // Position the wall to sit at the edge of the map with its bottom at ground level
    wallCollider.setTranslation(0, wallHeight / 2, 0);
    
    // Add the wall collider to the same rigid body
    const wallColliderHandle = world.createCollider(wallCollider, groundBody.handle);
    
    // Store reference to the physics body
    this.terrainBody = groundBody;
    
    // Create visual representation of the hex colliders for debugging
    this.createHexPhysicsVisualization(hexColliders);
    
    // Also create a visualization for the wall collider
    this.createWallColliderVisualization(this.mapRadius, wallHeight, wallThickness);
    
    console.log(`[TOURNAMENT MAP] Physics terrain created with ${colliderCount} hex colliders and circular boundary`);
  }

  /**
   * Create visualization for the hex-based physics terrain
   * @param {Array} hexColliders - Array of hex collider information
   */
  createHexPhysicsVisualization(hexColliders) {
    if (!window.renderer) {
      console.error('[TOURNAMENT MAP] Cannot create hex physics visualization - renderer not available');
      return;
    }

    // Create a group to hold all hex debug geometries
    const hexGroup = new THREE.Group();
    hexGroup.name = 'physicsHexGroup';
    
    // Iterate through all hex colliders and create visual representation
    hexColliders.forEach((collider, index) => {
      // Create a cylinder geometry for each hex
      const hexGeometry = new THREE.CylinderGeometry(
        1.0,        // top radius
        1.0,        // bottom radius
        collider.height, // height
        6,          // radial segments (6 for hexagon)
        1,          // height segments
        false       // open ended
      );
      
      // Create a material based on tile type for better visualization
      let color;
      switch (collider.type) {
        case 'stone': color = 0x888888; break;
        case 'dirt': color = 0xA0522D; break;
        case 'grass': color = 0x88FF88; break;
        case 'sand': color = 0xF0E68C; break;
        case 'dirt2': color = 0x8B4513; break;
        default: color = 0xFF00FF; break;
      }
      
      const material = new THREE.MeshBasicMaterial({
        color: color,
        wireframe: true,
        transparent: true,
        opacity: 0.6
      });
      
      // Create the mesh
      const hexMesh = new THREE.Mesh(hexGeometry, material);
      
      // Position at the collider's position, with slight Y offset for visibility
      hexMesh.position.set(
        collider.position.x,
        collider.position.y + 0.1, // 0.1 above actual terrain
        collider.position.z
      );
      
      // Add to the group
      hexGroup.add(hexMesh);
    });
    
    // Add the group to the scene
    window.renderer.addObject('physicsHexGroup', hexGroup);
    this.objects.push(hexGroup);
    
    // Create an overall red wireframe cylinder to show the walkable area boundary
    const boundaryGeometry = new THREE.CylinderGeometry(
      this.mapRadius - 0.2, // slightly smaller to avoid z-fighting
      this.mapRadius - 0.2,
      0.1, // very thin
      32,  // circular, not hexagonal
      1,
      true // open ended
    );
    
    const boundaryMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: false
    });
    
    const boundaryMesh = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    boundaryMesh.position.y = 0.05; // Just above ground
    boundaryMesh.name = 'physicsBoundaryMesh';
    
    window.renderer.addObject('physicsBoundaryMesh', boundaryMesh);
    this.objects.push(boundaryMesh);
    
    console.log('[TOURNAMENT MAP] Hex physics debug visualization created');
  }

  /**
   * Create visualization for the wall collider
   * @param {number} radius - Radius of the wall
   * @param {number} height - Height of the wall
   * @param {number} thickness - Thickness of the wall
   */
  createWallColliderVisualization(radius, height, thickness) {
    if (!window.renderer) {
      console.error('[TOURNAMENT MAP] Cannot create wall collider visualization - renderer not available');
      return;
    }
    
    // Create a cylinder geometry for the wall visualization
    // Use a slightly larger radius for the outer wall to make it visible
    const outerRadius = radius + thickness/2;
    const innerRadius = radius - thickness/2;
    
    // Create a cylinder for the outer wall
    const wallGeometry = new THREE.CylinderGeometry(
      outerRadius, // top radius
      outerRadius, // bottom radius
      height,      // height
      32,          // radial segments
      1,           // height segments
      true         // open-ended
    );
    
    // Create a bright green material for the wall visualization
    const wallMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,  // Bright green
      wireframe: true,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    
    // Create the mesh
    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
    wallMesh.name = 'physicsWallMesh';
    
    // Position it at the correct height (half height from ground)
    wallMesh.position.y = height / 2;
    
    // Add to scene
    window.renderer.addObject('physicsWallMesh', wallMesh);
    
    // Store for cleanup
    this.objects.push(wallMesh);
    
    console.log('[TOURNAMENT MAP] Physics wall collider visualization created - GREEN CYLINDER');
  }

  /**
   * Toggle the visibility of the physics debug visualization
   * @param {boolean} visible - Whether the physics debug visualization should be visible
   */
  togglePhysicsDebug(visible) {
    // Fix for the getObjectByName error
    try {
      // First try direct scene access if available
      if (window.renderer && window.renderer.scene) {
        const hexGroup = window.renderer.scene.getObjectByName('physicsHexGroup');
        const boundaryMesh = window.renderer.scene.getObjectByName('physicsBoundaryMesh');
        const wallMesh = window.renderer.scene.getObjectByName('physicsWallMesh');
        
        if (hexGroup) {
          hexGroup.visible = visible;
          console.log(`[TOURNAMENT MAP] Physics hex group visibility set to ${visible}`);
        }
        
        if (boundaryMesh) {
          boundaryMesh.visible = visible;
          console.log(`[TOURNAMENT MAP] Physics boundary visibility set to ${visible}`);
        }
        
        if (wallMesh) {
          wallMesh.visible = visible;
          console.log(`[TOURNAMENT MAP] Physics wall visibility set to ${visible}`);
        }
      } else {
        // Fallback to direct object references
        // This assumes these objects are stored in this.objects array
        this.objects.forEach(obj => {
          if (obj.name === 'physicsHexGroup' || 
              obj.name === 'physicsBoundaryMesh' || 
              obj.name === 'physicsWallMesh') {
            obj.visible = visible;
            console.log(`[TOURNAMENT MAP] Set ${obj.name} visibility to ${visible}`);
          }
        });
      }
      
      console.log(`[TOURNAMENT MAP] Physics debug visualization ${visible ? 'shown' : 'hidden'}`);
    } catch (error) {
      console.error('[TOURNAMENT MAP] Error toggling physics debug:', error);
    }
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
    // Remove all objects from the scene
    this.objects.forEach((obj, index) => {
      if (obj instanceof THREE.Mesh) {
        renderer.removeObject(obj.name || `object_${index}`);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      } else if (obj instanceof THREE.Group) {
        renderer.removeObject(`group_${index}`);
        obj.children.forEach(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        });
      } else if (obj instanceof THREE.Light) {
        renderer.removeObject(`light_${index}`);
        if (obj.target) renderer.removeObject(`light_target_${index}`);
      }
    });
    
    // Remove specific named objects
    renderer.removeObject('stoneMesh');
    renderer.removeObject('grassMesh');
    renderer.removeObject('dirt2Mesh');
    renderer.removeObject('dirtMesh');
    renderer.removeObject('sandMesh');
    renderer.removeObject('waterMesh');
    renderer.removeObject('mapContainer');
    renderer.removeObject('mapFloor');
    renderer.removeObject('tournamentAmbient');
    
    // Remove physics debug visualization
    renderer.removeObject('physicsHexGroup');
    renderer.removeObject('physicsBoundaryMesh');
    renderer.removeObject('physicsWallMesh');
    
    // Clear arrays
    this.walls = [];
    this.obstacles = [];
    this.objects = [];
    
    // Dispose of geometries
    if (this.stoneGeo) this.stoneGeo.dispose();
    if (this.dirtGeo) this.dirtGeo.dispose();
    if (this.dirt2Geo) this.dirt2Geo.dispose();
    if (this.sandGeo) this.sandGeo.dispose();
    if (this.grassGeo) this.grassGeo.dispose();
    if (this.treeGeo) this.treeGeo.dispose();
    
    // Dispose of environment map
    if (this.envMap) this.envMap.dispose();
    
    // Clean up physics
    if (this.terrainBody && window.physicsWorld) {
      window.physicsWorld.removeRigidBody(this.terrainBody);
      this.terrainBody = null;
    }
    
    // Clear references
    this.stoneGeo = null;
    this.dirtGeo = null;
    this.dirt2Geo = null;
    this.sandGeo = null;
    this.grassGeo = null;
    this.treeGeo = null;
    this.ground = null;
    this.envMap = null;
  }

  /**
   * Get the map center position for camera positioning
   * @returns {THREE.Vector3} - Center position
   */
  getMapCenter() {
    return new THREE.Vector3(0, 0, 0);
  }

  /**
   * Get the map radius for camera bounds
   * @returns {number} - Map radius
   */
  getMapRadius() {
    return this.mapRadius;
  }

  /**
   * Get the map height for camera positioning
   * @returns {number} - Map height
   */
  getMapHeight() {
    return this.MAX_HEIGHT;
  }

  /**
   * Check if a position is on a walkable tile
   * @param {THREE.Vector3} position - The position to check
   * @returns {boolean} - Whether the position is walkable
   */
  isWalkable(position) {
    // Validate input
    if (!position || typeof position.x !== 'number' || typeof position.z !== 'number') {
      console.warn('[MAP] Invalid position in isWalkable check');
      return false;
    }
    
    // First check if position is within map radius
    const posXZ = new THREE.Vector2(position.x, position.z);
    const distanceFromCenter = posXZ.length();
    
    if (distanceFromCenter > this.mapRadius) {
      // Outside map boundary
      if (Math.random() < 0.01) { // Throttle logging
        console.log(`[MAP] Position (${position.x.toFixed(2)}, ${position.z.toFixed(2)}) outside map radius: ${distanceFromCenter.toFixed(2)} > ${this.mapRadius}`);
      }
      return false;
    }
    
    // Convert world position to nearest tile coordinates
    const tileCoords = this.worldToTile(position);
    const posKey = `${tileCoords.x},${tileCoords.y}`;
    
    // Check if we have tile type information for this position
    if (this.tileTypes.has(posKey)) {
      const tileInfo = this.tileTypes.get(posKey);
      
      // First check if the tile is above water height
      if (tileInfo.height <= this.WATER_HEIGHT) {
        if (Math.random() < 0.01) { // Throttle logging
          console.log(`[MAP] Position (${position.x.toFixed(2)}, ${position.z.toFixed(2)}) below water height: ${tileInfo.height.toFixed(2)} <= ${this.WATER_HEIGHT}`);
        }
        return false; // Below water level, not walkable
      }
      
      // Then check if the tile has an obstacle
      if (this.obstacleTypes.includes(tileInfo.type)) {
        if (Math.random() < 0.01) { // Throttle logging
          console.log(`[MAP] Position (${position.x.toFixed(2)}, ${position.z.toFixed(2)}) has obstacle: ${tileInfo.type}`);
        }
        return false; // Has obstacle, not walkable
      }
      
      // Above water and no obstacles, so it's walkable
      return true;
    } else {
      // If we don't have specific tile info but we're within the map,
      // assume it's walkable as a fallback
      if (distanceFromCenter < this.mapRadius * 0.95) {
        // Inside map bounds but no tile data - assume walkable
        if (Math.random() < 0.01) { // Throttle logging 
          console.log(`[MAP] Position (${position.x.toFixed(2)}, ${position.z.toFixed(2)}) has no tile data but within map - assuming walkable`);
        }
        return true;
      }
    }
  }

  /**
   * Get a random walkable spawn position within the map
   * @returns {THREE.Vector3} - Spawn position
   */
  getRandomSpawnPosition() {
    // Try to find a walkable position
    for (let attempts = 0; attempts < 100; attempts++) {
      // Get a random angle and distance from center (not too close to edge)
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * (this.mapRadius * 0.7);
      
      // Convert to cartesian coordinates
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      
      // Create position vector
      const position = new THREE.Vector3(x, 0, z);
      
      // Check if position is walkable
      if (this.isWalkable(position)) {
        // Get the correct height for this position
        const height = this.getHeightAt(position);
        position.y = height + 0.1; // Slightly above ground
        return position;
      }
    }
    
    // Fallback to center position if no walkable position found
    console.warn('[TOURNAMENT MAP] Could not find walkable spawn position after 100 attempts, using center');
    return new THREE.Vector3(0, this.MAX_HEIGHT * 0.5, 0);
  }

  /**
   * Adjust a position to be walkable (for player movement)
   * @param {THREE.Vector3} targetPosition - The desired position
   * @param {THREE.Vector3} currentPosition - The current position
   * @returns {THREE.Vector3} - Adjusted position that is walkable
   */
  adjustToWalkable(targetPosition, currentPosition) {
    // If target is already walkable, return it
    if (this.isWalkable(targetPosition)) {
      // Adjust height to match terrain
      const height = this.getHeightAt(targetPosition);
      return new THREE.Vector3(targetPosition.x, height + 0.1, targetPosition.z);
    }
    
    // If not walkable, find the closest walkable position
    // This is a simple implementation - a more sophisticated approach would use pathfinding
    
    // Direction from current to target
    const direction = new THREE.Vector3()
      .subVectors(targetPosition, currentPosition)
      .normalize();
    
    // Try different distances along this direction
    for (let distance = 0; distance < targetPosition.distanceTo(currentPosition); distance += 0.5) {
      const testPosition = new THREE.Vector3()
        .copy(currentPosition)
        .addScaledVector(direction, distance);
      
      if (this.isWalkable(testPosition)) {
        // Adjust height to match terrain
        const height = this.getHeightAt(testPosition);
        testPosition.y = height + 0.1;
        return testPosition;
      }
    }
    
    // If no walkable position found, return current position
    return currentPosition;
  }

  /**
   * Create debug visualization of walkable tiles
   * Can be called from console for debugging: window.game.currentMap.visualizeWalkableTiles()
   */
  visualizeWalkableTiles() {
    console.log('[MAP] Creating visualization of walkable tiles...');
    
    // Create a group to hold all markers
    const markersGroup = new THREE.Group();
    markersGroup.name = 'walkableTileMarkers';
    
    // Sample a subset of tiles to avoid too many markers
    const samplingRate = 4; // Only visualize every 4th tile
    let walkableCount = 0;
    let nonWalkableCount = 0;
    
    // Iterate through stored tile types
    this.tileTypes.forEach((tileInfo, posKey) => {
      // Only process every nth tile to reduce visual clutter
      if (Math.random() > 1/samplingRate) return;
      
      const position = tileInfo.position;
      
      // Create a marker based on walkability
      const isWalkable = this.isWalkable(position);
      
      // Count walkable vs non-walkable
      if (isWalkable) {
        walkableCount++;
      } else {
        nonWalkableCount++;
      }
      
      // Create a small cylinder as a marker
      const geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8);
      const material = new THREE.MeshBasicMaterial({
        color: isWalkable ? 0x00ff00 : 0xff0000, // Green for walkable, red for non-walkable
        transparent: true,
        opacity: 0.7
      });
      
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(position.x, position.y + 0.5, position.z); // Position just above tile
      
      markersGroup.add(marker);
    });
    
    // Add to scene
    renderer.addObject('walkableTileMarkers', markersGroup);
    
    console.log(`[MAP] Visualization created. Walkable: ${walkableCount}, Non-walkable: ${nonWalkableCount}`);
    console.log('[MAP] To remove visualization, call: window.renderer.removeObject("walkableTileMarkers")');
    
    return markersGroup; // Return for potential further manipulation
  }
  
  /**
   * Test walkability at a specific position
   * Can be called from console for debugging: window.game.currentMap.testWalkable(x, z)
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   */
  testWalkable(x, z) {
    const position = new THREE.Vector3(x, 0, z);
    
    console.log(`[MAP] Testing walkability at (${x}, ${z}):`);
    
    // Check if within map radius
    const posXZ = new THREE.Vector2(x, z);
    const distanceFromCenter = posXZ.length();
    console.log(`  - Distance from center: ${distanceFromCenter.toFixed(2)} (map radius: ${this.mapRadius})`);
    
    if (distanceFromCenter > this.mapRadius) {
      console.log(`  - RESULT: Not walkable - outside map radius`);
      return false;
    }
    
    // Get tile coordinates
    const tileCoords = this.worldToTile(position);
    const posKey = `${tileCoords.x},${tileCoords.y}`;
    console.log(`  - Tile coordinates: (${tileCoords.x}, ${tileCoords.y})`);
    
    // Check if we have tile data
    if (this.tileTypes.has(posKey)) {
      const tileInfo = this.tileTypes.get(posKey);
      console.log(`  - Tile type: ${tileInfo.type}`);
      console.log(`  - Tile height: ${tileInfo.height.toFixed(2)} (water height: ${this.WATER_HEIGHT})`);
      
      // Check water height
      if (tileInfo.height <= this.WATER_HEIGHT) {
        console.log(`  - RESULT: Not walkable - below water level`);
        return false;
      }
      
      // Check for obstacles
      if (this.obstacleTypes.includes(tileInfo.type)) {
        console.log(`  - RESULT: Not walkable - has obstacle (${tileInfo.type})`);
        return false;
      }
      
      // Walkable
      console.log(`  - RESULT: Walkable`);
      return true;
    } else {
      // No tile data
      console.log(`  - No tile data found for this position`);
      
      // Fallback for positions within map
      if (distanceFromCenter < this.mapRadius * 0.95) {
        console.log(`  - RESULT: Walkable (fallback: well within map bounds)`);
        return true;
      } else {
        console.log(`  - RESULT: Not walkable (too close to edge with no tile data)`);
        return false;
      }
    }
  }

  /**
   * Get the height at a specific world position
   * @param {THREE.Vector3} position - World position
   * @returns {number} - Height at the position
   */
  getHeightAt(position) {
    // This method is used by other components, so we keep it for compatibility
    // It now simply calls our more robust getHeightAtPosition method
    return this.getHeightAtPosition(position);
  }

  /**
   * Get the height at a specific world position
   * This is a more robust method for finding the terrain height
   * @param {THREE.Vector3} worldPos - World position to check
   * @returns {number} - Height at the position
   */
  getHeightAtPosition(worldPos) {
    // Convert to tile coordinates
    const tileCoords = this.worldToTile(worldPos);
    
    // Check direct match first
    const exactPosKey = `${Math.round(tileCoords.x)},${Math.round(tileCoords.y)}`;
    if (this.tileTypes.has(exactPosKey)) {
      return this.tileTypes.get(exactPosKey).height;
    }
    
    // If no direct hit, interpolate from surrounding tiles
    return this.interpolateHeight(worldPos.x, worldPos.z);
  }

  /**
   * Convert world position to tile coordinates
   * @param {THREE.Vector3} worldPos - World position
   * @returns {Object} - {x, y} tile coordinates
   */
  worldToTile(worldPos) {
    // Inverse of tileToPosition function
    const y = worldPos.z / 1.535;
    const x = (worldPos.x / 1.77) - ((y % 2) * 0.5);
    return { x, y };
  }

  /**
   * Interpolate height at a position from surrounding tiles
   * @param {number} x - World X coordinate
   * @param {number} z - World Z coordinate
   * @returns {number} - Interpolated height
   */
  interpolateHeight(x, z) {
    // Get the closest tiles and sample their heights
    const position = new THREE.Vector3(x, 0, z);
    
    // Sample a few nearby points
    const sampleRadius = 1.0;
    const samplePoints = 6;
    let totalHeight = 0;
    let sampleCount = 0;
    
    for (let i = 0; i < samplePoints; i++) {
      const angle = (i / samplePoints) * Math.PI * 2;
      const sampleX = x + Math.cos(angle) * sampleRadius;
      const sampleZ = z + Math.sin(angle) * sampleRadius;
      
      const samplePos = new THREE.Vector3(sampleX, 0, sampleZ);
      const tileCoords = this.worldToTile(samplePos);
      const posKey = `${tileCoords.x},${tileCoords.y}`;
      
      if (this.tileTypes.has(posKey)) {
        totalHeight += this.tileTypes.get(posKey).height;
        sampleCount++;
      }
    }
    
    // If we found any samples, return the average
    if (sampleCount > 0) {
      return totalHeight / sampleCount;
    }
    
    // Fallback: use simplex noise to generate a reasonable height
    const noise = (this.noise2D(x * 0.1, z * 0.1) + 1) * 0.5;
    return Math.pow(noise, 2) * this.MAX_HEIGHT;
  }
}

// Create singleton instance
const tournamentMap = new TournamentMap();

export default tournamentMap; 