# Guild Clash WebSocket Protocol

## Overview

Guild Clash uses WebSockets for real-time communication between clients and the server. This document outlines the message formats and protocols used for various game features, including player movement, combat, and tournament management.

## Connection Establishment

1. Client connects to the WebSocket server at `ws://localhost:3000` (or the configured server URL)
2. Server assigns a unique ID to the client and sends an `id` message
3. Client sends a `join` message with player data
4. Server acknowledges with a `joined` message and sends existing players list

## Message Format

All messages are JSON objects with a `type` field indicating the message type. Additional fields depend on the message type.

## Common Messages

### Client to Server

#### ping

```javascript
{
  type: 'ping',
  timestamp: 1741691817655
}
```

#### join

```javascript
{
  type: 'join',
  playerData: {
    username: 'PlayerName',
    characterId: 'character_id', // ID of the active character
    characterName: 'CharacterName', // Name of the active character
    characterClass: 'CLERK', // Class of the active character (CLERK, WARRIOR, RANGER)
    characterLevel: 5, // Level of the active character
    position: { x: 0, y: 0, z: 0 },
    auth: {
      userId: 'database_user_id',
      username: 'AuthenticatedUsername'
    },
    tournamentId: 'tournament_id' // Optional, included when joining from a tournament
  }
}
```

#### playerMove

```javascript
{
  type: 'playerMove',
  position: {
    x: 10.5,
    y: 0.0,
    z: -5.2
  }
}
```

#### playerAttack

```javascript
{
  type: 'playerAttack',
  targetId: 'target_player_id',
  damage: 15,
  attackType: 'primary',
  position: { x: 10.5, y: 0.0, z: -5.2 },
  attackId: 'unique_attack_id'
}
```

### Server to Client

#### id

```javascript
{
  type: 'id',
  id: '49a9bdb3-75ef-4a82-93ab-65ba0e62196e'
}
```

#### joined

```javascript
{
  type: 'joined',
  id: 'player_id',
  username: 'PlayerName',
  characterClass: 'clerk',
  stats: {
    health: 80,
    maxHealth: 80,
    damage: 15,
    speed: 12,
    attackSpeed: 1.2,
    range: 5
  },
  currentTournament: 'tournament_id' // Optional, included if player is in a tournament
}
```

#### playersList

```javascript
{
  type: 'playersList',
  players: {
    'player_id_1': {
      id: 'player_id_1',
      username: 'Player1',
      characterClass: 'clerk',
      position: { x: 10.5, y: 0.0, z: -5.2 }
    },
    'player_id_2': {
      id: 'player_id_2',
      username: 'Player2',
      characterClass: 'warrior',
      position: { x: -5.0, y: 0.0, z: 8.3 }
    }
  }
}
```

#### playerJoined

```javascript
{
  type: 'playerJoined',
  id: 'player_id',
  username: 'PlayerName',
  characterClass: 'clerk',
  position: { x: 0, y: 0, z: 0 }
}
```

#### playerLeft

```javascript
{
  type: 'playerLeft',
  id: 'player_id'
}
```

#### playerMoved

```javascript
{
  type: 'playerMoved',
  id: 'player_id',
  position: {
    x: 10.5,
    y: 0.0,
    z: -5.2
  }
}
```

#### playerAttacked

```javascript
{
  type: 'playerAttacked',
  id: 'attacker_id',
  targetId: 'target_id',
  damage: 15,
  attackType: 'primary',
  inRange: true,
  distance: 3.5,
  attackId: 'unique_attack_id'
}
```

#### playerAttackMissed

```javascript
{
  type: 'playerAttackMissed',
  id: 'attacker_id',
  targetId: 'target_id',
  attackType: 'primary',
  reason: 'OUT_OF_RANGE',
  distance: 12.5,
  maxRange: 5,
  attackId: 'unique_attack_id'
}
```

#### playerHealth

```javascript
{
  type: 'playerHealth',
  id: 'player_id',
  health: 65,
  maxHealth: 80,
  damage: 15,
  attackerId: 'attacker_id'
}
```

#### playerDied

```javascript
{
  type: 'playerDied',
  id: 'player_id',
  attackerId: 'attacker_id'
}
```

#### error

```javascript
{
  type: 'error',
  message: 'Error message'
}
```

## Tournament Messages

### Client to Server

#### createTournament

```javascript
{
  type: 'createTournament',
  name: 'Tournament Name',
  tier: 'ALL' // Optional, defaults to 'ALL'
}
```

#### joinTournament

```javascript
{
  type: 'joinTournament',
  tournamentId: 'tournament_id'
}
```

#### startTournament

```javascript
{
  type: 'startTournament',
  tournamentId: 'tournament_id'
}
```

