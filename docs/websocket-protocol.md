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
    characterClass: 'clerk',
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

#### battleRoyaleJoined

```javascript
{
  type: 'battleRoyaleJoined',
  battleRoyale: {
    id: 'battle_royale_id',
    name: 'Battle Royale Name',
    playerCount: 5,
    status: 'WAITING'
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

## Best Practices

1. Always check connection status before sending messages
2. Implement proper error handling for failed messages
3. Use consistent message formats
4. Include all required fields in messages
5. Validate data on both client and server
6. Handle reconnection gracefully
7. Implement proper logging for debugging
8. Use unique IDs for entities and actions
