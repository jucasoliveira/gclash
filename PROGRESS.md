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

### Step 13: Death and Respawn System Improvements

- Fixed critical issues with the death and respawn system:
  - Resolved NaN% width errors in health UI during respawn
  - Fixed duplicate death screen display issues
  - Ensured other players can see respawned players correctly
  - Improved synchronization of player death and respawn events across clients
- Enhanced the Player class:
  - Improved `takeDamage` method to validate health values and prevent processing damage for already dead players
  - Enhanced `_handleDeath` method to properly set the death state and show death effects
  - Fixed `_respawn` method to correctly reset health values and update the health UI
  - Added validation in `_updateHealthUI` to handle invalid health values and prevent NaN errors
- Improved the OtherPlayer class:
  - Enhanced respawn handling to reset the isDead flag and validate health values
  - Added mesh recreation logic if the mesh doesn't exist during respawn
  - Improved health bar updates to handle NaN values and ensure accurate health percentage calculations
- Enhanced the WebSocketManager:
  - Added proper handling for 'playerRespawn' message type
  - Improved death state management to prevent showing the death screen multiple times
  - Added validation for health values in network messages
- Improved the EntityManager:
  - Enhanced `_handlePlayerDied` method to prevent duplicate death processing
  - Improved `_handlePlayerRespawned` method to reset the isDead flag and validate health values
- Enhanced the UIManager:

  - Improved `showDeathScreen` method to prevent multiple death screens from being displayed
  - Added proper management of the respawn countdown timer
  - Ensured the respawn function is only called if the player is actually dead

- Benefits of these improvements:
  - More reliable death and respawn experience for players
  - Elimination of visual glitches during respawn
  - Consistent health display across all game states
  - Improved multiplayer synchronization for death and respawn events
  - Better error handling for edge cases in the combat system

### Step 14: Advanced HUD Implementation with Resource Systems

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

### Step 15: WebSocket Implementation for Improved Multiplayer

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

### March 12, 2023 - Hexagon-Based Procedural Map Generation

We've successfully transformed the TournamentMap.js to use a hexagon-based procedurally generated map similar to the lobbyMap implementation. This change enhances the visual quality and gameplay experience of the tournament mode.

#### Key Changes:

1. **Procedural Terrain Generation**

   - Implemented a hexagon-based terrain system using SimplexNoise
   - Created a flatter terrain by adjusting the noise power function
   - Added different terrain types (stone, dirt, grass, sand) based on height
   - Integrated natural elements like trees, stones, and clouds

2. **Environment Map Integration**

   - Added support for HDR environment maps using RGBELoader
   - Applied environment mapping to all materials for realistic lighting and reflections
   - Implemented proper resource management for the environment map

3. **Optimized Resource Loading**

   - Consolidated texture and environment map loading into a single method
   - Implemented parallel loading for regular textures using Promise.all
   - Added comprehensive error handling with fallback textures
   - Improved logging for better debugging

4. **Visual Enhancements**

   - Added water boundary with realistic water material
   - Created atmospheric lighting with spotlights and ambient light
   - Added cloud formations above the map
   - Implemented proper shadows and reflections

5. **Technical Improvements**
   - Used geometry merging for better performance
   - Implemented proper resource cleanup to prevent memory leaks
   - Added helper methods for camera positioning and player spawning
   - Ensured compatibility with the isometric camera system

#### Code Structure:

The TournamentMap class now follows this structure:

- Constructor: Sets up initial properties and containers
- init(): Initializes the map with options
- loadTextures(): Loads all textures and the environment map
- generateTerrain(): Creates the hexagon-based terrain
- Helper methods for terrain generation (tileToPosition, hexGeometry, makeHex, etc.)
- Visual element creation methods (createWater, createMapContainer, createClouds, createSpotlights)
- Utility methods for gameplay (getObstacles, getWalls, getRandomSpawnPosition, etc.)
- dispose(): Properly cleans up resources

#### Future Improvements:

1. **Performance Optimization**

   - Implement level-of-detail (LOD) for distant terrain
   - Use instanced meshes for repetitive elements like trees
   - Add frustum culling for off-screen elements

2. **Visual Enhancements**

   - Add more variety to terrain features
   - Implement dynamic weather effects
   - Add particle effects for atmosphere

3. **Gameplay Integration**

   - Add collision detection for terrain features
   - Implement strategic elements like high ground advantage
   - Add interactive elements to the environment

4. **Technical Refinements**
   - Implement texture atlasing for better performance
   - Add support for different map themes/biomes
   - Improve terrain generation algorithm for more natural landscapes

### Next Steps:

