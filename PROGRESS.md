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

### Step 10: Component-based Architecture Refactoring

- Created modular, maintainable code structure following component architecture:
  - Defined architecture in `architecture.md` with clear component responsibilities
  - Created directory structure for components, configs, and utilities
- Implemented core system components:
  - **EventBus**: Central pub/sub event system for component communication
  - **Renderer**: Handles Three.js rendering pipeline and scene management
  - **Game**: Main game controller coordinating all systems
- Created entity component system:
  - **Entity**: Base class with common properties and lifecycle methods
  - **Player**: Local player entity with input handling and network communication
  - **OtherPlayer**: Remote player entity with position interpolation
  - **EntityManager**: Manages creation, updates, and removal of all entities
- Added control systems:
  - **InputManager**: Handles keyboard/mouse input and keybindings
- Developed world components:
  - **Grid**: Creates and manages the ground grid with utility functions
- Implemented network components:
  - **NetworkManager**: Handles Socket.io connections and messaging
- Added configuration files:
  - **classes.js**: Character class definitions and properties
- Enhanced code quality:
  - Proper encapsulation with private methods
  - Event-driven architecture for loose coupling
  - Singleton pattern for manager classes
  - Consistent error handling and resource disposal
  - Full JSDoc documentation throughout the codebase
- Benefits of the new architecture:
  - Improved modularity and maintainability
  - Clearer separation of concerns
  - Easier to extend with new features
  - Better testability
  - More organized code structure
  - Reduced duplication
  - Centralized event communication

### Step 11: Combat System Implementation

- Implemented class-specific primary attacks:
  - **Clerk**: Magic bolt (ranged, blue sphere projectile)
  - **Warrior**: Melee swing (close range, red arc)
  - **Ranger**: Arrow (ranged, green projectile)
- Added health and damage system:
  - Health bars above players that update in real-time
  - Floating damage numbers when attacks hit targets
  - Color-coded health indicators (green/yellow/red)
  - Health reduction upon receiving damage
- Implemented combat feedback:
  - Visual attack effects and projectiles
  - Screen shake and flash when taking damage
  - Attack cooldowns with visual indicators
  - Death and respawn effects
- Created death and respawn mechanics:
  - Player death when health reaches zero
  - Death screen and particle effects
  - Automatic respawn with position randomization
  - Respawn effects with particles and light bursts
- Enhanced network communication for combat:
  - New Socket.io events for attacks, damage, death, and respawn
  - Health synchronization across all clients
  - Attack visualization visible to all players
  - Server-side tracking of player health
- Added combat-related bug fixes:
  - Fixed health calculation and NaN errors
  - Ensured consistent combat visuals across clients
  - Improved error handling for edge cases
  - Enhanced cleanup of temporary effects

### Step 12: Combat System Enhancement and Bug Fixes

- Fixed player health UI synchronization issues:
  - Implemented reliable health bar updates when taking damage
  - Created multiple redundant paths to ensure health UI updates work
  - Added direct DOM manipulation for critical UI updates
  - Made health bar color transition smoothly based on health percentage
- Enhanced death and respawn experience:
  - Improved death screen with animated "YOU DIED" message
  - Added respawn countdown timer for better player feedback
  - Fixed player mesh visibility on death and respawn
  - Created consistent death experience across all clients
  - Added particle effects for both death and respawn events
- Implemented robust server-client synchronization:
  - Enhanced Socket.io events to ensure reliable health updates
  - Added global functions to bypass framework limitations
  - Implemented direct communication channel for critical game events
  - Made server broadcast complete information for health and respawn events
- Improved attack visualization and feedback:
  - Made attacks visible to all players consistently
  - Enhanced attack effects with projectile animations
  - Fixed issues with attack cooldowns
  - Added attack indicators for better feedback
- Created comprehensive error handling:
  - Added fallback mechanisms for missing DOM elements
  - Implemented extensive logging for combat events
  - Created recovery strategies for synchronization errors
  - Added validation to prevent invalid health values
- Enhanced combat-related UI:
  - Improved health bar visual design
  - Made damage numbers more visible
  - Added attacker information to death screen
  - Created smooth transitions for health changes
- Fixed multiplayer combat edge cases:
  - Ensured defeated players are properly hidden from all clients
  - Fixed respawned players appearing for all connected clients
  - Corrected health synchronization across multiple clients
  - Implemented proper cleanup of temporary combat effects

### Step 13: Advanced HUD Implementation with Resource Systems

- Created a new component-based UI architecture:
  - Implemented UIManager as central manager for all UI components
  - Developed HUD component for in-game heads-up display
  - Established event-based communication between game systems and UI
  - Added robust error handling and fallback mechanisms
- Implemented modern HUD with orbs and skill slots:
  - Added red health orb on bottom left of screen
  - Added blue mana orb on bottom right of screen
  - Created three skill slots between orbs for abilities
  - Implemented clockwise cooldown indicators on skill slots
  - Added smooth hover effects and transitions
- Added class-specific mana system:
  - Implemented base mana pool (100) for all character classes
  - Designed unique mana consumption and regeneration for each class:
    - Clerk: Regenerates mana faster when standing still
    - Warrior: Builds mana by landing hits on enemies
    - Ranger: Regenerates mana when not attacking for a few seconds
  - Added mana costs for primary abilities
  - Implemented visual feedback for mana changes
- Enhanced combat system integration:
  - Tied attack system to mana resources
  - Prevented attacks when insufficient mana is available
  - Added class-specific cost balancing
  - Connected combat events to HUD updates
- Improved UI synchronization and player feedback:
  - Ensured HUD updates only for local player
  - Added comprehensive event filtering
  - Improved visual clarity with larger UI elements
  - Enhanced performance with targeted DOM updates
- Transitioned from legacy UI to new HUD system:
  - Maintained backward compatibility with existing systems
  - Deprecated old UI while preserving functionality
  - Ensured smooth migration path for future development
  - Added extensive debugging and logging

