# Guild Clash Documentation

This directory contains comprehensive documentation for the Guild Clash project. Each file focuses on a specific aspect of the game architecture or implementation.

## Core Systems

- **[PHYSICS.md](PHYSICS.md)** - Comprehensive overview of the Rapier-based physics system
- **[game-physics-rules.md](game-physics-rules.md)** - Detailed rules and implementation guide for the physics system
- **[character_physics_fix.md](character_physics_fix.md)** - Detailed explanation of the character mesh positioning fix
- **[movement-physics-debugging.md](movement-physics-debugging.md)** - Guide for debugging movement and physics issues
- **[character-system.md](character-system.md)** - Character classes, creation, and management

## Gameplay Systems

- **[map-system.md](map-system.md)** - Map creation, terrain, and environment management
- **[tournament-system.md](tournament-system.md)** - Tournament mode implementation
- **[tournament-battle-royale-integration.md](tournament-battle-royale-integration.md)** - Integration between tournaments and battle royale
- **[death-respawn-system.md](death-respawn-system.md)** - Character death and respawn mechanics

## Network

- **[websocket-protocol.md](websocket-protocol.md)** - WebSocket communication protocol for multiplayer

## Debugging

The `movement-physics-debugging.md` file contains a comprehensive set of debugging commands and instructions for troubleshooting character movement and physics issues. This consolidates information previously scattered across multiple text files in the root directory.

## Additional Documentation

For more general project documentation, refer to these files in the root directory:

- `PROGRESS.md` - Detailed development history and progress
- `architecture.md` - Component-based architecture design
- `CLAUDE.md` - Development guidelines and coding standards
- `global_rules.md` - Technical specifications and rules

## Organization

This documentation is organized to help developers understand both the high-level architecture and specific implementation details. When adding new documentation, please follow these guidelines:

1. Create a new markdown file with a descriptive name
2. Include a clear title and introduction
3. Use sections and subsections with proper headings
4. Include code examples where appropriate
5. Update this README.md file to list the new documentation

## Contributing

When updating or adding new documentation:

1. Keep information consistent across all documentation files
2. Update related documentation when making significant changes
3. Use standard Markdown formatting for readability
4. Include diagrams or illustrations when they help explain complex concepts