- Integrate the tournament map with the battle system
- Implement player spawning and respawn points
- Add tournament-specific visual effects
- Test performance with multiple players

### March 13, 2023 - Walkable Tile Implementation

We've implemented a walkable tile system for the tournament map, ensuring players can only move on appropriate terrain types (dirt, grass, and sand). This adds strategic depth to the gameplay and makes the environment more interactive.

#### Key Changes:

1. **Tile Type Tracking**

   - Added a tile type tracking system using a Map data structure
   - Defined walkable tile types (dirt, grass, sand)
   - Stored tile information including type, height, and position
   - Marked tiles with obstacles (trees, stones) as non-walkable

2. **Walkable Tile Checking**

   - Implemented `isWalkable()` method to check if a position is on a walkable tile
   - Added `worldToTile()` method to convert world positions to tile coordinates
   - Created `getHeightAt()` method to get the terrain height at any position
   - Developed `adjustToWalkable()` method to find the nearest walkable position

3. **Player Movement Integration**

   - Updated Player.js to check if target positions are walkable
   - Modified movement logic to respect walkable tiles during continuous movement
   - Adjusted player height to match terrain height during movement
   - Implemented path adjustment when players attempt to move to non-walkable areas

4. **Other Player Synchronization**

   - Updated OtherPlayer.js to respect walkable tiles
   - Adjusted network-received positions to ensure other players stay on walkable terrain
   - Maintained smooth interpolation while respecting terrain constraints

5. **Mouse Indicator Improvements**
   - Adjusted mouse movement indicator to render on top of walkable tiles
   - Updated indicator height to match terrain height
   - Improved visual feedback when clicking on non-walkable areas

#### Technical Implementation:

1. **TournamentMap.js Changes**

   - Added tile type tracking in the Map generation process
   - Implemented position validation and adjustment methods
   - Created helper methods for terrain interaction
   - Improved spawn position logic to ensure players spawn on walkable tiles

2. **Player.js Changes**

   - Updated `_handleMove()` to check for walkable tiles
   - Modified `update()` to continuously validate movement
   - Added terrain height adjustment during movement
   - Implemented fallback logic when no walkable path is available

3. **OtherPlayer.js Changes**
   - Updated `_handlePlayerMoved()` to validate network-received positions
   - Added position adjustment for non-walkable tiles
   - Maintained smooth interpolation with terrain height adjustments

#### Benefits:

- **Strategic Gameplay**: Players must navigate around obstacles and consider terrain
- **Improved Immersion**: Characters interact realistically with the environment
- **Visual Consistency**: Players remain properly positioned on the terrain
- **Better Gameplay Flow**: Prevents players from getting stuck in obstacles

#### Next Steps:

- Add visual feedback when attempting to move to non-walkable areas
- Implement pathfinding for more intelligent navigation around obstacles
- Add terrain-specific effects (footprints, dust, etc.)
- Consider terrain-based gameplay mechanics (speed modifiers, special abilities)

### March 14, 2023 - Player Rendering Fixes

We've fixed issues with player rendering to ensure characters always stay properly positioned on top of walkable tiles. This improves the visual quality and gameplay experience by preventing players from sinking into or floating above the terrain.

#### Key Fixes:

1. **Continuous Height Adjustment**

   - Added `_updateHeightBasedOnTerrain()` method to both Player and OtherPlayer classes
   - Implemented continuous terrain height checking during each frame update
   - Ensured players are always positioned slightly above the terrain surface
   - Fixed issues with players sinking into or floating above the terrain

2. **Mesh Position Synchronization**

   - Improved synchronization between entity position and mesh position
   - Added explicit mesh position updates after terrain height adjustments
   - Fixed issues where player meshes weren't properly following the terrain contours
   - Ensured consistent visual representation across all clients

3. **Movement System Improvements**

   - Enhanced WASD movement to respect terrain height
   - Improved mouse-based movement to maintain proper height during travel
   - Fixed rotation smoothing for more natural character turning
   - Added better validation of movement positions

4. **Network Position Updates**

   - Ensured network position updates include correct height information
   - Improved position interpolation to maintain proper height during transitions
   - Fixed issues with other players appearing at incorrect heights
   - Enhanced position validation to prevent invalid coordinates

5. **Performance Optimizations**
   - Added conditional checks to only perform terrain height calculations when necessary
   - Optimized height calculations to reduce unnecessary processing
   - Improved logging to help diagnose rendering issues
   - Added fallbacks for edge cases where terrain data might be missing

#### Technical Implementation:

1. **Player.js Changes**

   - Added `_updateHeightBasedOnTerrain()` method to continuously update player height
   - Modified the update loop to call this method every frame
   - Improved movement code to properly handle terrain height during both mouse and keyboard movement
   - Fixed mesh position updates to ensure visual consistency

2. **OtherPlayer.js Changes**

   - Added parallel `_updateHeightBasedOnTerrain()` method for other players
   - Enhanced position interpolation to maintain proper height
   - Fixed issues with network position updates and terrain height
   - Improved mesh position synchronization

3. **Integration with TournamentMap**
   - Leveraged the existing `getHeightAt()` method from TournamentMap
   - Ensured proper interaction between player movement and terrain data
   - Fixed edge cases where players might move outside the map boundaries
   - Improved error handling for terrain height calculations

#### Benefits:

- **Visual Consistency**: Players now appear correctly positioned on the terrain at all times
- **Improved Immersion**: Characters move naturally across the varying terrain heights
- **Better Multiplayer Experience**: Other players appear correctly positioned for all clients
- **Reduced Visual Glitches**: Eliminated issues with players sinking into or floating above terrain
- **Enhanced Gameplay**: Movement feels more natural and connected to the environment

#### Next Steps:

- Add footstep effects that match the terrain type (dust on dirt, grass rustling, etc.)
- Implement terrain-specific sound effects for different surface types
- Consider adding slight movement speed modifications based on terrain type
- Enhance visual feedback when moving between different terrain heights

### March 15, 2023 - Player Movement Coordinate Conversion Fix

### Issue

Players were experiencing issues with movement where clicking on the screen would not result in proper movement. The movement indicator was not showing, and players were not being positioned correctly on tiles. This was due to a mismatch between the coordinate systems used by the `InputManager` and the `Player` class.

### Key Fixes

1. **Screen to World Coordinate Conversion**

   - Fixed the `_handleMove` method in `Player.js` to properly convert screen coordinates to world coordinates
   - Implemented proper raycasting using normalized device coordinates (NDC) to determine the target position
   - Added error handling for cases where raycasting fails to intersect with the ground plane

2. **Improved Movement Logic**

   - Added checks to skip movement when the player is attacking
   - Enhanced error reporting for missing or invalid coordinate data
   - Reset WASD movement when mouse movement is initiated to prevent conflicts

3. **Robust Error Handling**
   - Added validation for normalized device coordinates
   - Implemented proper error messages for debugging movement issues
   - Added graceful fallbacks when coordinate conversion fails

### Technical Implementation

The core of the fix involved updating the `_handleMove` method to:

1. Use the normalized device coordinates (NDC) provided by the `InputManager`
2. Create a raycaster from the camera using these coordinates
3. Cast a ray to intersect with the ground plane
4. Use the intersection point as the target position for movement
5. Apply existing walkable tile logic to this properly converted position

### Benefits

- Players can now click anywhere on the screen and move to that location
- Movement indicators appear at the correct world position
- Improved reliability of the movement system
- Better debugging information for movement-related issues

### Next Steps

- Monitor for any edge cases in the coordinate conversion
- Consider adding visual feedback during the raycasting process
- Optimize the raycasting performance for lower-end devices

## March 16, 2023 - Player Rendering and Walkable Tile Fixes

### Issues

Players were experiencing several issues with the walkable tile system:

1. Players were walking through tiles instead of staying on top of them
2. Movement indicators were not showing consistently
3. Some tiles above water height were incorrectly marked as non-walkable

### Key Fixes

1. **Improved Walkable Tile Logic**

   - Updated the `isWalkable` method in `TournamentMap.js` to consider all tiles above water height as walkable
   - Changed the order of checks to first verify if a tile is above water, then check for obstacles
   - Improved error handling for edge cases where tile information might be missing

2. **Continuous Height Adjustment**

   - Modified both `Player` and `OtherPlayer` classes to continuously update height based on terrain
   - Removed throttling of height updates to ensure players always stay on top of tiles
   - Added forced mesh position updates to ensure visual representation matches actual position
   - Implemented better logging for debugging height adjustment issues

3. **Movement Indicator Improvements**
   - Fixed coordinate conversion in the `_handleMove` method to properly handle mouse clicks
   - Ensured movement indicators are created at the correct height above terrain
   - Added better error handling for cases where movement targets are invalid

### Technical Implementation

1. **TournamentMap.js Changes**

   - Restructured the `isWalkable` method to prioritize water height check before obstacle check
   - Improved the logic to be more explicit about why a tile is not walkable (water, obstacle, or outside map)
   - Enhanced error handling for edge cases

2. **Player.js Changes**

   - Updated the `_updateHeightBasedOnTerrain` method to run every frame
   - Added forced mesh position updates to ensure visual consistency
   - Improved logging for height adjustment debugging