### Step 14: WebSocket Implementation for Improved Multiplayer

- Replaced WebRTC with WebSocket for more reliable multiplayer communication:
  - Created a new `WebSocketManager` class to handle all network communication
  - Removed WebRTC-related code and dependencies
  - Simplified connection process with direct WebSocket connection
  - Enhanced error handling and reconnection logic
- Improved server-side implementation:
  - Enhanced server.js to handle WebSocket messages more effectively
  - Implemented server-side validation for player actions
  - Added more robust player tracking with unique IDs
  - Created centralized game state management on the server
- Enhanced multiplayer synchronization:
  - Improved player movement synchronization with more frequent updates
  - Fixed issues with damage reflection in combat
  - Enhanced player joining/leaving handling
  - Added more detailed server logging for debugging
- Benefits of the WebSocket approach:
  - Simplified architecture with direct client-server communication
  - More reliable connection without peer negotiation complexities
  - Centralized game logic for better consistency
  - Easier debugging with server-side logging
  - Reduced client-side complexity
- Technical implementation details:
  - Used native WebSocket API for browser clients
  - Implemented message types for different game events
  - Created robust message handling with JSON parsing
  - Added connection status monitoring
  - Implemented graceful reconnection handling
- Testing and validation:
  - Verified multiplayer functionality with multiple browser instances
  - Confirmed proper synchronization of player movements
  - Validated combat system working correctly across clients
  - Tested player joining and leaving scenarios
  - Verified health synchronization and damage application

## WebSocket Message Types

- **id**: Received when connecting to assign a unique client ID
  ```javascript
  {
    type: 'id',
    id: 'client123'
  }
  ```
- **join**: Sent when player connects with player data and class
  ```javascript
  {
    type: 'join',
    position: {x: 2, y: 0.8, z: 2},
    class: 'CLERK',
    stats: {...},
    type: 'player',
    id: 'client123'
  }
  ```
- **existingPlayers**: Received by new players with data about all current players
  ```javascript
  {
    type: 'existingPlayers',
    players: [{id: 'player1', position: {...}, class: 'WARRIOR', ...}, ...]
  }
  ```
- **newPlayer**: Broadcast to existing players when a new player joins
  ```javascript
  {
    type: 'newPlayer',
    id: 'newPlayer123',
    position: {x: 2, y: 0.8, z: 2},
    class: 'RANGER',
    stats: {...}
  }
  ```
- **playerMove**: Sent when player position changes (WASD movement)
  ```javascript
  {
    type: 'playerMove',
    id: 'client123',
    position: {x: 3.5, y: 0.8, z: 2.1}
  }
  ```
- **playerMoved**: Received when other players move to update their position
  ```javascript
  {
    type: 'playerMoved',
    id: 'player456',
    position: {x: 3.5, y: 0.8, z: 2.1}
  }
  ```
- **playerDisconnect**: Received when a player disconnects to remove them from scene
  ```javascript
  {
    type: 'playerDisconnect',
    id: 'player789'
  }
  ```
- **playerAttack**: Sent when player performs an attack with target and damage data
  ```javascript
  {
    type: 'playerAttack',
    id: 'attacker123',
    targetId: 'player456',
    damage: 15,
    attackType: 'primary'
  }
  ```
- **playerAttacked**: Broadcast when a player attacks to show effect to all clients
  ```javascript
  {
    type: 'playerAttacked',
    id: 'attacker123',
    targetId: 'player456',
    damage: 15,
    attackType: 'primary'
  }
  ```
- **playerHealth**: Broadcast player health updates to all clients
  ```javascript
  {
    type: 'playerHealth',
    id: 'player456',
    health: 65,
    maxHealth: 80,
    damage: 15,
    attackerId: 'attacker123'
  }
  ```
- **playerDeath**: Broadcast to notify all clients when a player dies
  ```javascript
  {
    type: 'playerDeath',
    id: 'player456',
    attackerId: 'attacker123'
  }
  ```
- **playerRespawn**: Broadcast to update all clients when a player respawns
  ```javascript
  {
    type: 'playerRespawn',
    id: 'player456',
    position: {x: -3, y: 0.8, z: 4},
    health: 80,
    maxHealth: 80
  }
  ```
- **error**: Received when an error occurs on the server
  ```javascript
  {
    type: 'error',
    message: 'Invalid message format'
  }
  ```

## Current Features

- **3D Isometric World**: True isometric view with grid-based ground
- **Character Selection**: Three distinct classes with different stats
- **Real-time Multiplayer**: Players can see and interact in the same world
  - WebSocket-based communication for reliable networking
  - Server-side validation of player actions
  - Efficient message handling with JSON format
  - Robust player tracking with unique IDs
- **Multiple Game Maps**:
  - Standard grid-based world for casual play
  - Tournament arena map with walls, obstacles, and spotlights for competitive matches
- **Controls**: WASD for player movement, arrow keys for camera, mouse for attacks
- **Class-Based Visuals**: Different colored models based on class choice
- **Combat System**: Class-specific attacks with visual effects and damage
- **Advanced HUD System**: Modern game UI with resource orbs and skill slots
  - Red health orb on the bottom left displaying player health
  - Blue mana orb on the bottom right displaying mana resources
  - Three skill slots between orbs for abilities
  - Clockwise cooldown indicators on skill slots
  - Visual feedback with hover effects and transitions
- **Resource System**: Class-specific mana with unique mechanics
  - Clerk: Regenerates mana faster when standing still
  - Warrior: Builds mana by landing hits on enemies
  - Ranger: Regenerates mana when not attacking for a few seconds
  - Resource-based attacks for all classes
  - Visual feedback for resource changes
- **Health System**: Health tracking, damage visualization, and death mechanics
  - Health orb that depletes as player takes damage
  - Floating health bars above characters visible to all players
  - Floating damage numbers showing exact damage dealt
  - Screen flash and camera shake when taking damage
