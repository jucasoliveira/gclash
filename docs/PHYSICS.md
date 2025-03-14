# Guild Clash Physics System

## Overview

Guild Clash uses Rapier physics for 3D character movement, terrain collision, and physical interactions. This document outlines the implementation details, best practices, and key considerations for working with the physics system.

## Key Components

### 1. Rapier Integration

Guild Clash integrates [Rapier](https://rapier.rs/), a high-performance physics engine:

```javascript
// Initialization in Game.js
async initRapierPhysics() {
  try {
    const RAPIER = await import('@dimforge/rapier3d');
    window.RAPIER = RAPIER;

    // Create physics world with gravity
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    const world = new RAPIER.World(gravity);
    window.physicsWorld = world;

    // Setup physics debug helpers
    this._setupPhysicsDebugHelpers();

    return true;
  } catch (error) {
    console.error('[GAME] Failed to initialize Rapier physics engine:', error);
    return false;
  }
}
```

### 2. CharacterPhysics Component

The `CharacterPhysics` class manages character physics representation and movement:

- Creates a kinematic physics body for each character
- Handles character-terrain collision detection
- Manages character movement with proper positioning
- Implements gravity and ground detection
- Ensures synchronization between visuals and physics

Core responsibilities:

1. **Physics Body Creation**: Creates a capsule collider that represents the character
2. **Movement Handling**: Updates physics body position based on player input
3. **Gravity Simulation**: Applies gravity and detects ground to prevent falling
4. **Visual Synchronization**: Ensures the visual mesh aligns with physics representation
5. **Debugging Support**: Provides visualization and logging for development

### 3. Terrain Physics

Terrain is represented by a combination of:

- Heightfield colliders for terrain elevation
- Cylinder colliders for walls and boundaries
- Custom hex-based collision bodies for more complex terrain

## Implementation Details

### Character Physics Structure

```javascript
class CharacterPhysics {
  constructor(options) {
    // Store options
    this.characterMesh = options.characterMesh;
    this.initialPosition =
      options.initialPosition || new THREE.Vector3(0, 0, 0);
    this.characterHeight = options.characterHeight || 1.8;
    this.characterRadius = options.characterRadius || 0.3;

    // Physics properties
    this.rigidBody = null;
    this.collider = null;
    this.debugMesh = null;

    // Movement properties
    this.currentVelocity = new THREE.Vector3();
    this.targetPosition = null;
    this.isMoving = false;

    // Initialize physics
    this._initPhysics();
  }

  // Methods for physics initialization, movement, and updates
}
```

### Character Collider Configuration

Characters use a capsule collider aligned with the Y-axis:

```javascript
// Create a capsule collider
const halfHeight = this.characterHeight * 0.4; // 40% of character height for half-height
const radius = Math.max(this.characterRadius, 0.4); // At least 0.4 to cover the character width
const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
```

This capsule shape:

- Provides smooth movement over terrain
- Prevents catching on small obstacles
- Handles sloped surfaces effectively
- Allows for step climbing within limits

### Physics-Visual Synchronization

The key challenge is keeping the visual mesh aligned with the physics body:

```javascript
// Calculate correct mesh Y position (adjusted after fix)
const characterMeshHeight = 1.6; // Based on mesh dimensions
const meshY = groundY + characterMeshHeight / 2;

// Update mesh position
this.characterMesh.position.x = finalPhysicsPos.x;
this.characterMesh.position.z = finalPhysicsPos.z;
this.characterMesh.position.y = meshY;
```

### Terrain Detection

Multiple approaches for ground detection:

1. **Map Height Data**: Primary method uses the map's heightAt function

   ```javascript
   groundY = window.game.currentMap.getHeightAt(
     new THREE.Vector3(position.x, 0, position.z)
   );
   ```

2. **Ray Casting**: Fallback for complex terrain
   ```javascript
   const hit = world.castRay(ray, maxToi, solid);
   if (hit) {
     const hitPoint = {
       x: ray.origin.x + ray.dir.x * hit.toi,
       y: ray.origin.y + ray.dir.y * hit.toi,
       z: ray.origin.z + ray.dir.z * hit.toi,
     };
     groundY = hitPoint.y;
   }
   ```

## Best Practices

1. **Physics Body Position**: Always keep the physics body's center at half the character's height above ground
2. **Mesh Positioning**: Position character meshes with appropriate offset (half mesh height) from ground
3. **Coordinate Systems**: Remember that three.js and Rapier share the same coordinate system (Y-up)
4. **Error Handling**: Always include validation for height data to prevent NaN positions
5. **Visual Debugging**: Use debug visualization during development to see physics bodies
6. **Conditional Logging**: Use random-based conditionals for logging to reduce console spam

## Common Issues

### 1. Mesh Sinking Into Terrain

**Root Cause**: Incorrect positioning of mesh relative to terrain
**Solution**: Apply proper height offset: `groundY + (characterMeshHeight / 2)`

### 2. Character Falling Through Floor

**Root Cause**: Missed ground detection or asynchonous physics updates
**Solution**:

- Use multiple ground detection methods
- Implement safety checks for minimum height
- Enforce position constraints

### 3. Jittery Movement on Slopes

**Root Cause**: Rapid height changes causing oscillation
**Solution**: Smooth height transitions and limit maximum climb angle

## Debugging Tools

1. **Physics Debug Visualization**:

   ```javascript
   window.toggleAllPhysicsDebug = function (visible) {
     if (window.game?.player?.physics) {
       window.game.player.physics.toggleDebug(visible);
     }
   };
   ```

2. **Height Data Inspector**:
   ```javascript
   window.checkHeightAt = function (x, z) {
     if (window.game?.currentMap?.getHeightAt) {
       const height = window.game.currentMap.getHeightAt(
         new THREE.Vector3(x, 0, z)
       );
       console.log(`Height at (${x}, ${z}): ${height}`);
       return height;
     }
   };
   ```

## Future Improvements

1. **Physics-Based Character Controller**: Replace kinematic controller with a fully physics-based one
2. **Improved Terrain Collision**: Add more accurate terrain collision using triangulated mesh
3. **Character Interactions**: Implement pushing, sliding, and other character interactions
4. **Performance Optimization**: Implement spatial partitioning for physics calculations
5. **Constraint Systems**: Add joint constraints for advanced character movement