3. **OtherPlayer.js Changes**
   - Made parallel changes to the `_updateHeightBasedOnTerrain` method
   - Ensured height updates occur every frame rather than being throttled
   - Added similar forced mesh position updates and logging

### Benefits

- **Visual Consistency**: Players now appear correctly positioned on top of tiles at all times
- **Improved Navigation**: More tiles are correctly identified as walkable, reducing frustration
- **Better Feedback**: Movement indicators now consistently show where players are clicking
- **Reduced Glitches**: Eliminated issues with players sinking into or walking through terrain
- **More Intuitive Movement**: Players can now navigate more naturally through the environment

### Next Steps

- Monitor for any remaining edge cases in the walkable tile system
- Consider adding visual feedback for the transition between walkable and non-walkable areas
- Implement more sophisticated pathfinding for complex obstacle navigation
- Add terrain-specific effects (footsteps, dust, etc.) based on tile type

## Physics Implementation

### Hex-Based Physics Terrain

**Status: ✅ Implemented Successfully**

We've successfully implemented a physics representation that accurately matches the visual terrain in the game. The approach uses individual cylinder colliders for each hexagonal tile, which provides a much more precise collision system than the previous heightfield-based solution.

### Key Improvements

1. **Individual Hex Colliders:**

   - Each walkable tile now has its own cylinder-shaped collider
   - Colliders match the exact shape, position, and height of their visual counterparts
   - Only walkable tiles get colliders (those above water and without obstacles)

2. **Color-Coded Debug Visualization:**

   - Each physics collider has its own wireframe visualization
   - Color-coded by terrain type for easier identification:
     - Stone: Gray
     - Dirt: Brown
     - Grass: Light green
     - Sand: Tan
     - Dirt2: Dark brown
   - Wireframes are positioned slightly above the actual terrain for visibility

3. **Map Boundary:**

   - Maintained the cylindrical wall collider for the map boundary
   - Added a thin red wireframe cylinder to highlight the walkable boundary
   - Green wireframe shows the actual collision wall

4. **Toggle Functionality:**
   - Added `window.togglePhysicsDebug(true/false)` global function
   - Allows for easy showing/hiding of all physics debug visualizations
   - Especially useful for debugging collision issues

### Implementation Details:

The implementation creates a single static rigid body that holds all the colliders, which is more efficient than creating individual rigid bodies for each tile. For each walkable tile, we:

1. Create a cylinder collider with the same radius (1.0) as the visual hexagon
2. Set the height to match the exact height of the tile
3. Position it at the tile's world coordinates with Y at half-height
4. Create an accompanying debug visualization mesh

### Benefits:

1. **Improved Accuracy:** Players will no longer "float" above the terrain or sink into it
2. **Better Debugging:** Color-coding makes it easy to identify different terrain types
3. **Precise Collisions:** More accurate collision detection for player movement and gameplay mechanics
4. **Optimized Performance:** Only creates colliders for walkable tiles, reducing unnecessary physics calculations

### Next Steps:

- Monitor performance with large numbers of players
- Potentially optimize further by using compound shapes for adjacent tiles of the same height
- Add physics representations for obstacles (trees, stones)

# Technical Documentation: Character Physics Ground Detection System

## Overview

We've successfully implemented a robust ground detection and physics system for the player character that prevents falling through the terrain. The system uses a multi-layered approach to ensure the character always stays above ground, even when traditional raycasting might fail.

## Key Improvements

### 1. Physics Body-to-Mesh Alignment

- **Consistent Offset Multiplier**: Changed all character height offset multipliers from 0.4 to 0.3 throughout the code
- **Debug Visualization**: Adjusted capsule visualization to better match the actual collision body
- **Character-Physics Sync**: Improved synchronization between visual mesh and physics body positions

### 2. Enhanced Ground Detection

- **Ray Origin Height**: Increased from 0.2 to 0.4 units above current position
- **Detection Range**: Expanded from 2.5× to 3.0× character height for wider ground detection
- **Type Checking**: Added proper handling for hit.toi to avoid "unknown" distance issues
- **Detailed Debug Logging**: Added comprehensive hit result information including position, normal, and collider details

### 3. Map Height Prioritization

- **Primary Detection Method**: Now checking map height data FIRST, before ray casting
- **Fallback System**: Implemented multiple safety checks across different methods
- **Safe Position Calculation**: Improved formula to correctly position character above terrain
- **Condition-Based Application**: Only applies when character is falling or within reasonable distance

### 4. Improved Physics Initialization