- **Death Mechanics**: Complete death and respawn experience
  - Particle explosion effect on death
  - Hidden character model when defeated
  - Full-screen death overlay with customized message
  - Countdown timer for respawn
  - Information about which player defeated you
- **Respawn System**:
  - Automatic respawn after countdown
  - Random respawn location for balance
  - Respawn effects with particles and light
  - Health and mana restoration to maximum
  - Character reappears for all players
- **Network Synchronization**:
  - Consistent game state across all clients
  - Health and mana synchronization for local player
  - Attack and damage visibility for spectators
  - Position interpolation for smooth movement
  - Reliable combat outcomes across the network
- **Modern Development**: Vite-based development environment with component architecture

## Next Steps

1. **Network Optimization**: Enhance WebSocket communication efficiency
   - Implement binary encoding for position updates to reduce bandwidth
   - Add message compression for larger data packets
   - Create more efficient synchronization for multiple players
   - Implement client-side prediction with server reconciliation
   - Add network quality indicators and adaptive update rates
2. **Secondary and Ultimate Abilities**: Implement remaining skill slots
   - Add secondary ability for each class using the skill slots system
   - Implement ultimate abilities with longer cooldowns
   - Create unique visual effects for each ability
   - Integrate with the new mana system
3. **Resource System Enhancement**: Expand and balance the mana system
   - Fine-tune mana costs and regeneration rates
   - Add resource-based gameplay mechanics
   - Implement mana potions or pickup items
   - Create visual effects for mana-intensive abilities
4. **Combat Balancing**: Adjust damage, health, and cooldowns for balanced gameplay
   - Balance mana costs vs. damage output
   - Adjust health and mana pools for different classes
   - Implement diminishing returns for crowd control
   - Create counter-play opportunities between classes
5. **Environment Interaction**: Add obstacles, terrain effects, and interactive elements
   - Destructible objects that provide temporary cover
   - Health and mana pickups and buff zones
   - Hazardous areas with damage over time
   - Jump pads and teleporters for mobility
6. **Tournament System**: Implement 1v1 tournament mode with brackets
   - Lobby system for tournament creation
   - Automatic bracket generation
   - Match spectating for eliminated players
   - Victory celebration and rewards system
7. **Battle Royale**: Create 40-player battle royale mode with shrinking play area
   - Larger map with varied terrain
   - Shrinking safe zone with damage outside
   - Item pickups and equipment
   - Last player standing victory condition
8. **Database Integration**: Set up player data persistence and leaderboard
   - Player accounts with authentication
   - Stats tracking (wins, kills, damage, mana usage)
   - Global and class-specific leaderboards
   - Achievement system for milestones
9. **Audio System**: Add sound effects for combat, movement, and environment
   - Attack and impact sounds
   - Ability and mana sound effects
   - Footsteps and movement audio
   - Ambient environmental sounds
   - Music system with combat detection
10. **Enhanced Visuals**: Improve player models, effects, and environment
    - Detailed character models per class
    - Enhanced ability and resource visual effects
    - Environment themes with unique terrain
    - Lighting improvements and day/night cycle

## Technical Notes

- **Architecture**:
  - Client-server architecture with real-time communication
  - Component-based design for modularity and reusability
  - Event-driven systems to keep components loosely coupled
  - Entity-component pattern for game objects
- **Frontend**:
  - Three.js for 3D rendering and scene management
  - HTML/CSS for UI elements and game interface
  - Component-based UI architecture with event-driven updates
  - Modern HUD system with health/mana orbs and skill slots
  - Vite for efficient development and hot module replacement
  - ES6+ JavaScript with modular structure
- **Backend**:
  - Node.js with Express for HTTP server
  - Native WebSocket for real-time bidirectional communication
  - In-memory game state with future MongoDB integration
  - Server-authoritative model for combat to prevent cheating
- **Networking**:
  - WebSocket messages for game updates and player actions
  - JSON message format for data exchange
  - Server validation of all player actions
  - Throttled updates to reduce bandwidth usage
  - Centralized game state management on server
- **Combat System**:
  - Client-side prediction with server validation
  - Visual effects synchronized across all clients
  - Health and damage calculations performed server-side
  - Multiple redundant paths for critical updates
- **Performance Optimizations**:
  - Object pooling for frequently created/destroyed objects
  - Throttled network updates for non-critical information
  - Efficient use of Three.js materials and geometries
  - DOM updates optimized for performance
- **Development Workflow**:
  - ESLint for code quality
  - Structured documentation in markdown
  - Clear component responsibilities and interfaces
  - Extensive console logging for debugging

## Summary of Completed Features

### Tournament Map (Step 16)

Implemented a specialized 2km x 2km arena environment for competitive play with the following features:

- **Arena Design**: Enclosed space with walls and strategically placed obstacles
- **Visual Identity**: Unique circular pattern floor texture, arena lighting, and atmospheric effects
- **Obstacles**: Various-sized boxes and box clusters scattered throughout the arena for tactical gameplay
- **Lighting**: Corner spotlights targeting the center and ambient light with blueish tint
- **Game Mode Selection**: UI for toggling between standard and tournament modes
- **Map Switching**: Dynamic loading of different maps based on game mode selection
- **Resource Management**: Proper cleanup of Three.js resources when switching maps
- **Developer Tools**: Console utilities for testing and debugging the tournament mode
- **Code Architecture**: Modular, maintainable component design following the established patterns
- **Known Issues**: Need to implement proper physics-based collision detection with arena walls and obstacles

### Phase 5: Database and Leaderboard - Login System Implementation

Implemented a comprehensive user authentication system with the following features:

- **Database Integration**:

  - Enhanced Player model with authentication fields (email, password, salt)
  - Implemented secure password hashing using crypto.pbkdf2Sync
  - Added validation for username and email fields
  - Created methods for password setting and validation