#### tournamentMatchComplete

```javascript
{
  type: 'tournamentMatchComplete',
  tournamentId: 'tournament_id',
  matchId: 'match_id',
  winnerId: 'winner_id'
}
```

#### tournamentBracketRequest

```javascript
{
  type: 'tournamentBracketRequest',
  tournamentId: 'tournament_id'
}
```

### Server to Client

#### tournamentCreated

```javascript
{
  type: 'tournamentCreated',
  tournament: {
    id: 'tournament_id',
    name: 'Tournament Name',
    tier: 'ALL',
    maxPlayers: 16,
    playerCount: 1,
    status: 'WAITING'
  }
}
```

#### tournamentJoined

```javascript
{
  type: 'tournamentJoined',
  tournament: {
    id: 'tournament_id',
    name: 'Tournament Name',
    playerCount: 2,
    players: [
      { id: 'player_id_1', username: 'Player1', characterClass: 'clerk' },
      { id: 'player_id_2', username: 'Player2', characterClass: 'warrior' }
    ],
    status: 'WAITING'
  }
}
```

#### newTournament

```javascript
{
  type: 'newTournament',
  tournament: {
    id: 'tournament_id',
    name: 'Tournament Name',
    tier: 'ALL',
    maxPlayers: 16,
    playerCount: 1,
    status: 'WAITING'
  }
}
```

#### tournamentUpdated

```javascript
{
  type: 'tournamentUpdated',
  tournament: {
    id: 'tournament_id',
    name: 'Tournament Name',
    playerCount: 3,
    status: 'WAITING'
  }
}
```

#### activeTournaments

```javascript
{
  type: 'activeTournaments',
  tournaments: [
    {
      id: 'tournament_id_1',
      name: 'Tournament 1',
      playerCount: 3,
      status: 'WAITING'
    },
    {
      id: 'tournament_id_2',
      name: 'Tournament 2',
      playerCount: 5,
      status: 'WAITING'
    }
  ]
}
```

#### tournamentBracket

```javascript
{
  type: 'tournamentBracket',
  tournamentId: 'tournament_id',
  bracket: {
    rounds: [
      [
        {
          id: 'match_1',
          player1Id: 'player_id_1',
          player2Id: 'player_id_2',
          status: 'WAITING'
        },
        // More matches...
      ],
      // More rounds...
    ]
  }
}
```

#### tournamentMatchReady

```javascript
{
  type: 'tournamentMatchReady',
  tournamentId: 'tournament_id',
  matchId: 'match_id',
  player1Id: 'player_id_1',
  player2Id: 'player_id_2'
}
```

#### tournamentComplete

```javascript
{
  type: 'tournamentComplete',
  tournamentId: 'tournament_id',
  winnerId: 'winner_id',
  winnerName: 'Winner Name'
}
```

## Battle Royale Messages

### Client to Server

#### createBattleRoyale

```javascript
{
  type: 'createBattleRoyale',
  name: 'Battle Royale Name',
  tier: 'ALL' // Optional, defaults to 'ALL'
}
```

#### joinBattleRoyale

```javascript
{
  type: 'joinBattleRoyale',
  battleRoyaleId: 'battle_royale_id'
}
```

### Server to Client

#### battleRoyaleCreated

```javascript
{
  type: 'battleRoyaleCreated',
  battleRoyale: {
    id: 'battle_royale_id',
    name: 'Battle Royale Name',
    tier: 'ALL',
    maxPlayers: 40,
    playerCount: 1,
    status: 'WAITING'
  }
}
```

#### battleRoyaleEvent

```javascript
{
  type: 'battleRoyaleEvent',
  data: {
    battleRoyaleId: 'battle_royale_id',
    name: 'Tournament Champions Battle Royale',
    tier: 'champions',
    playerCount: 0,
    maxPlayers: 40,
    startTime: '2025-03-15T14:30:00.000Z'
  }
}
```

#### battleRoyaleInvitation

```javascript
{
  type: 'battleRoyaleInvitation',
  data: {
    battleRoyaleId: 'battle_royale_id',
    message: 'You have been invited to join the Battle Royale as a tournament winner!',
    name: 'Tournament Champions Battle Royale',
    tier: 'champions',
    startTime: '2025-03-15T14:30:00.000Z'
  }
}
```

#### battleRoyaleUpdated

```javascript
{
  type: 'battleRoyaleUpdated',
  data: {
    battleRoyaleId: 'battle_royale_id',
    participantCount: 25
  }
}
```

#### battleRoyaleStarted

```javascript
{
  type: 'battleRoyaleStarted',
  data: {
    battleRoyaleId: 'battle_royale_id',
    name: 'Tournament Champions Battle Royale',
    tier: 'champions',
    participants: ['player1', 'player2', '...'],
    startTime: '2025-03-15T14:30:00.000Z'
  }
}
```

