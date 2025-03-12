# Guild Clash Architecture

## Overview

This document outlines the component-based architecture for the Guild Clash client and server. The project implements a browser-based isometric multiplayer game using three.js, featuring 1v1 tournaments and a 40-player battle royale mode, with three character classes (Clerk, Warrior, Ranger) and a leaderboard system.

## Core Principles

1. **Separation of Concerns**: Each component has a single responsibility
2. **Encapsulation**: Components hide their internal implementation details
3. **Reusability**: Code is structured to maximize reuse
4. **Testability**: Components are designed to be easily testable
5. **Event-Driven Communication**: Components communicate via events rather than direct references

## Project Structure

The project is organized into client and server directories:

```
.
├── client/                      # Frontend React application
│   ├── public/                  # Static assets
│   ├── src/                     # Source code
│   │   ├── components/          # Game components
│   │   │   ├── controls/        # Input handling
│   │   │   ├── core/            # Core game systems
│   │   │   ├── entities/        # Game entities
│   │   │   ├── network/         # Network communication
│   │   │   ├── ui/              # User interface
│   │   │   └── world/           # World and map systems
│   │   ├── config/              # Game configuration
│   │   ├── context/             # React context providers
│   │   ├── game/                # Game canvas and utilities
│   │   ├── lib/                 # Utility functions
│   │   ├── pages/               # React pages
│   │   └── styles/              # CSS styles
│   └── vite.config.js           # Vite configuration
├── server/                      # Backend Node.js server
│   ├── models/                  # MongoDB models
│   ├── utils/                   # Server utilities
│   └── server.js                # Main server entry point
├── assets/                      # Game assets (textures, models)
└── docs/                        # Documentation
```

## Client Component Architecture

### Core Components

#### Game.js

- Acts as the central controller for the entire game
- Manages game state (loading, character selection, gameplay, game over)
- Coordinates all game systems and components
- Handles initialization and setup of all game subsystems
- Implements tournament and battle royale mode logic
- Maintains references to other managers for direct access
- Implements tournament creation, joining, and management
- Handles tournament UI updates and player interactions

```javascript
// Simplified example from Game.js
class Game {
  constructor() {
    this.isInitialized = false;
    this.isRunning = false;
    this.state = "idle"; // idle, loading, characterSelection, playing, gameover
    this.selectedClass = null;

    this.networkManager = webSocketManager;
    this.entityManager = entityManager;
    this.renderer = renderer;
  }

  init(canvas) {
    // Initialize game systems
    this.renderer.init(canvas);
    this.networkManager.init();
    this.entityManager.init();

    // Setup event listeners
    this._setupUIEvents();
    this._setupNetworkEvents();

    this.isInitialized = true;
  }

  // Other methods for game management
}
```

#### Renderer.js

- Handles three.js setup and rendering
- Manages the scene, camera, and WebGL renderer
- Implements the render loop with requestAnimationFrame
- Provides API for adding/removing objects from the scene
- Handles window resize events and maintains aspect ratio
- Manages lighting, shadows, and post-processing effects

#### EventBus.js

- Implements a publisher/subscriber pattern for decoupled communication
- Provides methods for registering, emitting, and removing event listeners
- Facilitates communication between components without direct references
- Enables tournament and battle royale event propagation across the system

### Controls Components

#### InputManager.js

- Captures and normalizes keyboard and mouse input
- Maps key presses to game actions
- Emits events when input state changes
- Handles input configuration and customization
- Provides methods to check current input state

### Entities Components

#### Entity.js

- Base class for all game entities (players, objects, etc.)
- Manages common entity properties (position, rotation, scale)
- Provides life cycle methods (update, destroy)
- Handles entity movement and collision

#### Player.js

- Extends Entity for the local player
- Manages player state, health, and abilities
- Handles player-specific rendering and animation
- Implements combat mechanics and character abilities
- Processes input events for player movement and actions

#### OtherPlayer.js

- Extends Entity for networked players
- Implements client-side prediction and interpolation for smooth movement
- Handles visual representation and health display for remote players
- Updates position and state based on network messages

#### EntityManager.js

- Manages the creation, tracking, and removal of all game entities
- Provides methods to query entities by type or ID
- Handles entity collision detection and resolution
- Coordinates entity updates during the game loop

### Network Components

#### WebSocketManager.js

- Handles WebSocket connections to the server
- Manages connection state, reconnection, and heartbeat
- Implements message sending and receiving protocols
- Processes game-specific messages (player movements, combat, etc.)
- Handles tournament and battle royale related communications
- Provides event handlers for network messages

#### NetworkManager.js

- Higher-level abstraction over WebSocketManager
- Implements game-specific network protocols
- Handles player synchronization and state updates
- Manages connection quality and latency compensation

### UI Components

#### UIManager.js

- Manages all UI elements and screens
- Handles UI transitions and state changes
- Coordinates UI input and events
- Implements the in-game HUD and menus
- Manages tournament UI and battle royale notifications

