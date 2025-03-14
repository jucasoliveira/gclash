# Movement and Physics Debugging Guide

This document consolidates all debugging commands, instructions, and fixes related to character movement and physics in Guild Clash. Use this as a reference when troubleshooting or testing movement-related features.

## Quick Reference Commands

| Command                                                    | Description                             |
| ---------------------------------------------------------- | --------------------------------------- |
| `window.toggleAllPhysicsDebug(true)`                       | Toggle all physics debug visualizations |
| `window.togglePlayerPhysicsDebug(true)`                    | Toggle only player physics debug        |
| `window.togglePhysicsDebug(true)`                          | Toggle only terrain physics debug       |
| `window.directMovePlayerTo(x, z)`                          | Move player to specific coordinates     |
| `window.movePlayerTo(x, z)`                                | Legacy command to move player           |
| `window.getPlayerStatus()`                                 | Check player status and position        |
| `window.toggleMovementLogging(true)`                       | Enable detailed movement logs           |
| `window.updateCameraPosition(window.game.player.position)` | Reset camera position to player         |
| `window.game.currentMap.visualizeWalkableTiles()`          | Visualize walkable tiles on the map     |

## Movement Debugging Instructions

### Basic Movement Debugging

1. Refresh your browser to load the latest code
2. Open the browser console (F12 or right-click > Inspect > Console)
3. Run `window.toggleAllPhysicsDebug(true)` to show physics debug visualizations
4. Try moving with WASD or clicking on the ground
5. Observe the physics capsule (red) and character mesh (colored by class)

### Forcing Player Movement

If normal movement doesn't work, you can force the player to move to a specific position:

1. In the console, run: `window.directMovePlayerTo(5, 5)`
2. Watch the logs to see the physics body moving
3. Verify that both the physics body and character mesh move to the target position

### Troubleshooting Camera Issues

If the camera doesn't follow the player properly:

1. Run: `window.updateCameraPosition(window.game.player.position)`
2. This will reset the camera position to focus on the player

### Walkable Tiles Visualization

To visualize which tiles are walkable on the current map:

1. Run: `window.game.currentMap.visualizeWalkableTiles()`
2. Walkable tiles will be highlighted with a semi-transparent overlay

## Physics System Explanation

### Character Physics Components

The physics system for characters consists of:

1. **Rigid Body**: A kinematic physics body using Rapier's `RigidBodyDesc.kinematicPositionBased()`
2. **Collider**: A capsule collider representing the character's collision volume
3. **Visual Mesh**: The character's visible representation (e.g., colored cube)
4. **Debug Visualization**: A red wireframe showing the physics collider (when debugging is enabled)

### Ground Detection Methods

The system uses two primary methods for ground detection:

1. **Map Height Data**: Uses `window.game.currentMap.getHeightAt(position)` to find terrain height
2. **Ray Casting**: Uses Rapier's ray casting as a fallback for complex terrain

### Physics-Visual Synchronization

The physics system maintains synchronization between:

1. The physics body (for collision detection)
2. The visual mesh (what the player sees)
3. The debug visualization (when enabled)

## Common Issues and Fixes

### Character Sinking Into Ground

**Symptoms**: Character appears partially submerged in the terrain

**Fix**: The character mesh position is now correctly offset by half its height:

```javascript
const characterMeshHeight = 1.6; // Based on mesh dimensions
const meshY = groundY + characterMeshHeight / 2;
this.characterMesh.position.y = meshY;
```

### NaN Position Errors

**Symptoms**: Character disappears or console shows NaN errors

**Troubleshooting**:

1. Run `window.getPlayerStatus()` to check current position
2. Look for any NaN values in the position data
3. Refresh the browser and try again with debug visualization enabled

### Physics Body Not Moving

**Symptoms**: Debug capsule doesn't move when clicking or using WASD

**Fix**: Ensure the physics step function is being called in the game loop:

```javascript
// This should be happening in the game loop
window.physicsWorld.step();
```

### Movement Not Working After Map Change

**Symptoms**: Character stops responding to movement controls after changing maps

**Fix**:

1. Refresh your browser to reinitialize all systems
2. Run `window.toggleAllPhysicsDebug(true)` to verify physics bodies
3. Try using `window.directMovePlayerTo(5, 5)` to force movement

## Advanced Debugging

For more detailed debugging, you can enable movement logging:

1. Run `window.toggleMovementLogging(true)`
2. Move the character using WASD or clicking
3. Check the console for detailed logs about:
   - Target positions
   - Physics body positions
   - Mesh positions
   - Ground height data
   - Ray cast results

## Testing New Fixes

When testing new movement or physics fixes:

1. Refresh your browser to load the updated code
2. Open the browser console (F12)
3. Run `window.toggleAllPhysicsDebug(true)`
4. Run `window.directMovePlayerTo(5, 5)`
5. Verify the physics body moves correctly
6. Check the console for any error messages

If you encounter issues, look for specific error messages that might indicate what's wrong with the physics or movement system.

## Physics Visualization Commands

For detailed physics debugging, use these commands:

```javascript
// Show all physics debug visualizations (character + terrain)
window.toggleAllPhysicsDebug(true);

// Show only player physics debug visualization
window.togglePlayerPhysicsDebug(true);

// Show only terrain physics debug visualization
window.togglePhysicsDebug(true);

// Get detailed player status
window.getPlayerStatus();

// Enable verbose logging of movement operations
window.toggleMovementLogging(true);
```

Remember to disable these visualizations and logging in production environments as they can impact performance.
