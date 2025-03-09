import * as THREE from 'three';
import renderer from '../core/Renderer.js';

/**
 * Grid - Creates and manages the ground grid
 */
class Grid {
  constructor() {
    this.mesh = null;
    this.texture = null;
    this.size = 20;
    this.gridSize = 10;
    this.color = 0x4a7e5c;
    this.lineColor = 0x304e3a;
  }

  /**
   * Initialize the grid
   * @param {Object} options - Configuration options
   * @returns {Grid} - This instance for chaining
   */
  init(options = {}) {
    // Apply options
    if (options.size !== undefined) this.size = options.size;
    if (options.gridSize !== undefined) this.gridSize = options.gridSize;
    if (options.color !== undefined) this.color = options.color;
    if (options.lineColor !== undefined) this.lineColor = options.lineColor;
    
    // Create grid texture
    this.texture = this.createGridTexture();
    
    // Create grid mesh
    this.createGridMesh();
    
    // Add to scene
    renderer.addObject('ground', this.mesh);
    
    return this;
  }

  /**
   * Create a procedural grid texture
   * @param {number} size - Texture size in pixels
   * @param {number} lineWidth - Line width in pixels
   * @returns {THREE.CanvasTexture} - Generated texture
   */
  createGridTexture(size = 512, lineWidth = 2) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = `#${this.color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, size, size);
    
    // Draw grid
    const step = size / this.gridSize;
    ctx.strokeStyle = `#${this.lineColor.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = lineWidth;
    
    // Draw vertical lines
    for (let i = 0; i <= this.gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, size);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let i = 0; i <= this.gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(size, i * step);
      ctx.stroke();
    }
    
    // Create and return the texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(this.size / 2, this.size / 2);
    
    return texture;
  }

  /**
   * Create the grid mesh
   */
  createGridMesh() {
    const geometry = new THREE.PlaneGeometry(this.size, this.size);
    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      side: THREE.DoubleSide
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2; // Rotate to be flat
    this.mesh.receiveShadow = true;
  }

  /**
   * Set grid size
   * @param {number} size - Grid size
   * @returns {Grid} - This instance for chaining
   */
  setSize(size) {
    this.size = size;
    
    // Recreate mesh with new size
    if (this.mesh) {
      renderer.removeObject('ground');
      this.createGridMesh();
      renderer.addObject('ground', this.mesh);
    }
    
    return this;
  }

  /**
   * Set grid color
   * @param {number} color - Grid color (hex)
   * @param {number} lineColor - Grid line color (hex)
   * @returns {Grid} - This instance for chaining
   */
  setColor(color, lineColor) {
    if (color !== undefined) this.color = color;
    if (lineColor !== undefined) this.lineColor = lineColor;
    
    // Recreate texture with new color
    if (this.texture) {
      this.texture = this.createGridTexture();
      
      if (this.mesh && this.mesh.material) {
        this.mesh.material.map = this.texture;
        this.mesh.material.needsUpdate = true;
      }
    }
    
    return this;
  }

  /**
   * Convert world position to grid position
   * @param {THREE.Vector3} worldPosition - Position in world space
   * @returns {Object} - Grid position {x, y} in integers
   */
  worldToGrid(worldPosition) {
    // Calculate grid position based on world position
    const halfSize = this.size / 2;
    const gridX = Math.floor((worldPosition.x + halfSize) / (this.size / this.gridSize));
    const gridY = Math.floor((worldPosition.z + halfSize) / (this.size / this.gridSize));
    
    return { x: gridX, y: gridY };
  }

  /**
   * Convert grid position to world position
   * @param {number} gridX - Grid X position
   * @param {number} gridY - Grid Y position
   * @param {number} height - Optional height (Y position)
   * @returns {THREE.Vector3} - Position in world space
   */
  gridToWorld(gridX, gridY, height = 0) {
    // Calculate world position based on grid position
    const cellSize = this.size / this.gridSize;
    const halfSize = this.size / 2;
    
    const worldX = (gridX * cellSize) - halfSize + (cellSize / 2);
    const worldZ = (gridY * cellSize) - halfSize + (cellSize / 2);
    
    return new THREE.Vector3(worldX, height, worldZ);
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Remove from scene
    renderer.removeObject('ground');
    
    // Dispose resources
    if (this.mesh) {
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) {
        if (this.mesh.material.map) this.mesh.material.map.dispose();
        this.mesh.material.dispose();
      }
    }
    
    this.mesh = null;
    this.texture = null;
  }
}

// Create singleton instance
const grid = new Grid();

export default grid;