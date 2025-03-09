# Guild Clash - Development Progress

## Project Overview
Guild Clash is a browser-based isometric 3D multiplayer game using three.js, featuring 1v1 tournaments and a 40-player battle royale mode with three character classes (Clerk, Warrior, Ranger) and a leaderboard.

## Comprehensive Development Documentation

### Step 1: Project Structure (Initial Setup)
- Created the basic project structure with `/client` and `/server` folders
- Initialized npm in both directories with `package.json` files
- Created README.md with basic project information
- Set up CLAUDE.md for development guidelines
- Created global_rules.md for tech stack definition

### Step 2: Front-End Tools
- Installed front-end dependencies:
  - three.js for 3D rendering
  - socket.io-client for real-time communication
  - howler for audio
  - webpack for bundling (later migrated to Vite)
  - eslint for code quality
- Created an `index.html` file with:
  - Canvas element for three.js rendering
  - UI overlay for HTML/CSS UI elements
  - Script tag for the bundle
- Set up initial webpack configuration for module bundling
- Created basic entry point in client/src/main.js

### Step 3: Back-End Tools
- Installed back-end dependencies:
  - express for the web server
  - socket.io for real-time communication
  - mongodb and mongoose for database operations
  - nodemon for development auto-restart
- Created `server.js` with:
  - Express server configuration
  - Socket.io setup with event handlers
  - MongoDB connection (optional for development)
  - API routes and static file serving
- Implemented health endpoint for server status checks
- Added graceful shutdown handling

### Step 4: Basic 3D Scene
- Created a basic three.js scene with:
  - Scene initialization with sky blue background
  - Scene, camera, and renderer setup
  - Lighting (ambient and directional with shadows)
  - Ground plane with color
  - Test cube (red) for reference
  - Animation loop with requestAnimationFrame
- Set up bundling process:
  - Initially configured webpack.config.js
  - Added babel for transpiling modern JavaScript
  - Created build and dev scripts in package.json
- Implemented basic event handling for browser window resize

### Step 5: Client-Server Communication
- Connected the front-end to the back-end with Socket.io
- Implemented event handlers:
  - playerJoin: Sends player data when connecting
  - playerMove: Sends position updates when the cube moves
  - playerMoved: Receives updates from other players
- Made MongoDB connection optional for development
- Added click event to move the cube and send updates:
  - Implemented raycasting for ground plane detection
  - Created click handler to move cube to clicked position
  - Set up Socket.io to transmit position data
- Added connection error handling and disconnect events
- Structured the server to store player state

### Step 6: Isometric Camera
- Implemented an isometric camera view:
  - Used OrthographicCamera for the true isometric look
  - Set camera at 45° rotation and ~35.264° elevation (true isometric angles)
  - Created a procedural grid texture for the ground:
    - Added canvas-based texture generation function
    - Set up repeating texture for the ground plane
    - Added green color theme with grid lines
- Added keyboard controls to navigate the scene with arrow keys:
  - Movement is aligned with the isometric perspective
  - Camera and target move together to maintain the view
  - Implemented key handling for smooth movement
- Created camera position/target update function 

### Step 7: Player Model & Controls
- Added a player model:
  - Created a simple 3D box for the player (blue color)
  - Positioned the player separately from the test cube
  - Added proper shadows and positioning
- Implemented WASD keyboard controls:
  - W/S: Move player forward/backward along the Z-axis
  - A/D: Move player left/right along the X-axis
  - Movement is aligned with world coordinates
  - Set up appropriate movement speed
- Added real-time synchronization:
  - Player position updates sent to server
  - Arrow keys still control camera separately from player
- Enhanced multiplayer experience:
  - Other players shown as orange boxes
  - Real-time updates for player movements
  - Player join/leave notifications
  - Added player tracking on server side
  - Implemented player data dictionary to track active players

### Step 8: Development Environment Improvements
- Migrated from Webpack to Vite for better development experience:
  - Faster builds and hot module replacement
  - Simplified configuration
  - Native ES module support
  - Updated package.json with new scripts
  - Removed webpack.config.js
  - Updated index.html to use ESM imports
  - Added vite.config.js with custom port settings
- Updated server CORS configuration to work with Vite dev server
  - Added specific origins for secure cross-origin requests
  - Set up proper CORS headers and methods
- Configured development ports:
  - Server: 3000
  - Client: 3001
- Updated documentation:
  - Added Vite commands to CLAUDE.md
  - Updated README with new dev workflow
  - Documented new environment setup in PROGRESS.md

### Step 9: Character Classes
- Defined three character classes with distinct properties:
  - Clerk: Blue color, low health (80), high speed (0.15)
    - Magic user specializing in fast movement
  - Warrior: Red color, high health (120), low speed (0.08)
    - Tank class with high durability but slower movement
  - Ranger: Green color, balanced health (100) and speed (0.12)
    - Balanced class with medium stats
- Added character selection UI:
  - Created styled selection screen with class descriptions and stats
  - Added class icons with color indicators
  - Implemented selection mechanism with visual feedback
  - Created and styled Start Game button
  - Added JavaScript event handlers for selection
- Updated player creation to use selected class properties:
  - Player model uses class-specific color
  - Movement speed adjusted based on class speed stat
  - Health displayed in game UI
  - Player geometry based on class
- Enhanced multiplayer functionality:
  - Players appear with their class-specific colors
  - Class information transmitted to server via Socket.io
  - Server stores and broadcasts class data to other players
  - Other players rendered with appropriate class colors
- Added game flow control:
  - Game only starts after class selection
  - Character selection must happen before game scene loads
  - UI elements show/hide at appropriate times
  - Game state tracking with gameStarted flag

## Socket.io Events Implementation
- **playerJoin**: Sent when player connects with player data and class
- **existingPlayers**: Received by new players with data about all current players
- **playerJoined**: Broadcast to existing players when a new player joins
- **playerMove**: Sent when player position changes (WASD movement)
- **playerMoved**: Received when other players move to update their position
- **playerLeft**: Received when a player disconnects to remove them from scene

## Current Features
- **3D Isometric World**: True isometric view with grid-based ground
- **Character Selection**: Three distinct classes with different stats
- **Real-time Multiplayer**: Players can see and interact in the same world
- **Controls**: WASD for player movement, arrow keys for camera
- **Class-Based Visuals**: Different colored models based on class choice
- **Modern Development**: Vite-based development environment

## Next Steps
1. **UI Development**: Enhance game UI with more player information and controls
2. **Game Logic**: Implement core gameplay mechanics and rules
3. **Class Abilities**: Add special abilities unique to each character class
4. **Multiplayer Features**: Enhance real-time synchronization for tournaments and battle royale
5. **Database Integration**: Set up player data persistence and leaderboard

## Technical Notes
- The project uses a client-server architecture with real-time communication
- Frontend is built with three.js for 3D rendering and HTML/CSS for UI
- Backend uses Node.js with Express and Socket.io for real-time gameplay
- MongoDB is planned for data persistence (currently optional for development)
- Development tools now include Vite for more efficient frontend development
- Socket.io provides the real-time communication backbone
- The game follows an entity-component style architecture