- **Server-Side Authentication**:

  - Added RESTful API endpoints for user registration and login
  - Implemented proper error handling with detailed validation messages
  - Added CORS support for cross-origin requests
  - Secured password storage with cryptographic hashing
  - Integrated authentication with the existing WebSocket connection system

- **Client-Side Authentication**:

  - Created responsive login and registration forms with modern styling
  - Implemented client-side validation for password matching
  - Added error handling and display for server-side validation errors
  - Implemented persistent sessions using localStorage
  - Added automatic login detection on page load

- **User Experience**:

  - Smooth transitions between login, registration, and game screens
  - Clear error messages for validation issues
  - Automatic username pre-filling after registration
  - Persistent login state across page refreshes

- **Security Considerations**:

  - Passwords never stored in plain text
  - Secure password hashing with salt
  - Password fields excluded from query results by default
  - Validation to prevent common security issues

- **Technical Implementation**:
  - MongoDB for user data storage
  - Express.js for RESTful API endpoints
  - Client-side fetch API for authentication requests
  - WebSocket integration for authenticated game sessions

### Step 15: Combat System Reliability Improvements

- **Fixed Entity Lookup and Damage Registration**:

  - Enhanced the EntityManager's entity lookup system with multiple fallback mechanisms
  - Added proper handling for the `entityManager.getEntity` and `entityManager.getEntitiesByType` events
  - Implemented robust error handling in the Player's `_getEntityById` method
  - Added direct entity lookup when standard methods fail to find targets
  - Created a global reference to EntityManager in Game class for easier access

- **Improved Attack Processing**:

  - Refactored attack handling into a dedicated `_processAttackWithTarget` method
  - Added fallback damage application for entities without a takeDamage method
  - Enhanced the OtherPlayer's takeDamage method with better validation and logging
  - Fixed health bar color updates with forced material updates
  - Added comprehensive logging throughout the attack flow

- **Enhanced Network Communication**:

  - Improved WebSocketManager's sendAttack method with better validation
  - Added proper handling for the new playerHealth message type
  - Enhanced server-side attack validation and processing
  - Implemented detailed logging for attack events on both client and server
  - Added ping/pong support for connection testing

- **Added Visual Feedback**:

  - Created a "DESTROYED" text effect that appears when a player is defeated
  - Enhanced death animation with particle effects and mesh hiding
  - Improved health bar visualization with proper color transitions
  - Added fallback UI for attack miss feedback
  - Implemented comprehensive logging for visual effects

- **Added Debugging Tools**:

  - Enhanced the global debugNetwork function to test connectivity
  - Added a testAttack function to find and attack the nearest player
  - Improved the showAttackMissedFeedback function with fallback UI
  - Added detailed logging throughout the combat flow
  - Created direct DOM manipulation for critical UI updates

- **Technical Implementation Details**:

  - Used event-driven architecture for loose coupling between components
  - Implemented multiple redundant paths for critical updates
  - Added fallback mechanisms at every step of the combat process
  - Enhanced error handling with try-catch blocks and detailed logging
  - Created placeholder entities when originals can't be found

- **Benefits of the Improvements**:

  - More reliable damage registration across all clients
  - Consistent visual feedback for attacks, hits, and misses
  - Better debugging capabilities for network issues
  - Enhanced player experience with clear feedback
  - Improved code maintainability with better error handling
  - More robust multiplayer synchronization

- **Specific Issues Fixed**:

  - **Health Bar Not Updating**: Fixed health bars not depleting when opponents take damage by ensuring proper material updates and adding multiple fallback mechanisms
  - **Death Animation Not Triggering**: Added reliable death detection and enhanced the death effect with a "DESTROYED" text overlay and particle effects
  - **Damage Not Registering**: Implemented multiple redundant paths for damage application and improved entity lookup to ensure attacks always find their targets
  - **Network Synchronization Issues**: Enhanced WebSocket message handling with better validation and added detailed logging for debugging
  - **Missing Visual Feedback**: Added comprehensive visual effects for all combat actions including hits, misses, and deaths

- **Testing the Improvements**:

  - **Combat Testing**: Use the global `testAttack()` function in the browser console to automatically find and attack the nearest player
  - **Network Debugging**: Use the global `debugNetwork()` function to check connection status and test server connectivity
  - **Visual Verification**: Confirm that health bars properly deplete, death animations trigger with "DESTROYED" text, and attack effects are visible
  - **Server Validation**: Check server logs to verify proper attack processing, range validation, and damage calculation
  - **Edge Case Handling**: Test with multiple players to ensure consistent behavior across different scenarios

- **Future Combat System Improvements**:
  - **Client-Side Prediction**: Implement predictive animations to reduce perceived latency
  - **Combat Metrics**: Add damage meters, hit rate statistics, and combat logs
  - **Enhanced Effects**: Create more sophisticated visual and audio effects for different attack types
  - **Combat AI**: Develop computer-controlled opponents for practice and single-player modes
  - **Combat Balancing**: Fine-tune damage values, cooldowns, and ranges based on player feedback
  - **Combo System**: Implement attack combinations and special moves for advanced gameplay
  - **Hitbox Refinement**: Create more precise collision detection for better hit registration
  - **Network Optimization**: Reduce bandwidth usage with binary encoding and delta compression

### Step 16: Tournament Map Implementation

- **Created Tournament Arena Map**:

  - Implemented a 2km x 2km arena environment with walls and obstacles
  - Added arena-specific lighting with spotlights at corners
  - Created a unique circular pattern ground texture different from the standard grid
  - Added walls around the arena to contain players during tournaments
  - Strategically placed obstacle boxes throughout the arena for tactical gameplay
  - Created stacked box clusters for more complex obstacles and cover
  - Set the arena size to 80 units in the game's scale system
  - Added object pooling for performance optimization
  - Created obstacle clusters with three.js Groups for better organization

