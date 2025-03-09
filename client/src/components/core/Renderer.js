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
    
    // Binding methods
    this.render = this.render.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  /**
   * Initialize the renderer
   * @param {HTMLCanvasElement} canvas - Canvas element to render on
   * @returns {Renderer} - This instance for chaining
   */
  init(canvas) {
    if (this.isInitialized) return this;
    
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue background
    
    // Create camera (default to orthographic for isometric view)
    this.setupIsometricCamera();
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add window resize handler
    window.addEventListener('resize', this.onResize);
    
    // Set up basic lighting
    this.setupLighting();
    
    // Set initialization flag
    this.isInitialized = true;
    
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
   */
  updateCameraPosition(offset = { x: 0, y: 0 }) {
    // Classic isometric angle
    const isometricAngle = Math.PI / 4; // 45 degrees
    const elevationAngle = Math.atan(1 / Math.sqrt(2)); // ~35.264 degrees
    const distance = 20;
    
    // Calculate position based on angles and offset
    this.camera.position.x = distance * Math.cos(isometricAngle) + offset.x;
    this.camera.position.z = distance * Math.sin(isometricAngle) + offset.y;
    this.camera.position.y = distance * Math.sin(elevationAngle);
    
    // Update camera target
    const target = new THREE.Vector3(offset.x, 0, offset.y);
    this.camera.lookAt(target);
    
    // Emit camera update event
    eventBus.emit('camera.updated', {
      position: this.camera.position.clone(),
      target
    });
  }

  /**
   * Add an object to the scene
   * @param {string} id - Unique ID for the object
   * @param {THREE.Object3D} object - Any THREE.js object
   */
  addObject(id, object) {
    if (this.objects.has(id)) {
      console.warn(`Object with ID ${id} already exists. Replacing.`);
      this.removeObject(id);
    }
    
    this.scene.add(object);
    this.objects.set(id, object);
    
    eventBus.emit('renderer.objectAdded', { id, object });
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
   * Start the render loop
   */
  startRendering() {
    if (!this.isInitialized) {
      console.error('Renderer not initialized. Call init() first.');
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
    }
  }

  /**
   * Render loop
   */
  render() {
    this.animationId = requestAnimationFrame(this.render);
    
    // Emit before render event for other systems to update
    eventBus.emit('renderer.beforeRender', { deltaTime: 0, renderer: this });
    
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
    eventBus.emit('renderer.resize', {
      width: window.innerWidth,
      height: window.innerHeight,
      aspect
    });
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stopRendering();
    
    // Remove resize listener
    window.removeEventListener('resize', this.onResize);
    
    // Clear scene
    this.objects.clear();
    while(this.scene.children.length > 0) { 
      this.scene.remove(this.scene.children[0]); 
    }
    
    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    this.isInitialized = false;
  }
}

// Create singleton instance
const renderer = new Renderer();

export default renderer;