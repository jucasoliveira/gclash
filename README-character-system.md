# Guild Clash Character System

## Overview

The Guild Clash Character System allows players to create and manage multiple characters with different classes, levels, and equipment. This README provides a quick overview of the system, its key features, and implementation details.

## Key Features

- **Multiple Characters Per Player**: Players can create and manage multiple characters
- **Character Classes**: Three distinct classes (Clerk, Warrior, Ranger) with unique stats and abilities
- **Character Progression**: Characters gain experience and level up through gameplay
- **Equipment System**: Characters can equip weapons, armor, and accessories
- **Inventory Management**: Characters can collect and store items
- **Character Selection**: Players can switch between their characters
- **Character Statistics**: Track wins, losses, kills, deaths, and other stats per character

## Implementation

### Data Models

- **Player Model**: Stores user account information and owns multiple characters
- **Character Schema**: Embedded within the Player model, contains character-specific data
- **Equipment System**: Slots for weapon, armor, and accessory
- **Inventory System**: Array of items with name, type, rarity, and stats

### API Endpoints

- **GET /api/characters**: List all characters for a player
- **POST /api/characters**: Create a new character
- **GET /api/characters/:characterId**: Get details for a specific character
- **PUT /api/characters/:characterId/activate**: Set a character as active

### Client-Side Flow

1. User logs in or registers
2. User is redirected to the character selection page
3. User creates a character or selects an existing one
4. User continues to the lobby with the active character
5. Game uses the active character's class and stats

## Character Classes

### Clerk

- **Color**: Blue
- **Health**: 80
- **Speed**: 15
- **Strengths**: Fast movement, ranged attacks
- **Weaknesses**: Lower health pool

### Warrior

- **Color**: Red
- **Health**: 120
- **Speed**: 8
- **Strengths**: High health, powerful melee attacks
- **Weaknesses**: Slower movement

### Ranger

- **Color**: Green
- **Health**: 100
- **Speed**: 12
- **Strengths**: Balanced stats, good range
- **Weaknesses**: No particular strengths or weaknesses

## Usage

### Creating a Character

```javascript
// Client-side code
const createCharacter = async (playerId, name, characterClass) => {
  const response = await fetch("http://localhost:3000/api/characters", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerId,
      name,
      characterClass,
    }),
  });
  return await response.json();
};
```

### Selecting a Character

```javascript
// Client-side code
const selectCharacter = async (playerId, characterId) => {
  const response = await fetch(
    `http://localhost:3000/api/characters/${characterId}/activate`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ playerId }),
    }
  );
  return await response.json();
};
```

### Fetching Characters

```javascript
// Client-side code
const fetchCharacters = async (playerId) => {
  const response = await fetch(
    `http://localhost:3000/api/characters?playerId=${playerId}`
  );
  return await response.json();
};
```

## Documentation

For more detailed information, please refer to the following documentation:

- [Character System Documentation](docs/character-system.md): Detailed information about the character system
- [WebSocket Protocol](docs/websocket-protocol.md): Information about character-related WebSocket messages
- [PROGRESS.md](PROGRESS.md): Development progress and implementation details

## Future Enhancements

- Character progression with experience points and level-ups
- Equipment and inventory management system
- Character deletion and editing functionality
- Character-specific achievements and rewards
- Visual customization options for characters