- **Enhanced Game Mode System**:

  - Added game mode selection in character selection screen
  - Implemented toggle between standard and tournament modes
  - Created proper map loading based on selected mode
  - Added map-specific resource cleanup to prevent memory leaks
  - Integrated map selection with game initialization
  - Modified Game.js to track current active map
  - Created \_loadMap() method to switch between maps

- **Added Tournament-Specific Features**:

  - Created special tournament lighting atmosphere with corner spotlights
  - Added wall collision detection functionality
  - Implemented obstacle arrangement designed for competitive play
  - Created tournament-specific visual identity with unique textures and colors
  - Added ambient light with blueish tint for arena atmosphere
  - Used spotlights positioned at corners targeting the center
  - Created a circular arena pattern with concentric circles and radial lines
  - Added gray arena floor with darker walls for visual contrast

- **Technical Implementation**:

  - Used Three.js groups for complex obstacle arrangements
  - Implemented proper object pooling for performance optimization
  - Created reusable map component architecture for future map additions
  - Added comprehensive resource cleanup to ensure smooth transitions
  - Established event-based communication for map state changes
  - Implemented singleton pattern for map instances
  - Used the eventBus to signal when maps are ready
  - Added proper disposal of Three.js resources (geometries, materials, textures)
  - Fixed EventBus import to use default export
  - Added multiple box sizes for obstacle variety

- **User Interface Changes**:

  - Added tournament mode button in character selection
  - Implemented visual feedback for mode selection
  - Created proper game mode tracking through whole application
  - Added browser console utilities for testing tournament mode
  - Used consistent styling for mode buttons matching the character selection
  - Added hover effects and selected state styling for mode buttons
  - Positioned mode selection above character class selection
  - Added game mode heading and description

- **Integration with Game Systems**:

  - Modified \_handleStartGame method to use the selected game mode
  - Updated the Game.start method to accept class type parameter
  - Fixed the dispose method to cleanup appropriate map resources
  - Added proper cleanup of spotlights and lighting objects
  - Ensured wall and obstacle objects are properly removed on map change
  - Modified the initialization flow to support different maps
  - Managed event listener cleanup for mode selection buttons

- **Testing and Debugging Utilities**:

  - Added global startTournament() function for console testing
  - Implemented viewTournamentMap() function to quickly view map without starting game
  - Exposed tournamentMap object in the global scope for debugging
  - Added helpful console messages for tracking mode changes
  - Created clean error handling when changing maps
  - Added proper event listeners for tracking map ready events
  - Added safety checks to prevent mode changes during active games

- **Documentation Updates**:

  - Updated README.md with tournament map information
  - Added tournament map details to PROGRESS.md
  - Created comprehensive code comments for the tournament map implementation
  - Added JSDoc comments for all new methods and classes
  - Documented the map scale (20/80 units = 2km)
  - Added parameter documentation for all configurable options
  - Documented message types and game mode states
  - Added testing utilities descriptions

- **Code Quality Improvements**:

  - Used consistent coding style throughout new components
  - Added proper error handling and validation
  - Created clean method organization and naming
  - Implemented chainable methods for builder pattern usage
  - Added type annotations in JSDoc comments
  - Used semantic method and variable names
  - Created comprehensive resource cleanup
  - Maintained event-based architecture consistency
  - Used object-oriented principles throughout implementation

- **Known Issues and Future Improvements**:
  - Need to implement proper physics-based collision detection with walls and obstacles
  - Arena size parameter inconsistency (comment says 20 units but set to 80)
  - Future special tournament rules and mechanics to be implemented
  - Potential optimization for large numbers of obstacles with instanced meshes
  - Plan to add tournament-specific sound effects and ambient sounds
  - Future tournament bracket UI to be implemented
  - Plan to add victory/defeat screens specific to tournament mode
  - Will need server-side tournament session management

### Step 17: Camera System Improvements

- **Enhanced Isometric Camera Behavior**:

  - Implemented a Diablo-style camera that consistently follows the player
  - Modified the camera to maintain a fixed isometric angle while following the player
  - Ensured the map remains static in its isometric form during player movement
  - Fixed issues with map position shifting when the character moves
  - Adjusted camera positioning to keep the player centered in the view
  - Implemented smooth camera transitions when following the player
  - Optimized camera update logic for better performance
  - Created a more intuitive and user-friendly camera experience

- **Renderer Component Refactoring**:

  - Streamlined the `Renderer.js` component to focus on the camera's follow functionality
  - Removed the `useStaticView` property from the constructor to simplify camera logic
  - Updated the `updateCameraPosition` method to ensure the camera maintains a fixed isometric angle
  - Modified the camera to always look at the player's position, keeping them centered
  - Removed the `toggleStaticView` method as it was no longer needed
  - Simplified the `setFollowTarget` method by removing the static view parameter
  - Enhanced the camera's follow logic to provide a consistent gameplay experience
  - Improved code readability and maintainability through focused refactoring

- **InputManager Updates**:

  - Removed the `toggleCameraStaticView` method and related key binding from `InputManager.js`
  - Simplified the key bindings to focus on essential camera and movement controls
  - Maintained the camera follow mode toggle functionality for flexibility
  - Streamlined the input handling for a more intuitive user experience
  - Reduced code complexity by removing unnecessary toggle functionality
  - Ensured consistent behavior across different input methods
  - Improved code organization and readability
  - Enhanced the overall user experience through simplified controls

- **Technical Implementation Details**:

  - Used the Three.js camera API to implement smooth camera following
  - Leveraged the event-driven architecture for camera state changes
  - Implemented proper cleanup of event listeners for camera-related events
  - Added comprehensive error handling for camera operations
  - Ensured proper integration with the existing entity system
  - Maintained compatibility with the tournament map implementation
  - Used consistent coding style and naming conventions
  - Added detailed JSDoc comments for all modified methods