#### TournamentBracket.js

- Renders tournament brackets and match information
- Updates bracket state based on tournament progress
- Handles player selections and match results display
- Provides visual feedback for current and upcoming matches

#### BattleRoyaleNotification.js

- Displays battle royale event notifications
- Shows safe zone updates and player eliminations
- Presents match results and winner information
- Manages invitation UI for qualified players

### World Components

#### Grid.js

- Implements the grid-based terrain system
- Handles grid texture generation and rendering
- Provides utilities for grid-based positioning and pathfinding
- Manages collision detection with terrain

#### TournamentMap.js

- Creates and manages the tournament arena map
- Places obstacles and visual elements
- Handles tournament-specific game mechanics
- Manages spawn points and boundaries

#### BattleRoyaleMap.js

- Implements the larger battle royale map
- Manages the shrinking safe zone mechanics
- Handles player spawn distribution
- Coordinates environmental hazards and item spawns

## Server Architecture

### Core Server Components

#### server.js

- Main entry point for the backend server
- Configures Express and WebSocket servers
- Handles MongoDB connection and error management
- Implements WebSocket message handlers
- Manages player connections and game state
- Coordinates tournament and battle royale systems

### Database Components

#### Models

- **Player.js**: Player data, authentication, and game statistics
- **Tournament.js**: Tournament creation, brackets, and match results
- **TournamentWinner.js**: Records of tournament winners and rewards
- **BattleRoyale.js**: Battle royale match data and results

### Utility Components

#### battleRoyaleManager.js

- Manages battle royale match creation and lifecycle
- Implements the safe zone shrinking algorithm
- Handles player elimination and match resolution
- Coordinates battle royale rewards and statistics

## Communication Protocol

The client and server communicate using WebSocket messages with the following structure:

```javascript
{
  type: 'messageType',  // The type of message
  data: {               // Message-specific data
    // Properties depend on message type
  }
}
```

### Key Message Types

#### Player Messages

- `join`: Player joins the game with character data
- `playerMove`: Player position update
- `playerAttack`: Player attack action
- `playerHealth`: Player health update
- `playerDied`: Player death notification

#### Tournament Messages

- `createTournament`: Create a new tournament
- `joinTournament`: Join an existing tournament
- `tournamentCreated`: Tournament creation confirmation
- `tournamentJoined`: Tournament join confirmation
- `tournamentUpdated`: Tournament state update
- `tournamentMatch`: Match start notification
- `tournamentResult`: Match result update

#### Battle Royale Messages

- `battleRoyaleInvitation`: Invitation to join a battle royale match
- `battleRoyaleJoined`: Confirmation of joining a battle royale
- `safeZoneUpdate`: Safe zone shrinking notification
- `playerEliminated`: Player elimination notification
- `battleRoyaleEnded`: Match end with results

## Implementation Patterns

### Singleton Pattern

Many managers are implemented as singletons to ensure a single source of truth:

```javascript
// Example singleton pattern
class EventBus {
  constructor() {
    if (EventBus.instance) {
      return EventBus.instance;
    }

    this.events = {};
    EventBus.instance = this;
  }

  // Methods
}

const eventBus = new EventBus();
export default eventBus;
```

### Component Lifecycle

Components follow a consistent lifecycle pattern:

1. **Initialization**: `init()` method sets up the component
2. **Update**: `update(deltaTime)` method called each frame
3. **Cleanup**: `dispose()` method releases resources

### Event-Driven Communication

Components communicate through the EventBus:

```javascript
// Publisher
eventBus.emit("player.moved", { id: playerId, position });

// Subscriber
eventBus.on("player.moved", (data) => {
  // Handle the event
});
```

## Performance Considerations

1. **Render Optimization**: Use instanced meshes for similar objects
2. **Network Traffic**: Minimize data transfer with delta compression
3. **Asset Loading**: Implement asset preloading and progressive loading
4. **Memory Management**: Properly dispose of three.js objects when not needed

## Security Considerations

1. **Input Validation**: Validate all client input on the server
2. **Server Authority**: Server has final authority on game state
3. **Anti-Cheat**: Implement basic movement and action validation
4. **Rate Limiting**: Prevent spam attacks with rate limiting

## Future Improvements

1. **WebRTC Integration**: Implement peer-to-peer connections for lower latency
2. **Asset Compression**: Optimize asset loading and reduce file sizes
3. **Mobile Support**: Add responsive design and touch controls
4. **Advanced Anti-Cheat**: Implement more sophisticated validation
5. **Social Features**: Add friends, clans, and messaging systems

## Best Practices

1. Use ES6 classes and modules
2. Maintain clear interfaces between components
3. Document public methods and events
4. Follow the single responsibility principle
5. Prefer composition over inheritance
6. Use dependency injection where appropriate
7. Implement proper cleanup to prevent memory leaks
8. Validate data on both client and server
9. Implement proper error handling and reporting
10. Use consistent message formats for client-server communication
