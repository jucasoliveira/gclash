/**
 * Debug Helpers for Guild Clash
 * This file contains utility functions to help with debugging the game
 */

// Global debug flags
window.DEBUG = {
  showPhysics: false,
  logMovement: false,
  showColliders: false,
  showPathfinding: false
};

/**
 * Toggle all physics debug visualizations
 * @param {boolean} visible - Whether to show physics debug visualizations
 */
window.toggleAllPhysicsDebug = function(visible) {
  console.log(`[DEBUG] Setting all physics debug visualizations to ${visible ? 'VISIBLE' : 'HIDDEN'}`);
  
  // Set global debug flag
  window.DEBUG.showPhysics = visible;
  
  // Toggle player physics debug if available
  if (typeof window.togglePlayerPhysicsDebug === 'function') {
    window.togglePlayerPhysicsDebug(visible);
    console.log('[DEBUG] Player physics debug toggled');
  } else {
    console.warn('[DEBUG] Player physics debug function not available');
  }
  
  // Toggle terrain physics debug if available
  if (window.game && window.game.currentMap && typeof window.game.currentMap.togglePhysicsDebug === 'function') {
    window.game.currentMap.togglePhysicsDebug(visible);
    console.log('[DEBUG] Map physics debug toggled');
  } else {
    console.warn('[DEBUG] Map physics debug function not available');
  }
  
  // Toggle any other physics debug visualizations
  if (window.physicsWorld && window.physicsWorld.debugRender) {
    window.physicsWorld.debugRender.visible = visible;
    console.log('[DEBUG] Physics world debug render toggled');
  }
  
  return `Physics debug visualizations ${visible ? 'enabled' : 'disabled'}`;
};

/**
 * Toggle movement logging
 * @param {boolean} enabled - Whether to log movement details
 */
window.toggleMovementLogging = function(enabled) {
  window.DEBUG.logMovement = enabled;
  console.log(`[DEBUG] Movement logging ${enabled ? 'enabled' : 'disabled'}`);
  return `Movement logging ${enabled ? 'enabled' : 'disabled'}`;
};

/**
 * Force player to move to a specific position
 * @param {number} x - X coordinate
 * @param {number} z - Z coordinate
 */
window.movePlayerTo = function(x, z) {
  if (!window.game || !window.game.player) {
    console.error('[DEBUG] Cannot move player - player not available');
    return 'Player not available';
  }
  
  const player = window.game.player;
  console.log(`[DEBUG] Forcing player to move to (${x}, ${z})`);
  
  // Simulate a click at the given position
  player._handleMove({ x, z });
  
  return `Moving player to (${x}, ${z})`;
};

/**
 * Print player status information
 */
window.getPlayerStatus = function() {
  if (!window.game || !window.game.player) {
    console.error('[DEBUG] Cannot get player status - player not available');
    return 'Player not available';
  }
  
  const player = window.game.player;
  const status = {
    position: player.position ? { 
      x: player.position.x.toFixed(2), 
      y: player.position.y.toFixed(2), 
      z: player.position.z.toFixed(2) 
    } : 'N/A',
    isMoving: player.isMoving,
    targetPosition: player.targetPosition ? { 
      x: player.targetPosition.x.toFixed(2), 
      y: player.targetPosition.y.toFixed(2), 
      z: player.targetPosition.z.toFixed(2) 
    } : 'N/A',
    animation: player.animation,
    health: `${player.health}/${player.stats.health}`,
    hasPhysicsBody: !!player.physicsBody,
    hasMesh: !!player.mesh,
    hasMixer: !!player.mixer
  };
  
  console.table(status);
  return 'Player status printed to console';
};

/**
 * Initialize debug helpers
 * This function is called automatically when this file is loaded
 */
function initDebugHelpers() {
  console.log('[DEBUG] Debug helpers initialized');
  console.log('[DEBUG] Available commands:');
  console.log('  window.toggleAllPhysicsDebug(true/false) - Toggle physics debug visualizations');
  console.log('  window.toggleMovementLogging(true/false) - Toggle movement logging');
  console.log('  window.movePlayerTo(x, z) - Force player to move to position');
  console.log('  window.getPlayerStatus() - Print player status information');
}

