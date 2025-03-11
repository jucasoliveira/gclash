# Guild Clash Map System

## Overview

The Guild Clash map system provides different environments for each game mode, enhancing gameplay variety and visual appeal. Each map is tailored to its specific game mode, with unique features, layouts, and gameplay elements.

## Map Types

### Standard Grid Map

- **Description**: The default map featuring a grid-based terrain system.
- **Size**: Medium-sized map suitable for casual play.
- **Features**:
  - Grid texture for visual reference
  - Flat terrain for straightforward navigation
  - Optimized for standard gameplay
- **Implementation**: `Grid.js` in the `components/world` directory.

### Tournament Map

- **Description**: A specialized arena designed for competitive 1v1 tournaments.
- **Size**: 80 units (representing 2km in the game's scale).
- **Features**:
  - Enclosed space with walls to contain players
  - Strategic obstacles for tactical gameplay
  - Corner spotlights targeting the center
  - Unique circular pattern floor texture
  - Arena-specific lighting with blueish tint
- **Implementation**: `TournamentMap.js` in the `components/world` directory.

### Battle Royale Map

- **Description**: A massive open-world environment for 40-player battle royale matches.
- **Size**: 1000 units (representing 1000km in the game's scale).
- **Features**:
  - Vast terrain with randomly placed trees
  - Health pickup items (glowing red spheres)
  - Natural-looking ground texture
  - Pickup collection with healing effects
  - Particle effects for pickups
- **Implementation**: `BattleRoyaleMap.js` in the `components/world` directory.

## Map Loading System

The map loading system is designed to seamlessly transition between different maps based on the selected game mode. The process involves:

1. **Map Selection**: User selects a game mode in the Lobby.
2. **Data Passing**: Game mode information is passed to the GameCanvas component using React Router's state.
3. **Map Loading**: The Game component loads the appropriate map using the `_loadMap` method.
4. **Resource Management**: Previous map resources are properly disposed before loading a new map.
5. **Initialization**: The new map is initialized with its specific features and properties.

### Code Flow

```javascript
// In Lobby.jsx
const handleSelectGameMode = (mode) => {
  navigate('/game', {
    state: {
      gameMode: mode, // 'tournament', 'battleRoyale', or 'standard'
      characterClass: activeCharacter?.characterClass.toLowerCase() || 'warrior'
    }
  });
};

// In GameCanvas.jsx
const { state } = location;
const gameMode = state?.gameMode || 'standard';

// In Game.js
_loadMap(mode = 'standard') {
  // Clean up existing map
  if (this.currentMap) {
    this.currentMap.dispose();
  }

  // Load the appropriate map
  if (mode === 'tournament') {
    tournamentMap.init();
    this.currentMap = tournamentMap;
  } else if (mode === 'battleRoyale') {
    battleRoyaleMap.init();
    this.currentMap = battleRoyaleMap;
  } else {
    grid.init();
    this.currentMap = grid;
  }
}
```

## Map Implementation Details

### Common Map Interface

All maps implement a common interface with the following methods:

- **init()**: Initializes the map, creating all necessary Three.js objects.
- **dispose()**: Cleans up all resources, removing objects from the scene and disposing of geometries and materials.
- **update(deltaTime)**: Updates any animated elements or dynamic features of the map.

### Map Components

Each map consists of several key components:

1. **Ground**: The base terrain of the map.
2. **Objects**: Static elements like walls, obstacles, or trees.
3. **Special Features**: Mode-specific elements like health pickups in Battle Royale.
4. **Lighting**: Custom lighting setup for each map type.

### Resource Management

Proper resource management is crucial to prevent memory leaks when switching between maps:

```javascript
dispose() {
  // Remove objects from scene
  this.objects.forEach(obj => {
    renderer.scene.remove(obj);
  });

  // Dispose of geometries and materials
  this.geometries.forEach(geometry => {
    geometry.dispose();
  });

  this.materials.forEach(material => {
    material.dispose();
  });

  // Clear arrays
  this.objects = [];
  this.geometries = [];
  this.materials = [];
}
```

## Integration with Game Modes

Each map is designed to complement its corresponding game mode:

- **Tournament Map**: Features walls and obstacles for strategic 1v1 combat, with a focused arena design.
- **Battle Royale Map**: Provides a vast open space with terrain features and health pickups for survival gameplay.
- **Standard Grid**: Offers a simple, clean environment for casual play and testing.

## Future Enhancements

The map system is designed to be extensible, with plans for:

1. **Dynamic Map Features**: Elements that change during gameplay, like destructible objects.
2. **Environmental Effects**: Weather, day/night cycles, and atmospheric conditions.
3. **Map Selection**: Allowing players to choose between multiple maps within each game mode.
4. **Interactive Elements**: Buttons, levers, or other interactive objects that affect gameplay.
5. **Procedural Generation**: Dynamically generated maps for increased variety.
6. **Map-Specific Mechanics**: Unique gameplay elements tied to specific maps.

## Technical Considerations

- **Performance Optimization**: Maps use techniques like object pooling and frustum culling to maintain performance.
- **Memory Management**: Proper cleanup of Three.js resources to prevent memory leaks.
- **Scalability**: Map system designed to easily add new map types in the future.
- **Consistency**: Common interface ensures all maps work seamlessly with the game engine.

## Debugging and Testing

For debugging purposes, several global functions are available in the browser console:

- **viewTournamentMap()**: Quickly view the tournament map without starting a game.
- **viewBattleRoyaleMap()**: Quickly view the battle royale map without starting a game.
- **startTournament()**: Start a game in tournament mode for testing.
- **startBattleRoyale()**: Start a game in battle royale mode for testing.

## Conclusion

The Guild Clash map system provides a flexible foundation for diverse gameplay experiences across different game modes. By tailoring each map to its specific mode, players enjoy environments that enhance the intended gameplay style, whether it's the focused combat of tournaments or the sprawling survival gameplay of battle royale.