- **Benefits of the Camera Improvements**:

  - More intuitive gameplay experience with the camera always following the player
  - Reduced cognitive load on players by eliminating the need to manage camera modes
  - Enhanced visual consistency with the map remaining static in its isometric form
  - Improved focus on the player character during gameplay
  - Better spatial awareness for players in combat situations
  - More consistent experience across different game modes
  - Simplified codebase with removal of unnecessary toggle functionality
  - Improved performance through optimized camera update logic

- **Testing and Validation**:

  - Verified camera behavior across different character classes
  - Tested camera functionality in both standard and tournament maps
  - Confirmed smooth camera transitions during rapid player movement
  - Validated camera behavior during combat scenarios
  - Ensured proper camera positioning at game initialization
  - Tested camera performance with multiple entities in the scene
  - Verified proper cleanup of camera-related resources
  - Confirmed compatibility with existing game systems

- **Future Camera System Enhancements**:

  - Plan to implement camera zoom functionality for strategic overview
  - Consider adding camera shake effects for impactful combat feedback
  - Explore camera transitions between different game states
  - Investigate performance optimizations for camera updates with many entities
  - Consider implementing camera collision detection with environment objects
  - Plan to add camera easing for smoother transitions
  - Explore cinematic camera modes for special events
  - Consider implementing camera boundaries for different map sizes

### Step 18: Battle Royale Map Implementation

- **Created Battle Royale Map**:

  - Implemented a massive 1000km x 1000km map for battle royale gameplay
  - Added terrain features with randomly placed trees (cylinders with cone tops)
  - Created a natural-looking ground texture with subtle variations
  - Added health pickup items as glowing red spheres
  - Implemented pickup collection with healing effects
  - Created particle effects when collecting health pickups
  - Added smooth animations for pickups (rotation and bobbing)
  - Implemented pickup respawn system after collection

- **Enhanced Game Mode System**:

  - Added battle royale mode selection in character selection screen
  - Implemented toggle between standard, tournament, and battle royale modes
  - Created proper map loading based on selected mode
  - Added map-specific resource cleanup to prevent memory leaks
  - Integrated map selection with game initialization
  - Modified Game.js to track current active map
  - Enhanced \_loadMap() method to support battle royale map

- **Added Health Pickup System**:

  - Created collectible health pickups that restore player health
  - Implemented collision detection for pickups
  - Added health restoration effect with green screen flash
  - Created event-based communication for health pickup events
  - Implemented pickup respawn system with random positioning
  - Added visual feedback when collecting pickups
  - Created particle explosion effects for pickups

- **Technical Implementation**:

  - Used Three.js groups for complex objects like trees
  - Implemented proper object pooling for performance optimization
  - Created reusable map component architecture for future map additions
  - Added comprehensive resource cleanup to ensure smooth transitions
  - Established event-based communication for map state changes
  - Implemented singleton pattern for map instances
  - Used the eventBus to signal when maps are ready
  - Added proper disposal of Three.js resources (geometries, materials, textures)
  - Integrated with the renderer's event-based animation system

- **User Interface Changes**:

  - Added battle royale mode button in character selection
  - Implemented visual feedback for mode selection
  - Created proper game mode tracking through whole application
  - Added browser console utilities for testing battle royale mode
  - Used consistent styling for mode buttons matching the character selection
  - Added hover effects and selected state styling for mode buttons

- **Integration with Game Systems**:

  - Modified \_handleStartGame method to use the selected game mode
  - Updated the Game.start method to accept class type parameter
  - Fixed the dispose method to cleanup appropriate map resources
  - Added proper cleanup of trees and pickup objects
  - Ensured all objects are properly removed on map change
  - Modified the initialization flow to support different maps
  - Managed event listener cleanup for mode selection buttons

- **Testing and Debugging Utilities**:

  - Added global startBattleRoyale() function for console testing
  - Implemented viewBattleRoyaleMap() function to quickly view map without starting game
  - Exposed battleRoyaleMap object in the global scope for debugging
  - Added helpful console messages for tracking mode changes
  - Created clean error handling when changing maps
  - Added proper event listeners for tracking map ready events
  - Added safety checks to prevent mode changes during active games

- **Bug Fixes and Optimizations**:

  - Fixed animation system integration by using the event-based approach
  - Replaced non-existent renderer.addToAnimationLoop with eventBus.on('renderer.beforeRender')
  - Updated particle effects to use the event system for animations
  - Improved cleanup process to prevent memory leaks
  - Enhanced error handling for map transitions
  - Optimized pickup collision detection
  - Fixed health restoration UI updates

- **Future Battle Royale Features**:

  - Plan to implement shrinking play area with damage outside the safe zone
  - Will add more varied terrain with hills and water features
  - Plan to implement weapon pickups with different attack types
  - Will add AI-controlled enemies for more challenging gameplay
  - Plan to implement player count display and last player standing victory condition
  - Will add spectator mode for eliminated players
  - Plan to implement leaderboard for battle royale mode
  - Will add special battle royale-specific sound effects and music

### Step 19: Battle Royale Map Fixes and Improvements

- **Fixed Animation System Integration**:

  - Identified and fixed the error: "Uncaught TypeError: renderer.addToAnimationLoop is not a function"
  - Replaced custom animation loop methods with the event-based system used by the renderer
  - Updated the BattleRoyaleMap.js file to use eventBus.on('renderer.beforeRender') for animations
  - Modified the \_updatePickups method to accept event data parameter
  - Updated particle effect animations to use the event system
  - Ensured proper cleanup of event listeners in the dispose method

- **Enhanced Health Pickup System**:

  - Improved collision detection reliability for health pickups
  - Enhanced visual feedback when collecting health pickups
  - Optimized particle effects for better performance
  - Added proper error handling for pickup interactions
  - Ensured health restoration works correctly with the UI
  - Verified proper integration with the player health system

