# .cursorrules for Guild Clash

# Last Updated: March 09, 2025

# Purpose: Define the tech stack and development guidelines for the browser-based isometric multiplayer game "Guild Clash."

## Project Overview

- Name: Guild Clash
- Description: A browser-based, isometric 3D multiplayer game using three.js, featuring 1v1 tournaments (round of 16) and a 40-player battle royale, with three character classes (Clerk, Warrior, Ranger) and a leaderboard.
- Target Environment: Modern web browsers (Chrome, Firefox, Edge)

## Tech Stack

### Front End

- Primary Library: three.js
  - Purpose: 3D rendering for isometric game world, characters, and in-game UI (e.g., health bars).
  - Version: Latest stable (check https://threejs.org/).
- UI Framework: HTML5 + CSS3
  - Purpose: Main menu, character selection, leaderboard, and other non-gameplay screens.
  - Notes: In-game UI uses three.js; external UI uses HTML/CSS overlay.
  - Optimise for mobile
- Language: JavaScript
  - Purpose: Core game logic, event handling, and client-side scripting.
  - Standard: ES6+ with Babel for compatibility.
- Audio: Howler.js
  - Purpose: Background music, sound effects (e.g., attacks, item pickups).
  - Version: Latest stable (check https://howlerjs.com/).
- Real-Time Communication: Socket.io-client
  - Purpose: WebSocket connection to server for multiplayer sync (player positions, combat).
- Build Tools: Vite
  - Purpose: Bundle JavaScript, assets, and dependencies.
  - Alternative: Rollup (if simpler bundling is preferred).
- Transpiler: Babel
  - Purpose: Ensure JavaScript compatibility across browsers.
- Linting: ESLint
  - Purpose: Maintain code quality and consistency.
  - Config: Use Airbnb or Standard style guide (team preference).

### Back End

- Language: Node.js
  - Purpose: Server-side runtime for game logic and multiplayer management.
  - Version: LTS (e.g., v18.x or latest stable as of March 2025).
- Framework: Express.js
  - Purpose: HTTP API endpoints (e.g., user registration, leaderboard queries).
- Real-Time Communication: Socket.io
  - Purpose: WebSocket server for real-time game state updates (e.g., tournament brackets, battle royale states).
- Database: MongoDB
  - Purpose: Store player data, tournament results, battle royale outcomes, and leaderboard scores.
  - Hosting: Local or MongoDB Atlas (cloud).
- ORM: Mongoose
  - Purpose: Schema-based interaction with MongoDB for data consistency.
- Authentication: Passport.js or JWT
  - Purpose: Secure user login and session management.
  - Preference: JWT for simplicity unless team opts for Passport.js.

## Development Guidelines

- Project Structure:
  - `/client`: Front-end code (three.js, HTML, CSS, JS).
  - `/server`: Back-end code (Node.js, Express, Socket.io).
  - `/dist`: Bundled front-end files (output from Vite).
- File Naming: CamelCase for JS files (e.g., `gameLogic.js`), kebab-case for assets (e.g., `player-sprite.png`).
- Version Control: Git
  - Repository: GitHub or similar.
  - Branching: `main` for production, `dev` for development, feature branches (e.g., `feature/tournament-mode`).
- Testing:
  - Unit Tests: Mocha or Jest for JS code.
  - End-to-End: Selenium for browser testing (optional).
- Deployment:
  - Platform: AWS, Heroku, or GCP.
  - Strategy: Serve `/dist` as static files, run Node.js server for back end.

## Coding Preferences

- Comments: Use JSDoc for functions and inline comments for complex logic.
- Error Handling: Try-catch blocks for async operations, log errors to console during dev.
- Performance: Optimize three.js rendering (e.g., instanced meshes, frustum culling) and minimize Socket.io bandwidth usage.
- Security: Sanitize inputs, use HTTPS, validate all client requests server-side.

## Database Schema Hints

- Collections:
  - `players`: { username, email, characterClass, tier, score }
  - `tournaments`: { id, tier, participants, bracket, status }
  - `battleRoyals`: { id, tier, participants, placements, date }
  - `playerScores`: { playerId, totalPoints, lastUpdated }

## Notes

- Always test multiplayer features with multiple browser tabs locally before deploying.
- Prioritize server authority for game state to prevent cheating.
- Keep three.js scenes lightweight initially (e.g., use basic shapes) and add detail later.

## Team Instructions

- Update this file if the stack changes (e.g., adding a physics engine like Cannon.js).
- Refer to this for all tech decisions to stay consistent.
