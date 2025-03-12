import * as THREE from 'three';
import eventBus from './EventBus.js';

/**
 * Renderer - Handles all three.js rendering operations
 * Creates and manages the scene, camera, and renderer
 */
class Renderer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animationId = null;
    this.isInitialized = false;
    this.objects = new Map();
    this.lastTime = null; // For delta time calculation
    this.followTarget = null; // Entity to follow with camera
    this.isFollowingPlayer = false; // Whether camera is in follow mode
    
    // Binding methods
    this.render = this.render.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  /**
   * Initialize the renderer
   * @param {HTMLCanvasElement} canvas - The canvas element to render to
   * @returns {Renderer} - This instance for chaining
   */
  init(canvas) {
    console.log('Initializing renderer');
    
    // Store canvas reference
    this.canvas = canvas;
    
    // Create THREE.js renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    
    // Configure renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Create scene
    this.scene = new THREE.Scene();
    
    // Set up isometric camera
    this.setupIsometricCamera();
    
    // Set up lighting
    this.setupLighting();
    
    // Handle window resize
    window.addEventListener('resize', this.onResize);
    
    // Set up event listeners
    eventBus.on('renderer.addObject', this._handleAddObject.bind(this));
    eventBus.on('renderer.removeObject', this._handleRemoveObject.bind(this));
    
    // Expose renderer to window for debugging
    if (typeof window !== 'undefined') {
      window.renderer = this;
      console.log('[RENDERER] Exposed renderer to window.renderer for debugging');
      
      // Make camera globally available for raycasting
      window.currentCamera = this.camera;
      console.log('[RENDERER] Exposed camera to window.currentCamera for raycasting');
    }
    
    // Set initialization flag
    this.isInitialized = true;
    
    console.log('Renderer initialized successfully');
    return this;
  }

  /**
   * Set up the isometric camera
   */
  setupIsometricCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const viewSize = 10;
    
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect, // left
      viewSize * aspect,  // right
      viewSize,           // top
      -viewSize,          // bottom
      0.1,                // near
      1000                // far
    );
    
    // Set isometric angle (45 degrees rotated, 35.264 degrees from horizontal)
    this.updateCameraPosition();
  }

  /**
   * Set up scene lighting
   */
  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Directional light with shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    this.scene.add(directionalLight);
  }

  /**
   * Update camera position for isometric view
   * @param {Object} offset - Optional camera offset (x, y)
   * @param {boolean} smooth - Whether to use smooth interpolation
   */
  updateCameraPosition(offset = { x: 0, y: 0 }, smooth = true) {
    // Classic isometric angle
    const isometricAngle = Math.PI / 4; // 45 degrees
    const elevationAngle = Math.atan(1 / Math.sqrt(2)); // ~35.264 degrees
    const distance = 20;
    
    // For a Diablo-style camera:
    // 1. Keep the camera at a fixed isometric angle
    // 2. Move the camera position to follow the player
    // 3. Always look at the player's position to keep them centered
    
    // Calculate camera position based on isometric angle and distance
    const cameraOffsetX = distance * Math.cos(isometricAngle);
    const cameraOffsetZ = distance * Math.sin(isometricAngle);
    const cameraOffsetY = distance * Math.sin(elevationAngle);
    
    // Target camera position (player position + fixed offset)
    const targetX = offset.x + cameraOffsetX;
    const targetZ = offset.y + cameraOffsetZ;
    const targetY = cameraOffsetY; // Keep Y at a fixed height
    
    // If smooth interpolation is enabled and we're following the player
    if (smooth && this.isFollowingPlayer && this.camera.position.x !== undefined) {
      // Interpolation factor (0.1 gives a nice smooth follow without being too slow)
      const lerpFactor = 0.1;
      
      // Interpolate camera position
      this.camera.position.x += (targetX - this.camera.position.x) * lerpFactor;
      this.camera.position.z += (targetZ - this.camera.position.z) * lerpFactor;
      this.camera.position.y += (targetY - this.camera.position.y) * lerpFactor;
    } else {
      // Immediate positioning if not smooth or first positioning
      this.camera.position.x = targetX;
      this.camera.position.z = targetZ;
      this.camera.position.y = targetY;
    }
    
    // Always look at the player's position to keep them centered
    const lookTarget = new THREE.Vector3(offset.x, 0, offset.y);
    this.camera.lookAt(lookTarget);
    
    // Emit camera update event
    eventBus.emit('camera.updated', {
      position: this.camera.position.clone(),
      target: lookTarget
    });
  }

  /**
   * Add an object to the scene
   * @param {string} id - Unique ID for the object
   * @param {THREE.Object3D} object - Any THREE.js object
   * @param {boolean} temporary - Whether the object is temporary
   * @param {number} duration - Duration in seconds to keep temporary object
   */
  addObject(id, object, temporary = false, duration = 0) {
    if (this.objects.has(id)) {
      console.warn(`Object with ID ${id} already exists. Replacing.`);
      this.removeObject(id);
    }
    
    this.scene.add(object);
    this.objects.set(id, object);
    
    eventBus.emit('renderer.objectAdded', { id, object });
    
    // Handle temporary objects
    if (temporary && duration > 0) {
      setTimeout(() => {
        this.removeObject(id);
      }, duration * 1000);
    }
  }

  /**
   * Remove an object from the scene
   * @param {string} id - ID of the object to remove
   * @returns {boolean} - Whether the object was removed
   */
  removeObject(id) {
    const object = this.objects.get(id);
    if (!object) return false;
    
    this.scene.remove(object);
    this.objects.delete(id);
    
    eventBus.emit('renderer.objectRemoved', { id });
    return true;
  }

  /**
   * Get an object by ID
   * @param {string} id - ID of the object
   * @returns {THREE.Object3D|null} - The object or null if not found
   */
  getObject(id) {
    return this.objects.get(id) || null;
  }

  /**
   * Set the camera to follow a target entity (Diablo-style)
   * @param {Entity} target - The entity to follow, typically the player
   * @param {boolean} follow - Whether to enable follow mode
   */
  setFollowTarget(target, follow = true) {
    this.followTarget = target;
    this.isFollowingPlayer = follow;
    
    // Emit event for other systems to react
    eventBus.emit('camera.followModeChanged', { 
      isFollowing: follow, 
      target: target ? target.id : null
    });
    
    return this;
  }

  /**
   * Start the render loop
   */
  startRendering() {
    if (!this.isInitialized) {
      console.error('Renderer not initialized. Call init() first.');
      return;
    }
    
    // Make camera globally available for raycasting (ensure it's set)
    if (typeof window !== 'undefined' && this.camera) {
      window.currentCamera = this.camera;
      console.log('[RENDERER] Ensuring camera is exposed for raycasting');
    } else if (!this.camera) {
      console.error('[RENDERER] No camera available for raycasting');
      return;
    }
    
    if (this.animationId === null) {
      this.render();
    }
  }

  /**
   * Stop the render loop
   */
  stopRendering() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
      this.lastTime = null; // Reset time tracking
    }
  }

  /**
   * Render loop
   */
  render(timestamp) {
    this.animationId = requestAnimationFrame(this.render);
    
    // Calculate delta time (time since last frame in seconds)
    const now = timestamp || performance.now();
    const deltaTime = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;
    
    // Update camera position if following a target
    if (this.isFollowingPlayer && this.followTarget) {
      const target = this.followTarget.position;
      this.updateCameraPosition({ x: target.x, y: target.z }, true);
    }
    
    // Emit before render event for other systems to update
    eventBus.emit('renderer.beforeRender', { deltaTime, renderer: this });
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
    
    // Emit after render event
    eventBus.emit('renderer.afterRender', { renderer: this });
  }

  /**
   * Handle window resize
   */
  onResize() {
    if (!this.isInitialized) return;
    
    const aspect = window.innerWidth / window.innerHeight;
    const viewSize = 10;
    
    // Update camera
    this.camera.left = -viewSize * aspect;
    this.camera.right = viewSize * aspect;
    this.camera.top = viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();
    
    // Update renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Emit resize event
    eventBus.emit('renderer.resized', {
      width: window.innerWidth,
      height: window.innerHeight,
      aspect
    });
  }

  /**
   * Handle add object event
   * @param {Object} data - Event data
   * @private
   */
  _handleAddObject(data) {
    if (data && data.id && data.object) {
      this.addObject(data.id, data.object, data.temporary, data.duration);
    }
  }

  /**
   * Handle remove object event
   * @param {Object} data - Event data
   * @private
   */
  _handleRemoveObject(data) {
    if (data && data.id) {
      this.removeObject(data.id);
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Stop rendering
    this.stopRendering();
    
    // Remove event listeners
    window.removeEventListener('resize', this.onResize);
    eventBus.off('renderer.addObject');
    eventBus.off('renderer.removeObject');
    
    // Clean up objects
    this.objects.forEach((object, id) => {
      this.scene.remove(object);
      
      // Dispose of geometries and materials
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    
    this.objects.clear();
    
    // Clean up renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    
    // Clean up scene
    this.scene = null;
    this.camera = null;
    
    this.isInitialized = false;
  }
}

// Create singleton instance
const renderer = new Renderer();

export default renderer;