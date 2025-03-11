# Character System Documentation

## Overview

The Guild Clash character system allows players to create and manage multiple characters with different classes, levels, and equipment. This document provides detailed information about the implementation, data models, API endpoints, and usage examples.

## Data Models

### Character Schema

The Character schema is embedded within the Player model and contains the following fields:

```javascript
const characterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 50,
  },
  characterClass: {
    type: String,
    required: true,
    enum: ["CLERK", "WARRIOR", "RANGER"],
    default: "CLERK",
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 100,
  },
  experience: {
    type: Number,
    default: 0,
  },
  equipment: {
    weapon: {
      type: String,
      default: null,
    },
    armor: {
      type: String,
      default: null,
    },
    accessory: {
      type: String,
      default: null,
    },
  },
  items: [
    {
      name: String,
      type: String,
      rarity: String,
      stats: mongoose.Schema.Types.Mixed,
    },
  ],
  stats: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    damageDealt: { type: Number, default: 0 },
    healingDone: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
});
```

### Player Schema

The Player schema has been updated to include an array of characters and track the active character:

```javascript
const playerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    minlength: 3,
    maxlength: 50,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    lowercase: true,
    match: [/.+\@.+\..+/, "Please enter a valid email address"],
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
  },
  salt: {
    type: String,
    select: false,
  },
  characters: [characterSchema],
  activeCharacterId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  score: {
    type: Number,
    default: 0,
  },
  tier: {
    type: String,
    enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"],
    default: "BRONZE",
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
});
```

## API Endpoints

### Character Management

#### List Characters

```
GET /api/characters?playerId=:playerId
```

Returns all characters for a player and the active character ID.

**Response:**

```json
{
  "characters": [
    {
      "_id": "60f7b0b9e6b3f32d8c9e4567",
      "name": "Gandalf",
      "characterClass": "CLERK",
      "level": 5,
      "experience": 450,
      "equipment": {
        "weapon": "Staff of Power",
        "armor": "Mithril Robe",
        "accessory": "Ring of Wisdom"
      },
      "stats": {
        "wins": 10,
        "losses": 3,
        "kills": 25,
        "deaths": 8,
        "damageDealt": 1500,
        "healingDone": 800,
        "gamesPlayed": 13
      }
    }
  ],
  "activeCharacterId": "60f7b0b9e6b3f32d8c9e4567"
}
```

#### Create Character

```
POST /api/characters
```

**Request Body:**

```json
{
  "playerId": "60f7b0b9e6b3f32d8c9e4566",
  "name": "Aragorn",
  "characterClass": "WARRIOR"
}
```

**Response:**

```json
{
  "character": {
    "_id": "60f7b0b9e6b3f32d8c9e4568",
    "name": "Aragorn",
    "characterClass": "WARRIOR",
    "level": 1,
    "experience": 0,
    "equipment": {
      "weapon": null,
      "armor": null,
      "accessory": null
    },
    "stats": {
      "wins": 0,
      "losses": 0,
      "kills": 0,
      "deaths": 0,
      "damageDealt": 0,
      "healingDone": 0,
      "gamesPlayed": 0
    }
  },
  "activeCharacterId": "60f7b0b9e6b3f32d8c9e4568"
}
```

#### Get Character Details

```
GET /api/characters/:characterId?playerId=:playerId
```

**Response:**

```json
{
  "character": {
    "_id": "60f7b0b9e6b3f32d8c9e4567",
    "name": "Gandalf",
    "characterClass": "CLERK",
    "level": 5,
    "experience": 450,
    "equipment": {
      "weapon": "Staff of Power",
      "armor": "Mithril Robe",
      "accessory": "Ring of Wisdom"
    },
    "stats": {
      "wins": 10,
      "losses": 3,
      "kills": 25,
      "deaths": 8,
      "damageDealt": 1500,
      "healingDone": 800,
      "gamesPlayed": 13
    }
  }
}
```

#### Set Active Character

```
PUT /api/characters/:characterId/activate
```

**Request Body:**

