# Guild Clash

A browser-based isometric 3D multiplayer game featuring 1v1 tournaments and 40-player battle royale mode.

![Guild Clash Game](https://placeholder-for-game-screenshot.com)

## Features

- Isometric 3D gameplay using three.js
- Three character classes with unique stats and abilities
- Real-time multiplayer with Socket.io
- Interactive character selection
- Multiple game maps:
  - Standard grid-based world for casual play
  - Tournament arena map with walls and obstacles for competitive matches
- WASD player controls and arrow key camera controls
- Future: 1v1 tournaments (round of 16) and 40-player battle royale

## Tech Stack

- **Frontend**:
  - three.js for 3D rendering
  - HTML5/CSS3 for UI elements
  - Howler.js for audio (planned)
  - Socket.io-client for real-time communication
  - Vite for fast development and bundling
- **Backend**:
  - Node.js with Express
  - Socket.io for real-time game state
  - MongoDB/Mongoose for data persistence (planned)

## Character Classes

- **Clerk**: Magic user with high speed and low health
  - Color: Blue
  - Health: 80
  - Speed: 0.15
  - Specializes in fast movement and magic attacks
- **Warrior**: Tank with high health and low speed
  - Color: Red
  - Health: 120
  - Speed: 0.08
  - Excels in durability and melee combat
- **Ranger**: Balanced fighter with medium stats
  - Color: Green
  - Health: 100
  - Speed: 0.12
  - Versatile with balanced attributes

## Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd gclash

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### Development

```bash
# Start the server (in /server directory)
npm run dev

# Start the client development server (in /client directory)
npm run dev

# For production build (in /client directory)
npm run build
npm run preview
```

### Controls

- **WASD keys**: Move the player character on the ground plane
- **Arrow keys**: Move the camera view in isometric directions
- **Click**: Move the red test cube to the clicked position
- **UI Buttons**: Select character class and start game

## Game Flow

1. Player selects a character class (Clerk, Warrior, or Ranger)
2. Player clicks "Start Game" to enter the game world
3. Player can move around with WASD keys and adjust camera with arrow keys
4. Other connected players appear in the world with their selected class colors
5. Real-time position updates are synchronized across all clients

## Project Structure

- `/client` - Frontend code
  - `/src` - Source JavaScript files
    - `/components` - Component-based architecture
      - `/core` - Core game systems (EventBus, Renderer, Game)
      - `/controls` - Input handling
      - `/entities` - Entity management
      - `/network` - Socket.io communication
      - `/ui` - User interface components
      - `/world` - World and environment
      - `/utils` - Helper utilities
    - `/config` - Game configuration
    - `/assets` - Game assets
  - `/dist` - Bundled output (production)
- `/server` - Backend code
- `CLAUDE.md` - Development guidelines and coding standards
- `PROGRESS.md` - Detailed development progress documentation
- `global_rules.md` - Technical specifications
- `architecture.md` - Component architecture design

## Component Architecture

Guild Clash uses a component-based architecture for better maintainability and extensibility:

1. **Core Systems**

   - EventBus: Centralized event system for inter-component communication
   - Renderer: Three.js rendering pipeline management
   - Game: Main game controller and state manager

2. **Entity System**

   - Entity: Base class for all game objects
   - Player: Local player entity with input handling
   - OtherPlayer: Network-synchronized player entities
   - EntityManager: Manages entity lifecycle

3. **World Components**

   - Grid: Ground plane and grid-based positioning

4. **Input System**

   - InputManager: Keyboard and mouse input handling

5. **Network System**
   - NetworkManager: Socket.io communication and synchronization

## Documentation

- See `PROGRESS.md` for detailed development history and implementation details
- See `CLAUDE.md` for development guidelines and coding standards
- See `global_rules.md` for technical specifications
- See `architecture.md` for component architecture design
- See `docs/map-system.md` for details on the map system and game mode integration
- See `docs/websocket-protocol.md` for WebSocket communication protocol
- See `docs/character-system.md` for character creation and management
- See `docs/tournament-system.md` for tournament implementation details
- See `docs/tournament-battle-royale-integration.md` for integration between tournaments and battle royale

## Current Status

The project has implemented core multiplayer gameplay, character classes, and isometric world rendering. See PROGRESS.md for complete details on what has been implemented so far.

## Requirements

- Node.js (v18+ recommended)
- Modern web browser with WebGL support
- MongoDB (optional for development)

## Future Development

- Class-specific abilities and attacks
- Tournament and battle royale game modes
- Leaderboard system
- Enhanced UI and visual effects
- Sound effects and background music
- Player authentication and progress tracking

## Contributing

See CLAUDE.md for development guidelines and coding standards.