- **Map-Aware Initialization**: Now checks terrain height at spawn location
- **Map Collision Detection**: Added \_initMapCollision() method to initialize map physics
- **Continuous Collision Detection**: Enabled CONTACT_FORCE_EVENTS for more reliable collision detection
- **Initial Ray Casting**: Performs ground detection immediately after initialization

### 5. Gentler Gravity System

- **Reduced Gravity**: From -9.81 to -5.0 for more controlled falling
- **Maximum Fall Speed**: Added limit of -10.0 units/second
- **Smooth Transitions**: Improved lerping between gravity states
- **Safety Measures**: Added direct map height checks during gravity application

## The Three-Layer Safety System

Our solution implements a hierarchical approach to ground detection:

1. **Map Height Data** (Primary Layer)

   - Most reliable method
   - Direct access to terrain height information
   - Runs first in the physics update cycle
   - Prevents falling regardless of ray casting results

2. **Ray Casting** (Secondary Layer)

   - Traditional physics-based ground detection
   - Provides additional information (normal vectors, etc.)
   - Enhanced with proper type checking and error handling
   - Runs if map height method doesn't apply

3. **Safety Checks** (Tertiary Layer)
   - Minimum Y position checks (currently -3 units)
   - Direct height checks in \_applyGravity()
   - Safe position fallbacks using spawn points
   - Emergency position resets when needed

## Code Structure

The ground detection system is primarily implemented across these methods:

1. **update()** - The main entry point that:

   - Implements first-level map height safety check
   - Calls ground detection and movement methods
   - Synchronizes mesh and physics positions

2. **applyGravityAndGroundCollision()** - The core detection method that:

   - Checks map height data first
   - Performs ray casting if needed
   - Applies appropriate position adjustments

3. **\_applyGravity()** - The fallback method that:

   - Applies controlled gravity with smoothing
   - Implements additional map height checks
   - Prevents falling below terrain

4. **\_initPhysics()** and **\_initMapCollision()** - Initialization methods that:
   - Set up the physics body correctly
   - Position character at proper height
   - Initialize collision detection with terrain

## Debug Features

The system includes comprehensive debugging capabilities:

- **Visual Debug Capsule**: Red wireframe showing the physics collider
- **Ray Cast Logging**: Detailed information about ground detection attempts
- **Position Logging**: Regular updates of physics and mesh positions
- **Terrain Data**: Map height detection and collider information
- **Safety Triggers**: Logging when safety mechanisms activate

## Technical Details

- **Character Height Offset**: 0.3 × character height (reduced from 0.4)
- **Ray Origin Height**: 0.4 units above physics body position
- **Ground Threshold**: character radius + 0.3 units buffer
- **Maximum Fall Speed**: -10.0 units/second
- **Gravity Force**: -5.0 (reduced from -9.81)
- **Minimum Y Position**: -3.0 (trigger for emergency reset)
- **Safe Spawn Height**: 2.0 units above detected terrain

## Success Criteria

The system successfully:

1. Keeps the character above terrain at all times
2. Smoothly follows terrain contours during movement
3. Properly detects and responds to height changes
4. Recovers gracefully from potential falling issues
5. Maintains visual alignment between mesh and physics body

These improvements ensure players will no longer experience frustrating "falling through the ground" issues, creating a more polished gameplay experience.

### Step 13: Character Physics and Mesh Positioning Fix

- Fixed critical character mesh positioning issue:
  - Identified misalignment between character mesh and physics body
  - Resolved issue where player mesh (green cube) was sinking into the ground
  - Ensured proper synchronization between physics body and visual representation
- Implemented key technical improvements:
  - Adjusted mesh positioning to account for pivot point at mesh center
  - Added proper height offset calculation based on mesh dimensions
  - Updated both initial positioning and runtime position updates
  - Enhanced synchronization between physics body and visual mesh
  - Added detailed logging for physics debugging
- Technical details of the solution:
  - Changed initial mesh position from `mapHeight` to `mapHeight + (characterMeshHeight / 2)`
  - Updated mesh Y position calculation in the update loop to include height offset
  - Restored physics body synchronization to maintain proper Y height relative to terrain
  - Enhanced error checking and position validation
  - Improved debug visualization accuracy
- Improved development workflow:
  - Added clearer debug logging for ground height and mesh offsets
  - Enhanced physics debug visualization to accurately represent collision body
  - Included timestamp-based conditional logging to reduce console spam
- Benefits of the fix:
  - Character now appears properly positioned on the terrain
  - Visual and physics representations remain in sync during movement
  - More accurate collision detection with the environment
  - Improved overall visual quality and player experience
  - Proper foundation for future animation and character model improvements