- **Code Quality Improvements**:

  - Added comprehensive error handling throughout the Battle Royale map code
  - Improved code comments and documentation
  - Enhanced resource cleanup to prevent memory leaks
  - Optimized rendering performance for large maps
  - Followed consistent coding patterns with the rest of the codebase
  - Used proper event listener management to prevent memory leaks

- **Testing and Validation**:

  - Verified Battle Royale mode works correctly from the UI
  - Tested health pickup collection and healing effects
  - Confirmed proper map loading and cleanup when switching modes
  - Validated tree placement and rendering
  - Tested performance with many objects in the scene
  - Verified compatibility with different character classes
  - Confirmed proper integration with the camera system

- **Documentation Updates**:

  - Added detailed comments throughout the BattleRoyaleMap.js file
  - Updated PROGRESS.md with comprehensive documentation
  - Added JSDoc comments for all methods
  - Documented the event-based animation system integration
  - Added notes about future improvements and optimizations
  - Created clear explanations of the health pickup system

- **Technical Insights**:

  - Learned that the renderer uses an event-based animation system rather than direct method calls
  - Discovered the importance of proper event listener cleanup to prevent memory leaks
  - Identified the need for consistent animation system usage across components
  - Recognized the value of the eventBus for component communication
  - Understood the renderer's animation cycle and how to integrate with it
  - Appreciated the importance of proper error handling in 3D applications

### Step 20: Database and Leaderboard Implementation

- **MongoDB Integration**:

  - Set up MongoDB connection with proper error handling and fallback
  - Created Mongoose models for Player, Tournament, and BattleRoyale
  - Implemented schema validation with appropriate field types and constraints
  - Added virtual properties for calculated fields like win rate and KD ratio
  - Created methods for updating player scores and retrieving leaderboard data
  - Implemented tournament bracket generation and management
  - Added battle royale participant tracking and elimination handling
  - Set up proper error handling for database operations

- **RESTful API Endpoints**:

  - Created player management endpoints (create, read, update)
  - Implemented leaderboard endpoint with sorting and limiting
  - Added tournament management endpoints
  - Created battle royale match tracking endpoints
  - Implemented proper validation and error handling
  - Added comprehensive logging for debugging
  - Created test scripts to verify API functionality

- **WebSocket Integration with Database**:

  - Updated WebSocket handlers to save player data to the database
  - Implemented player stats tracking for kills, deaths, and damage
  - Added score updates based on game performance
  - Connected tournament results to player profiles
  - Implemented leaderboard updates based on tournament performance

### Step 21: Tournament System Enhancement

- **Tournament Creation and Management**:

  - Implemented robust tournament creation with proper error handling
  - Added tournament joining functionality with player validation
  - Created tournament status tracking (WAITING, STARTING, IN_PROGRESS, COMPLETED)
  - Implemented tournament player count updates in real-time
  - Added tournament listing for available tournaments
  - Created tournament UI with creation and joining options
  - Implemented tournament status display with real-time updates

- **WebSocket Protocol Improvements**:

  - Standardized message format for tournament-related communications
  - Implemented proper message handlers for tournament events
  - Added tournament data validation on both client and server
  - Created consistent error handling for tournament operations
  - Improved connection state management for tournament actions
  - Added tournament ID tracking in player data
  - Implemented tournament-specific event bus events

- **Client-Server Synchronization**:

  - Ensured character class selection is validated before tournament actions
  - Added proper tournament state synchronization between client and server
  - Implemented tournament player list updates in real-time
  - Created tournament-specific game mode with appropriate map loading
  - Added tournament context preservation during game transitions
  - Implemented proper cleanup of tournament resources
  - Created visual feedback for tournament actions

- **Architecture Improvements**:

  - Refactored WebSocketManager to use message handler registration pattern
  - Separated tournament event handling from UI event handling
  - Improved error reporting for tournament operations
  - Added tournament data caching for better performance
  - Implemented proper tournament state management
  - Created clear separation between tournament creation and joining logic
  - Added comprehensive logging for tournament operations

- **Technical Insights**:

  - Discovered the importance of consistent message formats between client and server
  - Learned about the challenges of maintaining state across WebSocket connections
  - Identified the need for proper validation before tournament actions
  - Recognized the value of separating UI events from network events
  - Understood the importance of proper error handling in multiplayer systems
  - Appreciated the benefits of the message handler registration pattern

### Step 22: Tournament Winners Integration with Battle Royale

- **Database Models Implementation**:

  - Created `TournamentWinner` model to track tournament winners:
    - Implemented schema with playerId, tournamentId, tier, timestamp, and processed status
    - Added battleRoyaleId reference to track which battle royale a winner was invited to
    - Created indexes for efficient queries on processed status, playerId, and tournamentId
    - Added proper validation for required fields and enum values
  - Enhanced `BattleRoyale` model with comprehensive features:
    - Implemented schema with name, tier, status, maxParticipants, and participants
    - Added startTime, createdAt, endedAt fields for proper event timing
    - Created results array to track player placements and kills
    - Added winnerId field to record the battle royale champion
    - Created indexes for efficient queries on status, tier, and startTime
    - Added proper validation for required fields and enum values

- **Server-Side Integration**:

  - Implemented `handleTournamentCompletion` function to process tournament winners:
    - Added logic to save tournament winners to the database
    - Implemented counter to track pending (unprocessed) winners
    - Created trigger to start a battle royale when 40 winners are collected
    - Added battle royale creation with appropriate tier and settings
    - Implemented winner processing to mark them as invited to a specific battle royale
  - Added notification functions for battle royale events:
    - Created `notifyBattleRoyaleEvent` to broadcast event details to all players
    - Implemented `notifyBattleRoyaleInvitation` to send special invitations to tournament winners
    - Added proper error handling and logging for notification functions
  - Enhanced WebSocket message handling:
    - Added handler for `joinBattleRoyale` message type
    - Implemented participant tracking and battle royale status updates
    - Added automatic battle royale start when maximum participants is reached
    - Created proper error handling for battle royale operations