// Auto-initialize when loaded
initDebugHelpers();

// Legacy debug helpers (to be migrated)
const legacyHelpers = {
  movePlayerTo: window.movePlayerTo,
  getPlayerStatus: window.getPlayerStatus
};

// Expose debug functions globally
window.debugHelpers = {
  /**
   * Move the player to a specific position
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   */
  movePlayerTo: function(x, z) {
    if (!window.game || !window.game.player) {
      console.error('[DEBUG] Cannot move player - player not available');
      return;
    }
    
    const player = window.game.player;
    console.log(`[DEBUG] Moving player to (${x}, ${z})`);
    
    // Call the player's move handler directly
    player._handleMove({ x, z });
  },
  
  /**
   * Test click movement at screen coordinates
   * @param {number} screenX - Screen X coordinate
   * @param {number} screenY - Screen Y coordinate
   */
  testClickAt: function(screenX, screenY) {
    if (!window.game || !window.game.player) {
      console.error('[DEBUG] Cannot test click - player not available');
      return;
    }
    
    console.log(`[DEBUG] Testing click at screen coordinates (${screenX}, ${screenY})`);
    
    // Create a click data object
    const clickData = {
      position: { x: screenX, y: screenY },
      clickCoords: { x: screenX, y: screenY },
      ndc: { 
        x: (screenX / window.innerWidth) * 2 - 1,
        y: -(screenY / window.innerHeight) * 2 + 1
      },
      timestamp: Date.now()
    };
    
    // Call the player's move handler directly
    window.game.player._handleMove(clickData);
  },
  
  /**
   * Toggle physics debug visualization
   * @param {boolean} visible - Whether to show physics debug visualization
   */
  togglePhysicsDebug: function(visible) {
    if (typeof visible !== 'boolean') {
      console.error('[DEBUG] togglePhysicsDebug requires a boolean parameter');
      return;
    }
    
    if (window.togglePlayerPhysicsDebug) {
      window.togglePlayerPhysicsDebug(visible);
      console.log(`[DEBUG] Player physics debug visualization ${visible ? 'enabled' : 'disabled'}`);
    } else {
      console.error('[DEBUG] Player physics debug toggle not available');
    }
    
    if (window.togglePhysicsDebug) {
      window.togglePhysicsDebug(visible);
      console.log(`[DEBUG] Map physics debug visualization ${visible ? 'enabled' : 'disabled'}`);
    } else {
      console.warn('[DEBUG] Map physics debug toggle not available');
    }
  },
  
  /**
   * Print player position
   */
  getPlayerPosition: function() {
    if (!window.game || !window.game.player) {
      console.error('[DEBUG] Cannot get player position - player not available');
      return;
    }
    
    const player = window.game.player;
    const pos = player.position;
    console.log(`[DEBUG] Player position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    
    if (player.characterPhysics && player.characterPhysics.rigidBody) {
      const physicsPos = player.characterPhysics.rigidBody.translation();
      console.log(`[DEBUG] Player physics position: (${physicsPos.x.toFixed(2)}, ${physicsPos.y.toFixed(2)}, ${physicsPos.z.toFixed(2)})`);
    } else {
      console.warn('[DEBUG] Player physics body not available');
    }
    
    return pos;
  }
};

// Add legacy helpers to the new debugHelpers object
Object.assign(window.debugHelpers, legacyHelpers);

// Expose debug helpers to console
console.log('[DEBUG] Debug helpers loaded. Available commands:');
console.log('- window.debugHelpers.movePlayerTo(x, z)');
console.log('- window.debugHelpers.testClickAt(screenX, screenY)');
console.log('- window.debugHelpers.togglePhysicsDebug(visible)');
console.log('- window.debugHelpers.getPlayerPosition()');

// Export for module usage
export default window.debugHelpers;

/**
 * Toggle the visibility of the physics debug visualization
 * @param {boolean} [visible] - If provided, set to this value, otherwise toggle
 * @returns {boolean} The new visibility state
 */
function togglePhysicsDebug(visible) {
  if (!window.game || !window.game.player) {
    console.error('Cannot toggle physics debug - game or player not available');
    return false;
  }
  
  const player = window.game.player;
  
  if (player.physics && typeof player.physics.toggleDebug === 'function') {
    const result = player.physics.toggleDebug(visible);
    console.log(`Physics debug visualization ${result ? 'SHOWN' : 'HIDDEN'}`);
    return result;
  } else {
    console.error('Cannot toggle physics debug - player physics not available or missing toggleDebug method');
    return false;
  }
}

/**
 * Get the current position of the player and physics body
 * @returns {Object} Object containing mesh and physics positions
 */
function getPlayerPosition() {
  if (!window.game || !window.game.player) {
    console.error('Cannot get player position - game or player not available');
    return null;
  }
  
  const player = window.game.player;
  const result = {
    mesh: null,
    physics: null
  };
  
  if (player.mesh) {
    result.mesh = {
      x: player.mesh.position.x,
      y: player.mesh.position.y,
      z: player.mesh.position.z
    };
  }
  
  if (player.physics && typeof player.physics.getPhysicsPosition === 'function') {
    result.physics = player.physics.getPhysicsPosition();
  }
  
  console.log('Player position:', result);
  return result;
}

/**
 * Force the physics body to the correct position
 * This is useful when the physics body gets out of sync with the character mesh
 */
function fixPhysicsPosition() {
  if (!window.game || !window.game.player) {
    console.error('Cannot fix physics position - game or player not available');
    return false;
  }
  
  const player = window.game.player;
  
  if (!player.physics || !player.physics.rigidBody || !player.mesh) {
    console.error('Cannot fix physics position - player physics or mesh not available');
    return false;
  }
  
  // Get the current mesh position
  const meshPos = player.mesh.position;
  
  // Get the current map height at the mesh position
  let mapHeight = 0;
  if (window.game.currentMap && typeof window.game.currentMap.getHeightAt === 'function') {
    mapHeight = window.game.currentMap.getHeightAt(new THREE.Vector3(meshPos.x, 0, meshPos.z)) || 0;
  }
  
  // Calculate the correct physics body position
  // The physics body should be positioned at half the character's height above the ground
  const characterHeight = player.physics.characterHeight || 1.76;
  const physicsY = mapHeight + (characterHeight / 2);
  
  // Set the physics body position
  player.physics.rigidBody.setNextKinematicTranslation({
    x: meshPos.x,
    y: physicsY,
    z: meshPos.z
  });
  
  // Update the debug visualization if available
  if (player.physics.debugMesh) {
    player.physics.debugMesh.position.set(meshPos.x, physicsY, meshPos.z);
  }
  
  console.log(`[DEBUG] Fixed physics position: Mesh at (${meshPos.x.toFixed(2)}, ${meshPos.y.toFixed(2)}, ${meshPos.z.toFixed(2)}), Physics at (${meshPos.x.toFixed(2)}, ${physicsY.toFixed(2)}, ${meshPos.z.toFixed(2)})`);
  return true;
}

/**
 * Force the physics body to sync with the character mesh
 * This is useful when the physics body gets out of sync with the character mesh
 * @returns {boolean} True if successful, false otherwise
 */
function forcePhysicsSync() {
  if (!window.game || !window.game.player) {
    console.error('[DEBUG] Cannot sync physics - game or player not available');
    return false;
  }
  
  const player = window.game.player;
  
  if (!player.characterPhysics || !player.characterPhysics.rigidBody || !player.mesh) {
    console.error('[DEBUG] Cannot sync physics - player physics or mesh not available');
    return false;
  }
  
  // Get the current mesh position
  const meshPos = player.mesh.position;
  
  // Get the current map height at the mesh position
  let mapHeight = 0;
  if (window.game.currentMap && typeof window.game.currentMap.getHeightAt === 'function') {
    mapHeight = window.game.currentMap.getHeightAt(new THREE.Vector3(meshPos.x, 0, meshPos.z)) || 0;
  }
  
  // CRITICAL FIX: Position the mesh directly on the ground
  player.mesh.position.y = mapHeight;
  console.log(`[DEBUG] Positioned mesh directly on ground: Y = ${mapHeight.toFixed(2)}`);
  
  // Calculate the correct physics body position
  // The physics body should be positioned at half the character's height above the ground
  const characterHeight = player.characterPhysics.characterHeight || 1.76;
  const physicsY = mapHeight + (characterHeight / 2);
  
  // Set the physics body position
  player.characterPhysics.rigidBody.setNextKinematicTranslation({
    x: meshPos.x,
    y: physicsY,
    z: meshPos.z
  });
  
  // Update the debug visualization if available
  if (player.characterPhysics.debugMesh) {
    player.characterPhysics.debugMesh.position.set(meshPos.x, physicsY, meshPos.z);
  }
  
  console.log(`[DEBUG] Forced physics sync: Mesh at (${meshPos.x.toFixed(2)}, ${mapHeight.toFixed(2)}, ${meshPos.z.toFixed(2)}), Physics at (${meshPos.x.toFixed(2)}, ${physicsY.toFixed(2)}, ${meshPos.z.toFixed(2)})`);
  return true;
}

/**
 * Force the character mesh to stay aligned with the ground
 * This ensures the character mesh is directly on the ground while the physics body stays at the correct height
 * @returns {boolean} True if successful, false otherwise
 */
function forceGroundAlignment() {
  if (!window.game || !window.game.player) {
    console.error('[DEBUG] Cannot align to ground - game or player not available');
    return false;
  }
  
  const player = window.game.player;
  
  if (!player.mesh) {
    console.error('[DEBUG] Cannot align to ground - player mesh not available');
    return false;
  }
  
  // Get the current mesh position
  const meshPos = player.mesh.position;
  
  // Get the current map height at the mesh position
  let mapHeight = 0;
  if (window.game.currentMap && typeof window.game.currentMap.getHeightAt === 'function') {
    mapHeight = window.game.currentMap.getHeightAt(new THREE.Vector3(meshPos.x, 0, meshPos.z)) || 0;
  } else {
    console.warn('[DEBUG] Map height not available, using current Y position');
    return false;
  }
  
  // Force the mesh to be directly on the ground
  player.mesh.position.y = mapHeight;
  
  // If physics is available, update it too
  if (player.characterPhysics && player.characterPhysics.rigidBody) {
    const characterHeight = player.characterPhysics.characterHeight || 1.76;
    const physicsY = mapHeight + (characterHeight / 2);
    
    // Set the physics body position
    player.characterPhysics.rigidBody.setNextKinematicTranslation({
      x: meshPos.x,
      y: physicsY,
      z: meshPos.z
    });
    
    // Update debug visualization if available
    if (player.characterPhysics.debugMesh) {
      player.characterPhysics.debugMesh.position.set(meshPos.x, physicsY, meshPos.z);
    }
    
    console.log(`[DEBUG] Ground alignment: Mesh set to ground Y = ${mapHeight.toFixed(2)}, Physics Y = ${physicsY.toFixed(2)}`);
  } else {
    console.log(`[DEBUG] Ground alignment: Mesh set to ground Y = ${mapHeight.toFixed(2)} (no physics body available)`);
  }
  
  return true;
}

// Expose debug helpers to console
window.debugHelpers = {
  ...window.debugHelpers || {},
  togglePhysicsDebug,
  getPlayerPosition,
  fixPhysicsPosition,
  forcePhysicsSync,
  forceGroundAlignment
};

console.log('Physics debug helpers available:');
console.log('- window.debugHelpers.togglePhysicsDebug([visible]) - Toggle physics debug visualization');
console.log('- window.debugHelpers.getPlayerPosition() - Get current player position');
console.log('- window.debugHelpers.fixPhysicsPosition() - Force physics body to correct position');
console.log('- window.debugHelpers.forcePhysicsSync() - Force physics body to sync with character mesh');
console.log('- window.debugHelpers.forceGroundAlignment() - Force character mesh to stay aligned with ground'); 