```json
{
  "playerId": "60f7b0b9e6b3f32d8c9e4566"
}
```

**Response:**

```json
{
  "activeCharacterId": "60f7b0b9e6b3f32d8c9e4567",
  "message": "Character activated successfully"
}
```

## Client-Side Implementation

### Character Selection Flow

1. User logs in or registers
2. User is redirected to the character selection page
3. If the user has no characters, they are prompted to create one
4. User can create a new character by providing a name and selecting a class
5. User can select an existing character by clicking on it
6. After selecting a character, user can continue to the lobby
7. In the lobby, the active character is displayed and can be changed
8. When starting a game, the active character's class and stats are used

### Character Creation

The character creation form allows users to:

- Enter a character name (3-50 characters)
- Select a character class (Clerk, Warrior, Ranger)
- View class-specific stats and descriptions
- Submit the form to create the character

### Character Selection

The character selection interface:

- Displays all characters for the user
- Shows character name, class, level, and basic stats
- Highlights the active character
- Allows selecting a different character
- Provides a button to create new characters

### Lobby Integration

The lobby page:

- Displays the active character with class-specific styling
- Shows character level and class
- Allows changing the active character
- Uses the active character when starting a game

## Character Classes

### Clerk

- **Color**: Blue
- **Health**: 80
- **Speed**: 15
- **Description**: Magic user with speed and agility
- **Strengths**: Fast movement, ranged attacks
- **Weaknesses**: Lower health pool

### Warrior

- **Color**: Red
- **Health**: 120
- **Speed**: 8
- **Description**: Tank with heavy armor and strength
- **Strengths**: High health, powerful melee attacks
- **Weaknesses**: Slower movement

### Ranger

- **Color**: Green
- **Health**: 100
- **Speed**: 12
- **Description**: Balanced fighter with ranged attacks
- **Strengths**: Balanced stats, good range
- **Weaknesses**: No particular strengths or weaknesses

## Usage Examples

### Creating a Character

```javascript
// Client-side code
const createCharacter = async (playerId, name, characterClass) => {
  try {
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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to create character");
    }

    return data;
  } catch (error) {
    console.error("Error creating character:", error);
    throw error;
  }
};
```

### Selecting a Character

```javascript
// Client-side code
const selectCharacter = async (playerId, characterId) => {
  try {
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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to select character");
    }

    return data;
  } catch (error) {
    console.error("Error selecting character:", error);
    throw error;
  }
};
```

### Fetching Characters

```javascript
// Client-side code
const fetchCharacters = async (playerId) => {
  try {
    const response = await fetch(
      `http://localhost:3000/api/characters?playerId=${playerId}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch characters");
    }

    return data;
  } catch (error) {
    console.error("Error fetching characters:", error);
    throw error;
  }
};
```

## Future Enhancements

### Character Progression

- Experience points gained from matches
- Level-up mechanics with stat increases
- Skill points for customization
- Unlockable abilities at certain levels

### Equipment System

- Item drops from enemies
- Equipment with stat bonuses
- Rarity tiers for items
- Visual customization based on equipment

### Character Management

- Character deletion
- Character renaming
- Class transfer with penalties
- Character reset option

### Character Achievements

- Class-specific achievements
- Combat milestones
- Special challenges
- Achievement badges

### Visual Customization

- Character portraits
- Color schemes
- Cosmetic items
- Unlockable titles

## Troubleshooting

### Common Issues

1. **Character not appearing in list**

   - Ensure the player ID is correct
   - Check if the character was created successfully
   - Verify that the API response contains the character

2. **Cannot select character**

   - Confirm that the character ID is valid
   - Check if the player ID matches the character's owner
   - Verify that the API call is properly formatted

3. **Character stats not updating**

   - Ensure the game is properly reporting stats to the server
   - Check if the character ID is correctly passed to the game
   - Verify that the stats update API is working correctly

4. **Class-specific features not working**
   - Confirm that the character class is one of the allowed values
   - Check if the class is properly capitalized (CLERK, WARRIOR, RANGER)
   - Verify that the game is correctly reading the character class