- **Client-Side Implementation**:

  - Created `BattleRoyaleNotification` component for user notifications:
    - Implemented stylish notification UI with join and dismiss buttons
    - Added animation effects for better visibility (pulsing glow)
    - Created event handlers for notification interactions
    - Implemented proper cleanup to prevent memory leaks
    - Added comprehensive error handling
  - Enhanced `WebSocketManager` with battle royale functionality:
    - Added message handlers for battle royale events and invitations
    - Implemented `joinBattleRoyale` method to send join requests
    - Created proper event emission for client-side components
    - Added error handling for battle royale operations
  - Updated `Game` class to handle battle royale events:
    - Added initialization of the `BattleRoyaleNotification` component
    - Implemented `_setupBattleRoyaleEventHandlers` method for event handling
    - Created event listeners for battle royale join requests and confirmations
    - Added `startBattleRoyaleMode` method to transition to battle royale gameplay
    - Integrated with existing game systems for seamless experience

- **Integration Testing**:

  - Verified tournament completion triggers winner saving
  - Confirmed battle royale creation when 40 winners are collected
  - Tested notification delivery to all players and special invitations to winners
  - Validated battle royale joining functionality
  - Confirmed proper participant tracking and battle royale status updates
  - Tested automatic battle royale start when maximum participants is reached

- **Technical Insights**:

  - Leveraged MongoDB's document-based structure for flexible winner and battle royale tracking
  - Used event-driven architecture for loose coupling between components
  - Implemented proper cleanup to prevent memory leaks
  - Added comprehensive error handling throughout the system
  - Created clear separation of concerns between models, notification, and game logic
  - Used consistent message formats for client-server communication

- **Future Enhancements**:
  - Implement battle royale spectator mode for eliminated players
  - Add battle royale-specific rewards and achievements
  - Create more sophisticated matchmaking based on player tier
  - Implement battle royale statistics tracking
  - Add special battle royale events with unique rules
  - Create a battle royale leaderboard for top performers

### Step 23: Modern UI Redesign for Lobby and Character Selection

- **Lobby Page Redesign**:

  - Implemented a visually appealing medieval-themed lobby interface:
    - Created a parchment-style header with Guild Clash branding
    - Added user avatar and username display in the header
    - Implemented a responsive layout with grid-based card system
    - Added proper logout functionality with icon button
    - Created a cohesive color scheme with browns, reds, and dark blues
  - Enhanced game mode selection cards:
    - Designed visually distinct cards for Tournament and Battle Royale modes
    - Added mode descriptions and player count indicators
    - Implemented hover effects and visual feedback
    - Created background images for each game mode
    - Added gradient overlays for better text readability
  - Improved user experience:
    - Added real-time player count updates with simulated changes
    - Created smooth transitions between UI elements
    - Implemented responsive design for different screen sizes
    - Added proper spacing and visual hierarchy
    - Created a consistent footer with copyright information

- **Character Selection Page Redesign**:

  - Implemented a matching design language with the lobby:
    - Created a consistent header with navigation back to lobby
    - Used the same parchment texture and color scheme
    - Maintained the medieval fantasy aesthetic throughout
    - Added proper page title and instructions
  - Enhanced game mode selection:
    - Created a dedicated card for game mode options
    - Added visual indicators for the selected mode
    - Implemented mode descriptions for better understanding
    - Used consistent styling with the lobby cards
  - Improved character class selection:
    - Created a dedicated card for character classes
    - Added class-specific colors for selected classes
    - Displayed health and speed stats for each class
    - Added class descriptions for the selected class
    - Implemented proper spacing and visual hierarchy
  - Enhanced tournament options:
    - Redesigned tournament creation and joining interface
    - Added visual feedback for tournament status
    - Improved the available tournaments list
    - Created a more intuitive tournament joining flow
    - Added proper styling for tournament-related elements
  - Improved start game button:
    - Made the button more prominent and centered
    - Added disabled state when no class is selected
    - Implemented hover effects for better feedback
    - Used consistent styling with other UI elements

- **Technical Implementation**:

  - Used inline styles for rapid prototyping:
    - Implemented consistent color variables
    - Created reusable style patterns
    - Used flexbox and grid for layout
    - Added proper responsive design
  - Enhanced state management:
    - Added proper handling of mode selection from lobby
    - Implemented location state passing between components
    - Created separate useEffect hooks for different concerns
    - Added proper validation before game start
  - Improved navigation:
    - Added proper navigation between lobby and character selection
    - Implemented state preservation during navigation
    - Created clear navigation paths with visual feedback
    - Added proper route handling with React Router
  - Added visual enhancements:
    - Implemented SVG icons for various UI elements
    - Added gradient backgrounds and overlays
    - Created card-based UI components
    - Used consistent border radiuses and shadows
    - Implemented proper spacing and alignment

- **User Experience Improvements**:

  - Created a more intuitive flow from lobby to game:
    - Clear visual hierarchy guides users through the process
    - Game mode selection is preserved between pages
    - Visual feedback indicates the current state
    - Proper validation prevents starting without selections
  - Enhanced visual feedback:
    - Selected states are clearly indicated
    - Hover effects provide interaction feedback
    - Disabled states prevent invalid actions
    - Error messages guide users when needed
  - Improved information architecture:
    - Mode descriptions provide context
    - Class stats are clearly displayed
    - Tournament status is prominently shown
    - Player counts indicate activity levels

- **Future UI Enhancements**:
  - Extract inline styles to CSS modules or styled components
  - Implement animations for transitions between states
  - Add loading states for asynchronous operations
  - Create a more sophisticated notification system
  - Implement dark mode toggle
  - Add accessibility improvements (ARIA attributes, keyboard navigation)
  - Create a more detailed character preview with 3D models
  - Implement sound effects for UI interactions