#### battleRoyaleJoined

```javascript
{
  type: 'battleRoyaleJoined',
  data: {
    id: 'battle_royale_id',
    name: 'Battle Royale Name',
    playerCount: 5,
    status: 'pending'
  }
}
```

#### safeZoneUpdate

```javascript
{
  type: 'safeZoneUpdate',
  battleRoyaleId: 'battle_royale_id',
  stage: 2,
  center: { x: 0, y: 0, z: 0 },
  radius: 50,
  shrinkTime: 60, // seconds
  damagePerSecond: 5
}
```

## Character-Related Messages

### Client to Server

#### characterUpdate

Sent when a character's stats are updated (after a match, when gaining experience, etc.)

```javascript
{
  type: 'characterUpdate',
  characterId: 'character_id',
  updates: {
    experience: 150, // Experience gained
    level: 6, // New level if leveled up
    stats: {
      wins: 1, // Increment wins
      losses: 0,
      kills: 3, // Increment kills
      deaths: 1, // Increment deaths
      damageDealt: 450, // Add damage dealt
      healingDone: 0,
      gamesPlayed: 1 // Increment games played
    }
  }
}
```

#### characterEquipItem

Sent when a character equips an item

```javascript
{
  type: 'characterEquipItem',
  characterId: 'character_id',
  slot: 'weapon', // weapon, armor, or accessory
  item: {
    name: 'Excalibur',
    type: 'sword',
    rarity: 'legendary',
    stats: {
      damage: 50,
      critChance: 10
    }
  }
}
```

#### characterAddItem

Sent when a character acquires a new item

```javascript
{
  type: 'characterAddItem',
  characterId: 'character_id',
  item: {
    name: 'Health Potion',
    type: 'consumable',
    rarity: 'common',
    stats: {
      healing: 25
    }
  }
}
```

### Server to Client

#### characterUpdated

Sent to confirm character updates and broadcast to other players if needed

```javascript
{
  type: 'characterUpdated',
  characterId: 'character_id',
  updates: {
    experience: 150,
    level: 6,
    stats: {
      wins: 10,
      losses: 3,
      kills: 25,
      deaths: 8,
      damageDealt: 1500,
      healingDone: 800,
      gamesPlayed: 13
    }
  },
  leveledUp: true, // Indicates if the character leveled up
  rewards: [
    {
      type: 'item',
      name: 'Steel Sword',
      rarity: 'uncommon'
    },
    {
      type: 'currency',
      amount: 100
    }
  ]
}
```

#### characterEquipmentUpdated

Sent to confirm equipment changes and broadcast to other players

```javascript
{
  type: 'characterEquipmentUpdated',
  characterId: 'character_id',
  equipment: {
    weapon: {
      name: 'Excalibur',
      type: 'sword',
      rarity: 'legendary',
      stats: {
        damage: 50,
        critChance: 10
      }
    },
    armor: {
      name: 'Mithril Plate',
      type: 'heavy',
      rarity: 'rare',
      stats: {
        defense: 30,
        healthBonus: 20
      }
    },
    accessory: {
      name: 'Amulet of Power',
      type: 'amulet',
      rarity: 'epic',
      stats: {
        magicBoost: 15,
        cooldownReduction: 10
      }
    }
  },
  statChanges: {
    health: +20,
    damage: +50,
    defense: +30,
    speed: -5
  }
}
```

#### characterInventoryUpdated

Sent to confirm inventory changes

```javascript
{
  type: 'characterInventoryUpdated',
  characterId: 'character_id',
  inventory: [
    {
      name: 'Health Potion',
      type: 'consumable',
      rarity: 'common',
      stats: {
        healing: 25
      },
      quantity: 3
    },
    {
      name: 'Iron Sword',
      type: 'weapon',
      rarity: 'common',
      stats: {
        damage: 15
      }
    }
  ]
}
```

## Error Handling

The server sends error messages when it encounters issues processing client requests:

```javascript
{
  type: 'error',
  message: 'Error message'
}
```

Common error messages include:

- "Not connected to server"
- "Invalid message format"
- "Tournament not found"
- "Cannot join tournament: Tournament is full"
- "Cannot join tournament: Tournament already started"
- "Player not initialized"
- "Battle royale not found"
- "Failed to join battle royale"

## Best Practices

1. Always check connection status before sending messages
2. Implement proper error handling for failed messages
3. Use consistent message formats
4. Include all required fields in messages
5. Validate data on both client and server
6. Handle reconnection gracefully
7. Implement proper logging for debugging
8. Use unique IDs for entities and actions
