# CLAUDE.md - Guild Clash Development Guidelines

## Build/Test/Lint Commands
- Build: `npm run build` (uses Webpack to bundle for production)
- Dev server: `npm run dev` (starts development server with hot reload)
- Test: `npm test` (runs all tests with Jest/Mocha)
- Test single: `npm test -- -t "test name"` (runs specific test)
- Lint: `npm run lint` (ESLint with Airbnb/Standard config)
- Fix lint: `npm run lint -- --fix` (auto-fix linting issues)

## Code Style Guidelines
- **JS Standard**: ES6+ with Babel, follow Airbnb/Standard style guide
- **Naming**: CamelCase for JS files/functions/variables, PascalCase for classes/components, kebab-case for assets
- **Imports**: Group by: 1) standard libs 2) external packages 3) internal modules
- **Comments**: JSDoc for functions, inline comments for complex logic only
- **Error Handling**: Try-catch for async, server-side validation for all requests
- **Structure**: `/client` (frontend), `/server` (backend), `/dist` (build output)
- **Git**: main (prod), dev (development), feature branches (feature/name)
- **Performance**: Optimize three.js rendering, minimize Socket.io bandwidth

## Tech Stack
- Frontend: three.js (3D), HTML5/CSS3 (UI), Howler.js (audio), Socket.io-client 
- Backend: Node.js, Express.js, Socket.io, MongoDB/Mongoose, JWT auth