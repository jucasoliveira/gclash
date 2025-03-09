# Guild Clash Architecture

## Overview

This document outlines the component-based architecture for the Guild Clash client. The goal is to transform the current monolithic codebase into a modular, maintainable structure that's easier to extend and debug.

## Core Principles

1. **Separation of Concerns**: Each component should have a single responsibility
2. **Encapsulation**: Components should hide their internal implementation details
3. **Reusability**: Code should be structured to maximize reuse
4. **Testability**: Components should be designed to be easily testable
5. **Event-Driven Communication**: Components should communicate via events rather than direct references

## Component Structure

### Project Organization

```
/client
  /src
    /components
      /core
        Game.js             # Main game controller
        Renderer.js         # Three.js rendering
        EventBus.js         # Central event system
      /controls
        InputManager.js     # Keyboard/mouse input handling
        PlayerController.js # Translates input to player actions
        CameraController.js # Camera movement and positioning
      /world
        WorldManager.js     # Manages the game world
        Grid.js             # Grid-based terrain system
        ObjectManager.js    # Manages in-world objects
      /entities
        Entity.js           # Base entity class
        Player.js           # Player entity
        OtherPlayer.js      # Networked player entity
        EntityManager.js    # Manages all entities
      /ui
        UIManager.js        # Manages UI elements
        CharacterSelect.js  # Character selection screen
        GameUI.js           # In-game UI
      /network
        NetworkManager.js   # Socket.io communication
        SyncManager.js      # Entity synchronization
      /utils
        MathUtils.js        # Math helper functions
        AssetLoader.js      # Resource loading
    /assets
      # Game assets
    /config
      classes.js            # Character class definitions
      settings.js           # Game settings
    main.js                 # Entry point
```

## Component Descriptions

### Core Components

#### Game.js
- Initializes and coordinates all game systems
- Manages the game loop
- Handles game state transitions
- Acts as the entry point for the game systems

#### Renderer.js
- Handles three.js setup and rendering
- Manages the render loop
- Provides an API for adding/removing objects from the scene
- Handles window resize events

#### EventBus.js
- Implements a publisher/subscriber pattern
- Allows components to communicate without direct references
- Provides methods for emitting and listening to events

### Controls Components

#### InputManager.js
- Captures keyboard and mouse input
- Normalizes input across browsers
- Emits input events for other systems to consume
- Handles input configuration

#### PlayerController.js
- Translates input events into player actions
- Manages player movement controls (WASD)
- Triggers character abilities

#### CameraController.js
- Handles camera positioning and movement (arrow keys)
- Implements isometric camera settings
- Manages camera target and transitions

### World Components

#### WorldManager.js
- Creates and initializes the game world
- Manages the scene layout
- Coordinates world objects

#### Grid.js
- Implements the grid-based terrain system
- Handles grid texture generation
- Provides utilities for grid-based positioning

#### ObjectManager.js
- Manages non-player objects in the world
- Handles object creation, updating, and removal
- Maintains object collections by type

### Entity Components

#### Entity.js
- Base class for all game entities
- Handles common entity properties (position, rotation)
- Provides life cycle methods (update, destroy)

#### Player.js
- Extends Entity for the local player
- Manages player state, stats, and abilities
- Handles player-specific rendering

#### OtherPlayer.js
- Extends Entity for networked players
- Handles interpolation for smooth movement
- Manages visual representation of other players

#### EntityManager.js
- Tracks all entities in the game
- Provides methods to query entities
- Handles entity creation and removal

### UI Components

#### UIManager.js
- Manages all UI elements and screens
- Handles UI transitions and state
- Coordinates UI input and events

#### CharacterSelect.js
- Implements the character selection UI
- Handles class selection logic
- Manages the start game button

#### GameUI.js
- Implements the in-game UI elements
- Shows player health, stats, etc.
- Displays game messages

### Network Components

#### NetworkManager.js
- Handles Socket.io connection and events
- Manages connection state and reconnection
- Provides an API for sending/receiving messages

#### SyncManager.js
- Synchronizes entity states across the network
- Handles entity creation/removal for network events
- Implements client-side prediction and reconciliation

### Utility Components

#### MathUtils.js
- Provides math helper functions
- Includes vector operations, interpolation, etc.
- Handles random number generation

#### AssetLoader.js
- Loads and caches game assets
- Manages loading states and progress
- Provides access to loaded resources

## Communication Flow

1. **Input → Action**: InputManager detects input and emits events
2. **Action → Entity**: PlayerController translates input events to player actions
3. **Entity → Network**: Player actions update the Player entity and are sent to the server
4. **Network → Entities**: Received network updates modify entity states
5. **Entities → Renderer**: Entity states are used for rendering
6. **Game → Systems**: Game coordinates the update cycle of all systems

## State Management

- **Component State**: Each component manages its internal state
- **Game State**: Game.js manages high-level game state (menu, playing, etc.)
- **Shared State**: Critical shared state is managed through the EventBus

## Implementation Strategy

1. Start by creating the core components (Game, Renderer, EventBus)
2. Move existing functionality into appropriate components gradually
3. Refactor code to use the EventBus for communication
4. Implement new features using the component architecture
5. Add tests for components as they're created

## Best Practices

1. Use ES6 classes and modules
2. Maintain clear interfaces between components
3. Document public methods and events
4. Follow the single responsibility principle
5. Prefer composition over inheritance
6. Use dependency injection where appropriate
7. Implement proper cleanup to prevent memory leaks

## Example Implementation

```javascript
// Example of the Player component
import { Entity } from './Entity.js';
import { eventBus } from '../core/EventBus.js';

export class Player extends Entity {
  constructor(id, classType, stats) {
    super();
    this.id = id;
    this.classType = classType;
    this.stats = { ...stats };
    this.mesh = null;
    
    this._initMesh();
    this._setupEventListeners();
  }
  
  _initMesh() {
    const geometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
    const material = new THREE.MeshStandardMaterial({ 
      color: this.stats.color 
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    
    // Set initial position
    this.setPosition(2, 0.8, 2);
  }
  
  _setupEventListeners() {
    eventBus.on('move.forward', () => this.moveForward());
    eventBus.on('move.backward', () => this.moveBackward());
    eventBus.on('move.left', () => this.moveLeft());
    eventBus.on('move.right', () => this.moveRight());
  }
  
  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.mesh.position.set(x, y, z);
    eventBus.emit('player.moved', { id: this.id, position: this.position });
  }
  
  moveForward() {
    this.setPosition(
      this.position.x,
      this.position.y,
      this.position.z - this.stats.speed
    );
  }
  
  moveBackward() {
    this.setPosition(
      this.position.x,
      this.position.y,
      this.position.z + this.stats.speed
    );
  }
  
  moveLeft() {
    this.setPosition(
      this.position.x - this.stats.speed,
      this.position.y,
      this.position.z
    );
  }
  
  moveRight() {
    this.setPosition(
      this.position.x + this.stats.speed,
      this.position.y,
      this.position.z
    );
  }
  
  update(deltaTime) {
    // Any per-frame updates
  }
  
  destroy() {
    // Cleanup resources
    eventBus.off('move.forward');
    eventBus.off('move.backward');
    eventBus.off('move.left');
    eventBus.off('move.right');
  }
}
```