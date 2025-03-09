# CLAUDE.md - Guild Clash Development Guidelines

## Development Workflow

### Environment Setup
1. Clone the repository
2. Install dependencies for both client and server
3. Run client and server in separate terminal windows
4. Use the development commands below to start working

## Build/Test/Lint Commands

### Client
- Dev server: `npm run dev` (starts Vite development server with hot module replacement)
- Build: `npm run build` (uses Vite to bundle for production)
- Preview: `npm run preview` (preview production build locally)
- Lint: `npm run lint` (ESLint with Airbnb/Standard config)
- Fix lint: `npm run lint -- --fix` (auto-fix linting issues)

### Server
- Dev server: `npm run dev` (starts server with nodemon for auto-restart)
- Start: `npm start` (starts server in production mode)
- Test: `npm test` (runs all tests with Jest/Mocha)
- Test single: `npm test -- -t "test name"` (runs specific test)

## Development Ports
- Client (Vite): http://localhost:3001
- Server (Express): http://localhost:3000

## Code Style Guidelines

### JavaScript
- **Standard**: ES6+ with modern ESM modules
- **Style Guide**: Follow Airbnb/Standard style guide
- **Formatting**: Use consistent indentation (2 spaces)
- **Semicolons**: Required at the end of statements
- **Quotes**: Use single quotes for strings
- **Line Length**: Keep lines under 100 characters
- **Variables**: Use `const` by default, `let` when necessary, avoid `var`

### Naming Conventions
- **Files**: 
  - CamelCase for JS files (e.g., `gameLogic.js`)
  - kebab-case for assets (e.g., `player-sprite.png`)
- **Code**:
  - Variables/Functions: camelCase (e.g., `playerPosition`)
  - Classes/Components: PascalCase (e.g., `PlayerController`)
  - Constants: UPPER_SNAKE_CASE (e.g., `MAX_PLAYERS`)
  - Private methods/properties: prefixed with underscore (e.g., `_privateMethod`)

### Import Order
1. Standard libraries (e.g., `import * as THREE from 'three';`)
2. External packages (e.g., `import { io } from 'socket.io-client';`)
3. Internal modules (e.g., `import { Player } from './player.js';`)
4. Add blank line between each group

### Documentation
- **JSDoc** for functions and classes:
  ```javascript
  /**
   * Creates a player with specified properties
   * @param {string} className - The character class
   * @param {Object} position - Starting position
   * @return {Player} New player instance
   */
  ```
- **Inline comments** for complex logic only
- **TODO comments** format: `// TODO: Fix this later`

### Error Handling
- Use try-catch for async operations
- Implement server-side validation for all user inputs
- Log errors consistently with appropriate level (info, warn, error)
- Provide user feedback for recoverable errors

## Project Structure
- `/client` - Frontend code
  - `/src` - Source JavaScript files
  - `/dist` - Bundled output (production)
  - `/public` - Static assets
- `/server` - Backend code
  - `/models` - Mongoose schemas (future)
  - `/routes` - API endpoints (future)
  - `/controllers` - Business logic (future)
- `/docs` - Documentation (future)

## Git Workflow
- **Main Branch**: `main` (production-ready code)
- **Development Branch**: `dev` (integration branch)
- **Feature Branches**: `feature/feature-name` (individual features)
- **Commit Messages**: Clear and descriptive, prefixed with type:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation
  - `refactor:` for code refactoring
  - `style:` for formatting changes
  - `test:` for adding tests
  
## Performance Considerations
- **three.js Rendering**:
  - Use appropriate level of detail
  - Implement frustum culling
  - Batch similar geometries
  - Reuse materials and textures
- **Socket.io Optimization**:
  - Minimize payload size
  - Throttle position updates
  - Only send necessary data
  - Consider binary encoding for frequent updates

## Tech Stack
- **Frontend**: 
  - three.js (3D rendering)
  - HTML5/CSS3 (UI)
  - Howler.js (audio)
  - Socket.io-client (real-time)
  - Vite (bundler)
- **Backend**: 
  - Node.js
  - Express.js
  - Socket.io
  - MongoDB/Mongoose (future)
  - JWT auth (future)

## Socket.io Events Reference

### Client to Server
- `playerJoin`: Sent when player connects
  ```javascript
  {
    id: socketId,
    position: {x, y, z},
    type: 'player',
    class: 'WARRIOR',
    stats: {...}
  }
  ```
- `playerMove`: Sent when player position changes
  ```javascript
  {
    position: {x, y, z}
  }
  ```

### Server to Client
- `existingPlayers`: Received on connection with data about all current players
  ```javascript
  [
    {id, position, type, class, stats},
    ...
  ]
  ```
- `playerJoined`: Received when a new player joins
  ```javascript
  {id, position, type, class, stats}
  ```
- `playerMoved`: Received when other players move
  ```javascript
  {
    id: playerId,
    position: {x, y, z}
  }
  ```
- `playerLeft`: Received when a player disconnects
  ```javascript
  {id: playerId}
  ```

## Character Class Reference
- **Clerk**: 
  - Health: 80
  - Speed: 0.15
  - Color: 0x4287f5 (Blue)
- **Warrior**: 
  - Health: 120
  - Speed: 0.08
  - Color: 0xe74c3c (Red)
- **Ranger**: 
  - Health: 100
  - Speed: 0.12
  - Color: 0x2ecc71 (Green)

## Testing Strategy
- Unit tests for core game logic
- Integration tests for client-server communication
- End-to-end tests for game flow
- Test multiplayer with multiple browser tabs locally

## Accessibility Guidelines
- Provide keyboard alternatives for mouse actions
- Ensure sufficient color contrast
- Add screen reader support for UI elements
- Allow configuration of control schemes