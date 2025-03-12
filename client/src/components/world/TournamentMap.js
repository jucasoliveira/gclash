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
    this.MAX_HEIGHT = 4; // Reduced height for flatter terrain
    this.STONE_HEIGHT = this.MAX_HEIGHT * 0.8;
    this.DIRT_HEIGHT = this.MAX_HEIGHT * 0.7;
    this.GRASS_HEIGHT = this.MAX_HEIGHT * 0.5;
    this.SAND_HEIGHT = this.MAX_HEIGHT * 0.3;
    this.DIRT2_HEIGHT = this.MAX_HEIGHT * 0;
    
    // Geometry containers for merging
    this.stoneGeo = new THREE.BoxGeometry(0, 0, 0);
    this.dirtGeo = new THREE.BoxGeometry(0, 0, 0);
    this.dirt2Geo = new THREE.BoxGeometry(0, 0, 0);
    this.sandGeo = new THREE.BoxGeometry(0, 0, 0);
    this.grassGeo = new THREE.BoxGeometry(0, 0, 0);
    this.treeGeo = new THREE.BoxGeometry(0, 0, 0);
    
    // Simplex noise for terrain generation
    this.noise2D = createNoise2D();
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
    
    // Create water for the map boundary
    this.createWater();
    
    // Create map container (cylinder walls)
    this.createMapContainer();
    
    // Add clouds to the scene
    this.createClouds();
    
    // Create spotlights for tournament arena feel
    this.createSpotlights();
    
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
    // Generate hexagons for the map
    for (let i = -40; i < 40; i++) {
      for (let j = -40; j < 40; j++) {
        let position = this.tileToPosition(i, j);
        
        // Only create hexagons within the map radius
        if (position.length() > this.mapRadius) continue;
        
        // Generate height using simplex noise (flatter than the lobby map)
        let noise = (this.noise2D(i * 0.1, j * 0.1) + 1) * 0.5;
        let height = Math.pow(noise, 2) * this.MAX_HEIGHT; // Increased power for flatter terrain
        
        // Create the hexagon
        this.makeHex(height, position);
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
   */
  makeHex(height, position) {
    let geo = this.hexGeometry(height, position);
    
    if (height > this.STONE_HEIGHT) {
      this.stoneGeo = BufferGeometryUtils.mergeGeometries([this.stoneGeo, geo]);
      if (Math.random() > 0.8) {
        this.stoneGeo = BufferGeometryUtils.mergeGeometries([this.stoneGeo, this.stone(height, position)]);
      }
    } else if (height > this.DIRT_HEIGHT) {
      this.dirtGeo = BufferGeometryUtils.mergeGeometries([this.dirtGeo, geo]);
    } else if (height > this.GRASS_HEIGHT) {
      this.grassGeo = BufferGeometryUtils.mergeGeometries([this.grassGeo, geo]);
      if (Math.random() > 0.8) {
        this.grassGeo = BufferGeometryUtils.mergeGeometries([this.grassGeo, this.tree(height, position)]);
      }
    } else if (height > this.SAND_HEIGHT) {
      this.sandGeo = BufferGeometryUtils.mergeGeometries([geo, this.sandGeo]);
      if (Math.random() > 0.8) {
        this.stoneGeo = BufferGeometryUtils.mergeGeometries([this.stoneGeo, this.stone(height, position)]);
      }
    } else if (height > this.DIRT2_HEIGHT) {
      this.dirt2Geo = BufferGeometryUtils.mergeGeometries([this.dirt2Geo, geo]);
    }
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
   * Get a random spawn position within the map
   * @returns {THREE.Vector3} - Spawn position
   */
  getRandomSpawnPosition() {
    // Get a random angle and distance from center (not too close to edge)
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * (this.mapRadius * 0.7);
    
    // Convert to cartesian coordinates
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    
    // Return position slightly above ground
    return new THREE.Vector3(x, this.MAX_HEIGHT * 0.5, z);
  }
}

// Create singleton instance
const tournamentMap = new TournamentMap();

export default tournamentMap; 